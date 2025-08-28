import axios from 'axios';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface BinanceVolumeData {
  symbol: string;
  volume: string;
  quoteVolume: string;
  priceChangePercent: string;
  lastPrice: string;
  rank: number;
  previousRank?: number;
  exchange: 'binance';
  rankChanged?: boolean;
  volumeSpike?: boolean;
  newRankIn?: boolean;
  volumeIncrease5m?: number;
  // FR/OI data
  fundingRate?: number;
  openInterest?: number;
  openInterestValue?: number;
}

export class BinanceRestApiService extends EventEmitter {
  private volumeData: Map<string, BinanceVolumeData> = new Map();
  private allVolumeData: Map<string, BinanceVolumeData> = new Map(); // Store all symbols data
  private previousRankings: Map<string, number> = new Map();
  private previousVolumes: Map<string, number> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private frOiData: Map<string, { fundingRate: number; openInterest: number; openInterestValue: number }> = new Map();

  constructor() {
    super();
    this.startPeriodicFetch();
  }

  private startPeriodicFetch() {
    // Initial fetch immediately
    this.fetchVolumeData();
    
    // Schedule additional immediate fetch after 10 seconds in case first one fails
    setTimeout(() => {
      if (this.volumeData.size === 0) {
        logger.info('Retrying Binance data fetch (backup)...');
        this.fetchVolumeData();
      }
    }, 10000);
    
    // Fetch every 5 minutes
    this.updateInterval = setInterval(() => {
      this.fetchVolumeData();
    }, 5 * 60 * 1000); // 5 minutes
  }

  private async fetchVolumeData() {
    const startTime = Date.now();
    try {
      logger.info('Fetching Binance futures (PERP) volume data via REST API...');
      
      // First, get ticker data to know all symbols
      const tickerResponse = await axios.get('https://fapi.binance.com/fapi/v1/ticker/24hr', { timeout: 10000 });
      
      if (tickerResponse.status !== 200 || !Array.isArray(tickerResponse.data)) {
        logger.error('Invalid response from Binance Futures API:', tickerResponse.status);
        return;
      }
      
      // Extract all USDT perpetual symbols
      const allSymbols = tickerResponse.data
        .filter(ticker => ticker.symbol.endsWith('USDT') && !ticker.symbol.match(/\d{6}$/))
        .map(ticker => ticker.symbol);
      
      // Filter symbols with volume >= 50M for FR/OI data
      const highVolumeSymbols = tickerResponse.data
        .filter(ticker => {
          if (!ticker.symbol.endsWith('USDT') || ticker.symbol.match(/\d{6}$/)) {
            return false;
          }
          const volume = parseFloat(ticker.quoteVolume || '0');
          return volume >= 50000000; // 50M USD
        })
        .map(ticker => ticker.symbol);
      
      logger.info(`Filtered ${highVolumeSymbols.length} symbols with volume >= 50M from ${allSymbols.length} total symbols`);
      
      // Fetch premium index data (single request)
      const premiumIndexResponse = await this.fetchAllPremiumIndex(allSymbols).catch(err => {
        logger.error('Error fetching premium index:', err.message);
        return [];
      });
      
      // OI symbols list updated
      
      // Get OI data - simplified to empty map for now
      const openInterestResponse = [];
      
      const processingStart = Date.now();
      
      // Process FR/OI data first
      this.processFrOiData(premiumIndexResponse, openInterestResponse);
      
      // Process ticker data with FR/OI included
      this.processTickerData(tickerResponse.data);
      
      const processingTime = Date.now() - processingStart;
      const totalTime = Date.now() - startTime;
      logger.info(`Binance data processed: ${tickerResponse.data.length} tickers, ${premiumIndexResponse.length} symbols with FR/OI, processing: ${processingTime}ms, total: ${totalTime}ms`);
    } catch (error) {
      const totalTime = Date.now() - startTime;
      logger.error(`Error fetching Binance futures data (${totalTime}ms):`, error);
    }
  }
  
  private async fetchAllPremiumIndex(symbols: string[]) {
    try {
      // Fetch all premium index data in a single request
      const response = await axios.get('https://fapi.binance.com/fapi/v1/premiumIndex', {
        timeout: 10000
      });
      
      if (!Array.isArray(response.data)) {
        logger.error('Invalid premium index response format');
        return [];
      }
      
      // Filter to only include needed symbols
      const symbolSet = new Set(symbols);
      const filteredData = response.data.filter(item => 
        symbolSet.has(item.symbol)
      );
      
      logger.info(`Fetched premium index data for ${filteredData.length} symbols in 1 request`);
      return filteredData;
    } catch (error) {
      logger.error('Error fetching premium index data:', error);
      return [];
    }
  }
  
  
  private processFrOiData(premiumIndexData: any[], openInterests: any[]) {
    // Clear previous data
    this.frOiData.clear();
    
    // Process premium index data to get funding rates
    premiumIndexData.forEach(item => {
      if (item && item.symbol && item.lastFundingRate !== undefined) {
        const symbol = item.symbol.replace('USDT', '');
        const fundingRate = parseFloat(item.lastFundingRate || 0);
        
        // Store FR data directly (OI will be added if available)
        this.frOiData.set(symbol, {
          fundingRate: fundingRate,
          openInterest: 0,
          openInterestValue: 0
        });
      }
    });
    
    // Update with open interest data if available
    openInterests.forEach(item => {
      if (item && item.symbol) {
        const symbol = item.symbol.replace('USDT', '');
        const oi = parseFloat(item.openInterest || 0);
        const price = parseFloat(item.lastPrice || 0);
        
        const existingData = this.frOiData.get(symbol);
        if (existingData) {
          existingData.openInterest = oi;
          existingData.openInterestValue = oi * price;
        } else {
          // Create new entry if doesn't exist
          this.frOiData.set(symbol, {
            fundingRate: 0,
            openInterest: oi,
            openInterestValue: oi * price
          });
        }
      }
    });
  }

