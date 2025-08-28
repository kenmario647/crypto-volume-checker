import { EventEmitter } from 'events';
import BinanceRestApiService, { BinanceVolumeData } from './binanceRestApi';
import BinanceSpotRestApiService, { SpotVolumeData } from './binanceSpotRestApi';
import UpbitRestApiService, { UpbitVolumeData } from './upbitRestApi';
import { BybitClient } from './bybitClient';
import { OKXClient } from './okxClient';
import { GateIOClient } from './gateioClient';
import { BitgetClient } from './bitgetClient';
import { MEXCClient } from './mexcClient';
import { BithumbClient } from './bithumbClient';
import { CoinbaseClient } from './coinbaseClient';
import { ExchangeRateService } from './exchangeRateService';
import { logger } from '../utils/logger';
import { StartupVolumeTracker } from './startupVolumeTracker';

export interface VolumeHistory {
  timestamp: number;
  quoteVolume: number;
}

export interface CombinedVolumeData {
  symbol: string;
  volume: string;
  quoteVolume: string;
  volume24h: string;
  priceChangePercent: string;
  lastPrice: string;
  rank: number;
  previousRank?: number;
  initialRank?: number; // Rank at startup
  exchange: 'binance' | 'binance-spot' | 'upbit' | 'bybit' | 'okx' | 'gateio' | 'bitget' | 'mexc' | 'bithumb' | 'coinbase';
  originalQuoteVolume: number; // For sorting purposes
  volumeHistory: VolumeHistory[];
  rankChanged?: boolean;
  volumeSpike?: boolean;
  newRankIn?: boolean;
  volumeIncrease5m?: number;
}

export class RealTimeVolumeService extends EventEmitter {
  private binanceAPI: BinanceRestApiService;
  private binanceSpotAPI: BinanceSpotRestApiService;
  private upbitAPI: UpbitRestApiService;
  private bybitClient: BybitClient;
  private okxClient: OKXClient;
  private gateioClient: GateIOClient;
  private bitgetClient: BitgetClient;
  private mexcClient: MEXCClient;
  private bithumbClient: BithumbClient;
  private coinbaseClient: CoinbaseClient;
  private volumeTracker: StartupVolumeTracker;
  // Top 15 for display
  private binanceData: CombinedVolumeData[] = [];
  private binanceSpotData: CombinedVolumeData[] = [];
  private upbitData: CombinedVolumeData[] = [];
  private bybitData: CombinedVolumeData[] = [];
  private okxData: CombinedVolumeData[] = [];
  private gateioData: CombinedVolumeData[] = [];
  private bitgetData: CombinedVolumeData[] = [];
  private mexcData: CombinedVolumeData[] = [];
  private mexcFuturesData: CombinedVolumeData[] = [];
  private bithumbData: CombinedVolumeData[] = [];
  private coinbaseData: CombinedVolumeData[] = [];
  
  // Full data for all symbols (for price deviation calculation)
  private allBinanceData: Map<string, CombinedVolumeData> = new Map();
  private allBinanceSpotData: Map<string, CombinedVolumeData> = new Map();
  private allUpbitData: Map<string, CombinedVolumeData> = new Map();
  private allBybitData: Map<string, CombinedVolumeData> = new Map();
  private allOkxData: Map<string, CombinedVolumeData> = new Map();
  private allGateioData: Map<string, CombinedVolumeData> = new Map();
  private allBitgetData: Map<string, CombinedVolumeData> = new Map();
  private allMexcData: Map<string, CombinedVolumeData> = new Map();
  private allMexcFuturesData: Map<string, CombinedVolumeData> = new Map();
  private allBithumbData: Map<string, CombinedVolumeData> = new Map();
  private allCoinbaseData: Map<string, CombinedVolumeData> = new Map();
  private volumeHistory: Map<string, VolumeHistory[]> = new Map();
  private previousRankings: Map<string, Map<string, number>> = new Map(); // exchange -> symbol -> rank
  private isFirstFetch: Set<string> = new Set(); // Track first fetch for each exchange/market

