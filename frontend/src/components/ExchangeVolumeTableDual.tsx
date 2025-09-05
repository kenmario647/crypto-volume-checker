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
  Switch,
  FormControlLabel,
} from '@mui/material';
import { TrendingUp, TrendingDown, Star } from '@mui/icons-material';
import io from 'socket.io-client';
import VolumeDetailChart from './VolumeDetailChart';
import axios from 'axios';

interface HourlyChange {
  time: string;
  rank: number;
  change: number;
  direction: string;
}

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
  exchange: 'binance' | 'upbit' | 'bybit' | 'okx' | 'gateio' | 'bitget' | 'coinbase';
  rankChanged?: boolean;
  volumeSpike?: boolean;
  newRankIn?: boolean;
  volumeIncrease5m?: number;
  hourlyChanges?: HourlyChange[];
}

interface SpotPerpVolumeData {
  rank: number;
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  volumeUsd: number;
  marketType: 'SPOT' | 'PERP';
  exchange: string;
  initialRank?: number;
  hourlyChanges?: HourlyChange[];
}

interface ExchangeVolumeTableDualProps {
  exchange: 'binance' | 'upbit' | 'bybit' | 'okx' | 'gateio' | 'bitget' | 'mexc' | 'bithumb' | 'coinbase';
}

