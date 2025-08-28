import React, { useState, useEffect } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Tooltip,
  IconButton,
  FormControlLabel,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import { TrendingUp, TrendingDown, Warning, Refresh } from '@mui/icons-material';
import axios from 'axios';
import io from 'socket.io-client';
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
  averageDeviation?: number; // 1分間の平均乖離率
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
  ma15?: number | null;
}

const PriceDeviationTable: React.FC = () => {
  const [data, setData] = useState<PriceDeviationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [historicalData, setHistoricalData] = useState<ChartDataPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // asc: 負から正（デフォルト）、desc: 正から負

  useEffect(() => {
    // 並列で初期データ取得を開始
    fetchDeviationData();
    const interval = setInterval(fetchDeviationData, 60000); // Update every 60 seconds (1 minute)
    return () => clearInterval(interval);
  }, [sortOrder]); // sortOrderが変更されたら再取得

  // WebSocketでリアルタイム価格乖離率を受信
  useEffect(() => {
    const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000');
    
    socket.on('price-deviation-realtime', (deviationData) => {
      // Update the data for the specific symbol
      setData(prevData => {
        const updatedData = [...prevData];
        const symbolIndex = updatedData.findIndex(item => item.symbol === deviationData.symbol);
        
        if (symbolIndex !== -1) {
          // Update existing symbol data with exchange info
          updatedData[symbolIndex] = {
            ...updatedData[symbolIndex],
            spotExchange: deviationData.spotExchange,
            perpExchange: deviationData.perpExchange,
            spotPrice: deviationData.spotPrice,
            perpPrice: deviationData.perpPrice,
            deviation: deviationData.deviation,
            averageDeviation: deviationData.averageDeviation
          };
        }
        
        return updatedData;
      });
    });
    
    return () => {
      socket.disconnect();
    };
  }, []);

  // モーダルが開いている間の履歴データ自動更新
  useEffect(() => {
    if (chartModalOpen && selectedSymbol) {
      const modalInterval = setInterval(() => {
        fetchHistoryData(selectedSymbol);
      }, 60000); // Update chart data every 60 seconds
      
      return () => clearInterval(modalInterval);
    }
  }, [chartModalOpen, selectedSymbol]);

  const fetchDeviationData = async () => {
    try {
      // 初回のみローディング表示、以降は背景更新
      if (data.length === 0) {
        setLoading(true);
      }
      
      const params: any = { 
        limit: 999, // 常に全銘柄を取得
        minVolume: 50000000, // Always filter by 50M
        sortOrder: sortOrder
      };
      
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/price-deviation/top`,
        { params, timeout: 30000 }  // Increased timeout to 30 seconds
      );

      if (response.data.success) {
        setData(response.data.data);
        setLastUpdate(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error('Error fetching price deviation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoryData = async (symbol: string) => {
    if (!symbol) return;
    
    try {
      setChartLoading(true);
      const historyResponse = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/price-deviation-history/${symbol}`,
        { params: { limit: 1440 } }
      );

      if (historyResponse.data.success && historyResponse.data.data.history) {
        const historyData = historyResponse.data.data.history.map((point: any, index: number, array: any[]) => {
          // Calculate moving averages for deviation
          const calculateMA = (data: any[], period: number, currentIndex: number) => {
            if (currentIndex < period - 1) return null;
            const slice = data.slice(currentIndex - period + 1, currentIndex + 1);
            const sum = slice.reduce((acc, item) => acc + item.deviation, 0);
            return sum / period;
          };

          return {
            time: new Date(point.timestamp).toLocaleTimeString('ja-JP', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            symbol: symbol,
            deviation: point.deviation,
            spotPrice: point.spotPrice,
            perpPrice: point.perpPrice,
            volume: point.totalVolume,
            absDeviation: Math.abs(point.deviation),
            positiveDeviation: point.deviation > 0 ? point.deviation : null,
            negativeDeviation: point.deviation < 0 ? point.deviation : null,
            fundingRate: point.fundingRate || null,
            ma15: calculateMA(array, 15, index)
          };
        });

        setHistoricalData(historyData);
      } else {
        setHistoricalData([]);
      }
    } catch (error) {
      console.error('Error fetching history data for', symbol, error);
      setHistoricalData([]);
    } finally {
      setChartLoading(false);
    }
  };

  const handleSymbolClick = async (symbol: string) => {
    setSelectedSymbol(symbol);
    setChartModalOpen(true);
    await fetchHistoryData(symbol);
  };

  const handleCloseModal = () => {
    setChartModalOpen(false);
    setSelectedSymbol('');
    setHistoricalData([]);
  };


  const formatVolume = (volume: number): string => {
    if (!volume && volume !== 0) return '$0';
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(1)}M`;
    if (volume >= 1e3) return `$${(volume / 1e3).toFixed(1)}K`;
    return `$${volume.toFixed(2)}`;
  };

  const getExchangeColor = (exchange: string): string => {
    switch (exchange) {
      case 'binance': return '#F3BA2F';
      case 'upbit': return '#004FFF';
      case 'bybit': return '#FF6B00';
      case 'okx': return '#000000';
      case 'gateio': return '#E6001E';
      case 'bitget': return '#00D4FF';
      default: return '#666';
    }
  };

  const getDeviationColor = (deviation: number) => {
    if (Math.abs(deviation) > 1.0) return '#ff1744'; // 高乖離 - 赤
    if (Math.abs(deviation) > 0.5) return '#ff9800'; // 中乖離 - オレンジ
    if (Math.abs(deviation) > 0.1) return '#ffeb3b'; // 低乖離 - 黄色
    return '#4caf50'; // 正常範囲 - 緑
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      // frDataPointが存在する場合のみFRを表示（5分間隔のデータポイント）
      const showFR = data.frDataPoint !== null && data.frDataPoint !== undefined;
      
      return (
        <Paper sx={{ p: 2, backgroundColor: 'rgba(20,20,20,0.95)', border: '1px solid #555' }}>
          <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
            時刻: {label}
          </Typography>
          <Typography variant="body2" sx={{ color: '#00D4AA', fontWeight: 'bold', fontSize: '13px' }}>
            平均乖離率(1分): {data.deviation.toFixed(4)}%
          </Typography>
          <Typography variant="body2" sx={{ color: '#4FC3F7', fontWeight: 'bold' }}>
            SPOT価格: ${data.spotPrice}
          </Typography>
          <Typography variant="body2" sx={{ color: '#FFB74D', fontWeight: 'bold' }}>
            PERP価格: ${data.perpPrice}
          </Typography>
          <Typography variant="body2" sx={{ color: '#E0E0E0', fontWeight: 'bold' }}>
            総出来高: {formatVolume(data.volume)}
          </Typography>
          {showFR && typeof data.fundingRate === 'number' && (
            <Typography variant="body2" sx={{ color: '#FF6B6B', fontWeight: 'bold', fontSize: '13px' }}>
              FR: {data.fundingRate.toFixed(6)}%
            </Typography>
          )}
          {typeof data.ma15 === 'number' && (
            <Typography variant="body2" sx={{ color: '#FF69B4', fontWeight: 'bold', fontSize: '12px' }}>
              MA15: {data.ma15.toFixed(4)}%
            </Typography>
          )}
        </Paper>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Paper sx={{ p: 1, backgroundColor: 'background.paper', border: '1px solid #333' }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="150px">
          <CircularProgress />
          <Typography variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
            Loading price deviation data...
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="body1" sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.95rem', mb: 0.5 }}>
            現物・先物価格乖離率（Total Volume ≥ $50M） - 全{data.length}銘柄
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            各銘柄で最も出来高の高い現物取引所と先物取引所の価格乖離率を表示しています（総取引量5000万ドル以上）
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ToggleButtonGroup
            value={sortOrder}
            exclusive
            onChange={(e, newSort) => {
              if (newSort !== null) {
                setSortOrder(newSort);
              }
            }}
            size="small"
            sx={{ height: 28 }}
          >
            <ToggleButton value="asc" sx={{ py: 0.5, px: 1 }}>
              <Tooltip title="負から正の順（現物高 → 先物高）">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TrendingDown sx={{ fontSize: 16 }} />
                  <Typography variant="caption">負→正</Typography>
                </Box>
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="desc" sx={{ py: 0.5, px: 1 }}>
              <Tooltip title="正から負の順（先物高 → 現物高）">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TrendingUp sx={{ fontSize: 16 }} />
                  <Typography variant="caption">正→負</Typography>
                </Box>
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
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

      <TableContainer 
        component={Paper} 
        sx={{ 
          backgroundColor: 'background.paper', 
          border: '1px solid #333',
          maxHeight: '70vh', // 常に高さ制限
          overflow: 'auto'
        }}
      >
        <Table size="small" stickyHeader> {/* 常にヘッダー固定 */}
              <TableHead>
                <TableRow>
                  <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold', py: 0.25, fontSize: '0.75rem' }}>
                    #
                  </TableCell>
                  <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold', py: 0.25, fontSize: '0.75rem' }}>
                    Symbol
                  </TableCell>
                  <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold' }} align="center">
                    SPOT
                  </TableCell>
                  <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold' }} align="center">
                    PERP
                  </TableCell>
                  <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold' }} align="center">
                    乖離率
                  </TableCell>
                  <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold' }} align="right">
                    Total Volume
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((row) => (
                  <TableRow 
                    key={`${row.symbol}-${row.spotExchange}-${row.perpExchange}`} 
                    hover 
                    onClick={() => handleSymbolClick(row.symbol)}
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)'
                      }
                    }}
                  >
                    <TableCell sx={{ py: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'white' }}>
                        {row.rank}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'white', fontSize: '12px' }}>
                        {row.symbol}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ py: 0.5 }}>
                      <Box>
                        <Chip
                          label={row.spotExchange.toUpperCase()}
                          size="small"
                          sx={{
                            backgroundColor: getExchangeColor(row.spotExchange),
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '10px',
                            mb: 0.25
                          }}
                        />
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '10px' }}>
                          {formatVolume(row.spotVolume)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center" sx={{ py: 0.5 }}>
                      <Box>
                        <Chip
                          label={row.perpExchange.toUpperCase()}
                          size="small"
                          sx={{
                            backgroundColor: getExchangeColor(row.perpExchange),
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '10px',
                            mb: 0.25
                          }}
                        />
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '10px' }}>
                          {formatVolume(row.perpVolume)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center" sx={{ py: 0.5 }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                          {Math.abs(row.deviation) > 1 && (
                            <Tooltip title="High deviation detected">
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Warning sx={{ fontSize: 16, color: '#FF9800' }} />
                              </Box>
                            </Tooltip>
                          )}
                          {row.deviation > 0 ? (
                            <TrendingUp sx={{ fontSize: 14, color: '#00e676' }} />
                          ) : (
                            <TrendingDown sx={{ fontSize: 14, color: '#ff1744' }} />
                          )}
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{
                            color: getDeviationColor(row.deviation),
                            fontWeight: 'bold',
                            fontFamily: 'monospace'
                          }}
                        >
                          {row.deviation > 0 ? '+' : ''}{(row.deviation || 0).toFixed(3)}%
                        </Typography>
                        {row.averageDeviation !== undefined && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.secondary',
                              fontSize: '10px',
                              fontFamily: 'monospace'
                            }}
                          >
                            Avg: {row.averageDeviation > 0 ? '+' : ''}{row.averageDeviation.toFixed(3)}%
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.5 }}>
                      <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                        {formatVolume(row.totalVolume)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
      </TableContainer>

      {/* Chart Modal */}
      <Dialog
        open={chartModalOpen}
        onClose={handleCloseModal}
        fullScreen
        PaperProps={{
          sx: {
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            margin: 0,
            borderRadius: 0
          }
        }}
      >
        <DialogTitle sx={{ color: 'white', borderBottom: '1px solid #333' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              {selectedSymbol} 乖離率チャート（1分間平均）
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={selectedSymbol}
                sx={{ backgroundColor: '#F3BA2F', color: 'black', fontWeight: 'bold' }}
              />
              {data.find(item => item.symbol === selectedSymbol) && (
                <Chip
                  label={`${data.find(item => item.symbol === selectedSymbol)?.deviation.toFixed(3)}%`}
                  sx={{ 
                    backgroundColor: getDeviationColor(data.find(item => item.symbol === selectedSymbol)?.deviation || 0),
                    color: 'black',
                    fontWeight: 'bold'
                  }}
                />
              )}
            </Box>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ height: 600, width: '100%' }}>
            {chartLoading ? (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="600px">
                <CircularProgress />
                <Typography variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
                  チャートデータ読み込み中...
                </Typography>
              </Box>
            ) : historicalData.length >= 2 ? (
              <DeviationAreaChart data={historicalData} CustomTooltip={CustomTooltip} />
            ) : historicalData.length > 0 ? (
              <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="600px" sx={{ gap: 2 }}>
                <Typography variant="h6" color="textSecondary">
                  データ収集中...
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {selectedSymbol}: {historicalData.length}/2 データポイント
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  チャート表示には最低2ポイントが必要です
                </Typography>
              </Box>
            ) : (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="600px">
                <Typography variant="h6" color="textSecondary">
                  {selectedSymbol}のデータを収集中...
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ borderTop: '1px solid #333', p: 2 }}>
          <Button onClick={handleCloseModal} sx={{ color: 'white' }}>
            閉じる
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PriceDeviationTable;