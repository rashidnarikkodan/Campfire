import { randomUUID } from "crypto";
import { Server as SocketIOServer, Socket } from "socket.io";
import { MAX_ROOM_SIZE, MAX_CHAT_HISTORY_PER_ROOM } from "../lib/constants";
import { getJoinCooldownRemaining } from "./moderationManager";
import { generateName } from "../lib/nameGenerator";
import { checkRateLimit, cleanupRateLimits } from "./rateLimiter";
import {
  getOrCreateSession,
  getSession,
  touchSession,
  updateSessionName,
  pruneExpiredSessions,
  type PresenceState,
  type ParticipantSession,
} from "./sessionManager";
import { incrementMetric, recordCampfireDuration } from "./metrics";

export interface PeerInfo {
  socketId: string;
  sessionId: string;
  displayName: string;
  presenceState: PresenceState;
  isSpeaking: boolean;
  isMuted: boolean;
  joinedAt: number;
  lastSeenAt: number;
}

export interface RoomMessage {
  id: string;
  seq: number;
  senderId: string;
  sessionId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem: boolean;
}

export interface Room {
  id: string;
  isPrivate: boolean;
  peers: Map<string, PeerInfo>; // Keyed by sessionId
  createdAt: number;
  lastStokedAt?: number;
  stokeCount: number;
  recentMessages: RoomMessage[];
  messageSequence: number;
}

const RECONNECT_GRACE_MS = 20000; // 20 seconds reconnect grace period

// roomId -> Room
const rooms = new Map<string, Room>();

// socketId -> roomId
const socketRoom = new Map<string, string>();

// socketId -> sessionId
const socketSession = new Map<string, string>();

// sessionId -> reconnect Timeout
const reconnectTimers = new Map<string, NodeJS.Timeout>();

const ADJECTIVES = [
  "amber", "cedar", "birch", "ember", "quiet", "golden",
  "mossy", "silent", "pine", "dusk", "misty", "warm"
];
const NOUNS = [
  "hearth", "clearing", "grove", "campfire", "ridge",
  "brook", "dell", "shelter", "ember", "woods"
];

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



export function addRoomMessage(roomId: string, messageData: Omit<RoomMessage, "seq">): RoomMessage | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  room.messageSequence = (room.messageSequence || 0) + 1;
  const fullMessage: RoomMessage = {
    ...messageData,
    seq: room.messageSequence,
  };

  if (!room.recentMessages) {
    room.recentMessages = [];
  }
  room.recentMessages.push(fullMessage);
  if (room.recentMessages.length > MAX_CHAT_HISTORY_PER_ROOM) {
    room.recentMessages = room.recentMessages.slice(-MAX_CHAT_HISTORY_PER_ROOM);
  }

  return fullMessage;
}

export function findOrCreateRoom(targetRoomId?: unknown, isPrivate: boolean = false): string {
  if (typeof targetRoomId === "string" && targetRoomId.trim()) {
    const cleanId = targetRoomId.trim().toLowerCase().slice(0, 32);
    if (!rooms.has(cleanId)) {
      incrementMetric.campfiresCreated();
      rooms.set(cleanId, {
        id: cleanId,
        isPrivate: Boolean(isPrivate),
        peers: new Map(),
        createdAt: Date.now(),
        stokeCount: 0,
        recentMessages: [],
        messageSequence: 0,
      });
    }
    return cleanId;
  }

  // Find existing public room with available capacity
  for (const [roomId, room] of rooms.entries()) {
    const activePeerCount = Array.from(room.peers.values()).filter(
      (p) => p.presenceState === "CONNECTED" || p.presenceState === "JOINING" || p.presenceState === "RECONNECTING"
    ).length;
    if (!room.isPrivate && activePeerCount < MAX_ROOM_SIZE) {
      return roomId;
    }
  }

  // Create new room
  const newId = generateRoomId();
  incrementMetric.campfiresCreated();
  rooms.set(newId, {
    id: newId,
    isPrivate: Boolean(isPrivate),
    peers: new Map(),
    createdAt: Date.now(),
    stokeCount: 0,
    recentMessages: [],
    messageSequence: 0,
  });
  return newId;
}

