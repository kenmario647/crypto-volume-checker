import { Request, Response } from 'express';
import { ExchangeService } from '../services/exchangeService';
import { ApiResponse, ExchangeData } from '../types';
import { logger } from '../utils/logger';

export class ExchangeController {
  private exchangeService: ExchangeService;

  constructor() {
    this.exchangeService = new ExchangeService();
  }

  async getExchangeData(req: Request, res: Response) {
    try {
      const exchangeData = await this.exchangeService.getAllExchangeData();
      
      const response: ApiResponse<ExchangeData[]> = {
        success: true,
        data: exchangeData,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getExchangeData:', error);
      res.status(500).json({
        success: false,
        data: [],
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getExchangeStatus(req: Request, res: Response) {
    try {
      const statusData = await this.exchangeService.getExchangeStatus();
      
      const response: ApiResponse<any> = {
        success: true,
        data: statusData,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getExchangeStatus:', error);
      res.status(500).json({
        success: false,
        data: null,
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getExchangeVolume(req: Request, res: Response) {
    try {
      const { exchange } = req.params;
      const volumeData = await this.exchangeService.getExchangeVolume(exchange);
      
      const response: ApiResponse<any> = {
        success: true,
        data: volumeData,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getExchangeVolume:', error);
      res.status(500).json({
        success: false,
        data: null,
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
}