import { Request, Response } from 'express';
import { PriceDeviationHistoryService } from '../services/priceDeviationHistoryService';
import { logger } from '../utils/logger';

export class PriceDeviationHistoryController {
  private historyService: PriceDeviationHistoryService;

  constructor() {
    this.historyService = PriceDeviationHistoryService.getInstance();
  }

  /**
   * 特定のシンボルの履歴データを取得
   */
  public getSymbolHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { symbol } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      if (!symbol) {
        res.status(400).json({
          success: false,
          error: 'Symbol parameter is required'
        });
        return;
      }

      const history = this.historyService.getSymbolHistory(symbol.toUpperCase(), limit);

      res.json({
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          dataPoints: history.length,
          history: history.map(point => ({
            timestamp: point.timestamp,
            time: new Date(point.timestamp).toISOString(),
            deviation: point.deviation,
            spotPrice: point.spotPrice,
            perpPrice: point.perpPrice,
            spotExchange: point.spotExchange,
            perpExchange: point.perpExchange,
            totalVolume: point.totalVolume,
            fundingRate: point.fundingRate
          }))
        }
      });

      logger.info(`Retrieved ${history.length} history points for symbol: ${symbol}`);
    } catch (error) {
      logger.error('Error retrieving symbol history:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * 利用可能なシンボル一覧を取得
   */
  public getAvailableSymbols = async (req: Request, res: Response): Promise<void> => {
    try {
      const symbols = this.historyService.getAvailableSymbols();

      res.json({
        success: true,
        data: {
          symbols,
          count: symbols.length
        }
      });

      logger.info(`Retrieved ${symbols.length} available symbols`);
    } catch (error) {
      logger.error('Error retrieving available symbols:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * データ収集状況を取得
   */
  public getCollectionStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const status = this.historyService.getCollectionStatus();

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Error retrieving collection status:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * 複数シンボルの最新データを取得
   */
  public getLatestData = async (req: Request, res: Response): Promise<void> => {
    try {
      const symbols = req.query.symbols as string;
      const symbolList = symbols ? symbols.split(',').map(s => s.trim().toUpperCase()) : this.historyService.getAvailableSymbols();

      const latestData = symbolList.map(symbol => {
        const latest = this.historyService.getLatestData(symbol);
        return {
          symbol,
          latestData: latest ? {
            timestamp: latest.timestamp,
            time: new Date(latest.timestamp).toISOString(),
            deviation: latest.deviation,
            spotPrice: latest.spotPrice,
            perpPrice: latest.perpPrice,
            spotExchange: latest.spotExchange,
            perpExchange: latest.perpExchange,
            totalVolume: latest.totalVolume,
            fundingRate: latest.fundingRate
          } : null
        };
      }).filter(item => item.latestData !== null);

      res.json({
        success: true,
        data: latestData
      });

      logger.info(`Retrieved latest data for ${latestData.length} symbols`);
    } catch (error) {
      logger.error('Error retrieving latest data:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * 古いデータのクリーンアップを手動実行
   */
  public cleanupOldData = async (req: Request, res: Response): Promise<void> => {
    try {
      this.historyService.cleanupOldData();

      res.json({
        success: true,
        message: 'Old data cleanup completed'
      });

      logger.info('Manual cleanup of old deviation history data completed');
    } catch (error) {
      logger.error('Error during manual cleanup:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
}