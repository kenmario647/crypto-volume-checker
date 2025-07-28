import { VolumeData } from '../types';
import { logger } from '../utils/logger';
import { BinanceClient } from './binanceClient';
import { UpbitClient } from './upbitClient';
import CrossDetectionService from './crossDetectionService';
import TradeRecommendationService from './tradeRecommendationService';
import TradeExecutionService from './tradeExecutionService';
import CrossNotificationService from './crossNotificationService';
import { Server } from 'socket.io';

export class VolumeService {
  private binanceClient: BinanceClient;
  private upbitClient: UpbitClient;
  private crossDetectionService: CrossDetectionService;
  private tradeRecommendationService: TradeRecommendationService;
  private tradeExecutionService: TradeExecutionService;
  private crossNotificationService: CrossNotificationService;
  private io?: Server;

  constructor(io?: Server, crossNotificationService?: CrossNotificationService) {
    this.binanceClient = new BinanceClient();
    this.upbitClient = new UpbitClient();
    this.crossDetectionService = new CrossDetectionService();
    this.tradeRecommendationService = new TradeRecommendationService();
    this.tradeExecutionService = new TradeExecutionService(io);
    this.crossNotificationService = crossNotificationService || new CrossNotificationService();
    this.io = io;
    
    // クロス検知イベントのリスナーを設定
    this.setupCrossEventListeners();
  }

  async getVolume24h() {
    try {
      const [binanceData, upbitData] = await Promise.all([
        this.getBinanceVolume(),
        this.getUpbitVolume()
      ]);

      const totalVolumeUsd = binanceData.totalVolume + upbitData.totalVolumeUsd;
      const totalVolumeFormatted = this.formatVolume(totalVolumeUsd);

      const topSymbols = [
        ...binanceData.topSymbols.slice(0, 3),
        ...upbitData.topSymbols.slice(0, 2)
      ].sort((a, b) => parseFloat(b.volumeUsd) - parseFloat(a.volumeUsd)).slice(0, 5);

      const result = {
        totalVolume: totalVolumeFormatted,
        change: '+5.67', 
        topSymbols: topSymbols.map(symbol => ({
          symbol: symbol.symbol,
          volume: this.formatVolume(parseFloat(symbol.volumeUsd)),
          change: parseFloat(symbol.change)
        }))
      };

      logger.info('Volume 24h data retrieved from exchanges');
      return result;
    } catch (error) {
      logger.error('Error fetching volume 24h data:', error);
      
      const mockData = {
        totalVolume: '$1,234,567,890',
        change: '+5.67',
        topSymbols: [
          { symbol: 'BTC', volume: '$12.3B', change: 3.45 },
          { symbol: 'ETH', volume: '$8.9B', change: -2.18 },
          { symbol: 'USDT', volume: '$45.2B', change: 0.12 },
        ]
      };
      return mockData;
    }
  }

  private async getBinanceVolume() {
    try {
      const topVolume = await this.binanceClient.getTopVolumeSymbols(10);
      const totalVolume = topVolume.reduce((sum, ticker) => sum + parseFloat(ticker.quoteVolume), 0);

      return {
        totalVolume,
        topSymbols: topVolume.map(ticker => ({
          symbol: ticker.symbol.replace('USDT', ''),
          volumeUsd: ticker.quoteVolume,
          change: ticker.priceChangePercent
        }))
      };
    } catch (error) {
      logger.error('Error fetching Binance volume data:', error);
      throw error;
    }
  }

  private async getUpbitVolume() {
    try {
      const topVolume = await this.upbitClient.getTopVolumeMarkets(10);
      const totalVolumeKRW = topVolume.reduce((sum, ticker) => sum + ticker.acc_trade_price_24h, 0);
      const totalVolumeUsd = totalVolumeKRW * 0.00075; 

      return {
        totalVolumeUsd,
        topSymbols: topVolume.map(ticker => ({
          symbol: ticker.market.replace('KRW-', ''),
          volumeUsd: (ticker.acc_trade_price_24h * 0.00075).toString(),
          change: (ticker.signed_change_rate * 100).toString()
        }))
      };
    } catch (error) {
      logger.error('Error fetching Upbit volume data:', error);
      throw error;
    }
  }

  private formatVolume(volume: number): string {
    // 常にミリオン単位で表示
    return `${(volume / 1e6).toFixed(1)}M`;
  }

