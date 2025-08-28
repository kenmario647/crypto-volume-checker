import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Tabs,
  Tab,
} from '@mui/material';
import ExchangeVolumeTableDual from '../components/ExchangeVolumeTableDual';
import NotificationTab from '../components/NotificationTab';
import PriceDeviationTable from '../components/PriceDeviationTable';
import FrOiTab from '../components/FrOiTab';

const Dashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 1 }}>
      <Typography variant="body1" sx={{ color: 'white', mb: 0.5, fontSize: '1rem', fontWeight: 'bold' }}>
        Volume ChinChin Pro - 暗号資産リアルタイム監視
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 0.5 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          sx={{
            '& .MuiTab-root': { color: 'white', minHeight: 36, py: 0.5 },
            '& .Mui-selected': { color: '#F3BA2F !important' },
          }}
        >
          <Tab label="🟡 Binance" />
          <Tab label="🔵 Upbit" />
          <Tab label="🟠 Bybit" />
          <Tab label="⚪ OKX" />
          <Tab label="🔴 Gate.io" />
          <Tab label="🟦 Bitget" />
          <Tab label="🟢 MEXC" />
          <Tab label="🟣 Bithumb" />
          <Tab label="🔷 Coinbase" />
          <Tab label="📊 乖離率・チャート" />
          <Tab label="📈 FRとOI" />
          <Tab label="📱 通知" />
        </Tabs>
      </Box>

      <Box>
        {tabValue === 0 && (
          <Box>
            <ExchangeVolumeTableDual exchange="binance" />
          </Box>
        )}
        {tabValue === 1 && (
          <Box>
            <ExchangeVolumeTableDual exchange="upbit" />
          </Box>
        )}
        {tabValue === 2 && (
          <Box>
            <ExchangeVolumeTableDual exchange="bybit" />
          </Box>
        )}
        {tabValue === 3 && (
          <Box>
            <ExchangeVolumeTableDual exchange="okx" />
          </Box>
        )}
        {tabValue === 4 && (
          <Box>
            <ExchangeVolumeTableDual exchange="gateio" />
          </Box>
        )}
        {tabValue === 5 && (
          <Box>
            <ExchangeVolumeTableDual exchange="bitget" />
          </Box>
        )}
        {tabValue === 6 && (
          <Box>
            <ExchangeVolumeTableDual exchange="mexc" />
          </Box>
        )}
        {tabValue === 7 && (
          <Box>
            <ExchangeVolumeTableDual exchange="bithumb" />
          </Box>
        )}
        {tabValue === 8 && (
          <Box>
            <ExchangeVolumeTableDual exchange="coinbase" />
          </Box>
        )}
        {tabValue === 9 && (
          <Box>
            <PriceDeviationTable />
          </Box>
        )}
        {tabValue === 10 && (
          <Box>
            <FrOiTab />
          </Box>
        )}
        {tabValue === 11 && (
          <Box>
            <NotificationTab />
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default Dashboard;