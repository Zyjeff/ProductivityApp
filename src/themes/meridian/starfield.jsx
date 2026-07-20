import React, { useRef, useEffect } from "react";

/**
 * Starfield — signature visual for Meridian.
 * density prop controls number of stars (derived from streak/XP).
 * Respects prefers-reduced-motion (static paint).
 */
export function Starfield({ density = 40, className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 72;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const stars = [];
    let seed = (density * 9973) | 0;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < density; i++) {
      stars.push({
        x: rand() * w,
        y: rand() * h,
        r: 0.4 + rand() * 1.2,
        a: 0.25 + rand() * 0.6,
      });
    }

    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#050810");
    g.addColorStop(1, "#0a1220");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (const s of stars) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(248,250,252,${s.a})`;
      ctx.fill();
    }
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