  constructor() {
    super();
    
    this.volumeTracker = StartupVolumeTracker.getInstance();
    this.binanceAPI = new BinanceRestApiService();
    this.binanceSpotAPI = new BinanceSpotRestApiService();
    this.upbitAPI = new UpbitRestApiService();
    this.bybitClient = BybitClient.getInstance();
    this.okxClient = OKXClient.getInstance();
    this.gateioClient = GateIOClient.getInstance();
    this.bitgetClient = BitgetClient.getInstance();
    this.mexcClient = MEXCClient.getInstance();
    this.bithumbClient = BithumbClient.getInstance();
    this.coinbaseClient = CoinbaseClient.getInstance();

    this.setupEventHandlers();
    this.startOtherExchangePolling();

    logger.info('RealTimeVolumeService initialized');
  }

  private setupEventHandlers() {
    this.binanceAPI.on('volumeUpdate', (data: BinanceVolumeData[]) => {
      logger.debug('Received Binance volume update');
      const normalizedData = data.map(item => this.normalizeBinanceData(item));
      
      // Store all data
      this.allBinanceData.clear();
      normalizedData.forEach(item => {
        this.allBinanceData.set(item.symbol, item);
      });
      
      // Keep top 15 for display
      this.binanceData = normalizedData.slice(0, 15);
      this.emit('binanceUpdate', this.binanceData);
    });

    this.binanceSpotAPI.on('volumeData', (data: SpotVolumeData[]) => {
      logger.debug('Received Binance SPOT volume update');
      const normalizedData = data.map(item => this.normalizeBinanceSpotData(item));
      
      // Store all data
      this.allBinanceSpotData.clear();
      normalizedData.forEach(item => {
        this.allBinanceSpotData.set(item.symbol, item);
      });
      
      // Keep top 15 for display
      this.binanceSpotData = normalizedData.slice(0, 15);
      this.emit('binanceSpotUpdate', this.binanceSpotData);
    });

    this.upbitAPI.on('volumeUpdate', (data: UpbitVolumeData[]) => {
      logger.debug('Received Upbit volume update');
      const normalizedData = data.map(item => this.normalizeUpbitData(item));
      
      // Store all data
      this.allUpbitData.clear();
      normalizedData.forEach(item => {
        this.allUpbitData.set(item.symbol, item);
      });
      
      // Keep top 15 for display
      this.upbitData = normalizedData.slice(0, 15);
      this.emit('upbitUpdate', this.upbitData);
    });
  }


  private normalizeBinanceData(data: BinanceVolumeData): CombinedVolumeData {
    const quoteVolumeUSD = parseFloat(data.quoteVolume);
    const volume24h = this.calculate24hVolume(data.symbol, quoteVolumeUSD, 'binance');
    const history = this.getVolumeHistory(data.symbol, 'binance');
    
    // Ensure previousRank defaults to current rank if undefined
    const previousRank = data.previousRank !== undefined ? data.previousRank : data.rank;
    
    // Store initial volume and rank on first fetch
    this.volumeTracker.setInitialData('binance', data.symbol, quoteVolumeUSD, data.rank);
    
    // Calculate volume change from startup
    const volumeChangeFromStartup = this.volumeTracker.calculateVolumeChangeFromStartup('binance', data.symbol, quoteVolumeUSD);
    
    // Get initial rank
    const initialRank = this.volumeTracker.getInitialRank('binance', data.symbol);
    
    return {
      symbol: data.symbol,
      volume: this.formatVolume(parseFloat(data.volume)),
      quoteVolume: this.formatVolumeUSD(quoteVolumeUSD),
      volume24h: this.formatVolumeUSD(volume24h),
      priceChangePercent: `${volumeChangeFromStartup.toFixed(2)}%`,
      initialRank: initialRank,
      lastPrice: `$${parseFloat(data.lastPrice).toFixed(6)}`,
      rank: data.rank,
      previousRank: previousRank,
      exchange: 'binance',
      originalQuoteVolume: quoteVolumeUSD,
      volumeHistory: history,
      rankChanged: data.rankChanged || false,
      volumeSpike: data.volumeSpike || false,
      newRankIn: data.newRankIn || false,
      volumeIncrease5m: data.volumeIncrease5m
    };
  }

