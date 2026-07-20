// mesh.jsx — Relay's signature Mesh Field. One continuous animator.
// Low-res cells upscaled, ~9fps, sync first frame, pauses when hidden /
// reduced-motion. HUD reads live state; particles derive from data.

import React, { useEffect, useRef } from "react";
import { REDUCED_MOTION } from "./texture.js";

function hash(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  return ((x >>> 0) % 10000) / 10000;
}

export function MeshField({
  todayXP = 0,
  streak = 0,
  pending = 0,
  orphans = 0,
  focusLabel = "0:00",
  nextLabel = "—",
  trend = null,
  height = 168,
}) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ todayXP, streak, pending, orphans });
  stateRef.current = { todayXP, streak, pending, orphans };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = 160, H = 72;
    canvas.width = W;
    canvas.height = H;

    // Seeded particle field (stable count band from pending)
    const baseN = 28 + Math.min(40, pending);
    const pts = Array.from({ length: baseN }, (_, i) => ({
      x: hash(i * 17 + 3) * W,
      y: hash(i * 31 + 7) * H,
      r: 0.6 + hash(i * 11) * 1.4,
      phase: hash(i * 23) * Math.PI * 2,
      speed: 0.3 + hash(i * 41) * 0.7,
    }));

    let frame = 0;
    let raf = 0;
    let last = 0;
    const STEP = 1000 / 9;

    const paint = (t) => {
      const { todayXP: xp, streak: st, pending: pend } = stateRef.current;
      ctx.fillStyle = "#070a12";
      ctx.fillRect(0, 0, W, H);

      // Radial spectral wash — warmth from XP, cool from streak clarity
      const heat = Math.min(1, xp / 120);
      const clear = Math.min(1, st / 7);
      const g = ctx.createRadialGradient(W * 0.5, H * 0.55, 4, W * 0.5, H * 0.5, W * 0.55);
      g.addColorStop(0, `rgba(182,255,60,${0.06 + clear * 0.12})`);
      g.addColorStop(0.45, `rgba(91,108,255,${0.12 + heat * 0.18})`);
      g.addColorStop(1, "rgba(7,10,18,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Soft grid
      ctx.strokeStyle = "rgba(91,108,255,0.08)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += 10) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 10) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Links between near neighbors
      const nShow = Math.min(pts.length, 28 + Math.min(40, pend));
      ctx.strokeStyle = `rgba(91,108,255,${0.12 + heat * 0.2})`;
      ctx.lineWidth = 0.6;
      for (let i = 0; i < nShow; i++) {
        for (let j = i + 1; j < nShow; j++) {
          const a = pts[i], b = pts[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 28) {
            ctx.globalAlpha = 1 - d / 28;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      // Particles
      for (let i = 0; i < nShow; i++) {
        const p = pts[i];
        const bob = Math.sin(frame * 0.08 * p.speed + p.phase) * 1.2;
        const px = p.x;
        const py = ((p.y + bob) % H + H) % H;
        const bright = 0.45 + heat * 0.35 + (i % 3 === 0 ? 0.2 : 0);
        ctx.fillStyle = i % 5 === 0
          ? `rgba(182,255,60,${bright})`
          : i % 4 === 0
            ? `rgba(255,77,58,${bright * 0.85})`
            : `rgba(180,195,255,${bright})`;
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Core node
      const cx = W * 0.5, cy = H * 0.52;
      ctx.fillStyle = `rgba(91,108,255,${0.25 + heat * 0.4})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 5 + heat * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = clear > 0.3 ? "#b6ff3c" : "#eef2ff";
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
      ctx.fill();

      frame++;
    };

    paint(0);

    if (REDUCED_MOTION) return;

    const loop = (now) => {
      if (document.hidden) {
        raf = requestAnimationFrame(loop);
        return;
      }
      if (!last || now - last >= STEP) {
        last = now;
        paint(now);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pending]); // reseed particle count band when pending band shifts

  const trendStr = trend == null ? "·" : trend > 0 ? `▲${trend}%` : trend < 0 ? `▼${Math.abs(trend)}%` : "·0%";

  return (
    <div className="r-mesh" style={{ height }}>
      <canvas ref={canvasRef} className="r-mesh-canvas" aria-hidden />
      <div className="r-mesh-scrim" />
      <div className="r-mesh-hud">
        <div className="r-mesh-hud-row">
          <span className="r-lab">MESH CAM 01</span>
          <span className="r-lab r-lab--dim">THE GRID NEVER SLEEPS</span>
        </div>
        <div className="r-mesh-hud-grid">
          <div className="r-hud-cell">
            <span className="r-lab">SIGNAL</span>
            <span className="r-num r-hud-val">{todayXP > 0 ? `+${todayXP}XP` : "IDLE"} <em>{trendStr}</em></span>
          </div>
          <div className="r-hud-cell">
            <span className="r-lab">ORPHANS</span>
            <span className="r-num r-hud-val" style={orphans ? { color: "var(--port)" } : undefined}>
              {orphans ? `${orphans} DROP` : "0.0"}
            </span>
          </div>
          <div className="r-hud-cell">
            <span className="r-lab">LOCK</span>
            <span className="r-num r-hud-val" style={streak > 0 ? { color: "var(--lime)" } : undefined}>
              {streak > 0 ? `${streak}D CLEAR` : "FOG"}
            </span>
          </div>
          <div className="r-hud-cell">
            <span className="r-lab">CYCLE</span>
            <span className="r-num r-hud-val">{focusLabel}</span>
          </div>
          <div className="r-hud-cell">
            <span className="r-lab">NEXT</span>
            <span className="r-num r-hud-val">{nextLabel}</span>
          </div>
          <div className="r-hud-cell">
            <span className="r-lab">QUEUE</span>
            <span className="r-num r-hud-val">{pending} PKT</span>
          </div>
        </div>
      </div>
    </div>
  );
}
