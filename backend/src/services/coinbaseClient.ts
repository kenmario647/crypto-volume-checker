import axios from 'axios';
import { logger } from '../utils/logger';

interface CoinbaseTicker {
  product_id: string;
  price: string;
  price_percentage_change_24h: string;
  volume_24h: string;
  volume_percentage_change_24h: string;
  base_increment: string;
  quote_increment: string;
  quote_min_size: string;
  quote_max_size: string;
  base_min_size: string;
  base_max_size: string;
  name: string;
  post_only: boolean;
  limit_only: boolean;
  cancel_only: boolean;
  status: string;
  status_message: string;
  auction_mode: boolean;
}

interface CoinbaseVolumeData {
  symbol: string;
  volume: number;
  change24h: number;
  price: number;
}

export class CoinbaseClient {
  private static instance: CoinbaseClient;
  private baseURL: string = 'https://api.exchange.coinbase.com';

  private constructor() {
    logger.info('CoinbaseClient initialized');
  }

  public static getInstance(): CoinbaseClient {
    if (!CoinbaseClient.instance) {
      CoinbaseClient.instance = new CoinbaseClient();
    }
    return CoinbaseClient.instance;
  }

  async fetchAllTickers(): Promise<any[]> {
    try {
      const productsResponse = await axios.get(`${this.baseURL}/products`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      if (!productsResponse.data || !Array.isArray(productsResponse.data)) {
        return [];
      }

      const usdPairs = productsResponse.data.filter((p: any) => 
        p.quote_currency === 'USD' && 
        p.status === 'online' &&
        !p.trading_disabled
      );

      const tickers: any[] = [];
      const batchSize = 15;
      
      for (let i = 0; i < usdPairs.length; i += batchSize) {
        const batch = usdPairs.slice(i, i + batchSize);
        const tickerPromises = batch.map(async (product: any) => {
          try {
            const ticker = await axios.get(`${this.baseURL}/products/${product.id}/ticker`, {
              timeout: 1000,
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0'
              }
            });
            
            if (ticker.data && ticker.data.volume && ticker.data.price) {
              return {
                product_id: product.id,
                symbol: product.base_currency,
                price: ticker.data.price,
                volume: ticker.data.volume,
                price_percent_change_24h: '0' // Not available in this endpoint
              };
            }
          } catch (err) {
            // Silently skip failed tickers
          }
          return null;
        });

        const results = await Promise.allSettled(tickerPromises);
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            tickers.push(result.value);
          }
        }
        
        if (i + batchSize < usdPairs.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return tickers;
    } catch (error) {
      logger.error('Error fetching Coinbase tickers:', error);
      return [];
    }
  }

