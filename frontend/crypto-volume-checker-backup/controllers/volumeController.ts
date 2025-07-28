import { Request, Response } from 'express';
import { VolumeService } from '../services/volumeService';
import { ApiResponse, VolumeData } from '../types';
import { logger } from '../utils/logger';
import { realTimeVolumeService } from './volumeRankingController';

export class VolumeController {
  private volumeService: VolumeService;

  constructor() {
    this.volumeService = new VolumeService();
  }

  async getVolume24h(req: Request, res: Response) {
    try {
      const volumeData = await this.volumeService.getVolume24h();
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          totalVolume: volumeData.totalVolume,
          change: volumeData.change,
          topSymbols: volumeData.topSymbols
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getVolume24h:', error);
      res.status(500).json({
        success: false,
        data: null,
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getVolumeChart(req: Request, res: Response) {
    try {
      const chartData = await this.volumeService.getVolumeChart();
      
      const response: ApiResponse<any> = {
        success: true,
        data: chartData,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getVolumeChart:', error);
      res.status(500).json({
        success: false,
        data: null,
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getVolumeChange(req: Request, res: Response) {
    try {
      const changeData = await this.volumeService.getVolumeChange();
      
      const response: ApiResponse<any> = {
        success: true,
        data: changeData,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getVolumeChange:', error);
      res.status(500).json({
        success: false,
        data: null,
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getSymbolVolumeChart(req: Request, res: Response) {
    try {
      const { symbol, exchange } = req.params;
      const { interval = '5m', limit = 36 } = req.query; // Default to 36 = 3 hours for better visibility
      
      const chartData = await this.volumeService.getSymbolVolumeChart(symbol, exchange, interval as string, Number(limit), realTimeVolumeService);
      
      const response: ApiResponse<any> = {
        success: true,
        data: chartData,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getSymbolVolumeChart:', error);
      res.status(500).json({
        success: false,
        data: null,
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
}