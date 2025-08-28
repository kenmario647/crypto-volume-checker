import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface CrossEvent {
  symbol: string;
  exchange: 'binance' | 'binance-spot' | 'upbit';
  type: 'ma2_ma5_golden_cross' | 'ma2_ma5_death_cross';
  timestamp: number;
  ma2Value: number;
  ma5Value: number;
  ma10Value: number;
  previousMa2: number;
  previousMa5: number;
  previousMa10: number;
}

export interface VolumeDataPoint {
  timestamp: number;
  volume: number;
  ma2?: number | null;
  ma5?: number | null;
  ma10?: number | null;
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
  detectCross(symbol: string, exchange: 'binance' | 'binance-spot' | 'upbit', volumeData: VolumeDataPoint[]): void {
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

    logger.info(`[CROSS_DETECTION] ${key}: Current MA data - MA2: ${currentData.ma2}, MA5: ${currentData.ma5}, MA10: ${currentData.ma10}`);
    logger.info(`[CROSS_DETECTION] ${key}: Previous MA data - MA2: ${previousData.ma2}, MA5: ${previousData.ma5}, MA10: ${previousData.ma10}`);

    // MA2、MA5、MA10が全て計算されているかチェック
    if (!this.hasValidMA(currentData) || !this.hasValidMA(previousData)) {
      logger.info(`[CROSS_DETECTION] ${key}: Invalid MA data, skipping cross detection`);
      this.previousData.set(key, volumeData);
      return;
    }

    const currentMa2 = currentData.ma2!;
    const currentMa5 = currentData.ma5!;
    const currentMa10 = currentData.ma10!;
    const prevMa2 = previousData.ma2!;
    const prevMa5 = previousData.ma5!;
    const prevMa10 = previousData.ma10!;

    // MA2 vs MA5 ゴールデンクロス検知
    if (prevMa2 <= prevMa5 && currentMa2 > currentMa5) {
      const crossEvent: CrossEvent = {
        symbol,
        exchange,
        type: 'ma2_ma5_golden_cross',
        timestamp: currentData.timestamp,
        ma2Value: currentMa2,
        ma5Value: currentMa5,
        ma10Value: currentMa10,
        previousMa2: prevMa2,
        previousMa5: prevMa5,
        previousMa10: prevMa10
      };

      logger.info(`🟡 MA2/MA5 GOLDEN CROSS detected: ${symbol} (${exchange}) - MA2: ${currentMa2.toFixed(2)} > MA5: ${currentMa5.toFixed(2)}`);
      this.emit('goldenCross', crossEvent);
    }

    // MA2 vs MA5 デスクロス検知
    if (prevMa2 >= prevMa5 && currentMa2 < currentMa5) {
      const crossEvent: CrossEvent = {
        symbol,
        exchange,
        type: 'ma2_ma5_death_cross',
        timestamp: currentData.timestamp,
        ma2Value: currentMa2,
        ma5Value: currentMa5,
        ma10Value: currentMa10,
        previousMa2: prevMa2,
        previousMa5: prevMa5,
        previousMa10: prevMa10
      };

      logger.info(`🔴 MA2/MA5 DEATH CROSS detected: ${symbol} (${exchange}) - MA2: ${currentMa2.toFixed(2)} < MA5: ${currentMa5.toFixed(2)}`);
      this.emit('deathCross', crossEvent);
    }

    // 現在のデータを保存
    this.previousData.set(key, volumeData);
  }

  /**
   * MA2、MA5が有効な値かチェック（MA10は任意）
   */
  private hasValidMA(data: VolumeDataPoint): boolean {
    return data.ma2 !== null && data.ma2 !== undefined && 
           data.ma5 !== null && data.ma5 !== undefined &&
           !isNaN(data.ma2) && !isNaN(data.ma5);
  }

  /**
   * 特定の銘柄・取引所の履歴をクリア
   */
  clearHistory(symbol?: string, exchange?: 'binance' | 'binance-spot' | 'upbit'): void {
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