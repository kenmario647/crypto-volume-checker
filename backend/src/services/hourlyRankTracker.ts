import { logger } from '../utils/logger';

export interface HourlyRankData {
  symbol: string;
  exchange: string;
  startRank: number;  // 9AM rank
  currentRank: number;
  hourlyRanks: Map<string, number>; // "HH:00" -> rank
  lastUpdate: Date;
}

export class HourlyRankTracker {
  private static instance: HourlyRankTracker;
  private hourlyData: Map<string, HourlyRankData> = new Map(); // key: "exchange:symbol"
  private lastResetTime: Date;
  private resetHour = 9; // Reset at 9 AM JST

  private constructor() {
    this.lastResetTime = new Date();
    this.initializeScheduler();
    logger.info(`HourlyRankTracker initialized at ${this.lastResetTime.toISOString()}`);
    
    // Take initial snapshot immediately for testing
    setTimeout(() => {
      this.takeHourlySnapshot();
      logger.info('📸 Initial hourly snapshot taken for testing');
    }, 5000); // Wait 5 seconds for data to be available
  }

  public static getInstance(): HourlyRankTracker {
    if (!HourlyRankTracker.instance) {
      HourlyRankTracker.instance = new HourlyRankTracker();
    }
    return HourlyRankTracker.instance;
  }

  private initializeScheduler() {
    let lastSnapshotHour = -1;
    let lastResetDate = '';
    
    // Check every second for more accurate timing
    setInterval(() => {
      const now = new Date();
      const jstHour = this.getJSTHour(now);
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const currentHour = now.getHours();
      const currentDate = now.toDateString();

      // Take snapshot at every hour (once per hour, in the first 10 seconds)
      if (minutes === 0 && seconds < 10 && currentHour !== lastSnapshotHour) {
        this.takeHourlySnapshot();
        lastSnapshotHour = currentHour;
        logger.info(`📸 Hourly snapshot triggered at ${now.toISOString()} (JST: ${this.getJSTTimeString(now)})`);
      }

      // Reset at 9 AM JST (once per day, in the first 10 seconds)
      if (jstHour === this.resetHour && minutes === 0 && seconds < 10 && currentDate !== lastResetDate) {
        this.resetAllData();
        lastResetDate = currentDate;
        logger.info(`🔄 Daily reset triggered at ${now.toISOString()} (9:00 AM JST)`);
        
        // Take initial snapshot after reset
        setTimeout(() => {
          this.takeHourlySnapshot();
          logger.info(`📸 Initial snapshot after reset at ${this.getJSTTimeString(new Date())} JST`);
        }, 5000);
      }
    }, 1000); // Check every second for better accuracy
  }

  private getJSTHour(date: Date): number {
    // Convert to JST (UTC+9)
    const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    return jstDate.getUTCHours();
  }

  private getJSTTimeString(date: Date): string {
    const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    const hour = jstDate.getUTCHours().toString().padStart(2, '0');
    return `${hour}:00`;
  }

  private wasResetToday(): boolean {
    const now = new Date();
    const jstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const jstLastReset = new Date(this.lastResetTime.getTime() + (9 * 60 * 60 * 1000));
    
    return jstNow.getUTCDate() === jstLastReset.getUTCDate() &&
           jstNow.getUTCMonth() === jstLastReset.getUTCMonth() &&
           jstNow.getUTCFullYear() === jstLastReset.getUTCFullYear();
  }

  public updateRank(exchange: string, symbol: string, currentRank: number) {
    const key = `${exchange}:${symbol}`;
    const now = new Date();
    const hourKey = this.getJSTTimeString(now);
    
    let data = this.hourlyData.get(key);
    
    if (!data) {
      // Initialize new data
      data = {
        symbol,
        exchange,
        startRank: currentRank,
        currentRank: currentRank,
        hourlyRanks: new Map<string, number>(),
        lastUpdate: now
      };
      this.hourlyData.set(key, data);
    }
    
    // Update current rank
    data.currentRank = currentRank;
    data.lastUpdate = now;
    
    // Store hourly rank if it's a new hour
    const jstHour = this.getJSTHour(now);
    if (now.getMinutes() === 0) {
      data.hourlyRanks.set(hourKey, currentRank);
      logger.info(`Stored hourly rank for ${key} at ${hourKey}: Rank=${currentRank}`);
    }
  }

