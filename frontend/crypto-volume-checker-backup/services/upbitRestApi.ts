import axios from 'axios';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface UpbitVolumeData {
  symbol: string;
  volume: number;
  quoteVolume: number;
  priceChangePercent: number;
  lastPrice: number;
  rank: number;
  previousRank?: number;
  exchange: 'upbit';
  rankChanged?: boolean;
  volumeSpike?: boolean;
  newRankIn?: boolean;
  volumeIncrease5m?: number;
}

export class UpbitRestApiService extends EventEmitter {
  private volumeData: Map<string, UpbitVolumeData> = new Map();
  private previousRankings: Map<string, number> = new Map();
  private previousVolumes: Map<string, number> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private markets: string[] = [];

  constructor() {
    super();
    this.initializeMarkets();
  }

  private async initializeMarkets() {
    try {
      // Get KRW markets from Upbit
      const response = await axios.get('https://api.upbit.com/v1/market/all?isDetails=false');
      
      if (response.status === 200 && Array.isArray(response.data)) {
        this.markets = response.data
          .filter(market => market.market.startsWith('KRW-'))
          .map(market => market.market);
        
        logger.info(`Upbit markets initialized: ${this.markets.length} KRW pairs`);
        this.startPeriodicFetch();
      }
    } catch (error) {
      logger.error('Error initializing Upbit markets:', error);
    }
  }

  private startPeriodicFetch() {
    // Initial fetch
    this.fetchVolumeData();
    
    // Fetch every 5 minutes
    this.updateInterval = setInterval(() => {
      this.fetchVolumeData();
    }, 5 * 60 * 1000); // 5 minutes
  }

  private async fetchVolumeData() {
    try {
      logger.info('Fetching Upbit volume data via REST API...');
      
      if (this.markets.length === 0) {
        logger.warn('No Upbit markets available');
        return;
      }

      // Upbit ticker REST API (maximum 100 markets per request)
      const marketChunks = this.chunkArray(this.markets, 100);
      const allTickers: any[] = [];

      for (const chunk of marketChunks) {
        const response = await axios.get(`https://api.upbit.com/v1/ticker?markets=${chunk.join(',')}`);
        
        if (response.status === 200 && Array.isArray(response.data)) {
          allTickers.push(...response.data);
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.processTickerData(allTickers);
    } catch (error) {
      logger.error('Error fetching Upbit data:', error);
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private processTickerData(tickerArray: any[]) {
    // Process all tickers and sort by volume
    const allProcessed = tickerArray
      .map(ticker => ({
        symbol: ticker.market.replace('KRW-', ''),
        volume: ticker.acc_trade_volume_24h,
        quoteVolume: ticker.acc_trade_price_24h,
        priceChangePercent: ticker.signed_change_rate * 100,
        lastPrice: ticker.trade_price,
        rank: 0,
        exchange: 'upbit' as const
      }))
      .sort((a, b) => b.quoteVolume - a.quoteVolume);

    // Process top 30 to detect rank-ins from 21+
    const top30 = allProcessed.slice(0, 30);
    const currentTime = Date.now();
    
    const processedWithMarks = top30.map((ticker, index) => {
      const symbol = ticker.symbol;
      const currentRank = index + 1;
      const previousRank = this.previousRankings.get(symbol);
      const currentVolume = ticker.quoteVolume;
      const previousVolume = this.previousVolumes.get(symbol) || 0;
      
      // Calculate 5-minute volume increase (convert KRW to USD: 1 USD ≈ 1300 KRW)
      const volumeIncrease5m = (currentVolume - previousVolume) * 0.00077; // Convert to USD
      
      const item: UpbitVolumeData = {
        ...ticker,
        rank: currentRank,
        previousRank,
        rankChanged: previousRank !== undefined && previousRank !== currentRank,
        volumeSpike: volumeIncrease5m >= 5000000, // 5M USD equivalent increase
        newRankIn: previousRank === undefined || (previousRank > 20 && currentRank <= 20),
        volumeIncrease5m
      };
      
      // Update tracking data
      this.previousRankings.set(symbol, currentRank);
      this.previousVolumes.set(symbol, currentVolume);
      
      return item;
    });

    // Keep only top 20 for display
    const top20 = processedWithMarks.slice(0, 20);
    
    // Update volume data map
    this.volumeData.clear();
    top20.forEach(item => {
      this.volumeData.set(item.symbol, item);
    });

    // Clean up old tracking data (remove symbols not in top 30)
    const currentSymbols = new Set(top30.map(t => t.symbol));
    for (const symbol of this.previousRankings.keys()) {
      if (!currentSymbols.has(symbol)) {
        this.previousRankings.delete(symbol);
        this.previousVolumes.delete(symbol);
      }
    }

    // Emit updated data
    this.emit('volumeUpdate', top20);
    
    logger.info(`Upbit volume data updated: ${top20.length} pairs`);
  }

  public getVolumeData(): UpbitVolumeData[] {
    return Array.from(this.volumeData.values()).sort((a, b) => a.rank - b.rank);
  }

  public disconnect() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

export default UpbitRestApiService;