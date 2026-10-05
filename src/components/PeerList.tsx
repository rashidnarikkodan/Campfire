"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Edit3, Flame, Mic, MicOff, RefreshCw } from "lucide-react";
import type { Socket } from "socket.io-client";
import { useRoomStore } from "@/store/roomStore";
import { useUserStore } from "@/store/userStore";
import { useVoiceStore } from "@/store/voiceStore";
import { useVoice } from "@/hooks/useVoice";

type PeerListProps = {
  socket: Socket | null;
  roomId?: string | null;
  onUpdateName?: (newName: string) => void;
};

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const avatarHue = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
};

const isTypingTarget = (target: Element | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target?.getAttribute("contenteditable") === "true";

export default function PeerList({ socket, roomId, onUpdateName }: PeerListProps) {
  const peers = useRoomStore((state) => state.peers);
  const localName = useUserStore((state) => state.displayName) ?? "you";
  const setDisplayName = useUserStore((state) => state.setDisplayName);
  const randomizeName = useUserStore((state) => state.randomizeName);

  const activeSpeakers = useVoiceStore((state) => state.activeSpeakers);
  const localSpeaking = useVoiceStore((state) => state.isSpeaking);
  const localAudioLevel = useVoiceStore((state) => state.localAudioLevel);

  const {
    handsFreeMode,
    hasMicPermission,
    requestMicPermission,
    startSpeaking,
    stopSpeaking,
    toggleMic,
  } = useVoice({ socket, roomId: roomId || null });

  const [isEditingName, setIsEditingName] = useState(false);
  const [editingText, setEditingText] = useState("");
  const [reportedPeer, setReportedPeer] = useState<string | null>(null);

  const total = peers.length + 1;

  // Spacebar Push-To-Talk listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (handsFreeMode) return;
      if (event.code !== "Space" || event.repeat || isTypingTarget(document.activeElement)) return;
      event.preventDefault();
      if (!hasMicPermission) {
        requestMicPermission();
      } else {
        startSpeaking();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (handsFreeMode) return;
      if (event.code !== "Space" || isTypingTarget(document.activeElement)) return;
      event.preventDefault();
      stopSpeaking();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [startSpeaking, stopSpeaking, handsFreeMode, hasMicPermission, requestMicPermission]);

  const handleStartEdit = () => {
    setEditingText(localName);
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    const trimmed = editingText.trim();
    if (trimmed && trimmed !== localName) {
      setDisplayName(trimmed);
      if (onUpdateName) {
        onUpdateName(trimmed);
      }
    }
    setIsEditingName(false);
  };

  const handleRollName = () => {
    const newName = randomizeName();
    if (onUpdateName) {
      onUpdateName(newName);
    }
  };

  const handleReport = (targetSocketId: string, name: string) => {
    if (!socket) return;
    if (window.confirm(`Report ${name} for disrupting the campfire circle?`)) {
      socket.emit("mod:report", { targetSocketId });
      setReportedPeer(targetSocketId);
      setTimeout(() => setReportedPeer(null), 3000);
    }
  };

  const people = [
    {
      id: socket?.id ?? "local",
      name: localName,
      mine: true,
      speaking: localSpeaking,
      reconnecting: false,
      audioLevel: localSpeaking ? Math.min(localAudioLevel * 2, 1) : 0,
    },
    ...peers.map((peer) => ({
      id: peer.socketId,
      name: peer.displayName,
      mine: false,
      speaking: activeSpeakers.includes(peer.socketId) || peer.isSpeaking,
      reconnecting: peer.presenceState === "RECONNECTING",
      audioLevel: activeSpeakers.includes(peer.socketId) || peer.isSpeaking ? 0.8 : 0,
    })),
  ];

  const isLiveMic = localSpeaking || handsFreeMode;

  return (
    <div className="relative w-full h-full min-h-full pointer-events-none select-none">
      {/* 3D Campfire Ring of People Pills surrounding the hearth */}
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        {people.map((person, index) => {
          const hue = avatarHue(person.name);
          const isReported = reportedPeer === person.id;

          // Calculate ring angle & offsets around the campfire base (Center: 50%, 65%)
          let angleRad = Math.PI / 2; // Default 90 deg (bottom center) if 1 person
          if (total > 1) {
            const startAngle = (165 * Math.PI) / 180;
            const endAngle = (15 * Math.PI) / 180;
            const step = (endAngle - startAngle) / (total - 1);
            angleRad = startAngle + index * step;
          }

          // Ellipse radii: Rx horizontal spread, Ry depth perspective
          const cos = Math.cos(angleRad);
          const sin = Math.sin(angleRad);

          return (
            <div
              key={person.id}
              className="absolute pointer-events-auto transition-all duration-500 ease-out transform -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `calc(50% + ${cos * -1} * min(36vw, 360px))`,
                top: `calc(65% + ${sin} * min(18vh, 120px))`,
                zIndex: Math.round(10 + sin * 10),
              }}
            >
              <div
                className={`group relative flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-xl border transition-all duration-300 shadow-xl ${
                  person.speaking
                    ? "bg-amber-950/80 border-flame text-ash shadow-flame/30 scale-105"
                    : "bg-forest-night/80 border-ash/15 text-ash/90 hover:bg-forest-night/95 hover:border-flame/40"
                }`}
              >
                {/* Avatar circle with speaking pulse */}
                <div className="relative flex items-center justify-center shrink-0">
                  {person.speaking && (
                    <div
                      className="absolute -inset-1 rounded-full bg-flame/50 animate-ping"
                      style={{ animationDuration: "1.5s" }}
                    />
                  )}
                  <span
                    className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white shadow-inner"
                    style={{
                      backgroundColor: `hsl(${hue}, 45%, 32%)`,
                      border: `1.8px solid hsl(${hue}, 65%, 58%)`,
                    }}
                  >
                    {initials(person.name)}
                  </span>
                </div>

                {/* Name & status */}
                <div className="flex flex-col min-w-0">
                  <span className="max-w-28 sm:max-w-36 truncate text-xs font-semibold tracking-tight">
                    {person.name}
                    {person.mine && <span className="ml-1 text-flame text-[0.68rem] font-normal">(you)</span>}
                    {person.reconnecting && (
                      <span className="ml-1 text-amber-400 text-[0.65rem] italic font-normal">
                        (reconnecting...)
                      </span>
                    )}
                  </span>
                </div>

                {/* Speaking Voice Waves */}
                {person.speaking ? (
                  <div className="ml-0.5 flex h-4 items-center gap-0.5" aria-label="Speaking">
                    <span className="h-2 w-0.8 rounded-full bg-flame animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-3.5 w-0.8 rounded-full bg-flame animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-2.5 w-0.8 rounded-full bg-flame animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                ) : null}

                {/* Report button */}
                {!person.mine && (
                  <button
                    onClick={() => handleReport(person.id, person.name)}
                    title={`Report ${person.name}`}
                    aria-label={`Report ${person.name}`}
                    className="grid h-5 w-5 place-items-center rounded-full text-smoke/50 opacity-80 sm:opacity-0 group-hover:opacity-100 transition hover:bg-red-950/50 hover:text-red-400 ml-0.5 touch-manipulation"
                  >
                    <AlertTriangle size={11} />
                  </button>
                )}

                {isReported && (
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-red-900/90 px-1.5 py-0.5 text-[0.65rem] text-red-200">
                    Reported
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Control Bar */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        {/* Left: Stranger Count Badge */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-forest-night/80 px-3.5 py-1.5 backdrop-blur-xl border border-ash/15 text-xs text-smoke shadow-lg">
          <Flame size={14} className="text-flame animate-pulse shrink-0" />
          <span className="truncate">
            <strong className="text-ash font-bold">{total}</strong> {total === 1 ? "stranger" : "strangers"} by hearth
          </span>
        </div>

        {/* Right: Controls & Mic Toggle Button */}
        <div className="pointer-events-auto flex items-center gap-2">
          {isEditingName ? (
            <div className="flex items-center gap-1.5 rounded-2xl bg-forest-night/80 p-1.5 backdrop-blur-xl border border-ash/15 shadow-lg">
              <input
                type="text"
                value={editingText}
                onChange={(e) => setEditingText(e.target.value.slice(0, 24))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") setIsEditingName(false);
                }}
                className="campfire-input text-xs text-ash py-1 px-2.5 w-28 sm:w-36"
                autoFocus
              />
              <button
                onClick={handleSaveName}
                className="rounded-xl bg-flame/20 px-3 py-1.5 text-xs font-bold text-flame hover:bg-flame/30 active:scale-95 touch-manipulation min-h-[30px]"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleStartEdit}
                title="Edit your alias"
                className="inline-flex items-center gap-1.5 rounded-xl bg-forest-night/80 px-3 py-1.5 text-xs font-medium text-smoke hover:text-ash hover:bg-forest-night/95 backdrop-blur-xl border border-ash/15 transition active:scale-95 touch-manipulation min-h-[32px] shadow-lg"
              >
                <Edit3 size={12} />
                <span>Rename</span>
              </button>
              <button
                onClick={handleRollName}
                title="Generate new nature alias"
                aria-label="Generate new alias"
                className="grid h-8 w-8 place-items-center rounded-xl bg-forest-night/80 text-smoke hover:text-ash hover:bg-forest-night/95 backdrop-blur-xl border border-ash/15 transition active:scale-95 touch-manipulation shadow-lg"
              >
                <RefreshCw size={12} />
              </button>
            </div>
          )}

          {/* Mic Control Button at Bottom Right */}
          <button
            onClick={toggleMic}
            title={isLiveMic ? "Mic is live - Click to mute" : "Mic is muted - Click to turn on or hold Spacebar"}
            className={`flex items-center gap-2 rounded-full px-4 py-4 text-xs font-bold transition active:scale-95 touch-manipulation shadow-xl ${
              isLiveMic
                ? "bg-flame text-forest-night shadow-flame/30 animate-pulse border border-white/20"
                : "bg-amber-500/20 text-flame hover:bg-flame/30 border border-flame/40 backdrop-blur-xl"
            }`}
          >
            {isLiveMic ? <Mic size={16} /> : <MicOff size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
