import { Server as SocketIOServer, Socket } from "socket.io";
import { REPORT_COOLDOWN_MS, REPORT_THRESHOLD } from "../lib/constants";

const reportScores = new Map<string, Set<string>>();
const cooldowns = new Map<string, number>();

function getSessionId(socket: Socket) {
  const sessionId = socket.handshake.auth?.sessionId;
  return typeof sessionId === "string" && sessionId.length > 0 ? sessionId : socket.id;
}

export function getJoinCooldownRemaining(socket: Socket) {
  const sessionId = getSessionId(socket);
  const expiry = cooldowns.get(sessionId);
  if (!expiry) return 0;

  const remainingMs = expiry - Date.now();
  if (remainingMs <= 0) {
    cooldowns.delete(sessionId);
    return 0;
  }

  return remainingMs;
}

export function registerModerationHandlers(io: SocketIOServer, socket: Socket) {
  socket.on("mod:report", ({ targetSocketId }: { targetSocketId: string }) => {
    if (!targetSocketId || targetSocketId === socket.id) return;
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (!targetSocket) return;

    const reporterSession = getSessionId(socket);
    const reporters = reportScores.get(targetSocketId) ?? new Set<string>();
    reporters.add(reporterSession);
    reportScores.set(targetSocketId, reporters);

    console.log(`[mod] ${socket.id} reported ${targetSocketId} (score: ${reporters.size})`);

    if (reporters.size >= REPORT_THRESHOLD) {
      io.to(targetSocketId).emit("mod:kicked", {
        reason: "You were removed by the community.",
      });

      cooldowns.set(getSessionId(targetSocket), Date.now() + REPORT_COOLDOWN_MS);
      targetSocket.disconnect(true);
      reportScores.delete(targetSocketId);
    }
  });

  socket.on("disconnect", () => {
    reportScores.delete(socket.id);
  });
}
