#!/usr/bin/env node

/**
 * Dataset Preparation Script for P2P Federated Learning
 * 
 * This script helps prepare various datasets for testing the federated learning system.
 * Run with: node scripts/prepare-datasets.js [dataset-name]
 */

const fs = require('fs');
const path = require('path');

// Create datasets directory
const datasetsDir = path.join(__dirname, '..', 'datasets');
if (!fs.existsSync(datasetsDir)) {
  fs.mkdirSync(datasetsDir, { recursive: true });
}

/**
 * Generate MNIST-like dataset
 */
function generateMNISTLikeData(samples = 1000) {
  console.log(`Generating MNIST-like dataset with ${samples} samples...`);
  
  const features = [];
  const labels = [];
  
  for (let i = 0; i < samples; i++) {
    // Generate 28x28 = 784 pixel values (0-1)
    const feature = Array(784).fill(0).map(() => Math.random());
    features.push(feature);
    
    // Generate random digit label (0-9)
    labels.push(Math.floor(Math.random() * 10));
  }
  
  const dataset = {
    type: 'image_classification',
    name: 'MNIST-like',
    description: 'Simulated MNIST dataset for digit classification',
    features,
    labels,
    config: {
      inputShape: [784],
      numClasses: 10,
      learningRate: 0.001,
      batchSize: 32,
      epochs: 5
    }
  };
  
  const filepath = path.join(datasetsDir, 'mnist-like.json');
  fs.writeFileSync(filepath, JSON.stringify(dataset, null, 2));
  console.log(`✅ MNIST-like dataset saved to ${filepath}`);
  
  return dataset;
}

/**
 * Generate Iris dataset
 */
function generateIrisData() {
  console.log('Generating Iris dataset...');
  
  // Simplified iris-like data
  const features = [
    // Setosa-like samples
    [5.1, 3.5, 1.4, 0.2], [4.9, 3.0, 1.4, 0.2], [4.7, 3.2, 1.3, 0.2],
    [4.6, 3.1, 1.5, 0.2], [5.0, 3.6, 1.4, 0.2], [5.4, 3.9, 1.7, 0.4],
    
    // Versicolor-like samples  
    [7.0, 3.2, 4.7, 1.4], [6.4, 3.2, 4.5, 1.5], [6.9, 3.1, 4.9, 1.5],
    [5.5, 2.3, 4.0, 1.3], [6.5, 2.8, 4.6, 1.5], [5.7, 2.8, 4.5, 1.3],
    
    // Virginica-like samples
    [6.3, 3.3, 6.0, 2.5], [5.8, 2.7, 5.1, 1.9], [7.1, 3.0, 5.9, 2.1],
    [6.3, 2.9, 5.6, 1.8], [6.5, 3.0, 5.8, 2.2], [7.6, 3.0, 6.6, 2.1]
  ];
  
  const labels = [
    0, 0, 0, 0, 0, 0,  // Setosa
    1, 1, 1, 1, 1, 1,  // Versicolor  
    2, 2, 2, 2, 2, 2   // Virginica
  ];
  
  // Add more samples with variation
  for (let i = 0; i < 100; i++) {
    const classId = i % 3;
    const baseFeature = features[classId * 6 + (i % 6)];
    const noisyFeature = baseFeature.map(f => f + (Math.random() - 0.5) * 0.5);
    features.push(noisyFeature);
    labels.push(classId);
  }
  
  const dataset = {
    type: 'classification',
    name: 'Iris',
    description: 'Iris flower classification dataset',
    features,
    labels,
    config: {
      inputShape: [4],
      numClasses: 3,
      learningRate: 0.01,
      batchSize: 16,
      epochs: 10
    }
  };
  
  const filepath = path.join(datasetsDir, 'iris.json');
  fs.writeFileSync(filepath, JSON.stringify(dataset, null, 2));
  console.log(`✅ Iris dataset saved to ${filepath}`);
  
  return dataset;
}

/**
 * Generate regression dataset (Boston Housing-like)
 */
function generateRegressionData(samples = 500) {
  console.log(`Generating regression dataset with ${samples} samples...`);
  
  const features = [];
  const labels = [];
  
  for (let i = 0; i < samples; i++) {
    // Generate 13 features similar to Boston Housing
    const feature = [
      Math.random() * 100,        // crime rate
      Math.random() * 25,         // residential land
      Math.random() * 20,         // industrial area
      Math.random(),              // charles river
      Math.random() * 0.8 + 0.4,  // nitric oxide
      Math.random() * 3 + 4,      // rooms per dwelling
      Math.random() * 100,        // age of dwelling
      Math.random() * 10,         // distance to employment
      Math.random() * 25,         // highway accessibility
      Math.random() * 700 + 200,  // tax rate
      Math.random() * 10 + 12,    // pupil-teacher ratio
      Math.random() * 400 + 200,  // black population
      Math.random() * 40          // lower status
    ];
    
    // Generate price based on features (simplified relationship)
    const price = 20 + 
      feature[4] * 10 +          // rooms influence
      (100 - feature[5]) * 0.1 + // age influence (negative)
      Math.random() * 10;        // noise
    
    features.push(feature);
    labels.push(price);
  }
  
  const dataset = {
    type: 'regression',
    name: 'Housing',
    description: 'Housing price prediction dataset',
    features,
    labels,
    config: {
      inputShape: [13],
      outputShape: [1],
      numClasses: 1,
      learningRate: 0.001,
      batchSize: 32,
      epochs: 20
    }
  };
  
  const filepath = path.join(datasetsDir, 'housing.json');
  fs.writeFileSync(filepath, JSON.stringify(dataset, null, 2));
  console.log(`✅ Housing dataset saved to ${filepath}`);
  
  return dataset;
}

/**
 * Generate time series dataset
 */
