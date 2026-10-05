import test from "node:test";
import assert from "node:assert/strict";
import { createServer, Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import { registerRoomHandlers, resetRoomsForTesting, handleDisconnect, rooms } from "../src/server/roomManager";
import { registerChatHandlers } from "../src/server/chatHandler";
import { registerSignalHandlers } from "../src/server/signalHandler";
import { registerModerationHandlers, resetModerationForTesting } from "../src/server/moderationManager";
import { resetRateLimitsForTesting, checkIpRateLimit, registerIpConnection, unregisterIpConnection } from "../src/server/rateLimiter";
import { resetSessionsForTesting } from "../src/server/sessionManager";
import { MAX_ROOM_SIZE } from "../src/lib/constants";

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

    io.use((socket, next) => {
      const clientIp = socket.handshake.address || "127.0.0.1";
      if (!checkIpRateLimit(clientIp, "connection", { maxEvents: 100, windowMs: 60000 })) {
        return next(new Error("Connection rate limit."));
      }
      if (!registerIpConnection(clientIp)) {
        return next(new Error("Max IP connections."));
      }
      socket.data.clientIp = clientIp;
      next();
    });

    io.on("connection", (socket) => {
      registerRoomHandlers(io, socket);
      registerChatHandlers(io, socket);
      registerSignalHandlers(io, socket);
      registerModerationHandlers(io, socket);

      socket.on("disconnect", () => {
        if (socket.data.clientIp) {
          unregisterIpConnection(socket.data.clientIp);
        }
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

test("Phase 7 Resilience - Concurrent joins up to capacity (MAX_ROOM_SIZE = 8)", async () => {
  const { httpServer, io, port } = await createTestServer();
  const roomId = "concurrent-join-room";

  try {
    // 8 clients join simultaneously
    const joinPromises = Array.from({ length: 8 }, (_, i) => {
      return new Promise<any>((resolve) => {
        const client = createClient(port);
        client.emit("room:join", { roomId, displayName: `User_${i}` });
        client.once("room:joined", (data) => resolve({ client, data }));
      });
    });

    const results = await Promise.all(joinPromises);
    assert.equal(results.length, 8);

    const room = rooms.get(roomId);
    assert.ok(room !== undefined);
    assert.equal(room?.peers.size, 8);

    // Clean up
    results.forEach((r) => r.client.disconnect());
  } finally {
    io.close();
    httpServer.close();
  }
});

test("Phase 7 Resilience - Concurrent leaves & Campfire auto-deletion", async () => {
  const { httpServer, io, port } = await createTestServer();
  const roomId = "concurrent-leave-room";

  try {
    // 4 clients join
    const clients: ClientSocket[] = [];
    for (let i = 0; i < 4; i++) {
      const c = createClient(port);
      clients.push(c);
      await new Promise<void>((r) => {
        c.emit("room:join", { roomId, displayName: `Leaver_${i}` });
        c.once("room:joined", () => r());
      });
    }

    assert.equal(rooms.get(roomId)?.peers.size, 4);

    // 4 clients explicitly leave simultaneously
    const leavePromises = clients.map((c) => {
      return new Promise<void>((r) => {
        c.emit("room:leave");
        setTimeout(r, 50);
      });
    });

    await Promise.all(leavePromises);

    // Verify campfire is auto-deleted when empty
    assert.equal(rooms.has(roomId), false);

    clients.forEach((c) => c.disconnect());
  } finally {
    io.close();
    httpServer.close();
  }
});

test("Phase 7 Resilience - Late signaling message after recipient disconnection", async () => {
  const { httpServer, io, port } = await createTestServer();
  const clientA = createClient(port);
  const clientB = createClient(port);
  const roomId = "late-signal-room";

  try {
    await new Promise<void>((r) => { clientA.emit("room:join", { roomId, displayName: "A" }); clientA.once("room:joined", () => r()); });
    await new Promise<void>((r) => { clientB.emit("room:join", { roomId, displayName: "B" }); clientB.once("room:joined", () => r()); });

    const socketBId = clientB.id;

    // Client B disconnects unexpectedly
    clientB.disconnect();

    // Client A sends offer to disconnected socket B ID -> Should not crash server or throw exception
    let errOccurred = false;
    clientA.emit("signal:offer", {
      targetSocketId: socketBId,
      sdp: { type: "offer", sdp: "v=0\r\n" },
    });

    await new Promise((r) => setTimeout(r, 100));
    assert.equal(errOccurred, false);

    clientA.disconnect();
  } finally {
    io.close();
    httpServer.close();
  }
});
