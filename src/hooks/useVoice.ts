"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Socket } from "socket.io-client";
import { useVoiceStore } from "@/store/voiceStore";
import type { PeerInfo } from "@/server/roomManager";

interface UseVoiceProps {
  socket: Socket | null;
  roomId: string | null;
}

function getIceServers(): RTCConfiguration {
  const defaultStun: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ];

  const turnUrls = process.env.NEXT_PUBLIC_TURN_URLS;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (turnUrls) {
    const urls = turnUrls.split(",").map((u) => u.trim()).filter(Boolean);
    if (urls.length > 0) {
      const turnServer: RTCIceServer = { urls };
      if (turnUsername) turnServer.username = turnUsername;
      if (turnCredential) turnServer.credential = turnCredential;
      return { iceServers: [...defaultStun, turnServer] };
    }
  }

  if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
    console.warn(
      "[WebRTC Production Blocker Warning] NEXT_PUBLIC_TURN_URLS is not configured. Peers behind strict symmetric NAT or enterprise cellular firewalls will fail WebRTC audio connection."
    );
  }

  return { iceServers: defaultStun };
}

export function useVoice({ socket, roomId }: UseVoiceProps) {
  const isSpeaking = useVoiceStore((s) => s.isSpeaking);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const activeSpeakers = useVoiceStore((s) => s.activeSpeakers);
  const handsFreeMode = useVoiceStore((s) => s.handsFreeMode);
  const localAudioLevel = useVoiceStore((s) => s.localAudioLevel);
  const hasMicPermission = useVoiceStore((s) => s.hasMicPermission);
  const permissionError = useVoiceStore((s) => s.permissionError);
  const audioAutoplayBlocked = useVoiceStore((s) => s.audioAutoplayBlocked);

  const availableMics = useVoiceStore((s) => s.availableMics);
  const availableSpeakers = useVoiceStore((s) => s.availableSpeakers);
  const selectedMicId = useVoiceStore((s) => s.selectedMicId);
  const selectedSpeakerId = useVoiceStore((s) => s.selectedSpeakerId);
  const isSettingsOpen = useVoiceStore((s) => s.isSettingsOpen);

  const setIsSpeaking = useVoiceStore((s) => s.setIsSpeaking);
  const setIsMuted = useVoiceStore((s) => s.setIsMuted);
  const setActiveSpeakers = useVoiceStore((s) => s.setActiveSpeakers);
  const setLocalAudioLevel = useVoiceStore((s) => s.setLocalAudioLevel);
  const setHandsFreeMode = useVoiceStore((s) => s.setHandsFreeMode);
  const setHasMicPermission = useVoiceStore((s) => s.setHasMicPermission);
  const setPermissionError = useVoiceStore((s) => s.setPermissionError);
  const setAudioAutoplayBlocked = useVoiceStore((s) => s.setAudioAutoplayBlocked);

  const setAvailableMics = useVoiceStore((s) => s.setAvailableMics);
  const setAvailableSpeakers = useVoiceStore((s) => s.setAvailableSpeakers);
  const setSelectedMicId = useVoiceStore((s) => s.setSelectedMicId);
  const setSelectedSpeakerId = useVoiceStore((s) => s.setSelectedSpeakerId);
  const setIsSettingsOpen = useVoiceStore((s) => s.setIsSettingsOpen);

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const ignoreOfferRef = useRef<Map<string, boolean>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Enumerate input (mics) and output (speakers) audio devices
  const refreshDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((d) => d.kind === "audioinput");
      const speakers = devices.filter((d) => d.kind === "audiooutput");

      setAvailableMics(mics);
      setAvailableSpeakers(speakers);
    } catch (err) {
      console.warn("Error enumerating audio devices:", err);
    }
  }, [setAvailableMics, setAvailableSpeakers]);

  // Resume AudioContext & unlock audio elements blocked by browser policy
  const ensureAudioContextActive = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }

    let allPlayedSuccessfully = true;
    remoteAudioRef.current.forEach((audio) => {
      if (audio.paused && audio.srcObject) {
        audio.play().then(() => {
          setAudioAutoplayBlocked(false);
        }).catch(() => {
          allPlayedSuccessfully = false;
          setAudioAutoplayBlocked(true);
        });
      }
    });

    if (allPlayedSuccessfully) {
      setAudioAutoplayBlocked(false);
    }
  }, [setAudioAutoplayBlocked]);

  // Request or initialize local microphone stream
  const initLocalStream = useCallback(async (targetMicId?: string): Promise<MediaStream | null> => {
    if (localStreamRef.current && !targetMicId) {
      return localStreamRef.current;
    }

    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setIsMuted(true);
        setHasMicPermission(false);
        setPermissionError("Microphone API not supported in this browser.");
        return null;
      }

      const micId = targetMicId || useVoiceStore.getState().selectedMicId;
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      if (micId && micId !== "default") {
        audioConstraints.deviceId = { exact: micId };
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });

      localStreamRef.current = stream;

      const currentIsSpeaking = useVoiceStore.getState().isSpeaking;
      const currentHandsFree = useVoiceStore.getState().handsFreeMode;
      const shouldBeEnabled = currentIsSpeaking || currentHandsFree;

      stream.getAudioTracks().forEach((track) => {
        track.enabled = shouldBeEnabled;
      });

      setIsMuted(false);
      setHasMicPermission(true);
      setPermissionError(null);

      // Refresh device labels after mic permission is granted
      refreshDevices();

      // Attach newly acquired stream tracks & update transceivers on all active peer connections
      pcsRef.current.forEach((pc) => {
        stream.getAudioTracks().forEach((track) => {
          const senders = pc.getSenders();
          const audioSender = senders.find(
            (s) => s.track?.kind === "audio" || (s.track === null && !s.track)
          );

          if (audioSender) {
            audioSender.replaceTrack(track).catch((e) => {
              console.warn("Failed replacing audio track on peer connection:", e);
            });
          } else {
            try {
              pc.addTrack(track, stream);
            } catch (e) {
              console.warn("Failed adding audio track to peer connection:", e);
            }
          }

          // Ensure transceiver is set to sendrecv so bidirectional audio flows
          pc.getTransceivers().forEach((t) => {
            if (t.sender === audioSender || t.receiver.track.kind === "audio") {
              if (t.direction !== "sendrecv") {
                t.direction = "sendrecv";
              }
            }
          });
        });
      });

      // Setup audio analyzer for visual volume feedback
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
          }
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          if (audioCtx.state === "suspended") {
            audioCtx.resume().catch(() => {});
          }
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const checkVolume = () => {
            if (analyserRef.current) {
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const average = sum / dataArray.length;
              setLocalAudioLevel(average / 128);
            }
            animFrameRef.current = requestAnimationFrame(checkVolume);
          };
          animFrameRef.current = requestAnimationFrame(checkVolume);
        }
      } catch (err) {
        console.warn("Audio Context / Analyser setup warning:", err);
      }

      return stream;
    } catch (err: unknown) {
      console.warn("Could not get microphone access (will operate in listen-only mode):", err);
      setIsMuted(true);
      setHasMicPermission(false);

      const errorObj = err as { name?: string; message?: string };
      if (errorObj.name === "NotAllowedError" || errorObj.name === "PermissionDeniedError") {
        setPermissionError("Microphone access denied. Click 'Turn On Mic' to grant permission.");
      } else if (errorObj.name === "NotFoundError" || errorObj.name === "DevicesNotFoundError") {
        setPermissionError("No microphone hardware found on your device.");
      } else if (errorObj.name === "NotReadableError" || errorObj.name === "TrackStartError") {
        setPermissionError("Microphone is currently in use by another application.");
      } else {
        setPermissionError(errorObj.message || "Microphone access failed.");
      }
      return null;
    }
  }, [setIsMuted, setHasMicPermission, setPermissionError, setLocalAudioLevel, refreshDevices]);

  // Change Microphone Device
  const changeMic = useCallback(
    async (deviceId: string) => {
      setSelectedMicId(deviceId);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      const newStream = await initLocalStream(deviceId);
      return newStream;
    },
    [setSelectedMicId, initLocalStream]
  );

  // Change Speaker / Headphones Output Device
  const changeSpeaker = useCallback(
    async (deviceId: string) => {
      setSelectedSpeakerId(deviceId);
      remoteAudioRef.current.forEach((audio) => {
        if ("setSinkId" in audio && typeof (audio as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId === "function") {
          (audio as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(deviceId).catch((err) => {
            console.warn(`Error setting speaker sink ID ${deviceId}:`, err);
          });
        }
      });
    },
    [setSelectedSpeakerId]
  );

  // Clean up single peer connection
  const removeConnection = useCallback((peerId: string) => {
    makingOfferRef.current.delete(peerId);
    ignoreOfferRef.current.delete(peerId);
    pendingIceCandidatesRef.current.delete(peerId);

    const pc = pcsRef.current.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onnegotiationneeded = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.onsignalingstatechange = null;

      try {
        pc.getSenders().forEach((sender) => {
          if (sender.track) {
            sender.track.stop();
          }
        });
      } catch (err) {
        console.warn(`Error stopping senders for peer ${peerId}:`, err);
      }

      try {
        pc.close();
      } catch (err) {
        console.warn(`Error closing peer connection for ${peerId}:`, err);
      }
      pcsRef.current.delete(peerId);
    }

    const audio = remoteAudioRef.current.get(peerId);
    if (audio) {
      audio.pause();
      if (audio.srcObject instanceof MediaStream) {
        audio.srcObject.getTracks().forEach((track) => track.stop());
      }
      audio.srcObject = null;
      if (audio.parentNode) {
        audio.parentNode.removeChild(audio);
      }
      remoteAudioRef.current.delete(peerId);
    }
  }, []);

  // Flush queued ICE candidates
  const flushIceCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queue = pendingIceCandidatesRef.current.get(peerId);
    if (queue && queue.length > 0) {
      const candidates = [...queue];
      pendingIceCandidatesRef.current.delete(peerId);
      for (const candidate of candidates) {
        try {
          if (pc.signalingState !== "closed" && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (err) {
          console.warn(`Error adding queued ICE candidate for ${peerId}:`, err);
        }
      }
    }
  }, []);

  // Setup Peer Connection with Perfect Negotiation pattern & bidirectional audio
  const setupPeerConnection = useCallback(
    (peerId: string) => {
      const existing = pcsRef.current.get(peerId);
      if (existing && existing.connectionState !== "closed") return existing;

      const pc = new RTCPeerConnection(getIceServers());
      pcsRef.current.set(peerId, pc);

      const stream = localStreamRef.current;
      if (stream && stream.getAudioTracks().length > 0) {
        stream.getAudioTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      } else {
        try {
          pc.addTransceiver("audio", { direction: "sendrecv" });
        } catch (err) {
          console.warn("Failed to add sendrecv transceiver:", err);
        }
      }

      // Handle renegotiation needed (WebRTC Perfect Negotiation)
      pc.onnegotiationneeded = async () => {
        if (!socket) return;
        if (pc.signalingState !== "stable") return;
        try {
          makingOfferRef.current.set(peerId, true);
          const offer = await pc.createOffer();
          if (pc.signalingState !== "stable") return;
          await pc.setLocalDescription(offer);

          socket.emit("signal:offer", {
            targetSocketId: peerId,
            sdp: pc.localDescription,
          });
        } catch (err) {
          console.error(`Error during offer creation to ${peerId}:`, err);
        } finally {
          makingOfferRef.current.set(peerId, false);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("signal:ice-candidate", {
            targetSocketId: peerId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        const remoteTrack = event.track;
        const remoteStream =
          event.streams && event.streams[0]
            ? event.streams[0]
            : new MediaStream([remoteTrack]);

        let audio = remoteAudioRef.current.get(peerId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          (audio as unknown as { playsInline: boolean }).playsInline = true;
          audio.volume = 1.0;
          audio.muted = false;

          // Apply selected output speaker sinkId if supported
          const currentSpeakerId = useVoiceStore.getState().selectedSpeakerId;
          if (currentSpeakerId && currentSpeakerId !== "default" && "setSinkId" in audio) {
            (audio as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(currentSpeakerId).catch(() => {});
          }

          document.body.appendChild(audio);
          remoteAudioRef.current.set(peerId, audio);
        }

        audio.srcObject = remoteStream;

        const playAudio = () => {
          if (audio) {
            audio.play().then(() => {
              setAudioAutoplayBlocked(false);
            }).catch((err) => {
              console.warn(`Autoplay prevented for remote audio from ${peerId}:`, err);
              setAudioAutoplayBlocked(true);

              const resumeListener = () => {
                audio?.play().then(() => {
                  setAudioAutoplayBlocked(false);
                }).catch(() => {});
                window.removeEventListener("click", resumeListener);
                window.removeEventListener("keydown", resumeListener);
                window.removeEventListener("pointerdown", resumeListener);
                window.removeEventListener("touchstart", resumeListener);
              };
              window.addEventListener("click", resumeListener, { once: true });
              window.addEventListener("keydown", resumeListener, { once: true });
              window.addEventListener("pointerdown", resumeListener, { once: true });
              window.addEventListener("touchstart", resumeListener, { once: true });
            });
          }
        };

        playAudio();
        remoteTrack.onunmute = playAudio;
      };

      let disconnectTimer: NodeJS.Timeout | null = null;

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") {
          if (disconnectTimer) {
            clearTimeout(disconnectTimer);
            disconnectTimer = null;
          }
        } else if (state === "failed") {
          console.warn(`Peer Connection with ${peerId} failed, attempting restart...`);
          try {
            if (pc.signalingState === "stable") {
              pc.restartIce();
            } else {
              removeConnection(peerId);
            }
          } catch {
            removeConnection(peerId);
          }
        } else if (state === "disconnected") {
          if (disconnectTimer) clearTimeout(disconnectTimer);
          disconnectTimer = setTimeout(() => {
            const currentPc = pcsRef.current.get(peerId);
            if (
              currentPc &&
              (currentPc.connectionState === "disconnected" || currentPc.connectionState === "failed")
            ) {
              removeConnection(peerId);
            }
          }, 6000);
        } else if (state === "closed") {
          removeConnection(peerId);
        }
      };

      pc.oniceconnectionstatechange = () => {
        const iceState = pc.iceConnectionState;
        if (iceState === "failed") {
          try {
            if (pc.signalingState === "stable") {
              pc.restartIce();
            }
          } catch {
            removeConnection(peerId);
          }
        } else if (iceState === "closed") {
          removeConnection(peerId);
        }
      };

      return pc;
    },
    [socket, removeConnection, setAudioAutoplayBlocked]
  );

  const initiateConnection = useCallback(
    async (peerId: string) => {
      if (!socket || peerId === socket.id) return;
      setupPeerConnection(peerId);
    },
    [socket, setupPeerConnection]
  );

  const requestMicPermission = useCallback(async () => {
    ensureAudioContextActive();
    return await initLocalStream();
  }, [ensureAudioContextActive, initLocalStream]);

  const startSpeaking = useCallback(async () => {
    ensureAudioContextActive();

    let stream = localStreamRef.current;
    if (!stream) {
      stream = await initLocalStream();
    }

    if (!stream) {
      console.warn("Cannot start speaking: no microphone stream available.");
      return;
    }

    setIsSpeaking(true);
    stream.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });

    pcsRef.current.forEach((pc) => {
      pc.getTransceivers().forEach((t) => {
        if (t.receiver.track.kind === "audio" || t.sender.track?.kind === "audio") {
          if (t.direction !== "sendrecv") {
            t.direction = "sendrecv";
          }
        }
      });
    });

    if (socket && roomId) {
      socket.emit("voice:speaking", { roomId, isSpeaking: true });
    }
  }, [socket, roomId, setIsSpeaking, initLocalStream, ensureAudioContextActive]);

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

  // Click to toggle Mic ON / OFF (Toggle mode)
  const toggleMic = useCallback(async () => {
    ensureAudioContextActive();

    if (hasMicPermission === false || hasMicPermission === null) {
      await requestMicPermission();
      return;
    }

    if (isSpeaking || handsFreeMode) {
      setHandsFreeMode(false);
      stopSpeaking();
    } else {
      setHandsFreeMode(true);
      await startSpeaking();
    }
  }, [
    isSpeaking,
    handsFreeMode,
    hasMicPermission,
    requestMicPermission,
    startSpeaking,
    stopSpeaking,
    setHandsFreeMode,
    ensureAudioContextActive,
  ]);

  const toggleHandsFree = useCallback(async () => {
    ensureAudioContextActive();
    if (!handsFreeMode) {
      setHandsFreeMode(true);
      await startSpeaking();
    } else {
      setHandsFreeMode(false);
      stopSpeaking();
    }
  }, [handsFreeMode, setHandsFreeMode, startSpeaking, stopSpeaking, ensureAudioContextActive]);

  useEffect(() => {
    if (!socket) return;

    const onRoomJoined = ({ peers }: { peers: PeerInfo[] }) => {
      const activeSocketIds = new Set(peers.map((p) => p.socketId));
      pcsRef.current.forEach((_, peerId) => {
        if (!activeSocketIds.has(peerId)) {
          removeConnection(peerId);
        }
      });

      peers.forEach((peer) => {
        if (peer.socketId !== socket.id) {
          initiateConnection(peer.socketId);
        }
      });
    };

    const onPeerJoined = ({ peer }: { peer: PeerInfo }) => {
      if (peer.socketId !== socket.id) {
        initiateConnection(peer.socketId);
      }
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
      if (!socket || !socket.id || fromSocketId === socket.id) return;
      const isPolite = socket.id > fromSocketId;

      let pc = pcsRef.current.get(fromSocketId);
      if (!pc) {
        pc = setupPeerConnection(fromSocketId);
      }

      const offerCollision =
        makingOfferRef.current.get(fromSocketId) || pc.signalingState !== "stable";

      ignoreOfferRef.current.set(fromSocketId, !isPolite && offerCollision);
      if (ignoreOfferRef.current.get(fromSocketId)) {
        return;
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushIceCandidates(fromSocketId, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("signal:answer", {
          targetSocketId: fromSocketId,
          sdp: pc.localDescription,
        });
      } catch (err) {
        console.error(`Error answering offer from ${fromSocketId}:`, err);
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
        if (ignoreOfferRef.current.get(fromSocketId)) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          await flushIceCandidates(fromSocketId, pc);
        } catch (err) {
          console.error(`Error handling answer from ${fromSocketId}:`, err);
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
      if (!candidate) return;
      const pc = pcsRef.current.get(fromSocketId);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn(`Error adding direct ICE candidate from ${fromSocketId}:`, err);
        }
      } else {
        const queue = pendingIceCandidatesRef.current.get(fromSocketId) || [];
        queue.push(candidate);
        pendingIceCandidatesRef.current.set(fromSocketId, queue);
      }
    };

    const onVoiceSpeaking = ({
      socketId,
      isSpeaking: peerSpeaking,
    }: {
      socketId: string;
      isSpeaking: boolean;
    }) => {
      const current = useVoiceStore.getState().activeSpeakers;
      if (peerSpeaking) {
        if (!current.includes(socketId)) {
          setActiveSpeakers([...current, socketId]);
        }
      } else {
        setActiveSpeakers(current.filter((id) => id !== socketId));
      }
    };

    socket.on("room:joined", onRoomJoined);
    socket.on("room:peer-joined", onPeerJoined);
    socket.on("room:peer-left", onPeerLeft);
    socket.on("signal:offer", onSignalOffer);
    socket.on("signal:answer", onSignalAnswer);
    socket.on("signal:ice-candidate", onSignalCandidate);
    socket.on("voice:speaking", onVoiceSpeaking);

    // Eagerly request mic permission & enumerate audio devices
    initLocalStream();
    refreshDevices();

    // Listen for hardware plug/unplug events
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
    }

    return () => {
      if (typeof navigator !== "undefined" && navigator.mediaDevices) {
        navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
      }

      socket.off("room:joined", onRoomJoined);
      socket.off("room:peer-joined", onPeerJoined);
      socket.off("room:peer-left", onPeerLeft);
      socket.off("signal:offer", onSignalOffer);
      socket.off("signal:answer", onSignalAnswer);
      socket.off("signal:ice-candidate", onSignalCandidate);
      socket.off("voice:speaking", onVoiceSpeaking);

      pcsRef.current.forEach((pc) => {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onnegotiationneeded = null;
        pc.onconnectionstatechange = null;
        pc.close();
      });
      pcsRef.current.clear();
      makingOfferRef.current.clear();
      ignoreOfferRef.current.clear();
      pendingIceCandidatesRef.current.clear();

      remoteAudioRef.current.forEach((audio) => {
        audio.pause();
        audio.srcObject = null;
        if (audio.parentNode) {
          audio.parentNode.removeChild(audio);
        }
      });
      remoteAudioRef.current.clear();

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }

      setIsSpeaking(false);
      setActiveSpeakers([]);
      setLocalAudioLevel(0);
    };
  }, [
    socket,
    initLocalStream,
    initiateConnection,
    setupPeerConnection,
    removeConnection,
    flushIceCandidates,
    setActiveSpeakers,
    setIsSpeaking,
    setLocalAudioLevel,
    refreshDevices,
  ]);

  return {
    isSpeaking,
    isMuted,
    activeSpeakers,
    localAudioLevel,
    handsFreeMode,
    hasMicPermission,
    permissionError,
    audioAutoplayBlocked,
    availableMics,
    availableSpeakers,
    selectedMicId,
    selectedSpeakerId,
    isSettingsOpen,
    setIsSettingsOpen,
    changeMic,
    changeSpeaker,
    refreshDevices,
    requestMicPermission,
    ensureAudioContextActive,
    startSpeaking,
    stopSpeaking,
    toggleMic,
    toggleHandsFree,
  };
}
