import axios from 'axios';
import { logger } from '../utils/logger';

export interface BinanceSpotTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  quoteVolume: string;
  volume: string;
}

export class BinanceSpotClient {
  private baseURL = 'https://api.binance.com/api/v3';
  
  async getTopVolumeSymbols(limit: number = 15): Promise<BinanceSpotTicker[]> {
    try {
      const response = await axios.get(`${this.baseURL}/ticker/24hr`);
      const tickers: BinanceSpotTicker[] = response.data;
      
      // Filter USDT pairs and sort by volume
      const usdtPairs = tickers
        .filter(t => t.symbol.endsWith('USDT'))
        .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
      
      logger.info(`Binance SPOT: Fetched all ${usdtPairs.length} volume pairs`);
      return usdtPairs;
    } catch (error) {
      logger.error('Error fetching Binance SPOT volume data:', error);
      throw error;
    }
  }
  
  async getSpotTopVolumeSymbols(limit: number = 15): Promise<BinanceSpotTicker[]> {
    return this.getTopVolumeSymbols(limit);
  }
}