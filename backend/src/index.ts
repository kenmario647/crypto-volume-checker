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
import { WebSocketService } from './services/websocket';
import RealTimeVolumeService from './services/realTimeVolumeService';
import { setRealTimeVolumeService } from './controllers/volumeRankingController';
import { setIoInstance } from './controllers/volumeController';
import { initializeCrossNotificationService, setCrossNotificationService } from './controllers/notificationController';

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

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'crypto-volume-checker-api'
  });
});

// Initialize real-time volume service
const realTimeVolumeService = new RealTimeVolumeService();
setRealTimeVolumeService(realTimeVolumeService);

// Initialize cross notification service
const crossNotificationService = initializeCrossNotificationService();
setCrossNotificationService(crossNotificationService);

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

const webSocketService = new WebSocketService(io, realTimeVolumeService);
webSocketService.initialize();

// Add real-time volume data to WebSocket broadcasts (Ticks are now independent)
realTimeVolumeService.on('binanceUpdate', (binanceData) => {
  io.emit('volume-ranking-update', {
    type: 'binance-ranking',
    data: binanceData,
    timestamp: new Date().toISOString()
  });
});

realTimeVolumeService.on('upbitUpdate', (upbitData) => {
  io.emit('volume-ranking-update', {
    type: 'upbit-ranking', 
    data: upbitData,
    timestamp: new Date().toISOString()
  });
});


app.use(errorHandler);

server.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
});

export default app;