  private normalizeBinanceSpotData(data: SpotVolumeData): CombinedVolumeData {
    const quoteVolumeUSD = parseFloat(data.quoteVolume);
    const volume24h = this.calculate24hVolume(data.symbol, quoteVolumeUSD, 'binance-spot');
    const history = this.getVolumeHistory(data.symbol, 'binance-spot');
    
    // Ensure previousRank defaults to current rank if undefined
    const previousRank = data.previousRank !== undefined ? data.previousRank : data.rank;
    
    // Store initial volume and rank on first fetch
    this.volumeTracker.setInitialData('binance-spot', data.symbol, quoteVolumeUSD, data.rank);
    
    // Calculate volume change from startup
    const volumeChangeFromStartup = this.volumeTracker.calculateVolumeChangeFromStartup('binance-spot', data.symbol, quoteVolumeUSD);
    
    // Get initial rank
    const initialRank = this.volumeTracker.getInitialRank('binance-spot', data.symbol);
    
    return {
      symbol: data.symbol,
      volume: this.formatVolume(parseFloat(data.volume)),
      quoteVolume: this.formatVolumeUSD(quoteVolumeUSD),
      volume24h: this.formatVolumeUSD(volume24h),
      priceChangePercent: `${volumeChangeFromStartup.toFixed(2)}%`,
      initialRank: initialRank,
      lastPrice: `$${parseFloat(data.lastPrice).toFixed(6)}`,
      rank: data.rank,
      previousRank: previousRank,
      exchange: 'binance-spot',
      originalQuoteVolume: quoteVolumeUSD,
      volumeHistory: history,
      rankChanged: data.rankChanged || false,
      volumeSpike: data.volumeSpike || false,
      newRankIn: data.newRankIn || false,
      volumeIncrease5m: data.volumeIncrease5m
    };
  }

  private normalizeUpbitData(data: UpbitVolumeData): CombinedVolumeData {
    // Convert KRW to USD (approximate rate: 1 USD = 1300 KRW)
    const exchangeRateService = ExchangeRateService.getInstance();
    const quoteVolumeUSD = data.quoteVolume * exchangeRateService.getKrwToUsdRate();
    const volume24h = this.calculate24hVolume(data.symbol, quoteVolumeUSD, 'upbit');
    const history = this.getVolumeHistory(data.symbol, 'upbit');
    
    // Ensure previousRank defaults to current rank if undefined
    const previousRank = data.previousRank !== undefined ? data.previousRank : data.rank;
    
    // Store initial volume and rank on first fetch
    this.volumeTracker.setInitialData('upbit', data.symbol, quoteVolumeUSD, data.rank);
    
    // Calculate volume change from startup
    const volumeChangeFromStartup = this.volumeTracker.calculateVolumeChangeFromStartup('upbit', data.symbol, quoteVolumeUSD);
    
    // Get initial rank
    const initialRank = this.volumeTracker.getInitialRank('upbit', data.symbol);
    
    return {
      symbol: data.symbol,
      volume: this.formatVolume(data.volume),
      quoteVolume: this.formatVolumeUSD(quoteVolumeUSD),
      volume24h: this.formatVolumeUSD(volume24h),
      priceChangePercent: `${volumeChangeFromStartup.toFixed(2)}%`,
      initialRank: initialRank,
      lastPrice: `₩${data.lastPrice.toLocaleString()}`,
      rank: data.rank,
      previousRank: previousRank,
      exchange: 'upbit',
      originalQuoteVolume: quoteVolumeUSD,
      volumeHistory: history,
      rankChanged: data.rankChanged || false,
      volumeSpike: data.volumeSpike || false,
      newRankIn: data.newRankIn || false,
      volumeIncrease5m: data.volumeIncrease5m
    };
  }

  private formatVolume(volume: number): string {
    // 常にミリオン単位で表示
    return `${(volume / 1e6).toFixed(1)}M`;
  }

