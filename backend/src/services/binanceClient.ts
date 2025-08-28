import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface BinanceTickerData {
  symbol: string;
  price: string;
  volume: string;
  count: number;
  priceChangePercent: string;
  quoteVolume: string;
}

export interface Binance24hrTickerStats {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  askPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

export class BinanceClient {
  private client: AxiosInstance;
  private futuresClient: AxiosInstance;
  private baseUrl = 'https://api.binance.com/api/v3';
  private futuresBaseUrl = 'https://fapi.binance.com/fapi/v1';

  constructor() {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.futuresClient = axios.create({
      baseURL: this.futuresBaseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    const errorHandler = (error: any) => {
      logger.error('Binance API Error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    };

    this.client.interceptors.response.use((response) => response, errorHandler);
    this.futuresClient.interceptors.response.use((response) => response, errorHandler);
  }

  async get24hrTicker(symbol?: string): Promise<Binance24hrTickerStats | Binance24hrTickerStats[]> {
    try {
      const params = symbol ? { symbol } : {};
      const response = await this.client.get('/ticker/24hr', { params });
      
      logger.info('Binance 24hr ticker data retrieved');
      return response.data;
    } catch (error) {
      logger.error('Error fetching Binance 24hr ticker:', error);
      throw error;
    }
  }

  async getExchangeInfo() {
    try {
      const response = await this.client.get('/exchangeInfo');
      
      logger.info('Binance exchange info retrieved');
      return response.data;
    } catch (error) {
      logger.error('Error fetching Binance exchange info:', error);
      throw error;
    }
  }

  async getTicker24h(): Promise<BinanceTickerData[]> {
    try {
      // Use Futures API for consistency with volume ranking data
      const response = await this.futuresClient.get('/ticker/24hr');
      
      const formattedData = response.data.map((item: any) => ({
        symbol: item.symbol,
        price: item.lastPrice,
        lastPrice: item.lastPrice,
        volume: item.volume,
        count: item.count,
        priceChangePercent: item.priceChangePercent,
        quoteVolume: item.quoteVolume,
      }));

      logger.info('Binance Futures ticker 24h data retrieved');
      return formattedData;
    } catch (error) {
      logger.error('Error fetching Binance Futures ticker 24h:', error);
      throw error;
    }
  }

  async getTopVolumeSymbols(limit = 15): Promise<BinanceTickerData[]> {
    try {
      const tickers = await this.getTicker24h();
      
      const topVolume = tickers
        .filter(ticker => ticker.symbol.endsWith('USDT'))
        .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));

      logger.info(`All ${topVolume.length} volume symbols retrieved from Binance`);
      return topVolume;
    } catch (error) {
      logger.error('Error fetching top volume symbols:', error);
      throw error;
    }
  }

  async getTopTicksSymbols(limit = 20): Promise<BinanceTickerData[]> {
    try {
      const tickers = await this.getTicker24h();
      
      const topTicks = tickers
        .filter(ticker => ticker.symbol.endsWith('USDT'))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      logger.info(`Top ${limit} ticks symbols retrieved from Binance`);
      return topTicks;
    } catch (error) {
      logger.error('Error fetching top ticks symbols:', error);
      throw error;
    }
  }

  async getSystemStatus() {
    try {
      const response = await this.client.get('/system/status');
      
      logger.info('Binance system status retrieved');
      return response.data;
    } catch (error) {
      logger.error('Error fetching Binance system status:', error);
      throw error;
    }
  }

  async getKlines(symbol: string, interval: string = '5m', limit: number = 288): Promise<any[]> {
    try {
      // Use Futures API directly for consistency with volume ranking data
      const response = await this.futuresClient.get('/klines', {
        params: {
          symbol: symbol.toUpperCase(),
          interval,
          limit
        }
      });

      const klines = response.data.map((kline: any[]) => ({
        openTime: kline[0],
        open: kline[1],
        high: kline[2],
        low: kline[3],
        close: kline[4],
        volume: kline[5],
        closeTime: kline[6],
        quoteAssetVolume: kline[7],
        numberOfTrades: kline[8],
        takerBuyBaseAssetVolume: kline[9],
        takerBuyQuoteAssetVolume: kline[10]
      }));

      logger.info(`Binance Futures klines for ${symbol} retrieved`);
      return klines;
    } catch (error) {
      logger.error(`Error fetching Binance Futures klines for ${symbol}:`, error);
      throw error;
    }
  }
}