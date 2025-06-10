const jsonData = require('./time_series-partition-1.json'); // or paste JSON if using in browser

const features = jsonData.features;

// Generate header
const headers = features[0].map((_, i) => `feature_${i}`).join(',');

// Generate rows
const rows = features.map(row => row.join(',')).join('\n');

// Combine header and rows
const csv = `${headers}\n${rows}`;

// Save or print CSV
require('fs').writeFileSync('time_series-partition-1.csv', csv);
console.log('CSV file written to output.csv');