export function joinRoom(
  io: SocketIOServer,
  socket: Socket,
  roomId: string,
  displayNameCandidate?: unknown,
  sessionIdCandidate?: unknown,
  isPrivate: boolean = false
) {
  const cooldownRemaining = getJoinCooldownRemaining(socket);
  if (cooldownRemaining > 0) {
    incrementMetric.joinFailures();
    socket.emit("mod:cooldown", { remainingMs: cooldownRemaining });
    return;
  }

  // Ensure room exists
  if (!rooms.has(roomId)) {
    incrementMetric.campfiresCreated();
    rooms.set(roomId, {
      id: roomId,
      isPrivate: Boolean(isPrivate),
      peers: new Map(),
      createdAt: Date.now(),
      stokeCount: 0,
      recentMessages: [],
      messageSequence: 0,
    });
  }

  const room = rooms.get(roomId)!;

  // Authoritative server session lookup & token issuance
  const session = getOrCreateSession(
    sessionIdCandidate || socket.handshake.auth?.sessionId,
    displayNameCandidate || socket.handshake.auth?.displayName
  );

  const sessionId = session.sessionId;

  // If reconnect timer is active for this session, clear it immediately
  if (reconnectTimers.has(sessionId)) {
    incrementMetric.reconnects();
    clearTimeout(reconnectTimers.get(sessionId)!);
    reconnectTimers.delete(sessionId);
  }

  const existingPeer = room.peers.get(sessionId);

  // Check room capacity if this is a NEW session joining the room
  if (!existingPeer && room.peers.size >= MAX_ROOM_SIZE) {
    incrementMetric.joinFailures();
    socket.emit("room:full", { roomId });
    return;
  }

  // If user was previously in a DIFFERENT room, leave that room first
  const currentSocketRoom = socketRoom.get(socket.id);
  if (currentSocketRoom && currentSocketRoom !== roomId) {
    leaveRoom(io, socket, false);
  }

  const now = Date.now();

  // If duplicate socket connection exists for same session in this room, disconnect old socket
  if (existingPeer && existingPeer.socketId !== socket.id) {
    const oldSocketId = existingPeer.socketId;
    socketRoom.delete(oldSocketId);
    socketSession.delete(oldSocketId);
    const oldSocket = io.sockets.sockets.get(oldSocketId);
    if (oldSocket) {
      oldSocket.leave(roomId);
      oldSocket.emit("room:replaced", { reason: "Connected from another tab or device." });
    }
  }

  // Create or update PeerInfo in room.peers map (keyed by sessionId)
  const peerInfo: PeerInfo = {
    socketId: socket.id,
    sessionId: session.sessionId,
    displayName: session.displayName,
    presenceState: "CONNECTED",
    isSpeaking: false,
    isMuted: false,
    joinedAt: existingPeer ? existingPeer.joinedAt : now,
    lastSeenAt: now,
  };

  room.peers.set(sessionId, peerInfo);
  socketRoom.set(socket.id, roomId);
  socketSession.set(socket.id, sessionId);
  session.currentRoomId = roomId;
  session.presenceState = "CONNECTED";
  session.activeSocketId = socket.id;

  socket.join(roomId);

  // Filter peers list to send to joining client
  const peerList = Array.from(room.peers.values()).filter((p) => p.sessionId !== sessionId);

  socket.emit("room:joined", {
    roomId,
    peerInfo,
    peers: peerList,
    createdAt: room.createdAt,
    stokeCount: room.stokeCount,
    sessionId: session.sessionId,
    recentMessages: room.recentMessages || [],
  });

  if (existingPeer) {
    // Session reconnected to existing room
    socket.to(roomId).emit("room:peer-presence", {
      socketId: socket.id,
      sessionId: session.sessionId,
      displayName: session.displayName,
      presenceState: "CONNECTED",
    });
  } else {
    // New peer joined room
    socket.to(roomId).emit("room:peer-joined", {
      peer: peerInfo,
    });

    // Send system announcement to room
    const sysMsg = addRoomMessage(roomId, {
      id: randomUUID(),
      senderId: "system",
      sessionId: "system",
      senderName: "Campfire",
      text: `${session.displayName} joined the fire circle.`,
      timestamp: now,
      isSystem: true,
    });

    if (sysMsg) {
      io.to(roomId).emit("chat:message", sysMsg);
    }
  }
}

export function leaveRoom(io: SocketIOServer, socket: Socket, isExplicitLeave: boolean = true) {
  const roomId = socketRoom.get(socket.id);
  const sessionId = socketSession.get(socket.id);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (room && sessionId) {
    const peer = room.peers.get(sessionId);

    if (reconnectTimers.has(sessionId)) {
      clearTimeout(reconnectTimers.get(sessionId)!);
      reconnectTimers.delete(sessionId);
    }

    if (peer && peer.socketId === socket.id) {
      room.peers.delete(sessionId);
      const session = getSession(sessionId);
      if (session) {
        session.currentRoomId = null;
        session.presenceState = "DISCONNECTED";
        session.activeSocketId = null;
      }

      socket.to(roomId).emit("room:peer-left", {
        socketId: socket.id,
        sessionId,
        displayName: peer.displayName,
      });

      if (isExplicitLeave) {
        const sysMsg = addRoomMessage(roomId, {
          id: randomUUID(),
          senderId: "system",
          sessionId: "system",
          senderName: "Campfire",
          text: `${peer.displayName} stepped away into the night.`,
          timestamp: Date.now(),
          isSystem: true,
        });
        if (sysMsg) {
          io.to(roomId).emit("chat:message", sysMsg);
        }
      }

      if (room.peers.size === 0) {
        recordCampfireDuration(Date.now() - room.createdAt);
        rooms.delete(roomId);
      }
    }
  }

  socket.leave(roomId);
  socketRoom.delete(socket.id);
  socketSession.delete(socket.id);
}

