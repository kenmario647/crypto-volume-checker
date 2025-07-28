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
import ticksRoutes from './routes/ticks';
import { WebSocketService } from './services/websocket';
import RealTimeVolumeService from './services/realTimeVolumeService';
import TicksService from './services/ticksService';
import { setRealTimeVolumeService } from './controllers/volumeRankingController';
import { setTicksService } from './controllers/ticksController';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/volume', volumeRoutes);
app.use('/api/momentum', momentumRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/volume-ranking', volumeRankingRoutes);
app.use('/api/ticks', ticksRoutes);

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

// Initialize ticks service
const ticksService = new TicksService();
setTicksService(ticksService);

// Connect to top ticks symbols independently of volume ranking
const connectToTopTicksSymbols = async () => {
  try {
    // Connect to Binance top ticks symbols (independent of volume ranking)
    await ticksService.connectBinanceTopTicks();
    
    // TODO: Add Upbit top ticks connection when needed
    // For now, keep Upbit connected to volume ranking symbols
    const upbitData = realTimeVolumeService.getUpbitData();
    const upbitSymbols = upbitData.slice(0, 20).map((item: any) => item.symbol);
    
    if (upbitSymbols.length > 0) {
      ticksService.connectUpbit(upbitSymbols);
    }
    
    logger.info(`🔥 Updated Ticks WebSocket connections: Top 20 Binance ticks symbols + ${upbitSymbols.length} Upbit symbols`);
  } catch (error) {
    logger.error('Error connecting to top ticks symbols:', error);
  }
};

// Temporarily disable WebSocket connections to prevent server crashes
// Will re-enable after fixing performance issues
console.log('WebSocket connections temporarily disabled for stability');

const webSocketService = new WebSocketService(io);
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

// Add ticks data to WebSocket broadcasts
ticksService.on('ticksUpdate', (ticksData) => {
  io.emit('ticks-update', {
    type: 'ticks-5m',
    data: ticksData,
    timestamp: new Date().toISOString()
  });
});

ticksService.on('fiveMinProcessed', (ticksData) => {
  io.emit('ticks-processed', {
    type: 'ticks-5m-processed',
    data: ticksData,
    timestamp: new Date().toISOString()
  });
});

app.use(errorHandler);

server.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
});

export default app;