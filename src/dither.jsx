// dither.jsx — Werf's ordered-dither chart engine.
// The look is borrowed with admiration from tripwire.sh/dither-kit
// (Bayer-ordered fills, colour bloom, entrance animation); the code is
// ours: a tiny canvas renderer with zero dependencies, no Tailwind, no
// motion/d3 — because Werf draws exactly two chart shapes and its
// constitution is "no deps a daily driver doesn't need".

import React, { useEffect, useRef } from "react";
import { REDUCED_MOTION } from "./texture.js";

// Classic 8×8 Bayer threshold matrix, normalized 0..1 at lookup.
const BAYER8 = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
];
const bayer = (gx, gy) => BAYER8[(gy & 7) * 8 + (gx & 7)] / 64;

// Canvas needs concrete colors; the app speaks CSS variables.
export function resolveColor(c) {
  if (!c) return "#f5a524";
  const m = /^var\((--[a-z0-9-]+)\)$/i.exec(c.trim());
  if (!m) return c;
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || "#f5a524";
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// Shared canvas lifecycle: DPR-aware sizing + entrance animation loop.
function useDitherCanvas(draw, deps, { animMs: animMsOpt = 550 } = {}) {
  const animMs = REDUCED_MOTION ? 0 : animMsOpt;
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = parent.clientWidth || 100;
    const h = parent.clientHeight || 40;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Paint the finished chart synchronously first — rAF is throttled in
    // occluded/background tabs, and a chart must never depend on it to
    // exist. The entrance sweep then replays over it when frames flow.
    draw(ctx, w, h, 1);

    let raf;
    let t0 = null;
    const frame = (now) => {
      if (t0 === null) t0 = now;
      const t = animMs > 0 ? Math.min(1, (now - t0) / animMs) : 1;
      ctx.clearRect(0, 0, w, h);
      draw(ctx, w, h, easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    if (animMs > 0) raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

/* ── sparkline: dithered area + bloomed line ───────────────── */
// Density fades with depth below the line — the kit's "gradient"
// variant. Entrance sweeps left → right.
export function DitherSparkline({ data, tone = "var(--amber)", cell = 2, bloom = true }) {
  const ref = useDitherCanvas((ctx, w, h, t) => {
    if (!data || data.length === 0) return;
    const color = resolveColor(tone);
    const max = Math.max(1, ...data);
    const pad = 3;
    const stepX = w / Math.max(1, data.length - 1);
    const yOf = (v) => h - pad - (v / max) * (h - pad * 2);
    const lineYAt = (x) => {
      const i = Math.min(data.length - 2, Math.max(0, Math.floor(x / stepX)));
      const f = Math.min(1, Math.max(0, (x - i * stepX) / stepX));
      return yOf(data[i]) * (1 - f) + yOf(data[i + 1]) * f;
    };
    const sweepW = w * t;

    // dithered area
    ctx.fillStyle = color;
    for (let gx = 0; gx * cell < sweepW; gx++) {
      const px = gx * cell;
      const ly = lineYAt(px);
      for (let gy = Math.ceil(ly / cell); gy * cell < h; gy++) {
        const py = gy * cell;
        const depth = (py - ly) / Math.max(1, h - ly);
        const density = 0.55 * Math.pow(1 - depth, 1.6);
        if (density > bayer(gx, gy)) ctx.fillRect(px, py, cell - 0.6, cell - 0.6);
      }
    }
    // bloomed line
    ctx.save();
    if (bloom) { ctx.shadowColor = color; ctx.shadowBlur = 6; }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let x = 0; x <= sweepW; x += 2) {
      const y = lineYAt(Math.min(x, w - 0.01));
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }, [JSON.stringify(data), tone]);
  return <canvas ref={ref} aria-hidden style={{ display: "block", width: "100%", height: "100%" }} />;
}

/* ── bar strip: dithered columns, active column blooms ─────── */
export function DitherBars({ data, activeIndex = -1, tone = "var(--amber)", mutedTone = "var(--border-strong)", cell = 2, gap = 5, labelSpace = 14 }) {
  const ref = useDitherCanvas((ctx, w, h, t) => {
    if (!data || data.length === 0) return;
    const active = resolveColor(tone);
    const muted = resolveColor(mutedTone);
    const max = Math.max(1, ...data.map((d) => d.value));
    const chartH = h - labelSpace;
    const barW = (w - gap * (data.length - 1)) / data.length;
    data.forEach((d, i) => {
      const x0 = i * (barW + gap);
      const isActive = i === activeIndex;
      const color = isActive ? active : d.value > 0 ? muted : resolveColor("var(--border)");
      const fullH = d.value > 0 ? Math.max(4, (d.value / max) * (chartH - 6)) : 2;
      const bh = fullH * t;
      const yTop = chartH - bh;
      ctx.fillStyle = color;
      // dithered body — denser near the top cap, airier at the base
      for (let gx = Math.ceil(x0 / cell); gx * cell < x0 + barW - 0.5; gx++) {
        for (let gy = Math.ceil(yTop / cell); gy * cell < chartH; gy++) {
          const py = gy * cell;
          const depth = (py - yTop) / Math.max(1, bh);
          const density = (isActive ? 0.95 : 0.8) * Math.pow(1 - depth, 0.9) + 0.12;
          if (density > bayer(gx, gy)) ctx.fillRect(gx * cell, py, cell - 0.6, cell - 0.6);
        }
      }
      // solid cap + bloom on the active column
      ctx.save();
      if (isActive) { ctx.shadowColor = active; ctx.shadowBlur = 7; }
      ctx.fillStyle = color;
      ctx.fillRect(x0, yTop, barW, 1.5);
      ctx.restore();
    });
  }, [JSON.stringify(data), activeIndex, tone]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas ref={ref} aria-hidden style={{ display: "block", width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", gap }}>
        {data.map((d, i) => (
          <span key={i} title={d.title} style={{ flex: 1, textAlign: "center", fontSize: 9, fontFamily: "var(--font-mono)", color: i === activeIndex ? "var(--amber-strong)" : "var(--text-faint)" }}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── stacked bars: two dithered series per column ──────────── */
export function DitherStackedBars({ data, tones = ["var(--channel)", "var(--port)"], cell = 2, gap = 5, labelSpace = 14, valueSpace = 12 }) {
  const ref = useDitherCanvas((ctx, w, h, t) => {
    if (!data || data.length === 0) return;
    const colors = tones.map(resolveColor);
    const max = Math.max(1, ...data.map((d) => d.values.reduce((s, v) => s + v, 0)));
    const chartH = h - labelSpace - valueSpace;
    const top0 = valueSpace;
    const barW = (w - gap * (data.length - 1)) / data.length;
    data.forEach((d, i) => {
      const x0 = i * (barW + gap);
      const total = d.values.reduce((s, v) => s + v, 0);
      if (total === 0) {
        ctx.fillStyle = resolveColor("var(--border)");
        ctx.fillRect(x0, top0 + chartH - 2, barW, 2);
        return;
      }
      const fullH = Math.max(6, (total / max) * (chartH - 4)) * t;
      let yCursor = top0 + chartH;
      d.values.forEach((v, si) => {
        if (v <= 0) return;
        const segH = (v / total) * fullH;
        const yTop = yCursor - segH;
        ctx.fillStyle = colors[si % colors.length];
        for (let gx = Math.ceil(x0 / cell); gx * cell < x0 + barW - 0.5; gx++) {
          for (let gy = Math.ceil(yTop / cell); gy * cell < yCursor; gy++) {
            const density = 0.78;
            if (density > bayer(gx, gy)) ctx.fillRect(gx * cell, gy * cell, cell - 0.6, cell - 0.6);
          }
        }
        ctx.fillRect(x0, yTop, barW, 1.2); // solid cap per segment
        yCursor = yTop;
      });
    });
  }, [JSON.stringify(data), tones.join()]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, display: "flex", gap }}>
        {data.map((d, i) => {
          const total = d.values.reduce((s, v) => s + v, 0);
          return <span key={i} style={{ flex: 1, textAlign: "center", fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>{total || ""}</span>;
        })}
      </div>
      <canvas ref={ref} aria-hidden style={{ display: "block", width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", gap }}>
        {data.map((d, i) => (
          <span key={i} title={d.title} style={{ flex: 1, textAlign: "center", fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}
