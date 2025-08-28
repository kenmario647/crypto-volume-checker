import { BybitClient, OrderBookData } from './bybitClient';
import { CrossEvent } from './crossDetectionService';
import { logger } from '../utils/logger';

export interface PriceOptions {
  conservative: number;  // 保守的（MA8近辺）
  moderate: number;      // 中庸（Best Bid近辺）
  aggressive: number;    // 積極的（現在価格近辺）
}

export interface ExecutionProbability {
  conservative: number;  // 約定確率
  moderate: number;
  aggressive: number;
}

export interface LimitPriceRecommendation {
  symbol: string;
  currentPrice: number;
  ma8Price: number;
  orderBook: OrderBookData;
  priceOptions: PriceOptions;
  executionProbability: ExecutionProbability;
  recommendedPrice: number;
  strategy: string;
}

export class LimitPriceCalculator {
  private bybitClient: BybitClient;

  constructor() {
    this.bybitClient = BybitClient.getInstance();
  }
  
  // 推奨指値価格を計算
  async calculateRecommendedLimitPrice(
    symbol: string,
    crossEvent: CrossEvent,
    strategy: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
  ): Promise<LimitPriceRecommendation> {
    
    logger.info(`📊 Calculating limit price for ${symbol} with ${strategy} strategy`);
    
    try {
      // 1. 現在の板情報取得
      const orderBook = await this.bybitClient.getOrderBook(symbol);
      const currentPrice = await this.bybitClient.getCurrentPrice(symbol);
      
      // 2. MA8価格（サポートライン想定）
      const ma5Price = crossEvent.ma5Value;
      
      // 3. 戦略別価格計算
      const priceOptions = this.calculatePriceOptions(
        currentPrice, 
        ma5Price, 
        orderBook, 
        strategy
      );
      
      // 4. 約定可能性評価
      const executionProbability = this.estimateExecutionProbability(
        priceOptions,
        orderBook,
        crossEvent
      );
      
      const recommendation: LimitPriceRecommendation = {
        symbol,
        currentPrice,
        ma8Price: ma5Price,
        orderBook,
        priceOptions,
        executionProbability,
        recommendedPrice: priceOptions.moderate, // デフォルト推奨
        strategy: strategy
      };

      logger.info(`✅ Limit price calculated for ${symbol}:`, {
        conservative: priceOptions.conservative,
        moderate: priceOptions.moderate,
        aggressive: priceOptions.aggressive,
        currentPrice: currentPrice
      });

      return recommendation;
    } catch (error) {
      logger.error(`Failed to calculate limit price for ${symbol}:`, error);
      throw error;
    }
  }
  
  private calculatePriceOptions(
    currentPrice: number,
    ma8Price: number,
    orderBook: OrderBookData,
    strategy: string
  ): PriceOptions {
    
    const spread = orderBook.spread;
    const bestBid = orderBook.bestBid;
    
    // 保守的: MA8価格近辺（下落待ち）
    const conservative = Math.min(ma8Price, currentPrice * 0.998); // 現在価格-0.2%orMA8の低い方
    
    // 中庸: 現在のbest bid近辺
    const moderate = Math.max(bestBid, currentPrice * 0.9995); // 現在価格-0.05%
    
    // 積極的: 現在価格近辺（すぐ約定狙い）
    const aggressive = currentPrice * 1.0001; // 現在価格+0.01%
    
    const options: PriceOptions = {
      conservative: this.roundPrice(conservative),
      moderate: this.roundPrice(moderate),
      aggressive: this.roundPrice(aggressive)
    };

    logger.info(`💡 Price options calculated:`, options);
    return options;
  }
  
  private estimateExecutionProbability(
    priceOptions: PriceOptions,
    orderBook: OrderBookData,
    crossEvent: CrossEvent
  ): ExecutionProbability {
    
    // ゴールデンクロス強度から上昇期待を計算
    const crossStrength = (crossEvent.ma2Value - crossEvent.ma5Value) / crossEvent.ma5Value;
    const upwardMomentum = Math.min(0.8, crossStrength * 100); // 最大80%
    
    const probability: ExecutionProbability = {
      conservative: Math.min(0.9, 0.7 + upwardMomentum), // 70-90%
      moderate: Math.min(0.8, 0.5 + upwardMomentum),     // 50-80%
      aggressive: Math.min(0.95, 0.8 + upwardMomentum)   // 80-95%
    };

    logger.info(`🎯 Execution probability estimated:`, probability);
    return probability;
  }
  
  private roundPrice(price: number): number {
    // 0.01単位で丸める（USDTペア用）
    return Math.round(price * 100) / 100;
  }
}

export default LimitPriceCalculator;