import test from "node:test";
import assert from "node:assert/strict";
import { createServer, Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import { registerRoomHandlers, resetRoomsForTesting } from "../src/server/roomManager";
import { registerSignalHandlers } from "../src/server/signalHandler";
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
    });

    io.on("connection", (socket) => {
      registerRoomHandlers(io, socket);
      registerSignalHandlers(io, socket);
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

test("Phase 4 WebRTC Signaling - Room isolation & same-room delivery", async () => {
  const { httpServer, io, port } = await createTestServer();

  const clientA = createClient(port);
  const clientB = createClient(port);
  const clientC = createClient(port); // Client C joins a different room

  try {
    const room1 = "webrtc-room-1";
    const room2 = "webrtc-room-2";

    // Join room 1
    await new Promise<void>((resolve) => {
      clientA.emit("room:join", { roomId: room1, displayName: "Peer A" });
      clientA.once("room:joined", () => resolve());
    });

    await new Promise<void>((resolve) => {
      clientB.emit("room:join", { roomId: room1, displayName: "Peer B" });
      clientB.once("room:joined", () => resolve());
    });

    // Join room 2
    await new Promise<void>((resolve) => {
      clientC.emit("room:join", { roomId: room2, displayName: "Peer C" });
      clientC.once("room:joined", () => resolve());
    });

    const socketBId = clientB.id;
    const socketCId = clientC.id;

    // 1. Send offer to Peer B (same room) -> Should succeed
    const validOffer = {
      type: "offer",
      sdp: "v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n",
    };

    const offerReceivedPromise = new Promise<{ fromSocketId: string; sdp: any }>((resolve) => {
      clientB.once("signal:offer", (data) => resolve(data));
    });

    clientA.emit("signal:offer", {
      targetSocketId: socketBId,
      sdp: validOffer,
    });

    const receivedOffer = await offerReceivedPromise;
    assert.equal(receivedOffer.fromSocketId, clientA.id);
    assert.equal(receivedOffer.sdp.type, "offer");

    // 2. Send offer to Peer C (different room) -> Should be rejected
    let crossRoomReceived = false;
    clientC.once("signal:offer", () => {
      crossRoomReceived = true;
    });

    clientA.emit("signal:offer", {
      targetSocketId: socketCId,
      sdp: validOffer,
    });

    await new Promise((r) => setTimeout(r, 100));
    assert.equal(crossRoomReceived, false, "Cross-room signaling must be rejected");

  } finally {
    clientA.disconnect();
    clientB.disconnect();
    clientC.disconnect();
    io.close();
    httpServer.close();
  }
});

test("Phase 4 WebRTC Signaling - Malformed SDP & ICE candidate validation", async () => {
  const { httpServer, io, port } = await createTestServer();

  const clientA = createClient(port);
  const clientB = createClient(port);

  try {
    const roomId = "sdp-test-room";

    await new Promise<void>((resolve) => {
      clientA.emit("room:join", { roomId, displayName: "Peer A" });
      clientA.once("room:joined", () => resolve());
    });

    await new Promise<void>((resolve) => {
      clientB.emit("room:join", { roomId, displayName: "Peer B" });
      clientB.once("room:joined", () => resolve());
    });

    let offerReceived = false;
    let iceReceived = false;

    clientB.on("signal:offer", () => { offerReceived = true; });
    clientB.on("signal:ice-candidate", () => { iceReceived = true; });

    // 1. Invalid SDP type
    clientA.emit("signal:offer", {
      targetSocketId: clientB.id,
      sdp: { type: "malicious_type", sdp: "valid sdp string" },
    });

    // 2. Empty SDP string
    clientA.emit("signal:offer", {
      targetSocketId: clientB.id,
      sdp: { type: "offer", sdp: "" },
    });

    // 3. Excessively long SDP (>10000 chars)
    clientA.emit("signal:offer", {
      targetSocketId: clientB.id,
      sdp: { type: "offer", sdp: "a".repeat(10005) },
    });

    // 4. Malformed ICE candidate (non-string candidate)
    clientA.emit("signal:ice-candidate", {
      targetSocketId: clientB.id,
      candidate: { candidate: 12345 },
    });

    // 5. Excessively long ICE candidate (>1000 chars)
    clientA.emit("signal:ice-candidate", {
      targetSocketId: clientB.id,
      candidate: { candidate: "c".repeat(1005) },
    });

    await new Promise((r) => setTimeout(r, 150));

    assert.equal(offerReceived, false, "Malformed SDP offers must be rejected");
    assert.equal(iceReceived, false, "Malformed ICE candidates must be rejected");

    // 6. Send VALID ICE candidate -> Should pass
    const validCandidatePromise = new Promise<{ fromSocketId: string; candidate: any }>((resolve) => {
      clientB.once("signal:ice-candidate", (data) => resolve(data));
    });

    clientA.emit("signal:ice-candidate", {
      targetSocketId: clientB.id,
      candidate: { candidate: "candidate:1 1 UDP 2013266431 127.0.0.1 54321 typ host", sdpMid: "0", sdpMLineIndex: 0 },
    });

    const receivedCandidate = await validCandidatePromise;
    assert.equal(receivedCandidate.fromSocketId, clientA.id);
    assert.equal(receivedCandidate.candidate.sdpMid, "0");

  } finally {
    clientA.disconnect();
    clientB.disconnect();
    io.close();
    httpServer.close();
  }
});
