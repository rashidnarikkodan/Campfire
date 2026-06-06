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
      const x = width / 2 + (Math.random() - 0.5) * 24;
      const y = height - 60;
      const maxLife = 42 + Math.random() * 32;
      return {
        x,
        y,
        vx: (Math.random() - 0.5) * 0.82,
        vy: -(1.45 + Math.random() * 2.3) * (0.78 + baseIntensity * 0.48),
        size: (11 + Math.random() * 18) * (0.72 + baseIntensity * 0.34),
        maxLife,
        life: maxLife,
        hue: 18 + Math.random() * 30,
      };
    };

    const createEmber = (): Ember => ({
      x: width / 2 + (Math.random() - 0.5) * 72,
      y: height - 66,
      vx: (Math.random() - 0.5) * 1.45,
      vy: -(0.9 + Math.random() * 2.7) * (0.88 + baseIntensity * 0.34),
      size: 1 + Math.random() * 2.5,
      life: 1,
      decay: 0.005 + Math.random() * 0.01,
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

        const logGradient = context.createLinearGradient(-length / 2, 0, length / 2, 0);
        logGradient.addColorStop(0, "#442f1e");
        logGradient.addColorStop(0.35, "#61442b");
        logGradient.addColorStop(0.65, "#4d331f");
        logGradient.addColorStop(1, "#321f14");

        context.fillStyle = logGradient;
        context.shadowColor = "rgba(0, 0, 0, 0.18)";
        context.shadowBlur = 5;
        context.beginPath();
        context.roundRect(-length / 2, -10, length, 20, 10);
        context.fill();

        context.shadowBlur = 0;
        context.strokeStyle = "rgba(255, 255, 255, 0.06)";
        context.lineWidth = 1;
        context.beginPath();
        context.roundRect(-length / 2, -10, length, 20, 10);
        context.stroke();

        context.fillStyle = "rgba(0, 0, 0, 0.14)";
        for (let i = 0; i < 4; i += 1) {
          const knotX = -length / 4 + i * (length / 6) + Math.random() * 8;
          const knotY = Math.random() * 4 - 2;
          context.beginPath();
          context.ellipse(knotX, knotY, 6, 3.5, Math.PI / 10, 0, Math.PI * 2);
          context.fill();
        }

        context.restore();
      }

      const charGlow = context.createRadialGradient(
        width / 2,
        height - 56,
        8,
        width / 2,
        height - 56,
        72
      );
      charGlow.addColorStop(0, "rgba(255, 180, 90, 0.9)");
      charGlow.addColorStop(0.3, "rgba(255, 130, 45, 0.35)");
      charGlow.addColorStop(1, "rgba(9, 11, 10, 0)");
      context.fillStyle = charGlow;
      context.beginPath();
      context.arc(width / 2, height - 56, 72, 0, Math.PI * 2);
      context.fill();

      const emberGround = context.createRadialGradient(
        width / 2,
        height - 58,
        10,
        width / 2,
        height - 58,
        62
      );
      emberGround.addColorStop(0, "rgba(255, 200, 105, 0.82)");
      emberGround.addColorStop(0.4, "rgba(255, 125, 35, 0.22)");
      emberGround.addColorStop(1, "rgba(9, 11, 10, 0)");
      context.fillStyle = emberGround;
      context.beginPath();
      context.arc(width / 2, height - 58, 62, 0, Math.PI * 2);
      context.fill();

      const ash = context.createRadialGradient(
        width / 2,
        height - 56,
        3,
        width / 2,
        height - 56,
        36
      );
      ash.addColorStop(0, "rgba(255, 255, 255, 0.76)");
      ash.addColorStop(0.16, "rgba(255, 160, 75, 0.3)");
      ash.addColorStop(1, "rgba(9, 11, 10, 0)");
      context.fillStyle = ash;
      context.beginPath();
      context.arc(width / 2, height - 56, 36, 0, Math.PI * 2);
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
        "rgba(255, 235, 150, 0.98)",
        "rgba(255, 145, 35, 0.75)",
        "rgba(255, 65, 24, 0.06)",
      ]);
      createFlameLayer(10 * flameOffset, -6, 0.72, 0.82, [
        "rgba(255, 215, 110, 0.92)",
        "rgba(255, 120, 36, 0.6)",
        "rgba(235, 50, 22, 0.04)",
      ]);
      createFlameLayer(0, 8, 0.55, 0.6, [
        "rgba(255, 255, 210, 0.88)",
        "rgba(255, 165, 48, 0.5)",
        "rgba(200, 40, 16, 0.02)",
      ]);

      const spawnRate = Math.max(1, Math.round(3.4 * baseIntensity));
      for (let i = 0; i < spawnRate && particles.length < 150; i += 1) {
        particles.push(createParticle());
      }

      if (Math.random() < 0.16 * baseIntensity && embers.length < 54) {
        embers.push(createEmber());
      }

      particles = particles.filter((particle) => {
        particle.life -= 1;
        if (particle.life <= 0) return false;

        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx += (width / 2 - particle.x) * 0.005;

        const lifeRatio = clamp(particle.life / particle.maxLife, 0, 1);
        const currentSize = Math.max(0.35, particle.size * Math.sin(lifeRatio * Math.PI));
        const hue = particle.hue - (1 - lifeRatio) * 25;
        const lightness = 56 + lifeRatio * 16;
        const opacity = Math.min(1, lifeRatio * 1.6);

        context.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${opacity * 0.4})`;
        context.beginPath();
        context.arc(particle.x, particle.y, currentSize, 0, Math.PI * 2);
        context.fill();
        return true;
      });

      embers = embers.filter((ember) => {
        ember.life -= ember.decay;
        if (ember.life <= 0) return false;
        ember.x += ember.vx;
        ember.y += ember.vy;
        ember.vx += Math.sin(performance.now() / 250 + ember.y) * 0.045;

        context.fillStyle = `rgba(255, 195, 90, ${ember.life})`;
        context.beginPath();
        context.arc(ember.x, ember.y, ember.size, 0, Math.PI * 2);
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