  private formatVolumeUSD(volume: number): string {
    // 常にミリオン単位で表示
    return `$${(volume / 1e6).toFixed(1)}M`;
  }

  public getBinanceData(): CombinedVolumeData[] {
    // Return ALL symbols sorted by volume
    return Array.from(this.allBinanceData.values()).sort((a, b) => b.originalQuoteVolume - a.originalQuoteVolume);
  }

  public getUpbitData(): CombinedVolumeData[] {
    // Return ALL symbols sorted by volume
    return Array.from(this.allUpbitData.values()).sort((a, b) => b.originalQuoteVolume - a.originalQuoteVolume);
  }

  private calculate24hVolume(symbol: string, currentVolume: number, exchange: 'binance' | 'binance-spot' | 'upbit' | 'bybit' | 'okx' | 'gateio' | 'bitget' | 'mexc' | 'bithumb' | 'coinbase'): number {
    const now = Date.now();
    // Use exchange-specific key to avoid mixing data
    const historyKey = `${exchange}:${symbol}`;
    const history = this.volumeHistory.get(historyKey) || [];
    
    // Use actual current time to show real data collection time
    const currentTime = now;
    
    // Get the latest data point
    const latestData = history.length > 0 ? history[history.length - 1] : null;
    
    // Add new data point if:
    // 1. No history exists, or
    // 2. At least 4.5 minutes have passed since the last data point
    const shouldAddData = !latestData || (currentTime - latestData.timestamp) >= (4.5 * 60 * 1000);
    
    if (shouldAddData) {
      history.push({ timestamp: currentTime, quoteVolume: currentVolume });
      logger.debug(`[VOLUME_HISTORY] Added new data point for ${historyKey} at ${new Date(currentTime).toLocaleTimeString()}`);
    } else {
      const timeSinceLastData = latestData ? ((currentTime - latestData.timestamp) / 1000 / 60).toFixed(1) : 0;
      logger.debug(`[VOLUME_HISTORY] Skipped data point for ${historyKey}, only ${timeSinceLastData} minutes since last update`);
    }
    
    // Keep only data from last 24 hours
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const filteredHistory = history.filter(h => h.timestamp >= oneDayAgo);
    
    // Store filtered history with exchange-specific key
    this.volumeHistory.set(historyKey, filteredHistory);
    
    // Return the current 24h volume (not a sum of history)
    return currentVolume;
  }
  
  private getVolumeHistory(symbol: string, exchange: 'binance' | 'binance-spot' | 'upbit' | 'bybit' | 'okx' | 'gateio' | 'bitget' | 'mexc' | 'bithumb' | 'coinbase'): VolumeHistory[] {
    const historyKey = `${exchange}:${symbol}`;
    return this.volumeHistory.get(historyKey) || [];
  }

  public connect() {
    // BinanceRestApiService and UpbitRestApiService start automatically in constructor
    // Only BinanceSpotRestApiService needs explicit connect
    this.binanceSpotAPI.connect();
  }

  public getBinanceSpotData(): CombinedVolumeData[] {
    // Return ALL symbols sorted by volume
    return Array.from(this.allBinanceSpotData.values()).sort((a, b) => b.originalQuoteVolume - a.originalQuoteVolume);
  }

  public getBybitData(): CombinedVolumeData[] {
    // Return ALL symbols sorted by volume
    return Array.from(this.allBybitData.values()).sort((a, b) => b.originalQuoteVolume - a.originalQuoteVolume);
  }

  public getOkxData(): CombinedVolumeData[] {
    // Return ALL symbols sorted by volume
    return Array.from(this.allOkxData.values()).sort((a, b) => b.originalQuoteVolume - a.originalQuoteVolume);
  }

  public getGateioData(): CombinedVolumeData[] {
    // Return ALL symbols sorted by volume
    return Array.from(this.allGateioData.values()).sort((a, b) => b.originalQuoteVolume - a.originalQuoteVolume);
  }

