const fs = require('fs');
const path = require('path');

function generateDummyStockData(days = 100) {
  const data = [];
  let currentPrice = 100; // Starting price
  const startDate = new Date('2023-01-01');

  for (let i = 0; i < days; i++) {
    // Simplified price movement (-1% to +1%)
    const dailyChange = (Math.random() * 2 - 1) / 100;
    
    // Calculate OHLC prices
    const open = currentPrice;
    const close = currentPrice * (1 + dailyChange);
    const high = Math.max(open, close) * 1.005; // 0.5% higher
    const low = Math.min(open, close) * 0.995;  // 0.5% lower
    
    // Simplified volume
    const volume = Math.floor(Math.random() * 1000 + 100);
    
    // Calculate date
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    
    data.push({
      date: currentDate.toISOString().split('T')[0],
      open: open.toFixed(2),
      high: high.toFixed(2),
      low: low.toFixed(2),
      close: close.toFixed(2),
      volume: volume
    });
    
    currentPrice = close;
  }
  
  return data;
}

function saveData(data) {
  // Ensure datasets directory exists
  const datasetsDir = path.join(__dirname, '..', 'datasets');
  if (!fs.existsSync(datasetsDir)) {
    fs.mkdirSync(datasetsDir, { recursive: true });
  }
  
  // Create smaller partitions for faster testing
  const partitionSize = Math.floor(data.length / 3);
  for (let i = 0; i < 3; i++) {
    const start = i * partitionSize;
    const end = i === 2 ? data.length : (i + 1) * partitionSize;
    const partitionData = data.slice(start, end);
    
    const partitionCsvPath = path.join(datasetsDir, `time_series-partition-${i + 1}.csv`);
    const partitionCsvContent = [
      'date,open,high,low,close,volume',
      ...partitionData.map(row => 
        `${row.date},${row.open},${row.high},${row.low},${row.close},${row.volume}`
      )
    ].join('\n');
    
    fs.writeFileSync(partitionCsvPath, partitionCsvContent);
    console.log(`Partition ${i + 1} saved to ${partitionCsvPath} with ${partitionData.length} records`);
  }
}

// Generate and save smaller dummy data
const dummyData = generateDummyStockData(100); // Only 100 days of data
saveData(dummyData);

console.log('Dummy data generation complete!'); 