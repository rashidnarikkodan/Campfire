import { randomUUID } from "crypto";
import { Server as SocketIOServer, Socket } from "socket.io";
import { MAX_ROOM_SIZE } from "../lib/constants";
import { getJoinCooldownRemaining } from "./moderationManager";

interface Room {
  peers: Set<string>;
  createdAt: Date;
}

// roomId → Room
const rooms = new Map<string, Room>();

// socketId → roomId
const socketRoom = new Map<string, string>();

function findOrCreateRoom(): string {
  for (const [roomId, room] of rooms) {
    if (room.peers.size < MAX_ROOM_SIZE) {
      return roomId;
    }
  }
  const newId = randomUUID().slice(0, 8);
  rooms.set(newId, { peers: new Set(), createdAt: new Date() });
  return newId;
}

function joinRoom(io: SocketIOServer, socket: Socket, roomId: string) {
  const cooldownRemaining = getJoinCooldownRemaining(socket);
  if (cooldownRemaining > 0) {
    socket.emit("mod:cooldown", { remainingMs: cooldownRemaining });
    return;
  }

  if (!rooms.has(roomId)) {
    rooms.set(roomId, { peers: new Set(), createdAt: new Date() });
  }

  const room = rooms.get(roomId)!;
  if (room.peers.size >= MAX_ROOM_SIZE) {
    socket.emit("room:full", { roomId });
    return;
  }

  leaveRoom(io, socket);

  room.peers.add(socket.id);
  socketRoom.set(socket.id, roomId);
  socket.join(roomId);

  socket.emit("room:joined", {
    roomId,
    peers: [...room.peers].filter((id) => id !== socket.id),
  });

  socket.to(roomId).emit("room:peer-joined", { socketId: socket.id });
}

function leaveRoom(io: SocketIOServer, socket: Socket) {
  const roomId = socketRoom.get(socket.id);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (room) {
    room.peers.delete(socket.id);
    socket.to(roomId).emit("room:peer-left", { socketId: socket.id });

    if (room.peers.size === 0) {
      rooms.delete(roomId);
    }
  }

  socket.leave(roomId);
  socketRoom.delete(socket.id);
}

export function registerRoomHandlers(io: SocketIOServer, socket: Socket) {
  socket.on("room:join", () => {
    if (socketRoom.has(socket.id)) return;
    const roomId = findOrCreateRoom();
    joinRoom(io, socket, roomId);
  });

  socket.on("room:leave", () => {
    leaveRoom(io, socket);
  });

  socket.on("voice:speaking", ({ roomId, isSpeaking }: { roomId: string; isSpeaking: boolean }) => {
    if (roomId && socketRoom.get(socket.id) === roomId && typeof isSpeaking === "boolean") {
      socket.to(roomId).emit("voice:speaking", { socketId: socket.id, isSpeaking });
    }
  });
}

export function handleDisconnect(socket: Socket) {
  const roomId = socketRoom.get(socket.id);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (room) {
    room.peers.delete(socket.id);
    socket.to(roomId).emit("room:peer-left", { socketId: socket.id });
    if (room.peers.size === 0) {
      rooms.delete(roomId);
    }
  }
  socketRoom.delete(socket.id);
}

export { socketRoom, rooms };
