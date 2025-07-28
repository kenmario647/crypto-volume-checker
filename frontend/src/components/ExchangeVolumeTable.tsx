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
  Avatar,
  CircularProgress,
  Switch,
  FormControlLabel,
  Tooltip,
} from '@mui/material';
import { TrendingUp, TrendingDown, ShowChart, Star } from '@mui/icons-material';
import io from 'socket.io-client';
import VolumeDetailChart from './VolumeDetailChart';

interface VolumeRankingData {
  symbol: string;
  volume: string;
  quoteVolume: string;
  volume24h: string;
  priceChangePercent: string;
  lastPrice: string;
  rank: number;
  previousRank?: number;
  exchange: 'binance' | 'upbit';
  rankChanged?: boolean;
  volumeSpike?: boolean;
  newRankIn?: boolean;
  volumeIncrease5m?: number;
}

interface ExchangeVolumeTableProps {
  exchange: 'binance' | 'upbit';
}

const ExchangeVolumeTable: React.FC<ExchangeVolumeTableProps> = ({ exchange }) => {
  const [exchangeData, setExchangeData] = useState<VolumeRankingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState<{ symbol: string; exchange: string } | null>(null);

  useEffect(() => {
    // Initial data fetch
    fetchRankings();

    // Setup WebSocket connection for real-time updates
    const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000');

    socket.on('volume-ranking-update', (data: any) => {
      if (autoUpdate) {
        if ((data.type === 'binance-ranking' && exchange === 'binance') || 
            (data.type === 'upbit-ranking' && exchange === 'upbit')) {
          setExchangeData(data.data.slice(0, 20));
          setLastUpdate(new Date(data.timestamp).toLocaleTimeString());
          setLoading(false);
        }
      }
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [autoUpdate, exchange]);

  const fetchRankings = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/volume-ranking/top20`);
      const result = await response.json();
      
      if (result.success) {
        const data = exchange === 'binance' ? result.data.binance : result.data.upbit;
        
        // If Binance data is empty but other exchange has data, show message
        if (exchange === 'binance' && (!data || data.length === 0) && result.data.upbit && result.data.upbit.length > 0) {
          console.log('Binance data is still loading, please wait...');
        }
        
        setExchangeData(data ? data.slice(0, 20) : []);
        setLastUpdate(new Date(result.data.updateTime).toLocaleTimeString());
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching volume rankings:', error);
      setLoading(false);
    }
  };

  const loadSampleVolumeData = () => {
    const binanceSampleData: VolumeRankingData[] = [
      { symbol: 'ETH', volume: '35679', quoteVolume: '30900.0M', volume24h: '30900.0M', priceChangePercent: '1.87', lastPrice: '3456.78', rank: 1, exchange: 'binance' },
      { symbol: 'BTC', volume: '45231', quoteVolume: '18400.0M', volume24h: '18400.0M', priceChangePercent: '2.34', lastPrice: '95234.67', rank: 2, exchange: 'binance' },
      { symbol: 'SOL', volume: '23567', quoteVolume: '9900.0M', volume24h: '9900.0M', priceChangePercent: '-0.43', lastPrice: '234.56', rank: 3, exchange: 'binance' },
      { symbol: 'DOGE', volume: '28456', quoteVolume: '5100.0M', volume24h: '5100.0M', priceChangePercent: '3.21', lastPrice: '0.3456', rank: 4, exchange: 'binance' },
      { symbol: '1000PEPE', volume: '19876', quoteVolume: '2100.0M', volume24h: '2100.0M', priceChangePercent: '5.67', lastPrice: '0.00001345', rank: 5, exchange: 'binance' },
      { symbol: 'ADA', volume: '18234', quoteVolume: '1400.0M', volume24h: '1400.0M', priceChangePercent: '2.15', lastPrice: '0.987', rank: 6, exchange: 'binance' },
      { symbol: 'XRP', volume: '21345', quoteVolume: '1200.0M', volume24h: '1200.0M', priceChangePercent: '-1.23', lastPrice: '2.345', rank: 7, exchange: 'binance' },
      { symbol: 'BNB', volume: '16789', quoteVolume: '857.0M', volume24h: '857.0M', priceChangePercent: '1.45', lastPrice: '645.67', rank: 8, exchange: 'binance' },
      { symbol: 'TRUMP', volume: '15432', quoteVolume: '760.0M', volume24h: '760.0M', priceChangePercent: '-0.87', lastPrice: '53.45', rank: 9, exchange: 'binance' },
      { symbol: 'AVAX', volume: '14567', quoteVolume: '612.0M', volume24h: '612.0M', priceChangePercent: '3.78', lastPrice: '47.76', rank: 10, exchange: 'binance' },
      { symbol: 'LINK', volume: '13678', quoteVolume: '567.0M', volume24h: '567.0M', priceChangePercent: '0.98', lastPrice: '23.234', rank: 11, exchange: 'binance' },
      { symbol: 'UNI', volume: '12789', quoteVolume: '523.0M', volume24h: '523.0M', priceChangePercent: '-1.56', lastPrice: '15.34', rank: 12, exchange: 'binance' },
      { symbol: 'LTC', volume: '11890', quoteVolume: '487.0M', volume24h: '487.0M', priceChangePercent: '2.87', lastPrice: '108.76', rank: 13, exchange: 'binance' },
      { symbol: 'BCH', volume: '10987', quoteVolume: '432.0M', volume24h: '432.0M', priceChangePercent: '1.23', lastPrice: '486.78', rank: 14, exchange: 'binance' },
      { symbol: 'NEAR', volume: '10234', quoteVolume: '398.0M', volume24h: '398.0M', priceChangePercent: '-0.65', lastPrice: '7.45', rank: 15, exchange: 'binance' },
      { symbol: 'MATIC', volume: '9567', quoteVolume: '367.0M', volume24h: '367.0M', priceChangePercent: '4.56', lastPrice: '0.634', rank: 16, exchange: 'binance' },
      { symbol: 'DOT', volume: '8976', quoteVolume: '334.0M', volume24h: '334.0M', priceChangePercent: '2.34', lastPrice: '8.456', rank: 17, exchange: 'binance' },
      { symbol: 'ARB', volume: '8456', quoteVolume: '312.0M', volume24h: '312.0M', priceChangePercent: '-1.78', lastPrice: '0.889', rank: 18, exchange: 'binance' },
      { symbol: 'ATOM', volume: '7890', quoteVolume: '289.0M', volume24h: '289.0M', priceChangePercent: '3.45', lastPrice: '6.123', rank: 19, exchange: 'binance' },
      { symbol: 'FTM', volume: '7345', quoteVolume: '267.0M', volume24h: '267.0M', priceChangePercent: '0.87', lastPrice: '1.567', rank: 20, exchange: 'binance' }
    ];

    const upbitSampleData: VolumeRankingData[] = [
      { symbol: 'BTC', volume: '2890', quoteVolume: '412000.0M', volume24h: '412000.0M', priceChangePercent: '1.87', lastPrice: '142000000', rank: 1, exchange: 'upbit' },
      { symbol: 'ETH', volume: '2456', quoteVolume: '256000.0M', volume24h: '256000.0M', priceChangePercent: '2.34', lastPrice: '5123000', rank: 2, exchange: 'upbit' },
      { symbol: 'XRP', volume: '2134', quoteVolume: '187000.0M', volume24h: '187000.0M', priceChangePercent: '-0.78', lastPrice: '3456', rank: 3, exchange: 'upbit' },
      { symbol: 'DOGE', volume: '1987', quoteVolume: '165000.0M', volume24h: '165000.0M', priceChangePercent: '3.45', lastPrice: '512', rank: 4, exchange: 'upbit' },
      { symbol: 'SOL', volume: '1756', quoteVolume: '143000.0M', volume24h: '143000.0M', priceChangePercent: '-1.23', lastPrice: '345000', rank: 5, exchange: 'upbit' },
      { symbol: 'ADA', volume: '1634', quoteVolume: '128000.0M', volume24h: '128000.0M', priceChangePercent: '2.56', lastPrice: '1456', rank: 6, exchange: 'upbit' },
      { symbol: 'AVAX', volume: '1523', quoteVolume: '112000.0M', volume24h: '112000.0M', priceChangePercent: '1.89', lastPrice: '67000', rank: 7, exchange: 'upbit' },
      { symbol: 'MATIC', volume: '1456', quoteVolume: '98000.0M', volume24h: '98000.0M', priceChangePercent: '4.12', lastPrice: '1289', rank: 8, exchange: 'upbit' },
      { symbol: 'DOT', volume: '1367', quoteVolume: '87000.0M', volume24h: '87000.0M', priceChangePercent: '0.67', lastPrice: '12145', rank: 9, exchange: 'upbit' },
      { symbol: 'LINK', volume: '1234', quoteVolume: '76000.0M', volume24h: '76000.0M', priceChangePercent: '-1.45', lastPrice: '34560', rank: 10, exchange: 'upbit' },
      { symbol: 'UNI', volume: '1187', quoteVolume: '65000.0M', volume24h: '65000.0M', priceChangePercent: '2.78', lastPrice: '18234', rank: 11, exchange: 'upbit' },
      { symbol: 'LTC', volume: '1098', quoteVolume: '58000.0M', volume24h: '58000.0M', priceChangePercent: '1.56', lastPrice: '145600', rank: 12, exchange: 'upbit' },
      { symbol: 'BCH', volume: '987', quoteVolume: '52000.0M', volume24h: '52000.0M', priceChangePercent: '-0.89', lastPrice: '673400', rank: 13, exchange: 'upbit' },
      { symbol: 'ATOM', volume: '876', quoteVolume: '46000.0M', volume24h: '46000.0M', priceChangePercent: '3.34', lastPrice: '18345', rank: 14, exchange: 'upbit' },
      { symbol: 'ALGO', volume: '789', quoteVolume: '41000.0M', volume24h: '41000.0M', priceChangePercent: '2.12', lastPrice: '345', rank: 15, exchange: 'upbit' },
      { symbol: 'VET', volume: '698', quoteVolume: '37000.0M', volume24h: '37000.0M', priceChangePercent: '-1.67', lastPrice: '67', rank: 16, exchange: 'upbit' },
      { symbol: 'FTM', volume: '634', quoteVolume: '33000.0M', volume24h: '33000.0M', priceChangePercent: '4.89', lastPrice: '1165', rank: 17, exchange: 'upbit' },
      { symbol: 'HBAR', volume: '567', quoteVolume: '29000.0M', volume24h: '29000.0M', priceChangePercent: '1.78', lastPrice: '182', rank: 18, exchange: 'upbit' },
      { symbol: 'NEAR', volume: '523', quoteVolume: '26000.0M', volume24h: '26000.0M', priceChangePercent: '-0.45', lastPrice: '6734', rank: 19, exchange: 'upbit' },
      { symbol: 'ICP', volume: '487', quoteVolume: '23000.0M', volume24h: '23000.0M', priceChangePercent: '2.89', lastPrice: '12456', rank: 20, exchange: 'upbit' }
    ];

    const sampleData = exchange === 'binance' ? binanceSampleData : upbitSampleData;
    
    setExchangeData(sampleData);
    setLastUpdate(new Date().toLocaleTimeString());
    setLoading(false);
  };

  const getExchangeColor = (exchange: string) => {
    switch (exchange) {
      case 'binance': return '#F3BA2F';
      case 'upbit': return '#004FFF';
      default: return '#666';
    }
  };

  const getExchangeName = (exchange: string) => {
    switch (exchange) {
      case 'binance': return 'Binance';
      case 'upbit': return 'Upbit';
      default: return exchange;
    }
  };

  const getPriceChangeIcon = (changePercent: string) => {
    const value = parseFloat(changePercent.replace('%', ''));
    return value >= 0 ? 
      <TrendingUp sx={{ color: '#00e676', fontSize: 16 }} /> : 
      <TrendingDown sx={{ color: '#ff1744', fontSize: 16 }} />;
  };

  const getPriceChangeColor = (changePercent: string) => {
    const value = parseFloat(changePercent.replace('%', ''));
    return value >= 0 ? '#00e676' : '#ff1744';
  };

  const formatVolumeToMillion = (volumeString: string) => {
    // APIから受信した出来高をミリオン単位に変換
    if (typeof volumeString !== 'string') return volumeString;
    
    // すでにM単位で終わっている場合はそのまま返す
    if (volumeString.endsWith('M')) return volumeString;
    
    // $記号を除去して数値を取得
    const cleanedString = volumeString.replace(/[$,]/g, '');
    
    // B (billion) をM (million) に変換
    if (volumeString.includes('B')) {
      const value = parseFloat(cleanedString.replace('B', ''));
      return `${(value * 1000).toFixed(1)}M`;
    }
    
    // K (thousand) をM (million) に変換
    if (volumeString.includes('K')) {
      const value = parseFloat(cleanedString.replace('K', ''));
      return `${(value / 1000).toFixed(1)}M`;
    }
    
    // 数値のみの場合（単位なし）をM (million) に変換
    const numericValue = parseFloat(cleanedString);
    if (!isNaN(numericValue)) {
      return `${(numericValue / 1e6).toFixed(1)}M`;
    }
    
    return volumeString; // フォーマットできない場合はそのまま返す
  };

  const handleSymbolClick = (symbol: string, exchange: string) => {
    let formattedSymbol = symbol;
    
    // Binanceの場合、USDTペアに変換
    if (exchange === 'binance' && !symbol.endsWith('USDT')) {
      formattedSymbol = `${symbol}USDT`;
    }
    
    setSelectedSymbol({ symbol: formattedSymbol, exchange });
  };

  const renderTable = (data: VolumeRankingData[], exchange: 'binance' | 'upbit') => (
    <Paper sx={{ backgroundColor: 'background.paper', border: '1px solid #333', height: '100%' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid #333', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Chip
          label={exchange === 'binance' ? 'Binance (PERP)' : getExchangeName(exchange)}
          sx={{
            backgroundColor: getExchangeColor(exchange),
            color: 'white',
            fontWeight: 'bold',
            fontSize: '16px',
            px: 2
          }}
        />
      </Box>

      <TableContainer sx={{ maxHeight: 600 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold' }}>
                ランク
              </TableCell>
              <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold' }}>
                シンボル
              </TableCell>
              <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold' }} align="right">
                24時間出来高
              </TableCell>
              <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold' }} align="right">
                価格
              </TableCell>
              <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold' }} align="right">
                変動率
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row) => (
              <TableRow 
                key={`${row.exchange}-${row.symbol}`} 
                hover 
                sx={{ cursor: 'pointer' }}
                onClick={() => handleSymbolClick(row.symbol, row.exchange)}
              >
                <TableCell>
                  <Chip
                    label={`#${row.rank}`}
                    size="small"
                    sx={{
                      backgroundColor: row.rank <= 3 ? '#FFD700' : 'primary.main',
                      color: row.rank <= 3 ? 'black' : 'white',
                      fontWeight: 'bold',
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ position: 'relative' }}>
                      <Avatar
                        sx={{ 
                          width: 20, 
                          height: 20, 
                          backgroundColor: 'primary.main',
                          fontSize: '10px'
                        }}
                      >
                        {row.symbol.charAt(0)}
                      </Avatar>
                      {/* Rank Change Indicator */}
                      {row.rankChanged && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: -4,
                            right: -4,
                            backgroundColor: '#ff9800',
                            borderRadius: '50%',
                            width: 8,
                            height: 8,
                          }}
                        />
                      )}
                    </Box>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: 'white', 
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            '&:hover': { color: 'primary.main' }
                          }}
                          onClick={() => setSelectedSymbol({ symbol: row.symbol, exchange })}
                        >
                          {row.symbol}
                        </Typography>
                        {/* Chart Icon */}
                        <Tooltip title="出来高推移を表示">
                          <ShowChart 
                            sx={{ 
                              color: '#2196f3', 
                              fontSize: 16, 
                              cursor: 'pointer',
                              '&:hover': { color: '#64b5f6' }
                            }} 
                            onClick={() => setSelectedSymbol({ symbol: row.symbol, exchange })}
                          />
                        </Tooltip>
                        {/* Volume Spike Indicator */}
                        {row.volumeSpike && (
                          <Tooltip title={`5分間で$${(row.volumeIncrease5m! / 1000000).toFixed(1)}M上昇`}>
                            <TrendingUp sx={{ color: '#00e676', fontSize: 14 }} />
                          </Tooltip>
                        )}
                        {/* New Rank In Indicator */}
                        {row.newRankIn && (
                          <Tooltip title="21位以下からランクイン">
                            <Star sx={{ color: '#ffd700', fontSize: 14 }} />
                          </Tooltip>
                        )}
                      </Box>
                      {/* Previous Rank Info */}
                      {row.rankChanged && row.previousRank && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '10px' }}>
                          前回: #{row.previousRank}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                  {formatVolumeToMillion(row.quoteVolume)}
                </TableCell>
                <TableCell align="right" sx={{ color: 'white', fontFamily: 'monospace' }}>
                  {row.lastPrice}
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                    {getPriceChangeIcon(row.priceChangePercent)}
                    <Typography
                      variant="body2"
                      sx={{
                        color: getPriceChangeColor(row.priceChangePercent),
                        fontWeight: 'bold',
                      }}
                    >
                      {row.priceChangePercent}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );

  if (loading) {
    return (
      <Paper sx={{ p: 3, backgroundColor: 'background.paper', border: '1px solid #333' }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
          <CircularProgress />
          <Typography variant="h6" sx={{ ml: 2, color: 'text.secondary' }}>
            Loading {exchange} rankings...
          </Typography>
        </Box>
      </Paper>
    );
  }

  // Show empty state for binance if no data yet
  if (exchange === 'binance' && exchangeData.length === 0) {
    return (
      <Paper sx={{ p: 3, backgroundColor: 'background.paper', border: '1px solid #333' }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px" flexDirection="column">
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="h6" sx={{ color: 'text.secondary', mb: 1 }}>
            Binance data is initializing...
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            Fetching futures volume data from Binance API.<br/>
            This may take a few moments on first load.
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
            🏆 24時間出来高ランキング
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            最終更新: {lastUpdate}
          </Typography>
        </Box>
        <FormControlLabel
          control={
            <Switch
              checked={autoUpdate}
              onChange={(e) => setAutoUpdate(e.target.checked)}
              color="primary"
              size="small"
            />
          }
          label={
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Auto
            </Typography>
          }
        />
      </Box>

      {renderTable(exchangeData, exchange)}

      {selectedSymbol && (
        <VolumeDetailChart
          open={!!selectedSymbol}
          onClose={() => setSelectedSymbol(null)}
          symbol={selectedSymbol.symbol}
          exchange={selectedSymbol.exchange}
        />
      )}
    </Box>
  );
};

export default ExchangeVolumeTable;