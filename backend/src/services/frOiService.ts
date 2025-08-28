import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

interface FrOiData {
  symbol: string;
  fundingRate: number;
  nextFundingTime: number;
  openInterest: number;
  openInterestValue: number;
  totalVolume: number;
  timestamp: number;
}

interface FrOiAlert {
  symbol: string;
  type: 'FR_DECREASE' | 'OI_INCREASE' | 'BOTH';
  frHistory: number[];
  oiHistory: number[];
  consecutiveFrDecreases: number;
  consecutiveOiIncreases: number;
  currentFr: number;
  currentOi: number;
  totalVolume: number;
  timestamp: Date;
}

class FrOiService extends EventEmitter {
  private frOiHistory: Map<string, { fr: number[], oi: number[] }> = new Map();
  private alerts: FrOiAlert[] = [];

  constructor() {
    super();
  }

  // Get all FR/OI data from binanceRestApi (using shared FR data)
  async getAllFrOiData(volumeService: any, binanceRestApi?: any) {
    const frOiData: FrOiData[] = [];
    
    // Use shared FR/OI data from binanceRestApi if available
    if (binanceRestApi && binanceRestApi.getFrOiData) {
      const frOiMap = binanceRestApi.getFrOiData();
      const allVolumeData = volumeService.getAllVolumeData ? volumeService.getAllVolumeData() : [];
      
      logger.info(`[FR/OI DEBUG] Using shared FR data for ${frOiMap.size} symbols from binanceRestApi`);
      
      frOiMap.forEach((data, symbol) => {
        // Find volume data for this symbol
        const volumeItem = allVolumeData.find(v => v.symbol === symbol);
        
        frOiData.push({
          symbol: symbol,
          fundingRate: data.fundingRate * 100, // Already in correct format, multiply for percentage
          nextFundingTime: 0,
          openInterest: data.openInterest,
          openInterestValue: data.openInterestValue,
          totalVolume: volumeItem ? (parseFloat(volumeItem.quoteVolume) || parseFloat(volumeItem.volume) || volumeItem.totalVolume || 0) : 0,
          timestamp: Date.now()
        });
      });
      
    } else {
      // Fallback to existing method if binanceRestApi not available
      const allVolumeData = volumeService.getAllVolumeData ? volumeService.getAllVolumeData() : [];
      
      logger.info(`[FR/OI DEBUG] Fallback mode: Got ${allVolumeData.length} symbols from volumeService`);
      
      allVolumeData.forEach(item => {
        if (item.openInterest !== undefined && item.fundingRate !== undefined) {
          frOiData.push({
            symbol: item.symbol,
            fundingRate: item.fundingRate,
            nextFundingTime: 0,
            openInterest: item.openInterest,
            openInterestValue: item.openInterestValue || 0,
            totalVolume: parseFloat(item.quoteVolume) || parseFloat(item.volume) || item.totalVolume || 0,
            timestamp: Date.now()
          });
        }
      });
    }
    
    return frOiData;
  }
  
  // Process data from BinanceRestApiService
  async processVolumeDataWithFrOi(volumeData: any[], volumeService?: any, binanceRestApi?: any) {
    // Get all FR/OI data using shared data from binanceRestApi
    const allFrOiData: FrOiData[] = volumeService ? await this.getAllFrOiData(volumeService, binanceRestApi) : [];
    
    // If we have access to all data, use it; otherwise use what's provided
    const frOiData: FrOiData[] = allFrOiData.length > 0 ? allFrOiData : [];
    
    // Add data from volumeData if not already present
    volumeData.forEach(item => {
      if (item.fundingRate !== undefined && item.openInterest !== undefined) {
        const exists = frOiData.find(d => d.symbol === item.symbol);
        if (!exists) {
          frOiData.push({
            symbol: item.symbol,
            fundingRate: item.fundingRate,
            nextFundingTime: 0,
            openInterest: item.openInterest,
            openInterestValue: item.openInterestValue || 0,
            totalVolume: parseFloat(item.quoteVolume) || parseFloat(item.volume) || item.totalVolume || 0,
            timestamp: Date.now()
          });
        }
      }
    });
    
    // Filter for symbols with volume >= 50M
    const filteredData = frOiData.filter(item => (item.totalVolume || 0) >= 50000000);
    
    logger.info(`[FR/OI DEBUG] After filtering: ${filteredData.length} symbols with volume >= 50M out of ${frOiData.length} total`);
    
    this.analyzeChanges(filteredData);
    
    // Include recent alerts in the response
    const recentAlerts = this.alerts.slice(0, 10);
    
    logger.info(`FR/OI Analysis: ${frOiData.length} total symbols, ${filteredData.length} symbols with volume >=50M processed, ${recentAlerts.length} recent alerts`);
    
    return {
      data: filteredData,
      alerts: this.alerts,
      recentAlerts: recentAlerts
    };
  }

