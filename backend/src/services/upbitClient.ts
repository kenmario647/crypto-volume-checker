import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface UpbitTicker {
  market: string;
  trade_date: string;
  trade_time: string;
  trade_date_kst: string;
  trade_time_kst: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  prev_closing_price: number;
  change: 'EVEN' | 'RISE' | 'FALL';
  change_price: number;
  change_rate: number;
  signed_change_price: number;
  signed_change_rate: number;
  trade_volume: number;
  acc_trade_price: number;
  acc_trade_price_24h: number;
  acc_trade_volume: number;
  acc_trade_volume_24h: number;
  highest_52_week_price: number;
  highest_52_week_date: string;
  lowest_52_week_price: number;
  lowest_52_week_date: string;
  timestamp: number;
}

export interface UpbitMarket {
  market: string;
  korean_name: string;
  english_name: string;
}

export class UpbitClient {
  private static instance: UpbitClient;
  private client: AxiosInstance;
  private baseUrl = 'https://api.upbit.com/v1';

  constructor() {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  public static getInstance(): UpbitClient {
    if (!UpbitClient.instance) {
      UpbitClient.instance = new UpbitClient();
    }
    return UpbitClient.instance;
  }

  private setupInterceptors() {
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('Upbit API Error:', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
        });
        throw error;
      }
    );
  }

  async getMarkets(): Promise<UpbitMarket[]> {
    try {
      const response = await this.client.get('/market/all');
      
      logger.info('Upbit markets data retrieved');
      return response.data;
    } catch (error) {
      logger.error('Error fetching Upbit markets:', error);
      throw error;
    }
  }

  async getTicker(markets: string[]): Promise<UpbitTicker[]> {
    try {
      const params = {
        markets: markets.join(',')
      };
      
      const response = await this.client.get('/ticker', { params });
      
      logger.info('Upbit ticker data retrieved');
      return response.data;
    } catch (error) {
      logger.error('Error fetching Upbit ticker:', error);
      throw error;
    }
  }

  async getKRWMarketTickers(): Promise<UpbitTicker[]> {
    try {
      const markets = await this.getMarkets();
      const krwMarkets = markets
        .filter(market => market.market.startsWith('KRW-'))
        .map(market => market.market);

      const tickers = await this.getTicker(krwMarkets);
      
      logger.info('Upbit KRW market tickers retrieved');
      return tickers;
    } catch (error) {
      logger.error('Error fetching Upbit KRW market tickers:', error);
      throw error;
    }
  }

  async fetchAllTickers(): Promise<UpbitTicker[]> {
    return this.getKRWMarketTickers();
  }

  async getTopVolumeMarkets(limit = 10): Promise<UpbitTicker[]> {
    try {
      const tickers = await this.getKRWMarketTickers();
      
      const topVolume = tickers
        .sort((a, b) => b.acc_trade_price_24h - a.acc_trade_price_24h)
        .slice(0, limit);

      logger.info(`Top ${limit} volume markets retrieved from Upbit`);
      return topVolume;
    } catch (error) {
      logger.error('Error fetching top volume markets from Upbit:', error);
      throw error;
    }
  }

  async getTopGainersLosers(limit = 5): Promise<{
    gainers: UpbitTicker[];
    losers: UpbitTicker[];
  }> {
    try {
      const tickers = await this.getKRWMarketTickers();
      
      const gainers = tickers
        .filter(ticker => ticker.change === 'RISE')
        .sort((a, b) => b.change_rate - a.change_rate)
        .slice(0, limit);

      const losers = tickers
        .filter(ticker => ticker.change === 'FALL')
        .sort((a, b) => a.change_rate - b.change_rate)
        .slice(0, limit);

      logger.info(`Top ${limit} gainers and losers retrieved from Upbit`);
      return { gainers, losers };
    } catch (error) {
      logger.error('Error fetching top gainers/losers from Upbit:', error);
      throw error;
    }
  }

  async getCandles(symbol: string, interval: string = '5m', limit: number = 200): Promise<any[]> {
    try {
      let endpoint = '/candles/minutes/5';
      
      // Map interval to Upbit endpoint
      switch (interval) {
        case '1m':
          endpoint = '/candles/minutes/1';
          break;
        case '3m':
          endpoint = '/candles/minutes/3';
          break;
        case '5m':
          endpoint = '/candles/minutes/5';
          break;
        case '10m':
          endpoint = '/candles/minutes/10';
          break;
        case '15m':
          endpoint = '/candles/minutes/15';
          break;
        case '30m':
          endpoint = '/candles/minutes/30';
          break;
        case '1h':
          endpoint = '/candles/minutes/60';
          break;
        case '4h':
          endpoint = '/candles/minutes/240';
          break;
        case '1d':
          endpoint = '/candles/days';
          break;
        default:
          endpoint = '/candles/minutes/5';
      }

      const market = symbol.startsWith('KRW-') ? symbol : `KRW-${symbol}`;
      
      const response = await this.client.get(endpoint, {
        params: {
          market,
          count: limit
        }
      });

      const candles = response.data.map((candle: any) => ({
        timestamp: new Date(candle.candle_date_time_kst).getTime(),
        open: candle.opening_price,
        high: candle.high_price,
        low: candle.low_price,
        close: candle.trade_price,
        volume: candle.candle_acc_trade_volume,
        quoteVolume: candle.candle_acc_trade_price
      }));

      logger.info(`Upbit candles for ${symbol} retrieved`);
      return candles.reverse(); // Upbit returns newest first, reverse for chronological order
    } catch (error) {
      logger.error(`Error fetching Upbit candles for ${symbol}:`, error);
      throw error;
    }
  }
}