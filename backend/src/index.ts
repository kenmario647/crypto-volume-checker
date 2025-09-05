import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import volumeRoutes from './routes/volume';
import momentumRoutes from './routes/momentum';
import exchangeRoutes from './routes/exchange';
import volumeRankingRoutes from './routes/volumeRanking';
import notificationRoutes from './routes/notifications';
import tradeRoutes, { initializeTradeRoutes } from './routes/tradeRoutes';
import spotPerpVolumeRoutes from './routes/spotPerpVolume';
import priceDeviationRoutes from './routes/priceDeviation';
import priceDeviationHistoryRoutes from './routes/priceDeviationHistory';
import frOiRoutes from './routes/frOi';
import browserLogsRoutes from './routes/browserLogs';
import hourlyRanksRoutes from './routes/hourlyRanks';
import RealTimeVolumeService from './services/realTimeVolumeService';
import FrOiService from './services/frOiService';
import { setRealTimeVolumeService } from './controllers/volumeRankingController';
import { setIoInstance } from './controllers/volumeController';
import { setFrOiService } from './controllers/frOiController';
import { initializeCrossNotificationService, setCrossNotificationService } from './controllers/notificationController';
import { PriceDeviationHistoryService } from './services/priceDeviationHistoryService';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "https://crypto-volume-checker-frontend.onrender.com"
    ],
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "https://crypto-volume-checker-frontend.onrender.com"
  ],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/volume', volumeRoutes);
app.use('/api/momentum', momentumRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/volume-ranking', volumeRankingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/trade', initializeTradeRoutes(io));
app.use('/api/spot-perp-volume', spotPerpVolumeRoutes);
app.use('/api/price-deviation', priceDeviationRoutes);
app.use('/api/price-deviation-history', priceDeviationHistoryRoutes);
app.use('/api/fr-oi', frOiRoutes);
app.use('/api/browser-logs', browserLogsRoutes);
app.use('/api/hourly-ranks', hourlyRanksRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'crypto-volume-checker-api'
  });
});

// Initialize real-time volume service with priority initialization
logger.info('🚀 Initializing RealTimeVolumeService...');
const realTimeVolumeService = new RealTimeVolumeService();
setRealTimeVolumeService(realTimeVolumeService);
realTimeVolumeService.connect();

// Force immediate data fetch for better initial load
setTimeout(() => {
  logger.info('🔄 Triggering initial volume data refresh...');
}, 2000);

// Initialize cross notification service
const crossNotificationService = initializeCrossNotificationService();
setCrossNotificationService(crossNotificationService);

// Initialize FR/OI service (no auto-start, will use data from volume service)
logger.info('🚀 Initializing FR/OI Service...');
const frOiService = new FrOiService();
setFrOiService(frOiService);

// Initialize Price Deviation History Service
logger.info('🚀 Initializing Price Deviation History Service...');
const priceDeviationHistoryService = PriceDeviationHistoryService.getInstance();
// Set binanceRestApi reference for shared FR data
priceDeviationHistoryService.setBinanceRestApi(realTimeVolumeService.getBinanceAPI());
priceDeviationHistoryService.startCollection();

// Set RealTimeVolumeService reference in PriceDeviationService for volume data sharing
const { PriceDeviationService } = require('./services/priceDeviationService');
PriceDeviationService.getInstance().setRealTimeVolumeService(realTimeVolumeService);

// Price deviation will be calculated using REST API data (1 minute interval)
logger.info('🚀 Price deviation service will use REST API data (1 minute interval)');

// Clean up old data every 6 hours
setInterval(() => {
  priceDeviationHistoryService.cleanupOldData();
}, 6 * 60 * 60 * 1000);

// Set io instance for cross detection notifications
setIoInstance(io);

