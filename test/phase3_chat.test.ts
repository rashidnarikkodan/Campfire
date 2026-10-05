import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerChatHandlers, sanitizeText } from "../src/server/chatHandler";
import {
  findOrCreateRoom,
  joinRoom,
  rooms,
  resetRoomsForTesting,
} from "../src/server/roomManager";
import { getOrCreateSession, resetSessionsForTesting } from "../src/server/sessionManager";

function createMockSocket(id: string, sessionId?: string) {
  const emittedEvents: { event: string; data: any }[] = [];
  const listeners: Record<string, (data?: any) => void> = {};

  const socket: any = {
    id,
    handshake: {
      auth: { sessionId },
      address: "127.0.0.1",
    },
    on(event: string, fn: (data?: any) => void) {
      listeners[event] = fn;
    },
    emit(event: string, data: any) {
      emittedEvents.push({ event, data });
    },
    trigger(event: string, data?: any) {
      if (listeners[event]) {
        listeners[event](data);
      }
    },
    join() {},
    leave() {},
    to() {
      return {
        emit(event: string, data: any) {
          emittedEvents.push({ event, data });
        },
      };
    },
  };
  return { socket, emittedEvents, listeners };
}

function createMockIO() {
  const broadcastEvents: { room: string; event: string; data: any }[] = [];
  const io: any = {
    to(room: string) {
      return {
        emit(event: string, data: any) {
          broadcastEvents.push({ room, event, data });
        },
      };
    },
  };
  return { io, broadcastEvents };
}

describe("Phase 3: Text Chat Hardening Tests", () => {
  beforeEach(() => {
    resetSessionsForTesting();
    resetRoomsForTesting();
  });

  test("1. Sanitize text strips unprintable control characters and null bytes", () => {
    const dirtyText = "Hello\x00 World!\x07 \x1F";
    const clean = sanitizeText(dirtyText);
    assert.equal(clean, "Hello World!");
  });

  test("2. Rejects messages from sockets not joined to the campfire room", () => {
    const { io } = createMockIO();
    const { socket, emittedEvents } = createMockSocket("socket-outsider");
    registerChatHandlers(io, socket);

    socket.trigger("chat:send", { roomId: "amber-hearth-101", text: "Sneaky message" });

    const errorEvent = emittedEvents.find((e) => e.event === "chat:error");
    assert.ok(errorEvent, "Should emit chat:error event");
    assert.equal(errorEvent.data.code, "NOT_IN_ROOM");
  });

  test("3. Derives senderName authoritatively from server session, ignoring client spoofing", () => {
    const { io, broadcastEvents } = createMockIO();
    const roomId = findOrCreateRoom("test-chat-101", false);

    const session = getOrCreateSession(undefined, "Authoritative Birch");
    const { socket } = createMockSocket("socket-user", session.sessionId);
    registerChatHandlers(io, socket);

    joinRoom(io, socket, roomId, "Authoritative Birch", session.sessionId);

    // Attempt to send chat with spoofed senderName "Fake Admin"
    socket.trigger("chat:send", {
      roomId,
      text: "Genuine text message",
      senderName: "Fake Admin",
    });

    const chatMsg = broadcastEvents.find((e) => e.event === "chat:message" && !e.data.isSystem);
    assert.ok(chatMsg, "Message should be broadcast");
    assert.equal(chatMsg.data.senderName, "Authoritative Birch", "Sender name MUST match server session display name");
    assert.equal(chatMsg.data.text, "Genuine text message");
    assert.ok(typeof chatMsg.data.seq === "number", "Message should have server sequence number");
  });

  test("4. Rate limiting blocks burst message flooding and emits RATE_LIMITED error", () => {
    const { io } = createMockIO();
    const roomId = findOrCreateRoom("test-rate-102", false);

    const session = getOrCreateSession(undefined, "Rapid Sender");
    const { socket, emittedEvents } = createMockSocket("socket-spammer", session.sessionId);
    registerChatHandlers(io, socket);

    joinRoom(io, socket, roomId, "Rapid Sender", session.sessionId);

    // Send 5 messages in quick succession (burst limit is 3)
    for (let i = 0; i < 5; i++) {
      socket.trigger("chat:send", { roomId, text: `Burst msg ${i}` });
    }

    const rateLimitError = emittedEvents.find(
      (e) => e.event === "chat:error" && e.data.code === "RATE_LIMITED"
    );
    assert.ok(rateLimitError, "Should emit RATE_LIMITED error on burst threshold breach");
  });

  test("5. Rejects oversized payloads exceeding MAX_PAYLOAD_BYTES (2KB)", () => {
    const { io } = createMockIO();
    const roomId = findOrCreateRoom("test-size-103", false);

    const session = getOrCreateSession(undefined, "Big Payload");
    const { socket, emittedEvents } = createMockSocket("socket-big", session.sessionId);
    registerChatHandlers(io, socket);

    joinRoom(io, socket, roomId, "Big Payload", session.sessionId);

    const hugeText = "A".repeat(3000);
    socket.trigger("chat:send", { roomId, text: hugeText });

    const payloadError = emittedEvents.find(
      (e) => e.event === "chat:error" && e.data.code === "PAYLOAD_TOO_LARGE"
    );
    assert.ok(payloadError, "Should reject payload exceeding 2KB");
  });

  test("6. Retains recent messages in room context (max 50) and hydrates joining peers", () => {
    const { io } = createMockIO();
    const roomId = findOrCreateRoom("test-history-104", false);

    const session1 = getOrCreateSession(undefined, "Peer One");
    const { socket: socket1 } = createMockSocket("socket-1", session1.sessionId);
    registerChatHandlers(io, socket1);

    joinRoom(io, socket1, roomId, "Peer One", session1.sessionId);

    const room = rooms.get(roomId);
    assert.ok(room);
    assert.ok(Array.isArray(room.recentMessages));

    // Verify recentMessages contains the system join announcement
    assert.equal(room.recentMessages.length, 1);
    assert.equal(room.recentMessages[0].isSystem, true);

    // Peer 2 joins and receives recentMessages in room:joined event
    const session2 = getOrCreateSession(undefined, "Peer Two");
    const { socket: socket2, emittedEvents: events2 } = createMockSocket("socket-2", session2.sessionId);
    joinRoom(io, socket2, roomId, "Peer Two", session2.sessionId);

    const joinedEvent = events2.find((e) => e.event === "room:joined");
    assert.ok(joinedEvent);
    assert.ok(Array.isArray(joinedEvent.data.recentMessages));
    assert.equal(joinedEvent.data.recentMessages.length, 2, "Joining peer should receive recent chat history");
  });
});
