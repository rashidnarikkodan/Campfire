import test from "node:test";
import assert from "node:assert/strict";
import { createServer, Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import { registerRoomHandlers, resetRoomsForTesting, handleDisconnect } from "../src/server/roomManager";
import { registerChatHandlers } from "../src/server/chatHandler";
import { registerSignalHandlers } from "../src/server/signalHandler";
import { registerModerationHandlers, resetModerationForTesting } from "../src/server/moderationManager";
import { resetRateLimitsForTesting, checkIpRateLimit, registerIpConnection, unregisterIpConnection } from "../src/server/rateLimiter";
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

    io.use((socket, next) => {
      const clientIp = socket.handshake.address || "127.0.0.1";
      if (!checkIpRateLimit(clientIp, "connection", { maxEvents: 15, windowMs: 60000 })) {
        return next(new Error("Connection rate limit exceeded."));
      }
      if (!registerIpConnection(clientIp)) {
        return next(new Error("Maximum active connections reached for this IP."));
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
  if (typeof resetModerationForTesting === "function") {
    resetModerationForTesting();
  }
});

test("Phase 6 Security - 1. Max connections per IP limit", async () => {
  const { httpServer, io, port } = await createTestServer();
  const clients: ClientSocket[] = [];

  try {
    // Open 10 connections (max allowed per IP)
    for (let i = 0; i < 10; i++) {
      const c = createClient(port);
      clients.push(c);
      await new Promise<void>((r) => c.on("connect", r));
    }

    // Attempt 11th connection from same IP -> Should be rejected
    const overflowClient = createClient(port);
    clients.push(overflowClient);

    const errPromise = new Promise<Error>((resolve) => {
      overflowClient.on("connect_error", (err) => resolve(err));
    });

    const err = await errPromise;
    assert.ok(err.message.includes("Maximum active connections reached"));
  } finally {
    clients.forEach((c) => c.disconnect());
    io.close();
    httpServer.close();
  }
});

test("Phase 6 Security - 2. Moderation Kick & Rejoin Cooldown", async () => {
  const { httpServer, io, port } = await createTestServer();
  const clientTarget = createClient(port);
  const reporter1 = createClient(port);
  const reporter2 = createClient(port);
  const reporter3 = createClient(port);
  const roomId = "mod-test-room";

  try {
    // Join room
    await new Promise<void>((r) => { clientTarget.emit("room:join", { roomId, displayName: "Troublemaker" }); clientTarget.once("room:joined", () => r()); });
    await new Promise<void>((r) => { reporter1.emit("room:join", { roomId, displayName: "Rep1" }); reporter1.once("room:joined", () => r()); });
    await new Promise<void>((r) => { reporter2.emit("room:join", { roomId, displayName: "Rep2" }); reporter2.once("room:joined", () => r()); });
    await new Promise<void>((r) => { reporter3.emit("room:join", { roomId, displayName: "Rep3" }); reporter3.once("room:joined", () => r()); });

    const targetSocketId = clientTarget.id;
    const kickedPromise = new Promise<any>((resolve) => {
      clientTarget.once("mod:kicked", (data) => resolve(data));
    });

    // 3 reports trigger community kick
    reporter1.emit("mod:report", { targetSocketId });
    reporter2.emit("mod:report", { targetSocketId });
    reporter3.emit("mod:report", { targetSocketId });

    const kickData = await kickedPromise;
    assert.ok(kickData.reason.includes("removed by the community"));

    // Attempt immediate rejoin from same IP/device -> Should be blocked by cooldown
    const clientRejoin = createClient(port);
    await new Promise<void>((r) => clientRejoin.on("connect", r));

    const cooldownPromise = new Promise<any>((resolve) => {
      clientRejoin.once("mod:cooldown", (data) => resolve(data));
    });

    clientRejoin.emit("room:join", { roomId, displayName: "Troublemaker" });
    const cooldownData = await cooldownPromise;
    assert.ok(cooldownData.remainingMs > 0);

    clientRejoin.disconnect();

  } finally {
    clientTarget.disconnect();
    reporter1.disconnect();
    reporter2.disconnect();
    reporter3.disconnect();
    io.close();
    httpServer.close();
  }
});

test("Phase 6 Security - 3. HTML / XSS Sanitization in Chat", async () => {
  const { httpServer, io, port } = await createTestServer();
  const clientA = createClient(port);
  const clientB = createClient(port);
  const roomId = "xss-test-room";

  try {
    await new Promise<void>((r) => { clientA.emit("room:join", { roomId, displayName: "Alice" }); clientA.once("room:joined", () => r()); });
    await new Promise<void>((r) => { clientB.emit("room:join", { roomId, displayName: "Bob" }); clientB.once("room:joined", () => r()); });

    const msgPromise = new Promise<any>((resolve) => {
      clientB.once("chat:message", (data) => resolve(data));
    });

    const xssPayload = "<script>alert('xss')</script> \x00\x07Hello Campfire!";
    clientA.emit("chat:send", { roomId, text: xssPayload });

    const receivedMsg = await msgPromise;
    // Verify control characters \x00\x07 were stripped by sanitizeText
    assert.equal(receivedMsg.text, "<script>alert('xss')</script> Hello Campfire!");
    assert.ok(!receivedMsg.text.includes("\x00"));

  } finally {
    clientA.disconnect();
    clientB.disconnect();
    io.close();
    httpServer.close();
  }
});
