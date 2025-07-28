import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface CrossNotification {
  id: string;
  type: 'golden_cross' | 'death_cross';
  symbol: string;
  exchange: 'binance' | 'upbit';
  timestamp: number;
  ma3Value: number;
  ma8Value: number;
  previousMa3: number;
  previousMa8: number;
  message: string;
  notified: boolean;
  createdAt: number;
}

export class CrossNotificationService extends EventEmitter {
  private notifications: CrossNotification[] = [];
  private readonly maxAge = 10 * 60 * 1000; // 10分間保持

  constructor() {
    super();
    logger.info('CrossNotificationService initialized');
    
    // 古い通知を定期的にクリーンアップ
    setInterval(() => {
      this.cleanupOldNotifications();
    }, 2 * 60 * 1000); // 2分毎
  }

  /**
   * 新しいクロス通知を追加
   */
  addCrossNotification(crossEvent: any): void {
    const notification: CrossNotification = {
      id: `${crossEvent.exchange}-${crossEvent.symbol}-${crossEvent.timestamp}`,
      type: crossEvent.type,
      symbol: crossEvent.symbol,
      exchange: crossEvent.exchange,
      timestamp: crossEvent.timestamp,
      ma3Value: crossEvent.ma3Value,
      ma8Value: crossEvent.ma8Value,
      previousMa3: crossEvent.previousMa3,
      previousMa8: crossEvent.previousMa8,
      message: `${crossEvent.symbol} (${crossEvent.exchange.toUpperCase()})`,
      notified: false,
      createdAt: Date.now()
    };

    // 重複チェック
    const exists = this.notifications.find(n => n.id === notification.id);
    if (exists) {
      logger.debug(`Duplicate cross notification ignored: ${notification.id}`);
      return;
    }

    this.notifications.unshift(notification);
    logger.info(`📱 Cross notification added: ${notification.type} for ${notification.symbol} (${notification.exchange})`);
    
    // 通知数が多すぎる場合は古いものを削除
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(0, 100);
    }
  }

  /**
   * 未通知のクロス情報を取得
   */
  getUnnotifiedCrosses(): CrossNotification[] {
    const unnotified = this.notifications.filter(n => !n.notified);
    logger.info(`📱 Found ${unnotified.length} unnotified crosses`);
    return unnotified;
  }

  /**
   * 通知済みとしてマーク
   */
  markAsNotified(notificationIds: string[]): void {
    let markedCount = 0;
    
    this.notifications.forEach(notification => {
      if (notificationIds.includes(notification.id) && !notification.notified) {
        notification.notified = true;
        markedCount++;
      }
    });
    
    if (markedCount > 0) {
      logger.info(`📱 Marked ${markedCount} notifications as notified`);
    }
  }

  /**
   * 全ての通知を取得（デバッグ用）
   */
  getAllNotifications(): CrossNotification[] {
    return [...this.notifications];
  }

  /**
   * 古い通知をクリーンアップ
   */
  private cleanupOldNotifications(): void {
    const before = this.notifications.length;
    const cutoff = Date.now() - this.maxAge;
    
    this.notifications = this.notifications.filter(n => n.createdAt > cutoff);
    
    const removed = before - this.notifications.length;
    if (removed > 0) {
      logger.info(`📱 Cleaned up ${removed} old notifications`);
    }
  }

  /**
   * 通知履歴をクリア
   */
  clearAll(): void {
    this.notifications = [];
    logger.info('📱 All notifications cleared');
  }

  /**
   * 統計情報を取得
   */
  getStats() {
    const total = this.notifications.length;
    const unnotified = this.notifications.filter(n => !n.notified).length;
    const goldenCrosses = this.notifications.filter(n => n.type === 'golden_cross').length;
    const deathCrosses = this.notifications.filter(n => n.type === 'death_cross').length;
    
    return {
      total,
      unnotified,
      notified: total - unnotified,
      goldenCrosses,
      deathCrosses
    };
  }
}

export default CrossNotificationService;