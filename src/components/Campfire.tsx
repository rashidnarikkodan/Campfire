"use client";

import { useEffect, useRef, useCallback } from "react";

type CampfireProps = {
  intensity?: number;
  size?: "hero" | "room" | "compact";
  onStoke?: () => void;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  maxLife: number;
  life: number;
  hue: number;
};

type Ember = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  decay: number;
  swaySpeed: number;
};

type Smoke = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  maxLife: number;
  life: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default function Campfire({
  intensity = 0.48,
  size = "room",
  onStoke,
}: CampfireProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clickBurstRef = useRef<(() => void) | null>(null);

  const handleCanvasClick = useCallback(() => {
    if (clickBurstRef.current) {
      clickBurstRef.current();
    }
    if (onStoke) {
      onStoke();
    }
  }, [onStoke]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let frameId = 0;
    let particles: Particle[] = [];
    let embers: Ember[] = [];
    let smokeParticles: Smoke[] = [];

    const width = 380;
    const height = 420;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const baseIntensity = clamp(intensity, 0.2, 2.0);

    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const createParticle = (burst = false): Particle => {
      const x = width / 2 + (Math.random() - 0.5) * (burst ? 70 : 42);
      const y = height - 74;
      const maxLife = (burst ? 65 : 45) + Math.random() * 45;
      const speedVariation = 0.7 + Math.random() * 1.5;
      return {
        x,
        y,
        vx: (Math.random() - 0.5) * (burst ? 3.5 : 1.4) * speedVariation,
        vy:
          -(2.0 + Math.random() * (burst ? 4.8 : 3.0)) *
          (0.85 + baseIntensity * 0.45) *
          speedVariation,
        size: (burst ? 14 : 9) + Math.random() * 22 * (0.8 + baseIntensity * 0.4),
        maxLife,
        life: maxLife,
        hue: 16 + Math.random() * 42,
      };
    };

    const createEmber = (burst = false): Ember => ({
      x: width / 2 + (Math.random() - 0.5) * (burst ? 110 : 80),
      y: height - 76,
      vx: (Math.random() - 0.5) * (burst ? 3.8 : 1.9),
      vy: -(0.9 + Math.random() * (burst ? 4.8 : 3.4)) * (0.9 + baseIntensity * 0.45),
      size: 1.0 + Math.random() * (burst ? 4.2 : 3.0),
      life: 1,
      decay: 0.0035 + Math.random() * 0.009,
      swaySpeed: 0.03 + Math.random() * 0.05,
    });

    const createSmoke = (): Smoke => {
      const maxLife = 90 + Math.random() * 60;
      return {
        x: width / 2 + (Math.random() - 0.5) * 30,
        y: height - 120,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -(0.6 + Math.random() * 0.8),
        size: 16 + Math.random() * 18,
        maxLife,
        life: maxLife,
      };
    };

    // Click burst handler
    clickBurstRef.current = () => {
      for (let i = 0; i < 35; i++) {
        embers.push(createEmber(true));
      }
      for (let i = 0; i < 20; i++) {
        particles.push(createParticle(true));
      }
    };

    // Pre-calculated fixed wood log positions to avoid frame-by-frame jitter
    const logPositions = [
      { angle: -0.22, xOff: -6, y: height - 52, length: 114, thickness: 22, knots: [-25, 12, 35] },
      { angle: 0.18, xOff: 8, y: height - 60, length: 108, thickness: 20, knots: [-30, 0, 28] },
      { angle: -0.08, xOff: -2, y: height - 44, length: 100, thickness: 24, knots: [-18, 15] },
      { angle: 0.26, xOff: 4, y: height - 58, length: 94, thickness: 19, knots: [-20, 22] },
    ];

    const drawLogs = () => {
      context.globalCompositeOperation = "source-over";

      for (const log of logPositions) {
        context.save();
        context.translate(width / 2 + log.xOff, log.y);
        context.rotate(log.angle);

        // Main wood gradient
        const logGradient = context.createLinearGradient(
          -log.length / 2,
          0,
          log.length / 2,
          0
        );
        logGradient.addColorStop(0, "#2c1c11");
        logGradient.addColorStop(0.25, "#4e3321");
        logGradient.addColorStop(0.5, "#3d2717");
        logGradient.addColorStop(0.75, "#4e3321");
        logGradient.addColorStop(1, "#2c1c11");

        context.fillStyle = logGradient;
        context.shadowColor = "rgba(0, 0, 0, 0.4)";
        context.shadowBlur = 10;
        context.shadowOffsetY = 3;

        context.beginPath();
        context.roundRect(
          -log.length / 2,
          -log.thickness / 2,
          log.length,
          log.thickness,
          log.thickness / 2
        );
        context.fill();

        // Wood grain bark lines
        context.shadowBlur = 0;
        context.globalAlpha = 0.35;
        context.strokeStyle = "rgba(10, 8, 6, 0.5)";
        context.lineWidth = 1.0;
        for (let i = 0; i < 4; i++) {
          const yP = -log.thickness / 2 + (i + 1) * (log.thickness / 5);
          context.beginPath();
          context.moveTo(-log.length / 2 + 6, yP);
          context.lineTo(log.length / 2 - 6, yP);
          context.stroke();
        }

        // Highlight edge
        context.globalAlpha = 0.15;
        context.strokeStyle = "rgba(255, 220, 180, 0.3)";
        context.lineWidth = 1.2;
        context.beginPath();
        context.roundRect(
          -log.length / 2,
          -log.thickness / 2,
          log.length,
          log.thickness,
          log.thickness / 2
        );
        context.stroke();

        // Knots (fixed positions!)
        context.globalAlpha = 0.4;
        context.fillStyle = "#180f08";
        for (const knotX of log.knots) {
          context.beginPath();
          context.ellipse(knotX, 0, 4, 2, 0, 0, Math.PI * 2);
          context.fill();
        }

        context.restore();
      }

      // Hot Glowing Charcoal Bed
      const charGlow = context.createRadialGradient(
        width / 2,
        height - 66,
        10,
        width / 2,
        height - 66,
        90
      );
      charGlow.addColorStop(0, "rgba(255, 210, 110, 0.95)");
      charGlow.addColorStop(0.2, "rgba(255, 140, 45, 0.75)");
      charGlow.addColorStop(0.55, "rgba(240, 75, 20, 0.3)");
      charGlow.addColorStop(1, "rgba(9, 11, 10, 0)");

      context.fillStyle = charGlow;
      context.beginPath();
      context.arc(width / 2, height - 66, 90, 0, Math.PI * 2);
      context.fill();

      // Deep Hearth Ash
      const ashGlow = context.createRadialGradient(
        width / 2,
        height - 62,
        5,
        width / 2,
        height - 62,
        52
      );
      ashGlow.addColorStop(0, "rgba(255, 235, 180, 0.85)");
      ashGlow.addColorStop(0.3, "rgba(215, 160, 95, 0.35)");
      ashGlow.addColorStop(1, "rgba(9, 11, 10, 0)");
      context.fillStyle = ashGlow;
      context.beginPath();
      context.arc(width / 2, height - 62, 52, 0, Math.PI * 2);
      context.fill();
    };

    const createFlameTongue = (
      offsetX: number,
      offsetY: number,
      widthScale: number,
      heightScale: number,
      colors: [string, string, string],
      phaseOffset: number
    ) => {
      const now = performance.now();
      const baseX = width / 2 + offsetX;
      const baseY = height - 70 + offsetY;
      const flameHeight = 140 * baseIntensity * heightScale;
      const flameTop = baseY - flameHeight;

      const sway1 = Math.sin(now / 220 + phaseOffset) * 14 * baseIntensity;
      const sway2 = Math.cos(now / 180 + phaseOffset) * 10 * baseIntensity;

      context.beginPath();
      context.moveTo(baseX - 22 * baseIntensity * widthScale, baseY);
      context.bezierCurveTo(
        baseX - 28 * baseIntensity * widthScale + sway1 * 0.3,
        baseY - 45 * baseIntensity * heightScale,
        baseX - 12 * baseIntensity * widthScale + sway2 * 0.2,
        flameTop + 32 * baseIntensity * heightScale,
        baseX + sway1 * 0.15,
        flameTop
      );
      context.bezierCurveTo(
        baseX + 14 * baseIntensity * widthScale + sway2 * 0.2,
        flameTop + 28 * baseIntensity * heightScale,
        baseX + 30 * baseIntensity * widthScale + sway1 * 0.3,
        baseY - 40 * baseIntensity * heightScale,
        baseX + 22 * baseIntensity * widthScale,
        baseY
      );
      context.closePath();

      const gradient = context.createRadialGradient(
        baseX,
        flameTop + 30 * baseIntensity * heightScale,
        8,
        baseX,
        flameTop + 30 * baseIntensity * heightScale,
        85 * baseIntensity * heightScale
      );
      gradient.addColorStop(0, colors[0]);
      gradient.addColorStop(0.45, colors[1]);
      gradient.addColorStop(1, colors[2]);

      context.fillStyle = gradient;
      context.fill();
    };

    let time = 0;
    const draw = () => {
      time += 1;
      context.clearRect(0, 0, width, height);

      // Ambient Warmth Radiance
      const ambient = context.createRadialGradient(
        width / 2,
        height - 76,
        15,
        width / 2,
        height - 76,
        130 * baseIntensity
      );
      ambient.addColorStop(0, `rgba(255, 140, 50, ${0.22 * baseIntensity})`);
      ambient.addColorStop(0.6, `rgba(255, 90, 25, ${0.08 * baseIntensity})`);
      ambient.addColorStop(1, "rgba(8, 10, 12, 0)");
      context.fillStyle = ambient;
      context.beginPath();
      context.arc(width / 2, height - 76, 130 * baseIntensity, 0, Math.PI * 2);
      context.fill();

      // Draw and update gentle rising smoke
      if (Math.random() < 0.12 * baseIntensity && smokeParticles.length < 24) {
        smokeParticles.push(createSmoke());
      }

      smokeParticles = smokeParticles.filter((s) => {
        s.life -= 1;
        if (s.life <= 0) return false;

        s.x += s.vx + Math.sin(time * 0.02 + s.y * 0.01) * 0.3;
        s.y += s.vy;
        s.size += 0.35;

        const lifeRatio = s.life / s.maxLife;
        const opacity = Math.sin(lifeRatio * Math.PI) * 0.08 * baseIntensity;

        context.fillStyle = `rgba(180, 160, 145, ${opacity})`;
        context.beginPath();
        context.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        context.fill();

        return true;
      });

      // Layered Animated Flames (Screen blend for glowing radiance)
      context.globalCompositeOperation = "screen";

      createFlameTongue(-12 * baseIntensity, 0, 0.95, 0.96, [
        "rgba(255, 255, 210, 0.98)",
        "rgba(255, 175, 45, 0.85)",
        "rgba(255, 70, 20, 0.06)",
      ], 0);

      createFlameTongue(12 * baseIntensity, -6, 0.82, 0.88, [
        "rgba(255, 240, 160, 0.95)",
        "rgba(255, 150, 35, 0.72)",
        "rgba(235, 60, 15, 0.05)",
      ], 2.2);

      createFlameTongue(0, 10, 0.65, 0.7, [
        "rgba(255, 255, 230, 0.9)",
        "rgba(255, 195, 55, 0.6)",
        "rgba(220, 50, 15, 0.03)",
      ], 4.4);

      // Spawn Fire Core Particles
      const spawnRate = Math.max(2, Math.round(5.0 * baseIntensity));
      for (let i = 0; i < spawnRate && particles.length < 200; i += 1) {
        particles.push(createParticle());
      }

      // Spawn Rising Embers
      if (Math.random() < 0.28 * baseIntensity && embers.length < 85) {
        embers.push(createEmber());
      }

      // Render Fire Particles
      particles = particles.filter((particle) => {
        particle.life -= 1;
        if (particle.life <= 0) return false;

        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx += (width / 2 - particle.x) * 0.007;

        const lifeRatio = clamp(particle.life / particle.maxLife, 0, 1);
        const currentSize = Math.max(0.4, particle.size * Math.sin(lifeRatio * Math.PI));
        const hue = particle.hue - (1 - lifeRatio) * 55;
        const saturation = 100 - (1 - lifeRatio) * 35;
        const lightness = Math.max(34, 65 + lifeRatio * 26 - (1 - lifeRatio) * 45);
        const opacity = Math.min(1, lifeRatio * 2.4, (1 - lifeRatio) * 2.1);

        context.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity * 0.55})`;
        context.beginPath();
        context.arc(particle.x, particle.y, currentSize, 0, Math.PI * 2);
        context.fill();

        if (lifeRatio > 0.55) {
          context.fillStyle = `hsla(${hue + 10}, 100%, ${Math.min(92, lightness + 20)}%, ${opacity * 0.25})`;
          context.beginPath();
          context.arc(particle.x, particle.y, currentSize * 1.35, 0, Math.PI * 2);
          context.fill();
        }
        return true;
      });

      // Render Swirling Embers
      embers = embers.filter((ember) => {
        ember.life -= ember.decay;
        if (ember.life <= 0) return false;

        ember.x += ember.vx + Math.sin(time * ember.swaySpeed + ember.y * 0.02) * 0.45;
        ember.y += ember.vy;

        const glow = Math.sin(time * 0.1 + ember.x) * 0.18 + 0.82;
        context.fillStyle = `rgba(255, 210, 95, ${ember.life * glow * 0.95})`;
        context.beginPath();
        context.arc(ember.x, ember.y, ember.size, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = `rgba(255, 140, 30, ${ember.life * glow * 0.4})`;
        context.beginPath();
        context.arc(ember.x, ember.y, ember.size * 1.6, 0, Math.PI * 2);
        context.fill();

        return true;
      });

      drawLogs();
      frameId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(frameId);
  }, [intensity]);

  const scaleClass =
    size === "hero"
      ? "scale-110 sm:scale-130"
      : size === "compact"
      ? "scale-75 sm:scale-85"
      : "scale-90 sm:scale-105";

  return (
    <div
      onClick={handleCanvasClick}
      title="Click to stoke the fire with sparks!"
      className={`group relative flex h-96 w-88 cursor-pointer items-center justify-center select-none transition-transform duration-300 active:scale-95 ${scaleClass}`}
    >
      <div
        className="pointer-events-none absolute h-72 w-72 rounded-full bg-ember/15 blur-3xl transition-opacity duration-700 group-hover:bg-ember/25"
        style={{ opacity: 0.5 + intensity * 0.3 }}
      />
      <canvas
        ref={canvasRef}
        className="relative z-10 block pointer-events-none"
      />
    </div>
  );
}