  public getBitgetData(): CombinedVolumeData[] {
    // Return ALL symbols sorted by volume
    return Array.from(this.allBitgetData.values()).sort((a, b) => b.originalQuoteVolume - a.originalQuoteVolume);
  }

  public getMexcData(): { spot: CombinedVolumeData[], futures: CombinedVolumeData[] } {
    return {
      spot: Array.from(this.allMexcData.values()).sort((a, b) => b.originalQuoteVolume - a.originalQuoteVolume),
      futures: Array.from(this.allMexcFuturesData.values()).sort((a, b) => b.originalQuoteVolume - a.originalQuoteVolume)
    };
  }

  public getBithumbData(): CombinedVolumeData[] {
    // Return ALL symbols sorted by volume
    return Array.from(this.allBithumbData.values()).sort((a, b) => b.originalQuoteVolume - a.originalQuoteVolume);
  }

  public getCoinbaseData(): CombinedVolumeData[] {
    // Return ALL symbols sorted by volume
    return Array.from(this.allCoinbaseData.values()).sort((a, b) => b.originalQuoteVolume - a.originalQuoteVolume);
  }


  private async startOtherExchangePolling() {
    // Send empty initial data immediately for MEXC, Bithumb and Coinbase to prevent loading delay
    this.emit('mexcUpdate', {
      spot: [],
      futures: []
    });
    this.emit('bithumbUpdate', []);
    this.emit('coinbaseUpdate', []);
    
    // Initial fetch for other exchanges with slight delay
    setTimeout(() => {
      this.fetchOtherExchanges();
    }, 1000);
    
    // Poll other exchanges every 5 minutes for ranking updates
    setInterval(async () => {
      this.fetchOtherExchanges();
    }, 5 * 60 * 1000); // 5 minutes
  }

