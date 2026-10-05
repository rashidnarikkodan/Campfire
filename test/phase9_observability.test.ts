import test from "node:test";
import assert from "node:assert/strict";
import { createServer, Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import { registerRoomHandlers, resetRoomsForTesting, handleDisconnect, getStats } from "../src/server/roomManager";
import { registerChatHandlers } from "../src/server/chatHandler";
import { registerSignalHandlers } from "../src/server/signalHandler";
import { registerModerationHandlers, resetModerationForTesting } from "../src/server/moderationManager";
import { resetRateLimitsForTesting } from "../src/server/rateLimiter";
import { resetSessionsForTesting } from "../src/server/sessionManager";
import { getMetricsSnapshot, resetMetricsForTesting, incrementMetric } from "../src/server/metrics";

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
      incrementMetric.wsConnections();
      registerRoomHandlers(io, socket);
      registerChatHandlers(io, socket);
      registerSignalHandlers(io, socket);
      registerModerationHandlers(io, socket);

      socket.on("disconnect", () => {
        incrementMetric.wsDisconnects();
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
  resetMetricsForTesting();
});

test("Phase 9 Observability - Structured Metrics & Health Snapshot", async () => {
  const { httpServer, io, port } = await createTestServer();
  const clientA = createClient(port);
  const clientB = createClient(port);
  const roomId = "observability-room";

  try {
    // Connect & Join room
    let activeRoomId = "";
    await new Promise<void>((r) => {
      clientA.emit("room:join", { roomId, displayName: "Alice" });
      clientA.once("room:joined", (data: any) => {
        activeRoomId = data.roomId;
        r();
      });
    });
    await new Promise<void>((r) => {
      clientB.emit("room:join", { roomId: activeRoomId, displayName: "Bob" });
      clientB.once("room:joined", () => r());
    });

    // Send a message
    const msgPromise = new Promise<void>((r) => {
      clientB.once("chat:message", () => r());
    });

    clientA.emit("chat:send", { roomId: activeRoomId, text: "Observability test message" });
    await msgPromise;

    const stats = getStats();
    const snapshot = getMetricsSnapshot(stats.activeRooms, stats.activePeers);

    assert.equal(snapshot.activeCampfires, 1);
    assert.equal(snapshot.activeParticipants, 2);
    assert.equal(snapshot.counters.wsConnectionsTotal, 2);
    assert.equal(snapshot.counters.campfiresCreatedTotal, 1);
    assert.equal(snapshot.counters.messagesSentTotal, 1);
    assert.ok(typeof snapshot.system.memoryHeapUsedMB === "string");
    assert.ok(typeof snapshot.system.cpuUserMs === "number");

    clientA.disconnect();
    clientB.disconnect();
  } finally {
    io.close();
    httpServer.close();
  }
});