  async getVolumeChart() {
    try {
      const mockChartData = {
        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
        data: [2.3, -1.2, 4.5, 3.1, -2.8, 5.6],
        previousDayData: [1.8, -0.9, 3.2, 2.7, -3.1, 4.8]
      };

      logger.info('Volume chart data retrieved');
      return mockChartData;
    } catch (error) {
      logger.error('Error fetching volume chart data:', error);
      throw error;
    }
  }

  async getVolumeChange() {
    try {
      const mockChangeData = {
        currentRate: 5.67,
        previousRate: 3.42,
        trend: 'up',
        changePercent: 65.8,
        timestamp: new Date()
      };

      logger.info('Volume change data retrieved');
      return mockChangeData;
    } catch (error) {
      logger.error('Error fetching volume change data:', error);
      throw error;
    }
  }

  async getSymbolVolumeChart(symbol: string, exchange: string, interval: string = '5m', limit: number = 36, realTimeVolumeService?: any) {
    try {
      if (!realTimeVolumeService) {
        throw new Error('realTimeVolumeService is required');
      }

      let matchingTicker: any = null;
      let tableSymbol = symbol;
      
      // Find matching ticker from the same data source as ranking table
      if (exchange === 'binance') {
        const binanceData = realTimeVolumeService.getBinanceData();
        const searchSymbol = symbol.endsWith('USDT') ? symbol.replace('USDT', '') : symbol;
        matchingTicker = binanceData.find((ticker: any) => {
          const tickerSymbol = ticker.symbol.replace('USDT', '');
          return tickerSymbol === searchSymbol || ticker.symbol === symbol;
        });
        if (matchingTicker) {
          tableSymbol = matchingTicker.symbol.replace('USDT', '');
        }
      } else if (exchange === 'upbit') {
        const upbitData = realTimeVolumeService.getUpbitData();
        const searchSymbol = symbol.startsWith('KRW-') ? symbol.replace('KRW-', '') : symbol;
        logger.info(`[UPBIT_CHART_DEBUG] Searching for symbol: ${searchSymbol} in upbit data`);
        logger.info(`[UPBIT_CHART_DEBUG] Available upbit symbols: ${upbitData.map((t: any) => t.symbol).join(', ')}`);
        
        matchingTicker = upbitData.find((ticker: any) => 
          ticker.symbol === searchSymbol
        );
        
        if (matchingTicker) {
          tableSymbol = matchingTicker.symbol;
          logger.info(`[UPBIT_CHART_DEBUG] Found matching upbit ticker: ${tableSymbol}, exchange: ${matchingTicker.exchange}`);
        } else {
          logger.warn(`[UPBIT_CHART_DEBUG] No matching upbit ticker found for: ${searchSymbol}`);
        }
      }

      if (!matchingTicker) {
        throw new Error(`Symbol ${symbol} not found in ${exchange} ranking data`);
      }

      logger.info(`[VOLUME_CHART_DEBUG] Found matching ticker for ${tableSymbol} (${exchange}): originalQuoteVolume = ${matchingTicker.originalQuoteVolume}`);


      // Use accumulated volume history from RealTimeVolumeService (5-minute ticker/24hr data)
      const volumeHistory = matchingTicker.volumeHistory || [];
      logger.info(`[VOLUME_CHART_DEBUG] ${tableSymbol}: Using accumulated history, length = ${volumeHistory.length}`);

      // Calculate moving averages with available data
      const volumeData = volumeHistory.map((h: any) => h.quoteVolume);
      const timestamps = volumeHistory.map((h: any) => h.timestamp);
      
      // Calculate moving averages (will return null for insufficient data points)
      const ma3 = this.calculateMovingAverage(volumeData, 3);
      const ma8 = this.calculateMovingAverage(volumeData, 8);
      const ma15 = this.calculateMovingAverage(volumeData, 15);

      const result = {
        symbol: tableSymbol,
        exchange,
        interval,
        current24hVolume: matchingTicker.originalQuoteVolume,
        data: volumeHistory.map((historyItem: any, index: number) => ({
          timestamp: historyItem.timestamp,
          volume: volumeData[index],
          ma3: ma3[index],
          ma8: ma8[index],
          ma15: ma15[index]
        }))
      };

      // Only perform cross detection if we have enough data for MA8 (minimum for golden cross)
      if (volumeHistory.length >= 8) {
        logger.info(`[CROSS_DEBUG] About to call performCrossDetection for ${tableSymbol} (${exchange}) with ${result.data.length} data points`);
        this.performCrossDetection(tableSymbol, exchange as 'binance' | 'upbit', result.data);
        logger.info(`[CROSS_DEBUG] performCrossDetection completed for ${tableSymbol} (${exchange})`);
      } else {
        logger.warn(`[VOLUME_CHART_DEBUG] ${tableSymbol}: Insufficient history (${volumeHistory.length} < 8) for cross detection, showing available MAs only`);
      }

      logger.info(`Volume chart data for ${tableSymbol} (${exchange}) retrieved. MA3: ${ma3.filter(x => x !== null).length}, MA8: ${ma8.filter(x => x !== null).length}, MA15: ${ma15.filter(x => x !== null).length} points available`);
      return result;
    } catch (error) {
      logger.error(`Error fetching volume chart for ${symbol} (${exchange}):`, error);
      throw error;
    }
  }

