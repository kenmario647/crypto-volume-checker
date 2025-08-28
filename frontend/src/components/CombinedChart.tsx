import React from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ResponsiveContainer
} from 'recharts';

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

interface CombinedChartProps {
  data: ChartDataPoint[];
  CustomTooltip: React.ComponentType<any>;
}

const CombinedChart: React.FC<CombinedChartProps> = ({ data, CustomTooltip }) => {
  console.log('CombinedChart rendering with', data.length, 'data points');
  console.log('Sample data with FR:', data.slice(0, 2));

  if (data.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        width: '100%',
        color: '#666'
      }}>
        データがありません
      </div>
    );
  }

  // 乖離率と小数点調整されたFRデータを準備
  const chartData = data.map(item => ({
    ...item,
    // FR値を1000倍してチャートで見やすくする（0.00008 → 0.08）
    scaledFundingRate: item.fundingRate ? item.fundingRate * 10 : null,
    // 正負の乖離率
    positiveDeviation: item.deviation > 0 ? item.deviation : null,
    negativeDeviation: item.deviation < 0 ? item.deviation : null
  }));

  return (
    <ComposedChart
      data={chartData}
      width={800}
      height={400}
      margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
    >
      <defs>
        {/* プラス乖離のグラデーション */}
        <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00C853" stopOpacity={0.8}/>
          <stop offset="50%" stopColor="#00C853" stopOpacity={0.4}/>
          <stop offset="100%" stopColor="#00C853" stopOpacity={0.1}/>
        </linearGradient>
        
        {/* マイナス乖離のグラデーション */}
        <linearGradient id="negativeGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F44336" stopOpacity={0.1}/>
          <stop offset="50%" stopColor="#F44336" stopOpacity={0.4}/>
          <stop offset="100%" stopColor="#F44336" stopOpacity={0.8}/>
        </linearGradient>
      </defs>
      
      <CartesianGrid strokeDasharray="1 1" stroke="#2a2a2a" />
      
      <XAxis 
        dataKey="time" 
        stroke="#666" 
        fontSize={11}
        axisLine={false}
        tickLine={false}
        tick={{ fill: '#666' }}
      />
      
      {/* 左Y軸 - 乖離率 */}
      <YAxis 
        yAxisId="deviation"
        stroke="#666" 
        fontSize={11}
        axisLine={false}
        tickLine={false}
        domain={['dataMin - 0.1', 'dataMax + 0.1']}
        tickFormatter={(value) => `${value.toFixed(2)}%`}
        tick={{ fill: '#666' }}
      />
      
      {/* 右Y軸 - FR (スケール済み) */}
      <YAxis 
        yAxisId="fr"
        orientation="right"
        stroke="#ff4444" 
        fontSize={11}
        axisLine={false}
        tickLine={false}
        domain={['dataMin - 0.01', 'dataMax + 0.01']}
        tickFormatter={(value) => `${(value / 10).toFixed(4)}%`}
        tick={{ fill: '#ff4444' }}
      />
      
      <RechartsTooltip content={<CustomTooltip />} />
      
      {/* ゼロライン */}
      <ReferenceLine 
        yAxisId="deviation"
        y={0} 
        stroke="#FFF" 
        strokeWidth={2}
        strokeDasharray="none"
        label={{ value: "0%", position: "left", fill: "#FFF", fontSize: 12 }}
      />
      
      {/* プラス乖離エリア */}
      <Area 
        yAxisId="deviation"
        type="monotone" 
        dataKey="positiveDeviation" 
        stroke="#00C853"
        fill="url(#positiveGradient)"
        strokeWidth={2}
        connectNulls={false}
        baseLine={0}
      />
      
      {/* マイナス乖離エリア */}
      <Area 
        yAxisId="deviation"
        type="monotone" 
        dataKey="negativeDeviation" 
        stroke="#F44336"
        fill="url(#negativeGradient)"
        strokeWidth={2}
        connectNulls={false}
        baseLine={0}
      />
      
      {/* FR ライン */}
      <Line 
        yAxisId="fr"
        type="monotone" 
        dataKey="scaledFundingRate" 
        stroke="#ff4444" 
        strokeWidth={3}
        dot={{ r: 3, fill: '#ff4444' }}
        activeDot={{ r: 5, fill: '#ff4444' }}
        connectNulls={false}
      />
    </ComposedChart>
  );
};

export default CombinedChart;