const ExchangeVolumeTableDual: React.FC<ExchangeVolumeTableDualProps> = ({ exchange }) => {
  const [perpData, setPerpData] = useState<SpotPerpVolumeData[]>([]);
  const [spotData, setSpotData] = useState<SpotPerpVolumeData[]>([]);
  const [exchangeData, setExchangeData] = useState<VolumeRankingData[]>([]);
  const [initialRankMap, setInitialRankMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState<{ symbol: string; exchange: string } | null>(null);

  // Determine if exchange supports SPOT/PERP
  const supportsSPOTPERP = ['binance', 'bybit', 'okx', 'gateio', 'bitget', 'mexc', 'upbit', 'coinbase', 'bithumb'].includes(exchange);

  useEffect(() => {
    // Initial data fetch
    if (supportsSPOTPERP) {
      fetchBothMarketTypes();
    } else {
      fetchRankings();
    }
  }, [exchange]);

  useEffect(() => {
    // Setup WebSocket connection for real-time updates
    const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000');

    socket.on('volume-ranking-update', (data: any) => {
      if (autoUpdate) {
        if ((exchange === 'binance' && data.type === 'binance-ranking') ||
            (exchange === 'upbit' && data.type === 'upbit-ranking') ||
            (exchange === 'bybit' && data.type === 'bybit-ranking') ||
            (exchange === 'okx' && data.type === 'okx-ranking') ||
            (exchange === 'gateio' && data.type === 'gateio-ranking') ||
            (exchange === 'bitget' && data.type === 'bitget-ranking')) {
          console.log(`WebSocket update for ${exchange}:`, data.data?.slice(0, 3).map((item: any) => ({
            symbol: item.symbol,
            rank: item.rank,
            previousRank: item.previousRank,
            rankChanged: item.rankChanged,
            newRankIn: item.newRankIn
          })));
          // Preserve initialRank from the stored map
          const updatedData = data.data.slice(0, 15).map((item: any) => {
            const key = item.symbol;
            const storedInitialRank = initialRankMap.get(key);
            return {
              ...item,
              initialRank: item.initialRank || storedInitialRank || item.rank
            };
          });
          setExchangeData(updatedData);
          setLastUpdate(new Date(data.timestamp).toLocaleTimeString());
          setLoading(false);
        } else if (exchange === 'mexc' && data.type === 'mexc-ranking') {
          // Handle MEXC data with spot and futures - transform from VolumeRankingData to SpotPerpVolumeData
          if (data.data.spot) {
            const transformedSpot = data.data.spot.slice(0, 15).map((item: any) => ({
              rank: item.rank,
              symbol: item.symbol,
              price: parseFloat(item.lastPrice?.replace(/[$,]/g, '') || '0'),
              change24h: parseFloat(item.priceChangePercent?.replace('%', '') || '0'),
              volume24h: item.originalQuoteVolume || parseFloat(item.quoteVolume?.replace(/[$,BMK]/g, '') || '0'),
              volumeUsd: item.originalQuoteVolume || parseFloat(item.quoteVolume?.replace(/[$,BMK]/g, '') || '0'),
              marketType: 'SPOT' as const,
              exchange: 'mexc',
              previousRank: item.previousRank,
              rankChanged: item.rankChanged,
              newRankIn: item.newRankIn
            }));
            setSpotData(transformedSpot);
          }
          if (data.data.futures) {
            const transformedFutures = data.data.futures.slice(0, 15).map((item: any) => ({
              rank: item.rank,
              symbol: item.symbol,
              price: parseFloat(item.lastPrice?.replace(/[$,]/g, '') || '0'),
              change24h: parseFloat(item.priceChangePercent?.replace('%', '') || '0'),
              volume24h: item.originalQuoteVolume || parseFloat(item.quoteVolume?.replace(/[$,BMK]/g, '') || '0'),
              volumeUsd: item.originalQuoteVolume || parseFloat(item.quoteVolume?.replace(/[$,BMK]/g, '') || '0'),
              marketType: 'PERP' as const,
              exchange: 'mexc',
              previousRank: item.previousRank,
              rankChanged: item.rankChanged,
              newRankIn: item.newRankIn
            }));
            setPerpData(transformedFutures);
          }
          setLastUpdate(new Date(data.timestamp).toLocaleTimeString());
          setLoading(false);
        } else if (exchange === 'bithumb' && data.type === 'bithumb-ranking') {
          const updatedData = data.data.slice(0, 15).map((item: any) => {
            const key = item.symbol;
            const storedInitialRank = initialRankMap.get(key);
            return {
              ...item,
              initialRank: item.initialRank || storedInitialRank || item.rank
            };
          });
          setExchangeData(updatedData);
          setLastUpdate(new Date(data.timestamp).toLocaleTimeString());
          setLoading(false);
        } else if (exchange === 'coinbase' && data.type === 'coinbase-ranking') {
          const updatedData = data.data.slice(0, 15).map((item: any) => {
            const key = item.symbol;
            const storedInitialRank = initialRankMap.get(key);
            return {
              ...item,
              initialRank: item.initialRank || storedInitialRank || item.rank
            };
          });
          setExchangeData(updatedData);
          setLastUpdate(new Date(data.timestamp).toLocaleTimeString());
          setLoading(false);
        }
      }
    });

    // Refresh data every 30 seconds for SPOT/PERP exchanges
    let intervalId: NodeJS.Timeout | undefined;
    if (supportsSPOTPERP && autoUpdate) {
      intervalId = setInterval(() => {
        fetchBothMarketTypes();
      }, 30000);
    }

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoUpdate, exchange, supportsSPOTPERP, initialRankMap]);

  const fetchBothMarketTypes = async () => {
    try {
      setLoading(true);
      
      // Special handling for SPOT-only exchanges (Upbit, Bithumb, Coinbase)
      if (['upbit', 'bithumb', 'coinbase'].includes(exchange)) {
        const spotResponse = await axios.get(
          `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/spot-perp-volume/spot`,
          { params: { exchange, limit: 15 } }
        );
        
        if (spotResponse.data.success) {
          console.log(`${exchange} SPOT data received:`, spotResponse.data.data?.length, 'items');
          if (exchange === 'upbit') {
            console.log('Full Upbit spot data:', spotResponse.data.data?.map((item: any) => ({
              rank: item.rank,
              symbol: item.symbol,
              volumeUsd: item.volumeUsd
            })));
          }
          setSpotData(spotResponse.data.data);
          setPerpData([]); // No PERP data for these exchanges
        }
        
        setLastUpdate(new Date().toLocaleTimeString());
        setLoading(false);
        return;
      }
      
      // Special handling for MEXC
      if (exchange === 'mexc') {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/volume-ranking/mexc`
        );
        
        if (response.data.success) {
          // Transform MEXC data from VolumeRankingData to SpotPerpVolumeData format
          if (response.data.data.rankings) {
            const transformedSpot = response.data.data.rankings.slice(0, 15).map((item: any) => ({
              rank: item.rank,
              symbol: item.symbol,
              price: parseFloat(item.lastPrice?.replace(/[$,]/g, '') || '0'),
              change24h: parseFloat(item.priceChangePercent?.replace('%', '') || '0'),
              volume24h: item.originalQuoteVolume || parseFloat(item.quoteVolume?.replace(/[$,BMK]/g, '') || '0'),
              volumeUsd: item.originalQuoteVolume || parseFloat(item.quoteVolume?.replace(/[$,BMK]/g, '') || '0'),
              marketType: 'SPOT' as const,
              exchange: 'mexc',
              previousRank: item.previousRank,
              rankChanged: item.rankChanged,
              newRankIn: item.newRankIn
            }));
            setSpotData(transformedSpot);
          }
          if (response.data.data.futures) {
            const transformedFutures = response.data.data.futures.slice(0, 15).map((item: any) => ({
              rank: item.rank,
              symbol: item.symbol,
              price: parseFloat(item.lastPrice?.replace(/[$,]/g, '') || '0'),
              change24h: parseFloat(item.priceChangePercent?.replace('%', '') || '0'),
              volume24h: item.originalQuoteVolume || parseFloat(item.quoteVolume?.replace(/[$,BMK]/g, '') || '0'),
              volumeUsd: item.originalQuoteVolume || parseFloat(item.quoteVolume?.replace(/[$,BMK]/g, '') || '0'),
              marketType: 'PERP' as const,
              exchange: 'mexc',
              previousRank: item.previousRank,
              rankChanged: item.rankChanged,
              newRankIn: item.newRankIn
            }));
            setPerpData(transformedFutures);
          }
          setLastUpdate(new Date(response.data.data.updateTime).toLocaleTimeString());
        }
        setLoading(false);
        return;
      }
      
      // For other exchanges, use spot-perp-volume endpoint
      const [perpResponse, spotResponse] = await Promise.all([
        axios.get(
          `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/spot-perp-volume/perp`,
          { params: { exchange, limit: 15 } }
        ),
        axios.get(
          `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/spot-perp-volume/spot`,
          { params: { exchange, limit: 15 } }
        )
      ]);

      if (perpResponse.data.success) {
        console.log('Perp data received:', perpResponse.data.data?.slice(0, 2).map((item: any) => ({
          symbol: item.symbol,
          rank: item.rank,
          previousRank: item.previousRank,
          rankChanged: item.rankChanged,
          newRankIn: item.newRankIn
        })));
        setPerpData(perpResponse.data.data);
      }
      if (spotResponse.data.success) {
        console.log('Spot data received:', spotResponse.data.data?.slice(0, 2).map((item: any) => ({
          symbol: item.symbol,
          rank: item.rank,
          previousRank: item.previousRank,
          rankChanged: item.rankChanged,
          newRankIn: item.newRankIn
        })));
        // Log full data for Upbit to debug RED visibility
        if (exchange === 'upbit') {
          console.log('Full Upbit spot data:', spotResponse.data.data?.map((item: any) => ({
            rank: item.rank,
            symbol: item.symbol,
            volumeUsd: item.volumeUsd
          })));
        }
        setSpotData(spotResponse.data.data);
      }

      setLastUpdate(new Date().toLocaleTimeString());
      setLoading(false);
    } catch (error) {
      console.error('Error fetching SPOT/PERP data:', error);
      setLoading(false);
      // Fall back to regular rankings
      fetchRankings();
    }
  };

  const fetchRankings = async () => {
    try {
      let endpoint = '/api/volume-ranking/';
      
      switch (exchange) {
        case 'binance':
          endpoint += 'binance';
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
        case 'mexc':
          endpoint += 'mexc';
          break;
        case 'bithumb':
          endpoint += 'bithumb';
          break;
        case 'coinbase':
          endpoint += 'coinbase';
          break;
        default:
          endpoint += 'binance';
      }
      
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${endpoint}`);
      const result = await response.json();
      
      // デバッグログ
      console.log(`Fetched rankings for ${exchange}:`, result.data?.rankings?.slice(0, 3).map((item: any) => ({
        symbol: item.symbol,
        rank: item.rank,
        previousRank: item.previousRank,
        rankChanged: item.rankChanged,
        newRankIn: item.newRankIn
      })));
      
      if (result.success) {
        if (exchange === 'mexc') {
          // Handle MEXC special case with spot and futures - transform data
          if (result.data.rankings) {
            const transformedSpot = result.data.rankings.slice(0, 15).map((item: any) => ({
              rank: item.rank,
              symbol: item.symbol,
              price: parseFloat(item.lastPrice?.replace(/[$,]/g, '') || '0'),
              change24h: parseFloat(item.priceChangePercent?.replace('%', '') || '0'),
              volume24h: item.originalQuoteVolume || parseFloat(item.quoteVolume?.replace(/[$,BMK]/g, '') || '0'),
              volumeUsd: item.originalQuoteVolume || parseFloat(item.quoteVolume?.replace(/[$,BMK]/g, '') || '0'),
              marketType: 'SPOT' as const,
              exchange: 'mexc',
              previousRank: item.previousRank,
              rankChanged: item.rankChanged,
              newRankIn: item.newRankIn
            }));
            setSpotData(transformedSpot);
          }
          if (result.data.futures) {
            const transformedFutures = result.data.futures.slice(0, 15).map((item: any) => ({
              rank: item.rank,
              symbol: item.symbol,
              price: parseFloat(item.lastPrice?.replace(/[$,]/g, '') || '0'),
              change24h: parseFloat(item.priceChangePercent?.replace('%', '') || '0'),
              volume24h: item.originalQuoteVolume || parseFloat(item.quoteVolume?.replace(/[$,BMK]/g, '') || '0'),
              volumeUsd: item.originalQuoteVolume || parseFloat(item.quoteVolume?.replace(/[$,BMK]/g, '') || '0'),
              marketType: 'PERP' as const,
              exchange: 'mexc',
              previousRank: item.previousRank,
              rankChanged: item.rankChanged,
              newRankIn: item.newRankIn
            }));
            setPerpData(transformedFutures);
          }
        } else {
          const data = result.data.rankings || result.data[exchange];
          // デバッグログ
          console.log(`Setting exchangeData for ${exchange}:`, data?.slice(0, 3).map((item: any) => ({
            symbol: item.symbol,
            rank: item.rank,
            previousRank: item.previousRank,
            rankChanged: item.rankChanged,
            newRankIn: item.newRankIn
          })));
          const rankings = data ? data.slice(0, 15) : [];
          
          // Store initial ranks for future WebSocket updates
          const newInitialRankMap = new Map<string, number>();
          rankings.forEach((item: VolumeRankingData) => {
            newInitialRankMap.set(item.symbol, item.initialRank || item.rank);
          });
          setInitialRankMap(newInitialRankMap);
          
          setExchangeData(rankings);
        }
        setLastUpdate(new Date(result.data.updateTime).toLocaleTimeString());
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching volume rankings:', error);
      setLoading(false);
    }
  };

  const getExchangeColor = (exchange: string) => {
    switch (exchange) {
      case 'binance': return '#F3BA2F';
      case 'upbit': return '#004FFF';
      case 'bybit': return '#FF6B00';
      case 'okx': return '#000000';
      case 'gateio': return '#E6001E';
      case 'bitget': return '#00D4FF';
      case 'mexc': return '#00B897';
      case 'bithumb': return '#F76B1C';
      case 'coinbase': return '#0052FF';
      default: return '#666';
    }
  };

  const getExchangeName = (exchange: string) => {
    switch (exchange) {
      case 'binance': return 'Binance';
      case 'upbit': return 'Upbit';
      case 'bybit': return 'Bybit';
      case 'okx': return 'OKX';
      case 'gateio': return 'Gate.io';
      case 'bitget': return 'Bitget';
      case 'mexc': return 'MEXC';
      case 'bithumb': return 'Bithumb';
      case 'coinbase': return 'Coinbase';
      default: return exchange;
    }
  };

  const getRankChangeDisplay = (row: any) => {
    // デバッグログ
    console.log('getRankChangeDisplay row:', {
      symbol: row.symbol,
      rank: row.rank,
      previousRank: row.previousRank,
      rankChanged: row.rankChanged,
      newRankIn: row.newRankIn
    });
    
    // 新規ランクイン（21位以下から15位以内へ）
    if (row.newRankIn) {
      return (
        <Chip
          label="NEW"
          size="small"
          sx={{
            backgroundColor: '#FFD700',
            color: '#000',
            fontWeight: 'bold',
            fontSize: '12px',
            height: '22px',
            ml: 0.5,
            animation: 'pulse 1.5s ease-in-out infinite',
            '@keyframes pulse': {
              '0%': { opacity: 1 },
              '50%': { opacity: 0.7 },
              '100%': { opacity: 1 },
            }
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
          <Typography variant="caption" sx={{ color: '#999', ml: 1, fontSize: '12px', fontWeight: 'bold' }}>
            ー
          </Typography>
        );
      }
      
      // 順位上昇
      if (rankDiff > 0) {
        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            ml: 0.5,
            backgroundColor: 'rgba(0, 255, 136, 0.15)',
            borderRadius: '4px',
            px: 0.5,
            py: 0.2
          }}>
            <TrendingUp sx={{ color: '#00FF88', fontSize: 18 }} />
            <Typography variant="caption" sx={{ 
              color: '#00FF88', 
              fontWeight: 'bold', 
              fontSize: '13px',
              ml: 0.3
            }}>
              +{rankDiff}
            </Typography>
          </Box>
        );
      }
      
      // 順位下降
      return (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          ml: 0.5,
          backgroundColor: 'rgba(255, 23, 68, 0.15)',
          borderRadius: '4px',
          px: 0.5,
          py: 0.2
        }}>
          <TrendingDown sx={{ color: '#FF1744', fontSize: 18 }} />
          <Typography variant="caption" sx={{ 
            color: '#FF1744', 
            fontWeight: 'bold', 
            fontSize: '13px',
            ml: 0.3
          }}>
            {rankDiff}
          </Typography>
        </Box>
      );
    }
    
    // データがない場合（初回表示など）
    return null;
  };

  const formatVolume = (volume: number): string => {
    if (!volume && volume !== 0) return '$0';
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(1)}M`;
    if (volume >= 1e3) return `$${(volume / 1e3).toFixed(1)}K`;
    return `$${volume.toFixed(2)}`;
  };

  const formatPrice = (price: number): string => {
    if (price >= 1000) return `$${price.toFixed(0)}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  };

  const formatVolumeToMillion = (volumeString: string) => {
    if (typeof volumeString !== 'string') return volumeString;
    if (volumeString.endsWith('M')) return volumeString;
    
    const cleanedString = volumeString.replace(/[$,]/g, '');
    
    if (volumeString.includes('B')) {
      const value = parseFloat(cleanedString.replace('B', ''));
      return `${(value * 1000).toFixed(1)}M`;
    }
    
    if (volumeString.includes('K')) {
      const value = parseFloat(cleanedString.replace('K', ''));
      return `${(value / 1000).toFixed(1)}M`;
    }
    
    const numericValue = parseFloat(cleanedString);
    if (!isNaN(numericValue)) {
      return `${(numericValue / 1e6).toFixed(1)}M`;
    }
    
    return volumeString;
  };

  const handleSymbolClick = (symbol: string, exchange: string) => {
    let formattedSymbol = symbol;
    
    if (exchange === 'binance' && !symbol.endsWith('USDT')) {
      formattedSymbol = `${symbol}USDT`;
    }
    
    setSelectedSymbol({ symbol: formattedSymbol, exchange });
  };

  const renderSpotPerpTable = (data: SpotPerpVolumeData[], marketType: 'SPOT' | 'PERP') => (
    <Paper sx={{ backgroundColor: 'background.paper', border: '1px solid #333', height: '100%' }}>
      <Box sx={{ p: 0.5, borderBottom: '1px solid #333', textAlign: 'center' }}>
        <Chip
          label={marketType}
          sx={{
            backgroundColor: marketType === 'PERP' ? '#FF6B00' : '#4CAF50',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '12px',
            px: 1
          }}
        />
      </Box>

      <TableContainer>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold', width: '50px' }}>
                #
              </TableCell>
              <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold', minWidth: '280px' }}>
                時間別順位（最新6時間）
              </TableCell>
              <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold' }}>
                Symbol
              </TableCell>
              <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold' }} align="right">
                Volume
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.slice(0, 15).map((row) => (
              <TableRow 
                key={`${row.symbol}-${marketType}`} 
                hover 
                sx={{ cursor: 'pointer' }}
                onClick={() => handleSymbolClick(row.symbol, exchange)}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: row.rank <= 3 ? '#FFD700' : 'white' }}>
                      {row.rank}
                    </Typography>
                    {getRankChangeDisplay(row)}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                    {row.hourlyChanges && row.hourlyChanges.length > 0 ? (
                      row.hourlyChanges.slice(-6).map((change: HourlyChange, idx: number) => (
                        <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '42px' }}>
                          <Typography variant="caption" sx={{ color: '#FFD700', fontSize: '9px', fontWeight: 'bold' }}>
                            {change.time}
                          </Typography>
                          <Chip
                            size="small"
                            label={`${change.rank}位`}
                            sx={{
                              backgroundColor: change.change > 0 ? '#4caf5030' : change.change < 0 ? '#f4433630' : '#2196f330',
                              color: change.change > 0 ? '#76ff03' : change.change < 0 ? '#ff5252' : '#64b5f6',
                              border: `1px solid ${change.change > 0 ? '#4caf50' : change.change < 0 ? '#f44336' : '#2196f3'}`,
                              fontSize: '11px',
                              fontWeight: 'bold',
                              height: '18px',
                              minWidth: '40px',
                              '& .MuiChip-label': {
                                padding: '0 4px',
                              }
                            }}
                          />
                          {change.change !== 0 && (
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: change.change > 0 ? '#76ff03' : '#ff5252',
                                fontSize: '9px',
                                fontWeight: 'bold'
                              }}
                            >
                              {change.change > 0 ? '↑' : '↓'}{Math.abs(change.change)}
                            </Typography>
                          )}
                        </Box>
                      ))
                    ) : (
                      <Typography variant="caption" sx={{ color: '#999', fontSize: '11px' }}>
                        データ収集中...
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'white', 
                      fontWeight: 'bold',
                      '&:hover': { color: 'primary.main' }
                    }}
                  >
                    {row.symbol}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                  {formatVolume(row.volumeUsd)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );

  const renderSingleTable = (data: VolumeRankingData[]) => (
    <Paper sx={{ backgroundColor: 'background.paper', border: '1px solid #333', height: '100%' }}>
      <Box sx={{ p: 0.5, borderBottom: '1px solid #333', textAlign: 'center' }}>
        <Chip
          label="SPOT"
          sx={{
            backgroundColor: '#4CAF50',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '12px',
            px: 1
          }}
        />
      </Box>

      <TableContainer>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold', width: '50px' }}>
                Rank
              </TableCell>
              <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold', minWidth: '280px' }}>
                時間別順位（最新6時間）
              </TableCell>
              <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold' }}>
                Symbol
              </TableCell>
              <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold' }} align="right">
                24h Volume
              </TableCell>
              <TableCell sx={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold' }} align="right">
                Price
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.slice(0, 15).map((row) => (
              <TableRow 
                key={`${row.exchange}-${row.symbol}`} 
                hover 
                sx={{ cursor: 'pointer' }}
                onClick={() => handleSymbolClick(row.symbol, row.exchange)}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: row.rank <= 3 ? '#FFD700' : 'white' }}>
                      #{row.rank}
                    </Typography>
                    {getRankChangeDisplay(row)}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                    {row.hourlyChanges && row.hourlyChanges.length > 0 ? (
                      row.hourlyChanges.slice(-6).map((change: HourlyChange, idx: number) => (
                        <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '42px' }}>
                          <Typography variant="caption" sx={{ color: '#FFD700', fontSize: '9px', fontWeight: 'bold' }}>
                            {change.time}
                          </Typography>
                          <Chip
                            size="small"
                            label={`${change.rank}位`}
                            sx={{
                              backgroundColor: change.change > 0 ? '#4caf5030' : change.change < 0 ? '#f4433630' : '#2196f330',
                              color: change.change > 0 ? '#76ff03' : change.change < 0 ? '#ff5252' : '#64b5f6',
                              border: `1px solid ${change.change > 0 ? '#4caf50' : change.change < 0 ? '#f44336' : '#2196f3'}`,
                              fontSize: '11px',
                              fontWeight: 'bold',
                              height: '18px',
                              minWidth: '40px',
                              '& .MuiChip-label': {
                                padding: '0 4px',
                              }
                            }}
                          />
                          {change.change !== 0 && (
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: change.change > 0 ? '#76ff03' : '#ff5252',
                                fontSize: '9px',
                                fontWeight: 'bold'
                              }}
                            >
                              {change.change > 0 ? '↑' : '↓'}{Math.abs(change.change)}
                            </Typography>
                          )}
                        </Box>
                      ))
                    ) : (
                      <Typography variant="caption" sx={{ color: '#999', fontSize: '11px' }}>
                        データ収集中...
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'white', 
                      fontWeight: 'bold',
                      '&:hover': { color: 'primary.main' }
                    }}
                  >
                    {row.symbol}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                  {formatVolumeToMillion(row.quoteVolume)}
                </TableCell>
                <TableCell align="right" sx={{ color: 'white', fontFamily: 'monospace' }}>
                  {row.lastPrice}
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
            Loading {getExchangeName(exchange)} rankings...
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box 
              component="span" 
              sx={{ 
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: getExchangeColor(exchange)
              }}
            />
            {getExchangeName(exchange)} 24h Volume Ranking
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Last update: {lastUpdate}
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
              Auto Update
            </Typography>
          }
        />
      </Box>

      {supportsSPOTPERP ? (
        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
          <Box sx={{ flex: 1 }}>
            {renderSpotPerpTable(perpData, 'PERP')}
          </Box>
          <Box sx={{ flex: 1 }}>
            {renderSpotPerpTable(spotData, 'SPOT')}
          </Box>
        </Box>
      ) : (
        <Box>
          {renderSingleTable(exchangeData)}
        </Box>
      )}

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

export default ExchangeVolumeTableDual;