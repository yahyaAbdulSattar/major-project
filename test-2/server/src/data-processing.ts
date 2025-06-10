import * as tf from '@tensorflow/tfjs';
import { parse } from 'csv-parse/sync';

export interface ProcessedData {
  features: number[][];
  labels: number[];
}

// Separate interface for time series data
export interface TimeSeriesProcessedData {
  features: number[][][];
  labels: number[];
}

export async function processImageData(buffer: Buffer): Promise<ProcessedData> {
  try {
    // Load and preprocess image
    const image = tf.node.decodeImage(buffer);
    
    // Normalize pixel values to [0, 1]
    const normalizedImage = image.toFloat().div(255.0);
    
    // Reshape to match model input shape
    const reshapedImage = normalizedImage.reshape([1, ...normalizedImage.shape]);
    
    // Convert to array for storage
    const features = Array.from(await reshapedImage.array()) as number[][];
    
    // Cleanup tensors
    image.dispose();
    normalizedImage.dispose();
    reshapedImage.dispose();
    
    return {
      features,
      labels: [], // Labels should be provided separately or inferred from directory structure
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Failed to process image: ${error.message}`);
    }
    throw new Error('Failed to process image: Unknown error');
  }
}

interface CSVRecord {
  [key: string]: number;
  price: number;
}

export async function processCSVData(csvContent: string): Promise<ProcessedData> {
  try {
    // Parse CSV content
    const records = parse(csvContent, {
      columns: true, // Parse header row as column names
      skip_empty_lines: true,
      trim: true,
      cast: true, // Automatically convert string to numbers when possible
    }) as CSVRecord[];

    if (records.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Extract features and labels from records
    const features = records.map((row: CSVRecord) => {
      // Get all columns except 'price' as features
      const featureValues = Object.entries(row)
        .filter(([key]) => key !== 'price')
        .map(([_, value]) => value);
      return featureValues;
    });

    const labels = records.map((row: CSVRecord) => row.price);

    // Validate data
    if (features.some((row: number[]) => row.some((val: number) => typeof val !== 'number'))) {
      throw new Error('Features contain non-numeric values');
    }

    if (labels.some((val: number) => typeof val !== 'number')) {
      throw new Error('Labels contain non-numeric values');
    }

    return { features, labels };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Failed to process CSV data: ${error.message}`);
    }
    throw new Error('Failed to process CSV data: Unknown error');
  }
}

export async function processTextData(textContent: string): Promise<ProcessedData> {
  try {
    // Split text into lines and process each line
    const lines = textContent.split('\n').filter(line => line.trim());
    
    // Assume format: "text,label" or just text
    const processed = lines.map(line => {
      const [text, label] = line.split(',').map(s => s.trim());
      return { text, label: label ? parseInt(label) : 0 };
    });

    // Convert text to numeric features (simple bag of words for demonstration)
    const vocabulary = new Set<string>();
    processed.forEach(({ text }) => {
      text.toLowerCase().split(/\s+/).forEach(word => vocabulary.add(word));
    });

    const wordToIndex = new Map([...vocabulary].map((word, i) => [word, i]));
    
    // Convert texts to feature vectors
    const features = processed.map(({ text }) => {
      const vector = new Array(vocabulary.size).fill(0);
      text.toLowerCase().split(/\s+/).forEach(word => {
        const index = wordToIndex.get(word);
        if (index !== undefined) {
          vector[index]++;
        }
      });
      return vector;
    });

    const labels = processed.map(({ label }) => label);

    return { features, labels };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Failed to process text data: ${error.message}`);
    }
    throw new Error('Failed to process text data: Unknown error');
  }
}

export async function processTimeSeriesData(content: string, isJson: boolean): Promise<TimeSeriesProcessedData> {
  try {
    let data: any[];
    
    if (isJson) {
      data = JSON.parse(content);
    } else {
      // Parse CSV
      data = parse(content, {
        columns: true,
        skip_empty_lines: true,
        cast: true // Automatically convert numbers
      });
    }

    // Validate data structure
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid data format: expected array of records');
    }

    // Extract features (assuming columns: timestamp, open, high, low, close, volume)
    const requiredColumns = ['open', 'high', 'low', 'close', 'volume'];
    const firstRow = data[0];
    
    // Validate columns
    if (!requiredColumns.every(col => col in firstRow)) {
      throw new Error(`Missing required columns. Expected: ${requiredColumns.join(', ')}`);
    }

    // Convert data to features array
    const rawFeatures = data.map(row => [
      parseFloat(row.open),
      parseFloat(row.high),
      parseFloat(row.low),
      parseFloat(row.close),
      parseFloat(row.volume)
    ]);

    // Create windows of 30 timesteps
    const features: number[][][] = [];
    const labels: number[] = [];

    for (let i = 0; i <= rawFeatures.length - 31; i++) {
      const window = rawFeatures.slice(i, i + 30);
      features.push(window);
      // Use the next closing price as the label
      labels.push(rawFeatures[i + 30][3]); // index 3 is close price
    }

    // Normalize features
    const normalizedFeatures = features.map(window => {
      return window.map(timestep => {
        return timestep.map((value, index) => {
          // Simple min-max normalization
          const min = Math.min(...features.flat().map(t => t[index]));
          const max = Math.max(...features.flat().map(t => t[index]));
          return (value - min) / (max - min);
        });
      });
    });

    // Normalize labels (using close price min/max)
    const closeMin = Math.min(...labels);
    const closeMax = Math.max(...labels);
    const normalizedLabels = labels.map(label => (label - closeMin) / (closeMax - closeMin));

    return {
      features: normalizedFeatures,
      labels: normalizedLabels
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Failed to process time series data: ${error.message}`);
    }
    throw new Error('Failed to process time series data: Unknown error');
  }
} 