"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { ambientAudio } from "@/lib/ambientAudio";

export default function SoundscapeToggle({ compact = false }: { compact?: boolean }) {
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setMuted(ambientAudio.getMuted());
    setVolume(ambientAudio.getVolume());
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    ambientAudio.setMuted(next);
    if (!next) {
      ambientAudio.start();
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    ambientAudio.setVolume(val);
    if (muted && val > 0) {
      setMuted(false);
      ambientAudio.setMuted(false);
    }
  };

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <button
        onClick={toggleMute}
        onMouseEnter={() => !compact && setIsOpen(true)}
        title={muted ? "Unmute campfire ambience" : "Mute campfire ambience"}
        aria-label={muted ? "Unmute soundscape" : "Mute soundscape"}
        className={`grid place-items-center rounded-full transition ${
          compact
            ? "h-8 w-8 bg-ash/[0.06] text-smoke hover:bg-ash/[0.12] hover:text-ash"
            : "h-9 w-9 bg-ash/[0.08] text-ash hover:bg-ash/[0.15]"
        } ${!muted ? "text-flame" : "text-smoke/60"}`}
      >
        {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
      </button>

      {!compact && (
        <div className="hidden sm:flex items-center gap-1.5 px-1">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={muted ? 0 : volume}
            onChange={handleVolumeChange}
            aria-label="Campfire ambient volume"
            className="h-1.5 w-16 cursor-pointer appearance-none rounded-full bg-ash/20 accent-flame focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
