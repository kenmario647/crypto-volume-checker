import { logger } from '../utils/logger';
import { BinanceClient } from './binanceClient';
import { BinanceSpotClient } from './binanceSpotClient';
import { BybitClient } from './bybitClient';
import { OKXClient } from './okxClient';
import { GateIOClient } from './gateioClient';
import { BitgetClient } from './bitgetClient';
import { UpbitClient } from './upbitClient';
import { CoinbaseClient } from './coinbaseClient';
import { MEXCClient } from './mexcClient';
import { BithumbClient } from './bithumbClient';
import { ExchangeRateService } from './exchangeRateService';

interface SpotPerpVolumeData {
  rank: number;
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  volumeUsd: number;
  marketType: 'SPOT' | 'PERP';
  exchange: string;
  previousRank?: number;
  rankChanged?: boolean;
  newRankIn?: boolean;
}

export class SpotPerpVolumeService {
  private static instance: SpotPerpVolumeService;
  private binanceClient: BinanceClient;
  private binanceSpotClient: BinanceSpotClient;
  private bybitClient: BybitClient;
  private okxClient: OKXClient;
  private gateioClient: GateIOClient;
  private bitgetClient: BitgetClient;
  private upbitClient: UpbitClient;
  private coinbaseClient: CoinbaseClient;
  private mexcClient: MEXCClient;
  private bithumbClient: BithumbClient;
  private exchangeRateService: ExchangeRateService;
  private previousSpotRankings: Map<string, Map<string, number>> = new Map();
  private previousPerpRankings: Map<string, Map<string, number>> = new Map();
  private isFirstFetch: Map<string, boolean> = new Map();

  constructor() {
    this.binanceClient = new BinanceClient();
    this.binanceSpotClient = new BinanceSpotClient();
    this.bybitClient = BybitClient.getInstance();
    this.okxClient = OKXClient.getInstance();
    this.gateioClient = GateIOClient.getInstance();
    this.bitgetClient = BitgetClient.getInstance();
    this.upbitClient = UpbitClient.getInstance();
    this.coinbaseClient = CoinbaseClient.getInstance();
    this.mexcClient = MEXCClient.getInstance();
    this.bithumbClient = BithumbClient.getInstance();
    this.exchangeRateService = ExchangeRateService.getInstance();
  }

  public static getInstance(): SpotPerpVolumeService {
    if (!SpotPerpVolumeService.instance) {
      SpotPerpVolumeService.instance = new SpotPerpVolumeService();
    }
    return SpotPerpVolumeService.instance;
  }

  async getSpotVolumes(exchange: string, limit: number = 1000): Promise<SpotPerpVolumeData[]> {
    try {
      let data: SpotPerpVolumeData[] = [];

      switch (exchange.toLowerCase()) {
        case 'binance':
          data = await this.getBinanceSpotVolumes(limit);
          break;
        case 'bybit':
          data = await this.getBybitSpotVolumes(limit);
          break;
        case 'okx':
          data = await this.getOkxSpotVolumes(limit);
          break;
        case 'gateio':
          data = await this.getGateioSpotVolumes(limit);
          break;
        case 'bitget':
          data = await this.getBitgetSpotVolumes(limit);
          break;
        case 'upbit':
          data = await this.getUpbitSpotVolumes(limit);
          break;
        case 'coinbase':
          data = await this.getCoinbaseSpotVolumes(limit);
          break;
        case 'mexc':
          data = await this.getMexcSpotVolumes(limit);
          break;
        case 'bithumb':
          data = await this.getBithumbSpotVolumes(limit);
          break;
        default:
          throw new Error(`Unsupported exchange: ${exchange}`);
      }

      return data;
    } catch (error) {
      logger.error(`Error fetching spot volumes for ${exchange}:`, error);
      throw error;
    }
  }

