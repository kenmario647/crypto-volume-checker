import { MomentumData } from '../types';
import { logger } from '../utils/logger';
import { BinanceClient } from './binanceClient';
import { UpbitClient } from './upbitClient';

export class MomentumService {
  private binanceClient: BinanceClient;
  private upbitClient: UpbitClient;

  constructor() {
    this.binanceClient = new BinanceClient();
    this.upbitClient = new UpbitClient();
  }

  async getTop5Momentum(): Promise<MomentumData[]> {
    try {
      const [binanceData, upbitData] = await Promise.all([
        this.getBinanceMomentum(),
        this.getUpbitMomentum()
      ]);

      const allData = [...binanceData, ...upbitData]
        .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
        .slice(0, 5);

      logger.info('Top 5 momentum data retrieved from exchanges');
      return allData;
    } catch (error) {
      logger.error('Error fetching top 5 momentum data:', error);
      return this.getMockData();
    }
  }

  private async getBinanceMomentum(): Promise<MomentumData[]> {
    try {
      const topVolume = await this.binanceClient.getTopVolumeSymbols(15);
      
      return topVolume.map((ticker, index) => ({
        symbol: ticker.symbol.replace('USDT', ''),
        price: parseFloat(ticker.price),
        change24h: parseFloat(ticker.priceChangePercent),
        volume24h: parseFloat(ticker.quoteVolume),
        marketCap: parseFloat(ticker.price) * parseFloat(ticker.volume), // 概算
        momentum: parseFloat(ticker.priceChangePercent) >= 0 ? 'up' as const : 'down' as const,
        rank: index + 1
      }));
    } catch (error) {
      logger.error('Error fetching Binance momentum data:', error);
      return [];
    }
  }

  private async getUpbitMomentum(): Promise<MomentumData[]> {
    try {
      const topVolume = await this.upbitClient.getTopVolumeMarkets(15);
      
      return topVolume.map((ticker, index) => ({
        symbol: ticker.market.replace('KRW-', ''),
        price: ticker.trade_price * 0.00075, // KRW to USD 概算
        change24h: ticker.signed_change_rate * 100,
        volume24h: ticker.acc_trade_price_24h * 0.00075,
        marketCap: ticker.trade_price * ticker.acc_trade_volume_24h * 0.00075,
        momentum: ticker.change === 'RISE' ? 'up' as const : 'down' as const,
        rank: index + 21
      }));
    } catch (error) {
      logger.error('Error fetching Upbit momentum data:', error);
      return [];
    }
  }

  private getMockData(): MomentumData[] {
      const mockData: MomentumData[] = [
        {
          symbol: 'BTC',
          price: 65432.10,
          change24h: 3.45,
          volume24h: 2100000000,
          marketCap: 1280000000000,
          momentum: 'up',
          rank: 1
        },
        {
          symbol: 'ETH',
          price: 3124.56,
          change24h: -2.18,
          volume24h: 1800000000,
          marketCap: 375000000000,
          momentum: 'down',
          rank: 2
        },
        {
          symbol: 'DOGE',
          price: 0.1234,
          change24h: 12.67,
          volume24h: 890000000,
          marketCap: 17500000000,
          momentum: 'up',
          rank: 8
        },
        {
          symbol: 'ADA',
          price: 0.4567,
          change24h: -5.23,
          volume24h: 654000000,
          marketCap: 16200000000,
          momentum: 'down',
          rank: 9
        },
        {
          symbol: 'SOL',
          price: 89.12,
          change24h: 8.91,
          volume24h: 523000000,
          marketCap: 38500000000,
          momentum: 'up',
          rank: 5
        }
      ];

      logger.info('Mock momentum data retrieved');
      return mockData;
  }

  async getTopGainers(): Promise<MomentumData[]> {
    try {
      const allData = await this.getTop5Momentum();
      const gainers = allData
        .filter(item => item.momentum === 'up')
        .sort((a, b) => b.change24h - a.change24h);

      logger.info('Top gainers data retrieved');
      return gainers;
    } catch (error) {
      logger.error('Error fetching top gainers data:', error);
      throw error;
    }
  }

  async getTopLosers(): Promise<MomentumData[]> {
    try {
      const allData = await this.getTop5Momentum();
      const losers = allData
        .filter(item => item.momentum === 'down')
        .sort((a, b) => a.change24h - b.change24h);

      logger.info('Top losers data retrieved');
      return losers;
    } catch (error) {
      logger.error('Error fetching top losers data:', error);
      throw error;
    }
  }
}