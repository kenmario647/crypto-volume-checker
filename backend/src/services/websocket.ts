import { Server } from 'socket.io';
import * as cron from 'node-cron';
import { WebSocketMessage } from '../types';
import { VolumeService } from './volumeService';
import { MomentumService } from './momentumService';
import { ExchangeService } from './exchangeService';
import { RealTimeVolumeService } from './realTimeVolumeService';
import { logger } from '../utils/logger';

export class WebSocketService {
  private io: Server;
  private volumeService: VolumeService;
  private momentumService: MomentumService;
  private exchangeService: ExchangeService;
  private realTimeVolumeService: RealTimeVolumeService;

  constructor(io: Server, realTimeVolumeService: RealTimeVolumeService) {
    this.io = io;
    this.volumeService = new VolumeService(io);
    this.momentumService = new MomentumService();
    this.exchangeService = new ExchangeService();
    this.realTimeVolumeService = realTimeVolumeService;
  }

  initialize() {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);

      socket.emit('message', {
        type: 'connection',
        data: { message: 'Connected to Volume ChinChin Pro' },
        timestamp: new Date().toISOString()
      });

      socket.on('subscribe', (data) => {
        const { type } = data;
        socket.join(type);
        logger.info(`Client ${socket.id} subscribed to ${type}`);
      });

      socket.on('unsubscribe', (data) => {
        const { type } = data;
        socket.leave(type);
        logger.info(`Client ${socket.id} unsubscribed from ${type}`);
      });

      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
      });
    });

    this.startDataBroadcasting();
  }

  private startDataBroadcasting() {
    // Add automatic cross detection for top 20 symbols every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        await this.performAutomaticCrossDetection();
      } catch (error) {
        logger.error('Error performing automatic cross detection:', error);
      }
    });

    logger.info('WebSocket cross detection started');
  }


  broadcastSystemMessage(message: string) {
    this.io.emit('system-message', {
      type: 'system',
      data: { message },
      timestamp: new Date().toISOString()
    });
    logger.info(`System message broadcasted: ${message}`);
  }

  private async performAutomaticCrossDetection() {
    try {
      logger.info('[AUTO_CROSS_DETECTION] Starting automatic cross detection for top 20 symbols');
      
      // Get top 20 symbols from both exchanges
      const binanceData = this.realTimeVolumeService.getBinanceData().slice(0, 20);
      const upbitData = this.realTimeVolumeService.getUpbitData().slice(0, 20);
      
      // Process Binance symbols
      for (const ticker of binanceData) {
        try {
          await this.volumeService.getSymbolVolumeChart(
            ticker.symbol, 
            'binance', 
            '5m', 
            36, 
            this.realTimeVolumeService
          );
        } catch (error) {
          logger.error(`[AUTO_CROSS_DETECTION] Error processing Binance ${ticker.symbol}:`, error);
        }
      }
      
      // Process Upbit symbols
      for (const ticker of upbitData) {
        try {
          await this.volumeService.getSymbolVolumeChart(
            ticker.symbol, 
            'upbit', 
            '5m', 
            36, 
            this.realTimeVolumeService
          );
        } catch (error) {
          logger.error(`[AUTO_CROSS_DETECTION] Error processing Upbit ${ticker.symbol}:`, error);
        }
      }
      
      logger.info('[AUTO_CROSS_DETECTION] Completed automatic cross detection');
    } catch (error) {
      logger.error('[AUTO_CROSS_DETECTION] Failed to perform automatic cross detection:', error);
    }
  }
}