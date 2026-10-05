"use client";

import { useEffect, useCallback, useRef } from "react";
import type { Socket } from "socket.io-client";
import { MAX_MESSAGE_LENGTH } from "@/lib/constants";
import { useRoomStore, type Message } from "@/store/roomStore";
import { useUserStore } from "@/store/userStore";
import { ambientAudio } from "@/lib/ambientAudio";

export function useChat({
  socket,
  roomId,
}: {
  socket: Socket | null;
  roomId: string | null;
}) {
  const messages = useRoomStore((s) => s.messages);
  const addMessage = useRoomStore((s) => s.addMessage);
  const typingUsers = useRoomStore((s) => s.typingUsers);
  const displayName = useUserStore((s) => s.displayName);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!socket) return;

    const onMessage = (msg: Message) => {
      addMessage(msg);
      if (msg.senderId !== socket.id && !msg.isSystem) {
        ambientAudio.playMessageSound();
      }
    };

    socket.on("chat:message", onMessage);
    return () => {
      socket.off("chat:message", onMessage);
    };
  }, [socket, addMessage]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!socket || !roomId) return;
      const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);
      if (!trimmed) return;

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
        socket.emit("chat:typing", { isTyping: false });
      }

      socket.emit("chat:send", {
        roomId,
        text: trimmed,
        senderName: displayName || "Stranger",
      });
    },
    [socket, roomId, displayName]
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!socket || !roomId) return;

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      socket.emit("chat:typing", { isTyping });

      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          socket.emit("chat:typing", { isTyping: false });
        }, 2500);
      }
    },
    [socket, roomId]
  );

  return { messages, typingUsers, sendMessage, sendTyping };
}
