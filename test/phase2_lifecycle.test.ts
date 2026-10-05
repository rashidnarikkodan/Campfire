import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getOrCreateSession,
  getSession,
  updateSessionName,
  isValidUuid,
  resetSessionsForTesting,
} from "../src/server/sessionManager";
import {
  findOrCreateRoom,
  joinRoom,
  leaveRoom,
  handleDisconnect,
  rooms,
  resetRoomsForTesting,
  RECONNECT_GRACE_MS,
} from "../src/server/roomManager";

// Mock Socket.IO server and socket
function createMockSocket(id: string, sessionId?: string) {
  const emittedEvents: { event: string; data: any }[] = [];
  const roomJoined: string[] = [];
  const roomLeft: string[] = [];

  const socket: any = {
    id,
    handshake: {
      auth: { sessionId },
      address: "127.0.0.1",
    },
    emit(event: string, data: any) {
      emittedEvents.push({ event, data });
    },
    join(room: string) {
      roomJoined.push(room);
    },
    leave(room: string) {
      roomLeft.push(room);
    },
    to(room: string) {
      return {
        emit(event: string, data: any) {
          emittedEvents.push({ event: `to:${room}:${event}`, data });
        },
      };
    },
  };

  return { socket, emittedEvents, roomJoined, roomLeft };
}

function createMockIO() {
  const socketsMap = new Map<string, any>();
  const broadcastEvents: { room: string; event: string; data: any }[] = [];

  const io: any = {
    sockets: {
      sockets: socketsMap,
    },
    to(room: string) {
      return {
        emit(event: string, data: any) {
          broadcastEvents.push({ room, event, data });
        },
      };
    },
  };

  return { io, socketsMap, broadcastEvents };
}

describe("Phase 2: Session & Campfire Lifecycle Tests", () => {
  beforeEach(() => {
    resetSessionsForTesting();
    resetRoomsForTesting();
  });

  test("1. Server generates and validates anonymous session identity", () => {
    const session1 = getOrCreateSession(undefined, "Alder Wood");
    assert.ok(isValidUuid(session1.sessionId), "Session ID must be a valid UUID v4");
    assert.equal(session1.displayName, "Alder Wood");
    assert.equal(session1.presenceState, "JOINING");

    // Display name change does NOT alter session identity
    const success = updateSessionName(session1.sessionId, "Rowan Tree");
    assert.equal(success, true);

    const updated = getSession(session1.sessionId);
    assert.equal(updated?.sessionId, session1.sessionId);
    assert.equal(updated?.displayName, "Rowan Tree");
  });

  test("2. Max participant count (MAX_ROOM_SIZE = 8) is enforced server-side", () => {
    const { io } = createMockIO();
    const roomId = findOrCreateRoom("test-hearth-101", false);

    // Join 8 distinct sessions
    for (let i = 0; i < 8; i++) {
      const { socket } = createMockSocket(`socket-${i}`);
      joinRoom(io, socket, roomId, `Peer ${i}`);
    }

    const room = rooms.get(roomId);
    assert.equal(room?.peers.size, 8, "Room should contain exactly 8 peers");

    // Attempt 9th join
    const { socket: socket9, emittedEvents: events9 } = createMockSocket("socket-9");
    joinRoom(io, socket9, roomId, "Peer 9");

    assert.equal(room?.peers.size, 8, "Room capacity must not exceed 8");
    const fullEvent = events9.find((e) => e.event === "room:full");
    assert.ok(fullEvent, "Should emit room:full event to 9th socket");
  });

  test("3. Duplicate joins from same session ID update active socket without inflating peer count", () => {
    const { io } = createMockIO();
    const roomId = findOrCreateRoom("test-dupe-102", false);

    const session = getOrCreateSession(undefined, "Ember Glow");
    const { socket: socketA } = createMockSocket("socket-A", session.sessionId);
    joinRoom(io, socketA, roomId, "Ember Glow", session.sessionId);

    const room = rooms.get(roomId);
    assert.equal(room?.peers.size, 1);

    // Second socket with SAME session ID joins same room
    const { socket: socketB } = createMockSocket("socket-B", session.sessionId);
    joinRoom(io, socketB, roomId, "Ember Glow", session.sessionId);

    assert.equal(room?.peers.size, 1, "Duplicate join from same session must maintain 1 peer record");
    const peer = room?.peers.get(session.sessionId);
    assert.equal(peer?.socketId, "socket-B", "Peer record socketId must be updated to newest socket");
    assert.equal(peer?.presenceState, "CONNECTED");
  });

  test("4. Disconnect sets presence to RECONNECTING and initiates grace period", () => {
    const { io } = createMockIO();
    const roomId = findOrCreateRoom("test-reconnect-103", false);

    const session = getOrCreateSession(undefined, "Silent Pine");
    const { socket } = createMockSocket("socket-disconnect", session.sessionId);
    joinRoom(io, socket, roomId, "Silent Pine", session.sessionId);

    const room = rooms.get(roomId);
    assert.equal(room?.peers.get(session.sessionId)?.presenceState, "CONNECTED");

    // Simulate abrupt disconnect
    handleDisconnect(io, socket);

    const peerAfterDisconnect = room?.peers.get(session.sessionId);
    assert.equal(peerAfterDisconnect?.presenceState, "RECONNECTING", "Peer presence should be RECONNECTING");
    assert.equal(rooms.has(roomId), true, "Room should remain open during reconnect grace period");
  });

  test("5. Reconnecting within grace period preserves participant room membership", () => {
    const { io } = createMockIO();
    const roomId = findOrCreateRoom("test-grace-104", false);

    const session = getOrCreateSession(undefined, "Misty Brook");
    const { socket: socket1 } = createMockSocket("socket-old", session.sessionId);
    joinRoom(io, socket1, roomId, "Misty Brook", session.sessionId);

    // Abrupt disconnect
    handleDisconnect(io, socket1);

    // Reconnect with new socket before grace period expires
    const { socket: socket2 } = createMockSocket("socket-new", session.sessionId);
    joinRoom(io, socket2, roomId, "Misty Brook", session.sessionId);

    const room = rooms.get(roomId);
    assert.equal(room?.peers.size, 1);
    const peer = room?.peers.get(session.sessionId);
    assert.equal(peer?.presenceState, "CONNECTED");
    assert.equal(peer?.socketId, "socket-new");
  });

  test("6. Explicit leave evicts participant immediately and cleans up empty room", () => {
    const { io } = createMockIO();
    const roomId = findOrCreateRoom("test-leave-105", false);

    const { socket } = createMockSocket("socket-leave");
    joinRoom(io, socket, roomId, "Leaving Stranger");

    assert.equal(rooms.has(roomId), true);

    leaveRoom(io, socket, true);

    assert.equal(rooms.has(roomId), false, "Empty room must be cleaned up immediately on last peer exit");
  });
});
