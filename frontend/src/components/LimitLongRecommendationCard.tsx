import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Button,
  Box,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  InputAdornment,
  CircularProgress,
  Chip,
  Divider
} from '@mui/material';
// Grid2を使用せず、Boxで代替
import {
  TrendingUp,
  CheckCircle,
  Cancel,
  Edit,
  Schedule,
  AttachMoney
} from '@mui/icons-material';

interface PriceOption {
  price: number;
  probability: number;
  description: string;
}

interface LimitTradeRecommendation {
  id: string;
  symbol: string;
  side: 'LONG';
  orderType: 'LIMIT';
  triggerEvent: any;
  limitPriceData: any;
  recommendation: {
    quantity: number;
    estimatedCost: number;
    priceOptions: {
      conservative: PriceOption;
      moderate: PriceOption;
      aggressive: PriceOption;
    };
    defaultPrice: number;
    stopLoss: number;
    takeProfit: number;
    confidence: number;
  };
  createdAt: number;
  expiresAt: number;
  status: string;
}

interface LimitLongRecommendationCardProps {
  recommendation: LimitTradeRecommendation;
  onExecute?: (recommendationId: string, price: number) => void;
  onReject?: (recommendationId: string) => void;
}

const LimitLongRecommendationCard: React.FC<LimitLongRecommendationCardProps> = ({ 
  recommendation, 
  onExecute,
  onReject 
}) => {
  const [selectedPriceType, setSelectedPriceType] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  const [customPrice, setCustomPrice] = useState<number>(recommendation.recommendation.defaultPrice);
  const [executing, setExecuting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // カウントダウンタイマー
  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = recommendation.expiresAt - Date.now();
      setTimeLeft(Math.max(0, remaining));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [recommendation.expiresAt]);

  const handleExecuteLimitLong = async () => {
    setExecuting(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/trade/execute-limit-long`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          recommendationId: recommendation.id,
          limitPrice: customPrice
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`✅ 指値注文発注完了\n注文ID: ${result.data.orderId}\n指値価格: $${result.data.limitPrice}`);
        if (onExecute) {
          onExecute(recommendation.id, customPrice);
        }
      } else {
        alert(`❌ 発注失敗: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExecuting(false);
    }
  };

  const handleReject = () => {
    if (onReject) {
      onReject(recommendation.id);
    }
  };

  const handlePriceTypeChange = (type: 'conservative' | 'moderate' | 'aggressive') => {
    setSelectedPriceType(type);
    setCustomPrice(recommendation.recommendation.priceOptions[type].price);
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getPriceChangeColor = (price: number, currentPrice: number) => {
    if (price > currentPrice) return '#f44336'; // 赤（高い）
    if (price < currentPrice) return '#4caf50'; // 緑（安い）
    return '#2196f3'; // 青（同じ）
  };

  const isExpired = timeLeft === 0;
  const currentPrice = recommendation.limitPriceData.currentPrice;
  const priceChange = ((customPrice - currentPrice) / currentPrice * 100);

  return (
    <Card sx={{ 
      border: isExpired ? '2px solid #f44336' : '2px solid #4caf50',
      mb: 2,
      opacity: isExpired ? 0.6 : 1,
      animation: timeLeft < 30000 && !isExpired ? 'pulse 1s infinite' : 'none'
    }}>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp sx={{ color: '#4caf50' }} />
            <Typography variant="h6">{recommendation.symbol} 指値ロング推奨</Typography>
            <Chip 
              label={`${recommendation.recommendation.confidence}%`} 
              color="success" 
              size="small" 
            />
          </Box>
        }
        subheader={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <Schedule sx={{ fontSize: 16, color: timeLeft < 60000 ? '#f44336' : '#666' }} />
            <Typography 
              variant="body2" 
              color={timeLeft < 60000 ? 'error' : 'textSecondary'}
              sx={{ fontWeight: timeLeft < 60000 ? 'bold' : 'normal' }}
            >
              残り時間: {formatTime(timeLeft)}
            </Typography>
          </Box>
        }
      />
      
      <CardContent>
        {/* 基本情報 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
          <Box>
            <Typography variant="body2" color="textSecondary">投資額</Typography>
            <Typography variant="h6">${recommendation.recommendation.estimatedCost.toFixed(2)}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="textSecondary">数量</Typography>
            <Typography variant="h6">{recommendation.recommendation.quantity}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="textSecondary">現在価格</Typography>
            <Typography variant="h6">${currentPrice.toFixed(2)}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="textSecondary">MA8価格</Typography>
            <Typography variant="h6">${recommendation.limitPriceData.ma8Price.toFixed(2)}</Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* 指値価格選択 */}
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
          指値価格選択
        </Typography>
        <RadioGroup
          value={selectedPriceType}
          onChange={(e) => handlePriceTypeChange(e.target.value as any)}
        >
          {Object.entries(recommendation.recommendation.priceOptions).map(([type, option]) => (
            <FormControlLabel
              key={type}
              value={type}
              control={<Radio />}
              disabled={isExpired}
              label={
                <Box sx={{ ml: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                      ${option.price.toFixed(2)}
                    </Typography>
                    <Chip 
                      label={type === 'conservative' ? '保守的' : type === 'moderate' ? '中庸' : '積極的'}
                      size="small"
                      color={type === 'conservative' ? 'warning' : type === 'moderate' ? 'primary' : 'secondary'}
                    />
                    <Typography variant="caption" color="textSecondary">
                      約定確率: {(option.probability * 100).toFixed(0)}%
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="textSecondary" display="block">
                    {option.description}
                  </Typography>
                </Box>
              }
            />
          ))}
        </RadioGroup>

        {/* カスタム価格入力 */}
        <Box sx={{ mt: 2 }}>
          <TextField
            label="指値価格（カスタム）"
            type="number"
            value={customPrice}
            onChange={(e) => setCustomPrice(parseFloat(e.target.value) || 0)}
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
            fullWidth
            size="small"
            disabled={isExpired}
            inputProps={{
              step: 0.01,
              min: 0
            }}
          />
        </Box>

        {/* 価格差表示 */}
        <Box sx={{ mt: 1, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
          <Typography 
            variant="caption" 
            sx={{ 
              color: getPriceChangeColor(customPrice, currentPrice),
              fontWeight: 'bold'
            }}
          >
            現在価格との差: {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}% 
            ({customPrice > currentPrice ? '割高' : customPrice < currentPrice ? '割安' : '同価格'})
          </Typography>
          <Typography variant="caption" display="block" color="textSecondary">
            ストップロス: ${recommendation.recommendation.stopLoss.toFixed(2)} (-2%)
          </Typography>
          <Typography variant="caption" display="block" color="textSecondary">
            テイクプロフィット: ${recommendation.recommendation.takeProfit.toFixed(2)} (+4%)
          </Typography>
        </Box>
      </CardContent>
      
      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        <Button 
          variant="contained" 
          color="success" 
          onClick={handleExecuteLimitLong}
          disabled={executing || isExpired || customPrice <= 0}
          startIcon={executing ? <CircularProgress size={20} /> : <CheckCircle />}
          sx={{ minWidth: 200 }}
        >
          {executing ? '発注中...' : `指値 $${customPrice.toFixed(2)} で発注`}
        </Button>
        
        <Button 
          variant="outlined" 
          color="error"
          onClick={handleReject}
          disabled={executing || isExpired}
          startIcon={<Cancel />}
        >
          却下
        </Button>
      </CardActions>
    </Card>
  );
};

export default LimitLongRecommendationCard;