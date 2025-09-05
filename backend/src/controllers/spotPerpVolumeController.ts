import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { SpotPerpVolumeService } from '../services/spotPerpVolumeService';
import { HourlyRankTracker } from '../services/hourlyRankTracker';

export class SpotPerpVolumeController {
  private spotPerpVolumeService: SpotPerpVolumeService;

  constructor(spotPerpVolumeService: SpotPerpVolumeService) {
    this.spotPerpVolumeService = spotPerpVolumeService;
  }

  async getSpotVolumes(req: Request, res: Response) {
    try {
      const { exchange } = req.query;
      const limit = parseInt(req.query.limit as string) || 15;

      if (!exchange) {
        return res.status(400).json({
          success: false,
          message: 'Exchange parameter is required'
        });
      }

      const data = await this.spotPerpVolumeService.getSpotVolumes(exchange as string, limit);
      const hourlyTracker = HourlyRankTracker.getInstance();
      
      // Add hourly data to each ranking (use exchange-spot to differentiate from PERP)
      const enhancedData = data.map((item: any) => ({
        ...item,
        hourlyChanges: hourlyTracker.getFormattedHourlyChanges(`${exchange}-spot`, item.symbol)
      }));
      
      res.json({
        success: true,
        data: enhancedData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error fetching spot volumes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch spot volumes',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getPerpVolumes(req: Request, res: Response) {
    try {
      const { exchange } = req.query;
      const limit = parseInt(req.query.limit as string) || 15;

      if (!exchange) {
        return res.status(400).json({
          success: false,
          message: 'Exchange parameter is required'
        });
      }

      const data = await this.spotPerpVolumeService.getPerpVolumes(exchange as string, limit);
      const hourlyTracker = HourlyRankTracker.getInstance();
      
      // Add hourly data to each ranking (use exchange-perp to differentiate from SPOT)
      const enhancedData = data.map((item: any) => ({
        ...item,
        hourlyChanges: hourlyTracker.getFormattedHourlyChanges(`${exchange}-perp`, item.symbol)
      }));
      
      res.json({
        success: true,
        data: enhancedData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error fetching perp volumes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch perp volumes',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getCombinedVolumes(req: Request, res: Response) {
    try {
      const { exchange } = req.query;
      const limit = parseInt(req.query.limit as string) || 15;

      if (!exchange) {
        return res.status(400).json({
          success: false,
          message: 'Exchange parameter is required'
        });
      }

      const data = await this.spotPerpVolumeService.getCombinedVolumes(exchange as string, limit);
      
      res.json({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error fetching combined volumes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch combined volumes',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}