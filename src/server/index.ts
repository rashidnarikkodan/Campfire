import express, { Express } from "express";
import { createServer, Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

import { registerRoomHandlers, handleDisconnect, getStats } from "./roomManager.js";
import { registerChatHandlers } from "./chatHandler.js";
import { registerSignalHandlers } from "./signalHandler.js";
import { registerModerationHandlers } from "./moderationManager.js";
import { checkIpRateLimit, registerIpConnection, unregisterIpConnection } from "./rateLimiter.js";
import { logInfo, logWarn } from "./logger.js";
import { getMetricsSnapshot, incrementMetric } from "./metrics.js";

dotenv.config();

export interface ServerOptions {
  port?: number;
  corsOrigin?: string | string[];
}

export interface CampfireServerInstance {
  app: Express;
  httpServer: HttpServer;
  io: SocketIOServer;
  listen: (portOverride?: number) => Promise<number>;
  close: () => Promise<void>;
}

export function createCampfireServer(options: ServerOptions = {}): CampfireServerInstance {
  const app = express();

  // Configure CORS allowing Vercel deployment, localhost, or explicit env CORS_ORIGIN
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
    : "*";

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
    })
  );
  app.use(express.json({ limit: "10kb" }));

  // Root endpoint & health checks
  app.get("/", (_req, res) => {
    res.json({
      name: "Campfire Server",
      status: "online",
      version: "1.0.0",
      stats: getStats(),
    });
  });

  app.get("/health", (_req, res) => {
    const stats = getStats();
    res.json({
      status: "ok",
      uptime: process.uptime(),
      ...stats,
    });
  });

  app.get("/api/stats", (_req, res) => {
    res.json(getStats());
  });

  app.get("/api/metrics", (_req, res) => {
    const stats = getStats();
    res.json(getMetricsSnapshot(stats.activeRooms, stats.activePeers));
  });

  const httpServer = createServer(app);

  // Slowloris & request timeout protection
  httpServer.headersTimeout = 10000;
  httpServer.requestTimeout = 15000;

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["polling", "websocket"],
    pingTimeout: 20000,
    pingInterval: 10000,
    maxHttpBufferSize: 64 * 1024, // 64 KB max per WS payload
  });

  // Socket connection authentication & IP rate limit middleware
  io.use((socket, nextMiddleware) => {
    const clientIp =
      (socket.handshake.headers["x-forwarded-for"] as string)
        ?.split(",")[0]
        ?.trim() || socket.handshake.address;

    // 1. IP connection attempt rate limit (max 15 attempts per 60 seconds)
    if (!checkIpRateLimit(clientIp, "connection", { maxEvents: 15, windowMs: 60000 })) {
      logWarn("WebSocket connection rejected: IP rate limit exceeded", {
        clientIp,
        socketId: socket.id,
      });
      return nextMiddleware(new Error("Connection rate limit exceeded. Please try again later."));
    }

    // 2. Active simultaneous connections per IP limit (max 10)
    if (!registerIpConnection(clientIp)) {
      logWarn("WebSocket connection rejected: Max IP connections reached", {
        clientIp,
        socketId: socket.id,
      });
      return nextMiddleware(new Error("Maximum active connections reached for this IP."));
    }

    socket.data.clientIp = clientIp;
    nextMiddleware();
  });

  io.on("connection", (socket) => {
    incrementMetric.wsConnections();
    logInfo("WebSocket connection established", {
      socketId: socket.id,
      clientIp: socket.data.clientIp,
    });

    registerRoomHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerSignalHandlers(io, socket);
    registerModerationHandlers(io, socket);

    socket.on("disconnect", (reason) => {
      incrementMetric.wsDisconnects();
      logInfo("WebSocket connection closed", { socketId: socket.id, reason });

      if (socket.data.clientIp) {
        unregisterIpConnection(socket.data.clientIp);
      }
      handleDisconnect(io, socket);
    });
  });

  const listen = (portOverride?: number): Promise<number> => {
    const targetPort = portOverride ?? options.port ?? parseInt(process.env.PORT || "3000", 10);
    return new Promise((resolve, reject) => {
      httpServer
        .listen(targetPort, () => {
          const addr = httpServer.address();
          const actualPort = typeof addr === "object" && addr ? addr.port : targetPort;
          logInfo(`🔥 Campfire server running on port ${actualPort}`);
          resolve(actualPort);
        })
        .on("error", reject);
    });
  };

  const close = (): Promise<void> => {
    return new Promise((resolve) => {
      io.emit("server:shutdown", { message: "Server is restarting. Please reconnect shortly." });
      io.close(() => {
        httpServer.close(() => {
          resolve();
        });
      });
    });
  };

  return {
    app,
    httpServer,
    io,
    listen,
    close,
  };
}
