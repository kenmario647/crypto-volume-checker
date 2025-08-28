import React from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend
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
  ma15?: number | null;
}

interface DeviationAreaChartProps {
  data: ChartDataPoint[];
  CustomTooltip: React.ComponentType<any>;
}

const DeviationAreaChart: React.FC<DeviationAreaChartProps> = ({ data, CustomTooltip }) => {
  // データを正負で分離
  const processedData = data.map((item, index) => {
    // 5分間隔でFRデータポイントを表示（インデックスが5の倍数の時）
    const showFRPoint = index % 5 === 0;
    
    return {
      ...item,
      positiveDeviation: item.deviation > 0 ? item.deviation : null,
      negativeDeviation: item.deviation < 0 ? item.deviation : null,
      // FR値はバックエンドで100倍済みなのでそのまま使用
      scaledFundingRate: item.fundingRate !== null && item.fundingRate !== undefined ? item.fundingRate : null,
      // 5分間隔のFRデータポイント（マーカー表示用）
      frDataPoint: showFRPoint && item.fundingRate !== null && item.fundingRate !== undefined ? item.fundingRate : null,
      // FRと0の間を塗りつぶすためのデータ
      positiveFR: item.fundingRate !== null && item.fundingRate !== undefined && item.fundingRate > 0 ? item.fundingRate : null,
      negativeFR: item.fundingRate !== null && item.fundingRate !== undefined && item.fundingRate < 0 ? item.fundingRate : null,
      zeroLine: 0
    };
  });

  console.log('DeviationAreaChart rendering with', data.length, 'data points');
  console.log('Sample FR data:', data.slice(0, 5).map(d => ({ 
    time: d.time, 
    fundingRate: d.fundingRate,
    hasValue: d.fundingRate !== null && d.fundingRate !== undefined
  })));
  console.log('Processed FR data:', processedData.slice(0, 5).map(d => ({ 
    scaledFundingRate: d.scaledFundingRate,
    positiveFR: d.positiveFR,
    negativeFR: d.negativeFR
  })));

  return (
    <ResponsiveContainer width="100%" height={600}>
      <ComposedChart
        data={processedData}
        margin={{ top: 20, right: 80, left: 20, bottom: 60 }}
      >
      <defs>
        {/* プラスFRのグラデーション（薄い赤系） */}
        <linearGradient id="positiveFRGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF0000" stopOpacity={0.3}/>
          <stop offset="50%" stopColor="#FF0000" stopOpacity={0.2}/>
          <stop offset="100%" stopColor="#FF0000" stopOpacity={0.1}/>
        </linearGradient>
        
        {/* マイナスFRのグラデーション（薄い赤系） */}
        <linearGradient id="negativeFRGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF0000" stopOpacity={0.1}/>
          <stop offset="50%" stopColor="#FF0000" stopOpacity={0.2}/>
          <stop offset="100%" stopColor="#FF0000" stopOpacity={0.3}/>
        </linearGradient>
      </defs>
      
      {/* グリッド */}
      <CartesianGrid strokeDasharray="1 1" stroke="#2a2a2a" />
      
      {/* X軸 */}
      <XAxis 
        dataKey="time" 
        stroke="#AAA" 
        fontSize={10}
        axisLine={false}
        tickLine={false}
        tick={{ fill: '#AAA', fontSize: 10 }}
        interval={4}
        height={25}
      />
      
      {/* 右Y軸 - 乖離率とFR共通 */}
      <YAxis 
        yAxisId="deviation"
        orientation="right"
        stroke="#00D4AA" 
        fontSize={11}
        axisLine={false}
        tickLine={false}
        domain={['dataMin - 0.1', 'dataMax + 0.1']}
        tickFormatter={(value) => `${value.toFixed(2)}%`}
        tick={{ fill: '#00D4AA' }}
      />
      
      
      {/* ツールチップ */}
      <RechartsTooltip content={<CustomTooltip />} />
      
      {/* ゼロライン */}
      <ReferenceLine 
        yAxisId="deviation"
        y={0} 
        stroke="#FFF" 
        strokeWidth={3}
        strokeDasharray="none"
        label={{ value: "0%", position: "right", fill: "#FFF", fontSize: 12 }}
      />
      
      {/* プラスFRエリア（FRと0の間を塗りつぶし） */}
      <Area 
        yAxisId="deviation"
        type="monotone" 
        dataKey="positiveFR" 
        stroke="none"
        fill="url(#positiveFRGradient)"
        strokeWidth={0}
        connectNulls={false}
        baseLine={0}
      />
      
      {/* マイナスFRエリア（FRと0の間を塗りつぶし） */}
      <Area 
        yAxisId="deviation"
        type="monotone" 
        dataKey="negativeFR" 
        stroke="none"
        fill="url(#negativeFRGradient)"
        strokeWidth={0}
        connectNulls={false}
        baseLine={0}
      />
      
      {/* 乖離率の連続ライン（全体を表示） */}
      <Line 
        yAxisId="deviation"
        type="monotone" 
        dataKey="deviation" 
        stroke="#00D4AA"
        strokeWidth={2}
        dot={false}
        connectNulls={true}
        name="乖離率"
      />
      
      {/* FR ライン（赤線で繋ぐ） */}
      <Line 
        yAxisId="deviation"
        type="monotone" 
        dataKey="scaledFundingRate" 
        stroke="#FF0000" 
        strokeWidth={2}
        dot={false}
        connectNulls={true}
        name="FR"
      />
      
      {/* FR データポイント（5分間隔で🔴マーカー） */}
      <Line 
        yAxisId="deviation"
        type="monotone" 
        dataKey="frDataPoint" 
        stroke="none"
        strokeWidth={0}
        dot={{ r: 6, fill: '#FF0000' }}
        connectNulls={false}
      />
      
      {/* MA15ライン（乖離率の移動平均） */}
      <Line 
        yAxisId="deviation"
        type="monotone" 
        dataKey="ma15" 
        stroke="#FF69B4" 
        strokeWidth={2}
        strokeDasharray="4 4"
        dot={false}
        activeDot={{ r: 4, fill: '#FF69B4' }}
        connectNulls={true}
        name="MA15"
      />
      
      {/* Legend */}
      <Legend 
        verticalAlign="top" 
        height={36}
        iconType="line"
        wrapperStyle={{
          paddingTop: '10px',
          fontSize: '12px'
        }}
      />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default DeviationAreaChart;