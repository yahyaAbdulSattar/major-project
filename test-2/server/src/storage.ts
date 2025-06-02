import { 
  users, 
  peers, 
  trainingRounds, 
  networkActivity, 
  networkStats,
  type User, 
  type InsertUser,
  type Peer,
  type InsertPeer,
  type TrainingRound,
  type InsertTrainingRound,
  type NetworkActivity,
  type InsertNetworkActivity,
  type NetworkStats,
  type InsertNetworkStats,
} from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Peer management
  getAllPeers(): Promise<Peer[]>;
  getConnectedPeers(): Promise<Peer[]>;
  getPeer(peerId: string): Promise<Peer | undefined>;
  upsertPeer(peer: InsertPeer): Promise<Peer>;
  updatePeerConnection(peerId: string, isConnected: boolean): Promise<void>;
  
  // Training rounds
  getTrainingRound(id: number): Promise<TrainingRound | undefined>;
  getLatestTrainingRound(): Promise<TrainingRound | undefined>;
  getRecentTrainingRounds(limit: number): Promise<TrainingRound[]>;
  createTrainingRound(round: InsertTrainingRound): Promise<TrainingRound>;
  updateTrainingRound(id: number, updates: Partial<TrainingRound>): Promise<void>;
  
  // Network activity
  getRecentNetworkActivity(limit: number): Promise<NetworkActivity[]>;
  createNetworkActivity(activity: InsertNetworkActivity): Promise<NetworkActivity>;
  
  // Network stats
  getLatestNetworkStats(): Promise<NetworkStats | undefined>;
  updateNetworkStats(stats: InsertNetworkStats): Promise<NetworkStats>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private peers: Map<string, Peer>;
  private trainingRounds: Map<number, TrainingRound>;
  private networkActivity: NetworkActivity[];
  private networkStats: NetworkStats | undefined;
  private currentUserId: number;
  private currentPeerId: number;
  private currentTrainingRoundId: number;
  private currentActivityId: number;
  private currentStatsId: number;

  constructor() {
    this.users = new Map();
    this.peers = new Map();
    this.trainingRounds = new Map();
    this.networkActivity = [];
    this.networkStats = undefined;
    this.currentUserId = 1;
    this.currentPeerId = 1;
    this.currentTrainingRoundId = 1;
    this.currentActivityId = 1;
    this.currentStatsId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAllPeers(): Promise<Peer[]> {
    return Array.from(this.peers.values());
  }

  async getConnectedPeers(): Promise<Peer[]> {
    return Array.from(this.peers.values()).filter(peer => peer.isConnected);
  }

  async getPeer(peerId: string): Promise<Peer | undefined> {
    return this.peers.get(peerId);
  }

  async upsertPeer(insertPeer: InsertPeer): Promise<Peer> {
    const existingPeer = this.peers.get(insertPeer.peerId);
    
    if (existingPeer) {
      // Update existing peer
      const updatedPeer: Peer = {
        ...existingPeer,
        ...insertPeer,
        lastSeen: insertPeer.lastSeen || new Date(),
      };
      this.peers.set(insertPeer.peerId, updatedPeer);
      return updatedPeer;
    } else {
      // Create new peer
      const id = this.currentPeerId++;
      const peer: Peer = {
        id,
        ...insertPeer,
        lastSeen: insertPeer.lastSeen || new Date(),
      };
      this.peers.set(insertPeer.peerId, peer);
      return peer;
    }
  }

  async updatePeerConnection(peerId: string, isConnected: boolean): Promise<void> {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.isConnected = isConnected;
      peer.lastSeen = new Date();
      this.peers.set(peerId, peer);
    }
  }

  async getTrainingRound(id: number): Promise<TrainingRound | undefined> {
    return this.trainingRounds.get(id);
  }

  async getLatestTrainingRound(): Promise<TrainingRound | undefined> {
    const rounds = Array.from(this.trainingRounds.values());
    return rounds.sort((a, b) => b.id - a.id)[0];
  }

  async getRecentTrainingRounds(limit: number): Promise<TrainingRound[]> {
    const rounds = Array.from(this.trainingRounds.values());
    return rounds
      .sort((a, b) => b.id - a.id)
      .slice(0, limit);
  }

  async createTrainingRound(insertRound: InsertTrainingRound): Promise<TrainingRound> {
    const id = this.currentTrainingRoundId++;
    const round: TrainingRound = {
      id,
      ...insertRound,
      startTime: insertRound.startTime || new Date(),
    };
    this.trainingRounds.set(id, round);
    return round;
  }

  async updateTrainingRound(id: number, updates: Partial<TrainingRound>): Promise<void> {
    const round = this.trainingRounds.get(id);
    if (round) {
      const updatedRound = { ...round, ...updates };
      this.trainingRounds.set(id, updatedRound);
    }
  }

  async getRecentNetworkActivity(limit: number): Promise<NetworkActivity[]> {
    return this.networkActivity
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
      .slice(0, limit);
  }

  async createNetworkActivity(insertActivity: InsertNetworkActivity): Promise<NetworkActivity> {
    const id = this.currentActivityId++;
    const activity: NetworkActivity = {
      id,
      ...insertActivity,
      timestamp: insertActivity.timestamp || new Date(),
    };
    this.networkActivity.push(activity);
    
    // Keep only the latest 1000 activities to prevent memory issues
    if (this.networkActivity.length > 1000) {
      this.networkActivity = this.networkActivity.slice(-1000);
    }
    
    return activity;
  }

  async getLatestNetworkStats(): Promise<NetworkStats | undefined> {
    return this.networkStats;
  }

  async updateNetworkStats(insertStats: InsertNetworkStats): Promise<NetworkStats> {
    const id = this.currentStatsId++;
    const stats: NetworkStats = {
      id,
      ...insertStats,
      lastUpdated: insertStats.lastUpdated || new Date(),
    };
    this.networkStats = stats;
    return stats;
  }
}

export const storage = new MemStorage();
    