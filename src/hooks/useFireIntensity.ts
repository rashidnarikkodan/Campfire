"use client";

import { useEffect, useState, useRef } from "react";
import { useRoomStore } from "@/store/roomStore";
import { useVoiceStore } from "@/store/voiceStore";

export function useFireIntensity() {
  const peers = useRoomStore((s) => s.peers);
  const messages = useRoomStore((s) => s.messages);
  const activeSpeakers = useVoiceStore((s) => s.activeSpeakers);

  const [intensity, setIntensity] = useState(0.4);
  const currentRef = useRef(0.4);
  const targetRef = useRef(0.4);

  useEffect(() => {
    let active = true;
    let frameId = 0;

    const tick = () => {
      if (!active) return;

      const lerpFactor = 0.08;
      const next = currentRef.current + (targetRef.current - currentRef.current) * lerpFactor;
      currentRef.current = next;

      if (Math.abs(next - targetRef.current) < 0.005) {
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
    const base = 0.3 + Math.min(occupantCount * 0.08, 0.4);

    const speakerBonus = activeSpeakers.length * 0.15;

    let finalTarget = base + speakerBonus;

    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      const elapsedMs = Date.now() - (lastMsg?.timestamp ?? 0);
      const flareDuration = 3500;

      if (elapsedMs < flareDuration) {
        const flareRatio = 1 - elapsedMs / flareDuration;
        finalTarget += flareRatio * 0.35;
      }
    }

    targetRef.current = Math.max(0.2, Math.min(finalTarget, 1.5));
  }, [peers, activeSpeakers, messages]);

  return intensity;
}
