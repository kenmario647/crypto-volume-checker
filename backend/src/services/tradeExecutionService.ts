import { BybitClient, OrderStatus } from './bybitClient';
import { LimitTradeRecommendation } from './tradeRecommendationService';
import { logger } from '../utils/logger';

export interface LimitTradeResult {
  success: boolean;
  orderId?: string;
  symbol: string;
  side?: 'LONG';
  orderType?: 'LIMIT';
  quantity?: number;
  limitPrice?: number;
  status?: string;
  estimatedCost?: number;
  timestamp?: number;
  recommendationId: string;
  error?: string;
}

export interface ActiveOrder {
  orderId: string;
  symbol: string;
  side: string;
  orderType: string;
  quantity: number;
  limitPrice: number;
  status: string;
  recommendationId: string;
  createdAt: number;
  lastChecked: number;
}

export class TradeExecutionService {
  private bybitClient: BybitClient;
  private activeOrders: Map<string, ActiveOrder> = new Map();
  private io: any; // WebSocket instance

  constructor(io?: any) {
    this.bybitClient = BybitClient.getInstance();
    this.io = io;
    // 注文監視は削除
    
    logger.info('TradeExecutionService initialized');
  }

  setIO(io: any) {
    this.io = io;
  }

  async executeLimitLongPosition(
    recommendation: LimitTradeRecommendation,
    userSelectedPrice?: number
  ): Promise<LimitTradeResult> {
    
    try {
      const finalPrice = userSelectedPrice || recommendation.recommendation.defaultPrice;
      
      logger.info(`🚀 Executing LIMIT LONG position for ${recommendation.symbol} @ $${finalPrice}`);
      
      // 最終残高チェック
      const balance = await this.bybitClient.getBalance();
      const requiredAmount = recommendation.recommendation.quantity * finalPrice;
      
      if (balance.availableBalance < requiredAmount) {
        throw new Error(`Insufficient balance: $${balance.availableBalance} < $${requiredAmount}`);
      }
      
      // 1. 指値注文発注
      const order = await this.bybitClient.createLimitLongPosition(
        recommendation.symbol,
        recommendation.recommendation.quantity,
        finalPrice
      );
      
      // 2. 注文監視に追加
      this.activeOrders.set(order.orderId, {
        orderId: order.orderId,
        symbol: recommendation.symbol,
        side: 'LONG',
        orderType: 'LIMIT',
        quantity: recommendation.recommendation.quantity,
        limitPrice: finalPrice,
        status: 'NEW',
        recommendationId: recommendation.id,
        createdAt: Date.now(),
        lastChecked: Date.now()
      });
      
      const result: LimitTradeResult = {
        success: true,
        orderId: order.orderId,
        symbol: recommendation.symbol,
        side: 'LONG',
        orderType: 'LIMIT',
        quantity: recommendation.recommendation.quantity,
        limitPrice: finalPrice,
        status: 'PENDING',
        estimatedCost: recommendation.recommendation.estimatedCost,
        timestamp: Date.now(),
        recommendationId: recommendation.id
      };
      
      logger.info(`✅ LIMIT LONG order placed successfully:`, {
        orderId: result.orderId,
        symbol: result.symbol,
        quantity: result.quantity,
        limitPrice: result.limitPrice
      });

      // WebSocket通知
      if (this.io) {
        this.io.emit('orderPlaced', {
          type: 'limit_order_placed',
          data: result
        });
      }

      return result;
      
    } catch (error) {
      logger.error(`❌ Failed to execute LIMIT LONG position for ${recommendation.symbol}:`, error);
      
      const errorResult: LimitTradeResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        symbol: recommendation.symbol,
        recommendationId: recommendation.id
      };

      // エラー通知
      if (this.io) {
        this.io.emit('orderError', {
          type: 'order_execution_failed',
          data: errorResult
        });
      }

      return errorResult;
    }
  }

  // 注文監視ループ（削除済み）

  // 注文監視機能は削除済み

  // 注文キャンセル
  async cancelLimitOrder(orderId: string): Promise<boolean> {
    const activeOrder = this.activeOrders.get(orderId);
    if (!activeOrder) {
      throw new Error('Order not found in active orders');
    }
    
    logger.info(`🗑️ Cancelling order: ${orderId}`);
    
    const success = await this.bybitClient.cancelOrder(orderId, activeOrder.symbol);
    
    if (success) {
      this.activeOrders.delete(orderId);
      
      // キャンセル通知
      if (this.io) {
        this.io.emit('orderCancelled', {
          type: 'order_cancelled_by_user',
          orderId: orderId,
          symbol: activeOrder.symbol,
          message: `🗑️ 注文をキャンセルしました: ${activeOrder.symbol}`,
          timestamp: Date.now()
        });
      }
      
      logger.info(`✅ Order cancelled successfully: ${orderId}`);
    }
    
    return success;
  }

  // アクティブ注文一覧取得
  getActiveOrders(): ActiveOrder[] {
    return Array.from(this.activeOrders.values());
  }

  // 特定シンボルのアクティブ注文取得
  getActiveOrdersBySymbol(symbol: string): ActiveOrder[] {
    return Array.from(this.activeOrders.values()).filter(order => order.symbol === symbol);
  }
}

export default TradeExecutionService;