  async getPerpVolumes(exchange: string, limit: number = 1000): Promise<SpotPerpVolumeData[]> {
    try {
      let data: SpotPerpVolumeData[] = [];

      switch (exchange.toLowerCase()) {
        case 'binance':
          data = await this.getBinancePerpVolumes(limit);
          break;
        case 'bybit':
          data = await this.getBybitPerpVolumes(limit);
          break;
        case 'okx':
          data = await this.getOkxPerpVolumes(limit);
          break;
        case 'gateio':
          data = await this.getGateioPerpVolumes(limit);
          break;
        case 'bitget':
          data = await this.getBitgetPerpVolumes(limit);
          break;
        default:
          throw new Error(`Unsupported exchange: ${exchange}`);
      }

      return data;
    } catch (error) {
      logger.error(`Error fetching perp volumes for ${exchange}:`, error);
      throw error;
    }
  }

  async getCombinedVolumes(exchange: string, limit: number = 15): Promise<{
    spot: SpotPerpVolumeData[];
    perp: SpotPerpVolumeData[];
  }> {
    try {
      const [spot, perp] = await Promise.all([
        this.getSpotVolumes(exchange, limit),
        this.getPerpVolumes(exchange, limit)
      ]);

      return { spot, perp };
    } catch (error) {
      logger.error(`Error fetching combined volumes for ${exchange}:`, error);
      throw error;
    }
  }

  private async getBinanceSpotVolumes(limit: number): Promise<SpotPerpVolumeData[]> {
    try {
      const tickers = await this.binanceSpotClient.getSpotTopVolumeSymbols(); // Get all symbols
      
      // Filter out ALPACA and BNX
      const filteredTickers = tickers.filter((ticker: any) => {
        const symbol = ticker.symbol.replace('USDT', '');
        return symbol !== 'ALPACA' && symbol !== 'BNX';
      });
      
      // Get previous rankings for binance spot
      const exchangeKey = 'binance-spot';
      const previousRankMap = this.previousSpotRankings.get(exchangeKey) || new Map();
      const newRankMap = new Map<string, number>();
      
      const result = filteredTickers.map((ticker: any, index: number) => {
        const rank = index + 1;
        const symbol = ticker.symbol.replace('USDT', '');
        const previousRank = previousRankMap.get(symbol);
        
        // Store new ranking
        newRankMap.set(symbol, rank);
        
        return {
          rank,
          symbol,
          price: parseFloat(ticker.lastPrice),
          change24h: parseFloat(ticker.priceChangePercent),
          volume24h: parseFloat(ticker.volume),
          volumeUsd: parseFloat(ticker.quoteVolume),
          marketType: 'SPOT' as const,
          exchange: 'binance',
          previousRank,
          rankChanged: previousRank !== undefined && previousRank !== rank,
          newRankIn: rank <= 15 && (previousRank === undefined || previousRank > 15)
        };
      });
      
      // Update previous rankings
      this.previousSpotRankings.set(exchangeKey, newRankMap);
      
      return result;
    } catch (error) {
      logger.error('Error fetching Binance spot volumes:', error);
      return [];
    }
  }

  private async getBinancePerpVolumes(limit: number): Promise<SpotPerpVolumeData[]> {
    try {
      const tickers = await this.binanceClient.getTopVolumeSymbols(); // Get all symbols
      
      // Filter out ALPACA and BNX
      const filteredTickers = tickers.filter((ticker: any) => {
        const symbol = ticker.symbol.replace('USDT', '');
        return symbol !== 'ALPACA' && symbol !== 'BNX';
      });
      
      // Get previous rankings for binance perp
      const exchangeKey = 'binance-perp';
      const previousRankMap = this.previousPerpRankings.get(exchangeKey) || new Map();
      const newRankMap = new Map<string, number>();
      
      const result = filteredTickers.map((ticker: any, index: number) => {
        const rank = index + 1;
        const symbol = ticker.symbol.replace('USDT', '');
        const previousRank = previousRankMap.get(symbol);
        
        // Store new ranking
        newRankMap.set(symbol, rank);
        
        return {
          rank,
          symbol,
          price: parseFloat(ticker.lastPrice),
          change24h: parseFloat(ticker.priceChangePercent),
          volume24h: parseFloat(ticker.volume),
          volumeUsd: parseFloat(ticker.quoteVolume),
          marketType: 'PERP' as const,
          exchange: 'binance',
          previousRank,
          rankChanged: previousRank !== undefined && previousRank !== rank,
          newRankIn: rank <= 15 && (previousRank === undefined || previousRank > 15)
        };
      });
      
      // Update previous rankings
      this.previousPerpRankings.set(exchangeKey, newRankMap);
      
      return result;
    } catch (error) {
      logger.error('Error fetching Binance perp volumes:', error);
      return [];
    }
  }

