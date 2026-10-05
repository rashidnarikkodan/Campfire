"use client";

import { useEffect, useState, useRef } from "react";
import { useRoomStore } from "@/store/roomStore";
import { useVoiceStore } from "@/store/voiceStore";

export function useFireIntensity() {
  const peers = useRoomStore((s) => s.peers);
  const messages = useRoomStore((s) => s.messages);
  const lastStokedBy = useRoomStore((s) => s.lastStokedBy);
  const activeSpeakers = useVoiceStore((s) => s.activeSpeakers);
  const isSpeaking = useVoiceStore((s) => s.isSpeaking);
  const localAudioLevel = useVoiceStore((s) => s.localAudioLevel);

  const [intensity, setIntensity] = useState(0.48);
  const currentRef = useRef(0.48);
  const targetRef = useRef(0.48);

  useEffect(() => {
    let active = true;
    let frameId = 0;

    const tick = () => {
      if (!active) return;

      const lerpFactor = 0.07;
      const next = currentRef.current + (targetRef.current - currentRef.current) * lerpFactor;
      currentRef.current = next;

      if (Math.abs(next - targetRef.current) < 0.003) {
        setIntensity(targetRef.current);
      } else {
        setIntensity(next);
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      active = false;
      cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    const occupantCount = peers.length + 1;
    const base = 0.35 + Math.min(occupantCount * 0.06, 0.35);

    // Voice speaking bonus
    const remoteSpeakerBonus = activeSpeakers.length * 0.18;
    const localSpeakerBonus = isSpeaking ? 0.2 + Math.min(localAudioLevel * 0.25, 0.35) : 0;

    let finalTarget = base + remoteSpeakerBonus + localSpeakerBonus;

    // Chat message flare
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      const elapsedMs = Date.now() - (lastMsg?.timestamp ?? 0);
      const flareDuration = 4000;

      if (elapsedMs < flareDuration) {
        const flareRatio = 1 - elapsedMs / flareDuration;
        finalTarget += flareRatio * 0.3;
      }
    }

    // Stoke event massive flare
    if (lastStokedBy) {
      const elapsedSinceStoke = Date.now() - lastStokedBy.timestamp;
      const stokeDuration = 5500;
      if (elapsedSinceStoke < stokeDuration) {
        const stokeRatio = 1 - elapsedSinceStoke / stokeDuration;
        finalTarget += stokeRatio * 0.55;
      }
    }

    targetRef.current = Math.max(0.25, Math.min(finalTarget, 1.9));
  }, [peers, activeSpeakers, isSpeaking, localAudioLevel, messages, lastStokedBy]);

  return intensity;
}
