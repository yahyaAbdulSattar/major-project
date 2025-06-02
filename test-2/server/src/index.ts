import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { registerRoutes } from "./routes";
import { getP2PNetwork } from "./p2p";
import { getFLCoordinator } from "./ml";

// Load environment variables
dotenv.config();

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration for client connections
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(`[${new Date().toLocaleTimeString()}] ${logLine}`);
    }
  });

  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

(async () => {
  try {
    // Register API routes and setup WebSocket
    const server = await registerRoutes(app);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error(`[ERROR] ${status}: ${message}`);
      res.status(status).json({ error: message });
    });

    // Initialize P2P network and ML coordinator
    try {
      const p2pNetwork = getP2PNetwork();
      const flCoordinator = getFLCoordinator();
      
      // Auto-start P2P network
      await p2pNetwork.start();
      console.log(`[INFO] P2P network started successfully`);
      
      // Initialize ML model
      await flCoordinator.initializeModel();
      console.log(`[INFO] ML model initialized successfully`);
      
    } catch (error) {
      console.error(`[ERROR] Failed to initialize P2P network or ML model:`, error);
    }

    // Start the server
    const port = process.env.PORT || 3001;
    server.listen(port, "0.0.0.0", () => {
      console.log(`[INFO] 🚀 P2P Federated Learning Server running on port ${port}`);
      console.log(`[INFO] 🌐 API available at http://localhost:${port}/api`);
      console.log(`[INFO] 🔗 WebSocket available at http://localhost:${port}`);
      console.log(`[INFO] 💡 Health check: http://localhost:${port}/health`);
    });

  } catch (error) {
    console.error(`[FATAL] Failed to start server:`, error);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[INFO] Received SIGTERM, shutting down gracefully...');
  try {
    const p2pNetwork = getP2PNetwork();
    await p2pNetwork.stop();
    console.log('[INFO] P2P network stopped');
  } catch (error) {
    console.error('[ERROR] Error during shutdown:', error);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[INFO] Received SIGINT, shutting down gracefully...');
  try {
    const p2pNetwork = getP2PNetwork();
    await p2pNetwork.stop();
    console.log('[INFO] P2P network stopped');
  } catch (error) {
    console.error('[ERROR] Error during shutdown:', error);
  }
  process.exit(0);
});