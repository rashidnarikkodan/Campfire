import { randomUUID } from "crypto";
import { Server as SocketIOServer, Socket } from "socket.io";
import { MAX_MESSAGE_LENGTH } from "../lib/constants";
import { socketRoom, rooms } from "./roomManager";

export function registerChatHandlers(io: SocketIOServer, socket: Socket) {
  socket.on(
    "chat:send",
    ({ roomId, text, senderName }: { roomId: string; text: string; senderName?: string }) => {
      const userRoomId = socketRoom.get(socket.id);
      if (userRoomId !== roomId) return;
      if (typeof text !== "string" || !text.trim()) return;

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
