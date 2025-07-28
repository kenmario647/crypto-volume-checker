import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface BybitOrderResponse {
  orderId: string;
  symbol: string;
  side: string;
  orderType: string;
  qty: string;
  price?: string;
  createTime: string;
}

export interface OrderBookData {
  symbol: string;
  bids: { price: number; size: number }[];
  asks: { price: number; size: number }[];
  bestBid: number;
  bestAsk: number;
  spread: number;
}

export interface OrderStatus {
  orderId: string;
  symbol: string;
  side: string;
  orderType: string;
  qty: number;
  price: number;
  avgPrice: number;
  orderStatus: string;
  cumExecQty: number;
  createTime: string;
  updateTime: string;
}

export class BybitClient {
  private static instance: BybitClient;
  private apiKey: string;
  private apiSecret: string;
  private baseURL: string;

  constructor() {
    this.apiKey = process.env.BYBIT_API_KEY!;
    this.apiSecret = process.env.BYBIT_API_SECRET!;
    this.baseURL = process.env.BYBIT_TESTNET === 'true' 
      ? 'https://api-testnet.bybit.com' 
      : 'https://api.bybit.com';
    
    logger.info(`BybitClient initialized: ${this.baseURL}`);
  }

  public static getInstance(): BybitClient {
    if (!BybitClient.instance) {
      BybitClient.instance = new BybitClient();
    }
    return BybitClient.instance;
  }

  // 指値ロングポジション建て
  async createLimitLongPosition(
    symbol: string, 
    quantity: number, 
    limitPrice: number
  ): Promise<BybitOrderResponse> {
    const params = {
      category: 'linear',
      symbol: symbol,
      side: 'Buy',
      orderType: 'Limit',
      qty: quantity.toString(),
      price: limitPrice.toString(),
      timeInForce: 'GTC'
    };

    logger.info(`📊 Placing LIMIT LONG order: ${symbol} x${quantity} @ $${limitPrice}`);
    
    const response = await this.makeRestRequest('POST', '/v5/order/create', params);
    
    const result: BybitOrderResponse = {
      orderId: response.result.orderId,
      symbol: response.result.symbol,
      side: response.result.side,
      orderType: response.result.orderType,
      qty: response.result.qty,
      price: response.result.price,
      createTime: response.result.createdTime
    };

    logger.info(`✅ Order placed successfully: ${result.orderId}`);
    return result;
  }

  // 現在価格取得
  async getCurrentPrice(symbol: string): Promise<number> {
    const params = {
      category: 'linear',
      symbol: symbol
    };

    const response = await this.makeRestRequest('GET', '/v5/market/tickers', params);
    const price = parseFloat(response.result.list[0].lastPrice);
    
    logger.info(`💲 Current price for ${symbol}: $${price}`);
    return price;
  }

  // 板情報取得
  async getOrderBook(symbol: string): Promise<OrderBookData> {
    const params = {
      category: 'linear',
      symbol: symbol,
      limit: 5
    };

    const response = await this.makeRestRequest('GET', '/v5/market/orderbook', params);

    const asks = response.result.a.map(([price, size]: [string, string]) => ({
      price: parseFloat(price),
      size: parseFloat(size)
    }));

    const bids = response.result.b.map(([price, size]: [string, string]) => ({
      price: parseFloat(price),
      size: parseFloat(size)
    }));

    const orderBook: OrderBookData = {
      symbol,
      bids,
      asks,
      bestBid: bids[0]?.price || 0,
      bestAsk: asks[0]?.price || 0,
      spread: asks[0] && bids[0] ? asks[0].price - bids[0].price : 0
    };

    logger.info(`📈 OrderBook for ${symbol}: Best Bid: $${orderBook.bestBid}, Best Ask: $${orderBook.bestAsk}`);
    return orderBook;
  }

  // 残高確認
  async getBalance(): Promise<{ availableBalance: number }> {
    const params = {
      accountType: 'UNIFIED'
    };

    const response = await this.makeRestRequest('GET', '/v5/account/wallet-balance', params);
    const account = response.result.list[0];
    const usdtBalance = account.coin.find((coin: any) => coin.coin === 'USDT');
    
    const availableBalance = parseFloat(usdtBalance?.availableToWithdraw || '0');
    
    logger.info(`💰 Available USDT balance: $${availableBalance}`);
    return { availableBalance };
  }

  // 注文状況確認
  async getOrderStatus(orderId: string): Promise<OrderStatus> {
    const params = {
      category: 'linear',
      orderId: orderId
    };

    const response = await this.makeRestRequest('GET', '/v5/order/realtime', params);
    const order = response.result.list[0];

    const status: OrderStatus = {
      orderId: order.orderId,
      symbol: order.symbol,
      side: order.side,
      orderType: order.orderType,
      qty: parseFloat(order.qty),
      price: parseFloat(order.price),
      avgPrice: parseFloat(order.avgPrice || '0'),
      orderStatus: order.orderStatus,
      cumExecQty: parseFloat(order.cumExecQty || '0'),
      createTime: order.createdTime,
      updateTime: order.updatedTime
    };

    logger.info(`📋 Order status for ${orderId}: ${status.orderStatus}`);
    return status;
  }

  // 注文キャンセル
  async cancelOrder(orderId: string, symbol: string): Promise<boolean> {
    try {
      const params = {
        category: 'linear',
        symbol: symbol,
        orderId: orderId
      };

      await this.makeRestRequest('POST', '/v5/order/cancel', params);
      logger.info(`🗑️ Order cancelled: ${orderId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to cancel order ${orderId}:`, error);
      return false;
    }
  }

  // REST API共通処理
  private async makeRestRequest(method: string, endpoint: string, params: any): Promise<any> {
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    
    let queryString = '';
    let body = '';
    
    if (method === 'GET') {
      queryString = Object.keys(params)
        .sort()
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');
    } else {
      body = JSON.stringify(params);
    }
    
    const signaturePayload = timestamp + this.apiKey + recvWindow + (method === 'GET' ? queryString : body);
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(signaturePayload)
      .digest('hex');

    const url = method === 'GET' && queryString 
      ? `${this.baseURL}${endpoint}?${queryString}`
      : `${this.baseURL}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'X-BAPI-API-KEY': this.apiKey,
        'X-BAPI-SIGN': signature,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'Content-Type': 'application/json'
      }
    };

    if (method === 'POST') {
      options.body = body;
    }

    try {
      const response = await fetch(url, options);
      const data = await response.json() as any;
      
      if (data.retCode !== 0) {
        throw new Error(`Bybit API Error [${data.retCode}]: ${data.retMsg}`);
      }
      
      return data;
    } catch (error) {
      logger.error(`Bybit API request failed: ${method} ${endpoint}`, error);
      throw error;
    }
  }
}

export default BybitClient;