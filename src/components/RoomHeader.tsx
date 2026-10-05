"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Flame, LogOut, Sparkles } from "lucide-react";
import SoundscapeToggle from "./SoundscapeToggle";
import { useRoomStore } from "@/store/roomStore";

interface RoomHeaderProps {
  roomId: string;
  onStoke?: () => void;
}

export default function RoomHeader({ roomId, onStoke }: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);
  const stokeCount = useRoomStore((s) => s.stokeCount);

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
    <header className="z-20 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl bg-forest-night/60 px-3.5 py-2.5 backdrop-blur-xl border border-ash/[0.08] shadow-lg">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className="relative flex items-center justify-center">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div className="absolute inset-0 rounded-full bg-emerald-500/40 blur-xs" />
          </div>
          <div className="flex items-center gap-1">
            <span className="hidden xs:inline text-xs font-bold uppercase tracking-wider text-smoke/90">
              Campfire
            </span>
            <span className="rounded-md bg-ash/[0.08] px-2 py-0.5 font-mono text-[0.72rem] sm:text-xs font-semibold text-flame border border-flame/20">
              #{roomId}
            </span>
          </div>
        </div>

        <button
          onClick={copyInviteLink}
          title="Copy invite link to share this campfire"
          className="inline-flex items-center gap-1 rounded-full bg-ash/[0.06] px-2.5 py-1 text-[0.7rem] font-medium text-smoke transition hover:bg-ash/[0.12] hover:text-ash active:scale-95 touch-manipulation min-h-[30px]"
        >
          {copied ? (
            <>
              <Check size={12} className="text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied link!</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Invite</span>
            </>
          )}
        </button>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {onStoke && (
          <button
            onClick={onStoke}
            title="Toss dry wood to stoke the flame"
            className="inline-flex items-center gap-1 rounded-full bg-amber-950/50 px-2.5 sm:px-3 py-1 text-xs font-semibold text-flame transition hover:bg-amber-900/60 active:scale-95 border border-flame/30 touch-manipulation min-h-[32px]"
          >
            <Sparkles size={12} className="text-ember animate-spin-slow" />
            <span>Stoke</span>
            {stokeCount > 0 && (
              <span className="rounded-full bg-flame/25 px-1.5 py-0.2 text-[0.65rem] font-mono text-ash font-bold">
                {stokeCount}
              </span>
            )}
          </button>
        )}

        <SoundscapeToggle />

        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-full bg-ash/[0.06] px-2.5 py-1 text-xs font-medium text-smoke transition hover:bg-red-950/40 hover:text-red-300 active:scale-95 touch-manipulation min-h-[32px]"
        >
          <LogOut size={13} />
          <span className="hidden xs:inline">Leave</span>
        </Link>
      </div>
    </header>
  );
}
