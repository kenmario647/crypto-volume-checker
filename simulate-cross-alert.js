const io = require('socket.io-client');

console.log('Simulating crossAlert event...');

// Connect to the backend WebSocket server
const backendSocket = io('http://localhost:5000');

backendSocket.on('connect', () => {
  console.log('✅ Connected to backend WebSocket server');
  
  // Simulate a manual cross alert emission
  setTimeout(() => {
    console.log('📡 Manually emitting crossAlert for testing...');
    
    // Create a test cross alert
    const testCrossAlert = {
      id: `test-BTC-${Date.now()}`,
      type: 'golden_cross',
      symbol: 'BTC',
      exchange: 'binance',
      timestamp: Date.now(),
      ma3Value: 50000,
      ma8Value: 49500,
      previousMa3: 49800,
      previousMa8: 50200,
      message: 'BTC (BINANCE) Test Golden Cross'
    };
    
    // This won't work as client can't emit server events, but let's test receiving
    console.log('Test alert created:', testCrossAlert);
    
    // Instead, let's just listen for any crossAlert events
    console.log('👂 Listening for crossAlert events...');
    
  }, 1000);
});

backendSocket.on('crossAlert', (data) => {
  console.log('🚨 Received crossAlert:', JSON.stringify(data, null, 2));
});

backendSocket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error.message);
});

// Keep the script running for 30 seconds to listen for any cross alerts
setTimeout(() => {
  console.log('Test completed. Disconnecting...');
  backendSocket.disconnect();
  process.exit(0);
}, 30000);