  async getTopVolumeCoins(limit: number = 15): Promise<CoinbaseVolumeData[]> {
    try {
      // First get list of products
      const productsResponse = await axios.get(`${this.baseURL}/products`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      if (!productsResponse.data || !Array.isArray(productsResponse.data)) {
        logger.error('Invalid response from Coinbase products API');
        return [];
      }

      // Filter USD pairs
      const usdPairs = productsResponse.data.filter((p: any) => 
        p.quote_currency === 'USD' && 
        p.status === 'online' &&
        !p.trading_disabled
      );

      logger.info(`Found ${usdPairs.length} USD pairs on Coinbase`);

      // Check all pairs like other exchanges (MEXC, Bithumb check all)
      const pairsToCheck = usdPairs;
      logger.info(`Checking all ${pairsToCheck.length} USD pairs on Coinbase`);

      // Process in smaller batches to avoid rate limiting
      const batchSize = 10; // Reduced from 15 to 10 for better reliability
      const usdVolumes: CoinbaseVolumeData[] = [];
      let failedCount = 0;
      let successCount = 0;
      
      for (let i = 0; i < pairsToCheck.length; i += batchSize) {
        const batch = pairsToCheck.slice(i, i + batchSize);
        const tickerPromises = batch.map(async (product: any) => {
          // Retry logic for each ticker
          let retries = 2; // Allow 1 retry
          while (retries > 0) {
            try {
              const ticker = await axios.get(`${this.baseURL}/products/${product.id}/ticker`, {
                timeout: 2000, // Increased from 1000ms to 2000ms
                headers: {
                  'Accept': 'application/json',
                  'User-Agent': 'Mozilla/5.0'
                }
              });
              
              if (ticker.data && ticker.data.volume && ticker.data.price) {
                const volumeUSD = parseFloat(ticker.data.volume) * parseFloat(ticker.data.price);
                if (volumeUSD > 0) {
                  // Debug log for high volume coins
                  if (volumeUSD > 100000000) {
                    logger.info(`High volume coin: ${product.base_currency} - $${(volumeUSD/1e6).toFixed(2)}M`);
                  }
                  successCount++;
                  return {
                    symbol: product.base_currency,
                    volume: volumeUSD,
                    change24h: 0, // Price change not available in ticker endpoint
                    price: parseFloat(ticker.data.price)
                  };
                }
              }
              break; // If we get here without error, break retry loop
            } catch (err: any) {
              retries--;
              if (retries === 0) {
                failedCount++;
                // Log ALL failures with volume estimate if available
                const errorType = err.code || err.response?.status || 'UNKNOWN';
                logger.warn(`Failed to fetch ${product.base_currency} ticker after retries: ${errorType} - ${err.message}`);
              } else {
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
          }
          return null;
        });

        const results = await Promise.allSettled(tickerPromises);
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            usdVolumes.push(result.value);
          }
        }
        
        // Log progress every 60 pairs or at the end
        if ((i + batchSize) % 60 === 0 || i + batchSize >= pairsToCheck.length) {
          const processed = Math.min(i + batchSize, pairsToCheck.length);
          logger.info(`Processed ${processed}/${pairsToCheck.length} Coinbase pairs (Success: ${successCount}, Failed: ${failedCount})`);
        }
        
        // Add delay between batches to avoid rate limiting (except for last batch)
        if (i + batchSize < pairsToCheck.length) {
          await new Promise(resolve => setTimeout(resolve, 150)); // Increased from 100ms to 150ms
        }
      }

      // Log final statistics
      const failureRate = failedCount > 0 ? ((failedCount / (successCount + failedCount)) * 100).toFixed(1) : '0';
      logger.info(`Coinbase fetch complete - Success: ${successCount}, Failed: ${failedCount} (${failureRate}% failure rate)`);
      
      // Sort by volume and return all fetched data (not limited)
      usdVolumes.sort((a, b) => b.volume - a.volume);
      
      // Log top 5 for verification
      const top5 = usdVolumes.slice(0, 5);
      top5.forEach((coin, idx) => {
        logger.info(`  ${idx + 1}. ${coin.symbol}: $${(coin.volume/1e6).toFixed(1)}M`);
      });
      
      logger.info(`Returning ${usdVolumes.length} Coinbase pairs (all volumes)`);
      return usdVolumes; // Return ALL data, not just top N
    } catch (error: any) {
      // Fallback to v2 API if v3 fails
      try {
        logger.info('Trying Coinbase v2 API fallback');
        const response = await axios.get('https://api.coinbase.com/v2/exchange-rates', {
          params: { currency: 'USD' },
          timeout: 3000
        });

        // For v2 API, we can only get exchange rates, not volume
        // So we'll use a simpler approach with major pairs
        const majorPairs = ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC', 'LINK', 'UNI', 'AAVE', 'DOT', 'ADA'];
        const rates = response.data.data.rates;
        
        const pairs: CoinbaseVolumeData[] = majorPairs
          .filter(symbol => rates[symbol])
          .map(symbol => ({
            symbol,
            volume: 0, // Volume not available in v2 API
            change24h: 0,
            price: 1 / parseFloat(rates[symbol]) // Convert rate to price
          }));

        logger.info(`Fetched ${pairs.length} Coinbase pairs from v2 API (no volume data)`);
        return pairs.slice(0, limit);
      } catch (fallbackError: any) {
        logger.error('Error fetching Coinbase data from both v3 and v2 APIs:', fallbackError.message || fallbackError);
        return [];
      }
    }
  }

  async getOrderBook(symbol: string): Promise<any> {
    try {
      const productId = `${symbol}-USD`;
      const response = await axios.get(`${this.baseURL}/products/${productId}/book`, {
        params: { level: 2 },
        timeout: 10000
      });

      return {
        bids: response.data.bids.slice(0, 30).map((bid: any) => ({
          price: parseFloat(bid[0]),
          quantity: parseFloat(bid[1])
        })),
        asks: response.data.asks.slice(0, 30).map((ask: any) => ({
          price: parseFloat(ask[0]),
          quantity: parseFloat(ask[1])
        }))
      };
    } catch (error) {
      logger.error(`Error fetching Coinbase orderbook for ${symbol}:`, error);
      return null;
    }
  }

  async getRecentTrades(symbol: string): Promise<any[]> {
    try {
      const productId = `${symbol}-USD`;
      const response = await axios.get(`${this.baseURL}/products/${productId}/trades`, {
        params: { limit: 100 },
        timeout: 10000
      });

      return response.data.map((trade: any) => ({
        price: parseFloat(trade.price),
        quantity: parseFloat(trade.size),
        timestamp: new Date(trade.time).getTime(),
        type: trade.side
      }));
    } catch (error) {
      logger.error(`Error fetching Coinbase trades for ${symbol}:`, error);
      return [];
    }
  }
}

export default CoinbaseClient;