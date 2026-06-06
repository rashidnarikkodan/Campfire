"use client";

import { useEffect, useCallback } from "react";
import type { Socket } from "socket.io-client";
import { MAX_MESSAGE_LENGTH } from "@/lib/constants";
import { useRoomStore, type Message } from "@/store/roomStore";

export function useChat({
  socket,
  roomId,
}: {
  socket: Socket | null;
  roomId: string | null;
}) {
  const messages = useRoomStore((s) => s.messages);
  const addMessage = useRoomStore((s) => s.addMessage);

  useEffect(() => {
    if (!socket) return;

    const onMessage = (msg: Message) => {
      addMessage(msg);
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
      socket.emit("chat:send", { roomId, text: trimmed });
    },
    [socket, roomId]
  );

  return { messages, sendMessage };
}
