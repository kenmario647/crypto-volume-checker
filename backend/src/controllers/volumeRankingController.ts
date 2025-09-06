import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { StartupVolumeTracker } from '../services/startupVolumeTracker';
import { HourlyRankTracker } from '../services/hourlyRankTracker';

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
      const hourlyTracker = HourlyRankTracker.getInstance();
      
      // Add hourly data to each ranking
      const enhancedData = binanceData.map((item: any) => ({
        ...item,
        hourlyChanges: hourlyTracker.getFormattedHourlyChanges('binance', item.symbol)
      }));
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: enhancedData,
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
      const hourlyTracker = HourlyRankTracker.getInstance();
      
      // Add hourly data to each ranking
      const enhancedData = binanceSpotData.map((item: any) => ({
        ...item,
        hourlyChanges: hourlyTracker.getFormattedHourlyChanges('binance-spot', item.symbol)
      }));
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: enhancedData,
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
      const hourlyTracker = HourlyRankTracker.getInstance();
      
      // Add hourly data to each ranking
      const enhancedData = upbitData.map((item: any) => ({
        ...item,
        hourlyChanges: hourlyTracker.getFormattedHourlyChanges('upbit', item.symbol)
      }));
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: enhancedData,
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
      const hourlyTracker = HourlyRankTracker.getInstance();
      
      // Add hourly data to each ranking
      const enhancedData = bybitData.map((item: any) => ({
        ...item,
        hourlyChanges: hourlyTracker.getFormattedHourlyChanges('bybit', item.symbol)
      }));
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: enhancedData,
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
      const hourlyTracker = HourlyRankTracker.getInstance();
      
      // Add hourly data to each ranking
      const enhancedData = okxData.map((item: any) => ({
        ...item,
        hourlyChanges: hourlyTracker.getFormattedHourlyChanges('okx', item.symbol)
      }));
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: enhancedData,
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
      const hourlyTracker = HourlyRankTracker.getInstance();
      
      // Add hourly data to each ranking
      const enhancedData = gateioData.map((item: any) => ({
        ...item,
        hourlyChanges: hourlyTracker.getFormattedHourlyChanges('gateio', item.symbol)
      }));
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: enhancedData,
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
      const hourlyTracker = HourlyRankTracker.getInstance();
      
      // Add hourly data to each ranking
      const enhancedData = bitgetData.map((item: any) => ({
        ...item,
        hourlyChanges: hourlyTracker.getFormattedHourlyChanges('bitget', item.symbol)
      }));
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: enhancedData,
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
      const hourlyTracker = HourlyRankTracker.getInstance();
      
      // Add hourly data to each ranking for spot data
      const enhancedSpotData = (mexcData.spot || []).map((item: any) => ({
        ...item,
        hourlyChanges: hourlyTracker.getFormattedHourlyChanges('mexc', item.symbol)
      }));
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: enhancedSpotData,
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
      const hourlyTracker = HourlyRankTracker.getInstance();
      
      // Add hourly data to each ranking
      const enhancedData = bithumbData.map((item: any) => ({
        ...item,
        hourlyChanges: hourlyTracker.getFormattedHourlyChanges('bithumb', item.symbol)
      }));
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: enhancedData,
          exchange: 'bithumb',
          updateTime: new Date().toISOString(),
          totalPairs: enhancedData.length
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
      const hourlyTracker = HourlyRankTracker.getInstance();
      
      // Add hourly data to each ranking
      const enhancedData = coinbaseData.map((item: any) => ({
        ...item,
        hourlyChanges: hourlyTracker.getFormattedHourlyChanges('coinbase', item.symbol)
      }));
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          rankings: enhancedData,
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