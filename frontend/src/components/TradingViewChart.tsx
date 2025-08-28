import React, { useState, useEffect } from 'react';
import {
  Paper,
  Box,
  Typography,
  Chip,
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
  Card,
  CardContent,
  IconButton,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Refresh
} from '@mui/icons-material';
import {
  ResponsiveContainer
} from 'recharts';
import axios from 'axios';
import DeviationAreaChart from './DeviationAreaChart';

interface PriceDeviationData {
  rank: number;
  symbol: string;
  spotExchange: string;
  perpExchange: string;
  spotPrice: number;
  perpPrice: number;
  deviation: number;
  spotVolume: number;
  perpVolume: number;
  totalVolume: number;
  timestamp?: number;
}

interface ChartDataPoint {
  time: string;
  symbol: string;
  deviation: number;
  spotPrice: number;
  perpPrice: number;
  volume: number;
  absDeviation: number;
  positiveDeviation?: number | null;
  negativeDeviation?: number | null;
  fundingRate?: number | null;
}

const TradingViewChart: React.FC = () => {
  const [currentData, setCurrentData] = useState<PriceDeviationData[]>([]);
  const [historicalData, setHistoricalData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  useEffect(() => {
    fetchDeviationData();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchDeviationData, 60000); // 1分ごと更新
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchDeviationData = async () => {
    try {
      // 現在のトップ乖離率データを取得
      const currentResponse = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/price-deviation/top`,
        { params: { limit: 15 } }
      );

      if (currentResponse.data.success) {
        const newData = currentResponse.data.data;
        console.log('Current API Response received:', newData.length, 'items');
        setCurrentData(newData);
        
        // 初回データ取得時にシンボルを自動選択
        let currentSymbol = selectedSymbol;
        if (!currentSymbol && newData.length > 0) {
          currentSymbol = newData[0].symbol;
          console.log('Auto-selecting symbol:', currentSymbol);
          setSelectedSymbol(currentSymbol);
        }

        // 選択されたシンボルの履歴データを取得
        if (currentSymbol) {
          await fetchHistoryData(currentSymbol);
        }
        
        const timestamp = new Date().toLocaleTimeString();
        setLastUpdate(timestamp);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching deviation data:', error);
      console.error('API URL:', `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/price-deviation/top`);
      setLoading(false);
    }
  };

  const fetchHistoryData = async (symbol: string) => {
    try {
      const historyResponse = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/price-deviation-history/${symbol}`,
        { params: { limit: 50 } }
      );

      if (historyResponse.data.success && historyResponse.data.data.history) {
        const historyData = historyResponse.data.data.history.map((point: any) => ({
          time: new Date(point.timestamp).toLocaleTimeString(),
          symbol: symbol,
          deviation: point.deviation,
          spotPrice: point.spotPrice,
          perpPrice: point.perpPrice,
          volume: point.totalVolume,
          absDeviation: Math.abs(point.deviation),
          positiveDeviation: point.deviation > 0 ? point.deviation : null,
          negativeDeviation: point.deviation < 0 ? point.deviation : null,
          fundingRate: point.fundingRate || null
        }));

        console.log('History data loaded:', historyData.length, 'points for', symbol);
        setHistoricalData(historyData);
      } else {
        console.log('No history data available for', symbol);
        setHistoricalData([]);
      }
    } catch (error) {
      console.error('Error fetching history data for', symbol, error);
      setHistoricalData([]);
    }
  };

  const formatVolume = (volume: number): string => {
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(1)}M`;
    if (volume >= 1e3) return `$${(volume / 1e3).toFixed(1)}K`;
    return `$${volume.toFixed(2)}`;
  };

  const getDeviationColor = (deviation: number) => {
    if (Math.abs(deviation) > 1.0) return '#ff1744'; // 高乖離 - 赤
    if (Math.abs(deviation) > 0.5) return '#ff9800'; // 中乖離 - オレンジ
    if (Math.abs(deviation) > 0.1) return '#ffeb3b'; // 低乖離 - 黄色
    return '#4caf50'; // 正常範囲 - 緑
  };

  const handleSymbolChange = async (symbol: string) => {
    console.log('Symbol changed from', selectedSymbol, 'to', symbol);
    setSelectedSymbol(symbol);
    setHistoricalData([]); // 新しいシンボルで履歴をリセット
    
    // 新しいシンボルの履歴データを取得
    await fetchHistoryData(symbol);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Paper sx={{ p: 2, backgroundColor: 'rgba(0,0,0,0.9)', border: '1px solid #333' }}>
          <Typography variant="body2" sx={{ color: 'white' }}>
            時刻: {label}
          </Typography>
          <Typography variant="body2" sx={{ color: '#F3BA2F' }}>
            乖離率: {data.deviation.toFixed(4)}%
          </Typography>
          <Typography variant="body2" sx={{ color: '#00e676' }}>
            SPOT価格: ${data.spotPrice}
          </Typography>
          <Typography variant="body2" sx={{ color: '#ff6b00' }}>
            PERP価格: ${data.perpPrice}
          </Typography>
          <Typography variant="body2" sx={{ color: 'white' }}>
            総出来高: {formatVolume(data.volume)}
          </Typography>
          {data.fundingRate !== null && data.fundingRate !== undefined && (
            <Typography variant="body2" sx={{ color: '#ff4444' }}>
              FR: {(data.fundingRate / 100).toFixed(6)}%
            </Typography>
          )}
        </Paper>
      );
    }
    return null;
  };

  const renderChart = (): React.ReactElement => {
    console.log('renderChart called, historicalData.length:', historicalData.length);
    
    if (historicalData.length === 0) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <Typography variant="h6" color="textSecondary">
            {selectedSymbol ? `${selectedSymbol}のデータを収集中... (${historicalData.length}ポイント)` : 'データを収集中...'}
          </Typography>
        </Box>
      );
    }

    console.log('Rendering combined area chart with', historicalData.length, 'data points');
    return <DeviationAreaChart data={historicalData} CustomTooltip={CustomTooltip} />;
  };

  if (loading && currentData.length === 0) {
    return (
      <Paper sx={{ p: 3, backgroundColor: 'background.paper', border: '1px solid #333' }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
          <CircularProgress />
          <Typography variant="h6" sx={{ ml: 2, color: 'text.secondary' }}>
            乖離率データ読み込み中...
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ color: 'white', fontWeight: 'bold' }}>
          📊 トレビュー - 乖離率分析
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                color="primary"
                size="small"
              />
            }
            label={
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                自動更新
              </Typography>
            }
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            最終更新: {lastUpdate}
          </Typography>
          <IconButton onClick={fetchDeviationData} size="small">
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Controls */}
        <Card sx={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={selectedSymbol}
                  onChange={(e) => handleSymbolChange(e.target.value)}
                  sx={{ color: 'white', '.MuiOutlinedInput-notchedOutline': { borderColor: '#333' } }}
                >
                  {currentData.map((item) => (
                    <MenuItem key={item.symbol} value={item.symbol}>
                      {item.symbol}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Current Symbol Info */}
              {currentData.find(item => item.symbol === selectedSymbol) && (
                <Box sx={{ display: 'flex', gap: 2, ml: 'auto' }}>
                  <Chip
                    label={`${selectedSymbol}`}
                    sx={{ backgroundColor: '#F3BA2F', color: 'black', fontWeight: 'bold' }}
                  />
                  <Chip
                    label={`${currentData.find(item => item.symbol === selectedSymbol)?.deviation.toFixed(4)}%`}
                    sx={{ 
                      backgroundColor: getDeviationColor(currentData.find(item => item.symbol === selectedSymbol)?.deviation || 0),
                      color: 'black',
                      fontWeight: 'bold'
                    }}
                  />
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Main Chart */}
        <Paper sx={{ backgroundColor: '#1a1a1a', border: '1px solid #333', p: 2 }}>
          <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
            {selectedSymbol} 乖離率・FR統合チャート
          </Typography>
          <Box sx={{ height: 700, width: '100%', display: 'flex', justifyContent: 'center' }}>
            {renderChart()}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default TradingViewChart;