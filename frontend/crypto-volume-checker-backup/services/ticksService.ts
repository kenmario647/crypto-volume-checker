import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { BinanceClient } from './binanceClient';

export interface TickData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  exchange: 'binance' | 'upbit';
}

export interface FiveMinTickSummary {
  symbol: string;
  exchange: 'binance' | 'upbit';
  tickCount: number;
  totalVolume: number;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  previousPrice: number;
  lastUpdate: number;
  direction: 'up' | 'down' | 'neutral';
}

export class TicksService extends EventEmitter {
  private binanceWs: WebSocket | null = null;
  private upbitWs: WebSocket | null = null;
  private tickBuffer: Map<string, TickData[]> = new Map();
  private fiveMinSummaries: Map<string, FiveMinTickSummary> = new Map();
  private previousSnapshots: Map<string, { price: number; volume: number; timestamp: number }> = new Map();
  private intervals: NodeJS.Timeout[] = [];
  private lastTickReceived: Map<string, number> = new Map(); // Track last tick time per symbol
  private binanceClient: any; // BinanceClient for getting top ticks symbols
  
  // Futures symbol to Spot symbol mapping
  private futuresToSpotMapping = new Map<string, string>([
    ['1000PEPEUSDT', 'PEPEUSDT'],
    ['1000BONKUSDT', 'BONKUSDT'],
    ['1000FLOKIUSDT', 'FLOKIUSDT'],
    ['1000SHIBUSDT', 'SHIBUSDT'],
    // FARTCOINUSDT is futures-only, will be handled separately
  ]);
  
  // Futures-only symbols that don't exist in spot market
  private futuresOnlySymbols = new Set<string>([
    'FARTCOINUSDT',
    // Add other futures-only symbols as needed
  ]);

  constructor() {
    super();
    this.binanceClient = new BinanceClient();
    this.setupTickProcessing();
    
    // Add sample data for testing
    setTimeout(() => {
      this.addSampleTicksData();
    }, 1000);
    
    // logger.info('TicksService initialized');
  }

  private setupTickProcessing() {
    // Process 5-minute ticks every 5 minutes
    const fiveMinInterval = setInterval(() => {
      this.processFiveMinTicks();
    }, 5 * 60 * 1000); // 5 minutes

    // Emit updates every 10 seconds for real-time display
    const updateInterval = setInterval(() => {
      this.emitCurrentSummaries();
    }, 10 * 1000); // 10 seconds

    // Monitor specific symbols activity every 30 seconds
    const monitorInterval = setInterval(() => {
      this.monitorSymbolActivity();
    }, 30 * 1000); // 30 seconds

    this.intervals.push(fiveMinInterval, updateInterval, monitorInterval);
  }

  // Convert futures symbols to spot symbols for WebSocket connection
  private mapFuturesSymbolsToSpot(futuresSymbols: string[]): { spotSymbols: string[], originalMapping: Map<string, string> } {
    const spotSymbols: string[] = [];
    const originalMapping = new Map<string, string>(); // spot -> original futures
    
    futuresSymbols.forEach(futuresSymbol => {
      const spotSymbol = this.futuresToSpotMapping.get(futuresSymbol) || futuresSymbol;
      spotSymbols.push(spotSymbol);
      originalMapping.set(spotSymbol, futuresSymbol);
    });
    
    logger.info(`🔄 Mapped ${futuresSymbols.length} futures symbols to ${spotSymbols.length} spot symbols`);
    logger.info(`📊 Mapping examples: ${Array.from(this.futuresToSpotMapping.entries()).slice(0, 3).map(([f, s]) => `${f}→${s}`).join(', ')}`);
    
    return { spotSymbols, originalMapping };
  }

