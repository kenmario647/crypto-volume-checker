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
  Tabs,
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Chip,
} from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';
import axios from 'axios';

interface SpotPerpVolumeData {
  rank: number;
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  volumeUsd: number;
  marketType: 'SPOT' | 'PERP';
  exchange: string;
}

const SpotPerpVolumeTable: React.FC = () => {
  const [marketType, setMarketType] = useState<'SPOT' | 'PERP'>('SPOT');
  const [exchange, setExchange] = useState<string>('binance');
  const [data, setData] = useState<SpotPerpVolumeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exchanges = [
    { value: 'binance', label: 'Binance' },
    { value: 'bybit', label: 'Bybit' },
    { value: 'okx', label: 'OKX' },
    { value: 'gateio', label: 'Gate.io' },
    { value: 'bitget', label: 'Bitget' }
  ];

  useEffect(() => {
    fetchVolumeData();
  }, [marketType, exchange]);

  const fetchVolumeData = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = marketType === 'SPOT' ? 'spot' : 'perp';
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/spot-perp-volume/${endpoint}`,
        {
          params: {
            exchange,
            limit: 50
          }
        }
      );
      
      if (response.data.success) {
        setData(response.data.data);
      } else {
        setError('Failed to fetch volume data');
      }
    } catch (err) {
      console.error('Error fetching volume data:', err);
      setError('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const formatVolume = (volume: number): string => {
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(2)}M`;
    if (volume >= 1e3) return `$${(volume / 1e3).toFixed(2)}K`;
    return `$${volume.toFixed(2)}`;
  };

  const formatPrice = (price: number): string => {
    if (price >= 1000) return `$${price.toFixed(0)}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  };

  const handleMarketTypeChange = (event: React.SyntheticEvent, newValue: 'SPOT' | 'PERP') => {
    setMarketType(newValue);
  };

  return (
    <Paper sx={{ p: 3, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
          {exchange.toUpperCase()} Volume Ranking
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tabs value={marketType} onChange={handleMarketTypeChange}>
            <Tab 
              label="SPOT" 
              value="SPOT" 
              sx={{ 
                fontWeight: marketType === 'SPOT' ? 'bold' : 'normal',
                color: marketType === 'SPOT' ? 'primary.main' : 'text.secondary'
              }}
            />
            <Tab 
              label="PERP" 
              value="PERP"
              sx={{ 
                fontWeight: marketType === 'PERP' ? 'bold' : 'normal',
                color: marketType === 'PERP' ? 'primary.main' : 'text.secondary'
              }}
            />
          </Tabs>
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Exchange</InputLabel>
            <Select
              value={exchange}
              label="Exchange"
              onChange={(e) => setExchange(e.target.value)}
              size="small"
            >
              {exchanges.map((ex) => (
                <MenuItem key={ex.value} value={ex.value}>
                  {ex.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ textAlign: 'center', py: 5 }}>
          <Typography color="error">{error}</Typography>
        </Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width="60">Rank</TableCell>
                <TableCell>Symbol</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="right">24h %</TableCell>
                <TableCell align="right">Volume (24h)</TableCell>
                <TableCell align="right">Volume (USD)</TableCell>
                <TableCell align="center">Type</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row) => (
                <TableRow key={`${row.symbol}-${row.exchange}-${row.marketType}`}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      #{row.rank}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {row.symbol}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {formatPrice(row.price)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      {row.change24h > 0 ? (
                        <TrendingUp sx={{ fontSize: 16, color: 'success.main', mr: 0.5 }} />
                      ) : (
                        <TrendingDown sx={{ fontSize: 16, color: 'error.main', mr: 0.5 }} />
                      )}
                      <Typography
                        variant="body2"
                        sx={{
                          color: row.change24h > 0 ? 'success.main' : 'error.main',
                          fontWeight: 'bold'
                        }}
                      >
                        {row.change24h > 0 ? '+' : ''}{row.change24h.toFixed(2)}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {row.volume24h.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {formatVolume(row.volumeUsd)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={row.marketType}
                      size="small"
                      color={row.marketType === 'SPOT' ? 'primary' : 'secondary'}
                      sx={{ fontWeight: 'bold' }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
};

export default SpotPerpVolumeTable;