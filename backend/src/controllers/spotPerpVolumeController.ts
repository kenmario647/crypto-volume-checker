import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { SpotPerpVolumeService } from '../services/spotPerpVolumeService';

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
      
      res.json({
        success: true,
        data,
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
      
      res.json({
        success: true,
        data,
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