import axios from 'axios';
import { logger } from '../utils/logger';

interface MEXCTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  volume: string;
  quoteVolume: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  closeTime: number;
}

interface MEXCVolumeData {
  symbol: string;
  volume: number;
  change24h: number;
  price: number;
}

export class MEXCClient {
  private static instance: MEXCClient;
  private baseURL: string = 'https://api.mexc.com';

  private constructor() {
    logger.info('MEXCClient initialized');
  }

  public static getInstance(): MEXCClient {
    if (!MEXCClient.instance) {
      MEXCClient.instance = new MEXCClient();
    }
    return MEXCClient.instance;
  }

  async fetchAllTickers(): Promise<MEXCTicker[]> {
    try {
      const response = await axios.get(`${this.baseURL}/api/v3/ticker/24hr`, {
        timeout: 3000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      if (!Array.isArray(response.data)) {
        return [];
      }

      return response.data;
    } catch (error) {
      logger.error('Error fetching MEXC tickers:', error);
      return [];
    }
  }

  async getTopVolumeCoins(limit: number = 15): Promise<MEXCVolumeData[]> {
    try {
      // Try simpler endpoint first
      const response = await axios.get(`${this.baseURL}/api/v3/ticker/24hr`, {
        timeout: 3000, // Further reduced timeout
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      if (!Array.isArray(response.data)) {
        logger.error('Invalid response from MEXC API');
        return [];
      }

      // Filter and process all USDT pairs
      const usdtPairs: MEXCVolumeData[] = [];
      for (const ticker of response.data) {
        if (ticker.symbol && ticker.symbol.endsWith('USDT')) {
          usdtPairs.push({
            symbol: ticker.symbol.replace('USDT', ''),
            volume: parseFloat(ticker.quoteVolume || 0),
            change24h: parseFloat(ticker.priceChangePercent || 0),
            price: parseFloat(ticker.lastPrice || 0)
          });
        }
      }

      // Sort and limit
      usdtPairs.sort((a, b) => b.volume - a.volume);
      const result = usdtPairs.slice(0, limit);
      
      logger.info(`Fetched ${result.length} MEXC spot pairs`);
      return result;
    } catch (error: any) {
      logger.error('Error fetching MEXC spot data:', error.message || error);
      return [];
    }
  }

  async getFuturesTopVolume(limit: number = 15): Promise<MEXCVolumeData[]> {
    try {
      // MEXC Futures API - using v1 futures ticker endpoint
      const response = await axios.get('https://contract.mexc.com/api/v1/contract/ticker', {
        timeout: 3000, // Reduced timeout
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      if (!response.data || !response.data.data) {
        logger.error('Invalid response from MEXC Futures API');
        return [];
      }

      // Process futures data more efficiently
      const futuresData: MEXCVolumeData[] = [];
      const dataArray = Array.isArray(response.data.data) ? response.data.data : Object.values(response.data.data);
      
      for (const ticker of dataArray) {
        if (ticker.symbol && ticker.symbol.includes('USDT')) {
          const price = parseFloat(ticker.lastPrice || ticker.fairPrice || 0);
          // Use amount24 for USDT-denominated volume (already in USDT), fallback to volume24
          // amount24 is the 24h trading volume in USDT
          const vol24 = parseFloat(ticker.amount24 || ticker.volume24 || 0);
          futuresData.push({
            symbol: ticker.symbol.replace('_USDT', ''),
            volume: vol24,  // amount24 is already USDT-denominated volume
            change24h: parseFloat(ticker.riseFallRate || 0) * 100,
            price: price
          });
        }
        if (futuresData.length > limit * 2) break;
      }

      futuresData.sort((a, b) => b.volume - a.volume);
      const result = futuresData.slice(0, limit);
      
      logger.info(`Fetched ${result.length} MEXC futures pairs with volumes`);
      return result;
    } catch (error: any) {
      logger.error('Error fetching MEXC futures data:', error.message || error);
      return [];
    }
  }

  private processSpotData(data: any[], limit: number): MEXCVolumeData[] {
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .filter((ticker: MEXCTicker) => ticker.symbol.endsWith('USDT'))
      .map((ticker: MEXCTicker) => ({
        symbol: ticker.symbol,
        volume: parseFloat(ticker.quoteVolume),
        change24h: parseFloat(ticker.priceChangePercent),
        price: parseFloat(ticker.lastPrice)
      }))
      .sort((a: MEXCVolumeData, b: MEXCVolumeData) => b.volume - a.volume)
      .slice(0, limit);
  }
}

export default MEXCClient;