  // New method to connect to top ticks symbols independently
  public async connectBinanceTopTicks() {
    try {
      // Get top 20 symbols by ticks count from Binance Futures API
      const topTicksSymbols = await this.binanceClient.getTopTicksSymbols(20);
      const symbolNames = topTicksSymbols.map((ticker: any) => ticker.symbol);
      
      logger.info(`🔥 Connecting to top 20 ticks symbols: ${symbolNames.slice(0, 5).join(', ')}... (${symbolNames.length} total)`);
      
      // Close existing connection if any
      if (this.binanceWs && this.binanceWs.readyState === WebSocket.OPEN) {
        this.binanceWs.close();
      }

      // Separate spot-available and futures-only symbols
      const spotSymbols: string[] = [];
      const futuresOnlySymbols: string[] = [];
      const originalMapping = new Map<string, string>();
      
      symbolNames.forEach((futuresSymbol: string) => {
        if (this.futuresOnlySymbols.has(futuresSymbol)) {
          futuresOnlySymbols.push(futuresSymbol);
          originalMapping.set(futuresSymbol, futuresSymbol);
        } else {
          const spotSymbol = this.futuresToSpotMapping.get(futuresSymbol) || futuresSymbol;
          spotSymbols.push(spotSymbol);
          originalMapping.set(spotSymbol, futuresSymbol);
        }
      });
      
      logger.info(`🎯 Top Ticks Split: ${spotSymbols.length} spot, ${futuresOnlySymbols.length} futures-only`);
      
      // Connect to WebSockets
      if (spotSymbols.length > 0) {
        this.connectSpotWebSocket(spotSymbols, originalMapping);
      }
      
      if (futuresOnlySymbols.length > 0) {
        this.connectFuturesWebSocket(futuresOnlySymbols, originalMapping);
      }
      
    } catch (error) {
      logger.error('Error connecting to top ticks symbols:', error);
    }
  }

  public connectBinance(futuresSymbols: string[]) {
    if (this.binanceWs && this.binanceWs.readyState === WebSocket.OPEN) {
      this.binanceWs.close();
    }

    // Skip if no symbols provided
    if (!futuresSymbols || futuresSymbols.length === 0) {
      logger.warn('No Binance symbols provided for connection');
      return;
    }

    // Accept up to 20 symbols from ranking data (maintain ranking order)
    const limitedFuturesSymbols = futuresSymbols.slice(0, 20);
    
    // Separate spot-available and futures-only symbols
    const spotSymbols: string[] = [];
    const futuresOnlySymbols: string[] = [];
    const originalMapping = new Map<string, string>(); // spot/futures -> original futures
    
    limitedFuturesSymbols.forEach(futuresSymbol => {
      if (this.futuresOnlySymbols.has(futuresSymbol)) {
        futuresOnlySymbols.push(futuresSymbol);
        originalMapping.set(futuresSymbol, futuresSymbol);
      } else {
        const spotSymbol = this.futuresToSpotMapping.get(futuresSymbol) || futuresSymbol;
        spotSymbols.push(spotSymbol);
        originalMapping.set(spotSymbol, futuresSymbol);
      }
    });
    
    // Create mixed WebSocket URL: spot symbols from spot API, futures-only from futures API
    const spotStreams = spotSymbols.map(symbol => `${symbol.toLowerCase()}@trade`);
    const futuresStreams = futuresOnlySymbols.map(symbol => `${symbol.toLowerCase()}@trade`);
    
    logger.info(`📊 Split: ${spotSymbols.length} spot symbols, ${futuresOnlySymbols.length} futures-only symbols`);
    logger.info(`🎯 Futures-only symbols: ${futuresOnlySymbols.join(', ')}`);
    
    // Use spot WebSocket for most symbols, but handle FARTCOIN separately with futures stream
    if (spotSymbols.length > 0) {
      this.connectSpotWebSocket(spotSymbols, originalMapping);
    }
    
    if (futuresOnlySymbols.length > 0) {
      this.connectFuturesWebSocket(futuresOnlySymbols, originalMapping);
    }
  }
  
