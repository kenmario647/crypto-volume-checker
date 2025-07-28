import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { getCrossNotificationService } from '../controllers/notificationController';

const router = Router();

/**
 * GET /api/notifications/recent-crosses
 * 未通知のクロス情報を取得
 */
router.get('/recent-crosses', async (req: Request, res: Response) => {
  try {
    const notificationService = getCrossNotificationService();
    
    if (!notificationService) {
      return res.status(503).json({
        success: false,
        message: 'Notification service not available',
        crosses: [],
        timestamp: new Date().toISOString()
      });
    }

    const unnotifiedCrosses = notificationService.getUnnotifiedCrosses();
    
    // クエリパラメータで通知済みマークを制御
    const markAsNotified = req.query.mark !== 'false';
    
    if (markAsNotified && unnotifiedCrosses.length > 0) {
      const ids = unnotifiedCrosses.map(cross => cross.id);
      notificationService.markAsNotified(ids);
    }

    logger.info(`📱 API: Returning ${unnotifiedCrosses.length} unnotified crosses (marked: ${markAsNotified})`);

    res.json({
      success: true,
      crosses: unnotifiedCrosses,
      count: unnotifiedCrosses.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching recent crosses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent crosses',
      crosses: [],
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/notifications/all
 * 全ての通知履歴を取得（デバッグ用）
 */
router.get('/all', async (req: Request, res: Response) => {
  try {
    const notificationService = getCrossNotificationService();
    
    if (!notificationService) {
      return res.status(503).json({
        success: false,
        message: 'Notification service not available'
      });
    }

    const allNotifications = notificationService.getAllNotifications();
    const stats = notificationService.getStats();

    res.json({
      success: true,
      notifications: allNotifications,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching all notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
});

/**
 * GET /api/notifications/stats
 * 通知統計情報を取得
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const notificationService = getCrossNotificationService();
    
    if (!notificationService) {
      return res.status(503).json({
        success: false,
        message: 'Notification service not available'
      });
    }

    const stats = notificationService.getStats();

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching notification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats'
    });
  }
});

/**
 * DELETE /api/notifications/clear
 * 全ての通知履歴をクリア
 */
router.delete('/clear', async (req: Request, res: Response) => {
  try {
    const notificationService = getCrossNotificationService();
    
    if (!notificationService) {
      return res.status(503).json({
        success: false,
        message: 'Notification service not available'
      });
    }

    notificationService.clearAll();

    res.json({
      success: true,
      message: 'All notifications cleared',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error clearing notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear notifications'
    });
  }
});

export default router;