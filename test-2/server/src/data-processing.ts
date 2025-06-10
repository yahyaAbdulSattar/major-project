import * as tf from '@tensorflow/tfjs';
import { parse } from 'csv-parse/sync';

export interface ProcessedData {
  features: number[][];
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
  } catch (error) {
    throw new Error(`Failed to process image: ${error.message}`);
  }
}

export async function processCSVData(csvContent: string): Promise<ProcessedData> {
  try {
    // Parse CSV content
    const records = parse(csvContent, {
      skip_empty_lines: true,
      trim: true,
      cast: true, // Automatically convert string to numbers when possible
    });

    if (records.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Assume last column is the label
    const features = records.map(row => row.slice(0, -1));
    const labels = records.map(row => row[row.length - 1]);

    // Validate data
    if (features.some(row => row.some(val => typeof val !== 'number'))) {
      throw new Error('Features contain non-numeric values');
    }

    if (labels.some(val => typeof val !== 'number')) {
      throw new Error('Labels contain non-numeric values');
    }

    return { features, labels };
  } catch (error) {
    throw new Error(`Failed to process CSV data: ${error.message}`);
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
  } catch (error) {
    throw new Error(`Failed to process text data: ${error.message}`);
  }
} 