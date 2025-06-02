import { createLibp2p } from "libp2p";
import { tcp } from "@libp2p/tcp";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { mdns } from "@libp2p/mdns";
import { kadDHT } from "@libp2p/kad-dht";
import { identify } from "@libp2p/identify";
import { ping } from "@libp2p/ping";
import { bootstrap } from "@libp2p/bootstrap";
import { multiaddr } from "@multiformats/multiaddr";
import { createEd25519PeerId } from "@libp2p/peer-id-factory";
import type { Libp2p } from "libp2p";
import type { PeerId } from "@libp2p/interface";
import { EventEmitter } from "events";
import { storage } from "./storage";

export interface P2PNetworkConfig {
  port?: number;
  bootstrapPeers?: string[];
  enableMdns?: boolean;
}

export class P2PNetwork extends EventEmitter {
  private node: Libp2p | null = null;
  private config: P2PNetworkConfig;
  private connectedPeers: Set<string> = new Set();
  private messageHandlers: Map<string, (data: any, peerId: string) => void> =
    new Map();
  private discoveredPeers: Set<string> = new Set();

  constructor(config: P2PNetworkConfig = {}) {
    super();
    this.config = {
      port: parseInt(process.env.P2P_PORT || "9000"),
      enableMdns: process.env.P2P_ENABLE_MDNS !== "false",
      bootstrapPeers:
        process.env.P2P_BOOTSTRAP_PEERS?.split(",").filter(Boolean) || [],
      ...config,
    };
  }

