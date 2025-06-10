
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
```bash
curl -X POST http://localhost:5000/api/data/upload \
  -H "Content-Type: application/json" \
  -d @datasets/iris.json
```

### Method 2: Direct Integration
```javascript
// In client code
const dataset = await fetch('/datasets/iris.json').then(r => r.json());
// Use dataset.features and dataset.labels for training
```

### Method 3: Partitioned Testing
Use partition files for simulating different peers with different data:
- Node 1: Load datasets/classification-partition-1.json
- Node 2: Load datasets/classification-partition-2.json  
- Node 3: Load datasets/classification-partition-3.json

## Model Configuration
Each dataset includes a recommended config object that can be used to initialize the ML model with appropriate parameters.
