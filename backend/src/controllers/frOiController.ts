import { Request, Response } from 'express';
import { logger } from '../utils/logger';

let frOiService: any = null;

export const setFrOiService = (service: any) => {
  frOiService = service;
};

export class FrOiController {
  async getAlerts(req: Request, res: Response) {
    try {
      if (!frOiService) {
        return res.status(503).json({
          success: false,
          message: 'FR/OI service not initialized',
          data: []
        });
      }

      const alerts = frOiService.getAlerts();
      
      res.json({
        success: true,
        data: alerts,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error fetching FR/OI alerts:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        data: []
      });
    }
  }

  async getCurrentData(req: Request, res: Response) {
    try {
      if (!frOiService) {
        return res.status(503).json({
          success: false,
          message: 'FR/OI service not initialized',
          data: {}
        });
      }

      const currentData = frOiService.getCurrentData();
      const dataArray = Array.from(currentData.entries()).map((entry) => {
        const [symbol, history] = entry as [string, any];
        return {
          symbol,
          frHistory: history.fr,
          oiHistory: history.oi,
          latestFr: history.fr[history.fr.length - 1] || 0,
          latestOi: history.oi[history.oi.length - 1] || 0,
          frTrend: history.fr.length >= 2 ? 
            (history.fr[history.fr.length - 1] - history.fr[history.fr.length - 2]) : 0,
          oiTrend: history.oi.length >= 2 ?
            (history.oi[history.oi.length - 1] - history.oi[history.oi.length - 2]) : 0
        };
      });
      
      res.json({
        success: true,
        data: dataArray,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error fetching current FR/OI data:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        data: {}
      });
    }
  }
}