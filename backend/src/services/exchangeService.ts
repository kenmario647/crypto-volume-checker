import { ExchangeData } from '../types';
import { logger } from '../utils/logger';
import { BinanceClient } from './binanceClient';
import { UpbitClient } from './upbitClient';

export class ExchangeService {
  private binanceClient: BinanceClient;
  private upbitClient: UpbitClient;

  constructor() {
    this.binanceClient = new BinanceClient();
    this.upbitClient = new UpbitClient();
  }

  async getAllExchangeData(): Promise<ExchangeData[]> {
    try {
      const [binanceData, upbitData, mockExchanges] = await Promise.all([
        this.getBinanceExchangeData(),
        this.getUpbitExchangeData(),
        this.getMockExchangeData()
      ]);

      const allExchanges = [binanceData, upbitData, ...mockExchanges];
      
      logger.info('Exchange data retrieved from multiple sources');
      return allExchanges;
    } catch (error) {
      logger.error('Error fetching exchange data:', error);
      return this.getMockExchangeData();
    }
  }

  private async getBinanceExchangeData(): Promise<ExchangeData> {
    try {
      const [topVolume, exchangeInfo] = await Promise.all([
        this.binanceClient.getTopVolumeSymbols(50),
        // this.binanceClient.getSystemStatus(), // Disabled due to 404 API issue
        this.binanceClient.getExchangeInfo()
      ]);

      const totalVolume = topVolume.reduce((sum, ticker) => sum + parseFloat(ticker.quoteVolume), 0);
      const status = 'online' as const; // Always online since we can't check system status

      return {
        name: 'Binance',
        volume24h: totalVolume,
        volumeUsd: totalVolume,
        marketShare: 35.2, 
        status,
        lastUpdate: new Date(),
        pairs: exchangeInfo.symbols ? exchangeInfo.symbols.length : 1234
      };
    } catch (error) {
      logger.error('Error fetching Binance exchange data:', error);
      throw error;
    }
  }

  private async getUpbitExchangeData(): Promise<ExchangeData> {
    try {
      const [markets, topVolume] = await Promise.all([
        this.upbitClient.getMarkets(),
        this.upbitClient.getTopVolumeMarkets(50)
      ]);

      const totalVolumeKRW = topVolume.reduce((sum, ticker) => sum + ticker.acc_trade_price_24h, 0);
      const totalVolumeUsd = totalVolumeKRW * 0.00075;

      return {
        name: 'Upbit',
        volume24h: totalVolumeUsd,
        volumeUsd: totalVolumeUsd,
        marketShare: 25.6,
        status: 'online' as const,
        lastUpdate: new Date(),
        pairs: markets.length
      };
    } catch (error) {
      logger.error('Error fetching Upbit exchange data:', error);
      throw error;
    }
  }

  private getMockExchangeData(): ExchangeData[] {
    try {
      const mockData: ExchangeData[] = [
        {
          name: 'Coinbase',
          volume24h: 6700000000,
          volumeUsd: 6700000000,
          marketShare: 19.3,
          status: 'online',
          lastUpdate: new Date(),
          pairs: 423
        },
        {
          name: 'OKX',
          volume24h: 4200000000,
          volumeUsd: 4200000000,
          marketShare: 12.1,
          status: 'maintenance',
          lastUpdate: new Date(),
          pairs: 789
        },
        {
          name: 'Kraken',
          volume24h: 2800000000,
          volumeUsd: 2800000000,
          marketShare: 7.8,
          status: 'online',
          lastUpdate: new Date(),
          pairs: 345
        }
      ];

      logger.info('Exchange data retrieved');
      return mockData;
    } catch (error) {
      logger.error('Error fetching exchange data:', error);
      throw error;
    }
  }

  async getExchangeStatus() {
    try {
      const mockStatusData = {
        totalExchanges: 5,
        onlineExchanges: 4,
        maintenanceExchanges: 1,
        offlineExchanges: 0,
        lastUpdated: new Date()
      };

      logger.info('Exchange status data retrieved');
      return mockStatusData;
    } catch (error) {
      logger.error('Error fetching exchange status data:', error);
      throw error;
    }
  }

  async getExchangeVolume(exchangeName: string) {
    try {
      const allExchanges = await this.getAllExchangeData();
      const exchange = allExchanges.find(ex => 
        ex.name.toLowerCase() === exchangeName.toLowerCase()
      );

      if (!exchange) {
        throw new Error(`Exchange ${exchangeName} not found`);
      }

      const volumeData = {
        name: exchange.name,
        volume24h: exchange.volume24h,
        volumeUsd: exchange.volumeUsd,
        marketShare: exchange.marketShare,
        status: exchange.status,
        pairs: exchange.pairs,
        hourlyVolume: this.generateHourlyVolumeData()
      };

      logger.info(`Exchange volume data retrieved for ${exchangeName}`);
      return volumeData;
    } catch (error) {
      logger.error(`Error fetching volume data for ${exchangeName}:`, error);
      throw error;
    }
  }

  private generateHourlyVolumeData() {
    const hours = [];
    const baseVolume = 1000000000;
    
    for (let i = 0; i < 24; i++) {
      hours.push({
        hour: i,
        volume: baseVolume + (Math.random() - 0.5) * baseVolume * 0.3,
        change: (Math.random() - 0.5) * 20
      });
    }
    
    return hours;
  }
}