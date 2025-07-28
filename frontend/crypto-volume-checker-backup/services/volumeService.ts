import { VolumeData } from '../types';
import { logger } from '../utils/logger';
import { BinanceClient } from './binanceClient';
import { UpbitClient } from './upbitClient';

export class VolumeService {
  private binanceClient: BinanceClient;
  private upbitClient: UpbitClient;

  constructor() {
    this.binanceClient = new BinanceClient();
    this.upbitClient = new UpbitClient();
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
    if (volume >= 1e9) {
      return `$${(volume / 1e9).toFixed(1)}B`;
    } else if (volume >= 1e6) {
      return `$${(volume / 1e6).toFixed(1)}M`;
    } else if (volume >= 1e3) {
      return `$${(volume / 1e3).toFixed(1)}K`;
    }
    return `$${volume.toFixed(2)}`;
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
      // Get the current 24h volume that matches the table display from the same source
      let current24hVolume = 0;
      let tableSymbol = symbol;
      
      if (realTimeVolumeService && exchange === 'binance') {
        // Use the same data source as the ranking table
        const binanceData = realTimeVolumeService.getBinanceData();
        const searchSymbol = symbol.endsWith('USDT') ? symbol.replace('USDT', '') : symbol;
        const matchingTicker = binanceData.find((ticker: any) => {
          const tickerSymbol = ticker.symbol.replace('USDT', '');
          return tickerSymbol === searchSymbol || ticker.symbol === symbol;
        });
        if (matchingTicker) {
          // Use originalQuoteVolume (raw number) instead of formatted quoteVolume string
          current24hVolume = matchingTicker.originalQuoteVolume || parseFloat(matchingTicker.quoteVolume.replace(/[$,B,M,K]/g, '')) * this.getMultiplier(matchingTicker.quoteVolume);
          tableSymbol = matchingTicker.symbol.replace('USDT', '');
        }
      } else if (realTimeVolumeService && exchange === 'upbit') {
        // Use the same data source as the ranking table
        const upbitData = realTimeVolumeService.getUpbitData();
        const searchSymbol = symbol.startsWith('KRW-') ? symbol.replace('KRW-', '') : symbol;
        const matchingTicker = upbitData.find((ticker: any) => 
          ticker.symbol === searchSymbol
        );
        if (matchingTicker) {
          // Use originalQuoteVolume (raw number) instead of formatted quoteVolume string
          current24hVolume = matchingTicker.originalQuoteVolume || parseFloat(matchingTicker.quoteVolume.replace(/[$,B,M,K]/g, '')) * this.getMultiplier(matchingTicker.quoteVolume);
          tableSymbol = matchingTicker.symbol;
        }
      } else {
        // Fallback to direct API calls if realTimeVolumeService is not available
        if (exchange === 'binance') {
          const topVolume = await this.binanceClient.getTopVolumeSymbols(20);
          const matchingTicker = topVolume.find(ticker => 
            ticker.symbol === symbol || ticker.symbol.replace('USDT', '') === symbol.replace('USDT', '')
          );
          if (matchingTicker) {
            current24hVolume = parseFloat(matchingTicker.quoteVolume);
            tableSymbol = matchingTicker.symbol.replace('USDT', '');
          }
        } else if (exchange === 'upbit') {
          const topVolume = await this.upbitClient.getTopVolumeMarkets(20);
          const searchSymbol = symbol.startsWith('KRW-') ? symbol.replace('KRW-', '') : symbol;
          const matchingTicker = topVolume.find(ticker => 
            ticker.market.replace('KRW-', '') === searchSymbol
          );
          if (matchingTicker) {
            current24hVolume = matchingTicker.acc_trade_price_24h * 0.00075;
          }
        }
      }

      // Get historical kline/candle data for chart visualization
      let chartData;
      if (exchange === 'binance') {
        chartData = await this.binanceClient.getKlines(symbol, interval, limit + 288);
      } else if (exchange === 'upbit') {
        chartData = await this.upbitClient.getCandles(symbol, interval, limit + 288);
      } else {
        throw new Error(`Unsupported exchange: ${exchange}`);
      }

      // Extract individual 5-minute volumes for MA calculation reference
      const volumeData = chartData.map((candle: any) => 
        exchange === 'binance' ? parseFloat(candle.quoteAssetVolume || candle.volume) : parseFloat(candle.quoteVolume || candle.volume)
      );
      
      // Calculate rolling 24h volume for historical perspective
      const rolling24hVolumes = this.calculate24hRollingVolume(volumeData, 288);
      
      // Use the current 24h volume as the latest point and scale historical data proportionally
      const latestRollingVolume = rolling24hVolumes[rolling24hVolumes.length - 1] || current24hVolume;
      const scaleFactor = current24hVolume / (latestRollingVolume || 1);
      
      // Scale all historical volumes to match the current table volume
      const scaledVolumes = rolling24hVolumes.map(vol => vol * scaleFactor);
      
      // Calculate moving averages based on the scaled volumes
      const ma3 = this.calculateMovingAverage(scaledVolumes, 3);
      const ma8 = this.calculateMovingAverage(scaledVolumes, 8);
      const ma15 = this.calculateMovingAverage(scaledVolumes, 15);

      // Take only the requested limit of data points (most recent)
      const recentData = chartData.slice(-limit);
      const recentScaledVolumes = scaledVolumes.slice(-limit);
      const recentMa3 = ma3.slice(-limit);
      const recentMa8 = ma8.slice(-limit);
      const recentMa15 = ma15.slice(-limit);

      const result = {
        symbol: tableSymbol,
        exchange,
        interval,
        current24hVolume,
        data: recentData.map((candle: any, index: number) => ({
          timestamp: candle.openTime || candle.timestamp,
          volume: recentScaledVolumes[index] || current24hVolume,
          ma3: recentMa3[index] || null,
          ma8: recentMa8[index] || null,
          ma15: recentMa15[index] || null
        }))
      };

      logger.info(`Volume chart data for ${tableSymbol} (${exchange}) retrieved. Table volume: ${current24hVolume}`);
      return result;
    } catch (error) {
      logger.error(`Error fetching volume chart for ${symbol} (${exchange}):`, error);
      throw error;
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