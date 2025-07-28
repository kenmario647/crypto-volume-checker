import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';

// This will be injected from the main server
export let realTimeVolumeService: any = null;

export const setRealTimeVolumeService = (service: any) => {
  realTimeVolumeService = service;
};

export class VolumeRankingController {
  async getTop20(req: Request, res: Response) {
    try {
      if (!realTimeVolumeService) {
        return res.status(503).json({
          success: false,
          data: [],
          message: 'Real-time volume service not available',
          timestamp: new Date().toISOString()
        });
      }

      const binanceData = realTimeVolumeService.getBinanceData();
      const upbitData = realTimeVolumeService.getUpbitData();
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          binance: binanceData,
          upbit: upbitData,
          updateTime: new Date().toISOString(),
          totalPairs: binanceData.length + upbitData.length
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getTop20:', error);
      res.status(500).json({
        success: false,
        data: [],
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getBinanceRanking(req: Request, res: Response) {
    try {
      if (!realTimeVolumeService) {
        return res.status(503).json({
          success: false,
          data: [],
          message: 'Real-time volume service not available',
          timestamp: new Date().toISOString()
        });
      }

      const binanceData = realTimeVolumeService.getBinanceData();
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: binanceData,
          exchange: 'binance',
          updateTime: new Date().toISOString(),
          totalPairs: binanceData.length
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getBinanceRanking:', error);
      res.status(500).json({
        success: false,
        data: [],
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getUpbitRanking(req: Request, res: Response) {
    try {
      if (!realTimeVolumeService) {
        return res.status(503).json({
          success: false,
          data: [],
          message: 'Real-time volume service not available',
          timestamp: new Date().toISOString()
        });
      }

      const upbitData = realTimeVolumeService.getUpbitData();
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: upbitData,
          exchange: 'upbit',
          updateTime: new Date().toISOString(),
          totalPairs: upbitData.length
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getUpbitRanking:', error);
      res.status(500).json({
        success: false,
        data: [],
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
}

export default VolumeRankingController;