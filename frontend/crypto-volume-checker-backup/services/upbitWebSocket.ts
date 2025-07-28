import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface UpbitVolumeData {
  symbol: string;
  volume: number;
  quoteVolume: number;
  priceChangePercent: number;
  lastPrice: number;
  rank: number;
  exchange: 'upbit';
}

export class UpbitWebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private volumeData: Map<string, UpbitVolumeData> = new Map();
  private markets: string[] = [];

  constructor() {
    super();
    this.initializeMarkets();
  }

  private async initializeMarkets() {
    try {
      // Get KRW markets from Upbit API
      const response = await fetch('https://api.upbit.com/v1/market/all');
      const data = await response.json();
      
      this.markets = data
        .filter((market: any) => market.market.startsWith('KRW-'))
        .map((market: any) => market.market);

      logger.info(`Upbit markets loaded: ${this.markets.length} KRW pairs`);
      
      // Start WebSocket connection
      this.connect();
      
      // Get initial ticker data every minute
      this.startTickerUpdates();
    } catch (error) {
      logger.error('Failed to initialize Upbit markets:', error);
      setTimeout(() => this.initializeMarkets(), 5000);
    }
  }

  private connect() {
    if (this.isConnecting || this.markets.length === 0) return;
    
    this.isConnecting = true;

    try {
      this.ws = new WebSocket('wss://api.upbit.com/websocket/v1');

      this.ws.on('open', () => {
        logger.info('Upbit WebSocket connected');
        this.isConnecting = false;
        
        // Subscribe to ticker data for all KRW markets
        const subscribeMessage = [
          {
            ticket: 'volume-tracker'
          },
          {
            type: 'ticker',
            codes: this.markets
          }
        ];

        this.ws?.send(JSON.stringify(subscribeMessage));

        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const tickerData = JSON.parse(data.toString());
          this.processTickerData(tickerData);
        } catch (error) {
          logger.error('Error parsing Upbit WebSocket data:', error);
        }
      });

      this.ws.on('error', (error) => {
        logger.error('Upbit WebSocket error:', error);
        this.isConnecting = false;
      });

      this.ws.on('close', () => {
        logger.warn('Upbit WebSocket connection closed');
        this.isConnecting = false;
        this.scheduleReconnect();
      });

    } catch (error) {
      logger.error('Failed to connect to Upbit WebSocket:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private processTickerData(ticker: any) {
    if (ticker.type !== 'ticker' || !ticker.code) return;

    const symbol = ticker.code.replace('KRW-', '');
    const volumeData: UpbitVolumeData = {
      symbol,
      volume: ticker.acc_trade_volume_24h || 0,
      quoteVolume: ticker.acc_trade_price_24h || 0,
      priceChangePercent: (ticker.signed_change_rate || 0) * 100,
      lastPrice: ticker.trade_price || 0,
      rank: 0,
      exchange: 'upbit'
    };

    this.volumeData.set(symbol, volumeData);

    // Update rankings and emit top 20
    this.updateRankingsAndEmit();
  }

  private startTickerUpdates() {
    // Update ticker data every minute using REST API as fallback
    setInterval(async () => {
      try {
        const response = await fetch(`https://api.upbit.com/v1/ticker?markets=${this.markets.join(',')}`);
        const tickers = await response.json();

        tickers.forEach((ticker: any) => {
          this.processTickerData({
            type: 'ticker',
            code: ticker.market,
            acc_trade_volume_24h: ticker.acc_trade_volume_24h,
            acc_trade_price_24h: ticker.acc_trade_price_24h,
            signed_change_rate: ticker.signed_change_rate,
            trade_price: ticker.trade_price
          });
        });
      } catch (error) {
        logger.error('Error fetching Upbit ticker data:', error);
      }
    }, 60000); // Every minute
  }

  private updateRankingsAndEmit() {
    const sortedData = Array.from(this.volumeData.values())
      .sort((a, b) => b.quoteVolume - a.quoteVolume)
      .slice(0, 20)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    // Update volume data map with rankings
    sortedData.forEach(item => {
      this.volumeData.set(item.symbol, item);
    });

    this.emit('volumeUpdate', sortedData);
    
    logger.debug(`Upbit volume data updated: ${sortedData.length} pairs`);
  }

  private scheduleReconnect() {
    if (this.reconnectInterval) return;

    this.reconnectInterval = setInterval(() => {
      logger.info('Attempting to reconnect to Upbit WebSocket...');
      this.connect();
    }, 5000);
  }

  public getVolumeData(): UpbitVolumeData[] {
    return Array.from(this.volumeData.values())
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 20);
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

export default UpbitWebSocketService;