  private analyzeChanges(data: FrOiData[]) {
    const newAlerts: FrOiAlert[] = [];
    const currentTime = Date.now();
    
    data.forEach(item => {
      if (!this.frOiHistory.has(item.symbol)) {
        this.frOiHistory.set(item.symbol, { fr: [], oi: [] });
      }
      
      const history = this.frOiHistory.get(item.symbol)!;
      
      // Only add if value has changed (to track real consecutive changes)
      const lastFr = history.fr[history.fr.length - 1];
      const lastOi = history.oi[history.oi.length - 1];
      
      // Always log CTSI data
      if (item.symbol === 'CTSI') {
        logger.info(`CTSI Data: FR=${item.fundingRate} (prev=${lastFr}) OI=${item.openInterest} (prev=${lastOi})`);
      }
      
      if (lastFr !== item.fundingRate || lastOi !== item.openInterest) {
        // Add new data to history
        history.fr.push(item.fundingRate);
        history.oi.push(item.openInterest);
        
        // Keep only last 10 data points
        if (history.fr.length > 10) history.fr.shift();
        if (history.oi.length > 10) history.oi.shift();
        
        // Check for consecutive changes (need at least 6 data points)
        if (history.fr.length >= 6 && history.oi.length >= 6) {
          const frDecreases = this.countConsecutiveDecreases(history.fr);
          const oiIncreases = this.countConsecutiveIncreases(history.oi);
          
          // Log symbols with high consecutive changes (including CTSI specifically)
          if (item.symbol === 'CTSI' || frDecreases >= 3 || oiIncreases >= 3) {
            logger.info(`FR/OI Pattern: ${item.symbol} - FR↓${frDecreases} OI↑${oiIncreases} (Need both ≥5 for alert) | History: FR=${history.fr.length} OI=${history.oi.length}`);
          }
          
          // Alert ONLY if BOTH conditions are met: FR decreased 5+ times AND OI increased 5+ times
          if (frDecreases >= 5 && oiIncreases >= 5) {
            // Check if we already alerted for this symbol recently (within 30 minutes)
            const recentAlert = this.alerts.find(a => 
              a.symbol === item.symbol && 
              (currentTime - new Date(a.timestamp).getTime()) < 30 * 60 * 1000
            );
            
            if (!recentAlert) {
              const alert: FrOiAlert = {
                symbol: item.symbol,
                type: 'BOTH',
                frHistory: [...history.fr],
                oiHistory: [...history.oi],
                consecutiveFrDecreases: frDecreases,
                consecutiveOiIncreases: oiIncreases,
                currentFr: item.fundingRate,
                currentOi: item.openInterest,
                totalVolume: item.totalVolume || 0,
                timestamp: new Date()
              };
              
              newAlerts.push(alert);
              this.emit('alert', alert);
              
              // Log important alert
              logger.warn(`🚨 FR/OI ALERT: ${item.symbol} - FR decreased ${frDecreases}x AND OI increased ${oiIncreases}x consecutively`);
            }
          }
        }
      }
    });
    
    // Add new alerts and keep only recent ones (last 100)
    if (newAlerts.length > 0) {
      this.alerts = [...newAlerts, ...this.alerts].slice(0, 100);
    }
  }

  private countConsecutiveDecreases(arr: number[]): number {
    let count = 0;
    for (let i = arr.length - 1; i > 0; i--) {
      if (arr[i] < arr[i - 1]) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  private countConsecutiveIncreases(arr: number[]): number {
    let count = 0;
    for (let i = arr.length - 1; i > 0; i--) {
      if (arr[i] > arr[i - 1]) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  getAlerts(): FrOiAlert[] {
    return this.alerts;
  }

  getCurrentData(): Map<string, { fr: number[], oi: number[] }> {
    return this.frOiHistory;
  }
}

export default FrOiService;
export { FrOiData, FrOiAlert };