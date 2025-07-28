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
}

export class BinanceRestApiService extends EventEmitter {
  private volumeData: Map<string, BinanceVolumeData> = new Map();
  private previousRankings: Map<string, number> = new Map();
  private previousVolumes: Map<string, number> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

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
    try {
      logger.info('Fetching Binance futures (PERP) volume data via REST API...');
      
      // Binance Futures 24hr ticker REST API for perpetual contracts
      const response = await axios.get('https://fapi.binance.com/fapi/v1/ticker/24hr');
      
      if (response.status === 200 && Array.isArray(response.data)) {
        this.processTickerData(response.data);
      } else {
        logger.error('Invalid response from Binance Futures API:', response.status);
      }
    } catch (error) {
      logger.error('Error fetching Binance futures data:', error);
    }
  }

  private processTickerData(tickerArray: any[]) {
    // Get all USDT perpetual contracts (excluding dated futures)
    const usdtPerpPairs = tickerArray
      .filter(ticker => ticker.symbol.endsWith('USDT') && !ticker.symbol.match(/\d{6}$/))
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));

    // Process top 30 to detect rank-ins from 21+
    const top30 = usdtPerpPairs.slice(0, 30);
    const currentTime = Date.now();
    
    const processedData = top30.map((ticker, index) => {
      const symbol = ticker.symbol.replace('USDT', '');
      const currentRank = index + 1;
      const previousRank = this.previousRankings.get(symbol);
      const currentVolume = parseFloat(ticker.quoteVolume);
      const previousVolume = this.previousVolumes.get(symbol) || 0;
      
      // Calculate 5-minute volume increase
      const volumeIncrease5m = currentVolume - previousVolume;
      
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
        volumeIncrease5m
      };
      
      // Update tracking data
      this.previousRankings.set(symbol, currentRank);
      this.previousVolumes.set(symbol, currentVolume);
      
      return item;
    });

    // Keep only top 20 for display
    const top20 = processedData.slice(0, 20);
    
    // Update volume data map
    this.volumeData.clear();
    top20.forEach(item => {
      this.volumeData.set(item.symbol, item);
    });

    // Clean up old tracking data (remove symbols not in top 30)
    const currentSymbols = new Set(top30.map(t => t.symbol.replace('USDT', '')));
    for (const symbol of this.previousRankings.keys()) {
      if (!currentSymbols.has(symbol)) {
        this.previousRankings.delete(symbol);
        this.previousVolumes.delete(symbol);
      }
    }

    // Emit updated data
    this.emit('volumeUpdate', top20);
    
    logger.info(`Binance futures volume data updated: ${top20.length} pairs`);
  }

  public getVolumeData(): BinanceVolumeData[] {
    return Array.from(this.volumeData.values()).sort((a, b) => a.rank - b.rank);
  }

  public disconnect() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

export default BinanceRestApiService;