export function handleDisconnect(io: SocketIOServer, socket: Socket) {
  cleanupRateLimits(socket.id);
  const roomId = socketRoom.get(socket.id);
  const sessionId = socketSession.get(socket.id);

  if (!roomId || !sessionId) {
    socketRoom.delete(socket.id);
    socketSession.delete(socket.id);
    return;
  }

  const room = rooms.get(roomId);
  if (!room) {
    socketRoom.delete(socket.id);
    socketSession.delete(socket.id);
    return;
  }

  const peer = room.peers.get(sessionId);
  if (!peer || peer.socketId !== socket.id) {
    socketRoom.delete(socket.id);
    socketSession.delete(socket.id);
    return;
  }

  const session = getSession(sessionId);
  const now = Date.now();

  peer.presenceState = "RECONNECTING";
  peer.lastSeenAt = now;
  if (session) {
    session.presenceState = "RECONNECTING";
  }

  // Notify room peers that user is RECONNECTING
  socket.to(roomId).emit("room:peer-presence", {
    socketId: socket.id,
    sessionId,
    displayName: peer.displayName,
    presenceState: "RECONNECTING",
  });

  // Clear existing timer if any
  if (reconnectTimers.has(sessionId)) {
    clearTimeout(reconnectTimers.get(sessionId)!);
  }

  // Set reconnect grace period timer (20 seconds)
  const timer = setTimeout(() => {
    reconnectTimers.delete(sessionId);
    const currentRoom = rooms.get(roomId);
    if (!currentRoom) return;

    const currentPeer = currentRoom.peers.get(sessionId);
    if (currentPeer && currentPeer.presenceState === "RECONNECTING" && currentPeer.socketId === socket.id) {
      currentRoom.peers.delete(sessionId);
      if (session) {
        session.currentRoomId = null;
        session.presenceState = "DISCONNECTED";
        session.activeSocketId = null;
      }

      io.to(roomId).emit("room:peer-left", {
        socketId: socket.id,
        sessionId,
        displayName: currentPeer.displayName,
      });

      const sysMsg = addRoomMessage(roomId, {
        id: randomUUID(),
        senderId: "system",
        sessionId: "system",
        senderName: "Campfire",
        text: `${currentPeer.displayName} stepped away into the night.`,
        timestamp: Date.now(),
        isSystem: true,
      });
      if (sysMsg) {
        io.to(roomId).emit("chat:message", sysMsg);
      }

      if (currentRoom.peers.size === 0) {
        rooms.delete(roomId);
      }
    }
  }, RECONNECT_GRACE_MS);

  reconnectTimers.set(sessionId, timer);
  socketRoom.delete(socket.id);
  socketSession.delete(socket.id);
  cleanupRateLimits(socket.id);
}

