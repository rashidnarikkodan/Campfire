import test from "node:test";
import assert from "node:assert/strict";
import { createServer, Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import { registerRoomHandlers, resetRoomsForTesting, handleDisconnect, rooms } from "../src/server/roomManager";
import { registerChatHandlers } from "../src/server/chatHandler";
import { registerSignalHandlers } from "../src/server/signalHandler";
import { registerModerationHandlers, resetModerationForTesting } from "../src/server/moderationManager";
import { resetRateLimitsForTesting } from "../src/server/rateLimiter";
import { resetSessionsForTesting } from "../src/server/sessionManager";

function createTestServer(): Promise<{
  httpServer: HttpServer;
  io: SocketIOServer;
  port: number;
}> {
  return new Promise((resolve) => {
    const httpServer = createServer();
    const io = new SocketIOServer(httpServer, {
      cors: { origin: "*" },
      maxHttpBufferSize: 64 * 1024,
    });

    io.on("connection", (socket) => {
      registerRoomHandlers(io, socket);
      registerChatHandlers(io, socket);
      registerSignalHandlers(io, socket);
      registerModerationHandlers(io, socket);

      socket.on("disconnect", () => {
        handleDisconnect(io, socket);
      });
    });

    httpServer.listen(0, () => {
      const addr = httpServer.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ httpServer, io, port });
    });
  });
}

function createClient(port: number): ClientSocket {
  return ioc(`http://localhost:${port}`, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
}

test.beforeEach(() => {
  resetRoomsForTesting();
  resetRateLimitsForTesting();
  resetSessionsForTesting();
  resetModerationForTesting();
});

test("Phase 8 Performance - Progressive Load & Latency Audit", async () => {
  const { httpServer, io, port } = await createTestServer();

  try {
    const participantCounts = [2, 5, 8];

    for (const count of participantCounts) {
      const roomId = `perf-room-${count}`;
      const clients: ClientSocket[] = [];

      const startTime = performance.now();

      // Measure connection establishment & room join time
      for (let i = 0; i < count; i++) {
        const client = createClient(port);
        clients.push(client);
        await new Promise<void>((resolve) => {
          client.emit("room:join", { roomId, displayName: `PerfUser_${i}` });
          client.once("room:joined", () => resolve());
        });
      }

      const connectionEstablishmentTimeMs = (performance.now() - startTime) / count;

      // Measure chat broadcast latency (Round-trip)
      const sender = clients[0];
      const recipient = clients[1];

      const sendTime = performance.now();
      const latencyPromise = new Promise<number>((resolve) => {
        recipient.once("chat:message", () => {
          resolve(performance.now() - sendTime);
        });
      });

      sender.emit("chat:send", { roomId, text: "Benchmark message" });
      const messageLatencyMs = await latencyPromise;

      // Measure signaling latency (Offer -> Answer routing)
      const signalTime = performance.now();
      const signalPromise = new Promise<number>((resolve) => {
        recipient.once("signal:offer", () => {
          resolve(performance.now() - signalTime);
        });
      });

      sender.emit("signal:offer", {
        targetSocketId: recipient.id,
        sdp: { type: "offer", sdp: "v=0\r\n" },
      });
      const signalingLatencyMs = await signalPromise;

      const memUsageMB = process.memoryUsage().heapUsed / (1024 * 1024);

      console.log(`[Perf Metrics N=${count}]`);
      console.log(`  - Avg Connection Time: ${connectionEstablishmentTimeMs.toFixed(2)} ms`);
      console.log(`  - Message Broadcast Latency: ${messageLatencyMs.toFixed(2)} ms`);
      console.log(`  - WebRTC Signaling Latency: ${signalingLatencyMs.toFixed(2)} ms`);
      console.log(`  - Heap Usage: ${memUsageMB.toFixed(2)} MB`);

      assert.ok(connectionEstablishmentTimeMs < 100, "Connection establishment should be fast");
      assert.ok(messageLatencyMs < 50, "Chat message latency should be under 50ms on localhost");
      assert.ok(signalingLatencyMs < 50, "Signaling latency should be under 50ms on localhost");

      clients.forEach((c) => c.disconnect());
      await new Promise((r) => setTimeout(r, 50));
    }
  } finally {
    io.close();
    httpServer.close();
  }
});
