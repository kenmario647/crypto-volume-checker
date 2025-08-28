import { logger } from '../utils/logger';
import { SpotPerpVolumeService } from './spotPerpVolumeService';
import axios from 'axios';

export interface PriceDeviationData {
  rank: number;
  symbol: string;
  spotExchange: string;
  perpExchange: string;
  spotPrice: number;
  perpPrice: number;
  deviation: number; // percentage
  spotVolume: number;
  perpVolume: number;
  totalVolume: number;
  fundingRate?: number; // Funding rate from Binance
}

interface ExchangePriceData {
  exchange: string;
  symbol: string;
  spotPrice?: number;
  perpPrice?: number;
  spotVolume?: number;
  perpVolume?: number;
}

export class PriceDeviationService {
  private static instance: PriceDeviationService;
  private spotPerpService: SpotPerpVolumeService;
  private priceCache: Map<string, ExchangePriceData[]> = new Map();
  private volumeDataCache: Map<string, any> = new Map(); // Cache volume data from RealTimeVolumeService
  private lastUpdateTime: number = 0;
  private readonly CACHE_DURATION = 10000; // 10 seconds cache
  private realTimeVolumeService: any; // Reference to RealTimeVolumeService

  private constructor() {
    this.spotPerpService = SpotPerpVolumeService.getInstance();
    logger.info('PriceDeviationService initialized with REST API mode');
    
    // Fetch prices every 1 minute
    this.startPriceFetching();
  }

  public setRealTimeVolumeService(service: any) {
    this.realTimeVolumeService = service;
    logger.info('RealTimeVolumeService reference set in PriceDeviationService');
  }

  public static getInstance(): PriceDeviationService {
    if (!PriceDeviationService.instance) {
      PriceDeviationService.instance = new PriceDeviationService();
    }
    return PriceDeviationService.instance;
  }

  private startPriceFetching() {
    // Initial fetch
    this.fetchAllPrices();
    
    // Fetch every 1 minute
    setInterval(() => {
      this.fetchAllPrices();
    }, 60000);
  }

  private async fetchAllPrices() {
    try {
      logger.info('Fetching prices and using volume data from RealTimeVolumeService...');
      
      // If RealTimeVolumeService is available, use its volume data
      if (this.realTimeVolumeService) {
        logger.info('Using cached volume data from RealTimeVolumeService');
      }
      
      const [
        binanceData, 
        bybitData, 
        okxData, 
        gateData, 
        bitgetData,
        upbitData,
        mexcData,
        bithumbData,
        coinbaseData
      ] = await Promise.all([
        this.fetchBinancePricesWithVolume(),
        this.fetchBybitPricesWithVolume(),
        this.fetchOKXPricesWithVolume(),
        this.fetchGatePricesWithVolume(),
        this.fetchBitgetPricesWithVolume(),
        this.fetchUpbitPricesWithVolume(),
        this.fetchMEXCPricesWithVolume(),
        this.fetchBithumbPricesWithVolume(),
        this.fetchCoinbasePricesWithVolume()
      ]);

      // Process and cache the data
      this.processPriceData([
        ...binanceData,
        ...bybitData,
        ...okxData,
        ...gateData,
        ...bitgetData,
        ...upbitData,
        ...mexcData,
        ...bithumbData,
        ...coinbaseData
      ]);

      this.lastUpdateTime = Date.now();
      logger.info('Price data updated successfully with volume data from RealTimeVolumeService');
    } catch (error) {
      logger.error('Error fetching prices:', error);
    }
  }

