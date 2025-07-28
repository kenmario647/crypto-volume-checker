import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface CrossEvent {
  symbol: string;
  exchange: 'binance' | 'upbit';
  type: 'golden_cross' | 'death_cross';
  timestamp: number;
  ma3Value: number;
  ma8Value: number;
  previousMa3: number;
  previousMa8: number;
}

export interface VolumeDataPoint {
  timestamp: number;
  volume: number;
  ma3?: number | null;
  ma8?: number | null;
}

export class CrossDetectionService extends EventEmitter {
  private previousData: Map<string, VolumeDataPoint[]> = new Map();

  constructor() {
    super();
    logger.info('CrossDetectionService initialized');
  }

  /**
   * 移動平均線のクロスを検知する
   * @param symbol シンボル名
   * @param exchange 取引所
   * @param volumeData 出来高データ配列
   */
  detectCross(symbol: string, exchange: 'binance' | 'upbit', volumeData: VolumeDataPoint[]): void {
    const key = `${exchange}:${symbol}`;
    const previousVolData = this.previousData.get(key) || [];

    logger.info(`[CROSS_DETECTION] ${key}: Received ${volumeData.length} data points`);

    // データが少なすぎる場合はスキップ
    if (volumeData.length < 2) {
      logger.info(`[CROSS_DETECTION] ${key}: Not enough data points (${volumeData.length} < 2), skipping`);
      this.previousData.set(key, volumeData);
      return;
    }

    // 最新の2つのデータポイントを取得
    const currentData = volumeData[volumeData.length - 1];
    const previousData = volumeData[volumeData.length - 2];

    logger.info(`[CROSS_DETECTION] ${key}: Current MA data - MA3: ${currentData.ma3}, MA8: ${currentData.ma8}`);
    logger.info(`[CROSS_DETECTION] ${key}: Previous MA data - MA3: ${previousData.ma3}, MA8: ${previousData.ma8}`);

    // MA3とMA8が両方とも計算されているかチェック
    if (!this.hasValidMA(currentData) || !this.hasValidMA(previousData)) {
      logger.info(`[CROSS_DETECTION] ${key}: Invalid MA data, skipping cross detection`);
      this.previousData.set(key, volumeData);
      return;
    }

    const currentMa3 = currentData.ma3!;
    const currentMa8 = currentData.ma8!;
    const prevMa3 = previousData.ma3!;
    const prevMa8 = previousData.ma8!;

    // ゴールデンクロス検知: MA3がMA8より下にあった状態から上に抜けた
    if (prevMa3 <= prevMa8 && currentMa3 > currentMa8) {
      const crossEvent: CrossEvent = {
        symbol,
        exchange,
        type: 'golden_cross',
        timestamp: currentData.timestamp,
        ma3Value: currentMa3,
        ma8Value: currentMa8,
        previousMa3: prevMa3,
        previousMa8: prevMa8
      };

      logger.info(`🟡 GOLDEN CROSS detected: ${symbol} (${exchange}) - MA3: ${currentMa3.toFixed(2)} > MA8: ${currentMa8.toFixed(2)}`);
      this.emit('goldenCross', crossEvent);
    }

    // デスクロス検知: MA3がMA8より上にあった状態から下に抜けた
    if (prevMa3 >= prevMa8 && currentMa3 < currentMa8) {
      const crossEvent: CrossEvent = {
        symbol,
        exchange,
        type: 'death_cross',
        timestamp: currentData.timestamp,
        ma3Value: currentMa3,
        ma8Value: currentMa8,
        previousMa3: prevMa3,
        previousMa8: prevMa8
      };

      logger.info(`🔴 DEATH CROSS detected: ${symbol} (${exchange}) - MA3: ${currentMa3.toFixed(2)} < MA8: ${currentMa8.toFixed(2)}`);
      this.emit('deathCross', crossEvent);
    }

    // 現在のデータを保存
    this.previousData.set(key, volumeData);
  }

  /**
   * MA3とMA8が有効な値かチェック
   */
  private hasValidMA(data: VolumeDataPoint): boolean {
    return data.ma3 !== null && data.ma3 !== undefined && 
           data.ma8 !== null && data.ma8 !== undefined &&
           !isNaN(data.ma3) && !isNaN(data.ma8);
  }

  /**
   * 特定の銘柄・取引所の履歴をクリア
   */
  clearHistory(symbol?: string, exchange?: 'binance' | 'upbit'): void {
    if (symbol && exchange) {
      const key = `${exchange}:${symbol}`;
      this.previousData.delete(key);
      logger.info(`Cleared cross detection history for ${key}`);
    } else {
      this.previousData.clear();
      logger.info('Cleared all cross detection history');
    }
  }

  /**
   * 現在監視中の銘柄一覧を取得
   */
  getMonitoredSymbols(): string[] {
    return Array.from(this.previousData.keys());
  }
}

export default CrossDetectionService;