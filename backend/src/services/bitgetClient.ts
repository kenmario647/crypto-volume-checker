import axios from 'axios';
import { logger } from '../utils/logger';

interface BitgetTicker {
  symbol: string;
  last: string;
  bestAsk: string;
  bestBid: string;
  high24h: string;
  low24h: string;
  usdtVol: string;
  baseVol: string;
  ts: string;
  openUtc: string;
  changeUtc24h: string;
  change24h: string;
}

interface BitgetTickerResponse {
  code: string;
  msg: string;
  data: BitgetTicker[];
}

export class BitgetClient {
  private static instance: BitgetClient;
  private baseURL = 'https://api.bitget.com';

  private constructor() {
    logger.info('BitgetClient initialized');
  }

  public static getInstance(): BitgetClient {
    if (!BitgetClient.instance) {
      BitgetClient.instance = new BitgetClient();
    }
    return BitgetClient.instance;
  }

  async fetchTickers(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseURL}/api/mix/v1/market/tickers?productType=umcbl`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching Bitget perp tickers:', error);
      throw error;
    }
  }

  async fetchSpotTickers(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseURL}/api/spot/v1/market/tickers`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching Bitget spot tickers:', error);
      throw error;
    }
  }

  public async getTopVolumeCoins(limit: number = 100): Promise<any[]> {
    try {
      // Get all spot tickers
      const response = await axios.get<BitgetTickerResponse>(
        `${this.baseURL}/api/spot/v1/market/tickers`,
        {
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.code !== '00000') {
        throw new Error(`Bitget API error: ${response.data.msg}`);
      }

      const tickers = response.data.data;
      
      // Filter for USDT pairs only
      const usdtPairs = tickers.filter(ticker => ticker.symbol.endsWith('USDT'));
      
      // Calculate volume in USDT and sort
      const volumeData = usdtPairs.map(ticker => {
        const volume24h = parseFloat(ticker.usdtVol) || 0;
        const price = parseFloat(ticker.last) || 0;
        const changePercent = parseFloat(ticker.change24h) * 100 || 0;
        
        return {
          symbol: ticker.symbol.replace('USDT', '-USDT'),
          volume: volume24h,
          price: price,
          change24h: changePercent,
          high24h: parseFloat(ticker.high24h),
          low24h: parseFloat(ticker.low24h),
          timestamp: new Date(parseInt(ticker.ts)).toISOString()
        };
      });

      // Sort by volume and return top coins
      return volumeData
        .sort((a, b) => b.volume - a.volume)
        .slice(0, limit);
    } catch (error) {
      logger.error('Error fetching Bitget volume data:', error);
      throw error;
    }
  }

  public async getOrderBook(symbol: string, limit: number = 20): Promise<any> {
    try {
      // Convert symbol format from BTC-USDT to BTCUSDT
      const bitgetSymbol = symbol.replace('-', '');
      
      const response = await axios.get(
        `${this.baseURL}/api/spot/v1/market/depth?symbol=${bitgetSymbol}&type=step0&limit=${limit}`,
        {
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.code !== '00000') {
        throw new Error(`Bitget API error: ${response.data.msg}`);
      }

      const data = response.data.data;
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
        timestamp: new Date(parseInt(data.timestamp)).toISOString()
      };
    } catch (error) {
      logger.error('Error fetching Bitget order book:', error);
      throw error;
    }
  }

  public async getRecentTrades(symbol: string, limit: number = 100): Promise<any[]> {
    try {
      // Convert symbol format from BTC-USDT to BTCUSDT
      const bitgetSymbol = symbol.replace('-', '');
      
      const response = await axios.get(
        `${this.baseURL}/api/spot/v1/market/fills?symbol=${bitgetSymbol}&limit=${limit}`,
        {
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.code !== '00000') {
        throw new Error(`Bitget API error: ${response.data.msg}`);
      }

      return response.data.data.map((trade: any) => ({
        id: trade.tradeId,
        price: parseFloat(trade.price),
        quantity: parseFloat(trade.size),
        time: new Date(parseInt(trade.timestamp)).toISOString(),
        side: trade.side
      }));
    } catch (error) {
      logger.error('Error fetching Bitget recent trades:', error);
      throw error;
    }
  }
}