  private async getBybitSpotVolumes(limit: number): Promise<SpotPerpVolumeData[]> {
    try {
      const response = await this.bybitClient.fetchSpotTickers();
      const tickers = response.result.list
        .filter((t: any) => t.symbol.endsWith('USDT'))
        .sort((a: any, b: any) => parseFloat(b.turnover24h || '0') - parseFloat(a.turnover24h || '0'));
      
      // Get previous rankings for bybit spot
      const exchangeKey = 'bybit-spot';
      const previousRankMap = this.previousSpotRankings.get(exchangeKey) || new Map();
      const newRankMap = new Map<string, number>();
      
      const result = tickers.map((ticker: any, index: number) => {
        const rank = index + 1;
        const symbol = ticker.symbol.replace('USDT', '');
        const previousRank = previousRankMap.get(symbol);
        
        // Store new ranking
        newRankMap.set(symbol, rank);
        
        return {
          rank,
          symbol,
          price: parseFloat(ticker.lastPrice),
          change24h: parseFloat(ticker.price24hPcnt) * 100,
          volume24h: parseFloat(ticker.volume24h),
          volumeUsd: parseFloat(ticker.turnover24h),
          marketType: 'SPOT' as const,
          exchange: 'bybit',
          previousRank,
          rankChanged: previousRank !== undefined && previousRank !== rank,
          newRankIn: rank <= 15 && (previousRank === undefined || previousRank > 15)
        };
      });
      
      // Update previous rankings
      this.previousSpotRankings.set(exchangeKey, newRankMap);
      
      return result;
    } catch (error) {
      logger.error('Error fetching Bybit spot volumes:', error);
      return [];
    }
  }

