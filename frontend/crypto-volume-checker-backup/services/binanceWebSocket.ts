import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface BinanceVolumeData {
  symbol: string;
  volume: string;
  quoteVolume: string;
  priceChangePercent: string;
  lastPrice: string;
  rank: number;
  exchange: 'binance';
}

export class BinanceWebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private volumeData: Map<string, BinanceVolumeData> = new Map();

  constructor() {
    super();
    this.connect();
  }

  private connect() {
    if (this.isConnecting) return;
    
    this.isConnecting = true;
    
    try {
      // Binance 24hr ticker WebSocket stream
      this.ws = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr');

      this.ws.on('open', () => {
        logger.info('Binance WebSocket connected');
        this.isConnecting = false;
        
        // Clear reconnect timer if exists
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const tickerArray = JSON.parse(data.toString());
          this.processTickerData(tickerArray);
        } catch (error) {
          logger.error('Error parsing Binance WebSocket data:', error);
        }
      });

      this.ws.on('error', (error) => {
        logger.error('Binance WebSocket error:', error);
        this.isConnecting = false;
      });

      this.ws.on('close', () => {
        logger.warn('Binance WebSocket connection closed');
        this.isConnecting = false;
        this.scheduleReconnect();
      });

    } catch (error) {
      logger.error('Failed to connect to Binance WebSocket:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private processTickerData(tickerArray: any[]) {
    const usdtPairs = tickerArray
      .filter(ticker => ticker.s.endsWith('USDT'))
      .map(ticker => ({
        symbol: ticker.s.replace('USDT', ''),
        volume: ticker.v,
        quoteVolume: ticker.q,
        priceChangePercent: ticker.P,
        lastPrice: ticker.c,
        rank: 0,
        exchange: 'binance' as const
      }))
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 20)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    // Update volume data map
    this.volumeData.clear();
    usdtPairs.forEach(item => {
      this.volumeData.set(item.symbol, item);
    });

    // Emit updated data
    this.emit('volumeUpdate', usdtPairs);
    
    logger.debug(`Binance volume data updated: ${usdtPairs.length} pairs`);
  }

  private scheduleReconnect() {
    if (this.reconnectInterval) return;

    this.reconnectInterval = setInterval(() => {
      logger.info('Attempting to reconnect to Binance WebSocket...');
      this.connect();
    }, 5000); // Reconnect every 5 seconds
  }

  public getVolumeData(): BinanceVolumeData[] {
    return Array.from(this.volumeData.values()).sort((a, b) => a.rank - b.rank);
  }

  public disconnect() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export default BinanceWebSocketService;