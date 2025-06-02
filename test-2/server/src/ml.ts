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

  constructor(config: ModelConfig) {
    super();
    this.config = config;
  }

  async initializeModel(): Promise<void> {
    try {
      // Create a simple neural network for demonstration
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: this.config.inputShape,
            units: 64,
            activation: 'relu',
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 32,
            activation: 'relu',
          }),
          tf.layers.dense({
            units: this.config.numClasses,
            activation: 'softmax',
          }),
        ],
      });

      this.model.compile({
        optimizer: tf.train.adam(this.config.learningRate),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy'],
      });

      console.log('Model initialized successfully');
      this.emit('modelInitialized');
    } catch (error) {
      console.error('Failed to initialize model:', error);
      throw error;
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