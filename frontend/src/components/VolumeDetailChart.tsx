import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';

// Chart.js registration
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface VolumeDetailChartProps {
  open: boolean;
  onClose: () => void;
  symbol: string;
  exchange: string;
}

interface VolumeChartData {
  timestamp: string;
  volume: number;
  quoteVolume: number;
  high: number;
  low: number;
  open: number;
  close: number;
}

const VolumeDetailChart: React.FC<VolumeDetailChartProps> = ({
  open,
  onClose,
  symbol,
  exchange,
}) => {
  const [chartData, setChartData] = useState<VolumeChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe] = useState('5m');

  useEffect(() => {
    if (open && symbol && exchange) {
      fetchVolumeChart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, symbol, exchange, timeframe]);

  const fetchVolumeChart = async () => {
    try {
      setLoading(true);
      
      // API endpoint for volume chart data
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/volume/symbol/${exchange}/${symbol}?interval=5m&limit=36`
      );
      
      if (response.ok) {
        const result = await response.json();
        console.log('API response:', result);
        if (result.success && result.data) {
          console.log('Volume chart API response:', result.data);
          // API returns {symbol, exchange, interval, current24hVolume, data: [...]}
          if (result.data.data && Array.isArray(result.data.data)) {
            // Transform the data to match our interface
            const transformedData = result.data.data.map((item: any) => {
              console.log('Chart data item:', item);
              return {
                timestamp: new Date(item.timestamp).toISOString(),
                volume: item.volume,
                quoteVolume: item.volume, // Using volume as quoteVolume
                high: 0,
                low: 0,
                open: 0,
                close: 0,
                ma3: item.ma3,
                ma8: item.ma8,
                ma15: item.ma15,
                current24hVolume: result.data.current24hVolume
              };
            });
            console.log('Transformed chart data:', transformedData.slice(0, 3));
            setChartData(transformedData);
          } else if (Array.isArray(result.data)) {
            setChartData(result.data);
          } else {
            console.log('Invalid data format from API, using sample data');
            generateSampleData();
          }
        } else {
          console.log('Invalid data format from API, using sample data');
          generateSampleData();
        }
      } else {
        console.log('No chart data from API, using sample data');
        generateSampleData();
      }
    } catch (error) {
      console.error('Error fetching volume chart:', error);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  const generateSampleData = () => {
    // Generate sample data based on symbol's actual volume from ranking
    const sampleData: VolumeChartData[] = [];
    const now = new Date();
    
    // Get base volume from symbol (rough estimation based on ranking position)
    let baseVolume = 500000000; // Default 500M
    
    // Estimate volume based on symbol
    switch(symbol) {
      case 'ETHUSDT': case 'ETH': baseVolume = 30900000000; break; // 30.9B
      case 'BTCUSDT': case 'BTC': baseVolume = 18400000000; break; // 18.4B  
      case 'SOLUSDT': case 'SOL': baseVolume = 9900000000; break;  // 9.9B
      case 'DOGEUSDT': case 'DOGE': baseVolume = 5100000000; break; // 5.1B
      case '1000PEPEUSDT': case 'PEPE': baseVolume = 2100000000; break; // 2.1B
      case 'ADAUSDT': case 'ADA': baseVolume = 1400000000; break;   // 1.4B
      case 'XRPUSDT': case 'XRP': baseVolume = 1200000000; break;   // 1.2B
      case 'BNBUSDT': case 'BNB': baseVolume = 857000000; break;    // 857M
      default: baseVolume = 300000000; // 300M for others
    }
    
    // Generate 36 data points (3 hours of 5min intervals)
    for (let i = 35; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - (i * 5 * 60 * 1000)); // 5分間隔
      // 5分間の出来高は24時間の約1/288 (24*60/5 = 288)
      const fiveMinVolume = (baseVolume / 288) * (0.5 + Math.random()); // ±50%のランダム変動
      
      sampleData.push({
        timestamp: timestamp.toISOString(),
        volume: fiveMinVolume,
        quoteVolume: fiveMinVolume,
        high: 0,
        low: 0,
        open: 0,
        close: 0,
      });
    }
    
    setChartData(sampleData);
  };


  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatVolume = (volume: number) => {
    // 常にミリオン単位で表示
    return `$${(volume / 1e6).toFixed(1)}M`;
  };

  // Calculate volume changes for color coding and dynamic scaling
  const volumeData = Array.isArray(chartData) ? chartData.map(item => item.quoteVolume) : [];
  
  // Extract moving average data
  const ma3Data = Array.isArray(chartData) ? chartData.map((item: any) => item.ma3) : [];
  const ma8Data = Array.isArray(chartData) ? chartData.map((item: any) => item.ma8) : [];
  const ma15Data = Array.isArray(chartData) ? chartData.map((item: any) => item.ma15) : [];

  const coloredBars = volumeData.map((volume, index) => {
    if (index === 0) return 'rgba(52, 152, 219, 0.6)'; // Default blue for first bar
    
    const prevVolume = volumeData[index - 1];
    const change = volume - prevVolume;
    const changePercent = Math.abs(change) / prevVolume * 100;
    
    if (change > 0) {
      // Green for increase, intensity based on change magnitude
      const intensity = Math.min(changePercent * 10, 1); // Scale intensity
      return `rgba(46, 204, 113, ${0.4 + intensity * 0.4})`;
    } else if (change < 0) {
      // Red for decrease, intensity based on change magnitude  
      const intensity = Math.min(changePercent * 10, 1);
      return `rgba(231, 76, 60, ${0.4 + intensity * 0.4})`;
    } else {
      return 'rgba(52, 152, 219, 0.6)'; // Blue for no change
    }
  });

  // Calculate dynamic min/max including moving averages for better visualization
  const allNumericData = [
    ...volumeData.filter(v => v !== null && v !== undefined && !isNaN(v)),
    ...ma3Data.filter(v => v !== null && v !== undefined && !isNaN(v)),
    ...ma8Data.filter(v => v !== null && v !== undefined && !isNaN(v)),
    ...ma15Data.filter(v => v !== null && v !== undefined && !isNaN(v))
  ];
  const validData = allNumericData;
  const minValue = validData.length > 0 ? Math.min(...validData) : 0;
  const maxValue = validData.length > 0 ? Math.max(...validData) : 1;
  const range = maxValue - minValue;
  
  // For single data point, create a reasonable range
  let dynamicMin, dynamicMax;
  if (validData.length === 1) {
    const value = validData[0];
    dynamicMin = value * 0.95; // 5% below
    dynamicMax = value * 1.05; // 5% above
  } else if (range === 0) {
    // All values are the same
    const value = minValue;
    dynamicMin = value * 0.95;
    dynamicMax = value * 1.05;
  } else {
    dynamicMin = minValue - (range * 0.05); // Add 5% padding below
    dynamicMax = maxValue + (range * 0.05); // Add 5% padding above
  }

  const chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'end' as const,
        labels: {
          color: '#999',
          font: {
            size: 11,
          },
          boxWidth: 15,
          padding: 10,
          usePointStyle: true,
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#333',
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            const index = context.dataIndex;
            
            if (label.includes('24時間出来高推移') && index > 0) {
              const prevValue = volumeData[index - 1];
              const change = value - prevValue;
              const changePercent = (change / prevValue * 100).toFixed(2);
              const changeStr = change >= 0 ? `+${formatVolume(Math.abs(change))}` : `-${formatVolume(Math.abs(change))}`;
              const arrow = change >= 0 ? '↗' : '↘';
              
              return [
                `${label}: ${formatVolume(value)}`,
                `${arrow} ${changeStr} (${changePercent}%)`
              ];
            }
            
            return `${label}: ${formatVolume(value)}`;
          },
        },
      },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        display: true,
        ticks: {
          color: '#666',
          font: {
            size: 10,
          },
          maxTicksLimit: 8,
          autoSkip: true,
          maxRotation: 0,
          minRotation: 0,
        },
        grid: {
          display: true,
          color: 'rgba(255, 255, 255, 0.03)',
        },
      },
      y: {
        display: true,
        position: 'right' as const,
        ticks: {
          color: '#666',
          font: {
            size: 10,
          },
          callback: function(value) {
            return formatVolume(Number(value));
          },
          count: 8,
        },
        beginAtZero: false, // Don't start from zero to emphasize variations
        min: dynamicMin,
        max: dynamicMax,
        grid: {
          display: true,
          color: 'rgba(255, 255, 255, 0.1)', // More visible grid lines
        },
      },
    },
  };

  const chartDataConfig: any = {
    labels: Array.isArray(chartData) ? chartData.map(item => formatTimestamp(item.timestamp)) : [],
    datasets: [
      {
        label: '24時間出来高推移 (USD)',
        data: volumeData,
        backgroundColor: coloredBars,
        borderColor: coloredBars.map(color => color.replace('0.', '0.8').replace('0.8', '0.9')),
        borderWidth: 1,
        barPercentage: volumeData.length === 1 ? 0.3 : 0.8, // Narrower bar for single data point
        categoryPercentage: volumeData.length === 1 ? 0.5 : 0.9,
        type: 'bar',
        order: 3, // Display bars behind lines
      },
      {
        label: 'MA3',
        data: ma3Data,
        borderColor: '#e74c3c',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 1,
        pointHoverRadius: 4,
        type: 'line',
        tension: 0.4,
        order: 1,
      },
      {
        label: 'MA8',
        data: ma8Data,
        borderColor: '#f39c12',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 1,
        pointHoverRadius: 4,
        type: 'line',
        tension: 0.4,
        order: 1,
      },
      {
        label: 'MA15',
        data: ma15Data,
        borderColor: '#2ecc71',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 1,
        pointHoverRadius: 4,
        type: 'line',
        tension: 0.4,
        order: 1,
      },
    ],
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#1a1a1a',
          color: 'white',
          minHeight: '500px',
        },
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid #333' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ color: 'white' }}>
            📈 {symbol} 出来高チャート - {exchange.toUpperCase()}
          </Typography>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              5分足 × 36本 (3時間)
            </Typography>
            {chartData.length > 0 && (
              <Typography variant="caption" sx={{ color: '#4ecdc4' }}>
                24H総出来高: {formatVolume(chartData.length > 0 ? (chartData[0] as any)?.current24hVolume || 0 : 0)}
              </Typography>
            )}
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 2, height: '450px' }}>
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <CircularProgress />
            <Typography sx={{ ml: 2, color: 'text.secondary' }}>
              チャートデータを読み込み中...
            </Typography>
          </Box>
        ) : (
          <Box sx={{ 
            height: '100%', 
            backgroundColor: '#0a0a0a', 
            borderRadius: 1, 
            p: 2,
            position: 'relative'
          }}>
            <Chart type='bar' data={chartDataConfig} options={chartOptions} />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid #333', p: 2 }}>
        <Button
          onClick={onClose}
          sx={{
            color: 'white',
            borderColor: '#666',
            '&:hover': {
              borderColor: '#F3BA2F',
              backgroundColor: 'rgba(243, 186, 47, 0.1)',
            },
          }}
          variant="outlined"
        >
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VolumeDetailChart;