  public takeHourlySnapshot(customTime?: string) {
    const now = new Date();
    const hourKey = customTime || this.getJSTTimeString(now);
    
    let snapshotCount = 0;
    this.hourlyData.forEach((data, key) => {
      // Only add if not already exists for this hour
      if (!data.hourlyRanks.has(hourKey)) {
        data.hourlyRanks.set(hourKey, data.currentRank);
        snapshotCount++;
      }
    });
    
    if (snapshotCount > 0) {
      logger.info(`Hourly snapshot taken at ${hourKey} JST for ${snapshotCount} symbols`);
    }
  }

  public resetAllData() {
    const now = new Date();
    
    // Store current ranks as start ranks before reset
    this.hourlyData.forEach((data) => {
      data.startRank = data.currentRank;
      data.hourlyRanks.clear();
      // Add 9AM rank as first entry
      data.hourlyRanks.set('09:00', data.currentRank);
    });
    
    this.lastResetTime = now;
    logger.info(`All hourly rank data reset at 9 AM JST. Data preserved for ${this.hourlyData.size} symbols.`);
  }

  public getHourlyData(exchange: string, symbol: string): any {
    const key = `${exchange}:${symbol}`;
    const data = this.hourlyData.get(key);
    if (!data) return undefined;
    
    // Convert Map to plain object for JSON serialization
    return {
      symbol: data.symbol,
      exchange: data.exchange,
      startRank: data.startRank,
      currentRank: data.currentRank,
      hourlyRanks: Object.fromEntries(data.hourlyRanks),
      lastUpdate: data.lastUpdate
    };
  }

  public getExchangeHourlyData(exchange: string): HourlyRankData[] {
    const result: HourlyRankData[] = [];
    this.hourlyData.forEach((data) => {
      if (data.exchange === exchange) {
        result.push(data);
      }
    });
    return result;
  }

  public getFormattedHourlyChanges(exchange: string, symbol: string): any[] {
    const key = `${exchange}:${symbol}`;
    const rawData = this.hourlyData.get(key);
    if (!rawData) return [];
    
    const changes: any[] = [];
    const allHours = Array.from(rawData.hourlyRanks.keys()) as string[];
    
    // Sort hours considering time crossing midnight
    // Split into before and after midnight
    const beforeMidnight = allHours.filter(h => parseInt(h.split(':')[0]) >= 20).sort();
    const afterMidnight = allHours.filter(h => parseInt(h.split(':')[0]) < 20).sort();
    
    // Combine in chronological order: 20:00, 21:00, 22:00, 23:00, 00:00, 01:00, ...
    const sortedHours = [...beforeMidnight, ...afterMidnight];
    
    let previousRank = rawData.startRank;
    sortedHours.forEach(hour => {
      const rank = rawData.hourlyRanks.get(hour)!;
      const change = previousRank - rank; // Positive means rank improved
      changes.push({
        time: hour,
        rank: rank,
        change: change,
        direction: change > 0 ? '↑' : change < 0 ? '↓' : '→'
      });
      previousRank = rank;
    });
    
    return changes;
  }

  public getAllExchanges(): string[] {
    const exchanges = new Set<string>();
    this.hourlyData.forEach(data => {
      exchanges.add(data.exchange);
    });
    return Array.from(exchanges);
  }

  public getLastResetTime(): Date {
    return this.lastResetTime;
  }

  public getStats(): any {
    const exchanges = this.getAllExchanges();
    const stats: any = {
      totalSymbols: this.hourlyData.size,
      lastReset: this.lastResetTime.toISOString(),
      nextReset: this.getNextResetTime().toISOString(),
      exchanges: {}
    };
    
    exchanges.forEach(exchange => {
      const exchangeData = this.getExchangeHourlyData(exchange);
      stats.exchanges[exchange] = {
        symbolCount: exchangeData.length,
        lastUpdate: exchangeData.length > 0 ? 
          exchangeData[0].lastUpdate.toISOString() : null
      };
    });
    
    return stats;
  }

  private getNextResetTime(): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Set to 9 AM JST
    const nextReset = new Date(tomorrow);
    nextReset.setUTCHours(0, 0, 0, 0); // Reset to midnight UTC
    nextReset.setTime(nextReset.getTime() + (this.resetHour - 9) * 60 * 60 * 1000); // Adjust for JST
    
    // If it's before 9 AM today, reset today
    const todayReset = new Date(now);
    todayReset.setUTCHours(0, 0, 0, 0);
    todayReset.setTime(todayReset.getTime() + (this.resetHour - 9) * 60 * 60 * 1000);
    
    if (now < todayReset) {
      return todayReset;
    }
    
    return nextReset;
  }
}