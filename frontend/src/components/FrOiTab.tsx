import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
  Chip,
  LinearProgress,
  Card,
  CardContent,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  TrendingDown,
  TrendingUp,
  Warning,
  Info
} from '@mui/icons-material';
import io from 'socket.io-client';

interface FrOiAlert {
  symbol: string;
  type: 'FR_DECREASE' | 'OI_INCREASE' | 'BOTH';
  frHistory: number[];
  oiHistory: number[];
  consecutiveFrDecreases: number;
  consecutiveOiIncreases: number;
  currentFr: number;
  currentOi: number;
  totalVolume: number;
  timestamp: string;
}

interface FrOiData {
  symbol: string;
  frHistory: number[];
  oiHistory: number[];
  latestFr: number;
  latestOi: number;
  frTrend: number;
  oiTrend: number;
}

const FrOiTab: React.FC = () => {
  const [alerts, setAlerts] = useState<FrOiAlert[]>([]);
  const [currentData, setCurrentData] = useState<FrOiData[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Initial data fetch
    fetchInitialData();

    // Setup WebSocket connection
    const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000');

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // No longer using separate fr-oi-alert, alerts come with update

    socket.on('fr-oi-update', (data: any) => {
      if (data.alerts) {
        setAlerts(data.alerts);
      }
      if (data.data) {
        updateCurrentData(data.data);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchInitialData = async () => {
    try {
      const [alertsRes, currentRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/fr-oi/alerts`),
        fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/fr-oi/current`)
      ]);

      const alertsData = await alertsRes.json();
      const currentData = await currentRes.json();

      if (alertsData.success) {
        setAlerts(alertsData.data);
      }
      if (currentData.success) {
        setCurrentData(currentData.data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching FR/OI data:', error);
      setLoading(false);
    }
  };

  const updateCurrentData = (data: any[]) => {
    // Convert the data format if needed
    const formattedData: FrOiData[] = data.map(item => ({
      symbol: item.symbol,
      frHistory: item.frHistory || [],
      oiHistory: item.oiHistory || [],
      latestFr: item.latestFr || item.fundingRate || 0,
      latestOi: item.latestOi || item.openInterest || 0,
      frTrend: item.frTrend || 0,
      oiTrend: item.oiTrend || 0
    }));
    setCurrentData(formattedData);
  };


  const formatFundingRate = (rate: number) => {
    return `${(rate * 100).toFixed(4)}%`;
  };

  const formatVolume = (volume: number): string => {
    if (!volume && volume !== 0) return '$0';
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(1)}M`;
    if (volume >= 1e3) return `$${(volume / 1e3).toFixed(1)}K`;
    return `$${volume.toFixed(2)}`;
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'BOTH': return 'error';
      case 'FR_DECREASE': return 'warning';
      case 'OI_INCREASE': return 'info';
      default: return 'default';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'BOTH': return <Warning color="error" />;
      case 'FR_DECREASE': return <TrendingDown color="warning" />;
      case 'OI_INCREASE': return <TrendingUp color="info" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <LinearProgress />
        <Typography align="center" sx={{ mt: 2 }}>
          Loading FR/OI data...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with connection status */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="body1" sx={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
          Funding Rate & Open Interest Monitor
        </Typography>
        <Chip 
          label={connected ? 'Connected' : 'Disconnected'}
          color={connected ? 'success' : 'error'}
          size="small"
        />
      </Box>

      {/* Info Card */}
      <Card sx={{ mb: 1, bgcolor: 'background.paper' }}>
        <CardContent sx={{ py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Info color="info" />
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Detection Criteria</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            <strong>検出条件</strong>: 以下の2つの条件を<strong>同時に満たした場合のみ</strong>通知
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
            ✓ <strong>FR連続減少</strong>: Funding Rateが5回以上連続で減少
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
            ✓ <strong>OI連続上昇</strong>: Open Interestが5回以上連続で上昇
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            ⚠️ <strong>両条件達成</strong> = ロング有利 + ポジション増加 → 強気相場の可能性大
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            * データは5分ごとに更新されます（出来高データと同じタイミング）
          </Typography>
        </CardContent>
      </Card>

      <Box>
        <Paper sx={{ p: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
            Recent Alerts ({alerts.length})
          </Typography>
          {alerts.length === 0 ? (
            <Alert severity="info">
              条件を満たす銘柄はありません。FR連続5回減少 AND OI連続5回上昇を監視中...
            </Alert>
          ) : (
            <TableContainer>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell align="right">Volume</TableCell>
                    <TableCell align="right">Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {alerts.map((alert, index) => (
                    <TableRow key={`${alert.symbol}-${index}`}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getAlertIcon(alert.type)}
                          <Typography variant="body2" fontWeight="bold">
                            {alert.symbol}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                          {formatVolume(alert.totalVolume)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

export default FrOiTab;