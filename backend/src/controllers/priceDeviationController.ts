import { Request, Response } from 'express';
import { PriceDeviationService } from '../services/priceDeviationService';
import { logger } from '../utils/logger';

const priceDeviationService = PriceDeviationService.getInstance();

export const getTopDeviations = async (req: Request, res: Response) => {
  try {
    // Default to 999 (effectively all) if not specified
    const limit = parseInt(req.query.limit as string) || 999;
    const minVolume = req.query.minVolume !== undefined ? parseFloat(req.query.minVolume as string) : 0; // Default 0 (no filter)
    const sortOrder = (req.query.sortOrder as string) || 'asc'; // Default 'asc' (負から正)
    
    // Always use WebSocket real-time prices from all exchanges
    const data = await priceDeviationService.getWebSocketDeviations(limit, minVolume, sortOrder);
    
    res.json({
      success: true,
      data,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error in getTopDeviations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch price deviations'
    });
  }
};

export const getSymbolDebug = async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const debugData = priceDeviationService.getSymbolDebugData(symbol);
    
    res.json({
      success: true,
      symbol,
      data: debugData,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error in getSymbolDebug:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch symbol debug data'
    });
  }
};

