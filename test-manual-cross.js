// Manually test the cross detection system by creating a mock cross event
const io = require('socket.io-client');

console.log('Testing manual cross detection...');

// Create a simulated volume service with cross detection
class MockCrossDetectionService {
  constructor() {
    this.listeners = {};
  }
  
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }
  
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }
  
  // Simulate a golden cross detection
  simulateGoldenCross() {
    const crossEvent = {
      symbol: 'TEST',
      exchange: 'binance',
      type: 'golden_cross',
      timestamp: Date.now(),
      ma3Value: 50000,
      ma8Value: 49500,
      previousMa3: 49800,
      previousMa8: 50200
    };
    
    console.log('Simulating golden cross:', crossEvent);
    this.emit('goldenCross', crossEvent);
  }
}

// Connect to WebSocket to listen for crossAlert events
const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('✅ Connected to WebSocket server');
  
  // Listen for crossAlert events
  socket.on('crossAlert', (data) => {
    console.log('🚨 Received crossAlert via WebSocket:', JSON.stringify(data, null, 2));
  });
  
  // Create mock system and simulate
  const mockCrossDetection = new MockCrossDetectionService();
  
  // Set up the same listener logic as VolumeService
  mockCrossDetection.on('goldenCross', (crossEvent) => {
    console.log(`🚀 Mock Golden Cross Alert: ${crossEvent.symbol} (${crossEvent.exchange})`);
    
    // This is what the VolumeService does - but we can't emit to the real server
    // We're just testing the client side reception
    console.log('Would emit crossAlert to WebSocket...');
  });
  
  // Simulate the cross event
  setTimeout(() => {
    mockCrossDetection.simulateGoldenCross();
  }, 1000);
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error.message);
});

// Keep running for 10 seconds
setTimeout(() => {
  console.log('Test completed. Disconnecting...');
  socket.disconnect();
  process.exit(0);
}, 10000);