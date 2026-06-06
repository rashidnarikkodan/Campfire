"use client";

import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import { useRoomStore } from "@/store/roomStore";

export function useRoom({ socket }: { socket: Socket | null }) {
  const roomId = useRoomStore((s) => s.roomId);
  const peers = useRoomStore((s) => s.peers);
  const setRoomId = useRoomStore((s) => s.setRoomId);
  const setPeers = useRoomStore((s) => s.setPeers);
  const addPeer = useRoomStore((s) => s.addPeer);
  const removePeer = useRoomStore((s) => s.removePeer);
  const reset = useRoomStore((s) => s.reset);

  useEffect(() => {
    if (!socket) return;

    socket.emit("room:join");

    const onJoined = ({ roomId, peers }: { roomId: string; peers: string[] }) => {
      setRoomId(roomId);
      setPeers(peers);
    };

    const onPeerJoined = ({ socketId }: { socketId: string }) => {
      addPeer(socketId);
    };

    const onPeerLeft = ({ socketId }: { socketId: string }) => {
      removePeer(socketId);
    };

    socket.on("room:joined", onJoined);
    socket.on("room:peer-joined", onPeerJoined);
    socket.on("room:peer-left", onPeerLeft);

    return () => {
      socket.emit("room:leave");
      socket.off("room:joined", onJoined);
      socket.off("room:peer-joined", onPeerJoined);
      socket.off("room:peer-left", onPeerLeft);
      reset();
    };
  }, [socket, setRoomId, setPeers, addPeer, removePeer, reset]);

  return { roomId, peers };
}
