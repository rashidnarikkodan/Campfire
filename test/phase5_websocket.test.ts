import test from "node:test";
import assert from "node:assert/strict";
import { createServer, Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import { registerRoomHandlers, resetRoomsForTesting, handleDisconnect } from "../src/server/roomManager";
import { registerChatHandlers } from "../src/server/chatHandler";
import { registerSignalHandlers } from "../src/server/signalHandler";
import { resetRateLimitsForTesting } from "../src/server/rateLimiter";
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
    });

    io.on("connection", (socket) => {
      registerRoomHandlers(io, socket);
      registerChatHandlers(io, socket);
      registerSignalHandlers(io, socket);

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
  });
}

test.beforeEach(() => {
  resetRoomsForTesting();
  resetRateLimitsForTesting();
  resetSessionsForTesting();
});

test("Phase 5 WebSocket - 1. Valid Join", async () => {
  const { httpServer, io, port } = await createTestServer();
  const client = createClient(port);

  try {
    const joinPromise = new Promise<any>((resolve) => {
      client.once("room:joined", (data) => resolve(data));
    });

    client.emit("room:join", { roomId: "valid-room-1", displayName: "Alice" });
    const joinedData = await joinPromise;

    assert.equal(joinedData.roomId, "valid-room-1");
    assert.equal(joinedData.peerInfo.displayName, "Alice");
    assert.ok(typeof joinedData.sessionId === "string" && joinedData.sessionId.length > 0);
  } finally {
    client.disconnect();
    io.close();
    httpServer.close();
  }
});

test("Phase 5 WebSocket - 2. Invalid Join (Room Full)", async () => {
  const { httpServer, io, port } = await createTestServer();
  const clients: ClientSocket[] = [];
  const roomId = "full-room-test";

  try {
    // Fill room to MAX_ROOM_SIZE (8)
    for (let i = 0; i < MAX_ROOM_SIZE; i++) {
      const c = createClient(port);
      clients.push(c);
      await new Promise<void>((resolve) => {
        c.emit("room:join", { roomId, displayName: `Peer_${i}` });
        c.once("room:joined", () => resolve());
      });
    }

    // Attempt 9th join
    const overflowClient = createClient(port);
    clients.push(overflowClient);

    const roomFullPromise = new Promise<any>((resolve) => {
      overflowClient.once("room:full", (data) => resolve(data));
    });

    overflowClient.emit("room:join", { roomId, displayName: "Overflow" });
    const fullData = await roomFullPromise;

    assert.equal(fullData.roomId, roomId);
  } finally {
    clients.forEach((c) => c.disconnect());
    io.close();
    httpServer.close();
  }
});

test("Phase 5 WebSocket - 3. Unauthorized Signaling", async () => {
  const { httpServer, io, port } = await createTestServer();
  const clientA = createClient(port);
  const clientB = createClient(port);

  try {
    // Client A in Room 1, Client B in Room 2
    await new Promise<void>((r) => { clientA.emit("room:join", { roomId: "room-A", displayName: "A" }); clientA.once("room:joined", () => r()); });
    await new Promise<void>((r) => { clientB.emit("room:join", { roomId: "room-B", displayName: "B" }); clientB.once("room:joined", () => r()); });

    const errPromise = new Promise<any>((resolve) => {
      clientA.once("signal:error", (data) => resolve(data));
    });

    clientA.emit("signal:offer", {
      targetSocketId: clientB.id,
      sdp: { type: "offer", sdp: "v=0\r\n" },
    });

    const err = await errPromise;
    assert.equal(err.code, "UNAUTHORIZED_SIGNAL");
  } finally {
    clientA.disconnect();
    clientB.disconnect();
    io.close();
    httpServer.close();
  }
});

