import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
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

interface FundingRateChartProps {
  data: ChartDataPoint[];
  CustomTooltip: React.ComponentType<any>;
}

const FundingRateChart: React.FC<FundingRateChartProps> = ({ data, CustomTooltip }) => {
  console.log('FundingRateChart received data:', data.length, 'points');
  console.log('Sample data:', data.slice(0, 2));

  // FRデータのみを抽出して表示用に変換
  const frData = data
    .filter(item => {
      const hasFR = item.fundingRate !== null && item.fundingRate !== undefined;
      if (!hasFR) {
        console.log('Filtering out item without FR:', item);
      }
      return hasFR;
    })
    .map(item => ({
      ...item,
      fundingRateDisplay: item.fundingRate!,
      // FRの正負で色分け用データを作成
      positiveFR: item.fundingRate! > 0 ? item.fundingRate! : null,
      negativeFR: item.fundingRate! < 0 ? item.fundingRate! : null
    }));

  console.log('FundingRateChart rendering with', frData.length, 'FR data points');
  console.log('Filtered FR data sample:', frData.slice(0, 2));

  if (frData.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        width: '100%',
        color: '#666'
      }}>
        FRデータがありません
      </div>
    );
  }

  // テスト用: 簡単なLineチャートも用意
  const useLineChart = frData.length > 0 && Math.abs(frData[0].fundingRateDisplay!) < 0.1;

  if (useLineChart) {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={frData}
          margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="1 1" stroke="#2a2a2a" />
          
          <XAxis 
            dataKey="time" 
            stroke="#666" 
            fontSize={11}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#666' }}
          />
          
          <YAxis 
            stroke="#666" 
            fontSize={11}
            axisLine={false}
            tickLine={false}
            domain={['dataMin - 0.01', 'dataMax + 0.01']}
            tickFormatter={(value) => `${value.toFixed(3)}%`}
            tick={{ fill: '#666' }}
          />
          
          <RechartsTooltip content={<CustomTooltip />} />
          
          <ReferenceLine 
            y={0} 
            stroke="#FFF" 
            strokeWidth={2}
            strokeDasharray="none"
            label={{ value: "0%", position: "right", fill: "#FFF", fontSize: 12 }}
          />
          
          <Line 
            type="monotone" 
            dataKey="fundingRateDisplay" 
            stroke="#ff4444" 
            strokeWidth={2}
            dot={{ r: 3, fill: '#ff4444' }}
            activeDot={{ r: 5, fill: '#ff4444' }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <AreaChart
      data={frData}
      width={800}
      height={400}
      margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
    >
        <defs>
          {/* プラスFRのグラデーション（薄い赤） */}
          <linearGradient id="positiveFRGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff4444" stopOpacity={0.8}/>
            <stop offset="50%" stopColor="#ff4444" stopOpacity={0.4}/>
            <stop offset="100%" stopColor="#ff4444" stopOpacity={0.1}/>
          </linearGradient>
          
          {/* マイナスFRのグラデーション（濃い赤） */}
          <linearGradient id="negativeFRGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cc0000" stopOpacity={0.1}/>
            <stop offset="50%" stopColor="#cc0000" stopOpacity={0.4}/>
            <stop offset="100%" stopColor="#cc0000" stopOpacity={0.8}/>
          </linearGradient>
        </defs>
        
        {/* グリッド */}
        <CartesianGrid strokeDasharray="1 1" stroke="#2a2a2a" />
        
        {/* X軸 */}
        <XAxis 
          dataKey="time" 
          stroke="#666" 
          fontSize={11}
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#666' }}
        />
        
        {/* Y軸 */}
        <YAxis 
          stroke="#666" 
          fontSize={11}
          axisLine={false}
          tickLine={false}
          domain={['dataMin - 0.01', 'dataMax + 0.01']}
          tickFormatter={(value) => `${value.toFixed(3)}%`}
          tick={{ fill: '#666' }}
        />
        
        {/* ツールチップ */}
        <RechartsTooltip content={<CustomTooltip />} />
        
        {/* ゼロライン */}
        <ReferenceLine 
          y={0} 
          stroke="#FFF" 
          strokeWidth={2}
          strokeDasharray="none"
          label={{ value: "0%", position: "right", fill: "#FFF", fontSize: 12 }}
        />
        
        {/* プラスFRエリア */}
        <Area 
          type="monotone" 
          dataKey="positiveFR" 
          stroke="#ff4444"
          fill="url(#positiveFRGradient)"
          strokeWidth={2}
          connectNulls={false}
          baseLine={0}
        />
        
        {/* マイナスFRエリア */}
        <Area 
          type="monotone" 
          dataKey="negativeFR" 
          stroke="#cc0000"
          fill="url(#negativeFRGradient)"
          strokeWidth={2}
          connectNulls={false}
          baseLine={0}
        />
      </AreaChart>
  );
};

export default FundingRateChart;