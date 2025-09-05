import { logger } from '../utils/logger';

export interface StartupVolumeData {
  symbol: string;
  exchange: string;
  initialVolume: number;
  initialRank: number;
  initialTime: number;
}

export class StartupVolumeTracker {
  private static instance: StartupVolumeTracker;
  private startupVolumes: Map<string, StartupVolumeData> = new Map();
  private startupTime: number;

  private constructor() {
    this.startupTime = Date.now();
    logger.info(`StartupVolumeTracker initialized at ${new Date(this.startupTime).toISOString()}`);
  }

  public static getInstance(): StartupVolumeTracker {
    if (!StartupVolumeTracker.instance) {
      StartupVolumeTracker.instance = new StartupVolumeTracker();
    }
    return StartupVolumeTracker.instance;
  }

  /**
   * Store initial volume and rank for a symbol on an exchange
   */
  public setInitialData(exchange: string, symbol: string, volume: number, rank: number) {
    const key = `${exchange}:${symbol}`;
    
    // Always update the current data but preserve initial rank if it exists
    const existingData = this.startupVolumes.get(key);
    const initialRank = existingData?.initialRank ?? rank;
    const initialVolume = existingData?.initialVolume ?? volume;
    const initialTime = existingData?.initialTime ?? Date.now();
    
    this.startupVolumes.set(key, {
      symbol,
      exchange,
      initialVolume: initialVolume, // Keep the first volume
      initialRank: initialRank,     // Keep the first rank
      initialTime: initialTime      // Keep the first time
    });
    
    if (!existingData) {
      logger.info(`Stored initial data for ${key}: Volume=$${volume.toFixed(2)}, Rank=${rank}`);
    }
  }

  /**
   * Calculate percentage change from startup volume
   */
  public calculateVolumeChangeFromStartup(exchange: string, symbol: string, currentVolume: number): number {
    const key = `${exchange}:${symbol}`;
    const startupData = this.startupVolumes.get(key);
    
    if (!startupData || startupData.initialVolume === 0) {
      return 0; // No startup data or invalid volume
    }

    // If the volume is the same as initial (first update), return 0
    if (Math.abs(currentVolume - startupData.initialVolume) < 0.01) {
      return 0;
    }

    const change = ((currentVolume - startupData.initialVolume) / startupData.initialVolume) * 100;
    return parseFloat(change.toFixed(2));
  }

  /**
   * Get initial rank for a symbol
   */
  public getInitialRank(exchange: string, symbol: string): number | undefined {
    const key = `${exchange}:${symbol}`;
    const startupData = this.startupVolumes.get(key);
    return startupData?.initialRank;
  }

  /**
   * Get time since startup in readable format
   */
  public getTimeSinceStartup(): string {
    const now = Date.now();
    const diffMs = now - this.startupTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    }
    return `${diffMins}m`;
  }

  /**
   * Get startup time
   */
  public getStartupTime(): number {
    return this.startupTime;
  }

  /**
   * Clear all stored data (for reset)
   */
  public reset() {
    this.startupVolumes.clear();
    this.startupTime = Date.now();
    logger.info('StartupVolumeTracker reset');
  }
}