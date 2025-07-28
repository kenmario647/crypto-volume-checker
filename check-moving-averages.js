// Extract MA data from recent logs to understand cross detection conditions
const fs = require('fs');
const path = require('path');

const logFile = '/Users/satoukengo/crypto-volume-checker/backend/logs/combined.log';

try {
  const logData = fs.readFileSync(logFile, 'utf8');
  const lines = logData.split('\n');
  
  console.log('Analyzing recent MA data from logs...\n');
  
  // Look for recent MA data samples
  let foundSamples = 0;
  for (let i = lines.length - 1; i >= 0 && foundSamples < 10; i--) {
    const line = lines[i];
    if (line.includes('MA3:') && line.includes('MA8:')) {
      const logObj = JSON.parse(line);
      const message = logObj.message;
      
      // Try to extract MA values
      const ma3Match = message.match(/MA3:\s*([0-9.]+)/);
      const ma8Match = message.match(/MA8:\s*([0-9.]+)/);
      
      if (ma3Match && ma8Match) {
        const ma3 = parseFloat(ma3Match[1]);
        const ma8 = parseFloat(ma8Match[1]);
        const symbol = message.split(':')[1]?.split(' ')?.[0] || 'unknown';
        
        console.log(`${symbol}: MA3=${ma3.toFixed(2)}, MA8=${ma8.toFixed(2)}, Diff=${(ma3-ma8).toFixed(2)}`);
        
        // Check cross conditions
        if (ma3 > ma8) {
          console.log(`  → MA3 > MA8 (Golden cross condition present)`);
        } else if (ma3 < ma8) {
          console.log(`  → MA3 < MA8 (Death cross condition present)`);
        } else {
          console.log(`  → MA3 = MA8 (At crossover point)`);
        }
        
        foundSamples++;
      }
    }
  }
  
  if (foundSamples === 0) {
    console.log('No MA data samples found in recent logs');
  }
  
} catch (error) {
  console.error('Error reading log file:', error.message);
}