import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});
export const peers = pgTable("peers", {
  id: serial("id").primaryKey(),
  peerId: text("peer_id").notNull().unique(),
  multiaddr: text("multiaddr").notNull(),
  isConnected: boolean("is_connected").default(false),
  lastSeen: timestamp("last_seen").defaultNow(),
  location: text("location"),
  contribution: real("contribution").default(0),
  nodeInfo: jsonb("node_info"),
});
export const trainingRounds = pgTable("training_rounds", {
  id: serial("id").primaryKey(),
  roundNumber: integer("round_number").notNull(),
  modelAccuracy: real("model_accuracy"),
  loss: real("loss"),
  participatingPeers: integer("participating_peers"),
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  modelParameters: jsonb("model_parameters"),
  status: text("status").notNull().default("pending"), // pending, training, completed, failed
});
export const networkActivity = pgTable("network_activity", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // peer_joined, peer_left, training_started, training_completed, etc.
  peerId: text("peer_id"),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata"),
});
export const networkStats = pgTable("network_stats", {
  id: serial("id").primaryKey(),
  connectedPeers: integer("connected_peers").default(0),
  averageLatency: real("average_latency").default(0),
  throughput: real("throughput").default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});
export const insertPeerSchema = createInsertSchema(peers).omit({
  id: true,
});
export const insertTrainingRoundSchema = createInsertSchema(trainingRounds).omit({
  id: true,
});
export const insertNetworkActivitySchema = createInsertSchema(networkActivity).omit({
  id: true,
});
export const insertNetworkStatsSchema = createInsertSchema(networkStats).omit({
  id: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertPeer = z.infer<typeof insertPeerSchema>;
export type Peer = typeof peers.$inferSelect;
export type InsertTrainingRound = z.infer<typeof insertTrainingRoundSchema>;
export type TrainingRound = typeof trainingRounds.$inferSelect;
export type InsertNetworkActivity = z.infer<typeof insertNetworkActivitySchema>;
export type NetworkActivity = typeof networkActivity.$inferSelect;
export type InsertNetworkStats = z.infer<typeof insertNetworkStatsSchema>;
export type NetworkStats = typeof networkStats.$inferSelect;