import { randomUUID } from "crypto";
import { Server as SocketIOServer, Socket } from "socket.io";
import { MAX_ROOM_SIZE } from "../lib/constants";
import { getJoinCooldownRemaining } from "./moderationManager";
import { generateName } from "../lib/nameGenerator";

export interface PeerInfo {
  socketId: string;
  displayName: string;
  sessionId: string;
  isSpeaking: boolean;
  isMuted: boolean;
  joinedAt: number;
}

export interface Room {
  id: string;
  isPrivate: boolean;
  peers: Map<string, PeerInfo>;
  createdAt: number;
  lastStokedAt?: number;
  stokeCount: number;
}

// roomId → Room
const rooms = new Map<string, Room>();

// socketId → roomId
const socketRoom = new Map<string, string>();

const ADJECTIVES = ["amber", "cedar", "birch", "ember", "quiet", "golden", "mossy", "silent", "pine", "dusk", "misty", "warm"];
const NOUNS = ["hearth", "clearing", "grove", "campfire", "ridge", "brook", "dell", "shelter", "ember", "woods"];

function generateRoomId(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  const code = `${adj}-${noun}-${num}`;
  if (rooms.has(code)) {
    return `${code}-${Math.floor(Math.random() * 100)}`;
  }
  return code;
}

import { checkRateLimit, cleanupRateLimits } from "./rateLimiter";

function findOrCreateRoom(targetRoomId?: unknown, isPrivate: boolean = false): string {
  if (typeof targetRoomId === "string" && targetRoomId.trim()) {
    const cleanId = targetRoomId.trim().toLowerCase().slice(0, 32);
    if (!rooms.has(cleanId)) {
      rooms.set(cleanId, {
        id: cleanId,
        isPrivate: Boolean(isPrivate),
        peers: new Map(),
        createdAt: Date.now(),
        stokeCount: 0,
      });
    }
    return cleanId;
  }

  // Find existing public room with space
  for (const [roomId, room] of rooms) {
    if (!room.isPrivate && room.peers.size < MAX_ROOM_SIZE) {
      return roomId;
    }
  }

  // Create new room
  const newId = generateRoomId();
  rooms.set(newId, {
    id: newId,
    isPrivate: Boolean(isPrivate),
    peers: new Map(),
    createdAt: Date.now(),
    stokeCount: 0,
  });
  return newId;
}

function joinRoom(
  io: SocketIOServer,
  socket: Socket,
  roomId: string,
  displayName?: unknown,
  sessionId?: unknown,
  isPrivate: boolean = false
) {
  const cooldownRemaining = getJoinCooldownRemaining(socket);
  if (cooldownRemaining > 0) {
    socket.emit("mod:cooldown", { remainingMs: cooldownRemaining });
    return;
  }

  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      isPrivate: Boolean(isPrivate),
      peers: new Map(),
      createdAt: Date.now(),
      stokeCount: 0,
    });
  }

  const room = rooms.get(roomId)!;
  if (room.peers.size >= MAX_ROOM_SIZE) {
    socket.emit("room:full", { roomId });
    return;
  }

  leaveRoom(io, socket);

  const rawSessionId = typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : null;
  const handshakeSessionId = typeof socket.handshake.auth?.sessionId === "string" && socket.handshake.auth.sessionId.trim() ? socket.handshake.auth.sessionId.trim() : null;

  const effectiveSessionId = rawSessionId || handshakeSessionId || socket.id;

  const rawName = typeof displayName === "string" ? displayName.trim() : "";
  const effectiveName = rawName.length > 0 ? rawName.slice(0, 32) : generateName(effectiveSessionId);

  const peerInfo: PeerInfo = {
    socketId: socket.id,
    displayName: effectiveName,
    sessionId: effectiveSessionId,
    isSpeaking: false,
    isMuted: false,
    joinedAt: Date.now(),
  };

  room.peers.set(socket.id, peerInfo);
  socketRoom.set(socket.id, roomId);
  socket.join(roomId);

  // Send current room state and existing peers to newly joined user
  const peerList = Array.from(room.peers.values()).filter((p) => p.socketId !== socket.id);

  socket.emit("room:joined", {
    roomId,
    peerInfo,
    peers: peerList,
    createdAt: room.createdAt,
    stokeCount: room.stokeCount,
  });

  // Notify other peers in the room
  socket.to(roomId).emit("room:peer-joined", {
    peer: peerInfo,
  });

  // Send system message to room
  io.to(roomId).emit("chat:message", {
    id: randomUUID(),
    senderId: "system",
    senderName: "Campfire",
    text: `${effectiveName} joined the fire circle.`,
    timestamp: Date.now(),
    isSystem: true,
  });
}

