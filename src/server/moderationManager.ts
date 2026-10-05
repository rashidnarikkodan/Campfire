import { Server as SocketIOServer, Socket } from "socket.io";
import { REPORT_COOLDOWN_MS, REPORT_THRESHOLD } from "../lib/constants";
import { socketRoom, socketSession } from "./roomManager";
import { checkRateLimit } from "./rateLimiter";

const reportScores = new Map<string, Set<string>>();
const cooldowns = new Map<string, number>();

// Periodic cleanup of expired cooldowns (every 10 minutes)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, expiry] of cooldowns.entries()) {
    if (now >= expiry) {
      cooldowns.delete(key);
    }
  }
}, 10 * 60 * 1000);
if (cleanupInterval.unref) cleanupInterval.unref();

function getClientKeys(socket: Socket): string[] {
  const keys: string[] = [];
  const sessionFromMap = socketSession.get(socket.id);
  if (sessionFromMap) {
    keys.push(`session:${sessionFromMap}`);
  }
  const sessionId = socket.handshake.auth?.sessionId;
  if (typeof sessionId === "string" && sessionId.trim().length > 0) {
    keys.push(`session:${sessionId.trim()}`);
  }
  const ip = socket.handshake.address;
  if (typeof ip === "string" && ip.length > 0) {
    keys.push(`ip:${ip}`);
  }
  keys.push(`socket:${socket.id}`);
  return keys;
}

export function getJoinCooldownRemaining(socket: Socket): number {
  const keys = getClientKeys(socket);
  const now = Date.now();
  let maxRemaining = 0;

  for (const key of keys) {
    const expiry = cooldowns.get(key);
    if (expiry) {
      const remainingMs = expiry - now;
      if (remainingMs > 0) {
        maxRemaining = Math.max(maxRemaining, remainingMs);
      } else {
        cooldowns.delete(key);
      }
    }
  }

  return maxRemaining;
}

export function registerModerationHandlers(io: SocketIOServer, socket: Socket) {
  socket.on("mod:report", (data: { targetSocketId?: unknown }) => {
    if (!checkRateLimit(socket.id, "mod:report", { maxEvents: 2, windowMs: 10000 })) return;
    const targetSocketId = typeof data?.targetSocketId === "string" ? data.targetSocketId : undefined;

    if (!targetSocketId || targetSocketId === socket.id) return;

    // Verify reporter and target are in the same room
    const reporterRoom = socketRoom.get(socket.id);
    const targetRoom = socketRoom.get(targetSocketId);
    if (!reporterRoom || !targetRoom || reporterRoom !== targetRoom) return;

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (!targetSocket) return;

    const reporterSession = getClientKeys(socket)[0];
    const reporters = reportScores.get(targetSocketId) ?? new Set<string>();
    reporters.add(reporterSession);
    reportScores.set(targetSocketId, reporters);

    console.log(`[mod] ${socket.id} reported ${targetSocketId} (score: ${reporters.size}/${REPORT_THRESHOLD})`);

    if (reporters.size >= REPORT_THRESHOLD) {
      io.to(targetSocketId).emit("mod:kicked", {
        reason: "You were removed by the community.",
      });

      const expiry = Date.now() + REPORT_COOLDOWN_MS;
      for (const key of getClientKeys(targetSocket)) {
        cooldowns.set(key, expiry);
      }

      targetSocket.disconnect(true);
      reportScores.delete(targetSocketId);
    }
  });

  socket.on("disconnect", () => {
    reportScores.delete(socket.id);
  });
}

export function resetModerationForTesting(): void {
  reportScores.clear();
  cooldowns.clear();
}