  private connectSpotWebSocket(spotSymbols: string[], originalMapping: Map<string, string>) {
    const streams = spotSymbols.map(symbol => `${symbol.toLowerCase()}@trade`).join('/');
    const wsUrl = `wss://stream.binance.com:9443/ws/${streams}`;

    logger.info(`🔗 Creating Binance SPOT WebSocket connection with ${spotSymbols.length} symbols`);
    
    this.binanceWs = new WebSocket(wsUrl);

    this.binanceWs.on('open', () => {
      logger.info(`✅ Connected to Binance SPOT WebSocket: ${spotSymbols.join(', ')}`);
    });

    this.binanceWs.on('message', (data: WebSocket.Data) => {
      try {
        const tickData = JSON.parse(data.toString());
        this.processBinanceSpotTick(tickData, originalMapping);
      } catch (error) {
        logger.error('Error processing Binance spot tick:', error);
      }
    });

    this.binanceWs.on('error', (error) => {
      logger.error('❌ Binance Spot WebSocket error:', error);
    });

    this.binanceWs.on('close', (code, reason) => {
      logger.warn(`🔌 Binance Spot WebSocket closed (code: ${code}, reason: ${reason})`);
    });
  }
  
  private connectFuturesWebSocket(futuresSymbols: string[], originalMapping: Map<string, string>) {
    const streams = futuresSymbols.map(symbol => `${symbol.toLowerCase()}@trade`).join('/');
    const wsUrl = `wss://fstream.binance.com/ws/${streams}`;

    logger.info(`🔗 Creating Binance FUTURES WebSocket connection with ${futuresSymbols.length} symbols`);
    
    // Create separate WebSocket for futures-only symbols
    const futuresWs = new WebSocket(wsUrl);

    futuresWs.on('open', () => {
      logger.info(`✅ Connected to Binance FUTURES WebSocket: ${futuresSymbols.join(', ')}`);
    });

    futuresWs.on('message', (data: WebSocket.Data) => {
      try {
        const tickData = JSON.parse(data.toString());
        this.processBinanceFuturesTick(tickData, originalMapping);
      } catch (error) {
        logger.error('Error processing Binance futures tick:', error);
      }
    });

    futuresWs.on('error', (error) => {
      logger.error('❌ Binance Futures WebSocket error:', error);
    });

    futuresWs.on('close', (code, reason) => {
      logger.warn(`🔌 Binance Futures WebSocket closed (code: ${code}, reason: ${reason})`);
    });
  }

  public connectUpbit(symbols: string[]) {
    if (this.upbitWs && this.upbitWs.readyState === WebSocket.OPEN) {
      this.upbitWs.close();
    }

    // Skip if no symbols provided
    if (!symbols || symbols.length === 0) {
      logger.warn('No Upbit symbols provided for connection');
      return;
    }

    // Accept up to 20 symbols from ranking data
    const rankingSymbols = symbols.slice(0, 20);

    try {
      this.upbitWs = new WebSocket('wss://api.upbit.com/websocket/v1');

      this.upbitWs.on('open', () => {
        logger.info(`✅ Connected to Upbit WebSocket for ranking-based ticks: ${rankingSymbols.join(', ')}`);
        
        // Subscribe to trade updates for actual tick count
        const subscribeMessage = JSON.stringify([
          { ticket: 'ticks-service' },
          {
            type: 'trade',
            codes: rankingSymbols.map(symbol => symbol.startsWith('KRW-') ? symbol : `KRW-${symbol}`)
          }
        ]);
        
        if (this.upbitWs && this.upbitWs.readyState === WebSocket.OPEN) {
          this.upbitWs.send(subscribeMessage);
        }
      });

      this.upbitWs.on('message', (data: WebSocket.Data) => {
        try {
          const buffer = data as Buffer;
          const tickData = JSON.parse(buffer.toString('utf8'));
          this.processUpbitTick(tickData);
        } catch (error) {
          logger.error('Error processing Upbit tick:', error);
        }
      });

      this.upbitWs.on('error', (error) => {
        logger.error('Upbit WebSocket error:', error);
      });

      this.upbitWs.on('close', (code, reason) => {
        logger.warn(`Upbit WebSocket closed (code: ${code}, reason: ${reason}), attempting reconnect...`);
        // Only reconnect if we have symbols and it's not a manual close
        if (symbols && symbols.length > 0 && code !== 1000) {
          setTimeout(() => this.connectUpbit(symbols), 10000); // Increased delay
        }
      });
    } catch (error) {
      logger.error('Error creating Upbit WebSocket:', error);
      setTimeout(() => this.connectUpbit(symbols), 10000);
    }
  }