function leaveRoom(io: SocketIOServer, socket: Socket) {
  const roomId = socketRoom.get(socket.id);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (room) {
    const leavingPeer = room.peers.get(socket.id);
    room.peers.delete(socket.id);

    socket.to(roomId).emit("room:peer-left", {
      socketId: socket.id,
      displayName: leavingPeer?.displayName || "A stranger",
    });

    if (leavingPeer) {
      io.to(roomId).emit("chat:message", {
        id: randomUUID(),
        senderId: "system",
        senderName: "Campfire",
        text: `${leavingPeer.displayName} stepped away into the night.`,
        timestamp: Date.now(),
        isSystem: true,
      });
    }

    if (room.peers.size === 0) {
      rooms.delete(roomId);
    }
  }

  socket.leave(roomId);
  socketRoom.delete(socket.id);
}

export function registerRoomHandlers(io: SocketIOServer, socket: Socket) {
  socket.on(
    "room:join",
    (data?: { roomId?: unknown; displayName?: unknown; sessionId?: unknown; isPrivate?: unknown }) => {
      const isPrivate = Boolean(data?.isPrivate);
      const targetRoomId = data?.roomId ? findOrCreateRoom(data.roomId, isPrivate) : findOrCreateRoom(undefined, isPrivate);
      joinRoom(io, socket, targetRoomId, data?.displayName, data?.sessionId, isPrivate);
    }
  );

  socket.on("room:leave", () => {
    leaveRoom(io, socket);
  });

  socket.on("room:update-name", (data: { displayName?: unknown }) => {
    if (!checkRateLimit(socket.id, "update-name", { maxEvents: 3, windowMs: 10000 })) return;
    const displayName = typeof data?.displayName === "string" ? data.displayName : "";
    const roomId = socketRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const peer = room.peers.get(socket.id);
    if (!peer) return;

    const oldName = peer.displayName;
    const newName = displayName.trim().slice(0, 32);
    if (!newName || newName === oldName) return;

    peer.displayName = newName;
    io.to(roomId).emit("room:peer-updated", {
      socketId: socket.id,
      displayName: newName,
    });

    io.to(roomId).emit("chat:message", {
      id: randomUUID(),
      senderId: "system",
      senderName: "Campfire",
      text: `${oldName} is now known as ${newName}.`,
      timestamp: Date.now(),
      isSystem: true,
    });
  });

  socket.on("voice:speaking", (data: { roomId?: unknown; isSpeaking?: unknown }) => {
    const roomId = typeof data?.roomId === "string" ? data.roomId : undefined;
    const isSpeaking = typeof data?.isSpeaking === "boolean" ? data.isSpeaking : false;
    const currentRoomId = socketRoom.get(socket.id);
    if (roomId && currentRoomId === roomId) {
      const room = rooms.get(roomId);
      const peer = room?.peers.get(socket.id);
      if (peer) {
        peer.isSpeaking = isSpeaking;
      }
      socket.to(roomId).emit("voice:speaking", { socketId: socket.id, isSpeaking });
    }
  });

  socket.on("campfire:stoke", () => {
    if (!checkRateLimit(socket.id, "stoke", { maxEvents: 5, windowMs: 5000 })) return;
    const roomId = socketRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const peer = room.peers.get(socket.id);
    room.stokeCount = (room.stokeCount || 0) + 1;
    room.lastStokedAt = Date.now();

    io.to(roomId).emit("campfire:stoked", {
      socketId: socket.id,
      displayName: peer?.displayName || "Someone",
      stokeCount: room.stokeCount,
      timestamp: Date.now(),
    });
  });

  socket.on("chat:typing", (data: { isTyping?: unknown }) => {
    if (!checkRateLimit(socket.id, "typing", { maxEvents: 10, windowMs: 5000 })) return;
    const isTyping = Boolean(data?.isTyping);
    const roomId = socketRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    const peer = room?.peers.get(socket.id);

    socket.to(roomId).emit("chat:typing", {
      socketId: socket.id,
      displayName: peer?.displayName || "Someone",
      isTyping,
    });
  });
}

export function handleDisconnect(io: SocketIOServer, socket: Socket) {
  cleanupRateLimits(socket.id);
  const roomId = socketRoom.get(socket.id);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (room) {
    const leavingPeer = room.peers.get(socket.id);
    room.peers.delete(socket.id);

    socket.to(roomId).emit("room:peer-left", {
      socketId: socket.id,
      displayName: leavingPeer?.displayName || "A stranger",
    });

    if (leavingPeer) {
      io.to(roomId).emit("chat:message", {
        id: randomUUID(),
        senderId: "system",
        senderName: "Campfire",
        text: `${leavingPeer.displayName} stepped away into the night.`,
        timestamp: Date.now(),
        isSystem: true,
      });
    }

    if (room.peers.size === 0) {
      rooms.delete(roomId);
    }
  }
  socketRoom.delete(socket.id);
}

export function getStats() {
  let totalPeers = 0;
  for (const room of rooms.values()) {
    totalPeers += room.peers.size;
  }
  return {
    activeRooms: rooms.size,
    activePeers: totalPeers,
  };
}

export { socketRoom, rooms };
