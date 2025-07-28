const http = require('http');

// Test the ticks API directly
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/ticks/current',
  method: 'GET',
  timeout: 5000
};

console.log('Testing API...');

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response Length:', data.length);
    if (data.length > 0) {
      try {
        const parsed = JSON.parse(data);
        console.log('✅ Parsed JSON:', JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('❌ Failed to parse JSON:', e.message);
        console.log('Raw response:', data.substring(0, 200));
      }
    } else {
      console.log('❌ Empty response');
    }
  });
});

req.on('error', (e) => {
  console.log(`❌ Request error: ${e.message}`);
});

req.on('timeout', () => {
  console.log('❌ Request timeout');
  req.destroy();
});

req.end();