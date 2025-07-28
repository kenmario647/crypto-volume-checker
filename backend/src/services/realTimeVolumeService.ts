import { EventEmitter } from 'events';
import BinanceRestApiService, { BinanceVolumeData } from './binanceRestApi';
import UpbitRestApiService, { UpbitVolumeData } from './upbitRestApi';
import { logger } from '../utils/logger';

export interface VolumeHistory {
  timestamp: number;
  quoteVolume: number;
}

export interface CombinedVolumeData {
  symbol: string;
  volume: string;
  quoteVolume: string;
  volume24h: string;
  priceChangePercent: string;
  lastPrice: string;
  rank: number;
  previousRank?: number;
  exchange: 'binance' | 'upbit';
  originalQuoteVolume: number; // For sorting purposes
  volumeHistory: VolumeHistory[];
  rankChanged?: boolean;
  volumeSpike?: boolean;
  newRankIn?: boolean;
  volumeIncrease5m?: number;
}

export class RealTimeVolumeService extends EventEmitter {
  private binanceAPI: BinanceRestApiService;
  private upbitAPI: UpbitRestApiService;
  private binanceData: CombinedVolumeData[] = [];
  private upbitData: CombinedVolumeData[] = [];
  private volumeHistory: Map<string, VolumeHistory[]> = new Map();

  constructor() {
    super();
    
    this.binanceAPI = new BinanceRestApiService();
    this.upbitAPI = new UpbitRestApiService();

    this.setupEventHandlers();

    logger.info('RealTimeVolumeService initialized');
  }

  private setupEventHandlers() {
    this.binanceAPI.on('volumeUpdate', (data: BinanceVolumeData[]) => {
      logger.debug('Received Binance volume update');
      this.binanceData = data.map(item => this.normalizeBinanceData(item));
      this.emit('binanceUpdate', this.binanceData);
    });

    this.upbitAPI.on('volumeUpdate', (data: UpbitVolumeData[]) => {
      logger.debug('Received Upbit volume update');
      this.upbitData = data.map(item => this.normalizeUpbitData(item));
      this.emit('upbitUpdate', this.upbitData);
    });
  }


  private normalizeBinanceData(data: BinanceVolumeData): CombinedVolumeData {
    const quoteVolumeUSD = parseFloat(data.quoteVolume);
    const volume24h = this.calculate24hVolume(data.symbol, quoteVolumeUSD, 'binance');
    const history = this.getVolumeHistory(data.symbol, 'binance');
    
    return {
      symbol: data.symbol,
      volume: this.formatVolume(parseFloat(data.volume)),
      quoteVolume: this.formatVolumeUSD(quoteVolumeUSD),
      volume24h: this.formatVolumeUSD(volume24h),
      priceChangePercent: `${parseFloat(data.priceChangePercent).toFixed(2)}%`,
      lastPrice: `$${parseFloat(data.lastPrice).toFixed(6)}`,
      rank: data.rank,
      previousRank: data.previousRank,
      exchange: 'binance',
      originalQuoteVolume: quoteVolumeUSD,
      volumeHistory: history,
      rankChanged: data.rankChanged,
      volumeSpike: data.volumeSpike,
      newRankIn: data.newRankIn,
      volumeIncrease5m: data.volumeIncrease5m
    };
  }

  private normalizeUpbitData(data: UpbitVolumeData): CombinedVolumeData {
    // Convert KRW to USD (approximate rate: 1 USD = 1300 KRW)
    const quoteVolumeUSD = data.quoteVolume * 0.00077;
    const volume24h = this.calculate24hVolume(data.symbol, quoteVolumeUSD, 'upbit');
    const history = this.getVolumeHistory(data.symbol, 'upbit');
    
    return {
      symbol: data.symbol,
      volume: this.formatVolume(data.volume),
      quoteVolume: this.formatVolumeUSD(quoteVolumeUSD),
      volume24h: this.formatVolumeUSD(volume24h),
      priceChangePercent: `${data.priceChangePercent.toFixed(2)}%`,
      lastPrice: `₩${data.lastPrice.toLocaleString()}`,
      rank: data.rank,
      previousRank: data.previousRank,
      exchange: 'upbit',
      originalQuoteVolume: quoteVolumeUSD,
      volumeHistory: history,
      rankChanged: data.rankChanged,
      volumeSpike: data.volumeSpike,
      newRankIn: data.newRankIn,
      volumeIncrease5m: data.volumeIncrease5m
    };
  }

  private formatVolume(volume: number): string {
    // 常にミリオン単位で表示
    return `${(volume / 1e6).toFixed(1)}M`;
  }

  private formatVolumeUSD(volume: number): string {
    // 常にミリオン単位で表示
    return `$${(volume / 1e6).toFixed(1)}M`;
  }

  public getBinanceData(): CombinedVolumeData[] {
    return this.binanceData.slice(0, 20);
  }

  public getUpbitData(): CombinedVolumeData[] {
    return this.upbitData.slice(0, 20);
  }

  private calculate24hVolume(symbol: string, currentVolume: number, exchange: 'binance' | 'upbit'): number {
    const now = Date.now();
    // Use exchange-specific key to avoid mixing data
    const historyKey = `${exchange}:${symbol}`;
    const history = this.volumeHistory.get(historyKey) || [];
    
    // Use actual current time to show real data collection time
    const currentTime = now;
    
    // Get the latest data point
    const latestData = history.length > 0 ? history[history.length - 1] : null;
    
    // Add new data point if:
    // 1. No history exists, or
    // 2. At least 4.5 minutes have passed since the last data point
    const shouldAddData = !latestData || (currentTime - latestData.timestamp) >= (4.5 * 60 * 1000);
    
    if (shouldAddData) {
      history.push({ timestamp: currentTime, quoteVolume: currentVolume });
      logger.debug(`[VOLUME_HISTORY] Added new data point for ${historyKey} at ${new Date(currentTime).toLocaleTimeString()}`);
    } else {
      const timeSinceLastData = latestData ? ((currentTime - latestData.timestamp) / 1000 / 60).toFixed(1) : 0;
      logger.debug(`[VOLUME_HISTORY] Skipped data point for ${historyKey}, only ${timeSinceLastData} minutes since last update`);
    }
    
    // Keep only data from last 24 hours
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const filteredHistory = history.filter(h => h.timestamp >= oneDayAgo);
    
    // Store filtered history with exchange-specific key
    this.volumeHistory.set(historyKey, filteredHistory);
    
    // Return the current 24h volume (not a sum of history)
    return currentVolume;
  }
  
  private getVolumeHistory(symbol: string, exchange: 'binance' | 'upbit'): VolumeHistory[] {
    const historyKey = `${exchange}:${symbol}`;
    return this.volumeHistory.get(historyKey) || [];
  }

  public disconnect() {
    this.binanceAPI.disconnect();
    this.upbitAPI.disconnect();
    
    logger.info('RealTimeVolumeService disconnected');
  }
}

export default RealTimeVolumeService;