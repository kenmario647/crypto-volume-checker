import { Server } from 'socket.io';
import cron from 'node-cron';
import { WebSocketMessage } from '../types';
import { VolumeService } from './volumeService';
import { MomentumService } from './momentumService';
import { ExchangeService } from './exchangeService';
import { logger } from '../utils/logger';

export class WebSocketService {
  private io: Server;
  private volumeService: VolumeService;
  private momentumService: MomentumService;
  private exchangeService: ExchangeService;

  constructor(io: Server) {
    this.io = io;
    this.volumeService = new VolumeService();
    this.momentumService = new MomentumService();
    this.exchangeService = new ExchangeService();
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
    cron.schedule('*/30 * * * * *', async () => {
      try {
        await this.broadcastVolumeData();
      } catch (error) {
        logger.error('Error broadcasting volume data:', error);
      }
    });

    cron.schedule('*/60 * * * * *', async () => {
      try {
        await this.broadcastMomentumData();
      } catch (error) {
        logger.error('Error broadcasting momentum data:', error);
      }
    });

    cron.schedule('*/2 * * * *', async () => {
      try {
        await this.broadcastExchangeData();
      } catch (error) {
        logger.error('Error broadcasting exchange data:', error);
      }
    });

    logger.info('WebSocket data broadcasting started');
  }

  private async broadcastVolumeData() {
    const volumeData = await this.volumeService.getVolume24h();
    const chartData = await this.volumeService.getVolumeChart();
    
    const message: WebSocketMessage = {
      type: 'volume',
      data: {
        volume24h: volumeData,
        chart: chartData
      },
      timestamp: new Date().toISOString()
    };

    this.io.to('volume').emit('volume-update', message);
    logger.debug('Volume data broadcasted');
  }

  private async broadcastMomentumData() {
    const momentumData = await this.momentumService.getTop5Momentum();
    
    const message: WebSocketMessage = {
      type: 'momentum',
      data: momentumData,
      timestamp: new Date().toISOString()
    };

    this.io.to('momentum').emit('momentum-update', message);
    logger.debug('Momentum data broadcasted');
  }

  private async broadcastExchangeData() {
    const exchangeData = await this.exchangeService.getAllExchangeData();
    
    const message: WebSocketMessage = {
      type: 'exchange',
      data: exchangeData,
      timestamp: new Date().toISOString()
    };

    this.io.to('exchange').emit('exchange-update', message);
    logger.debug('Exchange data broadcasted');
  }

  broadcastSystemMessage(message: string) {
    this.io.emit('system-message', {
      type: 'system',
      data: { message },
      timestamp: new Date().toISOString()
    });
    logger.info(`System message broadcasted: ${message}`);
  }
}