  private processBinanceSpotTick(data: any, originalMapping: Map<string, string>) {
    // Process individual trade data from SPOT @trade stream
    const spotSymbol = data.s || data.symbol;
    
    // Map back to original futures symbol for consistency with ranking data
    const originalFuturesSymbol = originalMapping.get(spotSymbol) || spotSymbol;
    
    // Remove USDT suffix for display (e.g., PEPEUSDT -> PEPE, but keep 1000PEPE -> 1000PEPE)
    let displaySymbol = originalFuturesSymbol;
    if (displaySymbol.endsWith('USDT')) {
      displaySymbol = displaySymbol.replace('USDT', '');
    }

    const tick: TickData = {
      symbol: displaySymbol,
      price: parseFloat(data.p || data.price), // Trade price
      volume: parseFloat(data.q || data.quantity), // Trade quantity
      timestamp: data.T || Date.now(), // Trade time
      exchange: 'binance'
    };

    // No individual tick logging to prevent performance issues

    // Track last tick time for monitoring
    const key = `binance-${displaySymbol}`;
    this.lastTickReceived.set(key, Date.now());

    this.addTickToBuffer(tick);
  }

  private processBinanceFuturesTick(data: any, originalMapping: Map<string, string>) {
    // Process individual trade data from FUTURES @trade stream
    const futuresSymbol = data.s || data.symbol;
    
    // For futures-only symbols, use the symbol as-is for mapping
    const originalFuturesSymbol = originalMapping.get(futuresSymbol) || futuresSymbol;
    
    // Remove USDT suffix for display 
    let displaySymbol = originalFuturesSymbol;
    if (displaySymbol.endsWith('USDT')) {
      displaySymbol = displaySymbol.replace('USDT', '');
    }

    const tick: TickData = {
      symbol: displaySymbol,
      price: parseFloat(data.p || data.price), // Trade price
      volume: parseFloat(data.q || data.quantity), // Trade quantity
      timestamp: data.T || Date.now(), // Trade time
      exchange: 'binance'
    };

    // Minimal logging for futures-only symbols to prevent performance issues
    // Removed excessive logging that was causing server crashes

    // Track last tick time for monitoring
    const key = `binance-${displaySymbol}`;
    this.lastTickReceived.set(key, Date.now());

    this.addTickToBuffer(tick);
  }

  // Keep legacy method for backward compatibility
  private processBinanceTick(data: any) {
    // This method is now unused but kept for potential fallback
    logger.warn('Legacy processBinanceTick called - should use processBinanceSpotTick or processBinanceFuturesTick');
  }

  private processUpbitTick(data: any) {
    if (data.type === 'trade') {
      const tick: TickData = {
        symbol: data.code?.replace('KRW-', '') || data.market?.replace('KRW-', ''),
        price: data.trade_price || data.tp, // Trade price
        volume: data.trade_volume || data.tv, // Trade volume
        timestamp: data.trade_timestamp || Date.now(), // Trade timestamp
        exchange: 'upbit'
      };

      this.addTickToBuffer(tick);
    }
  }