  async start(): Promise<void> {
    try {
      const peerId = await createEd25519PeerId();

      this.node = await createLibp2p({
        addresses: {
          listen: [
            `/ip4/0.0.0.0/tcp/${this.config.port}`,
          ],
        },
        transports: [tcp()],
        connectionEncrypters: [noise()],
        streamMuxers: [yamux()],
        connectionManager: {
          maxConnections: 100,
        },
        peerDiscovery: [
          ...(this.config.enableMdns
            ? [
                mdns({
                  interval: 10000,
                  serviceTag: "p2p-fl-network",
                }),
              ]
            : []),
          ...(this.config.bootstrapPeers &&
          this.config.bootstrapPeers.length > 0
            ? [
                bootstrap({
                  list: this.config.bootstrapPeers,
                }),
              ]
            : []),
        ],
        services: {
          dht: kadDHT(),
          identify: identify(),
          ping: ping(),
        },
      });

      // Set up event listeners
      this.setupEventListeners();

      await this.node.start();

      console.log(`P2P node started with ID: ${this.node.peerId.toString()}`);
      console.log(
        `Listening on: ${this.node
          .getMultiaddrs()
          .map((ma) => ma.toString())
          .join(", ")}`,
      );

      // Store own peer info
      await this.storePeerInfo(
        this.node.peerId.toString(),
        this.node.getMultiaddrs()[0]?.toString() || "",
      );

      this.emit("nodeStarted", {
        peerId: this.node.peerId.toString(),
        multiaddrs: this.node.getMultiaddrs().map((ma) => ma.toString()),
      });

      // Start periodic connection attempts
      this.startConnectionRetry();
    } catch (error) {
      console.error("Failed to start P2P node:", error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.node) return;

    // Handle peer discovery
    this.node.addEventListener("peer:discovery", async (evt) => {
      const peer = evt.detail;
      const peerId = peer.id.toString();
      const multiaddrs = peer.multiaddrs || [];

      console.log(
        `Discovered peer: ${peerId.slice(0, 12)}... with ${multiaddrs.length} addresses`,
      );
      multiaddrs.forEach((addr: any) =>
        console.log(`  Address: ${addr.toString()}`),
      );

      this.discoveredPeers.add(peerId);
      this.emit("peerDiscovered", { peerId });

      // Try immediate connection with discovered addresses
      if (multiaddrs.length > 0) {
        for (const addr of multiaddrs) {
          try {
            const addrString = addr.toString();
            const fullAddr = `${addrString}/p2p/${peerId}`;

            console.log(`Trying immediate connection to: ${fullAddr}`);
            await this.node?.dial(multiaddr(fullAddr));
            console.log(`Successfully connected via discovery!`);
            return; // Exit after successful connection
          } catch (err: any) {
            console.log(`Connection attempt failed: ${err.message}`);
          }
        }
      }
    });

    // Handle peer connections
    this.node.addEventListener("peer:connect", async (evt) => {
      const peerId = evt.detail.toString();
      this.connectedPeers.add(peerId);

      console.log(`✅ Connected to peer: ${peerId.slice(0, 12)}...`);

      // Store peer connection info
      await this.storePeerInfo(peerId, "", true);

      this.emit("peerConnected", { peerId });
      await this.logNetworkActivity(
        "peer_joined",
        peerId,
        `Peer ${peerId.slice(0, 12)}... joined the network`,
      );
      await this.updateNetworkStats();
    });

    // Handle peer disconnections
    this.node.addEventListener("peer:disconnect", async (evt) => {
      const peerId = evt.detail.toString();
      this.connectedPeers.delete(peerId);

      console.log(`❌ Disconnected from peer: ${peerId.slice(0, 12)}...`);

      // Update peer connection status
      await storage.updatePeerConnection(peerId, false);

      this.emit("peerDisconnected", { peerId });
      await this.logNetworkActivity(
        "peer_left",
        peerId,
        `Peer ${peerId.slice(0, 12)}... left the network`,
      );
      await this.updateNetworkStats();
    });
  }

  private async attemptConnection(peerId: string): Promise<void> {
    if (!this.node) return;

    try {
      // Don't try to connect to ourselves
      if (peerId === this.node.peerId.toString()) {
        return;
      }

      // Don't try if already connected
      if (this.connectedPeers.has(peerId)) {
        return;
      }

      console.log(
        `🔄 Attempting to connect to peer: ${peerId.slice(0, 12)}...`,
      );

      // Try well-known addresses for local network
      const commonPorts = [9000, 9001, 9002];
      const localIPs = ["127.0.0.1", "192.168.0.132"];

      for (const ip of localIPs) {
        for (const port of commonPorts) {
          if (port === this.config.port) continue; // Skip our own port

          try {
            const addrString = `/ip4/${ip}/tcp/${port}/p2p/${peerId}`;

            console.log(`🎯 Trying address: ${addrString}`);
            await this.node.dial(multiaddr(addrString));
            console.log(`✅ Successfully connected via address scan!`);
            return;
          } catch (err: any) {
            // Silent fail for address scanning
          }
        }
      }
    } catch (error: any) {
      console.log(
        `⚠️  All connection attempts failed for ${peerId.slice(0, 12)}...: ${error.message}`,
      );
    }
  }

  private startConnectionRetry(): void {
    // Retry connections every 30 seconds
    setInterval(async () => {
      if (!this.node) return;

      const discoveredButNotConnected = Array.from(this.discoveredPeers).filter(
        (peerId) =>
          !this.connectedPeers.has(peerId) &&
          peerId !== this.node?.peerId.toString(),
      );

      if (discoveredButNotConnected.length > 0) {
        console.log(
          `🔄 Retrying connections to ${discoveredButNotConnected.length} discovered peers...`,
        );

        for (const peerId of discoveredButNotConnected) {
          await this.attemptConnection(peerId);
          // Small delay between connection attempts
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }, 30000);
  }

  async connectToPeer(multiaddrString: string): Promise<void> {
    if (!this.node) {
      throw new Error("Node not started");
    }

    try {
      console.log(`🎯 Manual connection attempt to: ${multiaddrString}`);
      await this.node.dial(multiaddr(multiaddrString));
      console.log(
        `✅ Successfully connected to peer via multiaddr: ${multiaddrString}`,
      );
    } catch (error: any) {
      console.error(
        `❌ Failed to connect to peer ${multiaddrString}: ${error.message}`,
      );
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.node) {
      await this.node.stop();
      this.node = null;
      this.connectedPeers.clear();
      this.discoveredPeers.clear();
      console.log("P2P node stopped");
    }
  }

  async broadcastMessage(protocol: string, data: any): Promise<void> {
    if (!this.node) {
      throw new Error("Node not started");
    }

    const message = JSON.stringify(data);
    const connections = this.node.getConnections();

    for (const connection of connections) {
      try {
        const stream = await connection.newStream([protocol]);
        const encoder = new TextEncoder();
        await stream.sink([encoder.encode(message)]);
        await stream.close();
      } catch (error) {
        console.error(
          `Failed to send message to ${connection.remotePeer}:`,
          error,
        );
      }
    }
  }

  async sendMessage(
    peerId: string,
    protocol: string,
    data: any,
  ): Promise<void> {
    if (!this.node) {
      throw new Error("Node not started");
    }

    try {
      const connection = this.node
        .getConnections()
        .find((conn) => conn.remotePeer.toString() === peerId);

      if (!connection) {
        throw new Error(`No connection to peer ${peerId}`);
      }

      const stream = await connection.newStream([protocol]);
      const message = JSON.stringify(data);
      const encoder = new TextEncoder();
      await stream.sink([encoder.encode(message)]);
      await stream.close();
    } catch (error) {
      console.error(`Failed to send message to ${peerId}:`, error);
      throw error;
    }
  }

  registerMessageHandler(
    protocol: string,
    handler: (data: any, peerId: string) => void,
  ): void {
    this.messageHandlers.set(protocol, handler);

    if (this.node) {
      this.node.handle([protocol], async ({ stream, connection }) => {
        try {
          const decoder = new TextDecoder();
          let data = "";

          for await (const chunk of stream.source) {
            data += decoder.decode(chunk.subarray());
          }

          const parsedData = JSON.parse(data);
          handler(parsedData, connection.remotePeer.toString());
        } catch (error) {
          console.error(
            `Error handling message for protocol ${protocol}:`,
            error,
          );
        }
      });
    }
  }

  getConnectedPeers(): string[] {
    return Array.from(this.connectedPeers);
  }

  getDiscoveredPeers(): string[] {
    return Array.from(this.discoveredPeers);
  }

  getNodeId(): string | null {
    return this.node?.peerId.toString() || null;
  }

  getMultiaddrs(): string[] {
    return this.node?.getMultiaddrs().map((ma) => ma.toString()) || [];
  }

  isStarted(): boolean {
    return this.node !== null;
  }

  getConnectionCount(): number {
    return this.node?.getConnections().length || 0;
  }

  private async storePeerInfo(
    peerId: string,
    multiaddr: string,
    isConnected: boolean = false,
  ): Promise<void> {
    try {
      await storage.upsertPeer({
        peerId,
        multiaddr,
        isConnected,
        lastSeen: new Date(),
        location: null,
        contribution: 0,
        nodeInfo: null,
      });
    } catch (error) {
      console.error("Failed to store peer info:", error);
    }
  }

  private async logNetworkActivity(
    type: string,
    peerId: string | null,
    message: string,
  ): Promise<void> {
    try {
      await storage.createNetworkActivity({
        type,
        peerId,
        message,
        timestamp: new Date(),
        metadata: null,
      });
    } catch (error) {
      console.error("Failed to log network activity:", error);
    }
  }

  private async updateNetworkStats(): Promise<void> {
    try {
      const connectedPeers = this.connectedPeers.size;
      // Calculate average latency (simplified)
      const averageLatency = Math.random() * 100 + 20; // Mock calculation
      const throughput = Math.random() * 5; // Mock calculation

      await storage.updateNetworkStats({
        connectedPeers,
        averageLatency,
        throughput,
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error("Failed to update network stats:", error);
    }
  }
}

let p2pNetwork: P2PNetwork | null = null;

export function getP2PNetwork(): P2PNetwork {
  if (!p2pNetwork) {
    p2pNetwork = new P2PNetwork();
  }
  return p2pNetwork;
}