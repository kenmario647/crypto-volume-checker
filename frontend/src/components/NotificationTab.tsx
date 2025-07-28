import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Paper,
  IconButton,
  Divider,
  FormControlLabel,
  Switch,
  Badge,
  Tooltip
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Clear,
  VolumeUp,
  VolumeOff,
  FilterList
} from '@mui/icons-material';
import { io, Socket } from 'socket.io-client';

interface CrossAlert {
  id: string;
  type: 'golden_cross' | 'death_cross';
  symbol: string;
  exchange: 'binance' | 'upbit';
  timestamp: number;
  ma3Value: number;
  ma8Value: number;
  previousMa3: number;
  previousMa8: number;
  message: string;
  isRead?: boolean;
}

const NotificationTab: React.FC = () => {
  const [alerts, setAlerts] = useState<CrossAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showGoldenCross, setShowGoldenCross] = useState(true);
  const [showDeathCross, setShowDeathCross] = useState(true);

  useEffect(() => {
    // WebSocket接続
    console.log(`🔌 Attempting WebSocket connection to ${process.env.REACT_APP_API_URL || 'http://localhost:5000'}`);
    const socketInstance = io(process.env.REACT_APP_API_URL || 'http://localhost:5000');
    setSocket(socketInstance);

    // 接続状態のログ
    socketInstance.on('connect', () => {
      console.log('🔌 WebSocket connected successfully');
    });

    socketInstance.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
    });

    // クロスアラート受信
    socketInstance.on('crossAlert', (data: CrossAlert) => {
      console.log('🚨 Received cross alert:', data);
      
      const newAlert = {
        ...data,
        isRead: false
      };
      
      setAlerts(prev => [newAlert, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // 音声通知
      if (soundEnabled) {
        playNotificationSound(data.type);
      }
    });

    // クリーンアップ
    return () => {
      socketInstance.disconnect();
    };
  }, [soundEnabled]);

  const playNotificationSound = (type: 'golden_cross' | 'death_cross') => {
    if (!soundEnabled) return;
    
    // Web Audio APIを使用してビープ音を生成
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // ゴールデンクロスは高い音、デスクロスは低い音
    oscillator.frequency.setValueAtTime(type === 'golden_cross' ? 800 : 400, audioContext.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  const markAsRead = (alertId: string) => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId && !alert.isRead
          ? { ...alert, isRead: true }
          : alert
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setAlerts(prev => prev.map(alert => ({ ...alert, isRead: true })));
    setUnreadCount(0);
  };

  const clearAlert = (alertId: string) => {
    setAlerts(prev => {
      const alert = prev.find(a => a.id === alertId);
      if (alert && !alert.isRead) {
        setUnreadCount(c => Math.max(0, c - 1));
      }
      return prev.filter(a => a.id !== alertId);
    });
  };

  const clearAllAlerts = () => {
    setAlerts([]);
    setUnreadCount(0);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatValue = (value: number) => {
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(1)}M`;
    } else if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(1)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  // フィルタリングされたアラート
  const filteredAlerts = alerts.filter(alert => {
    if (alert.type === 'golden_cross' && !showGoldenCross) return false;
    if (alert.type === 'death_cross' && !showDeathCross) return false;
    return true;
  });

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          📱 移動平均クロス通知
          {unreadCount > 0 && (
            <Badge badgeContent={unreadCount} color="error" sx={{ ml: 1 }} />
          )}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="音声通知">
            <IconButton onClick={() => setSoundEnabled(!soundEnabled)} sx={{ color: 'white' }}>
              {soundEnabled ? <VolumeUp /> : <VolumeOff />}
            </IconButton>
          </Tooltip>
          <Tooltip title="すべて既読">
            <IconButton onClick={markAllAsRead} sx={{ color: 'white' }} disabled={unreadCount === 0}>
              <Badge badgeContent={unreadCount} color="error">
                <Clear />
              </Badge>
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* フィルター設定 */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: '#1a1a1a', border: '1px solid #333' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterList sx={{ color: '#999' }} />
            <Typography variant="body2" sx={{ color: '#999' }}>フィルター:</Typography>
          </Box>
          
          <FormControlLabel
            control={
              <Switch 
                checked={showGoldenCross} 
                onChange={(e) => setShowGoldenCross(e.target.checked)}
                size="small"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <TrendingUp sx={{ color: '#4caf50', fontSize: 18 }} />
                <Typography variant="body2" sx={{ color: 'white' }}>ゴールデンクロス</Typography>
              </Box>
            }
          />
          
          <FormControlLabel
            control={
              <Switch 
                checked={showDeathCross} 
                onChange={(e) => setShowDeathCross(e.target.checked)}
                size="small"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <TrendingDown sx={{ color: '#f44336', fontSize: 18 }} />
                <Typography variant="body2" sx={{ color: 'white' }}>デスクロス</Typography>
              </Box>
            }
          />
          
          <FormControlLabel
            control={
              <Switch 
                checked={soundEnabled} 
                onChange={(e) => setSoundEnabled(e.target.checked)}
                size="small"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {soundEnabled ? <VolumeUp sx={{ color: '#2196f3', fontSize: 18 }} /> : <VolumeOff sx={{ color: '#999', fontSize: 18 }} />}
                <Typography variant="body2" sx={{ color: 'white' }}>音声通知</Typography>
              </Box>
            }
          />
        </Box>
      </Paper>

      {/* アラート一覧 */}
      {filteredAlerts.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: '#1a1a1a', border: '1px solid #333' }}>
          <Typography variant="body1" sx={{ color: '#999' }}>
            まだ移動平均クロスが検知されていません
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mt: 1 }}>
            MA3とMA8の移動平均線がクロスすると通知が表示されます
          </Typography>
        </Paper>
      ) : (
        <List sx={{ p: 0 }}>
          {filteredAlerts.map((alert, index) => (
            <React.Fragment key={alert.id}>
              <Paper 
                sx={{ 
                  mb: 1,
                  backgroundColor: alert.isRead ? '#1a1a1a' : '#2a2a2a',
                  border: alert.isRead ? '1px solid #333' : '1px solid #555',
                  transition: 'all 0.2s ease'
                }}
              >
                <ListItem
                  sx={{ 
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.05)' }
                  }}
                  onClick={() => markAsRead(alert.id)}
                  secondaryAction={
                    <IconButton 
                      edge="end" 
                      onClick={(e) => {
                        e.stopPropagation();
                        clearAlert(alert.id);
                      }}
                      sx={{ color: '#999' }}
                    >
                      <Clear />
                    </IconButton>
                  }
                >
                  <ListItemIcon>
                    {alert.type === 'golden_cross' ? (
                      <TrendingUp sx={{ color: '#4caf50', fontSize: 28 }} />
                    ) : (
                      <TrendingDown sx={{ color: '#f44336', fontSize: 28 }} />
                    )}
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                          {alert.symbol}
                        </Typography>
                        <Chip 
                          label={alert.exchange.toUpperCase()} 
                          size="small" 
                          sx={{ 
                            backgroundColor: alert.exchange === 'binance' ? '#F3BA2F' : '#0052FF',
                            color: 'white',
                            fontWeight: 'bold'
                          }} 
                        />
                        <Chip 
                          label={alert.type === 'golden_cross' ? 'ゴールデンクロス' : 'デスクロス'}
                          size="small"
                          sx={{ 
                            backgroundColor: alert.type === 'golden_cross' ? '#4caf50' : '#f44336',
                            color: 'white'
                          }}
                        />
                        {!alert.isRead && (
                          <Chip label="NEW" size="small" color="error" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" sx={{ color: '#ccc', mb: 0.5 }}>
                          {formatTime(alert.timestamp)}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          <Typography variant="body2" sx={{ color: '#999' }}>
                            MA3: {formatValue(alert.previousMa3)} → <span style={{ color: '#4caf50' }}>{formatValue(alert.ma3Value)}</span>
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#999' }}>
                            MA8: {formatValue(alert.previousMa8)} → <span style={{ color: '#2196f3' }}>{formatValue(alert.ma8Value)}</span>
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              </Paper>
              {index < filteredAlerts.length - 1 && <Divider sx={{ backgroundColor: '#333' }} />}
            </React.Fragment>
          ))}
        </List>
      )}

      {/* フッター */}
      {filteredAlerts.length > 0 && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: '#666' }}>
            通知数: {filteredAlerts.length} / 未読: {unreadCount}
          </Typography>
          {alerts.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <IconButton onClick={clearAllAlerts} sx={{ color: '#666' }}>
                <Clear />
                <Typography variant="caption" sx={{ ml: 0.5 }}>すべてクリア</Typography>
              </IconButton>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default NotificationTab;