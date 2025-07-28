import { Request, Response } from 'express';
import { MomentumService } from '../services/momentumService';
import { ApiResponse, MomentumData } from '../types';
import { logger } from '../utils/logger';

export class MomentumController {
  private momentumService: MomentumService;

  constructor() {
    this.momentumService = new MomentumService();
  }

  async getTop5Momentum(req: Request, res: Response) {
    try {
      const momentumData = await this.momentumService.getTop5Momentum();
      
      const response: ApiResponse<MomentumData[]> = {
        success: true,
        data: momentumData,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getTop5Momentum:', error);
      res.status(500).json({
        success: false,
        data: [],
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getTopGainers(req: Request, res: Response) {
    try {
      const gainers = await this.momentumService.getTopGainers();
      
      const response: ApiResponse<MomentumData[]> = {
        success: true,
        data: gainers,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getTopGainers:', error);
      res.status(500).json({
        success: false,
        data: [],
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getTopLosers(req: Request, res: Response) {
    try {
      const losers = await this.momentumService.getTopLosers();
      
      const response: ApiResponse<MomentumData[]> = {
        success: true,
        data: losers,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getTopLosers:', error);
      res.status(500).json({
        success: false,
        data: [],
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
}