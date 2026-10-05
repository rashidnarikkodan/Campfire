"use client";

import { useEffect, useState } from "react";
import { Mic, Volume2, X, Settings, Check, Play, RefreshCw, Edit3 } from "lucide-react";
import type { Socket } from "socket.io-client";
import { useVoice } from "@/hooks/useVoice";
import { useUserStore } from "@/store/userStore";

type AudioSettingsModalProps = {
  socket: Socket | null;
  roomId: string | null;
  onClose: () => void;
  onUpdateName?: (newName: string) => void;
};

export default function AudioSettingsModal({
  socket,
  roomId,
  onClose,
  onUpdateName,
}: AudioSettingsModalProps) {
  const displayName = useUserStore((s) => s.displayName) ?? "you";
  const setDisplayName = useUserStore((s) => s.setDisplayName);
  const randomizeName = useUserStore((s) => s.randomizeName);
  const [tempName, setTempName] = useState(displayName);

  const {
    availableMics,
    availableSpeakers,
    selectedMicId,
    selectedSpeakerId,
    localAudioLevel,
    changeMic,
    changeSpeaker,
    refreshDevices,
    requestMicPermission,
    hasMicPermission,
  } = useVoice({ socket, roomId });

  const [testPlaying, setTestPlaying] = useState(false);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  const handleTestSpeaker = () => {
    setTestPlaying(true);
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {
      // Ignore if Web Audio fails
    }
    setTimeout(() => setTestPlaying(false), 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-night/80 backdrop-blur-md animate-fade-up">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl bg-forest-night/90 p-5 sm:p-6 backdrop-blur-2xl border border-ash/[0.12] shadow-2xl shadow-flame/10 text-ash flex flex-col gap-5"
      >
        {/* Display Name & Alias Section */}
        <div className="flex flex-col gap-2 pb-2 border-b border-ash/[0.06]">
          <label className="flex items-center justify-between text-xs font-semibold text-ash">
            <span className="flex items-center gap-1.5">
              <Edit3 size={14} className="text-flame" />
              <span>Your Campfire Alias</span>
            </span>
            <button
              onClick={() => {
                const newName = randomizeName();
                setTempName(newName);
                if (onUpdateName) onUpdateName(newName);
              }}
              title="Generate new nature alias"
              className="text-[0.68rem] text-smoke hover:text-flame flex items-center gap-1 transition"
            >
              <RefreshCw size={11} />
              <span>Randomize</span>
            </button>
          </label>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tempName}
              onChange={(e) => {
                const val = e.target.value.slice(0, 24);
                setTempName(val);
              }}
              onBlur={() => {
                const trimmed = tempName.trim();
                if (trimmed) {
                  setDisplayName(trimmed);
                  if (onUpdateName) onUpdateName(trimmed);
                }
              }}
              placeholder="e.g. mossy-ember-42"
              className="campfire-input flex-1 text-xs text-ash py-2 px-3"
            />
            <button
              onClick={() => {
                const trimmed = tempName.trim();
                if (trimmed) {
                  setDisplayName(trimmed);
                  if (onUpdateName) onUpdateName(trimmed);
                }
              }}
              className="rounded-xl bg-flame/20 px-3 py-2 text-xs font-bold text-flame hover:bg-flame/30 active:scale-95 transition"
            >
              Save
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between border-b border-ash/[0.08] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-flame/20 text-flame border border-flame/30">
              <Settings size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ash">Audio Settings</h3>
              <p className="text-[0.68rem] text-smoke">Select your microphone and speakers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-smoke/70 hover:text-ash hover:bg-ash/10 transition active:scale-95"
          >
            <X size={16} />
          </button>
        </div>

        {/* Microphone Input Device Selection */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center justify-between text-xs font-semibold text-ash">
            <span className="flex items-center gap-1.5">
              <Mic size={14} className="text-flame" />
              <span>Microphone (Input Device)</span>
            </span>
            <button
              onClick={() => refreshDevices()}
              title="Refresh device list"
              className="text-[0.68rem] text-smoke hover:text-ash flex items-center gap-1"
            >
              <RefreshCw size={10} />
              <span>Refresh</span>
            </button>
          </label>

          {hasMicPermission === false ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-950/40 p-3 border border-amber-500/30 text-xs text-amber-200">
              <span>Mic access is turned off.</span>
              <button
                onClick={() => requestMicPermission()}
                className="rounded-lg bg-amber-500/30 px-2.5 py-1 text-xs font-bold text-amber-200 hover:bg-amber-500/40 transition shrink-0"
              >
                Allow Access
              </button>
            </div>
          ) : (
            <select
              value={selectedMicId}
              onChange={(e) => changeMic(e.target.value)}
              className="w-full rounded-xl bg-forest-night border border-ash/[0.12] p-2.5 text-xs text-ash focus:outline-none focus:ring-1 focus:ring-flame"
            >
              <option value="default">Default - System Microphone</option>
              {availableMics.map((mic, idx) => (
                <option key={mic.deviceId || idx} value={mic.deviceId}>
                  {mic.label || `Microphone ${idx + 1} (${mic.deviceId.slice(0, 8)}...)`}
                </option>
              ))}
            </select>
          )}

          {/* Live Mic Volume Level Meter */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[0.65rem] text-smoke/70 shrink-0">Mic Test:</span>
            <div className="flex-1 h-2 rounded-full bg-ash/[0.1] overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-ember to-flame transition-all duration-75"
                style={{ width: `${Math.min(100, localAudioLevel * 100)}%` }}
              />
            </div>
            <span className="text-[0.65rem] font-mono text-smoke/80 shrink-0 w-8 text-right">
              {Math.round(Math.min(100, localAudioLevel * 100))}%
            </span>
          </div>
        </div>

        {/* Speaker Output Device Selection */}
        <div className="flex flex-col gap-2 pt-1 border-t border-ash/[0.06]">
          <label className="flex items-center justify-between text-xs font-semibold text-ash">
            <span className="flex items-center gap-1.5">
              <Volume2 size={14} className="text-flame" />
              <span>Speakers / Headphones (Output Device)</span>
            </span>
          </label>

          <div className="flex items-center gap-2">
            <select
              value={selectedSpeakerId}
              onChange={(e) => changeSpeaker(e.target.value)}
              className="flex-1 rounded-xl bg-forest-night border border-ash/[0.12] p-2.5 text-xs text-ash focus:outline-none focus:ring-1 focus:ring-flame"
            >
              <option value="default">Default - System Output Speaker</option>
              {availableSpeakers.map((speaker, idx) => (
                <option key={speaker.deviceId || idx} value={speaker.deviceId}>
                  {speaker.label || `Speaker ${idx + 1} (${speaker.deviceId.slice(0, 8)}...)`}
                </option>
              ))}
            </select>

            <button
              onClick={handleTestSpeaker}
              title="Play test chime on selected speaker"
              className={`flex items-center gap-1 rounded-xl px-3 py-2.5 text-xs font-bold transition shrink-0 active:scale-95 border ${
                testPlaying
                  ? "bg-flame text-forest-night border-flame shadow-md shadow-flame/30"
                  : "bg-ash/[0.08] text-ash hover:bg-ash/[0.15] border-ash/[0.1]"
              }`}
            >
              <Play size={12} className={testPlaying ? "animate-pulse" : ""} />
              <span>{testPlaying ? "Playing..." : "Test"}</span>
            </button>
          </div>
        </div>

        {/* Footer Done Button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="warm-button inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold shadow-md shadow-flame/20 active:scale-95"
          >
            <Check size={14} />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
}
