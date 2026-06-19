"use client";

import { useEffect } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import type { Socket } from "socket.io-client";
import { useVoice } from "@/hooks/useVoice";
import { generateName } from "@/lib/nameGenerator";

type VoiceBarProps = {
  socket: Socket | null;
  roomId: string | null;
};

const isTypingTarget = (target: Element | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target?.getAttribute("contenteditable") === "true";

export default function VoiceBar({ socket, roomId }: VoiceBarProps) {
  const { isSpeaking, isMuted, activeSpeakers, startSpeaking, stopSpeaking } = useVoice({
    socket,
    roomId,
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || isTypingTarget(document.activeElement)) return;
      event.preventDefault();
      startSpeaking();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
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
  }, [startSpeaking, stopSpeaking]);

  const speakerText =
    activeSpeakers.length > 0
      ? `${activeSpeakers.map((id) => generateName(id)).join(", ")} ${
          activeSpeakers.length === 1 ? "is" : "are"
        } speaking`
      : isSpeaking
        ? "Your voice is drifting into the night"
        : isMuted
          ? "Microphone unavailable"
          : "Hold Space or press the mic";

  return (
    <section className="flex items-center justify-between gap-2 sm:gap-4 rounded-xl sm:rounded-[1.8rem] bg-forest-night/10 backdrop-blur-xl px-3 sm:px-4 py-3 sm:py-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Volume2 size={14} className={`shrink-0 sm:w-4 sm:h-4 ${activeSpeakers.length ? "text-flame" : "text-smoke"}`} />
        <p className="truncate text-xs sm:text-sm leading-5 sm:leading-6 text-smoke">{speakerText}</p>
      </div>
      <button
        onPointerDown={(event) => {
          event.preventDefault();
          startSpeaking();
        }}
        onPointerUp={(event) => {
          event.preventDefault();
          stopSpeaking();
        }}
        onPointerCancel={stopSpeaking}
        onPointerLeave={() => {
          if (isSpeaking) stopSpeaking();
        }}
        disabled={isMuted || !roomId}
        aria-label={isSpeaking ? "Stop speaking" : "Push to talk"}
        className={`grid h-12 sm:h-14 w-12 sm:w-14 shrink-0 place-items-center rounded-full transition active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${
          isSpeaking ? "bg-ember text-forest-night shadow-lg shadow-ember/50" : "bg-ash/10 text-ash hover:bg-ash/15 active:bg-ash/20"
        }`}
      >
        {isMuted ? <MicOff size={20} className="sm:w-[22px] sm:h-[22px]" /> : <Mic size={20} className="sm:w-[22px] sm:h-[22px]" />}
      </button>
    </section>
  );
}
