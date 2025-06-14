import express, { Express, Request, Response, Router } from 'express';
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getP2PNetwork } from "./p2p";
import { getFLCoordinator } from "./ml";
import { initializeWebSocketManager } from "./websocket";
import { processTimeSeriesData, processImageData, processCSVData } from "./data-processing";
import fileUpload from 'express-fileupload';
import { ParsedQs } from 'qs';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize WebSocket manager
  initializeWebSocketManager(httpServer);

  // Add file upload middleware
  app.use(fileUpload());

  const router = Router();

  // Network status endpoints
  app.get("/api/network/status", async (req, res) => {
    try {
      const p2pNetwork = getP2PNetwork();
      const networkStats = await storage.getLatestNetworkStats();
      const connectedPeers = await storage.getConnectedPeers();
      
      res.json({
        isStarted: p2pNetwork.isStarted(),
        nodeId: p2pNetwork.getNodeId(),
        multiaddrs: p2pNetwork.getMultiaddrs(),
        connectedPeersCount: p2pNetwork.getConnectedPeers().length,
        stats: networkStats,
        peers: connectedPeers,
      });
    } catch (error) {
      console.error('Failed to get network status:', error);
      res.status(500).json({ error: 'Failed to get network status' });
    }
  });

  app.post("/api/network/start", async (req, res) => {
    try {
      const p2pNetwork = getP2PNetwork();
      
      if (p2pNetwork.isStarted()) {
        return res.status(400).json({ error: 'Network already started' });
      }

      await p2pNetwork.start();
      
      res.json({ 
        message: 'P2P network started successfully',
        nodeId: p2pNetwork.getNodeId(),
        multiaddrs: p2pNetwork.getMultiaddrs(),
      });
    } catch (error: any) {
      console.error('Failed to start P2P network:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/network/stop", async (req, res) => {
    try {
      const p2pNetwork = getP2PNetwork();
      await p2pNetwork.stop();
      res.json({ message: 'P2P network stopped successfully' });
    } catch (error: any) {
      console.error('Failed to stop P2P network:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Manual connection endpoint
  app.post("/api/network/connect", async (req, res) => {
    try {
      const { multiaddr } = req.body;
      if (!multiaddr) {
        return res.status(400).json({ error: 'Multiaddr is required' });
      }
      
      const p2pNetwork = getP2PNetwork();
      await p2pNetwork.connectToPeer(multiaddr);
      res.json({ message: 'Connection attempt initiated' });
    } catch (error: any) {
      console.error('Failed to connect to peer:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get connection info for sharing
  app.get("/api/network/connection-info", async (req, res) => {
    try {
      const p2pNetwork = getP2PNetwork();
      if (!p2pNetwork.isStarted()) {
        return res.status(400).json({ error: 'Network not started' });
      }

      const nodeId = p2pNetwork.getNodeId();
      const multiaddrs = p2pNetwork.getMultiaddrs();
      
      // Get external IP if possible
      const externalAddrs = multiaddrs.filter(addr => 
        !addr.includes('127.0.0.1') && !addr.includes('::1')
      );

      res.json({
        nodeId,
        multiaddrs: externalAddrs.length > 0 ? externalAddrs : multiaddrs,
        shareableAddrs: externalAddrs.map(addr => `${addr}/p2p/${nodeId}`),
      });
    } catch (error: any) {
      console.error('Failed to get connection info:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Peer management endpoints
  app.get("/api/peers", async (req, res) => {
    try {
      const peers = await storage.getAllPeers();
      res.json(peers);
    } catch (error) {
      console.error('Failed to get peers:', error);
      res.status(500).json({ error: 'Failed to get peers' });
    }
  });

  app.get("/api/peers/connected", async (req, res) => {
    try {
      const connectedPeers = await storage.getConnectedPeers();
      res.json(connectedPeers);
    } catch (error) {
      console.error('Failed to get connected peers:', error);
      res.status(500).json({ error: 'Failed to get connected peers' });
    }
  });

  // Training endpoints
  app.get("/api/training/status", async (req, res) => {
    try {
      const flCoordinator = getFLCoordinator();
      const latestRound = await storage.getLatestTrainingRound();
      
      res.json({
        isTraining: flCoordinator.isTrainingActive(),
        currentRound: flCoordinator.getCurrentRound(),
        participatingPeers: flCoordinator.getParticipatingPeers(),
        latestRound,
      });
    } catch (error) {
      console.error('Failed to get training status:', error);
      res.status(500).json({ error: 'Failed to get training status' });
    }
  });

  app.post("/api/training/start", async (req, res) => {
    try {
      const p2pNetwork = getP2PNetwork();
      const flCoordinator = getFLCoordinator();
      
      if (!p2pNetwork.isStarted()) {
        return res.status(400).json({ error: 'P2P network not started' });
      }

      if (flCoordinator.isTrainingActive()) {
        return res.status(400).json({ error: 'Training already in progress' });
      }

      // Initialize model if not already done
      if (!flCoordinator.getModelWeights()) {
        await flCoordinator.initializeModel();
      }

      const connectedPeers = p2pNetwork.getConnectedPeers();
      const { simulateWithLocalNode } = req.body;
      
      let participatingPeers = connectedPeers;
      
      // Allow simulation mode for testing with local node only
      if (connectedPeers.length === 0 && simulateWithLocalNode) {
        participatingPeers = [p2pNetwork.getNodeId() || 'local-node'];
      } else if (connectedPeers.length === 0) {
        return res.status(400).json({ error: 'No connected peers available for training' });
      }

      await flCoordinator.startTrainingRound(participatingPeers);
      
      res.json({ 
        message: 'Training started successfully',
        roundNumber: flCoordinator.getCurrentRound(),
        participatingPeers: connectedPeers,
      });
    } catch (error: any) {
      console.error('Failed to start training:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/training/rounds", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const rounds = await storage.getRecentTrainingRounds(limit);
      res.json(rounds);
    } catch (error) {
      console.error('Failed to get training rounds:', error);
      res.status(500).json({ error: 'Failed to get training rounds' });
    }
  });

  app.get("/api/training/rounds/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const round = await storage.getTrainingRound(id);
      
      if (!round) {
        return res.status(404).json({ error: 'Training round not found' });
      }
      
      res.json(round);
    } catch (error) {
      console.error('Failed to get training round:', error);
      res.status(500).json({ error: 'Failed to get training round' });
    }
  });

  // Training simulation endpoint for testing
  app.post("/api/training/simulate", async (req, res) => {
    try {
      const flCoordinator = getFLCoordinator();
      const p2pNetwork = getP2PNetwork();
      
      if (flCoordinator.isTrainingActive()) {
        return res.status(400).json({ error: 'Training already in progress' });
      }

      // Initialize model if not already done
      await flCoordinator.initializeModel();

      // Simulate training with local node
      const nodeId = p2pNetwork.getNodeId() || 'simulation-node';
      await flCoordinator.startTrainingRound([nodeId]);
      
      res.json({ 
        message: 'Training simulation started successfully',
        roundNumber: flCoordinator.getCurrentRound(),
        participatingPeers: [nodeId],
        mode: 'simulation'
      });
    } catch (error: any) {
      console.error('Failed to start training simulation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Network activity endpoints
  app.get("/api/network/activity", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const activity = await storage.getRecentNetworkActivity(limit);
      res.json(activity);
    } catch (error) {
      console.error('Failed to get network activity:', error);
      res.status(500).json({ error: 'Failed to get network activity' });
    }
  });

  // Network statistics endpoints
  app.get("/api/network/stats", async (req, res) => {
    try {
      const stats = await storage.getLatestNetworkStats();
      res.json(stats);
    } catch (error) {
      console.error('Failed to get network stats:', error);
      res.status(500).json({ error: 'Failed to get network stats' });
    }
  });

  // Enhanced Model endpoints
  app.get("/api/model/weights", async (req, res) => {
    try {
      const flCoordinator = getFLCoordinator();
      const weights = flCoordinator.getModelWeights();
      res.json({ weights });
    } catch (error) {
      console.error('Failed to get model weights:', error);
      res.status(500).json({ error: 'Failed to get model weights' });
    }
  });

  app.post("/api/model/initialize", async (req, res) => {
    try {
      const { config } = req.body;

      console.log("Request config", config);
      const flCoordinator = getFLCoordinator();
      
      if (config) {
        // Extract only the fields needed for the server-side ModelConfig
        const serverConfig = {
          inputShape: config.inputShape,
          outputShape: config.outputShape,
          // For regression, set numClasses to 1 or undefined
          numClasses: config.outputShape?.[0] === 1 ? undefined : (config.numClasses || 2),
          learningRate: config.learningRate,
          batchSize: config.batchSize,
          epochs: config.epochs
        };

        console.log(serverConfig)
        
        // Initialize with custom config
        await flCoordinator.initializeModelWithConfig(serverConfig);
        
      } else {
        // Initialize with default config 
        await flCoordinator.initializeModel();
      }
      
      res.json({ 
        message: 'Model initialized successfully',
        config: config || flCoordinator.getDefaultConfig()
      });
    } catch (error: any) {
      console.error('Failed to initialize model:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Data upload endpoint
  router.post("/api/data/upload", async (req: Request, res: Response) => {
    try {
      if (!req.files || !req.files.file) {
        throw new Error('No file uploaded');
      }

      const file = req.files.file as fileUpload.UploadedFile;
      const modelType = req.body.modelType;
      const modelId = req.body.modelId;

      console.log('Received file:', {
        name: file.name,
        size: file.size,
        mimetype: file.mimetype,
        modelType,
        modelId
      });

      let processedData;
      let preview;

      // Read file content
      const content = file.data.toString();

      if (modelType === 'time_series') {
        const isJson = file.name.endsWith('.json');
        processedData = await processTimeSeriesData(content, isJson);
        
        preview = {
          samples: processedData.features.length,
          timesteps: 30,
          features: 5,
          shape: [processedData.features.length, 30, 5],
          example: {
            input: processedData.features[0],
            prediction: processedData.labels[0]
          }
        };
      } else if (modelType === 'image_classification') {
        processedData = await processImageData(file.data);
        const shape = processedData.features[0] ? processedData.features[0].length : [];
        preview = {
          samples: processedData.features.length,
          features: 'Image data',
          shape: [processedData.features.length, ...(Array.isArray(shape) ? shape : [shape])],
        };
      } else if (modelType === 'regression') {
        processedData = await processCSVData(content);
        preview = {
          samples: processedData.features.length,
          features: processedData.features[0].length,
          shape: [processedData.features.length, processedData.features[0].length],
          example: {
            input: processedData.features[0],
            prediction: processedData.labels[0]
          }
        };
      } else {
        // Handle other types...
        preview = {
          samples: 1000,
          features: modelType === 'regression' ? 'Numerical features' : 'Categorical features',
          labels: modelType === 'regression' ? 'Continuous values' : 'Categorical labels',
          shape: modelType === 'regression' ? [1000, 10] : [1000, 1]
        };
      }

      // Store processed data for training
      const flCoordinator = getFLCoordinator();
      await flCoordinator.processUserData(processedData, modelType);

      res.json({ 
        message: 'Data processed successfully',
        preview
      });
    } catch (error: unknown) {
      console.error('Failed to process uploaded data:', error);
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Unknown error occurred while processing data' });
      }
    }
  });

  // Enhanced federated training endpoints
  app.post("/api/training/federated/start", async (req, res) => {
    try {
      const p2pNetwork = getP2PNetwork();
      const flCoordinator = getFLCoordinator();
      
      if (!p2pNetwork.isStarted()) {
        return res.status(400).json({ error: 'P2P network not started' });
      }

      if (flCoordinator.isTrainingActive()) {
        return res.status(400).json({ error: 'Training already in progress' });
      }

      const connectedPeers = p2pNetwork.getConnectedPeers();
      const { requireMinimumPeers = false, minimumPeers = 2, config } = req.body;
      
      // Update model configuration if provided
      if (config) {
        flCoordinator.updateConfig(config);
      }

      // Check if we have enough peers for federated learning
      if (requireMinimumPeers && connectedPeers.length < minimumPeers) {
        return res.status(400).json({ 
          error: `Need at least ${minimumPeers} peers for federated training. Currently connected: ${connectedPeers.length}` 
        });
      }

      let participatingPeers = connectedPeers;
      
      // Allow single-node training for testing
      if (connectedPeers.length === 0) {
        participatingPeers = [p2pNetwork.getNodeId() || 'local-node'];
      }

      // Broadcast training start to peers
      if (connectedPeers.length > 0) {
        await p2pNetwork.broadcastTrainingStart(flCoordinator.getCurrentRound() + 1);
      }

      await flCoordinator.startTrainingRound(participatingPeers);
      
      res.json({ 
        message: 'Federated training started successfully',
        roundNumber: flCoordinator.getCurrentRound(),
        participatingPeers,
        mode: connectedPeers.length > 0 ? 'federated' : 'local'
      });
    } catch (error: any) {
      console.error('Failed to start federated training:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Weight aggregation endpoint
  app.post("/api/training/aggregate", async (req, res) => {
    try {
      const p2pNetwork = getP2PNetwork();
      const flCoordinator = getFLCoordinator();
      
      if (!p2pNetwork.isStarted()) {
        return res.status(400).json({ error: 'P2P network not started' });
      }

      console.log('🔄 Starting weight collection and aggregation...');
      
      // Collect weights from all connected peers
      const peerWeights = await p2pNetwork.requestWeightsFromPeers();
      
      if (peerWeights.length === 0) {
        return res.status(400).json({ error: 'No weights collected from peers' });
      }

      // Perform federated averaging
      await flCoordinator.aggregateModelWeights(peerWeights, true);
      
      res.json({ 
        message: 'Model weights aggregated successfully',
        participatingPeers: peerWeights.length,
        currentRound: flCoordinator.getCurrentRound()
      });
    } catch (error: any) {
      console.error('Failed to aggregate weights:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/training/federated/status", async (req, res) => {
    try {
      const flCoordinator = getFLCoordinator();
      const p2pNetwork = getP2PNetwork();
      
      res.json({
        isActive: flCoordinator.isTrainingActive(),
        currentRound: flCoordinator.getCurrentRound(),
        participatingPeers: flCoordinator.getParticipatingPeers(),
        connectedPeers: p2pNetwork.getConnectedPeers().length,
        canStartTraining: !flCoordinator.isTrainingActive() && p2pNetwork.isStarted()
      });
    } catch (error) {
      console.error('Failed to get federated training status:', error);
      res.status(500).json({ error: 'Failed to get federated training status' });
    }
  });

  app.use(router);
  return httpServer;
}