  private async getBybitPerpVolumes(limit: number): Promise<SpotPerpVolumeData[]> {
    try {
      const response = await this.bybitClient.fetchTickers();
      const tickers = response.result.list
        .filter((t: any) => t.symbol.endsWith('USDT'))
        .sort((a: any, b: any) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h));
      
      // Get previous rankings for bybit perp
      const exchangeKey = 'bybit-perp';
      const previousRankMap = this.previousPerpRankings.get(exchangeKey) || new Map();
      const newRankMap = new Map<string, number>();
      
      const result = tickers.map((ticker: any, index: number) => {
        const rank = index + 1;
        const symbol = ticker.symbol.replace('USDT', '');
        const previousRank = previousRankMap.get(symbol);
        
        // Store new ranking
        newRankMap.set(symbol, rank);
        
        return {
          rank,
          symbol,
          price: parseFloat(ticker.lastPrice),
          change24h: parseFloat(ticker.price24hPcnt) * 100,
          volume24h: parseFloat(ticker.volume24h),
          volumeUsd: parseFloat(ticker.turnover24h),
          marketType: 'PERP' as const,
          exchange: 'bybit',
          previousRank,
          rankChanged: previousRank !== undefined && previousRank !== rank,
          newRankIn: rank <= 15 && (previousRank === undefined || previousRank > 15)
        };
      });
      
      // Update previous rankings
      this.previousPerpRankings.set(exchangeKey, newRankMap);
      
      return result;
    } catch (error) {
      logger.error('Error fetching Bybit perp volumes:', error);
      return [];
    }
  }

  private async getOkxSpotVolumes(limit: number): Promise<SpotPerpVolumeData[]> {
    try {
      const response = await this.okxClient.fetchSpotTickers();
      const tickers = response.data
        .filter((t: any) => t.instId.endsWith('-USDT'))
        .sort((a: any, b: any) => parseFloat(b.volCcy24h) - parseFloat(a.volCcy24h));
      
      return tickers.map((ticker: any, index: number) => ({
        rank: index + 1,
        symbol: ticker.instId.replace('-USDT', ''),
        price: parseFloat(ticker.last),
        change24h: ((parseFloat(ticker.last) - parseFloat(ticker.open24h)) / parseFloat(ticker.open24h)) * 100,
        volume24h: parseFloat(ticker.vol24h),
        volumeUsd: parseFloat(ticker.volCcy24h),
        marketType: 'SPOT' as const,
        exchange: 'okx'
      }));
    } catch (error) {
      logger.error('Error fetching OKX spot volumes:', error);
      return [];
    }
  }

  private async getOkxPerpVolumes(limit: number): Promise<SpotPerpVolumeData[]> {
    try {
      const response = await this.okxClient.fetchTickers();
      const tickers = response.data
        .filter((t: any) => t.instId.endsWith('-USDT-SWAP'))
        .map((ticker: any) => {
          // OKX volCcy24h is the volume in quote currency (crypto amount for BTC, ETH etc)
          // Need to multiply by price to get USD value
          const volumeUsd = parseFloat(ticker.volCcy24h) * parseFloat(ticker.last);
          
          return {
            ...ticker,
            calculatedVolumeUsd: volumeUsd
          };
        })
        .sort((a: any, b: any) => b.calculatedVolumeUsd - a.calculatedVolumeUsd);
      
      return tickers.map((ticker: any, index: number) => ({
        rank: index + 1,
        symbol: ticker.instId.split('-')[0],
        price: parseFloat(ticker.last),
        change24h: ((parseFloat(ticker.last) - parseFloat(ticker.open24h)) / parseFloat(ticker.open24h)) * 100,
        volume24h: parseFloat(ticker.volCcy24h), // Use volCcy24h for actual volume
        volumeUsd: ticker.calculatedVolumeUsd,
        marketType: 'PERP' as const,
        exchange: 'okx'
      }));
    } catch (error) {
      logger.error('Error fetching OKX perp volumes:', error);
      return [];
    }
  }

  private async getGateioSpotVolumes(limit: number): Promise<SpotPerpVolumeData[]> {
    try {
      const response = await this.gateioClient.fetchSpotTickers();
      const tickers = response
        .filter((t: any) => t.currency_pair.endsWith('_USDT'))
        .sort((a: any, b: any) => parseFloat(b.quote_volume) - parseFloat(a.quote_volume));
      
      return tickers.map((ticker: any, index: number) => ({
        rank: index + 1,
        symbol: ticker.currency_pair.replace('_USDT', ''),
        price: parseFloat(ticker.last),
        change24h: parseFloat(ticker.change_percentage),
        volume24h: parseFloat(ticker.base_volume),
        volumeUsd: parseFloat(ticker.quote_volume),
        marketType: 'SPOT' as const,
        exchange: 'gateio'
      }));
    } catch (error) {
      logger.error('Error fetching Gate.io spot volumes:', error);
      return [];
    }
  }

  private async getGateioPerpVolumes(limit: number): Promise<SpotPerpVolumeData[]> {
    try {
      const response = await this.gateioClient.fetchTickers();
      const tickers = response
        .filter((t: any) => t.contract.endsWith('_USDT'))
        .sort((a: any, b: any) => parseFloat(b.volume_24h_quote || '0') - parseFloat(a.volume_24h_quote || '0'));
      
      return tickers.map((ticker: any, index: number) => ({
        rank: index + 1,
        symbol: ticker.contract.replace('_USDT', ''),
        price: parseFloat(ticker.last),
        change24h: parseFloat(ticker.change_percentage),
        volume24h: parseFloat(ticker.volume_24h),
        volumeUsd: parseFloat(ticker.volume_24h_quote || ticker.volume_24h_settle || '0'),
        marketType: 'PERP' as const,
        exchange: 'gateio'
      }));
    } catch (error) {
      logger.error('Error fetching Gate.io perp volumes:', error);
      return [];
    }
  }

  private async getBitgetSpotVolumes(limit: number): Promise<SpotPerpVolumeData[]> {
    try {
      const response = await this.bitgetClient.fetchSpotTickers();
      const tickers = response.data
        .filter((t: any) => {
          // Exclude ZKUSDT and use ZKSYNCUSDT instead for ZK
          if (t.symbol === 'ZKUSDT') return false;
          return t.symbol.endsWith('USDT');
        })
        .sort((a: any, b: any) => parseFloat(b.usdtVol || '0') - parseFloat(a.usdtVol || '0'));
      
      return tickers.map((ticker: any, index: number) => {
        // Handle special case for ZKSYNC -> ZK
        let symbol = ticker.symbol.replace('USDT', '');
        if (symbol === 'ZKSYNC') {
          symbol = 'ZK';
        }
        
        return {
          rank: index + 1,
          symbol,
          price: parseFloat(ticker.close || '0'),
          change24h: parseFloat(ticker.changeUtc || '0') * 100,
          volume24h: parseFloat(ticker.baseVol || '0'),
          volumeUsd: parseFloat(ticker.usdtVol || '0'),
          marketType: 'SPOT' as const,
          exchange: 'bitget'
        };
      });
    } catch (error) {
      logger.error('Error fetching Bitget spot volumes:', error);
      return [];
    }
  }

  private async getBitgetPerpVolumes(limit: number): Promise<SpotPerpVolumeData[]> {
    try {
      const response = await this.bitgetClient.fetchTickers();
      const tickers = response.data
        .filter((t: any) => t.symbol.endsWith('USDT_UMCBL'))
        .sort((a: any, b: any) => parseFloat(b.quoteVolume || '0') - parseFloat(a.quoteVolume || '0'));
      
      return tickers.map((ticker: any, index: number) => ({
        rank: index + 1,
        symbol: ticker.symbol.replace('USDT_UMCBL', ''),
        price: parseFloat(ticker.last || '0'),
        change24h: parseFloat(ticker.chgUtc || '0') * 100,
        volume24h: parseFloat(ticker.baseVolume || '0'),
        volumeUsd: parseFloat(ticker.quoteVolume || '0'),
        marketType: 'PERP' as const,
        exchange: 'bitget'
      }));
    } catch (error) {
      logger.error('Error fetching Bitget perp volumes:', error);
      return [];
    }
  }

  // SPOT-only exchanges methods
  private async getUpbitSpotVolumes(limit: number): Promise<SpotPerpVolumeData[]> {
    try {
      const tickers = await this.upbitClient.fetchAllTickers();
      const usdtTickers = tickers
        .filter((t: any) => t.market.startsWith('KRW-'))
        .sort((a: any, b: any) => b.acc_trade_price_24h - a.acc_trade_price_24h)
        .slice(0, limit);
      
      // Get real-time KRW to USD conversion rate
      const krwToUsd = this.exchangeRateService.getKrwToUsdRate();
      
      return usdtTickers.map((ticker: any, index: number) => ({
        rank: index + 1,
        symbol: ticker.market.replace('KRW-', ''),
        price: ticker.trade_price * krwToUsd,
        change24h: ticker.signed_change_rate * 100,
        volume24h: ticker.acc_trade_volume_24h,
        volumeUsd: ticker.acc_trade_price_24h * krwToUsd,
        marketType: 'SPOT' as const,
        exchange: 'upbit'
      }));
    } catch (error) {
      logger.error('Error fetching Upbit spot volumes:', error);
      return [];
    }
  }

  private async getCoinbaseSpotVolumes(limit: number): Promise<SpotPerpVolumeData[]> {
    try {
      const tickers = await this.coinbaseClient.fetchAllTickers();
      const sortedTickers = tickers
        .filter((t: any) => t.product_id && t.product_id.endsWith('-USD'))
        .sort((a: any, b: any) => {
          const volA = parseFloat(a.volume || '0') * parseFloat(a.price || '0');
          const volB = parseFloat(b.volume || '0') * parseFloat(b.price || '0');
          return volB - volA;
        })
        .slice(0, limit);
      
      return sortedTickers.map((ticker: any, index: number) => ({
        rank: index + 1,
        symbol: ticker.product_id.replace('-USD', ''),
        price: parseFloat(ticker.price || '0'),
        change24h: parseFloat(ticker.price_percent_change_24h || '0'),
        volume24h: parseFloat(ticker.volume || '0'),
        volumeUsd: parseFloat(ticker.volume || '0') * parseFloat(ticker.price || '0'),
        marketType: 'SPOT' as const,
        exchange: 'coinbase'
      }));
    } catch (error) {
      logger.error('Error fetching Coinbase spot volumes:', error);
      return [];
    }
  }

  private async getMexcSpotVolumes(limit: number): Promise<SpotPerpVolumeData[]> {
    try {
      const tickers = await this.mexcClient.fetchAllTickers();
      const usdtTickers = tickers
        .filter((t: any) => t.symbol && t.symbol.endsWith('USDT'))
        .sort((a: any, b: any) => parseFloat(b.quoteVolume || '0') - parseFloat(a.quoteVolume || '0'))
        .slice(0, limit);
      
      // Get previous rankings for mexc spot
      const exchangeKey = 'mexc-spot';
      const isFirst = !this.isFirstFetch.has(exchangeKey);
      const previousRankMap = isFirst ? new Map() : (this.previousSpotRankings.get(exchangeKey) || new Map());
      const newRankMap = new Map<string, number>();
      
      const result = usdtTickers.map((ticker: any, index: number) => {
        const rank = index + 1;
        const symbol = ticker.symbol.replace('USDT', '');
        const previousRank = isFirst ? undefined : previousRankMap.get(symbol);
        
        // Store new ranking
        newRankMap.set(symbol, rank);
        
        return {
          rank,
          symbol,
          price: parseFloat(ticker.lastPrice || '0'),
          change24h: parseFloat(ticker.priceChangePercent || '0'),
          volume24h: parseFloat(ticker.volume || '0'),
          volumeUsd: parseFloat(ticker.quoteVolume || '0'),
          marketType: 'SPOT' as const,
          exchange: 'mexc',
          previousRank,
          rankChanged: previousRank !== undefined && previousRank !== rank,
          newRankIn: rank <= 15 && (previousRank === undefined || previousRank > 15)
        };
      });
      
      // Update previous rankings and mark as fetched
      this.previousSpotRankings.set(exchangeKey, newRankMap);
      this.isFirstFetch.set(exchangeKey, true);
      
      return result;
    } catch (error) {
      logger.error('Error fetching MEXC spot volumes:', error);
      return [];
    }
  }

  private async getBithumbSpotVolumes(limit: number): Promise<SpotPerpVolumeData[]> {
    try {
      const response = await this.bithumbClient.fetchTickers();
      if (!response.data) return [];
      
      const tickers = Object.entries(response.data)
        .filter(([symbol]) => symbol !== 'date')
        .map(([symbol, data]: [string, any]) => ({
          symbol,
          ...data
        }))
        .sort((a: any, b: any) => parseFloat(b.acc_trade_value_24H || '0') - parseFloat(a.acc_trade_value_24H || '0'))
        .slice(0, limit);
      
      // Get real-time KRW to USD conversion rate
      const krwToUsd = this.exchangeRateService.getKrwToUsdRate();
      
      return tickers.map((ticker: any, index: number) => ({
        rank: index + 1,
        symbol: ticker.symbol,
        price: parseFloat(ticker.closing_price || '0') * krwToUsd,
        change24h: parseFloat(ticker.fluctate_rate_24H || '0'),
        volume24h: parseFloat(ticker.units_traded_24H || '0'),
        volumeUsd: parseFloat(ticker.acc_trade_value_24H || '0') * krwToUsd,
        marketType: 'SPOT' as const,
        exchange: 'bithumb'
      }));
    } catch (error) {
      logger.error('Error fetching Bithumb spot volumes:', error);
      return [];
    }
  }
}