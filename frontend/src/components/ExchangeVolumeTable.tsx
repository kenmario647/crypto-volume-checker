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
  ToggleButton,
  ToggleButtonGroup,
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
  initialRank?: number;
  exchange: 'binance' | 'binance-spot' | 'upbit' | 'bybit' | 'okx' | 'gateio' | 'bitget' | 'coinbase';
  rankChanged?: boolean;
  volumeSpike?: boolean;
  newRankIn?: boolean;
  volumeIncrease5m?: number;
}

interface ExchangeVolumeTableProps {
  exchange: 'binance' | 'binance-spot' | 'upbit' | 'bybit' | 'okx' | 'gateio' | 'bitget' | 'coinbase';
}

const ExchangeVolumeTable: React.FC<ExchangeVolumeTableProps> = ({ exchange }) => {
  const [exchangeData, setExchangeData] = useState<VolumeRankingData[]>([]);
  const [initialRankMap, setInitialRankMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState<{ symbol: string; exchange: string } | null>(null);
  const [marketType, setMarketType] = useState<'SPOT' | 'PERP'>('PERP');
  const [spotPerpData, setSpotPerpData] = useState<any[]>([]);

  // Determine if exchange supports SPOT/PERP
  const supportsSPOTPERP = ['binance', 'bybit', 'okx', 'gateio', 'bitget'].includes(exchange);
  
  // For Upbit and Coinbase, always show SPOT
  const effectiveMarketType = supportsSPOTPERP ? marketType : 'SPOT';

  useEffect(() => {
    // Initial data fetch
    if (supportsSPOTPERP) {
      fetchSpotPerpRankings();
    } else {
      fetchRankings();
    }
  }, [exchange, marketType]);

  useEffect(() => {
    // Setup WebSocket connection for real-time updates
    const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000');

    socket.on('volume-ranking-update', (data: any) => {
      if (autoUpdate) {
        if ((data.type === 'binance-ranking' && exchange === 'binance') || 
            (data.type === 'binance-spot-ranking' && exchange === 'binance-spot') ||
            (data.type === 'upbit-ranking' && exchange === 'upbit') ||
            (data.type === 'bybit-ranking' && exchange === 'bybit') ||
            (data.type === 'okx-ranking' && exchange === 'okx') ||
            (data.type === 'gateio-ranking' && exchange === 'gateio') ||
            (data.type === 'bitget-ranking' && exchange === 'bitget') ||
            (data.type === 'coinbase-ranking' && exchange === 'coinbase')) {
          
          // Debug logging for WebSocket data
          console.log(`[DEBUG] WebSocket ${data.type} received:`, {
            totalLength: data.data ? data.data.length : 0,
            symbols: data.data ? data.data.slice(0, 20).map((item: any) => item.symbol) : [],
            slicedLength: data.data ? data.data.slice(0, 15).length : 0
          });
          
          // Preserve initialRank from the stored map
          const updatedData = data.data.slice(0, 15).map((item: any) => {
            const key = item.symbol;
            const storedInitialRank = initialRankMap.get(key);
            const finalInitialRank = item.initialRank || storedInitialRank || item.rank;
            console.log(`[DEBUG] ${key}: initialRank from API=${item.initialRank}, stored=${storedInitialRank}, final=${finalInitialRank}`);
            return {
              ...item,
              initialRank: finalInitialRank
            };
          });
          setExchangeData(updatedData);
          setLastUpdate(new Date(data.timestamp).toLocaleTimeString());
          setLoading(false);
        }
      }
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [autoUpdate, exchange, initialRankMap]);

  const fetchSpotPerpRankings = async () => {
    try {
      setLoading(true);
      const endpoint = effectiveMarketType === 'SPOT' ? 'spot' : 'perp';
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/spot-perp-volume/${endpoint}?exchange=${exchange}&limit=15`
      );
      const result = await response.json();
      
      if (result.success) {
        setSpotPerpData(result.data.slice(0, 15));
        setLastUpdate(new Date().toLocaleTimeString());
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching SPOT/PERP rankings:', error);
      setLoading(false);
      // Fall back to regular rankings
      fetchRankings();
    }
  };

  const fetchRankings = async () => {
    try {
      let endpoint = '/api/volume-ranking/';
      
      // Determine endpoint based on exchange
      switch (exchange) {
        case 'binance':
          endpoint += 'binance';
          break;
        case 'binance-spot':
          endpoint += 'binance-spot';
          break;
        case 'upbit':
          endpoint += 'upbit';
          break;
        case 'bybit':
          endpoint += 'bybit';
          break;
        case 'okx':
          endpoint += 'okx';
          break;
        case 'gateio':
          endpoint += 'gateio';
          break;
        case 'bitget':
          endpoint += 'bitget';
          break;
        case 'coinbase':
          endpoint += 'coinbase';
          break;
        default:
          endpoint = '/api/volume-ranking/binance'; // Use binance as default instead of top20
      }
      
      const fullUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${endpoint}`;
      console.log(`[DEBUG] Fetching from: ${fullUrl} for exchange: ${exchange}`);
      
      const response = await fetch(fullUrl);
      const result = await response.json();
      
      if (result.success) {
        const data = result.data.rankings || result.data;
        
        // Debug logging
        console.log(`[DEBUG] ${exchange} API response:`, {
          totalLength: data ? data.length : 0,
          symbols: data ? data.slice(0, 20).map((item: any) => item.symbol) : [],
          slicedLength: data ? data.slice(0, 15).length : 0
        });
        
        // If Binance data is empty but other exchange has data, show message
        if (exchange === 'binance' && (!data || data.length === 0)) {
          console.log('Binance data is still loading, please wait...');
        }
        
        const rankings = data ? data.slice(0, 15) : [];
        
        // Store initial ranks for future WebSocket updates
        const newInitialRankMap = new Map<string, number>();
        rankings.forEach((item: VolumeRankingData) => {
          newInitialRankMap.set(item.symbol, item.initialRank || item.rank);
        });
        setInitialRankMap(newInitialRankMap);
        
        setExchangeData(rankings);
        setLastUpdate(new Date().toLocaleTimeString());
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
      { symbol: 'ALGO', volume: '789', quoteVolume: '41000.0M', volume24h: '41000.0M', priceChangePercent: '2.12', lastPrice: '345', rank: 15, exchange: 'upbit' }
    ];

    const sampleData = exchange === 'binance' ? binanceSampleData : upbitSampleData;
    
    setExchangeData(sampleData);
    setLastUpdate(new Date().toLocaleTimeString());
    setLoading(false);
  };

  const getExchangeColor = (exchange: string) => {
    switch (exchange) {
      case 'binance': return '#F3BA2F';
      case 'binance-spot': return '#4CAF50';
      case 'upbit': return '#004FFF';
      case 'bybit': return '#FF6B00';
      case 'okx': return '#000000';
      case 'gateio': return '#E6001E';
      case 'bitget': return '#00D4FF';
      case 'coinbase': return '#1E52E4';
      default: return '#666';
    }
  };

  const getExchangeName = (exchange: string) => {
    switch (exchange) {
      case 'binance': return 'Binance';
      case 'binance-spot': return 'Binance SPOT';
      case 'upbit': return 'Upbit';
      case 'bybit': return 'Bybit';
      case 'okx': return 'OKX';
      case 'gateio': return 'Gate.io';
      case 'bitget': return 'Bitget';
      case 'coinbase': return 'Coinbase';
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

  const getRankChangeDisplay = (row: VolumeRankingData) => {
    // 新規ランクイン（21位以下から15位以内へ）
    if (row.newRankIn) {
      return (
        <Chip
          label="NEW"
          size="small"
          sx={{
            backgroundColor: '#ffd700',
            color: 'black',
            fontWeight: 'bold',
            fontSize: '10px',
            height: '18px',
            ml: 0.5
          }}
        />
      );
    }
    
    // 前回の順位がある場合
    if (row.previousRank !== undefined && row.previousRank !== null) {
      const rankDiff = row.previousRank - row.rank;
      
      // 順位変動なし
      if (rankDiff === 0) {
        return (
          <Typography variant="caption" sx={{ color: '#666', ml: 1, fontSize: '11px' }}>
            ー
          </Typography>
        );
      }
      
      // 順位上昇
      if (rankDiff > 0) {
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.5 }}>
            <TrendingUp sx={{ color: '#00e676', fontSize: 14 }} />
            <Typography variant="caption" sx={{ color: '#00e676', fontWeight: 'bold', fontSize: '11px' }}>
              +{rankDiff}
            </Typography>
          </Box>
        );
      }
      
      // 順位下降
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.5 }}>
          <TrendingDown sx={{ color: '#ff1744', fontSize: 14 }} />
          <Typography variant="caption" sx={{ color: '#ff1744', fontWeight: 'bold', fontSize: '11px' }}>
            {rankDiff}
          </Typography>
        </Box>
      );
    }
    
    // データがない場合（初回表示など）
    return null;
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
    if ((exchange === 'binance' || exchange === 'binance-spot') && !symbol.endsWith('USDT')) {
      formattedSymbol = `${symbol}USDT`;
    }
    
    setSelectedSymbol({ symbol: formattedSymbol, exchange });
  };

  const handleMarketTypeChange = (event: React.MouseEvent<HTMLElement>, newMarketType: 'SPOT' | 'PERP' | null) => {
    if (newMarketType !== null) {
      setMarketType(newMarketType);
    }
  };

  const renderTable = (data: any[], exchange: 'binance' | 'binance-spot' | 'upbit' | 'bybit' | 'okx' | 'gateio' | 'bitget' | 'coinbase') => (
    <Paper sx={{ backgroundColor: 'background.paper', border: '1px solid #333' }}>
      <Box sx={{ p: 0.5, borderBottom: '1px solid #333', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Chip
            label={getExchangeName(exchange)}
            sx={{
              backgroundColor: getExchangeColor(exchange),
              color: 'white',
              fontWeight: 'bold',
              fontSize: '12px',
              px: 1
            }}
          />
        </Box>
        {supportsSPOTPERP && (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <ToggleButtonGroup
              value={marketType}
              exclusive
              onChange={handleMarketTypeChange}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  color: 'white',
                  borderColor: '#333',
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'black',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                  },
                },
              }}
            >
              <ToggleButton value="SPOT">
                SPOT
              </ToggleButton>
              <ToggleButton value="PERP">
                PERP
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}
      </Box>

      <TableContainer>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold' }}>
                ランク
              </TableCell>
              <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold' }}>
                起動時順位
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
                出来高変動
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
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Chip
                      label={`#${row.rank}`}
                      size="small"
                      sx={{
                        backgroundColor: row.rank <= 3 ? '#FFD700' : 'primary.main',
                        color: row.rank <= 3 ? 'black' : 'white',
                        fontWeight: 'bold',
                      }}
                    />
                    {getRankChangeDisplay(row)}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={row.initialRank ? `#${row.initialRank}` : '-'}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '0.75rem'
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
                      </Box>
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
      <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="body1" sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.95rem' }}>
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

      {renderTable(supportsSPOTPERP ? spotPerpData.slice(0, 15) : exchangeData, exchange)}

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