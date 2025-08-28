import { logger } from '../utils/logger';

export interface StartupPrice {
  symbol: string;
  exchange: string;
  initialPrice: number;
  initialTime: number;
}

export class StartupPriceTracker {
  private static instance: StartupPriceTracker;
  private startupPrices: Map<string, StartupPrice> = new Map();
  private startupTime: number;

  private constructor() {
    this.startupTime = Date.now();
    logger.info(`StartupPriceTracker initialized at ${new Date(this.startupTime).toISOString()}`);
  }

  public static getInstance(): StartupPriceTracker {
    if (!StartupPriceTracker.instance) {
      StartupPriceTracker.instance = new StartupPriceTracker();
    }
    return StartupPriceTracker.instance;
  }

  /**
   * Store initial price for a symbol on an exchange
   */
  public setInitialPrice(exchange: string, symbol: string, price: number) {
    const key = `${exchange}:${symbol}`;
    
    // Only set if not already set (preserve the first price)
    if (!this.startupPrices.has(key)) {
      this.startupPrices.set(key, {
        symbol,
        exchange,
        initialPrice: price,
        initialTime: Date.now()
      });
      logger.debug(`Stored initial price for ${key}: $${price}`);
    }
  }

  /**
   * Calculate percentage change from startup
   */
  public calculateChangeFromStartup(exchange: string, symbol: string, currentPrice: number): number {
    const key = `${exchange}:${symbol}`;
    const startupData = this.startupPrices.get(key);
    
    if (!startupData || startupData.initialPrice === 0) {
      return 0; // No startup data or invalid price
    }

    const change = ((currentPrice - startupData.initialPrice) / startupData.initialPrice) * 100;
    return parseFloat(change.toFixed(2));
  }

  /**
   * Get time since startup in readable format
   */
  public getTimeSinceStartup(): string {
    const now = Date.now();
    const diffMs = now - this.startupTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    }
    return `${diffMins}m`;
  }

  /**
   * Get startup time
   */
  public getStartupTime(): number {
    return this.startupTime;
  }

  /**
   * Clear all stored prices (for reset)
   */
  public reset() {
    this.startupPrices.clear();
    this.startupTime = Date.now();
    logger.info('StartupPriceTracker reset');
  }
}