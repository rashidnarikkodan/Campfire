"use client";

import { useEffect } from "react";
import { Mic, MicOff, Radio, Volume2, Lock, AlertCircle, RefreshCw, Power, Settings } from "lucide-react";
import type { Socket } from "socket.io-client";
import { useVoice } from "@/hooks/useVoice";
import { useRoomStore } from "@/store/roomStore";
import AudioSettingsModal from "./AudioSettingsModal";

type VoiceBarProps = {
  socket: Socket | null;
  roomId: string | null;
};

const isTypingTarget = (target: Element | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target?.getAttribute("contenteditable") === "true";

export default function VoiceBar({ socket, roomId }: VoiceBarProps) {
  const {
    isSpeaking,
    isMuted,
    activeSpeakers,
    localAudioLevel,
    handsFreeMode,
    hasMicPermission,
    permissionError,
    isSettingsOpen,
    setIsSettingsOpen,
    requestMicPermission,
    startSpeaking,
    stopSpeaking,
    toggleMic,
    toggleHandsFree,
  } = useVoice({
    socket,
    roomId,
  });

  const peers = useRoomStore((s) => s.peers);

  // Spacebar Push-To-Talk
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

  const activeSpeakerNames = activeSpeakers
    .map((id) => peers.find((p) => p.socketId === id)?.displayName || "A stranger")
    .join(", ");

  const speakerStatus =
    activeSpeakers.length > 0
      ? `${activeSpeakerNames} ${activeSpeakers.length === 1 ? "is" : "are"} speaking`
      : isSpeaking
      ? handsFreeMode
        ? "Microphone is open (hands-free)"
        : "Your voice is live in the room"
      : hasMicPermission === false
      ? "Microphone is turned off / access required"
      : hasMicPermission === null
      ? "Checking microphone..."
      : "Mic is muted • Tap to turn on or hold Spacebar";

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Audio Device Settings Modal */}
      {isSettingsOpen && (
        <AudioSettingsModal
          socket={socket}
          roomId={roomId}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* Turn On Mic Banner when mic permission is off/denied */}
      {(hasMicPermission === false || permissionError) && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-950/70 p-3 px-3.5 border border-amber-500/40 text-xs text-amber-200 backdrop-blur-md shadow-lg animate-fade-up">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle size={16} className="text-amber-400 shrink-0" />
            <span className="truncate text-xs font-medium">
              {permissionError || "Microphone permission is off."}
            </span>
          </div>
          <button
            onClick={() => requestMicPermission()}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500/30 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/40 transition shrink-0 active:scale-95 touch-manipulation min-h-[36px]"
          >
            <RefreshCw size={13} />
            <span>Turn On Mic</span>
          </button>
        </div>
      )}

      <section className="flex items-center justify-between gap-3 rounded-2xl bg-forest-night/60 p-3 sm:p-3.5 backdrop-blur-xl border border-ash/[0.08] shadow-lg">
        {/* Left: Speaker Status & Visual Waves */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ash/[0.06] border border-ash/[0.08]">
            {activeSpeakers.length > 0 ? (
              <Volume2 size={17} className="text-flame animate-pulse" />
            ) : isSpeaking ? (
              <Radio size={17} className="text-ember animate-ping" />
            ) : (
              <Volume2 size={17} className="text-smoke/60" />
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-ash">
              {speakerStatus}
            </p>
            <p className="text-[0.66rem] text-smoke/70 truncate">
              {hasMicPermission === false
                ? "Click 'Turn On Mic' to transmit voice"
                : isSpeaking
                ? "Voice active • Click mic button to mute"
                : "Click mic button to turn ON mic • Hold [Space] to PTT"}
            </p>
          </div>
        </div>

        {/* Right: Controls, Device Settings & Mic Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Audio Settings Gear Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Audio Device Settings (Select Mic & Speaker)"
            aria-label="Audio device settings"
            className="grid h-10 w-10 place-items-center rounded-full bg-ash/[0.06] border border-ash/[0.08] text-smoke hover:bg-ash/[0.12] hover:text-ash transition active:scale-95 touch-manipulation"
          >
            <Settings size={16} />
          </button>

          {/* Quick Enable Mic Button if Mic is Off */}
          {hasMicPermission && !isSpeaking && !handsFreeMode && (
            <button
              onClick={toggleMic}
              title="Turn on microphone"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-flame/20 border border-flame/30 px-3 py-1.5 text-xs font-bold text-flame hover:bg-flame hover:text-forest-night transition active:scale-95 touch-manipulation min-h-[36px]"
            >
              <Power size={13} />
              <span>Turn On Mic</span>
            </button>
          )}

          <button
            onClick={toggleHandsFree}
            disabled={!roomId || hasMicPermission === false}
            title={handsFreeMode ? "Switch to push-to-talk" : "Lock mic open (hands-free)"}
            aria-label={handsFreeMode ? "Disable open mic" : "Enable open mic"}
            className={`grid h-10 w-10 place-items-center rounded-full transition border text-xs touch-manipulation ${
              handsFreeMode
                ? "bg-flame/25 border-flame text-flame shadow-md shadow-flame/20"
                : "bg-ash/[0.06] border-ash/[0.08] text-smoke hover:bg-ash/[0.12] hover:text-ash"
            } disabled:pointer-events-none disabled:opacity-30`}
          >
            <Lock size={15} className={handsFreeMode ? "text-flame" : "text-smoke"} />
          </button>

          <button
            onPointerDown={(e) => {
              if (!handsFreeMode && hasMicPermission) {
                startSpeaking();
              }
            }}
            onPointerUp={(e) => {
              if (!handsFreeMode && isSpeaking) {
                stopSpeaking();
              }
            }}
            onClick={() => {
              if (hasMicPermission === false || hasMicPermission === null) {
                requestMicPermission();
              } else if (!isSpeaking && !handsFreeMode) {
                toggleMic();
              } else if (handsFreeMode) {
                toggleHandsFree();
              }
            }}
            disabled={!roomId}
            aria-label={isSpeaking ? "Mute microphone" : "Turn on microphone"}
            title={
              hasMicPermission === false
                ? "Click to grant microphone access"
                : isSpeaking
                ? "Mic is ON (Click to mute)"
                : "Click to turn ON mic (or hold to speak)"
            }
            className={`group relative grid h-13 w-13 shrink-0 place-items-center rounded-full transition-all duration-200 select-none touch-none active:scale-95 touch-manipulation disabled:pointer-events-none disabled:opacity-35 ${
              isSpeaking
                ? "bg-gradient-to-tr from-ember to-flame text-forest-night shadow-xl shadow-flame/40 scale-105"
                : hasMicPermission === false
                ? "bg-amber-950/50 text-amber-400 border border-amber-500/40 hover:bg-amber-900/60 animate-pulse"
                : "bg-ash/[0.08] text-ash hover:bg-ash/[0.15] border border-ash/[0.12]"
            }`}
          >
            {/* Pulsing ring when speaking */}
            {isSpeaking && (
              <span className="absolute -inset-1.5 rounded-full border-2 border-flame/60 animate-ping" />
            )}

            {hasMicPermission === false ? (
              <MicOff size={22} className="text-amber-400" />
            ) : (
              <Mic size={22} className={isSpeaking ? "text-forest-night" : "text-flame"} />
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
