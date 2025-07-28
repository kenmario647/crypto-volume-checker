import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  Alert,
  Badge,
  Button
} from '@mui/material';
// Grid2を使用せず、Boxで代替
import {
  TrendingUp,
  Schedule,
  AccountBalance,
  ShowChart,
  Notifications
} from '@mui/icons-material';
import { io, Socket } from 'socket.io-client';
import LimitLongRecommendationCard from './LimitLongRecommendationCard';

interface TradeRecommendation {
  id: string;
  symbol: string;
  side: string;
  orderType: string;
  recommendation: any;
  createdAt: number;
  expiresAt: number;
  status: string;
}

interface OrderUpdate {
  type: string;
  orderId: string;
  symbol: string;
  status: string;
  message: string;
  data: any;
  timestamp: number;
}

interface ActiveOrder {
  orderId: string;
  symbol: string;
  side: string;
  orderType: string;
  quantity: number;
  limitPrice: number;
  status: string;
  createdAt: number;
}

const TradingDashboard: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [recommendations, setRecommendations] = useState<TradeRecommendation[]>([]);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [orderUpdates, setOrderUpdates] = useState<OrderUpdate[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // WebSocket接続
    const socketInstance = io('http://localhost:5000');
    setSocket(socketInstance);

    // 取引推奨受信
    socketInstance.on('tradeRecommendation', (data: any) => {
      console.log('Received trade recommendation:', data);
      
      if (data.type === 'limit_long_recommendation') {
        setRecommendations(prev => [data.data, ...prev]);
        setUnreadCount(prev => prev + 1);
        
        // 音声通知
        playNotificationSound();
        
        // ブラウザ通知
        if (Notification.permission === 'granted') {
          new Notification(`🚀 ${data.data.symbol} ロング推奨`, {
            body: `指値価格: $${data.data.recommendation.defaultPrice.toFixed(2)}`,
            icon: '/favicon.ico'
          });
        }
      }
    });

    // 注文状況更新受信
    socketInstance.on('orderStatusUpdate', (data: OrderUpdate) => {
      console.log('Order status update:', data);
      
      setOrderUpdates(prev => [data, ...prev.slice(0, 9)]); // 最新10件まで
      
      // 音声通知
      if (data.type === 'order_filled') {
        playNotificationSound('success');
      } else if (data.type === 'order_cancelled' || data.type === 'order_rejected') {
        playNotificationSound('error');
      }
    });

    // 注文配置通知
    socketInstance.on('orderPlaced', (data: any) => {
      console.log('Order placed:', data);
      fetchActiveOrders();
    });

    // エラー通知
    socketInstance.on('tradeRecommendationError', (data: any) => {
      console.error('Trade recommendation error:', data);
      setOrderUpdates(prev => [{
        type: 'error',
        orderId: '',
        symbol: data.symbol,
        status: 'ERROR',
        message: `❌ 推奨生成失敗: ${data.symbol} - ${data.error}`,
        data: data,
        timestamp: Date.now()
      }, ...prev.slice(0, 9)]);
    });

    // 初期データ取得
    fetchActiveOrders();

    // ブラウザ通知許可要求
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const fetchActiveOrders = async () => {
    try {
      const response = await fetch('/api/trade/active-orders');
      const result = await response.json();
      
      if (result.success) {
        setActiveOrders(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch active orders:', error);
    }
  };

  const playNotificationSound = (type: 'default' | 'success' | 'error' = 'default') => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // 音の種類
    let frequency = 800;
    let duration = 0.5;
    
    switch (type) {
      case 'success':
        frequency = 1000;
        duration = 0.3;
        break;
      case 'error':
        frequency = 400;
        duration = 0.7;
        break;
    }
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  };

  const handleExecuteRecommendation = (recommendationId: string, price: number) => {
    // 実行済みの推奨を削除
    setRecommendations(prev => prev.filter(rec => rec.id !== recommendationId));
    
    // アクティブ注文を再取得
    setTimeout(() => {
      fetchActiveOrders();
    }, 1000);
  };

  const handleRejectRecommendation = (recommendationId: string) => {
    setRecommendations(prev => prev.filter(rec => rec.id !== recommendationId));
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('ja-JP');
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'filled': return 'success';
      case 'new': case 'pending': return 'primary';
      case 'cancelled': case 'rejected': return 'error';
      case 'partiallyfilled': return 'warning';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          📊 取引ダッシュボード
          {unreadCount > 0 && (
            <Badge badgeContent={unreadCount} color="error" sx={{ ml: 1 }} />
          )}
        </Typography>
        
        <Button 
          variant="outlined" 
          onClick={() => setUnreadCount(0)}
          disabled={unreadCount === 0}
        >
          未読クリア
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {/* 左側: 取引推奨 */}
        <Box sx={{ flex: '2 1 600px', minWidth: 0 }}>
          <Paper sx={{ p: 2, backgroundColor: '#1a1a1a', border: '1px solid #333', mb: 3 }}>
            <Typography variant="h6" sx={{ color: 'white', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUp sx={{ color: '#4caf50' }} />
              取引推奨 ({recommendations.length})
            </Typography>
            
            {recommendations.length === 0 ? (
              <Alert severity="info" sx={{ backgroundColor: '#1a2332' }}>
                現在、取引推奨はありません。ゴールデンクロスが検知されると表示されます。
              </Alert>
            ) : (
              <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
                {recommendations.map((recommendation) => (
                  <LimitLongRecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation as any}
                    onExecute={handleExecuteRecommendation}
                    onReject={handleRejectRecommendation}
                  />
                ))}
              </Box>
            )}
          </Paper>
        </Box>

        {/* 右側: 監視パネル */}
        <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
          {/* アクティブ注文 */}
          <Paper sx={{ p: 2, backgroundColor: '#1a1a1a', border: '1px solid #333', mb: 3 }}>
            <Typography variant="h6" sx={{ color: 'white', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShowChart sx={{ color: '#2196f3' }} />
              アクティブ注文 ({activeOrders.length})
            </Typography>
            
            {activeOrders.length === 0 ? (
              <Typography variant="body2" color="textSecondary">
                アクティブな注文はありません
              </Typography>
            ) : (
              <List dense>
                {activeOrders.map((order, index) => (
                  <React.Fragment key={order.orderId}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
                              {order.symbol}
                            </Typography>
                            <Chip 
                              label={order.status} 
                              size="small" 
                              color={getStatusColor(order.status) as any}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" color="textSecondary">
                              {order.side} {order.quantity} @ ${order.limitPrice.toFixed(2)}
                            </Typography>
                            <Typography variant="caption" display="block" color="textSecondary">
                              {formatTime(order.createdAt)}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < activeOrders.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>

          {/* 注文更新履歴 */}
          <Paper sx={{ p: 2, backgroundColor: '#1a1a1a', border: '1px solid #333' }}>
            <Typography variant="h6" sx={{ color: 'white', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Notifications sx={{ color: '#ff9800' }} />
              通知履歴
            </Typography>
            
            {orderUpdates.length === 0 ? (
              <Typography variant="body2" color="textSecondary">
                通知はありません
              </Typography>
            ) : (
              <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                {orderUpdates.map((update, index) => (
                  <React.Fragment key={`${update.orderId}-${update.timestamp}`}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ color: 'white' }}>
                            {update.message}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="textSecondary">
                            {formatTime(update.timestamp)}
                          </Typography>
                        }
                      />
                    </ListItem>
                    {index < orderUpdates.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default TradingDashboard;