  private async fetchBinancePrices(): Promise<ExchangePriceData[]> {
    try {
      const [spotResponse, perpResponse] = await Promise.all([
        axios.get('https://api.binance.com/api/v3/ticker/24hr'),
        axios.get('https://fapi.binance.com/fapi/v1/ticker/24hr')
      ]);

      const result: Map<string, ExchangePriceData> = new Map();

      // Process spot data
      spotResponse.data.forEach((ticker: any) => {
        if (ticker.symbol.endsWith('USDT')) {
          const symbol = ticker.symbol.replace('USDT', '');
          const existing = result.get(symbol) || { exchange: 'binance', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
          existing.spotPrice = parseFloat(ticker.lastPrice);
          existing.spotVolume = parseFloat(ticker.quoteVolume);
          result.set(symbol, existing);
        }
      });

      // Process perp data
      perpResponse.data.forEach((ticker: any) => {
        if (ticker.symbol.endsWith('USDT')) {
          const symbol = ticker.symbol.replace('USDT', '');
          const existing = result.get(symbol) || { exchange: 'binance', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
          existing.perpPrice = parseFloat(ticker.lastPrice);
          existing.perpVolume = parseFloat(ticker.quoteVolume);
          result.set(symbol, existing);
        }
      });

      const results = Array.from(result.values());
      logger.info(`Fetched ${results.length} symbols from Binance (Spot: ${spotResponse.data.filter((t: any) => t.symbol.endsWith('USDT')).length}, Perp: ${perpResponse.data.filter((t: any) => t.symbol.endsWith('USDT')).length})`);
      return results;
    } catch (error) {
      logger.error('Error fetching Binance prices:', error);
      return [];
    }
  }

  private async fetchBybitPrices(): Promise<ExchangePriceData[]> {
    try {
      const [spotResponse, perpResponse] = await Promise.all([
        axios.get('https://api.bybit.com/v5/market/tickers?category=spot'),
        axios.get('https://api.bybit.com/v5/market/tickers?category=linear')
      ]);

      const result: Map<string, ExchangePriceData> = new Map();

      // Process spot data
      if (spotResponse.data?.result?.list) {
        spotResponse.data.result.list.forEach((ticker: any) => {
          if (ticker.symbol.endsWith('USDT')) {
            const symbol = ticker.symbol.replace('USDT', '');
            const existing = result.get(symbol) || { exchange: 'bybit', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
            existing.spotPrice = parseFloat(ticker.lastPrice);
            existing.spotVolume = parseFloat(ticker.turnover24h);
            result.set(symbol, existing);
          }
        });
      }

      // Process perp data
      if (perpResponse.data?.result?.list) {
        perpResponse.data.result.list.forEach((ticker: any) => {
          if (ticker.symbol.endsWith('USDT')) {
            const symbol = ticker.symbol.replace('USDT', '');
            const existing = result.get(symbol) || { exchange: 'bybit', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
            existing.perpPrice = parseFloat(ticker.lastPrice);
            existing.perpVolume = parseFloat(ticker.turnover24h);
            result.set(symbol, existing);
          }
        });
      }

      const results = Array.from(result.values());
      const spotCount = results.filter(r => r.spotPrice !== undefined).length;
      const perpCount = results.filter(r => r.perpPrice !== undefined).length;
      logger.info(`Fetched ${results.length} symbols from Bybit (Spot: ${spotCount}, Perp: ${perpCount})`);
      return results;
    } catch (error) {
      logger.error('Error fetching Bybit prices:', error);
      return [];
    }
  }

  private async fetchOKXPrices(): Promise<ExchangePriceData[]> {
    try {
      const [spotResponse, perpResponse] = await Promise.all([
        axios.get('https://www.okx.com/api/v5/market/tickers?instType=SPOT'),
        axios.get('https://www.okx.com/api/v5/market/tickers?instType=SWAP')
      ]);

      const result: Map<string, ExchangePriceData> = new Map();

      // Process spot data
      if (spotResponse.data?.data) {
        spotResponse.data.data.forEach((ticker: any) => {
          if (ticker.instId.endsWith('-USDT')) {
            const symbol = ticker.instId.split('-')[0];
            const existing = result.get(symbol) || { exchange: 'okx', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
            existing.spotPrice = parseFloat(ticker.last);
            // For spot, volCcy24h is quote volume (USDT) for USDT pairs
            existing.spotVolume = parseFloat(ticker.volCcy24h);
            result.set(symbol, existing);
          }
        });
      }

      // Process perp data
      if (perpResponse.data?.data) {
        perpResponse.data.data.forEach((ticker: any) => {
          if (ticker.instId.includes('-USDT-SWAP')) {
            const symbol = ticker.instId.split('-')[0];
            const existing = result.get(symbol) || { exchange: 'okx', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
            existing.perpPrice = parseFloat(ticker.last);
            // For USDT perpetuals, volCcy24h is in USDT
            existing.perpVolume = parseFloat(ticker.volCcy24h || 0);
            result.set(symbol, existing);
          }
        });
      }

      const results = Array.from(result.values());
      const spotCount = results.filter(r => r.spotPrice !== undefined).length;
      const perpCount = results.filter(r => r.perpPrice !== undefined).length;
      logger.info(`Fetched ${results.length} symbols from OKX (Spot: ${spotCount}, Perp: ${perpCount})`);
      return results;
    } catch (error) {
      logger.error('Error fetching OKX prices:', error);
      return [];
    }
  }

  private async fetchGatePrices(): Promise<ExchangePriceData[]> {
    try {
      const [spotResponse, perpResponse] = await Promise.all([
        axios.get('https://api.gateio.ws/api/v4/spot/tickers'),
        axios.get('https://api.gateio.ws/api/v4/futures/usdt/tickers')
      ]);

      const result: Map<string, ExchangePriceData> = new Map();

      // Process spot data
      if (Array.isArray(spotResponse.data)) {
        spotResponse.data.forEach((ticker: any) => {
          if (ticker.currency_pair && ticker.currency_pair.endsWith('_USDT')) {
            const symbol = ticker.currency_pair.replace('_USDT', '');
            const existing = result.get(symbol) || { exchange: 'gateio', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
            existing.spotPrice = parseFloat(ticker.last);
            existing.spotVolume = parseFloat(ticker.quote_volume);
            result.set(symbol, existing);
          }
        });
      }

      // Process perp data
      if (Array.isArray(perpResponse.data)) {
        perpResponse.data.forEach((ticker: any) => {
          if (ticker.contract && ticker.contract.endsWith('_USDT')) {
            const symbol = ticker.contract.replace('_USDT', '');
            const existing = result.get(symbol) || { exchange: 'gateio', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
            existing.perpPrice = parseFloat(ticker.last);
            existing.perpVolume = parseFloat(ticker.volume_24h_usd);
            result.set(symbol, existing);
          }
        });
      }

      const results = Array.from(result.values());
      const spotCount = results.filter(r => r.spotPrice !== undefined).length;
      const perpCount = results.filter(r => r.perpPrice !== undefined).length;
      logger.info(`Fetched ${results.length} symbols from Gate.io (Spot: ${spotCount}, Perp: ${perpCount})`);
      return results;
    } catch (error) {
      logger.error('Error fetching Gate.io prices:', error);
      return [];
    }
  }

  private async fetchBitgetPrices(): Promise<ExchangePriceData[]> {
    try {
      const [spotResponse, perpResponse] = await Promise.all([
        axios.get('https://api.bitget.com/api/v2/spot/market/tickers'),
        axios.get('https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES')
      ]);

      const result: Map<string, ExchangePriceData> = new Map();

      // Process spot data
      if (spotResponse.data?.data) {
        spotResponse.data.data.forEach((ticker: any) => {
          if (ticker.symbol && ticker.symbol.endsWith('USDT')) {
            const symbol = ticker.symbol.replace('USDT', '');
            const existing = result.get(symbol) || { exchange: 'bitget', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
            existing.spotPrice = parseFloat(ticker.lastPr);
            existing.spotVolume = parseFloat(ticker.quoteVolume);
            result.set(symbol, existing);
          }
        });
      }

      // Process perp data
      if (perpResponse.data?.data) {
        perpResponse.data.data.forEach((ticker: any) => {
          if (ticker.symbol && ticker.symbol.endsWith('USDT')) {
            const symbol = ticker.symbol.replace('USDT', '');
            const existing = result.get(symbol) || { exchange: 'bitget', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
            existing.perpPrice = parseFloat(ticker.lastPr);
            existing.perpVolume = parseFloat(ticker.quoteVolume);
            result.set(symbol, existing);
          }
        });
      }

      const results = Array.from(result.values());
      const spotCount = results.filter(r => r.spotPrice !== undefined).length;
      const perpCount = results.filter(r => r.perpPrice !== undefined).length;
      logger.info(`Fetched ${results.length} symbols from Bitget (Spot: ${spotCount}, Perp: ${perpCount})`);
      return results;
    } catch (error) {
      logger.error('Error fetching Bitget prices:', error);
      return [];
    }
  }

  private processPriceData(data: ExchangePriceData[]) {
    // Clear old cache
    this.priceCache.clear();

    // Group by symbol
    data.forEach(item => {
      const existing = this.priceCache.get(item.symbol) || [];
      existing.push(item);
      this.priceCache.set(item.symbol, existing);
    });
  }

  private calculateDeviation(symbol: string): PriceDeviationData | null {
    const exchanges = this.priceCache.get(symbol);
    if (!exchanges || exchanges.length === 0) return null;

    // Find best spot and perp prices by volume
    let bestSpot: { exchange: string; price: number; volume: number } | null = null;
    let bestPerp: { exchange: string; price: number; volume: number } | null = null;

    exchanges.forEach(data => {
      if (data.spotPrice && data.spotVolume) {
        if (!bestSpot || data.spotVolume > bestSpot.volume) {
          bestSpot = { 
            exchange: data.exchange, 
            price: data.spotPrice, 
            volume: data.spotVolume
          };
        }
      }
      if (data.perpPrice && data.perpVolume) {
        if (!bestPerp || data.perpVolume > bestPerp.volume) {
          bestPerp = { 
            exchange: data.exchange, 
            price: data.perpPrice, 
            volume: data.perpVolume
          };
        }
      }
    });

    if (!bestSpot || !bestPerp) return null;

    // Type assertion after null check
    const spotData = bestSpot as { exchange: string; price: number; volume: number };
    const perpData = bestPerp as { exchange: string; price: number; volume: number };

    const deviation = ((perpData.price - spotData.price) / spotData.price) * 100;
    
    // Filter out extreme deviations (likely data errors)
    if (Math.abs(deviation) > 50) {
      logger.debug(`Excluding ${symbol} due to extreme deviation: ${deviation.toFixed(2)}% (Spot: ${spotData.price}, Perp: ${perpData.price})`);
      return null;
    }

    // Get funding rate from BinanceRestApi if perpExchange is Binance
    let fundingRate: number | undefined;
    if (perpData.exchange === 'binance' && this.realTimeVolumeService) {
      const binanceAPI = this.realTimeVolumeService.getBinanceAPI();
      if (binanceAPI) {
        fundingRate = binanceAPI.getFundingRate(symbol);
      }
    }

    return {
      rank: 0, // Will be set later
      symbol,
      spotExchange: spotData.exchange,
      perpExchange: perpData.exchange,
      spotPrice: spotData.price,
      perpPrice: perpData.price,
      deviation,
      spotVolume: spotData.volume,
      perpVolume: perpData.volume,
      totalVolume: spotData.volume + perpData.volume,
      fundingRate
    };
  }

  public async getTopDeviations(limit: number = 15, minVolume: number = 0, sortOrder: string = 'asc'): Promise<PriceDeviationData[]> {
    try {
      // Calculate deviations for all symbols
      const deviations: PriceDeviationData[] = [];

      for (const symbol of this.priceCache.keys()) {
        const deviation = this.calculateDeviation(symbol);
        if (deviation) {
          deviations.push(deviation);
        }
      }

      // Filter by minimum volume
      const filteredDeviations = minVolume > 0 
        ? deviations.filter(item => item.totalVolume >= minVolume)
        : deviations;

      // Sort by deviation
      if (sortOrder === 'desc') {
        filteredDeviations.sort((a, b) => b.deviation - a.deviation);
      } else {
        filteredDeviations.sort((a, b) => a.deviation - b.deviation);
      }

      // Limit and set ranks
      return filteredDeviations.slice(0, limit).map((item, index) => ({
        ...item,
        rank: index + 1
      }));
    } catch (error) {
      logger.error('Error getting top deviations:', error);
      return [];
    }
  }

  private async fetchUpbitPrices(): Promise<ExchangePriceData[]> {
    try {
      // Get all available KRW markets first
      const marketsResponse = await axios.get('https://api.upbit.com/v1/market/all');
      const krwMarkets = marketsResponse.data
        .filter((m: any) => m.market.startsWith('KRW-'))
        .map((m: any) => m.market)
        .join(','); // Get all KRW markets
      
      // Get ticker data for all KRW markets
      const response = await axios.get(`https://api.upbit.com/v1/ticker?markets=${krwMarkets}`);
      
      const result: Map<string, ExchangePriceData> = new Map();
      const krwToUsd = 1400; // Approximate KRW to USD rate

      if (Array.isArray(response.data)) {
        response.data.forEach((ticker: any) => {
          const symbol = ticker.market.replace('KRW-', '');
          result.set(symbol, {
            exchange: 'upbit',
            symbol,
            spotPrice: ticker.trade_price / krwToUsd,
            spotVolume: ticker.acc_trade_price_24h / krwToUsd,
            perpPrice: undefined,
            perpVolume: undefined
          });
        });
      }

      const results = Array.from(result.values());
      logger.info(`Fetched ${results.length} symbols from Upbit (KRW markets: ${response.data.length})`);
      return results;
    } catch (error) {
      logger.error('Error fetching Upbit prices:', error);
      return [];
    }
  }

  private async fetchMEXCPrices(): Promise<ExchangePriceData[]> {
    try {
      const [spotResponse, perpResponse] = await Promise.all([
        axios.get('https://api.mexc.com/api/v3/ticker/24hr'),
        axios.get('https://contract.mexc.com/api/v1/contract/ticker').catch(() => ({ data: { data: [] } }))
      ]);

      const result: Map<string, ExchangePriceData> = new Map();

      // Process spot data
      if (Array.isArray(spotResponse.data)) {
        spotResponse.data.forEach((ticker: any) => {
          if (ticker.symbol && ticker.symbol.endsWith('USDT')) {
            const symbol = ticker.symbol.replace('USDT', '');
            const existing = result.get(symbol) || { exchange: 'mexc', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
            existing.spotPrice = parseFloat(ticker.lastPrice);
            existing.spotVolume = parseFloat(ticker.quoteVolume);
            result.set(symbol, existing);
          }
        });
      }

      // Process perp data if available
      if (perpResponse.data?.data && Array.isArray(perpResponse.data.data)) {
        perpResponse.data.data.forEach((ticker: any) => {
          if (ticker.symbol && ticker.symbol.includes('_USDT')) {
            const symbol = ticker.symbol.split('_')[0];
            const existing = result.get(symbol) || { exchange: 'mexc', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
            existing.perpPrice = parseFloat(ticker.lastPrice);
            // Use amount24 which is already in USD, not volume24 which is in contracts
            existing.perpVolume = parseFloat(ticker.amount24);
            result.set(symbol, existing);
          }
        });
      }

      const results = Array.from(result.values());
      const spotCount = results.filter(r => r.spotPrice !== undefined).length;
      const perpCount = results.filter(r => r.perpPrice !== undefined).length;
      logger.info(`Fetched ${results.length} symbols from MEXC (Spot: ${spotCount}, Perp: ${perpCount})`);
      return results;
    } catch (error) {
      logger.error('Error fetching MEXC prices:', error);
      return [];
    }
  }

  private async fetchBithumbPrices(): Promise<ExchangePriceData[]> {
    try {
      const response = await axios.get('https://api.bithumb.com/public/ticker/ALL_KRW');
      
      const result: Map<string, ExchangePriceData> = new Map();
      const krwToUsd = 1400; // Approximate KRW to USD rate

      if (response.data?.status === '0000' && response.data.data) {
        Object.entries(response.data.data).forEach(([symbol, data]: [string, any]) => {
          if (symbol !== 'date' && data.closing_price) {
            result.set(symbol, {
              exchange: 'bithumb',
              symbol,
              spotPrice: parseFloat(data.closing_price) / krwToUsd,
              spotVolume: parseFloat(data.acc_trade_value_24H) / krwToUsd,
              perpPrice: undefined,
              perpVolume: undefined
            });
          }
        });
      }

      const results = Array.from(result.values());
      logger.info(`Fetched ${results.length} symbols from Bithumb`);
      return results;
    } catch (error) {
      logger.error('Error fetching Bithumb prices:', error);
      return [];
    }
  }

  private async fetchCoinbasePrices(): Promise<ExchangePriceData[]> {
    try {
      // Use Coinbase Exchange API (not Coinbase API) for better market data
      const response = await axios.get('https://api.exchange.coinbase.com/products');
      const result: Map<string, ExchangePriceData> = new Map();
      
      // Filter USD pairs and get their tickers
      const usdPairs = response.data.filter((product: any) => 
        product.quote_currency === 'USD' && product.status === 'online'
      );
      
      // Batch fetch tickers for all USD pairs
      const tickerPromises = usdPairs.map((pair: any) =>
        axios.get(`https://api.exchange.coinbase.com/products/${pair.id}/ticker`)
          .then(res => ({ symbol: pair.base_currency, data: res.data }))
          .catch(() => null)
      );
      
      const tickers = await Promise.all(tickerPromises);
      
      tickers.forEach((ticker: any) => {
        if (ticker && ticker.data) {
          result.set(ticker.symbol, {
            exchange: 'coinbase',
            symbol: ticker.symbol,
            spotPrice: parseFloat(ticker.data.price),
            spotVolume: parseFloat(ticker.data.volume) * parseFloat(ticker.data.price),
            perpPrice: undefined,
            perpVolume: undefined
          });
        }
      });

      const results = Array.from(result.values());
      logger.info(`Fetched ${results.length} symbols from Coinbase`);
      return results;
    } catch (error) {
      logger.error('Error fetching Coinbase prices:', error);
      return [];
    }
  }

  // Alias for compatibility
  public async getWebSocketDeviations(limit: number = 15, minVolume: number = 0, sortOrder: string = 'asc'): Promise<PriceDeviationData[]> {
    return this.getTopDeviations(limit, minVolume, sortOrder);
  }

  // New methods that use volume data from RealTimeVolumeService
  private async fetchBinancePricesWithVolume(): Promise<ExchangePriceData[]> {
    try {
      // Only fetch price data
      const [spotResponse, perpResponse] = await Promise.all([
        axios.get('https://api.binance.com/api/v3/ticker/price'),
        axios.get('https://fapi.binance.com/fapi/v1/ticker/price')
      ]);

      const result: Map<string, ExchangePriceData> = new Map();

      // Get volume data from RealTimeVolumeService
      const spotVolumeData = this.realTimeVolumeService?.getAllBinanceSpotData() || new Map();
      const perpVolumeData = this.realTimeVolumeService?.getAllVolumeData() || [];

      // Process spot data
      spotResponse.data.forEach((ticker: any) => {
        if (ticker.symbol.endsWith('USDT')) {
          const symbol = ticker.symbol.replace('USDT', '');
          const volumeInfo = spotVolumeData.get(symbol);
          if (volumeInfo && volumeInfo.originalQuoteVolume > 0) {
            const existing = result.get(symbol) || { exchange: 'binance', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
            existing.spotPrice = parseFloat(ticker.price);
            existing.spotVolume = volumeInfo.originalQuoteVolume;
            result.set(symbol, existing);
          }
        }
      });

      // Process perp data
      perpResponse.data.forEach((ticker: any) => {
        if (ticker.symbol.endsWith('USDT')) {
          const symbol = ticker.symbol.replace('USDT', '');
          const volumeInfo = perpVolumeData.find((v: any) => v.symbol === symbol);
          if (volumeInfo) {
            const existing = result.get(symbol) || { exchange: 'binance', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
            existing.perpPrice = parseFloat(ticker.price);
            // quoteVolume from getAllVolumeData is raw numeric string
            existing.perpVolume = parseFloat(volumeInfo.quoteVolume);
            result.set(symbol, existing);
          }
        }
      });

      const results = Array.from(result.values());
      // Debug BIO specifically
      const bio = results.find(r => r.symbol === 'BIO');
      if (bio) {
        logger.info(`BIO on Binance - Spot Vol: ${bio.spotVolume}, Perp Vol: ${bio.perpVolume}`);
      }
      logger.info(`Fetched ${results.length} symbols from Binance with cached volume data`);
      return results;
    } catch (error) {
      logger.error('Error fetching Binance prices with volume:', error);
      // Fallback to old method
      return this.fetchBinancePrices();
    }
  }

  private async fetchBybitPricesWithVolume(): Promise<ExchangePriceData[]> {
    try {
      // Only fetch price data
      const [spotResponse, perpResponse] = await Promise.all([
        axios.get('https://api.bybit.com/v5/market/tickers?category=spot'),
        axios.get('https://api.bybit.com/v5/market/tickers?category=linear')
      ]);

      const result: Map<string, ExchangePriceData> = new Map();
      
      // Get volume data from RealTimeVolumeService
      const bybitVolumeData = this.realTimeVolumeService?.getAllBybitData() || new Map();

      // Process spot data (spot prices with cached volumes)
      if (spotResponse.data?.result?.list) {
        spotResponse.data.result.list.forEach((ticker: any) => {
          if (ticker.symbol.endsWith('USDT')) {
            const symbol = ticker.symbol.replace('USDT', '');
            const volumeInfo = bybitVolumeData.get(symbol);
            const volume = volumeInfo ? volumeInfo.originalQuoteVolume : parseFloat(ticker.turnover24h);
            if (volume > 0) {
              const existing = result.get(symbol) || { exchange: 'bybit', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
              existing.spotPrice = parseFloat(ticker.lastPrice);
              existing.spotVolume = volume;
              result.set(symbol, existing);
            }
          }
        });
      }

      // Process perp data (perp prices with cached volumes)
      if (perpResponse.data?.result?.list) {
        perpResponse.data.result.list.forEach((ticker: any) => {
          if (ticker.symbol.endsWith('USDT')) {
            const symbol = ticker.symbol.replace('USDT', '');
            const volumeInfo = bybitVolumeData.get(symbol);
            const volume = volumeInfo ? volumeInfo.originalQuoteVolume : parseFloat(ticker.turnover24h);
            if (volume > 0) {
              const existing = result.get(symbol) || { exchange: 'bybit', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
              existing.perpPrice = parseFloat(ticker.lastPrice);
              existing.perpVolume = volume;
              result.set(symbol, existing);
            }
          }
        });
      }

      const results = Array.from(result.values());
      logger.info(`Fetched ${results.length} symbols from Bybit with cached volume data`);
      return results;
    } catch (error) {
      logger.error('Error fetching Bybit prices with volume:', error);
      // Fallback to old method
      return this.fetchBybitPrices();
    }
  }

  // OKX implementation with volume from RealTimeVolumeService
  private async fetchOKXPricesWithVolume(): Promise<ExchangePriceData[]> {
    try {
      const [spotResponse, perpResponse] = await Promise.all([
        axios.get('https://www.okx.com/api/v5/market/tickers?instType=SPOT'),
        axios.get('https://www.okx.com/api/v5/market/tickers?instType=SWAP')
      ]);

      const result: Map<string, ExchangePriceData> = new Map();
      
      // Get volume data from RealTimeVolumeService
      const okxVolumeData = this.realTimeVolumeService?.getAllOkxData() || new Map();

      // Process spot data
      if (spotResponse.data?.data) {
        spotResponse.data.data.forEach((ticker: any) => {
          if (ticker.instId.endsWith('-USDT')) {
            const symbol = ticker.instId.replace('-USDT', '');
            const volumeInfo = okxVolumeData.get(symbol);
            const volume = volumeInfo ? volumeInfo.originalQuoteVolume : parseFloat(ticker.volCcy24h);
            if (volume > 0) {
              const existing = result.get(symbol) || { exchange: 'okx', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
              existing.spotPrice = parseFloat(ticker.last);
              existing.spotVolume = volume;
              result.set(symbol, existing);
            }
          }
        });
      }

      // Process perp data
      if (perpResponse.data?.data) {
        perpResponse.data.data.forEach((ticker: any) => {
          if (ticker.instId.endsWith('-USDT-SWAP')) {
            const symbol = ticker.instId.replace('-USDT-SWAP', '');
            const volumeInfo = okxVolumeData.get(symbol);
            // Use volume from cache or API - volCcy24h is in USDT for USDT perpetuals
            const volume = volumeInfo ? volumeInfo.originalQuoteVolume : parseFloat(ticker.volCcy24h || 0);
            if (volume > 0) {
              const existing = result.get(symbol) || { exchange: 'okx', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
              existing.perpPrice = parseFloat(ticker.last);
              existing.perpVolume = volume;
              result.set(symbol, existing);
            }
          }
        });
      }

      const results = Array.from(result.values());
      logger.info(`Fetched ${results.length} symbols from OKX with cached volume data`);
      return results;
    } catch (error) {
      logger.error('Error fetching OKX prices with volume:', error);
      return this.fetchOKXPrices();
    }
  }

  // Gate.io implementation with volume from RealTimeVolumeService
  private async fetchGatePricesWithVolume(): Promise<ExchangePriceData[]> {
    try {
      const [spotResponse, perpResponse] = await Promise.all([
        axios.get('https://api.gateio.ws/api/v4/spot/tickers'),
        axios.get('https://api.gateio.ws/api/v4/futures/usdt/tickers')
      ]);

      const result: Map<string, ExchangePriceData> = new Map();
      
      // Get volume data from RealTimeVolumeService
      const gateioVolumeData = this.realTimeVolumeService?.getAllGateioData() || new Map();

      // Process spot data
      spotResponse.data.forEach((ticker: any) => {
        if (ticker.currency_pair.endsWith('_USDT')) {
          const symbol = ticker.currency_pair.replace('_USDT', '');
          const volumeInfo = gateioVolumeData.get(symbol);
          const volume = volumeInfo ? volumeInfo.originalQuoteVolume : parseFloat(ticker.quote_volume);
          if (volume > 0) {
            const existing = result.get(symbol) || { exchange: 'gateio', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
            existing.spotPrice = parseFloat(ticker.last);
            existing.spotVolume = volume;
            result.set(symbol, existing);
          }
        }
      });

      // Process perp data
      perpResponse.data.forEach((ticker: any) => {
        if (ticker.contract.endsWith('_USDT') && !ticker.contract.match(/\d{8}/)) {
          const symbol = ticker.contract.replace('_USDT', '');
          const volumeInfo = gateioVolumeData.get(symbol);
          const volume = volumeInfo ? volumeInfo.originalQuoteVolume : parseFloat(ticker.volume_24h_quote);
          if (volume > 0) {
            const existing = result.get(symbol) || { exchange: 'gateio', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
            existing.perpPrice = parseFloat(ticker.last);
            existing.perpVolume = volume;
            result.set(symbol, existing);
          }
        }
      });

      const results = Array.from(result.values());
      logger.info(`Fetched ${results.length} symbols from Gate.io with cached volume data`);
      return results;
    } catch (error) {
      logger.error('Error fetching Gate.io prices with volume:', error);
      return this.fetchGatePrices();
    }
  }

  // Bitget implementation with volume from RealTimeVolumeService
  private async fetchBitgetPricesWithVolume(): Promise<ExchangePriceData[]> {
    try {
      const [spotResponse, perpResponse] = await Promise.all([
        axios.get('https://api.bitget.com/api/v2/spot/market/tickers'),
        axios.get('https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES')
      ]);

      const result: Map<string, ExchangePriceData> = new Map();
      
      // Get volume data from RealTimeVolumeService
      const bitgetVolumeData = this.realTimeVolumeService?.getAllBitgetData() || new Map();

      // Process spot data
      if (spotResponse.data?.data) {
        spotResponse.data.data.forEach((ticker: any) => {
          if (ticker.symbol.endsWith('USDT')) {
            const symbol = ticker.symbol.replace('USDT', '');
            const volumeInfo = bitgetVolumeData.get(symbol);
            const volume = volumeInfo ? volumeInfo.originalQuoteVolume : parseFloat(ticker.quoteVolume);
            if (volume > 0) {
              const existing = result.get(symbol) || { exchange: 'bitget', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
              existing.spotPrice = parseFloat(ticker.lastPr);
              existing.spotVolume = volume;
              result.set(symbol, existing);
            }
          }
        });
      }

      // Process perp data
      if (perpResponse.data?.data) {
        perpResponse.data.data.forEach((ticker: any) => {
          if (ticker.symbol.endsWith('USDT')) {
            const symbol = ticker.symbol.replace('USDT', '');
            const volumeInfo = bitgetVolumeData.get(symbol);
            const volume = volumeInfo ? volumeInfo.originalQuoteVolume : parseFloat(ticker.quoteVolume);
            if (volume > 0) {
              const existing = result.get(symbol) || { exchange: 'bitget', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
              existing.perpPrice = parseFloat(ticker.lastPr);
              existing.perpVolume = volume;
              result.set(symbol, existing);
            }
          }
        });
      }

      const results = Array.from(result.values());
      logger.info(`Fetched ${results.length} symbols from Bitget with cached volume data`);
      return results;
    } catch (error) {
      logger.error('Error fetching Bitget prices with volume:', error);
      return this.fetchBitgetPrices();
    }
  }

  // MEXC implementation with volume from RealTimeVolumeService
  private async fetchMEXCPricesWithVolume(): Promise<ExchangePriceData[]> {
    try {
      const [spotResponse, perpResponse] = await Promise.all([
        axios.get('https://api.mexc.com/api/v3/ticker/24hr'),
        axios.get('https://contract.mexc.com/api/v1/contract/ticker')
      ]);

      const result: Map<string, ExchangePriceData> = new Map();
      
      // Get volume data from RealTimeVolumeService
      const mexcSpotData = this.realTimeVolumeService?.getAllMexcData() || new Map();
      const mexcFuturesData = this.realTimeVolumeService?.getAllMexcFuturesData() || new Map();

      // Process spot data
      spotResponse.data.forEach((ticker: any) => {
        if (ticker.symbol.endsWith('USDT')) {
          const symbol = ticker.symbol.replace('USDT', '');
          const volumeInfo = mexcSpotData.get(symbol);
          const volume = volumeInfo ? volumeInfo.originalQuoteVolume : parseFloat(ticker.quoteVolume);
          if (volume > 0) {
            const existing = result.get(symbol) || { exchange: 'mexc', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
            existing.spotPrice = parseFloat(ticker.lastPrice);
            existing.spotVolume = volume;
            result.set(symbol, existing);
          }
        }
      });

      // Process perp data
      if (perpResponse.data?.data) {
        perpResponse.data.data.forEach((ticker: any) => {
          if (ticker.symbol.endsWith('_USDT')) {
            const symbol = ticker.symbol.replace('_USDT', '');
            const volumeInfo = mexcFuturesData.get(symbol);
            const volume = volumeInfo ? volumeInfo.originalQuoteVolume : parseFloat(ticker.volume24);
            if (volume > 0) {
              const existing = result.get(symbol) || { exchange: 'mexc', symbol, spotPrice: undefined, spotVolume: undefined, perpPrice: undefined, perpVolume: undefined };
              existing.perpPrice = parseFloat(ticker.lastPrice);
              existing.perpVolume = volume;
              result.set(symbol, existing);
            }
          }
        });
      }

      const results = Array.from(result.values());
      logger.info(`Fetched ${results.length} symbols from MEXC with cached volume data`);
      return results;
    } catch (error) {
      logger.error('Error fetching MEXC prices with volume:', error);
      return this.fetchMEXCPrices();
    }
  }

  // Upbit implementation with volume from RealTimeVolumeService (spot only)
  private async fetchUpbitPricesWithVolume(): Promise<ExchangePriceData[]> {
    try {
      // Get all available KRW markets first
      const marketsResponse = await axios.get('https://api.upbit.com/v1/market/all');
      const krwMarkets = marketsResponse.data
        .filter((m: any) => m.market.startsWith('KRW-'))
        .map((m: any) => m.market);
      
      // Get tickers for KRW markets
      const tickerResponse = await axios.get(`https://api.upbit.com/v1/ticker?markets=${krwMarkets.join(',')}`);
      const result: Map<string, ExchangePriceData> = new Map();
      
      // Get volume data from RealTimeVolumeService
      const upbitVolumeData = this.realTimeVolumeService?.getAllUpbitData() || new Map();
      
      // Use cached exchange rate
      const krwToUsd = 1 / 1399; // Using cached rate
      
      tickerResponse.data.forEach((ticker: any) => {
        const symbol = ticker.market.replace('KRW-', '');
        const volumeInfo = upbitVolumeData.get(symbol);
        const volume = volumeInfo ? volumeInfo.originalQuoteVolume : (parseFloat(ticker.acc_trade_price_24h) * krwToUsd);
        if (volume > 0) {
          result.set(symbol, {
            exchange: 'upbit',
            symbol,
            spotPrice: parseFloat(ticker.trade_price) * krwToUsd,
            spotVolume: volume,
            perpPrice: undefined,
            perpVolume: undefined
          });
        }
      });

      const results = Array.from(result.values());
      logger.info(`Fetched ${results.length} symbols from Upbit with cached volume data`);
      return results;
    } catch (error) {
      logger.error('Error fetching Upbit prices with volume:', error);
      return this.fetchUpbitPrices();
    }
  }

  // Bithumb implementation with volume from RealTimeVolumeService (spot only)
  private async fetchBithumbPricesWithVolume(): Promise<ExchangePriceData[]> {
    try {
      const response = await axios.get('https://api.bithumb.com/public/ticker/ALL_KRW');
      const result: Map<string, ExchangePriceData> = new Map();
      
      // Get volume data from RealTimeVolumeService
      const bithumbVolumeData = this.realTimeVolumeService?.getAllBithumbData() || new Map();
      
      // Use cached exchange rate
      const krwToUsd = 1 / 1399; // Using cached rate
      
      if (response.data?.data) {
        Object.entries(response.data.data).forEach(([symbol, ticker]: [string, any]) => {
          if (symbol !== 'date' && ticker.closing_price) {
            const volumeInfo = bithumbVolumeData.get(symbol);
            const volume = volumeInfo ? volumeInfo.originalQuoteVolume : (parseFloat(ticker.units_traded_24H) * parseFloat(ticker.closing_price) * krwToUsd);
            if (volume > 0) {
              result.set(symbol, {
                exchange: 'bithumb',
                symbol,
                spotPrice: parseFloat(ticker.closing_price) * krwToUsd,
                spotVolume: volume,
                perpPrice: undefined,
                perpVolume: undefined
              });
            }
          }
        });
      }

      const results = Array.from(result.values());
      logger.info(`Fetched ${results.length} symbols from Bithumb with cached volume data`);
      return results;
    } catch (error) {
      logger.error('Error fetching Bithumb prices with volume:', error);
      return this.fetchBithumbPrices();
    }
  }

  // Coinbase implementation with volume from RealTimeVolumeService (spot only)
  private async fetchCoinbasePricesWithVolume(): Promise<ExchangePriceData[]> {
    try {
      // Use Coinbase Exchange API for better market data
      const response = await axios.get('https://api.exchange.coinbase.com/products');
      const result: Map<string, ExchangePriceData> = new Map();
      
      // Get volume data from RealTimeVolumeService
      const coinbaseVolumeData = this.realTimeVolumeService?.getAllCoinbaseData() || new Map();
      
      // Filter USD pairs and get their tickers
      const usdPairs = response.data.filter((product: any) => 
        product.quote_currency === 'USD' && product.status === 'online'
      );
      
      // Batch fetch tickers for all USD pairs
      const tickerPromises = usdPairs.map((pair: any) =>
        axios.get(`https://api.exchange.coinbase.com/products/${pair.id}/ticker`)
          .then(res => ({ symbol: pair.base_currency, data: res.data }))
          .catch(() => null)
      );
      
      const tickers = await Promise.all(tickerPromises);
      
      tickers.forEach((ticker: any) => {
        if (ticker && ticker.data) {
          const volumeInfo = coinbaseVolumeData.get(ticker.symbol);
          const volume = volumeInfo ? volumeInfo.originalQuoteVolume : (parseFloat(ticker.data.volume) * parseFloat(ticker.data.price));
          if (volume > 0) {
            result.set(ticker.symbol, {
              exchange: 'coinbase',
              symbol: ticker.symbol,
              spotPrice: parseFloat(ticker.data.price),
              spotVolume: volume,
              perpPrice: undefined,
              perpVolume: undefined
            });
          }
        }
      });

      const results = Array.from(result.values());
      logger.info(`Fetched ${results.length} symbols from Coinbase with cached volume data`);
      return results;
    } catch (error) {
      logger.error('Error fetching Coinbase prices with volume:', error);
      return this.fetchCoinbasePrices();
    }
  }
}