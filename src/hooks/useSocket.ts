"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useUserStore } from "@/store/userStore";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "";

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [socketState, setSocketState] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const sessionId = useUserStore((s) => s.sessionId);

  useEffect(() => {
    if (!sessionId) return;

    const socket = io(SOCKET_URL, {
      auth: { sessionId },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 8,
      timeout: 8000,
    });

    socketRef.current = socket;
    setSocketState(socket);

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketState(null);
      setConnected(false);
    };
  }, [sessionId]);

  return { socket: socketState, connected };
}
