"use client";

import { useEffect, useRef, useCallback } from "react";

type CampfireProps = {
  intensity?: number;
  size?: "hero" | "room" | "compact";
  onStoke?: () => void;
  fullScreen?: boolean;
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
  swayAmp: number;
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
  intensity = 0.5,
  onStoke,
  fullScreen = true,
}: CampfireProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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
    const container = containerRef.current;
    if (!canvas || !container) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let frameId = 0;
    let particles: Particle[] = [];
    let embers: Ember[] = [];
    let smokeParticles: Smoke[] = [];

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resizeCanvas = () => {
      if (!container || !canvas) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const baseIntensity = clamp(intensity, 0.25, 2.0);

    const createParticle = (burst = false): Particle => {
      const centerX = width / 2;
      const centerY = height * 0.68;
      const spreadX = burst ? 160 : 110;
      const x = centerX + (Math.random() - 0.5) * spreadX;
      const y = centerY + (Math.random() - 0.5) * 24;
      const maxLife = (burst ? 75 : 45) + Math.random() * 50;
      const speedVar = 0.8 + Math.random() * 1.5;
      return {
        x,
        y,
        vx: (Math.random() - 0.5) * (burst ? 5.5 : 2.8) * speedVar,
        vy: -(2.0 + Math.random() * (burst ? 6.0 : 3.4)) * (0.85 + baseIntensity * 0.45) * speedVar,
        size: (burst ? 22 : 14) + Math.random() * 34 * (0.8 + baseIntensity * 0.4),
        maxLife,
        life: maxLife,
        hue: 14 + Math.random() * 42,
      };
    };

    const createEmber = (burst = false): Ember => {
      const centerX = width / 2;
      const centerY = height * 0.68;
      return {
        x: centerX + (Math.random() - 0.5) * (burst ? width * 0.85 : width * 0.75),
        y: burst ? centerY : height + 10,
        vx: (Math.random() - 0.5) * (burst ? 4.5 : 2.2),
        vy: -(0.6 + Math.random() * (burst ? 5.5 : 3.0)) * (0.9 + baseIntensity * 0.5),
        size: 1.2 + Math.random() * (burst ? 4.8 : 3.5),
        life: 1,
        decay: 0.002 + Math.random() * 0.006,
        swaySpeed: 0.015 + Math.random() * 0.04,
        swayAmp: 0.5 + Math.random() * 1.2,
      };
    };

    const createSmoke = (): Smoke => {
      const centerX = width / 2;
      const centerY = height * 0.68;
      const maxLife = 120 + Math.random() * 80;
      return {
        x: centerX + (Math.random() - 0.5) * 80,
        y: centerY - 40,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -(0.6 + Math.random() * 0.8),
        size: 28 + Math.random() * 32,
        maxLife,
        life: maxLife,
      };
    };

    // Pre-populate background ambient embers across full screen height
    for (let i = 0; i < 60; i++) {
      const e = createEmber();
      e.y = Math.random() * height;
      embers.push(e);
    }

    // Click burst handler
    clickBurstRef.current = () => {
      for (let i = 0; i < 65; i++) {
        embers.push(createEmber(true));
      }
      for (let i = 0; i < 35; i++) {
        particles.push(createParticle(true));
      }
    };

    // Draw Charred 3D Wood Logs in a Campfire Pyramid
    const drawLogs = (centerX: number, centerY: number) => {
      context.globalCompositeOperation = "source-over";

      const logPositions = [
        { angle: -0.22, xOff: -35, y: centerY + 22, length: 220, thickness: 36, knots: [-50, 15, 60] },
        { angle: 0.2, xOff: 35, y: centerY + 14, length: 210, thickness: 34, knots: [-45, 0, 50] },
        { angle: -0.08, xOff: -10, y: centerY + 34, length: 190, thickness: 40, knots: [-35, 30] },
        { angle: 0.25, xOff: 18, y: centerY + 18, length: 180, thickness: 32, knots: [-40, 40] },
        { angle: 0.02, xOff: 0, y: centerY + 42, length: 240, thickness: 44, knots: [-70, 0, 70] },
      ];

      for (const log of logPositions) {
        context.save();
        context.translate(centerX + log.xOff, log.y);
        context.rotate(log.angle);

        // Main wood gradient
        const logGradient = context.createLinearGradient(
          -log.length / 2,
          0,
          log.length / 2,
          0
        );
        logGradient.addColorStop(0, "#160d07");
        logGradient.addColorStop(0.2, "#321d10");
        logGradient.addColorStop(0.5, "#201108");
        logGradient.addColorStop(0.8, "#321d10");
        logGradient.addColorStop(1, "#160d07");

        context.fillStyle = logGradient;
        context.shadowColor = "rgba(0, 0, 0, 0.75)";
        context.shadowBlur = 18;
        context.shadowOffsetY = 6;

        context.beginPath();
        context.roundRect(
          -log.length / 2,
          -log.thickness / 2,
          log.length,
          log.thickness,
          log.thickness / 2
        );
        context.fill();

        // Glowing ember cracks inside the logs
        context.shadowBlur = 0;
        context.globalAlpha = 0.8;
        context.strokeStyle = "rgba(255, 130, 30, 0.85)";
        context.lineWidth = 2.2;
        context.beginPath();
        context.moveTo(-log.length * 0.3, 0);
        context.lineTo(log.length * 0.3, 0);
        context.stroke();

        // Wood grain bark lines
        context.globalAlpha = 0.35;
        context.strokeStyle = "rgba(10, 8, 6, 0.6)";
        context.lineWidth = 1.2;
        for (let i = 0; i < 4; i++) {
          const yP = -log.thickness / 2 + (i + 1) * (log.thickness / 5);
          context.beginPath();
          context.moveTo(-log.length / 2 + 8, yP);
          context.lineTo(log.length / 2 - 8, yP);
          context.stroke();
        }

        // Knots
        context.globalAlpha = 0.5;
        context.fillStyle = "#120a05";
        for (const knotX of log.knots) {
          context.beginPath();
          context.ellipse(knotX, 0, 6, 3, 0, 0, Math.PI * 2);
          context.fill();
        }

        context.restore();
      }

      // Hot Charcoal Bed Core Glow
      const charGlow = context.createRadialGradient(
        centerX,
        centerY + 10,
        20,
        centerX,
        centerY + 10,
        180
      );
      charGlow.addColorStop(0, "rgba(255, 235, 140, 0.95)");
      charGlow.addColorStop(0.25, "rgba(255, 145, 40, 0.85)");
      charGlow.addColorStop(0.6, "rgba(230, 75, 15, 0.4)");
      charGlow.addColorStop(1, "rgba(8, 10, 9, 0)");

      context.fillStyle = charGlow;
      context.beginPath();
      context.arc(centerX, centerY + 10, 180, 0, Math.PI * 2);
      context.fill();
    };

    // Draw Multi-layered Organic Flame Curve
    const drawFlameTongue = (
      centerX: number,
      centerY: number,
      offsetX: number,
      offsetY: number,
      widthScale: number,
      heightScale: number,
      colors: [string, string, string],
      phaseOffset: number
    ) => {
      const now = performance.now();
      const baseX = centerX + offsetX;
      const baseY = centerY + offsetY;
      const flameHeight = Math.min(height * 0.42, 240 * baseIntensity * heightScale);
      const flameTop = baseY - flameHeight;

      const sway1 = Math.sin(now / 200 + phaseOffset) * 28 * baseIntensity;
      const sway2 = Math.cos(now / 160 + phaseOffset) * 20 * baseIntensity;

      context.beginPath();
      context.moveTo(baseX - 48 * baseIntensity * widthScale, baseY);
      context.bezierCurveTo(
        baseX - 60 * baseIntensity * widthScale + sway1 * 0.4,
        baseY - 75 * baseIntensity * heightScale,
        baseX - 25 * baseIntensity * widthScale + sway2 * 0.3,
        flameTop + 50 * baseIntensity * heightScale,
        baseX + sway1 * 0.25,
        flameTop
      );
      context.bezierCurveTo(
        baseX + 30 * baseIntensity * widthScale + sway2 * 0.3,
        flameTop + 45 * baseIntensity * heightScale,
        baseX + 65 * baseIntensity * widthScale + sway1 * 0.4,
        baseY - 70 * baseIntensity * heightScale,
        baseX + 48 * baseIntensity * widthScale,
        baseY
      );
      context.closePath();

      const gradient = context.createRadialGradient(
        baseX,
        flameTop + 50 * baseIntensity * heightScale,
        15,
        baseX,
        flameTop + 50 * baseIntensity * heightScale,
        150 * baseIntensity * heightScale
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

      const centerX = width / 2;
      const centerY = height * 0.68;

      // Full-screen Ambient Warmth Glow
      const ambientRadius = Math.max(width, height) * 0.75 * baseIntensity;
      const ambient = context.createRadialGradient(
        centerX,
        centerY,
        40,
        centerX,
        centerY,
        ambientRadius
      );
      ambient.addColorStop(0, `rgba(255, 140, 45, ${0.32 * baseIntensity})`);
      ambient.addColorStop(0.45, `rgba(240, 90, 25, ${0.15 * baseIntensity})`);
      ambient.addColorStop(0.8, `rgba(180, 45, 12, ${0.05 * baseIntensity})`);
      ambient.addColorStop(1, "rgba(8, 10, 9, 0)");

      context.fillStyle = ambient;
      context.beginPath();
      context.arc(centerX, centerY, ambientRadius, 0, Math.PI * 2);
      context.fill();

      // Rising Smoke Particles across Full Screen
      if (Math.random() < 0.18 * baseIntensity && smokeParticles.length < 40) {
        smokeParticles.push(createSmoke());
      }

      smokeParticles = smokeParticles.filter((s) => {
        s.life -= 1;
        if (s.life <= 0) return false;

        s.x += s.vx + Math.sin(time * 0.02 + s.y * 0.01) * 0.5;
        s.y += s.vy;
        s.size += 0.5;

        const lifeRatio = s.life / s.maxLife;
        const opacity = Math.sin(lifeRatio * Math.PI) * 0.1 * baseIntensity;

        context.fillStyle = `rgba(175, 155, 140, ${opacity})`;
        context.beginPath();
        context.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        context.fill();

        return true;
      });

      // Layered Additive Flames (Lighter / Screen Blend)
      context.globalCompositeOperation = "lighter";

      drawFlameTongue(centerX, centerY, -25 * baseIntensity, 0, 1.25, 1.08, [
        "rgba(255, 255, 230, 0.98)",
        "rgba(255, 175, 45, 0.88)",
        "rgba(240, 65, 15, 0.06)",
      ], 0);

      drawFlameTongue(centerX, centerY, 25 * baseIntensity, -10, 1.1, 0.98, [
        "rgba(255, 245, 185, 0.95)",
        "rgba(255, 150, 35, 0.8)",
        "rgba(220, 55, 10, 0.05)",
      ], 2.2);

      drawFlameTongue(centerX, centerY, 0, 14, 0.9, 0.82, [
        "rgba(255, 255, 245, 0.95)",
        "rgba(255, 200, 60, 0.72)",
        "rgba(200, 50, 10, 0.04)",
      ], 4.4);

      // Spawn Fire Core Particles
      const spawnRate = Math.max(3, Math.round(7.0 * baseIntensity));
      for (let i = 0; i < spawnRate && particles.length < 280; i += 1) {
        particles.push(createParticle());
      }

      // Spawn Full-screen Embers
      if (Math.random() < 0.4 * baseIntensity && embers.length < 140) {
        embers.push(createEmber());
      }

      // Render Fire Core Particles
      particles = particles.filter((particle) => {
        particle.life -= 1;
        if (particle.life <= 0) return false;

        particle.x += particle.vx;
        particle.y += particle.vy;

        const lifeRatio = clamp(particle.life / particle.maxLife, 0, 1);
        const currentSize = Math.max(0.5, particle.size * Math.sin(lifeRatio * Math.PI));
        const hue = particle.hue - (1 - lifeRatio) * 45;
        const saturation = 100 - (1 - lifeRatio) * 25;
        const lightness = Math.max(36, 68 + lifeRatio * 25 - (1 - lifeRatio) * 40);
        const opacity = Math.min(1, lifeRatio * 2.2, (1 - lifeRatio) * 2.0);

        context.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity * 0.45})`;
        context.beginPath();
        context.arc(particle.x, particle.y, currentSize, 0, Math.PI * 2);
        context.fill();

        if (lifeRatio > 0.4) {
          context.fillStyle = `hsla(${hue + 10}, 100%, ${Math.min(94, lightness + 18)}%, ${opacity * 0.25})`;
          context.beginPath();
          context.arc(particle.x, particle.y, currentSize * 1.5, 0, Math.PI * 2);
          context.fill();
        }
        return true;
      });

      // Render Full-Screen Swirling Embers
      embers = embers.filter((ember) => {
        ember.life -= ember.decay;
        if (ember.life <= 0 || ember.y < -20) return false;

        ember.x += ember.vx + Math.sin(time * ember.swaySpeed + ember.y * 0.015) * ember.swayAmp;
        ember.y += ember.vy;

        const glow = Math.sin(time * 0.12 + ember.x) * 0.2 + 0.8;
        context.fillStyle = `rgba(255, 215, 110, ${ember.life * glow * 0.95})`;
        context.beginPath();
        context.arc(ember.x, ember.y, ember.size, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = `rgba(255, 130, 25, ${ember.life * glow * 0.45})`;
        context.beginPath();
        context.arc(ember.x, ember.y, ember.size * 1.8, 0, Math.PI * 2);
        context.fill();

        return true;
      });

      drawLogs(centerX, centerY);
      frameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(frameId);
    };
  }, [intensity]);

  return (
    <div
      ref={containerRef}
      onClick={handleCanvasClick}
      title="Click to stoke the fire with sparks!"
      className={`group relative flex w-full h-full cursor-pointer items-center justify-center select-none overflow-hidden ${
        fullScreen ? "absolute inset-0 z-0" : "relative"
      }`}
    >
      <canvas
        ref={canvasRef}
        className="relative z-10 block pointer-events-none w-full h-full"
      />
    </div>
  );
}