  private processTickerData(tickerArray: any[]) {
    // Get all USDT perpetual contracts (excluding dated futures, ALPACA and BNX)
    const usdtPerpPairs = tickerArray
      .filter(ticker => {
        // Check if it's a USDT pair and not a dated future
        if (!ticker.symbol.endsWith('USDT') || ticker.symbol.match(/\d{6}$/)) {
          return false;
        }
        // Exclude ALPACA and BNX
        const symbol = ticker.symbol.replace('USDT', '');
        if (symbol === 'ALPACA' || symbol === 'BNX') {
          return false;
        }
        return true;
      })
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));

    // Clear and process ALL symbols for FR/OI tracking
    this.allVolumeData.clear();
    
    // Process ALL symbols (not just those with FR/OI data)
    usdtPerpPairs.forEach((ticker, index) => {
      const symbol = ticker.symbol.replace('USDT', '');
      const frOiInfo = this.frOiData.get(symbol);
      
      // Store all symbols, not just those with FR/OI data
      const allDataItem: BinanceVolumeData = {
        symbol,
        volume: ticker.volume,
        quoteVolume: ticker.quoteVolume,
        priceChangePercent: ticker.priceChangePercent,
        lastPrice: ticker.lastPrice,
        rank: index + 1,
        exchange: 'binance' as const,
        fundingRate: frOiInfo?.fundingRate,
        openInterest: frOiInfo?.openInterest,
        openInterestValue: frOiInfo?.openInterestValue
      };
      this.allVolumeData.set(symbol, allDataItem);
    });
    
    // Process ALL pairs
    const currentTime = Date.now();
    
    const processedData = usdtPerpPairs.map((ticker, index) => {
      const symbol = ticker.symbol.replace('USDT', '');
      const currentRank = index + 1;
      const previousRank = this.previousRankings.get(symbol);
      const currentVolume = parseFloat(ticker.quoteVolume);
      const previousVolume = this.previousVolumes.get(symbol) || 0;
      
      // Calculate 5-minute volume increase
      const volumeIncrease5m = currentVolume - previousVolume;
      
      // Get FR/OI data for this symbol
      const frOiInfo = this.frOiData.get(symbol);
      
      const item: BinanceVolumeData = {
        symbol,
        volume: ticker.volume,
        quoteVolume: ticker.quoteVolume,
        priceChangePercent: ticker.priceChangePercent,
        lastPrice: ticker.lastPrice,
        rank: currentRank,
        previousRank,
        exchange: 'binance' as const,
        rankChanged: previousRank !== undefined && previousRank !== currentRank,
        volumeSpike: volumeIncrease5m >= 5000000, // 5M USD increase
        newRankIn: previousRank === undefined || (previousRank > 20 && currentRank <= 20),
        volumeIncrease5m,
        fundingRate: frOiInfo?.fundingRate,
        openInterest: frOiInfo?.openInterest,
        openInterestValue: frOiInfo?.openInterestValue
      };
      
      // Update tracking data
      this.previousRankings.set(symbol, currentRank);
      this.previousVolumes.set(symbol, currentVolume);
      
      return item;
    });

    // Keep only top 15 for display in volumeData
    const top15Display = processedData.slice(0, 15);
    
    // Update volume data map (for display)
    this.volumeData.clear();
    top15Display.forEach(item => {
      this.volumeData.set(item.symbol, item);
    });

    // Clean up old tracking data (remove symbols not in current list)
    const currentSymbols = new Set(usdtPerpPairs.map(t => t.symbol.replace('USDT', '')));
    for (const symbol of this.previousRankings.keys()) {
      if (!currentSymbols.has(symbol)) {
        this.previousRankings.delete(symbol);
        this.previousVolumes.delete(symbol);
      }
    }

    // Emit ALL processed data (not just top 15)
    this.emit('volumeUpdate', processedData);
    
    logger.info(`Binance futures volume data updated: ${processedData.length} pairs (displaying top 15)`);
  }

  public getVolumeData(): BinanceVolumeData[] {
    return Array.from(this.volumeData.values()).sort((a, b) => a.rank - b.rank);
  }
  
  // Get all symbols with FR/OI data
  public getAllVolumeData(): BinanceVolumeData[] {
    return Array.from(this.allVolumeData.values());
  }

  // Get FR/OI data for sharing with other services
  public getFrOiData(): Map<string, { fundingRate: number; openInterest: number; openInterestValue: number }> {
    return new Map(this.frOiData);
  }

  // Get funding rate for a specific symbol
  public getFundingRate(symbol: string): number | undefined {
    const data = this.frOiData.get(symbol);
    return data?.fundingRate;
  }

  public disconnect() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    // Disconnect OI service
    // Cleanup removed
    
  }
}

export default BinanceRestApiService;