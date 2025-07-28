import CrossNotificationService from '../services/crossNotificationService';
import { logger } from '../utils/logger';

let crossNotificationService: CrossNotificationService | null = null;

/**
 * CrossNotificationServiceのインスタンスを設定
 */
export function setCrossNotificationService(service: CrossNotificationService): void {
  crossNotificationService = service;
  logger.info('CrossNotificationService instance set');
}

/**
 * CrossNotificationServiceのインスタンスを取得
 */
export function getCrossNotificationService(): CrossNotificationService | null {
  return crossNotificationService;
}

/**
 * クロス通知サービスを初期化
 */
export function initializeCrossNotificationService(): CrossNotificationService {
  if (!crossNotificationService) {
    crossNotificationService = new CrossNotificationService();
    logger.info('CrossNotificationService initialized');
  }
  return crossNotificationService;
}