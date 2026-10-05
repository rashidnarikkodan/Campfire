"use client";

import { useState } from "react";
import { AlertTriangle, Edit3, Flame, RefreshCw, Volume2 } from "lucide-react";
import type { Socket } from "socket.io-client";
import { useRoomStore } from "@/store/roomStore";
import { useUserStore } from "@/store/userStore";
import { useVoiceStore } from "@/store/voiceStore";

type PeerListProps = {
  socket: Socket | null;
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

export default function PeerList({ socket, onUpdateName }: PeerListProps) {
  const peers = useRoomStore((state) => state.peers);
  const localName = useUserStore((state) => state.displayName) ?? "you";
  const setDisplayName = useUserStore((state) => state.setDisplayName);
  const randomizeName = useUserStore((state) => state.randomizeName);

  const activeSpeakers = useVoiceStore((state) => state.activeSpeakers);
  const localSpeaking = useVoiceStore((state) => state.isSpeaking);
  const localAudioLevel = useVoiceStore((state) => state.localAudioLevel);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editingText, setEditingText] = useState("");
  const [reportedPeer, setReportedPeer] = useState<string | null>(null);

  const total = peers.length + 1;

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
      audioLevel: localSpeaking ? Math.min(localAudioLevel * 2, 1) : 0,
    },
    ...peers.map((peer) => ({
      id: peer.socketId,
      name: peer.displayName,
      mine: false,
      speaking: activeSpeakers.includes(peer.socketId) || peer.isSpeaking,
      audioLevel: activeSpeakers.includes(peer.socketId) || peer.isSpeaking ? 0.8 : 0,
    })),
  ];

  return (
    <section className="rounded-2xl bg-forest-night/60 p-3 sm:p-3.5 backdrop-blur-xl border border-ash/[0.08] shadow-lg">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-smoke">
          <Flame size={14} className="text-ember shrink-0" />
          <span className="truncate">
            <strong className="text-ash font-semibold">{total}</strong> {total === 1 ? "stranger" : "strangers"} by hearth
          </span>
        </div>

        {isEditingName ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={editingText}
              onChange={(e) => setEditingText(e.target.value.slice(0, 24))}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") setIsEditingName(false);
              }}
              className="rounded-lg bg-ash/10 px-2 py-1 text-xs text-ash focus:outline-none focus:ring-1 focus:ring-flame w-24 sm:w-32"
              autoFocus
            />
            <button
              onClick={handleSaveName}
              className="rounded-lg bg-flame/20 px-2.5 py-1 text-xs font-semibold text-flame hover:bg-flame/30 active:scale-95 touch-manipulation min-h-[28px]"
            >
              Save
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleStartEdit}
              title="Edit your alias"
              className="inline-flex items-center gap-1 rounded-lg bg-ash/[0.06] px-2.5 py-1 text-[0.7rem] font-medium text-smoke hover:text-ash hover:bg-ash/[0.12] transition active:scale-95 touch-manipulation min-h-[28px]"
            >
              <Edit3 size={11} />
              <span>Rename</span>
            </button>
            <button
              onClick={handleRollName}
              title="Generate new nature alias"
              aria-label="Generate new alias"
              className="grid h-7 w-7 place-items-center rounded-lg bg-ash/[0.06] text-smoke hover:text-ash hover:bg-ash/[0.12] transition active:scale-95 touch-manipulation"
            >
              <RefreshCw size={11} />
            </button>
          </div>
        )}
      </div>

      <div className="scrollbar-none flex flex-wrap gap-1.5 sm:gap-2 max-h-32 overflow-y-auto pt-0.5">
        {people.map((person) => {
          const hue = avatarHue(person.name);
          const isReported = reportedPeer === person.id;

          return (
            <div
              key={person.id}
              className={`group relative flex items-center gap-2 rounded-full px-2.5 py-1.5 transition-all duration-300 border ${
                person.speaking
                  ? "bg-amber-950/50 border-flame/50 text-ash shadow-md shadow-flame/20"
                  : "bg-ash/[0.05] border-ash/[0.06] text-ash/85 hover:bg-ash/[0.08]"
              }`}
            >
              {/* Avatar circle with speaking pulse */}
              <div className="relative flex items-center justify-center shrink-0">
                {person.speaking && (
                  <div
                    className="absolute -inset-1 rounded-full bg-flame/40 animate-ping"
                    style={{ animationDuration: "1.6s" }}
                  />
                )}
                <span
                  className="relative grid h-6 w-6 sm:h-7 sm:w-7 shrink-0 place-items-center rounded-full text-[0.65rem] sm:text-[0.68rem] font-bold text-white shadow-inner"
                  style={{
                    backgroundColor: `hsl(${hue}, 42%, 30%)`,
                    border: `1.5px solid hsl(${hue}, 60%, 55%)`,
                  }}
                >
                  {initials(person.name)}
                </span>
              </div>

              {/* Name & status */}
              <div className="flex flex-col min-w-0">
                <span className="max-w-24 sm:max-w-28 truncate text-xs font-medium tracking-tight">
                  {person.name}
                  {person.mine && <span className="ml-1 text-flame text-[0.68rem] font-normal">(you)</span>}
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
          );
        })}
      </div>
    </section>
  );
}
