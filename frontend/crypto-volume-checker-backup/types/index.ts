export interface VolumeData {
  symbol: string;
  volume24h: number;
  volumeUsd: number;
  change24h: number;
  timestamp: Date;
}

export interface MomentumData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  momentum: 'up' | 'down';
  rank: number;
}

export interface ExchangeData {
  name: string;
  volume24h: number;
  volumeUsd: number;
  marketShare: number;
  status: 'online' | 'maintenance' | 'offline';
  lastUpdate: Date;
  pairs: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: Date;
}

export interface WebSocketMessage {
  type: 'volume' | 'momentum' | 'exchange' | 'price';
  data: any;
  timestamp: string;
}