  private addTickToBuffer(tick: TickData) {
    const key = `${tick.exchange}-${tick.symbol}`;
    
    if (!this.tickBuffer.has(key)) {
      this.tickBuffer.set(key, []);
      // Log first tick for new symbols
      logger.info(`🆕 First tick received for ${key}`);
    }
    
    const buffer = this.tickBuffer.get(key)!;
    buffer.push(tick);
    
    // Keep only last 5 minutes of ticks
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const filteredBuffer = buffer.filter(t => t.timestamp >= fiveMinutesAgo);
    this.tickBuffer.set(key, filteredBuffer);

    // Update current summary
    this.updateCurrentSummary(tick, filteredBuffer);
    
    // No buffer logging to prevent server crashes from excessive logs
  }

  private updateCurrentSummary(latestTick: TickData, tickBuffer: TickData[]) {
    const key = `${latestTick.exchange}-${latestTick.symbol}`;
    const now = Date.now();
    
    // Get previous snapshot for comparison
    const prevSnapshot = this.previousSnapshots.get(key);
    
    // Calculate summary
    const tickCount = tickBuffer.length;
    const totalVolume = tickBuffer.reduce((sum, tick) => sum + tick.volume, 0);
    const currentPrice = latestTick.price;
    const previousPrice = prevSnapshot?.price || currentPrice;
    const priceChange = currentPrice - previousPrice;
    const priceChangePercent = previousPrice > 0 ? ((priceChange / previousPrice) * 100) : 0;
    
    let direction: 'up' | 'down' | 'neutral' = 'neutral';
    if (priceChange > 0) direction = 'up';
    else if (priceChange < 0) direction = 'down';

    const summary: FiveMinTickSummary = {
      symbol: latestTick.symbol,
      exchange: latestTick.exchange,
      tickCount,
      totalVolume,
      currentPrice,
      priceChange,
      priceChangePercent,
      previousPrice,
      lastUpdate: now,
      direction
    };

    this.fiveMinSummaries.set(key, summary);
  }

  private processFiveMinTicks() {
    const now = Date.now();
    
    // Create snapshots for next comparison
    this.fiveMinSummaries.forEach((summary, key) => {
      this.previousSnapshots.set(key, {
        price: summary.currentPrice,
        volume: summary.totalVolume,
        timestamp: now
      });
    });

    // DON'T clear tick buffers - keep cumulative data
    // Just remove old ticks (older than 5 minutes) from each symbol's buffer
    this.tickBuffer.forEach((buffer, key) => {
      const fiveMinutesAgo = now - (5 * 60 * 1000);
      const filteredBuffer = buffer.filter(tick => tick.timestamp >= fiveMinutesAgo);
      this.tickBuffer.set(key, filteredBuffer);
    });
    
    // logger.info('Processed 5-minute tick summaries (cumulative)');
    this.emit('fiveMinProcessed', Array.from(this.fiveMinSummaries.values()));
  }

  private emitCurrentSummaries() {
    const summaries = Array.from(this.fiveMinSummaries.values());
    this.emit('ticksUpdate', summaries);
  }

