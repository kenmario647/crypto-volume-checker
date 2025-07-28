import express from 'express';
import TradeExecutionService from '../services/tradeExecutionService';
import { LimitTradeRecommendation } from '../services/tradeRecommendationService';
import { logger } from '../utils/logger';

const router = express.Router();

// 推奨一時保存用（本来はデータベースで管理）
const pendingRecommendations = new Map<string, LimitTradeRecommendation>();

// TradeExecutionService インスタンス
let tradeExecutionService: TradeExecutionService;

// 初期化関数
export function initializeTradeRoutes(io: any): express.Router {
  tradeExecutionService = new TradeExecutionService(io);
  
  // WebSocket経由で推奨を受信して保存
  io.on('connection', (socket: any) => {
    socket.on('storeRecommendation', (recommendation: LimitTradeRecommendation) => {
      pendingRecommendations.set(recommendation.id, recommendation);
      logger.info(`📝 Recommendation stored: ${recommendation.id}`);
      
      // 期限切れ自動削除
      setTimeout(() => {
        if (pendingRecommendations.has(recommendation.id)) {
          pendingRecommendations.delete(recommendation.id);
          logger.info(`⏰ Recommendation expired: ${recommendation.id}`);
        }
      }, recommendation.expiresAt - Date.now());
    });
  });

  return router;
}

// 指値ロング注文実行
router.post('/execute-limit-long', async (req, res) => {
  const { recommendationId, limitPrice } = req.body;
  
  try {
    logger.info(`🚀 Executing limit long order: ${recommendationId} @ $${limitPrice}`);
    
    const recommendation = pendingRecommendations.get(recommendationId);
    
    if (!recommendation) {
      return res.status(404).json({ 
        success: false, 
        error: 'Recommendation not found or expired' 
      });
    }
    
    if (Date.now() > recommendation.expiresAt) {
      pendingRecommendations.delete(recommendationId);
      return res.status(400).json({ 
        success: false, 
        error: 'Recommendation expired' 
      });
    }
    
    // 指値ロングポジション実行
    const result = await tradeExecutionService.executeLimitLongPosition(
      recommendation, 
      limitPrice
    );
    
    if (result.success) {
      // 実行済みの推奨を削除
      pendingRecommendations.delete(recommendationId);
      
      res.json({ 
        success: true, 
        data: result 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }
    
  } catch (error) {
    logger.error('Limit trade execution failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// 注文キャンセル
router.post('/cancel-order', async (req, res) => {
  const { orderId } = req.body;
  
  try {
    logger.info(`🗑️ Cancelling order: ${orderId}`);
    
    const success = await tradeExecutionService.cancelLimitOrder(orderId);
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Order cancelled successfully' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to cancel order' 
      });
    }
  } catch (error) {
    logger.error('Order cancellation failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// アクティブ注文一覧取得
router.get('/active-orders', (req, res) => {
  try {
    const activeOrders = tradeExecutionService.getActiveOrders();
    
    res.json({ 
      success: true, 
      data: activeOrders 
    });
  } catch (error) {
    logger.error('Failed to get active orders:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// 特定シンボルのアクティブ注文取得
router.get('/active-orders/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const activeOrders = tradeExecutionService.getActiveOrdersBySymbol(symbol);
    
    res.json({ 
      success: true, 
      data: activeOrders 
    });
  } catch (error) {
    logger.error('Failed to get active orders for symbol:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// 推奨一覧取得（デバッグ用）
router.get('/recommendations', (req, res) => {
  try {
    const recommendations = Array.from(pendingRecommendations.values());
    
    res.json({ 
      success: true, 
      data: recommendations 
    });
  } catch (error) {
    logger.error('Failed to get recommendations:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;