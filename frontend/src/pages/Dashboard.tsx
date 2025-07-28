import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Tabs,
  Tab,
} from '@mui/material';
import ExchangeVolumeTable from '../components/ExchangeVolumeTable';
import NotificationTab from '../components/NotificationTab';

const Dashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ color: 'white', mb: 4 }}>
        Volume ChinChin Pro - 暗号資産リアルタイム監視
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          sx={{
            '& .MuiTab-root': { color: 'white' },
            '& .Mui-selected': { color: '#F3BA2F !important' },
          }}
        >
          <Tab label="🟡 Binance" />
          <Tab label="🔵 Upbit" />
          <Tab label="📱 通知" />
        </Tabs>
      </Box>

      <Box>
        {tabValue === 0 && (
          <Box>
            <ExchangeVolumeTable exchange="binance" />
          </Box>
        )}
        {tabValue === 1 && (
          <Box>
            <ExchangeVolumeTable exchange="upbit" />
          </Box>
        )}
        {tabValue === 2 && (
          <Box>
            <NotificationTab />
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default Dashboard;