function generateTimeSeriesData(samples = 200, sequenceLength = 60) {
  console.log(`Generating time series dataset with ${samples} samples...`);
  
  const features = [];
  const labels = [];
  
  // Generate synthetic stock-like time series
  let price = 100;
  const fullTimeSeries = [price];
  
  // Generate a longer time series
  for (let i = 0; i < samples + sequenceLength; i++) {
    const change = (Math.random() - 0.5) * 4; // Random walk
    price = Math.max(10, price + change);
    fullTimeSeries.push(price);
  }
  
  // Create sequences
  for (let i = 0; i < samples; i++) {
    const sequence = [];
    for (let j = 0; j < sequenceLength; j++) {
      const idx = i + j;
      // OHLC format
      const open = fullTimeSeries[idx];
      const high = open + Math.random() * 2;
      const low = open - Math.random() * 2;
      const close = fullTimeSeries[idx + 1];
      
      sequence.push([open, high, low, close]);
    }
    
    features.push(sequence);
    labels.push(fullTimeSeries[i + sequenceLength + 1]); // Next day's price
  }
  
  const dataset = {
    type: 'time_series',
    name: 'Stock Prices',
    description: 'Stock price prediction time series',
    features,
    labels,
    config: {
      inputShape: [sequenceLength, 4], // 60 time steps, 4 features (OHLC)
      outputShape: [1],
      numClasses: 1,
      learningRate: 0.001,
      batchSize: 16,
      epochs: 15
    }
  };
  
  const filepath = path.join(datasetsDir, 'timeseries.json');
  fs.writeFileSync(filepath, JSON.stringify(dataset, null, 2));
  console.log(`✅ Time series dataset saved to ${filepath}`);
  
  return dataset;
}

/**
 * Create a small test dataset for each peer (data partitioning)
 */
function createPartitionedDatasets(dataset, numPartitions = 3) {
  console.log(`Creating ${numPartitions} partitioned datasets...`);
  
  const samplesPerPartition = Math.floor(dataset.features.length / numPartitions);
  
  for (let i = 0; i < numPartitions; i++) {
    const start = i * samplesPerPartition;
    const end = i === numPartitions - 1 ? dataset.features.length : start + samplesPerPartition;
    
    const partitionedDataset = {
      ...dataset,
      name: `${dataset.name} - Partition ${i + 1}`,
      features: dataset.features.slice(start, end),
      labels: dataset.labels.slice(start, end)
    };
    
    const filepath = path.join(datasetsDir, `${dataset.type}-partition-${i + 1}.json`);
    fs.writeFileSync(filepath, JSON.stringify(partitionedDataset, null, 2));
    console.log(`  ✅ Partition ${i + 1} saved to ${filepath}`);
  }
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const datasetType = args[0];
  
  console.log('🚀 P2P Federated Learning Dataset Preparation\n');
  
  let datasets = [];
  
  if (!datasetType || datasetType === 'all' || datasetType === 'mnist') {
    datasets.push(generateMNISTLikeData(2000));
  }
  
  if (!datasetType || datasetType === 'all' || datasetType === 'iris') {
    datasets.push(generateIrisData());
  }
  
  if (!datasetType || datasetType === 'all' || datasetType === 'regression') {
    datasets.push(generateRegressionData(1000));
  }
  
  if (!datasetType || datasetType === 'all' || datasetType === 'timeseries') {
    datasets.push(generateTimeSeriesData(300));
  }
  
  // Create partitioned versions for federated learning testing
  console.log('\n📊 Creating partitioned datasets for federated learning...');
  datasets.forEach(dataset => {
    createPartitionedDatasets(dataset, 3);
  });
  
  // Create usage instructions
  const instructions = `
# Dataset Usage Instructions

## Available Datasets

1. **MNIST-like (Image Classification)**
   - File: datasets/mnist-like.json
   - Type: Image classification
   - Features: 784 (28x28 pixels)
   - Classes: 10 (digits 0-9)

2. **Iris (Classification)**
   - File: datasets/iris.json
   - Type: Multi-class classification
   - Features: 4 (flower measurements)
   - Classes: 3 (species)

3. **Housing (Regression)**
   - File: datasets/housing.json
   - Type: Regression
   - Features: 13 (housing attributes)
   - Target: Continuous price values

4. **Time Series (Stock Prediction)**
   - File: datasets/timeseries.json
   - Type: Time series regression
   - Features: 60 time steps × 4 OHLC values
   - Target: Next day's closing price

## Using Datasets in the Application

### Method 1: API Upload
\`\`\`bash
curl -X POST http://localhost:5000/api/data/upload \\
  -H "Content-Type: application/json" \\
  -d @datasets/iris.json
\`\`\`

### Method 2: Direct Integration
\`\`\`javascript
// In client code
const dataset = await fetch('/datasets/iris.json').then(r => r.json());
// Use dataset.features and dataset.labels for training
\`\`\`

### Method 3: Partitioned Testing
Use partition files for simulating different peers with different data:
- Node 1: Load datasets/classification-partition-1.json
- Node 2: Load datasets/classification-partition-2.json  
- Node 3: Load datasets/classification-partition-3.json

## Model Configuration
Each dataset includes a recommended config object that can be used to initialize the ML model with appropriate parameters.
`;
  
  fs.writeFileSync(path.join(datasetsDir, 'README.md'), instructions);
  
  console.log('\n✅ All datasets generated successfully!');
  console.log(`📁 Files saved to: ${datasetsDir}`);
  console.log('📖 See datasets/README.md for usage instructions');
}

if (require.main === module) {
  main();
}

module.exports = {
  generateMNISTLikeData,
  generateIrisData,
  generateRegressionData,
  generateTimeSeriesData,
  createPartitionedDatasets
};
