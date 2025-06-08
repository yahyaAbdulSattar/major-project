import * as tf from '@tensorflow/tfjs';
import { EventEmitter } from 'events';
import { storage } from './storage';

export interface ModelConfig {
  inputShape: number[];
  numClasses: number;
  learningRate: number;
  batchSize: number;
  epochs: number;
}

export interface TrainingData {
  features: number[][];
  labels: number[];
}

export interface ModelWeights {
  weights: Float32Array[];
  biases: Float32Array[];
}

export class FederatedLearningCoordinator extends EventEmitter {
  private model: tf.LayersModel | null = null;
  private config: ModelConfig;
  private isTraining: boolean = false;
  private currentRound: number = 0;
  private participatingPeers: Set<string> = new Set();
  private currentModelType: string = 'default';

  constructor(config: ModelConfig) {
    super();
    this.config = config;
  }

  async initializeModel(): Promise<void> {
    return this.initializeModelWithConfig(this.config);
  }

  async initializeModelWithConfig(config: ModelConfig): Promise<void> {
    try {
      this.config = config;
      this.currentModelType = this.determineModelType(config);
      
      // Create model based on type
      this.model = await this.createModelForType(config);

      // Compile model with appropriate loss function and metrics
      const compilationConfig = this.getCompilationConfig(config);
      this.model.compile(compilationConfig);

      console.log(`Model initialized successfully for type: ${this.currentModelType}`);
      this.emit('modelInitialized', { type: this.currentModelType, config });
    } catch (error) {
      console.error('Failed to initialize model:', error);
      throw error;
    }
  }

  private determineModelType(config: ModelConfig): string {
    if (config.inputShape.length === 3 && config.inputShape[2] > 1) {
      return 'image_classification';
    } else if (config.inputShape.length === 2) {
      return 'time_series';
    } else if (config.numClasses && config.numClasses > 1) {
      return 'classification';
    } else {
      return 'regression';
    }
  }

  private async createModelForType(config: ModelConfig): Promise<tf.LayersModel> {
    const type = this.determineModelType(config);
    
    switch (type) {
      case 'image_classification':
        return this.createCNNModel(config);
      case 'time_series':
        return this.createRNNModel(config);
      case 'classification':
        return this.createDenseModel(config, 'classification');
      case 'regression':
        return this.createDenseModel(config, 'regression');
      default:
        return this.createDenseModel(config, 'classification');
    }
  }

