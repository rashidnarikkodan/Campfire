"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Socket } from "socket.io-client";
import { useVoiceStore } from "@/store/voiceStore";

interface UseVoiceProps {
  socket: Socket | null;
  roomId: string | null;
}

export function useVoice({ socket, roomId }: UseVoiceProps) {
  const isSpeaking = useVoiceStore((s) => s.isSpeaking);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const activeSpeakers = useVoiceStore((s) => s.activeSpeakers);

  const setIsSpeaking = useVoiceStore((s) => s.setIsSpeaking);
  const setIsMuted = useVoiceStore((s) => s.setIsMuted);
  const setActiveSpeakers = useVoiceStore((s) => s.setActiveSpeakers);

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const initLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        console.warn("getUserMedia not available - check HTTPS and permissions");
        setIsMuted(true);
        return null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      setIsMuted(false);
      return stream;
    } catch (err) {
      console.error("Failed to get local audio stream:", err);
      setIsMuted(true);
      return null;
    }
  }, [setIsMuted]);

  const removeConnection = useCallback((peerId: string) => {
    const pc = pcsRef.current.get(peerId);
    if (pc) {
      pc.close();
      pcsRef.current.delete(peerId);
    }
    const audio = remoteAudioRef.current.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      document.body.removeChild(audio);
      remoteAudioRef.current.delete(peerId);
    }
  }, []);

  const setupPeerConnection = useCallback(
    (peerId: string, stream: MediaStream) => {
      const existing = pcsRef.current.get(peerId);
      if (existing && existing.connectionState !== "closed") return existing;

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
        ],
      });

      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("signal:ice-candidate", {
            targetSocketId: peerId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (remoteStream) {
          let audio = remoteAudioRef.current.get(peerId);
          if (!audio) {
            audio = new Audio();
            audio.autoplay = true;
            (audio as any).playsInline = true;
            audio.volume = 1;
            document.body.appendChild(audio);
            remoteAudioRef.current.set(peerId, audio);
          }
          audio.srcObject = remoteStream;
          audio.play().catch((err) => {
            console.warn(`Autoplay prevented for ${peerId}:`, err);
            audio?.play().catch(() => {});
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`Connection state with ${peerId}: ${pc.connectionState}`);
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          removeConnection(peerId);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`ICE connection state with ${peerId}: ${pc.iceConnectionState}`);
      };

      pcsRef.current.set(peerId, pc);
      return pc;
    },
    [socket, removeConnection]
  );

  const initiateConnection = useCallback(
    async (peerId: string) => {
      if (pcsRef.current.has(peerId)) return;
      const stream = await initLocalStream();
      if (!stream || !socket) return;

      const pc = setupPeerConnection(peerId, stream);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("signal:offer", {
          targetSocketId: peerId,
          sdp: pc.localDescription,
        });
      } catch (err) {
        console.error(`Error creating offer to peer ${peerId}:`, err);
      }
    },
    [socket, initLocalStream, setupPeerConnection]
  );

  const startSpeaking = useCallback(async () => {
    if (isMuted) return;

    const stream = localStreamRef.current || await initLocalStream();
    if (!stream) return;

    const hasAudioTracks = stream.getAudioTracks().length > 0;
    if (!hasAudioTracks) {
      console.warn("No audio tracks available");
      return;
    }

    setIsSpeaking(true);
    stream.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });

    if (socket && roomId) {
      socket.emit("voice:speaking", { roomId, isSpeaking: true });
    }
  }, [socket, roomId, isMuted, setIsSpeaking, initLocalStream]);

  const stopSpeaking = useCallback(() => {
    setIsSpeaking(false);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }

    if (socket && roomId) {
      socket.emit("voice:speaking", { roomId, isSpeaking: false });
    }
  }, [socket, roomId, setIsSpeaking]);

  useEffect(() => {
    if (!socket) return;

    const onRoomJoined = ({ peers }: { peers: string[] }) => {
      peers.forEach((peerId) => {
        initiateConnection(peerId);
      });
    };

    const onPeerLeft = ({ socketId }: { socketId: string }) => {
      removeConnection(socketId);
      const current = useVoiceStore.getState().activeSpeakers;
      setActiveSpeakers(current.filter((id) => id !== socketId));
    };

    const onSignalOffer = async ({
      fromSocketId,
      sdp,
    }: {
      fromSocketId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      const stream = await initLocalStream();
      if (!stream) return;

      let pc = pcsRef.current.get(fromSocketId);
      if (!pc) {
        pc = setupPeerConnection(fromSocketId, stream);
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("signal:answer", {
          targetSocketId: fromSocketId,
          sdp: pc.localDescription,
        });
      } catch (err) {
        console.error(`Error handling offer from peer ${fromSocketId}:`, err);
      }
    };

    const onSignalAnswer = async ({
      fromSocketId,
      sdp,
    }: {
      fromSocketId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      const pc = pcsRef.current.get(fromSocketId);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        } catch (err) {
          console.error(`Error setting remote description from answer:`, err);
        }
      }
    };

    const onSignalCandidate = async ({
      fromSocketId,
      candidate,
    }: {
      fromSocketId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const pc = pcsRef.current.get(fromSocketId);
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error(`Error adding ICE candidate:`, err);
        }
      }
    };

    const onVoiceSpeaking = ({
      socketId,
      isSpeaking,
    }: {
      socketId: string;
      isSpeaking: boolean;
    }) => {
      const current = useVoiceStore.getState().activeSpeakers;
      if (isSpeaking) {
        if (!current.includes(socketId)) {
          setActiveSpeakers([...current, socketId]);
        }
      } else {
        setActiveSpeakers(current.filter((id) => id !== socketId));
      }
    };

    socket.on("room:joined", onRoomJoined);
    socket.on("room:peer-left", onPeerLeft);
    socket.on("signal:offer", onSignalOffer);
    socket.on("signal:answer", onSignalAnswer);
    socket.on("signal:ice-candidate", onSignalCandidate);
    socket.on("voice:speaking", onVoiceSpeaking);

    initLocalStream();

    return () => {
      socket.off("room:joined", onRoomJoined);
      socket.off("room:peer-left", onPeerLeft);
      socket.off("signal:offer", onSignalOffer);
      socket.off("signal:answer", onSignalAnswer);
      socket.off("signal:ice-candidate", onSignalCandidate);
      socket.off("voice:speaking", onVoiceSpeaking);

      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
      remoteAudioRef.current.forEach((audio) => {
        audio.pause();
        audio.srcObject = null;
        if (audio.parentNode) {
          document.body.removeChild(audio);
        }
      });
      remoteAudioRef.current.clear();

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      setIsSpeaking(false);
      setActiveSpeakers([]);
    };
  }, [
    socket,
    initiateConnection,
    initLocalStream,
    setupPeerConnection,
    removeConnection,
    setActiveSpeakers,
    setIsSpeaking,
  ]);

  return {
    isSpeaking,
    isMuted,
    activeSpeakers,
    startSpeaking,
    stopSpeaking,
  };
}