  private async fetchOtherExchanges() {
    try {
      logger.info('Fetching data from other exchanges for ranking update...');
      
      // Fetch all exchanges in parallel for better performance
      const [
        bybitData,
        okxData,
        gateioData,
        bitgetData,
        mexcSpotData,
        mexcFuturesData,
        bithumbData,
        coinbaseData
      ] = await Promise.allSettled([
        this.bybitClient.getTopVolumeCoins(999),  // Get all symbols
        this.okxClient.getTopVolumeCoins(999),    // Get all symbols
        this.gateioClient.getTopVolumeCoins(999), // Get all symbols
        this.bitgetClient.getTopVolumeCoins(999), // Get all symbols
        this.mexcClient.getTopVolumeCoins(999),   // Get all symbols
        this.mexcClient.getFuturesTopVolume(999), // Get all symbols
        this.bithumbClient.getTopVolumeCoins(999),// Get all symbols
        this.coinbaseClient.getTopVolumeCoins(999)// Get all symbols
      ]);

      // Process Bybit
      if (bybitData.status === 'fulfilled') {
        // Store ALL symbols in Map with correct ranks
        this.allBybitData.clear();
        bybitData.value.forEach((item, index) => {
          const normalized = this.normalizeExchangeData(item, index + 1, 'bybit');
          this.allBybitData.set(normalized.symbol, normalized);
        });
        
        // Keep top 15 for display
        this.bybitData = Array.from(this.allBybitData.values()).slice(0, 15);
        this.emit('bybitUpdate', this.bybitData);
      }

      // Process OKX
      if (okxData.status === 'fulfilled') {
        // Store ALL symbols in Map with correct ranks
        this.allOkxData.clear();
        okxData.value.forEach((item, index) => {
          const normalized = this.normalizeExchangeData(item, index + 1, 'okx');
          this.allOkxData.set(normalized.symbol, normalized);
        });
        
        // Keep top 15 for display
        this.okxData = Array.from(this.allOkxData.values()).slice(0, 15);
        this.emit('okxUpdate', this.okxData);
      }

      // Process Gate.io
      if (gateioData.status === 'fulfilled') {
        // Store ALL symbols in Map with correct ranks
        this.allGateioData.clear();
        gateioData.value.forEach((item, index) => {
          const normalized = this.normalizeExchangeData(item, index + 1, 'gateio');
          this.allGateioData.set(normalized.symbol, normalized);
        });
        
        // Keep top 15 for display
        this.gateioData = Array.from(this.allGateioData.values()).slice(0, 15);
        this.emit('gateioUpdate', this.gateioData);
      }

      // Process Bitget
      if (bitgetData.status === 'fulfilled') {
        // Store ALL symbols in Map with correct ranks
        this.allBitgetData.clear();
        bitgetData.value.forEach((item, index) => {
          const normalized = this.normalizeExchangeData(item, index + 1, 'bitget');
          this.allBitgetData.set(normalized.symbol, normalized);
        });
        
        // Keep top 15 for display
        this.bitgetData = Array.from(this.allBitgetData.values()).slice(0, 15);
        this.emit('bitgetUpdate', this.bitgetData);
      }

      // Process MEXC
      if (mexcSpotData.status === 'fulfilled') {
        // Store ALL symbols in Map with correct ranks
        this.allMexcData.clear();
        mexcSpotData.value.forEach((item, index) => {
          const normalized = this.normalizeExchangeData(item, index + 1, 'mexc');
          this.allMexcData.set(normalized.symbol, normalized);
        });
        
        // Keep top 15 for display
        this.mexcData = Array.from(this.allMexcData.values()).slice(0, 15);
      } else {
        this.mexcData = [];
      }

      if (mexcFuturesData.status === 'fulfilled') {
        // Store ALL symbols in Map with correct ranks
        this.allMexcFuturesData.clear();
        mexcFuturesData.value.forEach((item, index) => {
          const normalized = this.normalizeExchangeDataWithKey(item, index + 1, 'mexc', 'mexc-futures');
          this.allMexcFuturesData.set(normalized.symbol, normalized);
        });
        
        // Keep top 15 for display
        this.mexcFuturesData = Array.from(this.allMexcFuturesData.values()).slice(0, 15);
      } else {
        this.mexcFuturesData = [];
      }

      this.emit('mexcUpdate', {
        spot: this.mexcData,
        futures: this.mexcFuturesData
      });

      // Process Bithumb
      if (bithumbData.status === 'fulfilled') {
        // Store ALL symbols in Map with correct ranks
        this.allBithumbData.clear();
        bithumbData.value.forEach((item, index) => {
          const normalized = this.normalizeExchangeData(item, index + 1, 'bithumb');
          this.allBithumbData.set(normalized.symbol, normalized);
        });
        
        // Keep top 15 for display (they should already have correct ranks from the data)
        this.bithumbData = Array.from(this.allBithumbData.values()).slice(0, 15);
        this.emit('bithumbUpdate', this.bithumbData);
      }

      // Process Coinbase
      if (coinbaseData.status === 'fulfilled') {
        // Store ALL symbols in Map with correct ranks
        this.allCoinbaseData.clear();
        coinbaseData.value.forEach((item, index) => {
          const normalized = this.normalizeExchangeData(item, index + 1, 'coinbase');
          this.allCoinbaseData.set(normalized.symbol, normalized);
        });
        
        // Keep top 15 for display - use already normalized data from the Map to preserve correct ranks
        this.coinbaseData = Array.from(this.allCoinbaseData.values()).slice(0, 15);
        this.emit('coinbaseUpdate', this.coinbaseData);
      }

      logger.info('Other exchanges data updated (Bybit, OKX, Gate.io, Bitget, MEXC, Bithumb, Coinbase) - storing all symbols');
    } catch (error) {
      logger.error('Error polling other exchanges:', error);
    }
  }

  private normalizeExchangeData(data: any, rank: number, exchange: 'bybit' | 'okx' | 'gateio' | 'bitget' | 'mexc' | 'bithumb' | 'coinbase'): CombinedVolumeData {
    return this.normalizeExchangeDataWithKey(data, rank, exchange, exchange);
  }