// WebSocket connection handlers
io.on('connection', (socket) => {
  logger.info(`🔌 WebSocket client connected: ${socket.id}`);
  
  socket.on('disconnect', (reason) => {
    logger.info(`🔌 WebSocket client disconnected: ${socket.id}, reason: ${reason}`);
  });
  
  socket.on('error', (error) => {
    logger.error(`🔌 WebSocket error for client ${socket.id}:`, error);
  });
});

// WebSocket service removed - using REST API only

// Add real-time volume data to WebSocket broadcasts (Ticks are now independent)
realTimeVolumeService.on('binanceUpdate', (binanceData) => {
  io.emit('volume-ranking-update', {
    type: 'binance-ranking',
    data: binanceData.slice(0, 15),
    timestamp: new Date().toISOString()
  });
  
  // Process FR/OI data with access to all volume data and shared FR data from binanceRestApi
  const binanceRestApi = realTimeVolumeService.getBinanceAPI ? realTimeVolumeService.getBinanceAPI() : null;
  frOiService.processVolumeDataWithFrOi(binanceData, realTimeVolumeService, binanceRestApi).then((frOiResult) => {
    io.emit('fr-oi-update', frOiResult);
    
    // Log if we have any alerts (only BOTH type now)
    if (frOiResult.recentAlerts && frOiResult.recentAlerts.length > 0) {
      frOiResult.recentAlerts.forEach(alert => {
        if (alert.type === 'BOTH') {
          logger.info(`📊 Alert: ${alert.symbol} has FR decreases (${alert.consecutiveFrDecreases}) and OI increases (${alert.consecutiveOiIncreases}) - Current FR: ${alert.currentFr.toFixed(4)}%, OI: $${(alert.currentOi / 1e6).toFixed(2)}M`);
        }
      });
    }
  }).catch((error) => {
    logger.error('Error processing FR/OI data:', error);
  });
});

realTimeVolumeService.on('upbitUpdate', (upbitData) => {
  io.emit('volume-ranking-update', {
    type: 'upbit-ranking', 
    data: upbitData.slice(0, 15),
    timestamp: new Date().toISOString()
  });
});

realTimeVolumeService.on('binanceSpotUpdate', (binanceSpotData) => {
  io.emit('volume-ranking-update', {
    type: 'binance-spot-ranking',
    data: binanceSpotData.slice(0, 15),
    timestamp: new Date().toISOString()
  });
});

realTimeVolumeService.on('bybitUpdate', (bybitData) => {
  io.emit('volume-ranking-update', {
    type: 'bybit-ranking',
    data: bybitData.slice(0, 15),
    timestamp: new Date().toISOString()
  });
});

realTimeVolumeService.on('okxUpdate', (okxData) => {
  io.emit('volume-ranking-update', {
    type: 'okx-ranking',
    data: okxData.slice(0, 15),
    timestamp: new Date().toISOString()
  });
});

realTimeVolumeService.on('gateioUpdate', (gateioData) => {
  io.emit('volume-ranking-update', {
    type: 'gateio-ranking',
    data: gateioData.slice(0, 15),
    timestamp: new Date().toISOString()
  });
});

realTimeVolumeService.on('bitgetUpdate', (bitgetData) => {
  io.emit('volume-ranking-update', {
    type: 'bitget-ranking',
    data: bitgetData.slice(0, 15),
    timestamp: new Date().toISOString()
  });
});

realTimeVolumeService.on('mexcUpdate', (mexcData) => {
  io.emit('volume-ranking-update', {
    type: 'mexc-ranking',
    data: {
      spot: mexcData.spot ? mexcData.spot.slice(0, 15) : [],
      futures: mexcData.futures ? mexcData.futures.slice(0, 15) : []
    },
    timestamp: new Date().toISOString()
  });
});

realTimeVolumeService.on('bithumbUpdate', (bithumbData) => {
  io.emit('volume-ranking-update', {
    type: 'bithumb-ranking',
    data: bithumbData.slice(0, 15),
    timestamp: new Date().toISOString()
  });
});



app.use(errorHandler);

server.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
});

export default app;