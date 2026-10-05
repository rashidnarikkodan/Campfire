"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useUserStore } from "@/store/userStore";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "";

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [socketState, setSocketState] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);
  const sessionId = useUserStore((s) => s.sessionId);
  const displayName = useUserStore((s) => s.displayName);

  useEffect(() => {
    if (!sessionId) return;

    if (!socketRef.current) {
      const socket = io(SOCKET_URL, {
        auth: { sessionId, displayName: displayName || undefined },
        transports: ["polling", "websocket"],
        reconnectionAttempts: 10, // Bounded retries
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000, // Exponential backoff up to 5s
        timeout: 10000,
      });

      socketRef.current = socket;
      setSocketState(socket);

      const onConnect = () => {
        setConnected(true);
        setConnectionFailed(false);
      };
      const onDisconnect = () => setConnected(false);
      const onConnectError = () => setConnected(false);
      const onReconnectFailed = () => {
        setConnected(false);
        setConnectionFailed(true);
      };

      socket.on("connect", onConnect);
      socket.on("disconnect", onDisconnect);
      socket.on("connect_error", onConnectError);
      socket.io.on("reconnect_failed", onReconnectFailed);

      if (socket.connected) {
        setConnected(true);
      }
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off("connect");
        socketRef.current.off("disconnect");
        socketRef.current.off("connect_error");
        socketRef.current.io.off("reconnect_failed");
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketState(null);
        setConnected(false);
      }
    };
  }, [sessionId]);

  return { socket: socketState, connected, connectionFailed };
}
