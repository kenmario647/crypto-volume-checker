import { BybitClient } from './bybitClient';
import { LimitPriceCalculator, LimitPriceRecommendation } from './limitPriceCalculator';
import { CrossEvent } from './crossDetectionService';
import { logger } from '../utils/logger';

export interface PriceOption {
  price: number;
  probability: number;
  description: string;
}

export interface LimitTradeRecommendation {
  id: string;
  symbol: string;
  side: 'LONG';
  orderType: 'LIMIT';
  triggerEvent: CrossEvent;
  limitPriceData: LimitPriceRecommendation;
  recommendation: {
    quantity: number;
    estimatedCost: number;
    priceOptions: {
      conservative: PriceOption;
      moderate: PriceOption;
      aggressive: PriceOption;
    };
    defaultPrice: number;
    stopLoss: number;
    takeProfit: number;
    confidence: number;
  };
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'executed' | 'partially_filled';
}

export class TradeRecommendationService {
  private bybitClient: BybitClient;
  private limitPriceCalculator: LimitPriceCalculator;

  constructor() {
    this.bybitClient = BybitClient.getInstance();
    this.limitPriceCalculator = new LimitPriceCalculator();
  }

  async generateLimitLongRecommendation(crossEvent: CrossEvent): Promise<LimitTradeRecommendation> {
    const symbol = this.convertToBybitSymbol(crossEvent.symbol);
    
    logger.info(`🚀 Generating LIMIT LONG recommendation for ${symbol}`);
    
    try {
      // 1. 指値価格計算
      const limitPriceData = await this.limitPriceCalculator.calculateRecommendedLimitPrice(
        symbol, 
        crossEvent, 
        'moderate'
      );
      
      // 2. 残高確認
      const balance = await this.bybitClient.getBalance();
      
      // 3. ポジションサイズ計算
      const positionSizePercent = parseFloat(process.env.POSITION_SIZE_PERCENT || '1.0'); // デフォルト1%
      const usdAmount = balance.availableBalance * (positionSizePercent / 100);
      const quantity = this.calculateQuantity(usdAmount, limitPriceData.recommendedPrice);
      
      // 最小取引量チェック
      if (usdAmount < parseFloat(process.env.MIN_TRADE_BALANCE || '10')) {
        throw new Error(`Insufficient balance: $${usdAmount} < minimum $${process.env.MIN_TRADE_BALANCE || '10'}`);
      }

      const recommendation: LimitTradeRecommendation = {
        id: `rec_${Date.now()}`,
        symbol: symbol,
        side: 'LONG',
        orderType: 'LIMIT',
        triggerEvent: crossEvent,
        limitPriceData: limitPriceData,
        recommendation: {
          quantity: quantity,
          estimatedCost: usdAmount,
          // 3つの価格オプション
          priceOptions: {
            conservative: {
              price: limitPriceData.priceOptions.conservative,
              probability: limitPriceData.executionProbability.conservative,
              description: 'MA8近辺での指値（約定まで時間がかかる可能性）'
            },
            moderate: {
              price: limitPriceData.priceOptions.moderate,
              probability: limitPriceData.executionProbability.moderate,
              description: 'Best Bid近辺での指値（バランス型）'
            },
            aggressive: {
              price: limitPriceData.priceOptions.aggressive,
              probability: limitPriceData.executionProbability.aggressive,
              description: '現在価格近辺での指値（すぐ約定狙い）'
            }
          },
          defaultPrice: limitPriceData.recommendedPrice, // moderate価格
          stopLoss: 0,  // ストップロス無効
          takeProfit: 0, // テイクプロフィット無効
          confidence: this.calculateConfidence(crossEvent)
        },
        createdAt: Date.now(),
        expiresAt: Date.now() + (10 * 60 * 1000), // 指値は10分間有効
        status: 'pending'
      };
      
      logger.info(`✅ LIMIT LONG recommendation generated for ${symbol}:`, {
        quantity: recommendation.recommendation.quantity,
        estimatedCost: recommendation.recommendation.estimatedCost,
        defaultPrice: recommendation.recommendation.defaultPrice,
        confidence: recommendation.recommendation.confidence
      });

      return recommendation;
      
    } catch (error) {
      logger.error(`Failed to generate limit recommendation for ${symbol}:`, error);
      throw error;
    }
  }

  private convertToBybitSymbol(symbol: string): string {
    // クロス検知のシンボルをBybitシンボルに変換
    const symbolMap: { [key: string]: string } = {
      'ETH': 'ETHUSDT',
      'BTC': 'BTCUSDT',
      'SOL': 'SOLUSDT',
      'XRP': 'XRPUSDT',
      'ADA': 'ADAUSDT',
      'DOGE': 'DOGEUSDT',
      'ALPACA': 'ALPACAUSDT'
    };
    
    const convertedSymbol = symbolMap[symbol] || `${symbol}USDT`;
    logger.info(`🔄 Symbol converted: ${symbol} → ${convertedSymbol}`);
    return convertedSymbol;
  }

  private calculateQuantity(usdAmount: number, price: number): number {
    const quantity = usdAmount / price;
    const roundedQuantity = Math.floor(quantity * 1000) / 1000; // 小数点3位で切り捨て
    
    logger.info(`🧮 Quantity calculated: $${usdAmount} / $${price} = ${roundedQuantity}`);
    return roundedQuantity;
  }

  private calculateConfidence(crossEvent: CrossEvent): number {
    // シンプルな信頼度計算
    const ma3 = crossEvent.ma3Value;
    const ma8 = crossEvent.ma8Value;
    const crossStrength = ((ma3 - ma8) / ma8) * 100;
    
    // クロス強度が大きいほど信頼度高
    const confidence = Math.min(95, 50 + (crossStrength * 10));
    const finalConfidence = Math.max(60, confidence); // 最低60%
    
    logger.info(`🎯 Confidence calculated: ${finalConfidence}% (cross strength: ${crossStrength.toFixed(4)}%)`);
    return Math.round(finalConfidence);
  }
}

export default TradeRecommendationService;