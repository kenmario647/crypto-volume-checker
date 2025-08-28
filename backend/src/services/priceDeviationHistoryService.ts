import { PriceDeviationService } from './priceDeviationService';
import { logger } from '../utils/logger';

interface DeviationHistoryPoint {
  timestamp: number;
  symbol: string;
  spotExchange: string;
  perpExchange: string;
  spotPrice: number;
  perpPrice: number;
  deviation: number;
  spotVolume: number;
  perpVolume: number;
  totalVolume: number;
  fundingRate?: number; // FRデータを追加
}

interface SymbolHistory {
  symbol: string;
  data: DeviationHistoryPoint[];
}

export class PriceDeviationHistoryService {
  private static instance: PriceDeviationHistoryService;
  private priceDeviationService: PriceDeviationService;
  private historyData: Map<string, DeviationHistoryPoint[]> = new Map();
  private isCollecting: boolean = false;
  private collectionInterval: NodeJS.Timeout | null = null;
  private frCollectionInterval: NodeJS.Timeout | null = null;
  private frDataCache: Map<string, number | undefined> = new Map(); // FRデータのキャッシュ
  private binanceRestApi: any = null; // Reference to binanceRestApi for shared FR data
  private readonly MAX_HISTORY_POINTS = 1440; // 24時間分 (1分間隔)

  private constructor() {
    this.priceDeviationService = PriceDeviationService.getInstance();
  }

  // Set binanceRestApi reference for shared FR data
  public setBinanceRestApi(binanceRestApi: any): void {
    this.binanceRestApi = binanceRestApi;
    logger.info('BinanceRestApi reference set for shared FR data in PriceDeviationHistoryService');
  }

  public static getInstance(): PriceDeviationHistoryService {
    if (!PriceDeviationHistoryService.instance) {
      PriceDeviationHistoryService.instance = new PriceDeviationHistoryService();
    }
    return PriceDeviationHistoryService.instance;
  }

  /**
   * データ収集を開始
   */
  public startCollection(): void {
    if (this.isCollecting) {
      logger.info('Price deviation history collection is already running');
      return;
    }

    this.isCollecting = true;
    logger.info('Starting price deviation history collection every 1 minute, FR collection every 5 minutes');
    
    // 初回実行
    this.collectFundingRates(); // FR初回取得
    this.collectCurrentData();
    
    // 1分間隔で乖離率データ実行
    this.collectionInterval = setInterval(() => {
      this.collectCurrentData();
    }, 60000); // 60秒 (1分)
    
    // 5分間隔でFRデータ実行
    this.frCollectionInterval = setInterval(() => {
      this.collectFundingRates();
    }, 300000); // 300秒 (5分)
  }

  /**
   * データ収集を停止
   */
  public stopCollection(): void {
    if (!this.isCollecting) {
      return;
    }

    this.isCollecting = false;
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    if (this.frCollectionInterval) {
      clearInterval(this.frCollectionInterval);
      this.frCollectionInterval = null;
    }
    logger.info('Stopped price deviation history collection');
  }

  /**
   * 現在の乖離率データを収集して保存
   */
  private async collectCurrentData(): Promise<void> {
    try {
      // Get all deviations with volume >= 50M (no limit on count)
      const currentData = await this.priceDeviationService.getWebSocketDeviations(999, 50000000);
      const timestamp = Date.now();

      logger.info(`Collecting deviation history data for ${currentData.length} symbols`);

      for (const item of currentData) {
        const historyPoint: DeviationHistoryPoint = {
          timestamp,
          symbol: item.symbol,
          spotExchange: item.spotExchange,
          perpExchange: item.perpExchange,
          spotPrice: item.spotPrice,
          perpPrice: item.perpPrice,
          deviation: item.deviation,
          spotVolume: item.spotVolume,
          perpVolume: item.perpVolume,
          totalVolume: item.totalVolume,
          fundingRate: this.frDataCache.get(item.symbol) // キャッシュからFRデータを取得
        };

        this.addHistoryPoint(item.symbol, historyPoint);
      }

      const frCount = Array.from(this.frDataCache.values()).filter(fr => fr !== undefined).length;
      logger.info(`Successfully collected and stored deviation history for ${currentData.length} symbols (using ${frCount} cached FR values)`);
      
      // Log top 5 for verification
      const sortedData = currentData.slice(0, 5);
      sortedData.forEach((item, index) => {
        const fr = this.frDataCache.get(item.symbol);
        logger.info(`  ${index + 1}. ${item.symbol}: Deviation=${item.deviation.toFixed(3)}%, FR=${fr !== undefined ? fr.toFixed(4) + '%' : 'N/A'}`);
      });
    } catch (error) {
      logger.error('Error collecting deviation history data:', error);
    }
  }
  
