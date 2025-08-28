import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { StartupVolumeTracker } from '../services/startupVolumeTracker';

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
      
      const volumeTracker = StartupVolumeTracker.getInstance();
      const response: ApiResponse<any> = {
        success: true,
        data: {
          binance: binanceData,
          upbit: upbitData,
          updateTime: new Date().toISOString(),
          totalPairs: binanceData.length + upbitData.length,
          startupTime: new Date(volumeTracker.getStartupTime()).toISOString(),
          timeSinceStartup: volumeTracker.getTimeSinceStartup()
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

  async getBinanceSpotRanking(req: Request, res: Response) {
    try {
      if (!realTimeVolumeService) {
        return res.status(503).json({
          success: false,
          data: [],
          message: 'Real-time volume service not available',
          timestamp: new Date().toISOString()
        });
      }

      const binanceSpotData = realTimeVolumeService.getBinanceSpotData();
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: binanceSpotData,
          exchange: 'binance-spot',
          updateTime: new Date().toISOString(),
          totalPairs: binanceSpotData.length
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getBinanceSpotRanking:', error);
      res.status(500).json({
        success: false,
        data: [],
        error: 'Failed to fetch Binance SPOT volume ranking',
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

  async getBybitRanking(req: Request, res: Response) {
    try {
      if (!realTimeVolumeService) {
        return res.status(503).json({
          success: false,
          data: [],
          message: 'Real-time volume service not available',
          timestamp: new Date().toISOString()
        });
      }

      const bybitData = realTimeVolumeService.getBybitData();
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: bybitData,
          exchange: 'bybit',
          updateTime: new Date().toISOString(),
          totalPairs: bybitData.length
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getBybitRanking:', error);
      res.status(500).json({
        success: false,
        data: [],
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getOkxRanking(req: Request, res: Response) {
    try {
      if (!realTimeVolumeService) {
        return res.status(503).json({
          success: false,
          data: [],
          message: 'Real-time volume service not available',
          timestamp: new Date().toISOString()
        });
      }

      const okxData = realTimeVolumeService.getOkxData();
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: okxData,
          exchange: 'okx',
          updateTime: new Date().toISOString(),
          totalPairs: okxData.length
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getOkxRanking:', error);
      res.status(500).json({
        success: false,
        data: [],
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getGateioRanking(req: Request, res: Response) {
    try {
      if (!realTimeVolumeService) {
        return res.status(503).json({
          success: false,
          data: [],
          message: 'Real-time volume service not available',
          timestamp: new Date().toISOString()
        });
      }

      const gateioData = realTimeVolumeService.getGateioData();
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: gateioData,
          exchange: 'gateio',
          updateTime: new Date().toISOString(),
          totalPairs: gateioData.length
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getGateioRanking:', error);
      res.status(500).json({
        success: false,
        data: [],
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getBitgetRanking(req: Request, res: Response) {
    try {
      if (!realTimeVolumeService) {
        return res.status(503).json({
          success: false,
          data: [],
          message: 'Real-time volume service not available',
          timestamp: new Date().toISOString()
        });
      }

      const bitgetData = realTimeVolumeService.getBitgetData();
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: bitgetData,
          exchange: 'bitget',
          updateTime: new Date().toISOString(),
          totalPairs: bitgetData.length
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getBitgetRanking:', error);
      res.status(500).json({
        success: false,
        data: [],
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getMexcRanking(req: Request, res: Response) {
    try {
      if (!realTimeVolumeService) {
        return res.status(503).json({
          success: false,
          data: [],
          message: 'Real-time volume service not available',
          timestamp: new Date().toISOString()
        });
      }

      const mexcData = realTimeVolumeService.getMexcData();
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: mexcData.spot || [],
          futures: mexcData.futures || [],
          exchange: 'mexc',
          updateTime: new Date().toISOString(),
          totalPairs: (mexcData.spot?.length || 0) + (mexcData.futures?.length || 0)
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getMexcRanking:', error);
      res.status(500).json({
        success: false,
        data: [],
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getBithumbRanking(req: Request, res: Response) {
    try {
      if (!realTimeVolumeService) {
        return res.status(503).json({
          success: false,
          data: [],
          message: 'Real-time volume service not available',
          timestamp: new Date().toISOString()
        });
      }

      const bithumbData = realTimeVolumeService.getBithumbData();
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: bithumbData,
          exchange: 'bithumb',
          updateTime: new Date().toISOString(),
          totalPairs: bithumbData.length
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getBithumbRanking:', error);
      res.status(500).json({
        success: false,
        data: [],
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getCoinbaseRanking(req: Request, res: Response) {
    try {
      if (!realTimeVolumeService) {
        return res.status(503).json({
          success: false,
          data: [],
          message: 'Real-time volume service not available',
          timestamp: new Date().toISOString()
        });
      }

      const coinbaseData = realTimeVolumeService.getCoinbaseData();
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: coinbaseData,
          exchange: 'coinbase',
          updateTime: new Date().toISOString(),
          totalPairs: coinbaseData.length
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getCoinbaseRanking:', error);
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