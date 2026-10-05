import { randomUUID } from "crypto";
import { Server as SocketIOServer, Socket } from "socket.io";
import { MAX_MESSAGE_LENGTH } from "../lib/constants";
import { socketRoom, rooms } from "./roomManager";

import { checkRateLimit } from "./rateLimiter";

export function registerChatHandlers(io: SocketIOServer, socket: Socket) {
  socket.on(
    "chat:send",
    (data: { roomId?: unknown; text?: unknown; senderName?: unknown }) => {
      if (!checkRateLimit(socket.id, "chat:send", { maxEvents: 4, windowMs: 2000 })) return;

      const roomId = typeof data?.roomId === "string" ? data.roomId : undefined;
      const text = typeof data?.text === "string" ? data.text : undefined;
      const senderName = typeof data?.senderName === "string" ? data.senderName : undefined;

      if (!roomId || !text || !text.trim()) return;

      const userRoomId = socketRoom.get(socket.id);
      if (userRoomId !== roomId) return;

      const room = rooms.get(roomId);
      const peer = room?.peers.get(socket.id);

      const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);
      const effectiveSenderName =
        senderName?.trim().slice(0, 32) || peer?.displayName || "Stranger";

      const message = {
        id: randomUUID(),
        senderId: socket.id,
        senderName: effectiveSenderName,
        text: trimmed,
        timestamp: Date.now(),
        isSystem: false,
      };

      io.to(roomId).emit("chat:message", message);
    }
  );
}