  public getCurrentSummaries(): FiveMinTickSummary[] {
    return Array.from(this.fiveMinSummaries.values())
      .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent));
  }

  private addSampleTicksData() {
    // Add sample Binance ticks data
    const binanceSamples = [
      { symbol: 'BTC', tickCount: 1547, price: 95234.67, change: 2.34 },
      { symbol: 'ETH', tickCount: 1432, price: 3456.78, change: 1.87 },
      { symbol: 'SOL', tickCount: 1298, price: 234.56, change: -0.43 },
      { symbol: 'DOGE', tickCount: 1156, price: 0.3456, change: 3.21 },
      { symbol: '1000PEPE', tickCount: 1098, price: 0.00001345, change: 5.67 },
      { symbol: 'XRP', tickCount: 987, price: 2.345, change: -1.23 },
      { symbol: 'ADA', tickCount: 876, price: 0.987, change: 2.15 },
      { symbol: 'PENGU', tickCount: 765, price: 0.0345, change: 8.90 },
      { symbol: '1000BONK', tickCount: 654, price: 0.00003321, change: 4.56 },
      { symbol: 'FARTCOIN', tickCount: 543, price: 1.587, change: -2.34 }
    ];

    const upbitSamples = [
      { symbol: 'BTC', tickCount: 987, price: 142000000, change: 1.87 },
      { symbol: 'ETH', tickCount: 876, price: 5123000, change: 2.34 },
      { symbol: 'XRP', tickCount: 765, price: 3456, change: -0.78 },
      { symbol: 'DOGE', tickCount: 654, price: 512, change: 3.45 },
      { symbol: 'SOL', tickCount: 543, price: 345000, change: -1.23 }
    ];

    binanceSamples.forEach(sample => {
      const summary: FiveMinTickSummary = {
        symbol: sample.symbol,
        exchange: 'binance',
        tickCount: sample.tickCount,
        totalVolume: sample.tickCount * 1000,
        currentPrice: sample.price,
        priceChange: sample.price * (sample.change / 100),
        priceChangePercent: sample.change,
        previousPrice: sample.price * (1 - sample.change / 100),
        lastUpdate: Date.now(),
        direction: sample.change > 0 ? 'up' : sample.change < 0 ? 'down' : 'neutral'
      };
      this.fiveMinSummaries.set(`binance-${sample.symbol}`, summary);
    });

    upbitSamples.forEach(sample => {
      const summary: FiveMinTickSummary = {
        symbol: sample.symbol,
        exchange: 'upbit',
        tickCount: sample.tickCount,
        totalVolume: sample.tickCount * 1000,
        currentPrice: sample.price,
        priceChange: sample.price * (sample.change / 100),
        priceChangePercent: sample.change,
        previousPrice: sample.price * (1 - sample.change / 100),
        lastUpdate: Date.now(),
        direction: sample.change > 0 ? 'up' : sample.change < 0 ? 'down' : 'neutral'
      };
      this.fiveMinSummaries.set(`upbit-${sample.symbol}`, summary);
    });

    // logger.info(`Added ${binanceSamples.length} Binance + ${upbitSamples.length} Upbit sample ticks data`);
  }

  private monitorSymbolActivity() {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    const problematicSymbols = ['binance-FARTCOIN', 'binance-1000BONK', 'binance-1000PEPE'];
    
    problematicSymbols.forEach(key => {
      const lastTick = this.lastTickReceived.get(key);
      const hasBufferData = this.tickBuffer.has(key) && this.tickBuffer.get(key)!.length > 0;
      
      if (!lastTick) {
        logger.warn(`⚠️  ${key}: No trades received since monitoring started`);
      } else if (lastTick < fiveMinutesAgo) {
        const minutesAgo = Math.round((now - lastTick) / (60 * 1000));
        logger.warn(`⚠️  ${key}: Last trade received ${minutesAgo} minutes ago`);
      } else {
        const minutesAgo = Math.round((now - lastTick) / (60 * 1000));
        logger.info(`✅ ${key}: Active - last trade ${minutesAgo} minutes ago (buffer: ${hasBufferData ? this.tickBuffer.get(key)!.length : 0} ticks)`);
      }
    });
  }

  public disconnect() {
    this.intervals.forEach(interval => clearInterval(interval));
    
    if (this.binanceWs && this.binanceWs.readyState === WebSocket.OPEN) {
      this.binanceWs.close(1000, 'Service shutdown');
      this.binanceWs = null;
    }
    
    if (this.upbitWs && this.upbitWs.readyState === WebSocket.OPEN) {
      this.upbitWs.close(1000, 'Service shutdown');
      this.upbitWs = null;
    }
    
    logger.info('TicksService disconnected');
  }
}

export default TicksService;