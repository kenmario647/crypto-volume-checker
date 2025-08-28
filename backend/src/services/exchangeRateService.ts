import axios from 'axios';
import { logger } from '../utils/logger';

export class ExchangeRateService {
  private static instance: ExchangeRateService;
  private krwToUsdRate: number = 0.00071; // Default fallback rate (1 USD = 1400 KRW)
  private lastUpdateTime: number = 0;
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  private constructor() {
    this.startPeriodicUpdate();
  }

  public static getInstance(): ExchangeRateService {
    if (!ExchangeRateService.instance) {
      ExchangeRateService.instance = new ExchangeRateService();
    }
    return ExchangeRateService.instance;
  }

  private startPeriodicUpdate() {
    // Initial fetch
    this.updateExchangeRate();
    
    // Update every 5 minutes
    this.updateInterval = setInterval(() => {
      this.updateExchangeRate();
    }, this.CACHE_DURATION);
  }

  private async updateExchangeRate(): Promise<void> {
    try {
      // Try to get rates from both Upbit and Bithumb for better accuracy
      const rates: number[] = [];
      
      // Try Upbit USDT/KRW
      try {
        const upbitResponse = await axios.get('https://api.upbit.com/v1/ticker?markets=KRW-USDT', {
          timeout: 5000
        });
        
        if (upbitResponse.data && upbitResponse.data[0] && upbitResponse.data[0].trade_price) {
          rates.push(upbitResponse.data[0].trade_price);
          logger.info(`Upbit USDT/KRW: ${upbitResponse.data[0].trade_price}`);
        }
      } catch (err) {
        logger.warn('Failed to get Upbit exchange rate:', err);
      }
      
      // Try Bithumb USDT/KRW as fallback or for averaging
      try {
        const bithumbResponse = await axios.get('https://api.bithumb.com/public/ticker/USDT_KRW', {
          timeout: 5000
        });
        
        if (bithumbResponse.data && bithumbResponse.data.status === '0000' && bithumbResponse.data.data) {
          const bithumbPrice = parseFloat(bithumbResponse.data.data.closing_price);
          rates.push(bithumbPrice);
          logger.info(`Bithumb USDT/KRW: ${bithumbPrice}`);
        }
      } catch (err) {
        logger.warn('Failed to get Bithumb exchange rate:', err);
      }
      
      if (rates.length > 0) {
        // Use average if we have multiple rates, otherwise use the single rate
        const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
        this.krwToUsdRate = 1 / avgRate;
        this.lastUpdateTime = Date.now();
        
        logger.info(`Exchange rate updated (${rates.length} source${rates.length > 1 ? 's' : ''}): 1 USD = ${avgRate.toFixed(2)} KRW, 1 KRW = ${this.krwToUsdRate.toFixed(6)} USD`);
      } else {
        throw new Error('No exchange rate sources available');
      }
    } catch (error) {
      logger.error('Failed to update KRW/USD exchange rate, using fallback:', error);
      // Keep using the last successful rate or default
    }
  }

  /**
   * Get current KRW to USD conversion rate
   * @returns The conversion rate (1 KRW = X USD)
   */
  public getKrwToUsdRate(): number {
    // If data is stale (older than 30 minutes), try to update
    if (Date.now() - this.lastUpdateTime > 30 * 60 * 1000) {
      this.updateExchangeRate().catch(err => 
        logger.error('Failed to refresh stale exchange rate:', err)
      );
    }
    return this.krwToUsdRate;
  }

  /**
   * Convert KRW amount to USD
   * @param krwAmount Amount in KRW
   * @returns Amount in USD
   */
  public convertKrwToUsd(krwAmount: number): number {
    return krwAmount * this.krwToUsdRate;
  }

  /**
   * Convert USD amount to KRW
   * @param usdAmount Amount in USD
   * @returns Amount in KRW
   */
  public convertUsdToKrw(usdAmount: number): number {
    return usdAmount / this.krwToUsdRate;
  }

  /**
   * Get exchange rate info
   */
  public getExchangeRateInfo() {
    return {
      krwToUsd: this.krwToUsdRate,
      usdToKrw: 1 / this.krwToUsdRate,
      lastUpdate: new Date(this.lastUpdateTime).toISOString(),
      isStale: Date.now() - this.lastUpdateTime > 30 * 60 * 1000
    };
  }

  /**
   * Force update exchange rate
   */
  public async forceUpdate(): Promise<void> {
    await this.updateExchangeRate();
  }

  /**
   * Cleanup
   */
  public stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

export default ExchangeRateService;