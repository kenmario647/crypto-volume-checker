const io = require('socket.io-client');

console.log('Testing WebSocket connection to backend...');

const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('✅ Connected to WebSocket server');
  console.log('Socket ID:', socket.id);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from WebSocket server');
});

socket.on('message', (data) => {
  console.log('📩 Received message:', data);
});

socket.on('crossAlert', (data) => {
  console.log('🚨 Received crossAlert:', data);
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error.message);
});

// Keep the script running
setTimeout(() => {
  console.log('Test completed. Disconnecting...');
  socket.disconnect();
  process.exit(0);
}, 10000);