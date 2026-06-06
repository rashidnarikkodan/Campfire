import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import next from "next";

import { registerRoomHandlers, handleDisconnect } from "./src/server/roomManager";
import { registerChatHandlers } from "./src/server/chatHandler";
import { registerSignalHandlers } from "./src/server/signalHandler";
import { registerModerationHandlers } from "./src/server/moderationManager";

dotenv.config();

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  const httpServer = createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`[connect] ${socket.id}`);

    registerRoomHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerSignalHandlers(io, socket);
    registerModerationHandlers(io, socket);

    socket.on("disconnect", (reason) => {
      console.log(`[disconnect] ${socket.id} — ${reason}`);
      handleDisconnect(socket);
    });
  });

  // Delegate all other HTTP requests to Next.js
  app.all("*", (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(port, () => {
    console.log(`🔥 Internet Campfire running at http://localhost:${port}`);
  });
}).catch((err) => {
  console.error("Error starting server:", err);
  process.exit(1);
});
