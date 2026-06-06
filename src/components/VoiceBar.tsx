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
    <section className="flex items-center justify-between gap-4 rounded-[1.8rem] bg-forest-night/10 backdrop-blur-xl px-4 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <Volume2 size={16} className={activeSpeakers.length ? "text-flame" : "text-smoke"} />
        <p className="truncate text-xs leading-6 text-smoke sm:text-sm">{speakerText}</p>
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
        className={`grid h-14 w-14 shrink-0 place-items-center rounded-full transition disabled:pointer-events-none disabled:opacity-40 ${
          isSpeaking ? "bg-ember text-forest-night" : "bg-ash/10 text-ash hover:bg-ash/15"
        }`}
      >
        {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
      </button>
    </section>
  );
}
