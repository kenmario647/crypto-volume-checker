import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';

// This will be injected from the main server
export let ticksService: any = null;

export const setTicksService = (service: any) => {
  ticksService = service;
};

export class TicksController {
  async getCurrentTicks(req: Request, res: Response) {
    try {
      if (!ticksService) {
        return res.status(503).json({
          success: false,
          data: [],
          message: 'Ticks service not available',
          timestamp: new Date().toISOString()
        });
      }

      const ticksSummaries = ticksService.getCurrentSummaries();
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          ticks: ticksSummaries,
          updateTime: new Date().toISOString(),
          totalSymbols: ticksSummaries.length
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getCurrentTicks:', error);
      res.status(500).json({
        success: false,
        data: [],
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getTopMovers(req: Request, res: Response) {
    try {
      if (!ticksService) {
        return res.status(503).json({
          success: false,
          data: [],
          message: 'Ticks service not available',
          timestamp: new Date().toISOString()
        });
      }

      const { limit = 20 } = req.query;
      const allTicks = ticksService.getCurrentSummaries();
      
      // Sort by absolute price change percentage (biggest movers first)
      const topMovers = allTicks
        .sort((a: any, b: any) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
        .slice(0, Number(limit));
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          topMovers,
          updateTime: new Date().toISOString(),
          limit: Number(limit)
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getTopMovers:', error);
      res.status(500).json({
        success: false,
        data: [],
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getSymbolTicks(req: Request, res: Response) {
    try {
      const { symbol, exchange } = req.params;
      
      if (!ticksService) {
        return res.status(503).json({
          success: false,
          data: null,
          message: 'Ticks service not available',
          timestamp: new Date().toISOString()
        });
      }

      const allTicks = ticksService.getCurrentSummaries();
      const symbolTick = allTicks.find((tick: any) => 
        tick.symbol === symbol && tick.exchange === exchange
      );
      
      if (!symbolTick) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'Symbol not found',
          timestamp: new Date().toISOString()
        });
      }

      const response: ApiResponse<any> = {
        success: true,
        data: symbolTick,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in getSymbolTicks:', error);
      res.status(500).json({
        success: false,
        data: null,
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
}

export default TicksController;