  private createCNNModel(config: ModelConfig): tf.LayersModel {
    const model = tf.sequential();
    
    // Convolutional layers
    model.add(tf.layers.conv2d({
      inputShape: config.inputShape,
      filters: 32,
      kernelSize: 3,
      activation: 'relu',
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
    
    model.add(tf.layers.conv2d({
      filters: 64,
      kernelSize: 3,
      activation: 'relu',
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
    
    model.add(tf.layers.conv2d({
      filters: 64,
      kernelSize: 3,
      activation: 'relu',
    }));
    
    // Dense layers
    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ 
      units: config.numClasses || 10, 
      activation: 'softmax' 
    }));
    
    return model;
  }

  private createRNNModel(config: ModelConfig): tf.LayersModel {
    const model = tf.sequential();
    
    model.add(tf.layers.lstm({
      inputShape: config.inputShape,
      units: 50,
      returnSequences: true,
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    
    model.add(tf.layers.lstm({
      units: 50,
      returnSequences: false,
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    
    model.add(tf.layers.dense({ 
      units: config.outputShape[0],
      activation: config.numClasses && config.numClasses > 1 ? 'softmax' : 'linear'
    }));
    
    return model;
  }

  private createDenseModel(config: ModelConfig, type: 'classification' | 'regression'): tf.LayersModel {
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.dense({
      inputShape: config.inputShape,
      units: 128,
      activation: 'relu',
    }));
    model.add(tf.layers.dropout({ rate: 0.3 }));
    
    // Hidden layers
    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu',
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu',
    }));
    
    // Output layer
    const outputUnits = type === 'regression' ? config.outputShape[0] : (config.numClasses || 2);
    const outputActivation = type === 'regression' ? 'linear' : 'softmax';
    
    model.add(tf.layers.dense({
      units: outputUnits,
      activation: outputActivation,
    }));
    
    return model;
  }

  private getCompilationConfig(config: ModelConfig): any {
    const type = this.determineModelType(config);
    
    switch (type) {
      case 'regression':
        return {
          optimizer: tf.train.adam(config.learningRate),
          loss: 'meanSquaredError',
          metrics: ['mae'],
        };
      case 'image_classification':
      case 'classification':
        return {
          optimizer: tf.train.adam(config.learningRate),
          loss: 'categoricalCrossentropy',
          metrics: ['accuracy'],
        };
      case 'time_series':
        return {
          optimizer: tf.train.adam(config.learningRate),
          loss: config.numClasses && config.numClasses > 1 ? 'categoricalCrossentropy' : 'meanSquaredError',
          metrics: config.numClasses && config.numClasses > 1 ? ['accuracy'] : ['mae'],
        };
      default:
        return {
          optimizer: tf.train.adam(config.learningRate),
          loss: 'categoricalCrossentropy',
          metrics: ['accuracy'],
        };
    }
  }

  async startTrainingRound(participatingPeerIds: string[]): Promise<void> {
    if (this.isTraining) {
      throw new Error('Training is already in progress');
    }

    if (!this.model) {
      throw new Error('Model not initialized');
    }

    this.isTraining = true;
    this.currentRound++;
    this.participatingPeers = new Set(participatingPeerIds);

    console.log(`Starting training round ${this.currentRound} with ${participatingPeerIds.length} peers`);

    try {
      // Log training round start
      const trainingRound = await storage.createTrainingRound({
        roundNumber: this.currentRound,
        modelAccuracy: null,
        loss: null,
        participatingPeers: participatingPeerIds.length,
        startTime: new Date(),
        endTime: null,
        modelParameters: this.getModelWeights(),
        status: 'training',
      });

      await storage.createNetworkActivity({
        type: 'training_started',
        peerId: null,
        message: `Training round ${this.currentRound} started with ${participatingPeerIds.length} peers`,
        timestamp: new Date(),
        metadata: { roundId: trainingRound.id, participatingPeers: participatingPeerIds },
      });

      this.emit('trainingStarted', {
        roundNumber: this.currentRound,
        participatingPeers: participatingPeerIds,
        roundId: trainingRound.id,
      });

      // Generate mock training data for demonstration
      const trainingData = this.generateMockTrainingData();
      
      // Perform local training
      const history = await this.trainModel(trainingData);
      
      // Simulate peer parameter collection and aggregation
      setTimeout(async () => {
        await this.completeTrainingRound(trainingRound.id, history);
      }, 5000);

    } catch (error) {
      console.error('Failed to start training round:', error);
      this.isTraining = false;
      throw error;
    }
  }

  private async trainModel(data: TrainingData): Promise<tf.History> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    // Convert data to tensors
    const xs = tf.tensor2d(data.features);
    const ys = tf.oneHot(tf.tensor1d(data.labels, 'int32'), this.config.numClasses);

    try {
      // Train the model
      const history = await this.model.fit(xs, ys, {
        epochs: this.config.epochs,
        batchSize: this.config.batchSize,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch + 1}: loss=${logs?.loss?.toFixed(4)}, accuracy=${logs?.acc?.toFixed(4)}`);
            this.emit('trainingProgress', {
              epoch: epoch + 1,
              totalEpochs: this.config.epochs,
              loss: logs?.loss,
              accuracy: logs?.acc,
            });
          },
        },
      });

      return history;
    } finally {
      // Clean up tensors
      xs.dispose();
      ys.dispose();
    }
  }

  private async completeTrainingRound(roundId: number, history: tf.History): Promise<void> {
    try {
      const finalLoss = history.history.loss?.[history.history.loss.length - 1] as number;
      const finalAccuracy = history.history.acc?.[history.history.acc.length - 1] as number;

      // Update training round
      await storage.updateTrainingRound(roundId, {
        modelAccuracy: finalAccuracy,
        loss: finalLoss,
        endTime: new Date(),
        modelParameters: this.getModelWeights(),
        status: 'completed',
      });

      await storage.createNetworkActivity({
        type: 'training_completed',
        peerId: null,
        message: `Training round ${this.currentRound} completed. Accuracy: ${(finalAccuracy * 100).toFixed(1)}%`,
        timestamp: new Date(),
        metadata: { roundId, accuracy: finalAccuracy, loss: finalLoss },
      });

      this.isTraining = false;
      
      this.emit('trainingCompleted', {
        roundNumber: this.currentRound,
        accuracy: finalAccuracy,
        loss: finalLoss,
        roundId,
      });

      console.log(`Training round ${this.currentRound} completed. Accuracy: ${(finalAccuracy * 100).toFixed(1)}%`);
    } catch (error) {
      console.error('Failed to complete training round:', error);
      this.isTraining = false;
    }
  }

  async aggregateModelWeights(peerWeights: ModelWeights[]): Promise<void> {
    if (!this.model || peerWeights.length === 0) {
      return;
    }

    try {
      // Simple federated averaging
      const modelWeights = this.model.getWeights();
      const aggregatedWeights: tf.Tensor[] = [];

      for (let i = 0; i < modelWeights.length; i++) {
        const currentWeight = modelWeights[i];
        const shape = currentWeight.shape;
        
        // Initialize with zeros
        let aggregated = tf.zeros(shape);
        
        // Add all peer weights
        for (const peerWeight of peerWeights) {
          if (i < peerWeight.weights.length) {
            const peerTensor = tf.tensor(peerWeight.weights[i], shape);
            aggregated = aggregated.add(peerTensor);
            peerTensor.dispose();
          }
        }
        
        // Average the weights
        aggregated = aggregated.div(tf.scalar(peerWeights.length));
        aggregatedWeights.push(aggregated);
      }

      // Update model with aggregated weights
      this.model.setWeights(aggregatedWeights);
      
      // Clean up
      aggregatedWeights.forEach(tensor => tensor.dispose());
      
      console.log('Model weights aggregated successfully');
      this.emit('weightsAggregated');
      
    } catch (error) {
      console.error('Failed to aggregate model weights:', error);
      throw error;
    }
  }

  getModelWeights(): any {
    if (!this.model) {
      return null;
    }

    try {
      const weights = this.model.getWeights();
      return weights.map(tensor => ({
        shape: tensor.shape,
        data: Array.from(tensor.dataSync()),
      }));
    } catch (error) {
      console.error('Failed to get model weights:', error);
      return null;
    }
  }

  async setModelWeights(weights: any): Promise<void> {
    if (!this.model || !weights) {
      return;
    }

    try {
      const tensors = weights.map((w: any) => tf.tensor(w.data, w.shape));
      this.model.setWeights(tensors);
      tensors.forEach((tensor: tf.Tensor) => tensor.dispose());
      console.log('Model weights updated successfully');
    } catch (error) {
      console.error('Failed to set model weights:', error);
      throw error;
    }
  }

  private generateMockTrainingData(): TrainingData {
    // Generate mock training data for demonstration
    const numSamples = 1000;
    const features: number[][] = [];
    const labels: number[] = [];

    for (let i = 0; i < numSamples; i++) {
      // Generate random features based on input shape
      const feature = this.config.inputShape.map(() => Math.random());
      features.push(feature);
      
      // Generate random label
      labels.push(Math.floor(Math.random() * this.config.numClasses));
    }

    return { features, labels };
  }

  isTrainingActive(): boolean {
    return this.isTraining;
  }

  getCurrentRound(): number {
    return this.currentRound;
  }

  getParticipatingPeers(): string[] {
    return Array.from(this.participatingPeers);
  }

  getDefaultConfig(): ModelConfig {
    return this.config;
  }

  getCurrentModelType(): string {
    return this.currentModelType;
  }

  updateConfig(newConfig: Partial<ModelConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Global instance
let flCoordinator: FederatedLearningCoordinator | null = null;

export function getFLCoordinator(): FederatedLearningCoordinator {
  if (!flCoordinator) {
    const config: ModelConfig = {
      inputShape: [784], // MNIST-like input
      numClasses: 10,
      learningRate: 0.001,
      batchSize: 32,
      epochs: 5,
    };
    flCoordinator = new FederatedLearningCoordinator(config);
  }
  return flCoordinator;
}
