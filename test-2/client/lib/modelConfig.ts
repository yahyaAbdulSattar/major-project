export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  type: 'image_classification' | 'regression' | 'text_classification' | 'time_series';
  inputShape: number[];
  outputShape: number[];
  numClasses?: number;
  learningRate: number;
  batchSize: number;
  epochs: number;
  dataFormat: 'image' | 'csv' | 'json' | 'text';
  sampleDataUrl?: string;
}

export const predefinedModels: ModelConfig[] = [
  {
    id: 'mnist_classifier',
    name: 'MNIST Digit Classifier',
    description: 'Classify handwritten digits (0-9)',
    type: 'image_classification',
    inputShape: [28, 28, 1],
    outputShape: [10],
    numClasses: 10,
    learningRate: 0.001,
    batchSize: 32,
    epochs: 5,
    dataFormat: 'image',
    sampleDataUrl: '/api/models/mnist/sample'
  },
  {
    id: 'cifar10_classifier',
    name: 'CIFAR-10 Image Classifier',
    description: 'Classify natural images into 10 categories',
    type: 'image_classification',
    inputShape: [32, 32, 3],
    outputShape: [10],
    numClasses: 10,
    learningRate: 0.0001,
    batchSize: 16,
    epochs: 10,
    dataFormat: 'image',
    sampleDataUrl: '/api/models/cifar10/sample'
  },
  {
    id: 'house_price_regression',
    name: 'House Price Predictor',
    description: 'Predict house prices based on features',
    type: 'regression',
    inputShape: [13],
    outputShape: [1],
    learningRate: 0.01,
    batchSize: 64,
    epochs: 20,
    dataFormat: 'csv',
    sampleDataUrl: '/api/models/housing/sample'
  },
  {
    id: 'sentiment_analysis',
    name: 'Sentiment Analysis',
    description: 'Classify text sentiment (positive/negative)',
    type: 'text_classification',
    inputShape: [100],
    outputShape: [2],
    numClasses: 2,
    learningRate: 0.001,
    batchSize: 32,
    epochs: 8,
    dataFormat: 'text',
    sampleDataUrl: '/api/models/sentiment/sample'
  },
  {
    id: 'stock_prediction',
    name: 'Stock Price Predictor',
    description: 'Predict future stock prices from historical data',
    type: 'time_series',
    inputShape: [30, 5],
    outputShape: [1],
    learningRate: 0.001,
    batchSize: 16,
    epochs: 15,
    dataFormat: 'csv',
    sampleDataUrl: '/api/models/stocks/sample'
  }
];

export const getModelConfig = (modelId: string): ModelConfig | undefined => {
  return predefinedModels.find(model => model.id === modelId);
};