  /**
   * FRデータを収集してキャッシュに保存（5分間隔）
   */
  private async collectFundingRates(): Promise<void> {
    try {
      // Get all deviations with volume >= 50M to get symbols list
      const currentData = await this.priceDeviationService.getWebSocketDeviations(999, 50000000);
      
      logger.info(`Collecting Funding Rate data for ${currentData.length} symbols`);

      // Use shared FR data from binanceRestApi if available
      if (this.binanceRestApi && this.binanceRestApi.getFrOiData) {
        const frOiMap = this.binanceRestApi.getFrOiData();
        logger.info(`Using shared FR data for ${frOiMap.size} symbols from binanceRestApi`);
        
        // Clear and update cache with shared data
        this.frDataCache.clear();
        currentData.forEach((item) => {
          const frData = frOiMap.get(item.symbol);
          if (frData) {
            // binanceRestApi stores raw FR value (e.g., 0.0001), multiply by 100 for percentage
            this.frDataCache.set(item.symbol, frData.fundingRate * 100);
          }
        });
        
        const frCount = Array.from(this.frDataCache.values()).filter(fr => fr !== undefined).length;
        logger.info(`Successfully updated FR cache for ${frCount} symbols (5-minute update using shared data)`);
      } else {
        // Fallback to individual API calls if binanceRestApi not available
        logger.warn('BinanceRestApi not available for shared FR data, falling back to individual API calls');
        
        const frDataPromises = currentData.map(async (item) => {
          try {
            const frResponse = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${item.symbol}USDT`);
            if (!frResponse.ok) throw new Error('Premium Index API error');
            
            const premiumData = await frResponse.json() as any;
            if (!premiumData.lastFundingRate) throw new Error('No lastFundingRate data');
            
            const baseRate = parseFloat(premiumData.lastFundingRate);
            const adjustedRate = baseRate * 100;
            
            return {
              symbol: item.symbol,
              fundingRate: adjustedRate
            };
          } catch {
            return {
              symbol: item.symbol,
              fundingRate: undefined
            };
          }
        });

        const frResults = await Promise.allSettled(frDataPromises);
        
        // キャッシュを更新
        this.frDataCache.clear();
        frResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            this.frDataCache.set(result.value.symbol, result.value.fundingRate);
          }
        });
        
        const frCount = Array.from(this.frDataCache.values()).filter(fr => fr !== undefined).length;
        logger.info(`Successfully updated FR cache for ${frCount} symbols (5-minute update)`);
      }
    } catch (error) {
      logger.error('Error collecting Funding Rate data:', error);
    }
  }

  /**
   * 特定のシンボルに履歴ポイントを追加
   */
  private addHistoryPoint(symbol: string, point: DeviationHistoryPoint): void {
    if (!this.historyData.has(symbol)) {
      this.historyData.set(symbol, []);
    }

    const symbolHistory = this.historyData.get(symbol)!;
    symbolHistory.push(point);

    // 最大保存数を超えた場合、古いデータを削除
    if (symbolHistory.length > this.MAX_HISTORY_POINTS) {
      symbolHistory.splice(0, symbolHistory.length - this.MAX_HISTORY_POINTS);
    }

    this.historyData.set(symbol, symbolHistory);
  }

  /**
   * 特定のシンボルの履歴データを取得
   */
  public getSymbolHistory(symbol: string, limit?: number): DeviationHistoryPoint[] {
    const history = this.historyData.get(symbol) || [];
    
    if (limit && limit > 0) {
      return history.slice(-limit);
    }
    
    return history;
  }

  /**
   * 全シンボルの履歴データを取得
   */
  public getAllHistory(): SymbolHistory[] {
    const result: SymbolHistory[] = [];
    
    for (const [symbol, data] of this.historyData.entries()) {
      result.push({
        symbol,
        data: [...data] // コピーを返す
      });
    }
    
    return result;
  }

  /**
   * 利用可能なシンボル一覧を取得
   */
  public getAvailableSymbols(): string[] {
    return Array.from(this.historyData.keys());
  }

  /**
   * 特定のシンボルの最新データを取得
   */
  public getLatestData(symbol: string): DeviationHistoryPoint | null {
    const history = this.historyData.get(symbol);
    if (!history || history.length === 0) {
      return null;
    }
    return history[history.length - 1];
  }

  /**
   * データ収集状況を取得
   */
  public getCollectionStatus(): {
    isCollecting: boolean;
    totalSymbols: number;
    totalDataPoints: number;
  } {
    let totalDataPoints = 0;
    for (const data of this.historyData.values()) {
      totalDataPoints += data.length;
    }

    return {
      isCollecting: this.isCollecting,
      totalSymbols: this.historyData.size,
      totalDataPoints
    };
  }

  /**
   * 古いデータを削除（24時間以上前）
   */
  public cleanupOldData(): void {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    let removedCount = 0;

    for (const [symbol, history] of this.historyData.entries()) {
      const filteredHistory = history.filter(point => point.timestamp > oneDayAgo);
      removedCount += history.length - filteredHistory.length;
      this.historyData.set(symbol, filteredHistory);
    }

    if (removedCount > 0) {
      logger.info(`Cleaned up ${removedCount} old deviation history data points`);
    }
  }
}