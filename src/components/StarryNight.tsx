"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  alpha: number;
  life: number;
}

interface AmbientEmber {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  alpha: number;
  decay: number;
}

export default function StarryNight() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let animationFrameId: number;
    const stars: Star[] = [];
    const shootingStars: ShootingStar[] = [];
    const ambientEmbers: AmbientEmber[] = [];

    // Generate static stars
    const starCount = Math.floor((width * height) / 4200);
    for (let i = 0; i < starCount; i++) {
      const baseAlpha = 0.2 + Math.random() * 0.7;
      stars.push({
        x: Math.random() * width,
        y: Math.random() * (height * 0.75), // Higher in sky
        radius: Math.random() * 1.3 + 0.3,
        alpha: baseAlpha,
        baseAlpha,
        twinkleSpeed: 0.01 + Math.random() * 0.03,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    const maybeSpawnShootingStar = () => {
      if (Math.random() < 0.003 && shootingStars.length < 2) {
        shootingStars.push({
          x: Math.random() * width * 0.8,
          y: Math.random() * (height * 0.4),
          length: 50 + Math.random() * 80,
          speed: 6 + Math.random() * 6,
          angle: (Math.PI / 4) + (Math.random() - 0.5) * 0.3,
          alpha: 1,
          life: 1,
        });
      }
    };

    const maybeSpawnAmbientEmber = () => {
      if (Math.random() < 0.25 && ambientEmbers.length < 35) {
        ambientEmbers.push({
          x: width * 0.5 + (Math.random() - 0.5) * (width * 0.6),
          y: height - 40 + Math.random() * 40,
          size: 0.8 + Math.random() * 2.2,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -(0.4 + Math.random() * 1.2),
          alpha: 0.6 + Math.random() * 0.4,
          decay: 0.002 + Math.random() * 0.005,
        });
      }
    };

    let time = 0;
    const render = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      // Draw Twinkling Stars
      for (const star of stars) {
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase);
        star.alpha = star.baseAlpha + twinkle * 0.25;
        const currentAlpha = Math.max(0.08, Math.min(1, star.alpha));

        ctx.fillStyle = `rgba(240, 230, 215, ${currentAlpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw and update Shooting Stars
      maybeSpawnShootingStar();
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        s.life -= 0.018;

        if (s.life <= 0 || s.x > width || s.y > height) {
          shootingStars.splice(i, 1);
          continue;
        }

        const tailX = s.x - Math.cos(s.angle) * s.length * s.life;
        const tailY = s.y - Math.sin(s.angle) * s.length * s.life;

        const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
        grad.addColorStop(0, "rgba(255, 230, 180, 0)");
        grad.addColorStop(1, `rgba(255, 255, 240, ${s.life * 0.8})`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }

      // Draw and update Ambient Floating Embers
      maybeSpawnAmbientEmber();
      for (let i = ambientEmbers.length - 1; i >= 0; i--) {
        const e = ambientEmbers[i];
        e.x += e.vx + Math.sin(time * 0.02 + e.y * 0.01) * 0.4;
        e.y += e.vy;
        e.alpha -= e.decay;

        if (e.alpha <= 0 || e.y < -20) {
          ambientEmbers.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(255, 175, 60, ${e.alpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();

        // Ember micro halo
        ctx.fillStyle = `rgba(255, 120, 30, ${e.alpha * 0.25})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-70 transition-opacity duration-1000"
    />
  );
}