export function registerRoomHandlers(io: SocketIOServer, socket: Socket) {
  socket.on(
    "room:join",
    (data?: { roomId?: unknown; displayName?: unknown; sessionId?: unknown; isPrivate?: unknown }) => {
      try {
        if (!checkRateLimit(socket.id, "room:join", { maxEvents: 5, windowMs: 5000 })) {
          socket.emit("room:error", { code: "RATE_LIMITED", message: "Joining rooms too quickly." });
          return;
        }
        const roomIdRaw = typeof data?.roomId === "string" ? data.roomId.trim().slice(0, 64) : undefined;
        const isPrivate = Boolean(data?.isPrivate);
        const targetRoomId = roomIdRaw ? findOrCreateRoom(roomIdRaw, isPrivate) : findOrCreateRoom(undefined, isPrivate);
        joinRoom(io, socket, targetRoomId, data?.displayName, data?.sessionId, isPrivate);
      } catch (err) {
        console.error("[roomManager] Error in room:join handler:", err);
        socket.emit("room:error", { code: "SERVER_ERROR", message: "Failed to join room." });
      }
    }
  );

  socket.on("room:leave", () => {
    try {
      if (!checkRateLimit(socket.id, "room:leave", { maxEvents: 5, windowMs: 5000 })) return;
      leaveRoom(io, socket, true);
    } catch (err) {
      console.error("[roomManager] Error in room:leave handler:", err);
    }
  });

  socket.on("room:update-name", (data: { displayName?: unknown }) => {
    try {
      if (!checkRateLimit(socket.id, "update-name", { maxEvents: 3, windowMs: 10000 })) {
        socket.emit("room:error", { code: "RATE_LIMITED", message: "Updating name too frequently." });
        return;
      }
      const displayName = typeof data?.displayName === "string" ? data.displayName : "";
      const roomId = socketRoom.get(socket.id);
      const sessionId = socketSession.get(socket.id);
      if (!roomId || !sessionId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      const peer = room.peers.get(sessionId);
      if (!peer) return;

      const oldName = peer.displayName;
      const newName = displayName.trim().slice(0, 32);
      if (!newName || newName === oldName) return;

      peer.displayName = newName;
      updateSessionName(sessionId, newName);

      io.to(roomId).emit("room:peer-updated", {
        socketId: socket.id,
        sessionId,
        displayName: newName,
      });

      const updateMsg = addRoomMessage(roomId, {
        id: randomUUID(),
        senderId: "system",
        sessionId: "system",
        senderName: "Campfire",
        text: `${oldName} is now known as ${newName}.`,
        timestamp: Date.now(),
        isSystem: true,
      });
      if (updateMsg) {
        io.to(roomId).emit("chat:message", updateMsg);
      }
    } catch (err) {
      console.error("[roomManager] Error in room:update-name handler:", err);
    }
  });

  socket.on("voice:speaking", (data: { roomId?: unknown; isSpeaking?: unknown }) => {
    try {
      if (!checkRateLimit(socket.id, "voice:speaking", { maxEvents: 20, windowMs: 5000 })) return;
      const roomId = typeof data?.roomId === "string" ? data.roomId : undefined;
      const isSpeaking = typeof data?.isSpeaking === "boolean" ? data.isSpeaking : false;
      const currentRoomId = socketRoom.get(socket.id);
      const sessionId = socketSession.get(socket.id);

      if (roomId && currentRoomId === roomId && sessionId) {
        const room = rooms.get(roomId);
        const peer = room?.peers.get(sessionId);
        if (peer) {
          peer.isSpeaking = isSpeaking;
          touchSession(sessionId);
        }
        socket.to(roomId).emit("voice:speaking", { socketId: socket.id, sessionId, isSpeaking });
      }
    } catch (err) {
      console.error("[roomManager] Error in voice:speaking handler:", err);
    }
  });

  socket.on("campfire:stoke", () => {
    try {
      if (!checkRateLimit(socket.id, "stoke", { maxEvents: 5, windowMs: 5000 })) return;
      const roomId = socketRoom.get(socket.id);
      const sessionId = socketSession.get(socket.id);
      if (!roomId || !sessionId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      const peer = room.peers.get(sessionId);
      room.stokeCount = (room.stokeCount || 0) + 1;
      room.lastStokedAt = Date.now();
      touchSession(sessionId);

      io.to(roomId).emit("campfire:stoked", {
        socketId: socket.id,
        sessionId,
        displayName: peer?.displayName || "Someone",
        stokeCount: room.stokeCount,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error("[roomManager] Error in campfire:stoke handler:", err);
    }
  });

  socket.on("chat:typing", (data: { isTyping?: unknown }) => {
    try {
      if (!checkRateLimit(socket.id, "typing", { maxEvents: 10, windowMs: 5000 })) return;
      const isTyping = Boolean(data?.isTyping);
      const roomId = socketRoom.get(socket.id);
      const sessionId = socketSession.get(socket.id);
      if (!roomId || !sessionId) return;
      const room = rooms.get(roomId);
      const peer = room?.peers.get(sessionId);

      socket.to(roomId).emit("chat:typing", {
        socketId: socket.id,
        sessionId,
        displayName: peer?.displayName || "Someone",
        isTyping,
      });
    } catch (err) {
      console.error("[roomManager] Error in chat:typing handler:", err);
    }
  });
}

// Background cleanup interval (runs every 30s)
const roomCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    for (const [sessionId, peer] of room.peers.entries()) {
      if (peer.presenceState === "RECONNECTING" && now - peer.lastSeenAt > RECONNECT_GRACE_MS + 5000) {
        room.peers.delete(sessionId);
        if (reconnectTimers.has(sessionId)) {
          clearTimeout(reconnectTimers.get(sessionId)!);
          reconnectTimers.delete(sessionId);
        }
      }
    }
    if (room.peers.size === 0) {
      rooms.delete(roomId);
    }
  }
  pruneExpiredSessions();
}, 30000);
if (roomCleanupInterval.unref) roomCleanupInterval.unref();

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

export function resetRoomsForTesting(): void {
  for (const timer of reconnectTimers.values()) {
    clearTimeout(timer);
  }
  reconnectTimers.clear();
  rooms.clear();
  socketRoom.clear();
  socketSession.clear();
}

export { socketRoom, socketSession, rooms, RECONNECT_GRACE_MS };
