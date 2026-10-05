import { Server as SocketIOServer, Socket } from "socket.io";
import { socketRoom, socketSession } from "./roomManager.js";
import { checkRateLimit } from "./rateLimiter.js";

type SignalPayload = {
  targetSocketId?: unknown;
  sdp?: unknown;
  candidate?: unknown;
};

const VALID_SDP_TYPES = new Set(["offer", "answer", "pranswer", "rollback"]);
const MAX_SDP_LENGTH = 10000;
const MAX_ICE_CANDIDATE_LENGTH = 1000;

function canSignal(socket: Socket, targetSocketId: unknown): targetSocketId is string {
  if (typeof targetSocketId !== "string" || !targetSocketId || targetSocketId === socket.id) {
    return false;
  }

  // Ensure both sender and target have active sessions
  const senderSession = socketSession.get(socket.id);
  const targetSession = socketSession.get(targetSocketId);
  if (!senderSession || !targetSession) {
    return false;
  }

  // Ensure both sockets belong to the same room
  const senderRoom = socketRoom.get(socket.id);
  const targetRoom = socketRoom.get(targetSocketId);
  if (!senderRoom || !targetRoom || senderRoom !== targetRoom) {
    return false;
  }

  return true;
}

function isValidSdp(sdp: unknown): sdp is { type: string; sdp: string } {
  if (!sdp || typeof sdp !== "object") return false;
  const s = sdp as { type?: unknown; sdp?: unknown };
  if (typeof s.type !== "string" || !VALID_SDP_TYPES.has(s.type)) return false;
  if (typeof s.sdp !== "string" || s.sdp.length === 0 || s.sdp.length > MAX_SDP_LENGTH) return false;
  return true;
}

function isValidIceCandidate(candidate: unknown): boolean {
  if (!candidate || typeof candidate !== "object") return false;
  const c = candidate as { candidate?: unknown; sdpMid?: unknown; sdpMLineIndex?: unknown };
  if (typeof c.candidate !== "string" || c.candidate.length > MAX_ICE_CANDIDATE_LENGTH) return false;
  if (c.sdpMid !== undefined && c.sdpMid !== null && typeof c.sdpMid !== "string") return false;
  if (c.sdpMLineIndex !== undefined && c.sdpMLineIndex !== null && typeof c.sdpMLineIndex !== "number") return false;
  return true;
}

export function registerSignalHandlers(io: SocketIOServer, socket: Socket) {
  socket.on("signal:offer", (payload: SignalPayload) => {
    try {
      if (!checkRateLimit(socket.id, "signal:offer", { maxEvents: 20, windowMs: 2000 })) {
        socket.emit("signal:error", { code: "RATE_LIMITED", message: "Signaling rate limit exceeded." });
        return;
      }
      const { targetSocketId, sdp } = payload || {};
      if (!canSignal(socket, targetSocketId) || !isValidSdp(sdp)) {
        socket.emit("signal:error", { code: "UNAUTHORIZED_SIGNAL", message: "Invalid target or SDP payload." });
        return;
      }

      io.to(targetSocketId).emit("signal:offer", {
        fromSocketId: socket.id,
        sdp,
      });
    } catch (err) {
      console.error("[signalHandler] Error handling signal:offer:", err);
    }
  });

  socket.on("signal:answer", (payload: SignalPayload) => {
    try {
      if (!checkRateLimit(socket.id, "signal:answer", { maxEvents: 20, windowMs: 2000 })) {
        socket.emit("signal:error", { code: "RATE_LIMITED", message: "Signaling rate limit exceeded." });
        return;
      }
      const { targetSocketId, sdp } = payload || {};
      if (!canSignal(socket, targetSocketId) || !isValidSdp(sdp)) {
        socket.emit("signal:error", { code: "UNAUTHORIZED_SIGNAL", message: "Invalid target or SDP payload." });
        return;
      }

      io.to(targetSocketId).emit("signal:answer", {
        fromSocketId: socket.id,
        sdp,
      });
    } catch (err) {
      console.error("[signalHandler] Error handling signal:answer:", err);
    }
  });

  socket.on("signal:ice-candidate", (payload: SignalPayload) => {
    try {
      if (!checkRateLimit(socket.id, "signal:ice-candidate", { maxEvents: 60, windowMs: 2000 })) {
        socket.emit("signal:error", { code: "RATE_LIMITED", message: "ICE candidate rate limit exceeded." });
        return;
      }
      const { targetSocketId, candidate } = payload || {};
      if (!canSignal(socket, targetSocketId) || !isValidIceCandidate(candidate)) {
        socket.emit("signal:error", { code: "UNAUTHORIZED_SIGNAL", message: "Invalid target or candidate payload." });
        return;
      }

      io.to(targetSocketId).emit("signal:ice-candidate", {
        fromSocketId: socket.id,
        candidate,
      });
    } catch (err) {
      console.error("[signalHandler] Error handling signal:ice-candidate:", err);
    }
  });
}

