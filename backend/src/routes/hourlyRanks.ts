import express from 'express';
import { HourlyRankTracker } from '../services/hourlyRankTracker';
import { logger } from '../utils/logger';

const router = express.Router();

// Get hourly rank data for a specific symbol and exchange
router.get('/:exchange/:symbol', (req, res) => {
  try {
    const { exchange, symbol } = req.params;
    const tracker = HourlyRankTracker.getInstance();
    
    const data = tracker.getHourlyData(exchange, symbol);
    const changes = tracker.getFormattedHourlyChanges(exchange, symbol);
    
    res.json({
      success: true,
      data: {
        symbol,
        exchange,
        hourlyData: data,
        changes: changes
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching hourly rank data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch hourly rank data'
    });
  }
});

// Get all hourly rank data for an exchange
router.get('/:exchange', (req, res) => {
  try {
    const { exchange } = req.params;
    const tracker = HourlyRankTracker.getInstance();
    
    const data = tracker.getExchangeHourlyData(exchange);
    const formattedData = data.map(item => ({
      symbol: item.symbol,
      startRank: item.startRank,
      currentRank: item.currentRank,
      changes: tracker.getFormattedHourlyChanges(exchange, item.symbol)
    }));
    
    res.json({
      success: true,
      data: formattedData,
      stats: tracker.getStats(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching exchange hourly data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch exchange hourly data'
    });
  }
});

// Get tracker stats
router.get('/stats/all', (req, res) => {
  try {
    const tracker = HourlyRankTracker.getInstance();
    
    res.json({
      success: true,
      data: tracker.getStats(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching hourly tracker stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tracker stats'
    });
  }
});

// Manual reset endpoint (for testing)
router.post('/reset', (req, res) => {
  try {
    const tracker = HourlyRankTracker.getInstance();
    tracker.resetAllData();
    
    res.json({
      success: true,
      message: 'Hourly rank data reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error resetting hourly data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset hourly data'
    });
  }
});

// Manual snapshot endpoint (for testing)
router.post('/snapshot', (req, res) => {
  try {
    const tracker = HourlyRankTracker.getInstance();
    const { time } = req.body;
    tracker.takeHourlySnapshot(time);
    
    res.json({
      success: true,
      message: 'Hourly snapshot taken successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error taking snapshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to take snapshot'
    });
  }
});

export default router;