test("Phase 5 WebSocket - 4. Disconnect & 5. Reconnect", async () => {
  const { httpServer, io, port } = await createTestServer();
  const clientA = createClient(port);
  let sessionId = "";
  const roomId = "reconnect-room";

  try {
    // Client A joins room
    await new Promise<void>((r) => {
      clientA.emit("room:join", { roomId, displayName: "Reconnector" });
      clientA.once("room:joined", (data: any) => {
        sessionId = data.sessionId;
        r();
      });
    });

    // Client B joins room to observe presence events
    const clientB = createClient(port);
    await new Promise<void>((r) => {
      clientB.emit("room:join", { roomId, displayName: "Observer" });
      clientB.once("room:joined", () => r());
    });

    // 4. Test Disconnect: Disconnect clientA
    const presencePromise = new Promise<any>((resolve) => {
      clientB.once("room:peer-presence", (data) => resolve(data));
    });

    clientA.disconnect();
    const presence = await presencePromise;
    assert.equal(presence.presenceState, "RECONNECTING");

    // 5. Test Reconnect: Connect new socket clientA2 with same sessionId
    const clientA2 = createClient(port);
    const rejoinPromise = new Promise<any>((resolve) => {
      clientA2.once("room:joined", (data) => resolve(data));
    });

    clientA2.emit("room:join", { roomId, sessionId, displayName: "Reconnector" });
    const rejoined = await rejoinPromise;

    assert.equal(rejoined.sessionId, sessionId);
    assert.equal(rejoined.peerInfo.displayName, "Reconnector");

    clientB.disconnect();
    clientA2.disconnect();
  } finally {
    io.close();
    httpServer.close();
  }
});

test("Phase 5 WebSocket - 6. Malformed Payload", async () => {
  const { httpServer, io, port } = await createTestServer();
  const client = createClient(port);

  try {
    await new Promise<void>((r) => {
      client.emit("room:join", { roomId: "malformed-test-room", displayName: "Tester" });
      client.once("room:joined", () => r());
    });

    const errorPromise = new Promise<any>((resolve) => {
      client.once("chat:error", (data) => resolve(data));
    });

    // Emit non-object payload
    client.emit("chat:send", 12345);

    const err = await errorPromise;
    assert.equal(err.code, "INVALID_PAYLOAD");
  } finally {
    client.disconnect();
    io.close();
    httpServer.close();
  }
});

test("Phase 5 WebSocket - 7. Rate Limit", async () => {
  const { httpServer, io, port } = await createTestServer();
  const client = createClient(port);

  try {
    await new Promise<void>((r) => {
      client.emit("room:join", { roomId: "ratelimit-room", displayName: "Spammer" });
      client.once("room:joined", () => r());
    });

    let rateLimitedError: any = null;
    client.on("chat:error", (data) => {
      if (data.code === "RATE_LIMITED") {
        rateLimitedError = data;
      }
    });

    // Flood chat messages (burst limit is 3 per 2000ms)
    for (let i = 0; i < 6; i++) {
      client.emit("chat:send", { roomId: "ratelimit-room", text: `Flood message ${i}` });
    }

    await new Promise((r) => setTimeout(r, 150));

    assert.ok(rateLimitedError !== null);
    assert.equal(rateLimitedError.code, "RATE_LIMITED");
  } finally {
    client.disconnect();
    io.close();
    httpServer.close();
  }
});

test("Phase 5 WebSocket - 8. Duplicate Connection Handling", async () => {
  const { httpServer, io, port } = await createTestServer();
  const clientA1 = createClient(port);
  let sessionId = "";
  const roomId = "duplicate-conn-room";

  try {
    await new Promise<void>((r) => {
      clientA1.emit("room:join", { roomId, displayName: "SingleSessionUser" });
      clientA1.once("room:joined", (data: any) => {
        sessionId = data.sessionId;
        r();
      });
    });

    const replacedPromise = new Promise<any>((resolve) => {
      clientA1.once("room:replaced", (data) => resolve(data));
    });

    // Open second socket with same sessionId in same room
    const clientA2 = createClient(port);
    await new Promise<void>((r) => {
      clientA2.emit("room:join", { roomId, sessionId, displayName: "SingleSessionUser" });
      clientA2.once("room:joined", () => r());
    });

    const replacedMsg = await replacedPromise;
    assert.ok(replacedMsg.reason.includes("another tab or device"));

    clientA2.disconnect();
  } finally {
    clientA1.disconnect();
    io.close();
    httpServer.close();
  }
});
