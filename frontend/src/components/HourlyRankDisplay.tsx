import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Card,
  CardContent,
  Divider,
  LinearProgress,
  Tooltip,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  AccessTime,
  ExpandMore,
  ExpandLess,
  RestartAlt,
} from '@mui/icons-material';

interface HourlyChange {
  time: string;
  rank: number;
  change: number;
  direction: string;
}

interface HourlyRankData {
  symbol: string;
  startRank: number;
  currentRank: number;
  changes: HourlyChange[];
}

interface HourlyRankDisplayProps {
  exchange: string;
  data: any[];
}

const HourlyRankDisplay: React.FC<HourlyRankDisplayProps> = ({ exchange, data }) => {
  const [expanded, setExpanded] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [nextResetTime, setNextResetTime] = useState<Date | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Calculate next 9 AM JST reset time
    const calculateNextReset = () => {
      const now = new Date();
      const jstOffset = 9 * 60; // JST is UTC+9
      const localOffset = now.getTimezoneOffset();
      const jstTime = new Date(now.getTime() + (jstOffset + localOffset) * 60 * 1000);
      
      const nextReset = new Date(jstTime);
      nextReset.setHours(9, 0, 0, 0);
      
      if (jstTime.getHours() >= 9) {
        nextReset.setDate(nextReset.getDate() + 1);
      }
      
      // Convert back to local time
      const localReset = new Date(nextReset.getTime() - (jstOffset + localOffset) * 60 * 1000);
      setNextResetTime(localReset);
    };

    calculateNextReset();
  }, []);

  const getTimeUntilReset = () => {
    if (!nextResetTime) return '';
    
    const diff = nextResetTime.getTime() - currentTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours}時間 ${minutes}分 ${seconds}秒`;
  };

  const getTimeUntilNextHour = () => {
    const now = currentTime;
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    
    const diff = nextHour.getTime() - now.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${minutes}分 ${seconds}秒`;
  };

  const getRankChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp sx={{ fontSize: 16, color: '#4caf50' }} />;
    if (change < 0) return <TrendingDown sx={{ fontSize: 16, color: '#f44336' }} />;
    return <TrendingFlat sx={{ fontSize: 16, color: '#757575' }} />;
  };

  const getRankChangeColor = (change: number) => {
    if (change > 0) return '#4caf50';
    if (change < 0) return '#f44336';
    return '#757575';
  };

  // Get top 5 symbols with hourly data
  const topSymbolsWithHourlyData = data
    .filter(item => item.hourlyChanges && item.hourlyChanges.length > 0)
    .slice(0, 5);

  const hasHourlyData = topSymbolsWithHourlyData.length > 0;

  return (
    <Paper sx={{ p: 2, mb: 2, backgroundColor: '#1a1a1a' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessTime sx={{ color: '#2196f3' }} />
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
            時間別順位トラッカー
          </Typography>
          <Chip
            size="small"
            label={`次回記録: ${getTimeUntilNextHour()}`}
            sx={{ backgroundColor: '#2196f3', color: 'white' }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={<RestartAlt sx={{ fontSize: 16 }} />}
            label={`9時リセットまで: ${getTimeUntilReset()}`}
            sx={{ backgroundColor: '#ff9800', color: 'white' }}
          />
          <IconButton onClick={() => setExpanded(!expanded)} sx={{ color: 'white' }}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={expanded}>
        {!hasHourlyData ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" sx={{ color: '#666', mb: 2 }}>
              時間別順位データを収集中です...
            </Typography>
            <Typography variant="caption" sx={{ color: '#555' }}>
              毎時00分にスナップショットが記録されます
            </Typography>
            <LinearProgress sx={{ mt: 2 }} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {topSymbolsWithHourlyData.map((item) => (
              <Box key={item.symbol}>
                <Card sx={{ backgroundColor: '#2a2a2a' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                          {item.symbol}
                        </Typography>
                        <Chip
                          size="small"
                          label={`現在: ${item.rank}位`}
                          sx={{ 
                            backgroundColor: '#2196f3', 
                            color: 'white',
                            fontWeight: 'bold'
                          }}
                        />
                        {item.initialRank && (
                          <Chip
                            size="small"
                            label={`開始: ${item.initialRank}位`}
                            sx={{ 
                              backgroundColor: '#757575', 
                              color: 'white'
                            }}
                          />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {getRankChangeIcon(item.initialRank - item.rank)}
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: getRankChangeColor(item.initialRank - item.rank),
                            fontWeight: 'bold'
                          }}
                        >
                          {item.initialRank - item.rank > 0 ? '+' : ''}{item.initialRank - item.rank}
                        </Typography>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 1, borderColor: '#444' }} />

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {item.hourlyChanges.map((change: HourlyChange, idx: number) => (
                        <Tooltip 
                          key={idx}
                          title={`${change.time} - 順位: ${change.rank} (${change.change > 0 ? '+' : ''}${change.change})`}
                        >
                          <Card 
                            sx={{ 
                              minWidth: 80,
                              backgroundColor: getRankChangeColor(change.change) + '20',
                              border: `1px solid ${getRankChangeColor(change.change)}`,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              '&:hover': {
                                transform: 'scale(1.05)',
                                backgroundColor: getRankChangeColor(change.change) + '40',
                              }
                            }}
                          >
                            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: '#aaa',
                                  display: 'block',
                                  textAlign: 'center'
                                }}
                              >
                                {change.time}
                              </Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    color: 'white',
                                    fontWeight: 'bold',
                                    fontSize: '16px'
                                  }}
                                >
                                  {change.rank}位
                                </Typography>
                                {getRankChangeIcon(change.change)}
                              </Box>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: getRankChangeColor(change.change),
                                  display: 'block',
                                  textAlign: 'center',
                                  fontWeight: 'bold'
                                }}
                              >
                                {change.change > 0 ? '+' : ''}{change.change}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Tooltip>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
        )}
      </Collapse>
    </Paper>
  );
};

export default HourlyRankDisplay;