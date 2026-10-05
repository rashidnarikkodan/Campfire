"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, LogOut, Settings, Sparkles } from "lucide-react";
import AudioSettingsModal from "./AudioSettingsModal";
import { useRoomStore } from "@/store/roomStore";
import { useVoiceStore } from "@/store/voiceStore";
import type { Socket } from "socket.io-client";

interface RoomHeaderProps {
  roomId: string;
  socket?: Socket | null;
  onStoke?: () => void;
}

export default function RoomHeader({ roomId, socket, onStoke }: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);
  const stokeCount = useRoomStore((s) => s.stokeCount);
  const isSettingsOpen = useVoiceStore((s) => s.isSettingsOpen);
  const setIsSettingsOpen = useVoiceStore((s) => s.setIsSettingsOpen);

  const copyInviteLink = async () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/room?room=${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      {isSettingsOpen && (
        <AudioSettingsModal
          socket={socket || null}
          roomId={roomId}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      <header className="sticky top-0 z-50 flex w-full items-center justify-between gap-2 bg-forest-night/85 px-3 py-2 sm:px-4 sm:py-2.5 backdrop-blur-xl border-b border-ash/[0.1] rounded-b-2xl rounded-t-none shadow-md">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative flex items-center justify-center">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div className="absolute inset-0 rounded-full bg-emerald-500/40 blur-xs" />
            </div>
            <span className="rounded-md bg-ash/[0.08] px-2 py-0.5 font-mono text-xs font-semibold text-flame border border-flame/20 truncate">
              #{roomId}
            </span>
          </div>

          <button
            onClick={copyInviteLink}
            title="Copy invite link to share this campfire"
            className="inline-flex items-center gap-1 rounded-full bg-ash/[0.06] px-2.5 py-1 text-[0.7rem] font-medium text-smoke transition hover:bg-ash/[0.12] hover:text-ash active:scale-95 touch-manipulation min-h-[30px]"
          >
            {copied ? (
              <>
                <Check size={12} className="text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span className="hidden xs:inline">Invite</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onStoke && (
            <button
              onClick={onStoke}
              title="Stoke the flame"
              className="inline-flex items-center gap-1 rounded-full bg-amber-950/50 px-2.5 sm:px-3 py-1 text-xs font-semibold text-flame transition hover:bg-amber-900/60 active:scale-95 border border-flame/30 touch-manipulation min-h-[32px]"
            >
              <Sparkles size={12} className="text-ember animate-spin-slow" />
              <span className="hidden xs:inline">Stoke</span>
              {stokeCount > 0 && (
                <span className="rounded-full bg-flame/25 px-1.5 py-0.2 text-[0.65rem] font-mono text-ash font-bold">
                  {stokeCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Audio & Device Settings"
            className="inline-flex items-center justify-center p-2 rounded-full bg-ash/[0.06] text-smoke transition hover:bg-ash/[0.12] hover:text-ash active:scale-95 touch-manipulation min-h-[32px] min-w-[32px]"
          >
            <Settings size={14} />
          </button>

          <Link
            href="/"
            title="Leave campfire"
            className="inline-flex items-center gap-1 rounded-full bg-ash/[0.06] px-2.5 py-1 text-xs font-medium text-smoke transition hover:bg-red-950/40 hover:text-red-300 active:scale-95 touch-manipulation min-h-[32px]"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Leave</span>
          </Link>
        </div>
      </header>
    </>
  );
}
