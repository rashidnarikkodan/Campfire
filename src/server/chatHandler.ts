import { randomUUID } from "crypto";
import { Server as SocketIOServer, Socket } from "socket.io";
import { MAX_MESSAGE_LENGTH, MAX_PAYLOAD_BYTES } from "../lib/constants.js";
import { socketRoom, socketSession, rooms, addRoomMessage } from "./roomManager.js";
import { checkRateLimit } from "./rateLimiter.js";

import { incrementMetric } from "./metrics.js";

export function sanitizeText(input: string): string {
  // Strip control characters & null bytes, keeping printable characters & emojis
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
}

export function registerChatHandlers(io: SocketIOServer, socket: Socket) {
  socket.on("chat:send", (data: unknown) => {
    try {
      // 1. Enforce max payload size limit (2KB)
      const payloadString = JSON.stringify(data ?? {});
      if (payloadString.length > MAX_PAYLOAD_BYTES) {
        socket.emit("chat:error", {
          code: "PAYLOAD_TOO_LARGE",
          message: "Message payload exceeds size limit.",
        });
        return;
      }

      // 2. Burst and sustained rate limiting
      if (!checkRateLimit(socket.id, "chat:send:burst", { maxEvents: 3, windowMs: 2000 })) {
        socket.emit("chat:error", {
          code: "RATE_LIMITED",
          message: "You are sending messages too quickly. Please pause by the fire.",
        });
        return;
      }

      if (!checkRateLimit(socket.id, "chat:send:sustained", { maxEvents: 15, windowMs: 30000 })) {
        socket.emit("chat:error", {
          code: "RATE_LIMITED",
          message: "Message rate limit exceeded. Please wait a moment.",
        });
        return;
      }

      // 3. Payload & type validation
      const payload = data as { roomId?: unknown; text?: unknown };
      const roomId = typeof payload?.roomId === "string" ? payload.roomId.trim() : undefined;
      const rawText = typeof payload?.text === "string" ? payload.text : undefined;

      if (!roomId || !rawText) {
        socket.emit("chat:error", {
          code: "INVALID_PAYLOAD",
          message: "Message text and roomId are required.",
        });
        return;
      }

      // 4. Campfire membership validation
      const userRoomId = socketRoom.get(socket.id);
      const sessionId = socketSession.get(socket.id);
      if (!userRoomId || userRoomId !== roomId || !sessionId) {
        socket.emit("chat:error", {
          code: "NOT_IN_ROOM",
          message: "You must be a member of this Campfire to send messages.",
        });
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        socket.emit("chat:error", {
          code: "ROOM_NOT_FOUND",
          message: "Campfire not found.",
        });
        return;
      }

      // 5. Server-authoritative sender identity & name lookup
      const peer = room.peers.get(sessionId);
      if (!peer || peer.presenceState === "DISCONNECTED") {
        socket.emit("chat:error", {
          code: "NOT_IN_ROOM",
          message: "Participant session is not active in this room.",
        });
        return;
      }

      // 6. Text sanitization and bounds enforcement
      const sanitized = sanitizeText(rawText);
      if (!sanitized) {
        socket.emit("chat:error", {
          code: "EMPTY_MESSAGE",
          message: "Message cannot be empty.",
        });
        return;
      }

      const finalMessageText = sanitized.slice(0, MAX_MESSAGE_LENGTH);
      const now = Date.now();

      // 7. Store in room history & assign sequence ID
      const fullMessage = addRoomMessage(roomId, {
        id: randomUUID(),
        senderId: socket.id,
        sessionId,
        senderName: peer.displayName, // Authoritative sender name from server peer session!
        text: finalMessageText,
        timestamp: now,
        isSystem: false,
      });

      if (!fullMessage) return;

      // 8. Broadcast ordered message to all room participants
      io.to(roomId).emit("chat:message", fullMessage);
      incrementMetric.messagesSent();
    } catch (err) {
      console.error("[chatHandler] Unexpected error handling chat:send:", err);
      socket.emit("chat:error", {
        code: "SERVER_ERROR",
        message: "An error occurred while processing your message.",
      });
    }
  });
}