  private normalizeExchangeDataWithKey(data: any, rank: number, exchange: 'bybit' | 'okx' | 'gateio' | 'bitget' | 'mexc' | 'bithumb' | 'coinbase', rankingKey: string): CombinedVolumeData {
    const quoteVolumeUSD = data.volume;
    const volume24h = this.calculate24hVolume(data.symbol, quoteVolumeUSD, exchange);
    const history = this.getVolumeHistory(data.symbol, exchange);
    const symbol = data.symbol.replace(/-USDT|-USD/, '');
    
    // Get previous rankings for this specific ranking key
    if (!this.previousRankings.has(rankingKey)) {
      this.previousRankings.set(rankingKey, new Map());
    }
    const exchangeRankings = this.previousRankings.get(rankingKey)!;
    
    // Get previous rank for this symbol
    const previousRank = exchangeRankings.get(symbol);
    
    // Determine if this is a real ranking change
    const hasRankChanged = previousRank !== undefined && previousRank !== rank;
    const isNewEntry = previousRank === undefined || previousRank > 15;
    
    // Update current ranking for next comparison
    exchangeRankings.set(symbol, rank);
    
    // Store initial volume and rank on first fetch
    this.volumeTracker.setInitialData(exchange, symbol, quoteVolumeUSD, rank);
    
    // Calculate volume change from startup
    const volumeChangeFromStartup = this.volumeTracker.calculateVolumeChangeFromStartup(exchange, symbol, quoteVolumeUSD);
    
    // Get initial rank
    const initialRank = this.volumeTracker.getInitialRank(exchange, symbol);
    
    return {
      symbol: symbol,
      volume: this.formatVolume(quoteVolumeUSD),
      quoteVolume: this.formatVolumeUSD(quoteVolumeUSD),
      volume24h: this.formatVolumeUSD(volume24h),
      priceChangePercent: `${volumeChangeFromStartup.toFixed(2)}%`,
      initialRank: initialRank,
      lastPrice: `$${data.price.toFixed(6)}`,
      rank: rank,
      previousRank: previousRank !== undefined ? previousRank : rank, // Default to current rank if no previous
      exchange: exchange,
      originalQuoteVolume: quoteVolumeUSD,
      volumeHistory: history,
      rankChanged: hasRankChanged,
      newRankIn: rank <= 15 && isNewEntry,
      volumeSpike: false,
      volumeIncrease5m: undefined
    };
  }

  // Get all Binance volume data with FR/OI
  public getAllVolumeData() {
    return this.binanceAPI.getAllVolumeData();
  }
  
  // Get binanceAPI instance for sharing FR/OI data
  public getBinanceAPI() {
    return this.binanceAPI;
  }

  // Get ALL symbol data for each exchange (for price deviation calculation)
  public getAllBinanceSpotData(): Map<string, CombinedVolumeData> {
    return new Map(this.allBinanceSpotData);
  }

  public getAllUpbitData(): Map<string, CombinedVolumeData> {
    return new Map(this.allUpbitData);
  }

  public getAllBybitData(): Map<string, CombinedVolumeData> {
    return new Map(this.allBybitData);
  }

  public getAllOkxData(): Map<string, CombinedVolumeData> {
    return new Map(this.allOkxData);
  }

  public getAllGateioData(): Map<string, CombinedVolumeData> {
    return new Map(this.allGateioData);
  }

  public getAllBitgetData(): Map<string, CombinedVolumeData> {
    return new Map(this.allBitgetData);
  }

  public getAllMexcData(): Map<string, CombinedVolumeData> {
    return new Map(this.allMexcData);
  }

  public getAllMexcFuturesData(): Map<string, CombinedVolumeData> {
    return new Map(this.allMexcFuturesData);
  }

  public getAllBithumbData(): Map<string, CombinedVolumeData> {
    return new Map(this.allBithumbData);
  }

  public getAllCoinbaseData(): Map<string, CombinedVolumeData> {
    return new Map(this.allCoinbaseData);
  }
  
  public disconnect() {
    // Only BinanceSpotRestApiService has disconnect method
    this.binanceSpotAPI.disconnect();
    
    logger.info('RealTimeVolumeService disconnected');
  }
}

export default RealTimeVolumeService;