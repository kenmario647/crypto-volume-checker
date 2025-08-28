import axios from 'axios';
import { logger } from '../utils/logger';
import { ExchangeRateService } from './exchangeRateService';

interface BithumbTicker {
  opening_price: string;
  closing_price: string;
  min_price: string;
  max_price: string;
  units_traded: string;
  acc_trade_value: string;
  prev_closing_price: string;
  units_traded_24H: string;
  acc_trade_value_24H: string;
  fluctate_24H: string;
  fluctate_rate_24H: string;
}

interface BithumbVolumeData {
  symbol: string;
  volume: number;
  change24h: number;
  price: number;
}

export class BithumbClient {
  private static instance: BithumbClient;
  private baseURL: string = 'https://api.bithumb.com';
  private exchangeRateService: ExchangeRateService;

  private constructor() {
    this.exchangeRateService = ExchangeRateService.getInstance();
    logger.info('BithumbClient initialized');
  }

  public static getInstance(): BithumbClient {
    if (!BithumbClient.instance) {
      BithumbClient.instance = new BithumbClient();
    }
    return BithumbClient.instance;
  }

  async fetchTickers(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseURL}/public/ticker/ALL_KRW`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.data.status !== '0000' || !response.data.data) {
        return { data: {} };
      }

      return response;
    } catch (error) {
      logger.error('Error fetching Bithumb tickers:', error);
      return { data: {} };
    }
  }

  async getTopVolumeCoins(limit: number = 15): Promise<BithumbVolumeData[]> {
    try {
      const response = await axios.get(`${this.baseURL}/public/ticker/ALL_KRW`, {
        timeout: 5000, // Slightly increased timeout for all data
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.data.status !== '0000' || !response.data.data) {
        logger.error('Invalid response from Bithumb API');
        return [];
      }

      // Process ALL pairs
      const allPairs: BithumbVolumeData[] = [];
      
      for (const [symbol, data] of Object.entries(response.data.data)) {
        if (symbol === 'date') continue; // Skip the date field
        
        const ticker = data as BithumbTicker;
        const volumeKRW = parseFloat(ticker.acc_trade_value_24H || '0');
        
        // Convert KRW to USD for all pairs
        const volumeUSD = volumeKRW * this.exchangeRateService.getKrwToUsdRate();
        
        allPairs.push({
          symbol: symbol,
          volume: volumeUSD,
          change24h: parseFloat(ticker.fluctate_rate_24H || '0'),
          price: parseFloat(ticker.closing_price || '0') * this.exchangeRateService.getKrwToUsdRate()
        });
      }

      // Sort by volume and limit
      allPairs.sort((a, b) => b.volume - a.volume);
      const topPairs = allPairs.slice(0, limit);

      logger.info(`Processed ${allPairs.length} Bithumb pairs, returning top ${topPairs.length}`);
      return topPairs;
    } catch (error: any) {
      logger.error('Error fetching Bithumb data:', error.message || error);
      return [];
    }
  }

  async getOrderBook(symbol: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseURL}/public/orderbook/${symbol}_KRW`, {
        params: { count: 30 },
        timeout: 10000
      });

      if (response.data.status !== '0000') {
        logger.error(`Failed to fetch Bithumb orderbook for ${symbol}`);
        return null;
      }

      return {
        bids: response.data.data.bids.map((bid: any) => ({
          price: parseFloat(bid.price) * this.exchangeRateService.getKrwToUsdRate(),
          quantity: parseFloat(bid.quantity)
        })),
        asks: response.data.data.asks.map((ask: any) => ({
          price: parseFloat(ask.price) * this.exchangeRateService.getKrwToUsdRate(),
          quantity: parseFloat(ask.quantity)
        }))
      };
    } catch (error) {
      logger.error(`Error fetching Bithumb orderbook for ${symbol}:`, error);
      return null;
    }
  }

  async getRecentTrades(symbol: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseURL}/public/transaction_history/${symbol}_KRW`, {
        params: { count: 100 },
        timeout: 10000
      });

      if (response.data.status !== '0000') {
        logger.error(`Failed to fetch Bithumb trades for ${symbol}`);
        return [];
      }

      return response.data.data.map((trade: any) => ({
        price: parseFloat(trade.price) * this.exchangeRateService.getKrwToUsdRate(),
        quantity: parseFloat(trade.units_traded),
        timestamp: new Date(trade.transaction_date).getTime(),
        type: trade.type
      }));
    } catch (error) {
      logger.error(`Error fetching Bithumb trades for ${symbol}:`, error);
      return [];
    }
  }
}

export default BithumbClient;