  /**
   * クロス検知イベントリスナーを設定
   */
  private setupCrossEventListeners(): void {
    this.crossDetectionService.on('goldenCross', (crossEvent) => {
      logger.info(`🚀 Golden Cross Alert: ${crossEvent.symbol} (${crossEvent.exchange})`);
      logger.info(`   MA3: ${crossEvent.previousMa3.toFixed(2)} → ${crossEvent.ma3Value.toFixed(2)}`);
      logger.info(`   MA8: ${crossEvent.previousMa8.toFixed(2)} → ${crossEvent.ma8Value.toFixed(2)}`);
      logger.info(`   Time: ${new Date(crossEvent.timestamp).toLocaleString('ja-JP')}`);
      
      // 📱 通知サービスに追加（APIポーリング用）
      this.crossNotificationService.addCrossNotification({
        ...crossEvent,
        type: 'golden_cross'
      });

      // WebSocketでフロントエンドに通知送信（従来通り）
      if (this.io) {
        this.io.emit('crossAlert', {
          id: `${crossEvent.exchange}-${crossEvent.symbol}-${crossEvent.timestamp}`,
          type: 'golden_cross',
          symbol: crossEvent.symbol,
          exchange: crossEvent.exchange,
          timestamp: crossEvent.timestamp,
          ma3Value: crossEvent.ma3Value,
          ma8Value: crossEvent.ma8Value,
          previousMa3: crossEvent.previousMa3,
          previousMa8: crossEvent.previousMa8,
          message: `${crossEvent.symbol} (${crossEvent.exchange.toUpperCase()})`
        });
      }
      
      // 🆕 取引推奨を生成
      this.generateTradeRecommendation(crossEvent);
    });

    this.crossDetectionService.on('deathCross', (crossEvent) => {
      logger.info(`📉 Death Cross Alert: ${crossEvent.symbol} (${crossEvent.exchange})`);
      logger.info(`   MA3: ${crossEvent.previousMa3.toFixed(2)} → ${crossEvent.ma3Value.toFixed(2)}`);
      logger.info(`   MA8: ${crossEvent.previousMa8.toFixed(2)} → ${crossEvent.ma8Value.toFixed(2)}`);
      logger.info(`   Time: ${new Date(crossEvent.timestamp).toLocaleString('ja-JP')}`);
      
      // 📱 通知サービスに追加（APIポーリング用）
      this.crossNotificationService.addCrossNotification({
        ...crossEvent,
        type: 'death_cross'
      });

      // WebSocketでフロントエンドに通知送信（従来通り）
      if (this.io) {
        this.io.emit('crossAlert', {
          id: `${crossEvent.exchange}-${crossEvent.symbol}-${crossEvent.timestamp}`,
          type: 'death_cross',
          symbol: crossEvent.symbol,
          exchange: crossEvent.exchange,
          timestamp: crossEvent.timestamp,
          ma3Value: crossEvent.ma3Value,
          ma8Value: crossEvent.ma8Value,
          previousMa3: crossEvent.previousMa3,
          previousMa8: crossEvent.previousMa8,
          message: `${crossEvent.symbol} (${crossEvent.exchange.toUpperCase()})`
        });
      }
    });
  }

