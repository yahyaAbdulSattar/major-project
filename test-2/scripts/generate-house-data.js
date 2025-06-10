const fs = require('fs');
const path = require('path');

function generateHouseData(numSamples = 1000) {
  const data = [];
  
  // Features for house price prediction
  const features = [
    'bedrooms',          // Number of bedrooms
    'bathrooms',         // Number of bathrooms
    'sqft_living',      // Square footage of living space
    'sqft_lot',         // Square footage of lot
    'floors',           // Number of floors
    'waterfront',       // Waterfront property (0/1)
    'view',             // View rating (0-4)
    'condition',        // Condition rating (1-5)
    'grade',            // Grade rating (1-13)
    'sqft_above',       // Square footage above ground
    'sqft_basement',    // Square footage of basement
    'year_built',       // Year built
    'year_renovated'    // Year renovated (0 if never renovated)
  ];

  for (let i = 0; i < numSamples; i++) {
    const sample = {
      // Generate realistic-looking house features
      bedrooms: Math.floor(Math.random() * 4) + 1,              // 1-4 bedrooms
      bathrooms: Math.floor(Math.random() * 3) + 1,             // 1-3 bathrooms
      sqft_living: Math.floor(Math.random() * 2000) + 800,      // 800-2800 sqft
      sqft_lot: Math.floor(Math.random() * 5000) + 2000,        // 2000-7000 sqft
      floors: Math.floor(Math.random() * 2) + 1,                // 1-2 floors
      waterfront: Math.random() < 0.1 ? 1 : 0,                  // 10% waterfront
      view: Math.floor(Math.random() * 5),                      // 0-4 view rating
      condition: Math.floor(Math.random() * 5) + 1,             // 1-5 condition
      grade: Math.floor(Math.random() * 7) + 5,                 // 5-11 grade
      sqft_above: 0,                                            // Calculated below
      sqft_basement: 0,                                         // Calculated below
      year_built: Math.floor(Math.random() * 50) + 1970,        // 1970-2020
      year_renovated: Math.random() < 0.3 ? Math.floor(Math.random() * 20) + 2000 : 0  // 30% renovated
    };

    // Calculate above and basement square footage
    const basementProb = Math.random();
    if (basementProb < 0.4) { // 40% chance of basement
      sample.sqft_basement = Math.floor(sample.sqft_living * 0.4);
      sample.sqft_above = sample.sqft_living - sample.sqft_basement;
    } else {
      sample.sqft_above = sample.sqft_living;
      sample.sqft_basement = 0;
    }

    // Calculate price (target variable) based on features
    const price = (
      sample.sqft_living * 200 +
      sample.bedrooms * 10000 +
      sample.bathrooms * 15000 +
      (sample.waterfront ? 100000 : 0) +
      sample.view * 20000 +
      sample.condition * 15000 +
      sample.grade * 20000 +
      (2023 - sample.year_built) * -1000 +
      (sample.year_renovated ? 50000 : 0) +
      Math.random() * 50000 // Add some noise
    );

    data.push({
      features: Object.values(sample),
      price: Math.max(price, 100000) // Ensure minimum price
    });
  }

  return { data, features };
}

function saveData(data, features) {
  const datasetsDir = path.join(__dirname, '..', 'datasets');
  if (!fs.existsSync(datasetsDir)) {
    fs.mkdirSync(datasetsDir, { recursive: true });
  }

  // Create 3 partitions for federated learning
  const partitionSize = Math.floor(data.length / 3);
  
  for (let i = 0; i < 3; i++) {
    const start = i * partitionSize;
    const end = i === 2 ? data.length : (i + 1) * partitionSize;
    const partitionData = data.slice(start, end);
    
    // Save as CSV
    const csvPath = path.join(datasetsDir, `house_data-partition-${i + 1}.csv`);
    const csvContent = [
      // Header: all feature names plus price
      [...features, 'price'].join(','),
      // Data: all features plus price for each sample
      ...partitionData.map(sample => [...sample.features, sample.price].join(','))
    ].join('\n');
    
    fs.writeFileSync(csvPath, csvContent);
    console.log(`Partition ${i + 1} saved to ${csvPath} with ${partitionData.length} records`);
  }
}

// Generate and save data
const { data, features } = generateHouseData(300); // Generate 300 samples
saveData(data, features);

console.log('House price data generation complete!'); 