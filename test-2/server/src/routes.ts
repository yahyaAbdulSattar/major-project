import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getP2PNetwork } from "./p2p";
import { getFLCoordinator } from "./ml";
import { initializeWebSocketManager } from "./websocket";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize WebSocket manager
  initializeWebSocketManager(httpServer);

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
      if (connectedPeers.length === 0) {
        return res.status(400).json({ error: 'No connected peers available for training' });
      }

      await flCoordinator.startTrainingRound(connectedPeers);
      
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

  // Model endpoints
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
      const flCoordinator = getFLCoordinator();
      await flCoordinator.initializeModel();
      res.json({ message: 'Model initialized successfully' });
    } catch (error: any) {
      console.error('Failed to initialize model:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
