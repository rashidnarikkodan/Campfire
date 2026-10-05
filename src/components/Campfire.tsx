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
      const centerY = height * 0.72;
      const x = centerX + (Math.random() - 0.5) * (burst ? 120 : 60);
      const y = centerY + (Math.random() - 0.5) * 20;
      const maxLife = (burst ? 75 : 50) + Math.random() * 55;
      const speedVar = 0.8 + Math.random() * 1.6;
      return {
        x,
        y,
        vx: (Math.random() - 0.5) * (burst ? 4.5 : 1.8) * speedVar,
        vy: -(2.5 + Math.random() * (burst ? 6.5 : 3.8)) * (0.85 + baseIntensity * 0.45) * speedVar,
        size: (burst ? 18 : 12) + Math.random() * 28 * (0.8 + baseIntensity * 0.4),
        maxLife,
        life: maxLife,
        hue: 16 + Math.random() * 44,
      };
    };

    const createEmber = (burst = false): Ember => {
      const centerX = width / 2;
      const centerY = height * 0.72;
      return {
        x: centerX + (Math.random() - 0.5) * (burst ? width * 0.7 : width * 0.45),
        y: burst ? centerY : height + 10,
        vx: (Math.random() - 0.5) * (burst ? 4.2 : 1.6),
        vy: -(0.8 + Math.random() * (burst ? 5.2 : 3.2)) * (0.9 + baseIntensity * 0.5),
        size: 1.2 + Math.random() * (burst ? 4.5 : 3.2),
        life: 1,
        decay: 0.0025 + Math.random() * 0.007,
        swaySpeed: 0.02 + Math.random() * 0.05,
        swayAmp: 0.4 + Math.random() * 0.8,
      };
    };

    const createSmoke = (): Smoke => {
      const centerX = width / 2;
      const centerY = height * 0.72;
      const maxLife = 110 + Math.random() * 70;
      return {
        x: centerX + (Math.random() - 0.5) * 45,
        y: centerY - 60,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -(0.7 + Math.random() * 0.9),
        size: 22 + Math.random() * 26,
        maxLife,
        life: maxLife,
      };
    };

    // Pre-populate background ambient embers across full screen height
    for (let i = 0; i < 45; i++) {
      const e = createEmber();
      e.y = Math.random() * height;
      embers.push(e);
    }

    // Click burst handler
    clickBurstRef.current = () => {
      for (let i = 0; i < 50; i++) {
        embers.push(createEmber(true));
      }
      for (let i = 0; i < 30; i++) {
        particles.push(createParticle(true));
      }
    };

    // Draw Charred 3D Wood Logs in a Campfire Pyramid
    const drawLogs = (centerX: number, centerY: number) => {
      context.globalCompositeOperation = "source-over";

      const logPositions = [
        { angle: -0.25, xOff: -20, y: centerY + 18, length: 170, thickness: 30, knots: [-40, 15, 50] },
        { angle: 0.22, xOff: 20, y: centerY + 10, length: 160, thickness: 28, knots: [-35, 0, 40] },
        { angle: -0.1, xOff: -5, y: centerY + 28, length: 150, thickness: 34, knots: [-25, 20] },
        { angle: 0.28, xOff: 10, y: centerY + 14, length: 140, thickness: 26, knots: [-30, 30] },
        { angle: 0.02, xOff: 0, y: centerY + 34, length: 180, thickness: 36, knots: [-50, 0, 50] },
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
        logGradient.addColorStop(0, "#1c1109");
        logGradient.addColorStop(0.2, "#382315");
        logGradient.addColorStop(0.5, "#26160b");
        logGradient.addColorStop(0.8, "#382315");
        logGradient.addColorStop(1, "#1c1109");

        context.fillStyle = logGradient;
        context.shadowColor = "rgba(0, 0, 0, 0.6)";
        context.shadowBlur = 14;
        context.shadowOffsetY = 4;

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
        context.globalAlpha = 0.7;
        context.strokeStyle = "rgba(255, 120, 30, 0.75)";
        context.lineWidth = 1.8;
        context.beginPath();
        context.moveTo(-log.length * 0.25, 0);
        context.lineTo(log.length * 0.25, 0);
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
          context.ellipse(knotX, 0, 5, 2.5, 0, 0, Math.PI * 2);
          context.fill();
        }

        context.restore();
      }

      // Hot Charcoal Bed Core Glow
      const charGlow = context.createRadialGradient(
        centerX,
        centerY,
        15,
        centerX,
        centerY,
        140
      );
      charGlow.addColorStop(0, "rgba(255, 225, 120, 0.95)");
      charGlow.addColorStop(0.25, "rgba(255, 135, 40, 0.8)");
      charGlow.addColorStop(0.6, "rgba(230, 65, 15, 0.35)");
      charGlow.addColorStop(1, "rgba(8, 10, 9, 0)");

      context.fillStyle = charGlow;
      context.beginPath();
      context.arc(centerX, centerY, 140, 0, Math.PI * 2);
      context.fill();

      // Deep Hearth Incandescent Ash Center
      const ashGlow = context.createRadialGradient(
        centerX,
        centerY + 5,
        8,
        centerX,
        centerY + 5,
        80
      );
      ashGlow.addColorStop(0, "rgba(255, 245, 200, 0.9)");
      ashGlow.addColorStop(0.35, "rgba(235, 170, 75, 0.45)");
      ashGlow.addColorStop(1, "rgba(8, 10, 9, 0)");
      context.fillStyle = ashGlow;
      context.beginPath();
      context.arc(centerX, centerY + 5, 80, 0, Math.PI * 2);
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
      const flameHeight = Math.min(height * 0.45, 220 * baseIntensity * heightScale);
      const flameTop = baseY - flameHeight;

      const sway1 = Math.sin(now / 220 + phaseOffset) * 22 * baseIntensity;
      const sway2 = Math.cos(now / 180 + phaseOffset) * 16 * baseIntensity;

      context.beginPath();
      context.moveTo(baseX - 32 * baseIntensity * widthScale, baseY);
      context.bezierCurveTo(
        baseX - 42 * baseIntensity * widthScale + sway1 * 0.35,
        baseY - 70 * baseIntensity * heightScale,
        baseX - 18 * baseIntensity * widthScale + sway2 * 0.25,
        flameTop + 45 * baseIntensity * heightScale,
        baseX + sway1 * 0.2,
        flameTop
      );
      context.bezierCurveTo(
        baseX + 22 * baseIntensity * widthScale + sway2 * 0.25,
        flameTop + 40 * baseIntensity * heightScale,
        baseX + 44 * baseIntensity * widthScale + sway1 * 0.35,
        baseY - 65 * baseIntensity * heightScale,
        baseX + 32 * baseIntensity * widthScale,
        baseY
      );
      context.closePath();

      const gradient = context.createRadialGradient(
        baseX,
        flameTop + 40 * baseIntensity * heightScale,
        12,
        baseX,
        flameTop + 40 * baseIntensity * heightScale,
        120 * baseIntensity * heightScale
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
      const centerY = height * 0.72;

      // Full-screen Ambient Warmth Glow
      const ambientRadius = Math.max(width, height) * 0.65 * baseIntensity;
      const ambient = context.createRadialGradient(
        centerX,
        centerY,
        30,
        centerX,
        centerY,
        ambientRadius
      );
      ambient.addColorStop(0, `rgba(255, 130, 40, ${0.28 * baseIntensity})`);
      ambient.addColorStop(0.5, `rgba(240, 80, 20, ${0.12 * baseIntensity})`);
      ambient.addColorStop(0.85, `rgba(180, 40, 10, ${0.04 * baseIntensity})`);
      ambient.addColorStop(1, "rgba(8, 10, 9, 0)");

      context.fillStyle = ambient;
      context.beginPath();
      context.arc(centerX, centerY, ambientRadius, 0, Math.PI * 2);
      context.fill();

      // Rising Smoke Particles across Full Screen
      if (Math.random() < 0.15 * baseIntensity && smokeParticles.length < 32) {
        smokeParticles.push(createSmoke());
      }

      smokeParticles = smokeParticles.filter((s) => {
        s.life -= 1;
        if (s.life <= 0) return false;

        s.x += s.vx + Math.sin(time * 0.02 + s.y * 0.01) * 0.4;
        s.y += s.vy;
        s.size += 0.45;

        const lifeRatio = s.life / s.maxLife;
        const opacity = Math.sin(lifeRatio * Math.PI) * 0.09 * baseIntensity;

        context.fillStyle = `rgba(175, 155, 140, ${opacity})`;
        context.beginPath();
        context.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        context.fill();

        return true;
      });

      // Layered Additive Flames (Lighter / Screen Blend)
      context.globalCompositeOperation = "lighter";

      drawFlameTongue(centerX, centerY, -18 * baseIntensity, 0, 1.15, 1.05, [
        "rgba(255, 255, 220, 0.98)",
        "rgba(255, 170, 40, 0.88)",
        "rgba(240, 60, 15, 0.07)",
      ], 0);

      drawFlameTongue(centerX, centerY, 18 * baseIntensity, -8, 0.95, 0.95, [
        "rgba(255, 245, 175, 0.95)",
        "rgba(255, 145, 30, 0.78)",
        "rgba(220, 50, 10, 0.05)",
      ], 2.2);

      drawFlameTongue(centerX, centerY, 0, 12, 0.75, 0.78, [
        "rgba(255, 255, 240, 0.95)",
        "rgba(255, 195, 55, 0.7)",
        "rgba(200, 45, 10, 0.04)",
      ], 4.4);

      // Spawn Fire Core Particles
      const spawnRate = Math.max(3, Math.round(6.0 * baseIntensity));
      for (let i = 0; i < spawnRate && particles.length < 250; i += 1) {
        particles.push(createParticle());
      }

      // Spawn Full-screen Embers
      if (Math.random() < 0.35 * baseIntensity && embers.length < 120) {
        embers.push(createEmber());
      }

      // Render Fire Core Particles
      particles = particles.filter((particle) => {
        particle.life -= 1;
        if (particle.life <= 0) return false;

        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx += (centerX - particle.x) * 0.006;

        const lifeRatio = clamp(particle.life / particle.maxLife, 0, 1);
        const currentSize = Math.max(0.5, particle.size * Math.sin(lifeRatio * Math.PI));
        const hue = particle.hue - (1 - lifeRatio) * 55;
        const saturation = 100 - (1 - lifeRatio) * 30;
        const lightness = Math.max(36, 68 + lifeRatio * 25 - (1 - lifeRatio) * 45);
        const opacity = Math.min(1, lifeRatio * 2.5, (1 - lifeRatio) * 2.2);

        context.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity * 0.6})`;
        context.beginPath();
        context.arc(particle.x, particle.y, currentSize, 0, Math.PI * 2);
        context.fill();

        if (lifeRatio > 0.5) {
          context.fillStyle = `hsla(${hue + 12}, 100%, ${Math.min(94, lightness + 20)}%, ${opacity * 0.3})`;
          context.beginPath();
          context.arc(particle.x, particle.y, currentSize * 1.4, 0, Math.PI * 2);
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
