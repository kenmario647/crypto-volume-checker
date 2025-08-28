import axios from 'axios';
import { logger } from '../utils/logger';

interface GateIOTicker {
  currency_pair: string;
  last: string;
  lowest_ask: string;
  highest_bid: string;
  change_percentage: string;
  base_volume: string;
  quote_volume: string;
  high_24h: string;
  low_24h: string;
}

export class GateIOClient {
  private static instance: GateIOClient;
  private baseURL = 'https://api.gateio.ws/api/v4';

  private constructor() {
    logger.info('GateIOClient initialized');
  }

  public static getInstance(): GateIOClient {
    if (!GateIOClient.instance) {
      GateIOClient.instance = new GateIOClient();
    }
    return GateIOClient.instance;
  }

  async fetchTickers(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseURL}/futures/usdt/tickers`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching Gate.io perp tickers:', error);
      throw error;
    }
  }

  async fetchSpotTickers(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseURL}/spot/tickers`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching Gate.io spot tickers:', error);
      throw error;
    }
  }

  public async getTopVolumeCoins(limit: number = 100): Promise<any[]> {
    try {
      // Get all tickers
      const response = await axios.get<GateIOTicker[]>(
        `${this.baseURL}/spot/tickers`,
        {
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      const tickers = response.data;
      
      // Filter for USDT pairs only
      const usdtPairs = tickers.filter(ticker => ticker.currency_pair.endsWith('_USDT'));
      
      // Calculate volume in USDT and sort
      const volumeData = usdtPairs.map(ticker => {
        const volume24h = parseFloat(ticker.quote_volume) || 0;
        const price = parseFloat(ticker.last) || 0;
        const changePercent = parseFloat(ticker.change_percentage) || 0;
        
        return {
          symbol: ticker.currency_pair.replace('_', '-'),
          volume: volume24h,
          price: price,
          change24h: changePercent,
          high24h: parseFloat(ticker.high_24h),
          low24h: parseFloat(ticker.low_24h),
          timestamp: new Date().toISOString()
        };
      });

      // Sort by volume and return top coins
      return volumeData
        .sort((a, b) => b.volume - a.volume)
        .slice(0, limit);
    } catch (error) {
      logger.error('Error fetching Gate.io volume data:', error);
      throw error;
    }
  }

  public async getOrderBook(symbol: string, limit: number = 20): Promise<any> {
    try {
      // Convert symbol format from BTC-USDT to BTC_USDT
      const gateioPair = symbol.replace('-', '_');
      
      const response = await axios.get(
        `${this.baseURL}/spot/order_book?currency_pair=${gateioPair}&limit=${limit}`,
        {
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      const data = response.data;
      return {
        symbol: symbol,
        bids: data.bids.map((bid: string[]) => ({
          price: parseFloat(bid[0]),
          size: parseFloat(bid[1])
        })),
        asks: data.asks.map((ask: string[]) => ({
          price: parseFloat(ask[0]),
          size: parseFloat(ask[1])
        })),
        timestamp: new Date(data.current * 1000).toISOString()
      };
    } catch (error) {
      logger.error('Error fetching Gate.io order book:', error);
      throw error;
    }
  }

  public async getRecentTrades(symbol: string, limit: number = 100): Promise<any[]> {
    try {
      // Convert symbol format from BTC-USDT to BTC_USDT
      const gateioPair = symbol.replace('-', '_');
      
      const response = await axios.get(
        `${this.baseURL}/spot/trades?currency_pair=${gateioPair}&limit=${limit}`,
        {
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.map((trade: any) => ({
        id: trade.id,
        price: parseFloat(trade.price),
        quantity: parseFloat(trade.amount),
        time: new Date(trade.create_time_ms).toISOString(),
        side: trade.side
      }));
    } catch (error) {
      logger.error('Error fetching Gate.io recent trades:', error);
      throw error;
    }
  }
}