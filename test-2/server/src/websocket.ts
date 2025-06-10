import { Server as SocketIOServer } from 'socket.io';
import type { Server } from 'http';
import { getP2PNetwork } from './p2p';
import { getFLCoordinator } from './ml';
import { storage } from './storage';

export class WebSocketManager {
  private io: SocketIOServer;
  private connectedClients: Set<string> = new Set();

  constructor(httpServer: Server) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.setupEventHandlers();
    this.setupP2PEventForwarding();
    this.setupMLEventForwarding();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`WebSocket client connected: ${socket.id}`);
      this.connectedClients.add(socket.id);

      // Send initial state
      this.sendInitialState(socket);

      // Handle client events
      socket.on('start-training', async (data) => {
        try {
          const p2pNetwork = getP2PNetwork();
          const flCoordinator = getFLCoordinator();

          if (!p2pNetwork.isStarted()) {
            socket.emit('error', { message: 'P2P network not started' });
            return;
          }

          const connectedPeers = p2pNetwork.getConnectedPeers();
          await flCoordinator.startTrainingRound(connectedPeers);

        } catch (error: any) {
          console.error('Failed to start training:', error);
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('stop-training', () => {
        // Handle training stop (if needed)
        socket.emit('training-stopped');
      });

      socket.on('request-network-status', async () => {
        try {
          const networkStats = await storage.getLatestNetworkStats();
          const recentActivity = await storage.getRecentNetworkActivity(10);
          const connectedPeers = await storage.getConnectedPeers();

          socket.emit('network-status', {
            stats: networkStats,
            activity: recentActivity,
            peers: connectedPeers,
          });
        } catch (error) {
          console.error('Failed to get network status:', error);
          socket.emit('error', { message: 'Failed to get network status' });
        }
      });

      socket.on('request-training-history', async () => {
        try {
          const trainingHistory = await storage.getRecentTrainingRounds(20);
          socket.emit('training-history', trainingHistory);
        } catch (error) {
          console.error('Failed to get training history:', error);
          socket.emit('error', { message: 'Failed to get training history' });
        }
      });

      socket.on('disconnect', () => {
        console.log(`WebSocket client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });
    });
  }

  private async sendInitialState(socket: any): Promise<void> {
    try {
      const p2pNetwork = getP2PNetwork();
      const flCoordinator = getFLCoordinator();

      // Send P2P network status
      socket.emit('p2p-status', {
        isStarted: p2pNetwork.isStarted(),
        nodeId: p2pNetwork.getNodeId(),
        multiaddrs: p2pNetwork.getMultiaddrs(),
        connectedPeers: p2pNetwork.getConnectedPeers(),
      });

      // Send training status
      socket.emit('training-status', {
        isTraining: flCoordinator.isTrainingActive(),
        currentRound: flCoordinator.getCurrentRound(),
        participatingPeers: flCoordinator.getParticipatingPeers(),
      });

      // Send network stats
      const networkStats = await storage.getLatestNetworkStats();
      if (networkStats) {
        socket.emit('network-stats', networkStats);
      }

      // Send recent activity
      const recentActivity = await storage.getRecentNetworkActivity(10);
      socket.emit('network-activity', recentActivity);

      // Send connected peers
      const connectedPeers = await storage.getConnectedPeers();
      socket.emit('connected-peers', connectedPeers);

    } catch (error) {
      console.error('Failed to send initial state:', error);
    }
  }

  private setupP2PEventForwarding(): void {
    const p2pNetwork = getP2PNetwork();

    p2pNetwork.on('nodeStarted', (data) => {
      this.broadcast('p2p-node-started', data);
    });

    p2pNetwork.on('peerDiscovered', (data) => {
      this.broadcast('p2p-peer-discovered', data);
    });

    p2pNetwork.on('peerConnected', async (data) => {
      this.broadcast('p2p-peer-connected', data);

      // Send updated peer list
      try {
        const connectedPeers = await storage.getConnectedPeers();
        this.broadcast('connected-peers', connectedPeers);

        const networkStats = await storage.getLatestNetworkStats();
        if (networkStats) {
          this.broadcast('network-stats', networkStats);
        }
      } catch (error) {
        console.error('Failed to send updated peer info:', error);
      }
    });

    p2pNetwork.on('peerDisconnected', async (data) => {
      this.broadcast('p2p-peer-disconnected', data);

      // Send updated peer list
      try {
        const connectedPeers = await storage.getConnectedPeers();
        this.broadcast('connected-peers', connectedPeers);

        const networkStats = await storage.getLatestNetworkStats();
        if (networkStats) {
          this.broadcast('network-stats', networkStats);
        }
      } catch (error) {
        console.error('Failed to send updated peer info:', error);
      }
    });
  }

  private setupMLEventForwarding(): void {
    const flCoordinator = getFLCoordinator();
    const p2pNetwork = getP2PNetwork();

    // Forward ML events to connected clients
    flCoordinator.on('trainingStarted', (data) => {
      console.log('📡 Broadcasting training started event');
      this.io.emit('training:started', data);
    });

    flCoordinator.on('trainingProgress', (data) => {
      this.io.emit('training:progress', data);
    });

    flCoordinator.on('trainingCompleted', async (data) => {
      console.log('📡 Broadcasting training completed event');
      this.io.emit('training:completed', data);

      // Automatically start weight aggregation if we have peers
      const connectedPeers = p2pNetwork.getConnectedPeers();
      if (connectedPeers.length > 0) {
        console.log('🔄 Starting automatic weight aggregation...');
        try {
          const peerWeights = await p2pNetwork.requestWeightsFromPeers();
          if (peerWeights.length > 0) {
            await flCoordinator.aggregateModelWeights(peerWeights, true);
          }
        } catch (error) {
          console.error('Failed to aggregate weights automatically:', error);
        }
      }
    });

    flCoordinator.on('weightsAggregated', (data) => {
      console.log('📡 Broadcasting weights aggregated event');
      this.io.emit('weights:aggregated', data);
    });

    flCoordinator.on('modelInitialized', (data) => {
      this.io.emit('model:initialized', data);
    });

    // Forward P2P federated learning events
    p2pNetwork.on('weightsReceived', (data) => {
      this.io.emit('federated:weights-received', {
        peerId: data.peerId,
        timestamp: new Date().toISOString()
      });
    });

    p2pNetwork.on('trainingCoordination', (data) => {
      this.io.emit('federated:coordination', data);
    });
  }

  public broadcast(event: string, data?: any): void {
    this.io.emit(event, data);
  }

  public sendToClient(clientId: string, event: string, data?: any): void {
    this.io.to(clientId).emit(event, data);
  }

  public getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }
}

let wsManager: WebSocketManager | null = null;

export function initializeWebSocketManager(httpServer: Server): WebSocketManager {
  if (!wsManager) {
    wsManager = new WebSocketManager(httpServer);
  }
  return wsManager;
}

export function getWebSocketManager(): WebSocketManager | null {
  return wsManager;
}