  /**
   * 自動取引実行（保守的価格で指値注文）
   */
  private async generateTradeRecommendation(crossEvent: any): Promise<void> {
    try {
      // 自動取引が有効かチェック
      const autoTradeEnabled = process.env.AUTO_TRADE_ENABLED === 'true';
      if (!autoTradeEnabled) {
        logger.info(`⚠️ Auto trade disabled for ${crossEvent.symbol}, skipping auto trade`);
        return;
      }

      logger.info(`🔥 Auto executing LIMIT LONG for ${crossEvent.symbol} (${crossEvent.exchange})`);
      
      const recommendation = await this.tradeRecommendationService.generateLimitLongRecommendation(crossEvent);
      
      // 保守的価格で自動発注
      const conservativePrice = recommendation.recommendation.priceOptions.conservative.price;
      const quantity = recommendation.recommendation.quantity;
      
      logger.info(`📊 Auto placing order: ${crossEvent.symbol} x${quantity} @ $${conservativePrice.toFixed(2)} (conservative)`);
      
      const orderResult = await this.tradeExecutionService.executeLimitLongPosition(
        recommendation,
        conservativePrice
      );
      
      if (this.io) {
        this.io.emit('orderPlaced', {
          type: 'auto_limit_long',
          symbol: crossEvent.symbol,
          orderId: orderResult.orderId,
          quantity: quantity,
          limitPrice: conservativePrice,
          timestamp: Date.now()
        });
      }
      
      logger.info(`✅ AUTO LIMIT LONG executed for ${crossEvent.symbol}: Order ID ${orderResult.orderId}`);
    } catch (error) {
      logger.error(`❌ Failed to execute auto trade for ${crossEvent.symbol}:`, error);
      
      // エラー通知
      if (this.io) {
        this.io.emit('tradeRecommendationError', {
          type: 'auto_trade_failed',
          symbol: crossEvent.symbol,
          exchange: crossEvent.exchange,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * クロス検知を実行
   */
  private performCrossDetection(symbol: string, exchange: 'binance' | 'upbit', volumeData: any[]): void {
    try {
      logger.info(`[CROSS_DETECTION] Starting detection for ${symbol} (${exchange})`);
      logger.info(`[CROSS_DETECTION] Volume data length: ${volumeData.length}`);
      logger.info(`[CROSS_DETECTION] Volume data sample: ${JSON.stringify(volumeData.slice(-2), null, 2)}`);
      
      // Check if we have valid MA data
      const hasValidMA = volumeData.some(d => d.ma3 !== null && d.ma8 !== null);
      logger.info(`[CROSS_DETECTION] Has valid MA data: ${hasValidMA}`);
      
      // Binanceランキング上位20銘柄のみチェック
      if (exchange === 'binance') {
        logger.info(`[CROSS_DETECTION] Calling detectCross for Binance ${symbol}`);
        // realTimeVolumeServiceから上位20銘柄を取得する必要があるが、
        // ここでは一旦全ての銘柄をチェック
        this.crossDetectionService.detectCross(symbol, exchange, volumeData);
        logger.info(`[CROSS_DETECTION] detectCross call completed for Binance ${symbol}`);
      } else if (exchange === 'upbit') {
        logger.info(`[CROSS_DETECTION] Calling detectCross for Upbit ${symbol}`);
        // Upbitの場合も同様にチェック
        this.crossDetectionService.detectCross(symbol, exchange, volumeData);
        logger.info(`[CROSS_DETECTION] detectCross call completed for Upbit ${symbol}`);
      } else {
        logger.warn(`[CROSS_DETECTION] Unknown exchange: ${exchange}`);
      }
      
      logger.info(`[CROSS_DETECTION] Detection completed for ${symbol} (${exchange})`);
    } catch (error) {
      logger.error(`Error in cross detection for ${symbol} (${exchange}):`, error);
    }
  }

  private calculateMovingAverage(data: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
        result.push(sum / period);
      }
    }
    
    return result;
  }

  private getMultiplier(volumeString: string): number {
    if (volumeString.includes('B')) return 1e9;
    if (volumeString.includes('M')) return 1e6;
    if (volumeString.includes('K')) return 1e3;
    return 1;
  }

  private calculate24hRollingVolume(data: number[], period: number = 288): number[] {
    const result: number[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        // For the first (period-1) elements, calculate partial rolling sum
        const sum = data.slice(0, i + 1).reduce((acc, val) => acc + val, 0);
        result.push(sum);
      } else {
        // Calculate rolling sum for the last 'period' elements
        const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
        result.push(sum);
      }
    }
    
    return result;
  }
}