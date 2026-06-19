"use client";

import { useEffect, useRef } from "react";

type CampfireProps = {
  intensity?: number;
  size?: "hero" | "room";
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
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default function Campfire({ intensity = 0.44, size = "room" }: CampfireProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let frameId = 0;
    let particles: Particle[] = [];
    let embers: Ember[] = [];
    const width = 340;
    const height = 380;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const baseIntensity = clamp(intensity, 0.16, 1.8);

    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const createParticle = (): Particle => {
      const x = width / 2 + (Math.random() - 0.5) * 32;
      const y = height - 60;
      const maxLife = 50 + Math.random() * 48;
      const speedVariation = 0.6 + Math.random() * 1.4;
      return {
        x,
        y,
        vx: (Math.random() - 0.5) * 1.2 * speedVariation,
        vy: -(1.8 + Math.random() * 2.8) * (0.78 + baseIntensity * 0.52) * speedVariation,
        size: (9 + Math.random() * 22) * (0.72 + baseIntensity * 0.44),
        maxLife,
        life: maxLife,
        hue: 15 + Math.random() * 45,
      };
    };

    const createEmber = (): Ember => ({
      x: width / 2 + (Math.random() - 0.5) * 88,
      y: height - 64,
      vx: (Math.random() - 0.5) * 1.8,
      vy: -(0.7 + Math.random() * 3.2) * (0.88 + baseIntensity * 0.44),
      size: 0.8 + Math.random() * 3.2,
      life: 1,
      decay: 0.003 + Math.random() * 0.012,
    });

    const drawLogs = () => {
      context.globalCompositeOperation = "source-over";

      const logPositions = [
        { rotation: -0.18, y: height - 44, length: 104 },
        { rotation: 0.14, y: height - 54, length: 98 },
        { rotation: -0.06, y: height - 38, length: 92 },
        { rotation: 0.22, y: height - 52, length: 88 },
      ];

      for (const { rotation, y, length } of logPositions) {
        context.save();
        context.translate(width / 2, y);
        context.rotate(rotation);

        // Main wood gradient - darker, more realistic wood
        const logGradient = context.createLinearGradient(-length / 2, 0, length / 2, 0);
        logGradient.addColorStop(0, "#3d2817");
        logGradient.addColorStop(0.25, "#5a3f2a");
        logGradient.addColorStop(0.5, "#4a3520");
        logGradient.addColorStop(0.75, "#5a3f2a");
        logGradient.addColorStop(1, "#3d2817");

        context.fillStyle = logGradient;
        context.shadowColor = "rgba(0, 0, 0, 0.35)";
        context.shadowBlur = 8;
        context.shadowOffsetY = 2;
        context.beginPath();
        context.roundRect(-length / 2, -10, length, 20, 10);
        context.fill();

        // Wood grain texture
        context.shadowBlur = 0;
        context.globalAlpha = 0.4;
        context.strokeStyle = "rgba(0, 0, 0, 0.3)";
        context.lineWidth = 0.5;
        for (let i = 0; i < 5; i++) {
          const xPos = -length / 2 + (i * length) / 5;
          context.beginPath();
          context.moveTo(xPos, -10);
          context.lineTo(xPos, 10);
          context.stroke();
        }
        context.globalAlpha = 1;

        // Highlight on wood
        context.strokeStyle = "rgba(255, 255, 255, 0.08)";
        context.lineWidth = 1.5;
        context.beginPath();
        context.roundRect(-length / 2, -10, length, 20, 10);
        context.stroke();

        // Dark wood knots
        context.fillStyle = "rgba(0, 0, 0, 0.25)";
        for (let i = 0; i < 4; i += 1) {
          const knotX = -length / 4 + i * (length / 6) + (Math.random() - 0.5) * 6;
          const knotY = (Math.random() - 0.5) * 3;
          context.beginPath();
          context.ellipse(knotX, knotY, 5, 2.5, Math.PI / 10, 0, Math.PI * 2);
          context.fill();
        }

        context.restore();
      }

      // Enhanced glow around logs
      const charGlow = context.createRadialGradient(
        width / 2,
        height - 56,
        12,
        width / 2,
        height - 56,
        85
      );
      charGlow.addColorStop(0, "rgba(255, 200, 100, 1)");
      charGlow.addColorStop(0.2, "rgba(255, 150, 60, 0.6)");
      charGlow.addColorStop(0.5, "rgba(255, 100, 40, 0.2)");
      charGlow.addColorStop(1, "rgba(9, 11, 10, 0)");
      context.fillStyle = charGlow;
      context.beginPath();
      context.arc(width / 2, height - 56, 85, 0, Math.PI * 2);
      context.fill();

      // Ember ground
      const emberGround = context.createRadialGradient(
        width / 2,
        height - 58,
        15,
        width / 2,
        height - 58,
        75
      );
      emberGround.addColorStop(0, "rgba(255, 220, 140, 0.9)");
      emberGround.addColorStop(0.35, "rgba(255, 140, 50, 0.35)");
      emberGround.addColorStop(1, "rgba(9, 11, 10, 0)");
      context.fillStyle = emberGround;
      context.beginPath();
      context.arc(width / 2, height - 58, 75, 0, Math.PI * 2);
      context.fill();

      // Ash layer
      const ash = context.createRadialGradient(
        width / 2,
        height - 56,
        5,
        width / 2,
        height - 56,
        45
      );
      ash.addColorStop(0, "rgba(220, 200, 160, 0.6)");
      ash.addColorStop(0.3, "rgba(200, 160, 100, 0.25)");
      ash.addColorStop(1, "rgba(9, 11, 10, 0)");
      context.fillStyle = ash;
      context.beginPath();
      context.arc(width / 2, height - 56, 45, 0, Math.PI * 2);
      context.fill();
    };

    const createFlameLayer = (
      offsetX: number,
      offsetY: number,
      widthScale: number,
      heightScale: number,
      colors: [string, string, string]
    ) => {
      const baseX = width / 2 + offsetX;
      const baseY = height - 60 + offsetY;
      const flameTop = baseY - 120 * baseIntensity * heightScale;
      const sway = Math.sin(performance.now() / 240 + offsetX) * 12 * baseIntensity;

      context.beginPath();
      context.moveTo(baseX - 18 * baseIntensity * widthScale, baseY);
      context.bezierCurveTo(
        baseX - 24 * baseIntensity * widthScale + sway * 0.2,
        baseY - 36 * baseIntensity * heightScale,
        baseX - 8 * baseIntensity * widthScale + sway * 0.1,
        flameTop + 24 * baseIntensity * heightScale,
        baseX,
        flameTop
      );
      context.bezierCurveTo(
        baseX + 10 * baseIntensity * widthScale + sway * 0.1,
        flameTop + 20 * baseIntensity * heightScale,
        baseX + 26 * baseIntensity * widthScale + sway * 0.2,
        baseY - 30 * baseIntensity * heightScale,
        baseX + 18 * baseIntensity * widthScale,
        baseY
      );
      context.closePath();

      const gradient = context.createRadialGradient(
        baseX,
        flameTop + 20 * baseIntensity * heightScale,
        6,
        baseX,
        flameTop + 20 * baseIntensity * heightScale,
        72 * baseIntensity * heightScale
      );
      gradient.addColorStop(0, colors[0]);
      gradient.addColorStop(0.4, colors[1]);
      gradient.addColorStop(1, colors[2]);
      context.fillStyle = gradient;
      context.fill();
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);

      const ambient = context.createRadialGradient(
        width / 2,
        height - 62,
        12,
        width / 2,
        height - 62,
        110 * baseIntensity
      );
      ambient.addColorStop(0, `rgba(255, 150, 80, ${0.16 * baseIntensity})`);
      ambient.addColorStop(1, "rgba(8, 10, 12, 0)");
      context.fillStyle = ambient;
      context.beginPath();
      context.arc(width / 2, height - 62, 110 * baseIntensity, 0, Math.PI * 2);
      context.fill();

      const flameCenter = width / 2;
      const flameOffset = 8 * baseIntensity;
      context.globalCompositeOperation = "screen";
      createFlameLayer(-10 * flameOffset, 0, 0.9, 0.95, [
        "rgba(255, 255, 200, 0.98)",
        "rgba(255, 180, 50, 0.8)",
        "rgba(255, 80, 30, 0.08)",
      ]);
      createFlameLayer(10 * flameOffset, -6, 0.72, 0.82, [
        "rgba(255, 235, 140, 0.92)",
        "rgba(255, 150, 40, 0.65)",
        "rgba(240, 70, 25, 0.06)",
      ]);
      createFlameLayer(0, 8, 0.55, 0.6, [
        "rgba(255, 255, 220, 0.88)",
        "rgba(255, 200, 60, 0.55)",
        "rgba(220, 60, 20, 0.03)",
      ]);

      const spawnRate = Math.max(1, Math.round(4.2 * baseIntensity));
      for (let i = 0; i < spawnRate && particles.length < 180; i += 1) {
        particles.push(createParticle());
      }

      if (Math.random() < 0.22 * baseIntensity && embers.length < 72) {
        embers.push(createEmber());
      }

      particles = particles.filter((particle) => {
        particle.life -= 1;
        if (particle.life <= 0) return false;

        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx += (width / 2 - particle.x) * 0.0065;

        const lifeRatio = clamp(particle.life / particle.maxLife, 0, 1);
        const currentSize = Math.max(0.2, particle.size * Math.sin(lifeRatio * Math.PI));
        const hue = particle.hue - (1 - lifeRatio) * 60;
        const saturation = 100 - (1 - lifeRatio) * 40;
        const lightness = Math.max(32, 62 + lifeRatio * 28 - (1 - lifeRatio) * 48);
        const opacity = Math.min(1, lifeRatio * 2.2, (1 - lifeRatio) * 2);

        context.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity * 0.5})`;
        context.beginPath();
        context.arc(particle.x, particle.y, currentSize, 0, Math.PI * 2);
        context.fill();

        if (lifeRatio > 0.6) {
          context.fillStyle = `hsla(${hue + 8}, 100%, ${Math.min(90, lightness + 20)}%, ${opacity * 0.2})`;
          context.beginPath();
          context.arc(particle.x, particle.y, currentSize * 1.3, 0, Math.PI * 2);
          context.fill();
        }
        return true;
      });

      embers = embers.filter((ember) => {
        ember.life -= ember.decay;
        if (ember.life <= 0) return false;
        ember.x += ember.vx;
        ember.y += ember.vy;
        ember.vx += Math.sin(performance.now() / 200 + ember.y) * 0.06;

        const glow = Math.sin(performance.now() / 100 + ember.x) * 0.15 + 0.85;
        context.fillStyle = `rgba(255, 200, 90, ${ember.life * glow * 0.9})`;
        context.beginPath();
        context.arc(ember.x, ember.y, ember.size, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = `rgba(255, 160, 40, ${ember.life * glow * 0.4})`;
        context.beginPath();
        context.arc(ember.x, ember.y, ember.size * 1.4, 0, Math.PI * 2);
        context.fill();
        return true;
      });

      drawLogs();
      frameId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(frameId);
  }, [intensity]);

  const scaleClass = size === "hero" ? "scale-110 sm:scale-125" : "scale-90 sm:scale-100";

  return (
    <div className={`relative flex h-95 w-85 items-center justify-center ${scaleClass}`}>
      <div className="absolute h-72 w-72 rounded-full bg-ember/10 blur-3xl animate-glow-breathe" />
      <canvas ref={canvasRef} className="relative z-10 block pointer-events-none" />
    </div>
  );
}
