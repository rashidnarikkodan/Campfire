"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { MAX_MESSAGE_LENGTH } from "@/lib/constants";
import { useRoomStore, type Message } from "@/store/roomStore";
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
  const [chatError, setChatError] = useState<string | null>(null);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!socket) return;

    const onMessage = (msg: Message) => {
      addMessage(msg);
      if (msg.senderId !== socket.id && !msg.isSystem) {
        ambientAudio.playMessageSound();
      }
    };

    const onJoined = ({ recentMessages }: { recentMessages?: Message[] }) => {
      if (Array.isArray(recentMessages)) {
        recentMessages.forEach((msg) => addMessage(msg));
      }
    };

    const onError = (err: { code?: string; message?: string }) => {
      if (err?.message) {
        setChatError(err.message);
        if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = setTimeout(() => {
          setChatError(null);
        }, 4000);
      }
    };

    socket.on("chat:message", onMessage);
    socket.on("room:joined", onJoined);
    socket.on("chat:error", onError);

    return () => {
      socket.off("chat:message", onMessage);
      socket.off("room:joined", onJoined);
      socket.off("chat:error", onError);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
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

      setChatError(null);
      socket.emit("chat:send", {
        roomId,
        text: trimmed,
      });
    },
    [socket, roomId]
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

  return { messages, typingUsers, chatError, sendMessage, sendTyping };
}
