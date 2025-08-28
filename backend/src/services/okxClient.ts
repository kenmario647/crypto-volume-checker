import axios from 'axios';
import { logger } from '../utils/logger';

interface OKXTicker {
  instId: string;
  last: string;
  lastSz: string;
  askPx: string;
  askSz: string;
  bidPx: string;
  bidSz: string;
  open24h: string;
  high24h: string;
  low24h: string;
  volCcy24h: string;
  vol24h: string;
  ts: string;
  sodUtc0: string;
  sodUtc8: string;
}

interface OKXTickerResponse {
  code: string;
  msg: string;
  data: OKXTicker[];
}

export class OKXClient {
  private static instance: OKXClient;
  private baseURL = 'https://www.okx.com';

  private constructor() {
    logger.info('OKXClient initialized');
  }

  public static getInstance(): OKXClient {
    if (!OKXClient.instance) {
      OKXClient.instance = new OKXClient();
    }
    return OKXClient.instance;
  }

  async fetchTickers(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseURL}/api/v5/market/tickers?instType=SWAP`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching OKX perp tickers:', error);
      throw error;
    }
  }

  async fetchSpotTickers(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseURL}/api/v5/market/tickers?instType=SPOT`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching OKX spot tickers:', error);
      throw error;
    }
  }

  public async getTopVolumeCoins(limit: number = 100): Promise<any[]> {
    try {
      // Get all USDT spot trading pairs
      const response = await axios.get<OKXTickerResponse>(
        `${this.baseURL}/api/v5/market/tickers?instType=SPOT`,
        {
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.code !== '0') {
        throw new Error(`OKX API error: ${response.data.msg}`);
      }

      const tickers = response.data.data;
      
      // Filter for USDT pairs only
      const usdtPairs = tickers.filter(ticker => ticker.instId.endsWith('-USDT'));
      
      // Calculate volume in USDT and sort
      const volumeData = usdtPairs.map(ticker => {
        const volume24h = parseFloat(ticker.volCcy24h) || 0;
        const price = parseFloat(ticker.last) || 0;
        const changePercent = ((price - parseFloat(ticker.open24h)) / parseFloat(ticker.open24h)) * 100;
        
        return {
          symbol: ticker.instId,
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
      logger.error('Error fetching OKX volume data:', error);
      throw error;
    }
  }

  public async getOrderBook(symbol: string, limit: number = 20): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/v5/market/books?instId=${symbol}&sz=${limit}`,
        {
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.code !== '0') {
        throw new Error(`OKX API error: ${response.data.msg}`);
      }

      const data = response.data.data[0];
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
        timestamp: new Date(parseInt(data.ts)).toISOString()
      };
    } catch (error) {
      logger.error('Error fetching OKX order book:', error);
      throw error;
    }
  }

  public async getRecentTrades(symbol: string, limit: number = 100): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/v5/market/trades?instId=${symbol}&limit=${limit}`,
        {
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.code !== '0') {
        throw new Error(`OKX API error: ${response.data.msg}`);
      }

      return response.data.data.map((trade: any) => ({
        id: trade.tradeId,
        price: parseFloat(trade.px),
        quantity: parseFloat(trade.sz),
        time: new Date(parseInt(trade.ts)).toISOString(),
        side: trade.side
      }));
    } catch (error) {
      logger.error('Error fetching OKX recent trades:', error);
      throw error;
    }
  }
}