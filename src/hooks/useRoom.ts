"use client";

import { useEffect, useCallback } from "react";
import type { Socket } from "socket.io-client";
import { useRoomStore } from "@/store/roomStore";
import { useUserStore } from "@/store/userStore";
import { ambientAudio } from "@/lib/ambientAudio";
import type { PeerInfo } from "@/server/roomManager";

export function useRoom({
  socket,
  targetRoomId,
  isPrivate,
}: {
  socket: Socket | null;
  targetRoomId?: string | null;
  isPrivate?: boolean;
}) {
  const roomId = useRoomStore((s) => s.roomId);
  const peers = useRoomStore((s) => s.peers);
  const setRoomId = useRoomStore((s) => s.setRoomId);
  const setPeers = useRoomStore((s) => s.setPeers);
  const addPeer = useRoomStore((s) => s.addPeer);
  const removePeer = useRoomStore((s) => s.removePeer);
  const updatePeer = useRoomStore((s) => s.updatePeer);
  const setTypingUser = useRoomStore((s) => s.setTypingUser);
  const incrementStoke = useRoomStore((s) => s.incrementStoke);
  const setStokeCount = useRoomStore((s) => s.setStokeCount);
  const reset = useRoomStore((s) => s.reset);

  const displayName = useUserStore((s) => s.displayName);
  const sessionId = useUserStore((s) => s.sessionId);

  useEffect(() => {
    if (!socket) return;

    const join = () => {
      const currentDisplayName = useUserStore.getState().displayName;
      const currentSessionId = useUserStore.getState().sessionId;
      socket.emit("room:join", {
        roomId: targetRoomId || undefined,
        displayName: currentDisplayName || undefined,
        sessionId: currentSessionId || undefined,
        isPrivate: Boolean(isPrivate),
      });
    };

    if (socket.connected) {
      join();
    }

    socket.on("connect", join);

    const onJoined = ({
      roomId,
      peers,
      stokeCount,
    }: {
      roomId: string;
      peerInfo: PeerInfo;
      peers: PeerInfo[];
      stokeCount?: number;
    }) => {
      setRoomId(roomId);
      setPeers(peers);
      if (typeof stokeCount === "number") {
        setStokeCount(stokeCount);
      }
    };

    const onPeerJoined = ({ peer }: { peer: PeerInfo }) => {
      addPeer(peer);
    };

    const onPeerLeft = ({ socketId }: { socketId: string; displayName: string }) => {
      removePeer(socketId);
    };

    const onPeerUpdated = ({
      socketId,
      displayName,
    }: {
      socketId: string;
      displayName: string;
    }) => {
      updatePeer(socketId, { displayName });
    };

    const onStoked = ({
      displayName,
      stokeCount,
    }: {
      socketId: string;
      displayName: string;
      stokeCount: number;
    }) => {
      incrementStoke(displayName);
      setStokeCount(stokeCount);
      ambientAudio.playStokeSound();
    };

    const onTyping = ({
      socketId,
      displayName,
      isTyping,
    }: {
      socketId: string;
      displayName: string;
      isTyping: boolean;
    }) => {
      setTypingUser(socketId, displayName, isTyping);
    };

    socket.on("room:joined", onJoined);
    socket.on("room:peer-joined", onPeerJoined);
    socket.on("room:peer-left", onPeerLeft);
    socket.on("room:peer-updated", onPeerUpdated);
    socket.on("campfire:stoked", onStoked);
    socket.on("chat:typing", onTyping);

    return () => {
      socket.off("connect", join);
      socket.off("room:joined", onJoined);
      socket.off("room:peer-joined", onPeerJoined);
      socket.off("room:peer-left", onPeerLeft);
      socket.off("room:peer-updated", onPeerUpdated);
      socket.off("campfire:stoked", onStoked);
      socket.off("chat:typing", onTyping);
      if (socket.connected) {
        socket.emit("room:leave");
      }
      reset();
    };
  }, [
    socket,
    targetRoomId,
    isPrivate,
    setRoomId,
    setPeers,
    addPeer,
    removePeer,
    updatePeer,
    setTypingUser,
    incrementStoke,
    setStokeCount,
    reset,
  ]);

  const stokeFire = useCallback(() => {
    if (socket && roomId) {
      socket.emit("campfire:stoke");
    }
  }, [socket, roomId]);

  const updateDisplayName = useCallback(
    (name: string) => {
      if (socket && roomId) {
        socket.emit("room:update-name", { displayName: name });
      }
    },
    [socket, roomId]
  );

  return { roomId, peers, stokeFire, updateDisplayName };
}
