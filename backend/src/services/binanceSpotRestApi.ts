import { EventEmitter } from 'events';
import axios from 'axios';
import { logger } from '../utils/logger';

interface SpotTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  quoteVolume: string;
  volume: string;
}

export interface SpotVolumeData {
  symbol: string;
  volume: string;
  quoteVolume: string;
  priceChangePercent: string;
  lastPrice: string;
  rank: number;
  previousRank?: number;
  rankChanged?: boolean;
  newRankIn?: boolean;
  volumeIncrease5m?: number;
  volumeSpike?: boolean;
}

export class BinanceSpotRestApiService extends EventEmitter {
  private volumeData: SpotVolumeData[] = [];
  private previousRankings: Map<string, number> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private isConnected = false;
  
  constructor() {
    super();
    logger.info('BinanceSpotRestApiService initialized');
  }
  
  public connect() {
    if (this.isConnected) {
      logger.warn('BinanceSpotRestApiService is already connected');
      return;
    }
    
    this.isConnected = true;
    this.startPeriodicFetch();
    logger.info('BinanceSpotRestApiService connected - starting periodic fetch');
  }
  
  private startPeriodicFetch() {
    // Initial fetch after 10 seconds
    setTimeout(() => {
      if (this.isConnected) {
        this.fetchVolumeData();
      }
    }, 10000);
    
    // Fetch every 5 minutes (aligned with other exchanges)
    this.updateInterval = setInterval(() => {
      this.fetchVolumeData();
    }, 5 * 60 * 1000); // 5 minutes
  }
  
  private async fetchVolumeData() {
    try {
      logger.info('Fetching Binance SPOT volume data via REST API...');
      
      const response = await axios.get('https://api.binance.com/api/v3/ticker/24hr');
      const tickers: SpotTicker[] = response.data;
      
      // Filter USDT pairs and sort by volume
      const usdtPairs = tickers
        .filter(t => t.symbol.endsWith('USDT'))
        .map((ticker, index) => ({
          symbol: ticker.symbol.replace('USDT', ''),
          volume: ticker.volume,
          quoteVolume: ticker.quoteVolume,
          priceChangePercent: ticker.priceChangePercent,
          lastPrice: ticker.lastPrice,
          rank: index + 1
        }))
        .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        // Process ALL pairs
        .map((item, index) => {
          const currentRank = index + 1;
          const previousRank = this.previousRankings.get(item.symbol);
          
          // Track rank changes
          const rankData: SpotVolumeData = {
            ...item,
            rank: currentRank,
            previousRank: previousRank,
            rankChanged: previousRank !== undefined && previousRank !== currentRank,
            newRankIn: currentRank <= 15 && (previousRank === undefined || previousRank > 15),
            volumeSpike: false,
            volumeIncrease5m: undefined
          };
          
          return rankData;
        })
        ; // Return all pairs
      
      // Update previous rankings for next comparison
      usdtPairs.forEach(item => {
        this.previousRankings.set(item.symbol, item.rank);
      });
      
      // Store all data for emission, but keep top 15 in volumeData for internal use
      const allPairs = usdtPairs;
      this.volumeData = usdtPairs.slice(0, 15); // Keep top 15 for internal reference
      
      // Emit ALL volume data
      this.emit('volumeData', allPairs);
      
      logger.info(`Binance SPOT volume data updated: ${allPairs.length} pairs`);
    } catch (error) {
      logger.error('Error fetching Binance SPOT volume data:', error);
    }
  }
  
  public getVolumeData(): SpotVolumeData[] {
    return this.volumeData;
  }
  
  public disconnect() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.isConnected = false;
    this.volumeData = [];
    
    logger.info('BinanceSpotRestApiService disconnected');
  }
}

export default BinanceSpotRestApiService;