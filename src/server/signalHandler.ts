import { Server as SocketIOServer, Socket } from "socket.io";
import { socketRoom } from "./roomManager";

import { checkRateLimit } from "./rateLimiter";

type SignalPayload = {
  targetSocketId?: unknown;
  sdp?: unknown;
  candidate?: unknown;
};

function canSignal(socket: Socket, targetSocketId: unknown): targetSocketId is string {
  if (typeof targetSocketId !== "string" || !targetSocketId || targetSocketId === socket.id) return false;
  const roomId = socketRoom.get(socket.id);
  return Boolean(roomId && socketRoom.get(targetSocketId) === roomId);
}

export function registerSignalHandlers(io: SocketIOServer, socket: Socket) {
  socket.on("signal:offer", (payload: SignalPayload) => {
    if (!checkRateLimit(socket.id, "signal:offer", { maxEvents: 20, windowMs: 2000 })) return;
    const { targetSocketId, sdp } = payload || {};
    if (!canSignal(socket, targetSocketId) || !sdp) return;

    io.to(targetSocketId).emit("signal:offer", {
      fromSocketId: socket.id,
      sdp,
    });
  });

  socket.on("signal:answer", (payload: SignalPayload) => {
    if (!checkRateLimit(socket.id, "signal:answer", { maxEvents: 20, windowMs: 2000 })) return;
    const { targetSocketId, sdp } = payload || {};
    if (!canSignal(socket, targetSocketId) || !sdp) return;

    io.to(targetSocketId).emit("signal:answer", {
      fromSocketId: socket.id,
      sdp,
    });
  });

  socket.on("signal:ice-candidate", (payload: SignalPayload) => {
    if (!checkRateLimit(socket.id, "signal:ice-candidate", { maxEvents: 60, windowMs: 2000 })) return;
    const { targetSocketId, candidate } = payload || {};
    if (!canSignal(socket, targetSocketId) || !candidate) return;

    io.to(targetSocketId).emit("signal:ice-candidate", {
      fromSocketId: socket.id,
      candidate,
    });
  });
}
