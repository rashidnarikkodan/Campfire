import { randomUUID } from "crypto";
import { Server as SocketIOServer, Socket } from "socket.io";
import { MAX_MESSAGE_LENGTH } from "../lib/constants";
import { socketRoom } from "./roomManager";

export function registerChatHandlers(io: SocketIOServer, socket: Socket) {
  socket.on("chat:send", ({ roomId, text }: { roomId: string; text: string }) => {
    if (socketRoom.get(socket.id) !== roomId) return;
    if (typeof text !== "string" || !text.trim()) return;
    const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);

    const message = {
      id: randomUUID(),
      senderId: socket.id,
      text: trimmed,
      timestamp: Date.now(),
    };

    io.to(roomId).emit("chat:message", message);
  });
}
