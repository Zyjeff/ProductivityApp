// charts.jsx — Apogee canvas instruments. Paint synchronously on data
// change (effect body). No rAF. Dumb props only.

import React, { useEffect, useRef } from "react";

const SIGNAL = "#ff2b1a";
const LINE = "rgba(255,255,255,0.12)";
const FG_FAINT = "#525c62";
const CHANNEL = "#4fd8eb";

/* ── sparkline: polyline through data numbers ───────────────── */

export function Spark({ data, w = 120, h = 34, tone = SIGNAL }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !data || data.length < 2) return;
    const ctx = cv.getContext("2d");
    const W = w * 2;
    const H = h * 2;
    cv.width = W;
    cv.height = H;
    ctx.clearRect(0, 0, W, H);
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const span = Math.max(1e-6, max - min);
    const px = (i) => (i / (data.length - 1)) * (W - 8) + 4;
    const py = (v) => H - 6 - ((v - min) / span) * (H - 14);
    ctx.strokeStyle = tone;
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((v, i) => {
      if (i === 0) ctx.moveTo(px(i), py(v));
      else ctx.lineTo(px(i), py(v));
    });
    ctx.stroke();
    const last = data[data.length - 1];
    ctx.fillStyle = tone;
    ctx.fillRect(px(data.length - 1) - 2.5, py(last) - 2.5, 5, 5);
  }, [JSON.stringify(data), w, h, tone]);
  return (
    <canvas
      ref={ref}
      style={{ width: w, height: h, display: "block" }}
      aria-hidden
    />
  );
}

/* ── stacked-segment vertical gauge (HANGAR bay) ────────────── */

export function SegColumn({ pct = 0, cells = 12, tone = SIGNAL, w = 32, h = 128 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const W = w * 2;
    const H = h * 2;
    cv.width = W;
    cv.height = H;
    ctx.clearRect(0, 0, W, H);
    const n = Math.max(1, cells | 0);
    const lit = Math.round((Math.max(0, Math.min(100, pct)) / 100) * n);
    const gap = 2;
    const segH = (H - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      // bottom-up: index 0 at bottom
      const y = H - (i + 1) * segH - i * gap;
      ctx.fillStyle = i < lit ? tone : LINE;
      ctx.fillRect(0, y, W, segH);
    }
  }, [pct, cells, tone, w, h]);
  return (
    <canvas
      ref={ref}
      className="ap-bay-gauge"
      style={{ width: w, height: h, display: "block" }}
      aria-hidden
    />
  );
}

/* ── week dots: 7 squares; days[i].on truthy = filled
 *   shape: Array<{ on?: boolean } | boolean> length 7 ──────── */

export function WeekDots({ days = [] }) {
  const ref = useRef(null);
  const size = 7;
  const box = 10;
  const gap = 4;
  const w = size * box + (size - 1) * gap;
  const h = box;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const W = w * 2;
    const H = h * 2;
    cv.width = W;
    cv.height = H;
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < size; i++) {
      const entry = days[i];
      const on = entry === true || (entry && entry.on);
      const x = i * (box + gap) * 2;
      ctx.fillStyle = on ? SIGNAL : "transparent";
      ctx.strokeStyle = on ? SIGNAL : FG_FAINT;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, 1, box * 2 - 2, box * 2 - 2);
      if (on) ctx.fillRect(x + 1, 1, box * 2 - 2, box * 2 - 2);
    }
  }, [JSON.stringify(days)]);
  return (
    <canvas
      ref={ref}
      style={{ width: w, height: h, display: "block" }}
      aria-hidden
    />
  );
}

/* ── 7-day stacked bars (DOWNLINK WEATHER X/YT)
 *   rows: Array<{ a: number, b: number }>  — a bottom, b top ── */

export function StackBars({ rows = [] }) {
  const ref = useRef(null);
  const w = 140;
  const h = 48;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const W = w * 2;
    const H = h * 2;
    cv.width = W;
    cv.height = H;
    ctx.clearRect(0, 0, W, H);
    const n = Math.max(1, rows.length || 7);
    const gap = 4;
    const barW = (W - gap * (n - 1)) / n;
    let max = 1;
    for (const r of rows) max = Math.max(max, (r?.a || 0) + (r?.b || 0));
    for (let i = 0; i < n; i++) {
      const r = rows[i] || { a: 0, b: 0 };
      const a = r.a || 0;
      const b = r.b || 0;
      const x = i * (barW + gap);
      const ha = (a / max) * (H - 4);
      const hb = (b / max) * (H - 4);
      ctx.fillStyle = LINE;
      ctx.fillRect(x, 0, barW, H);
      ctx.fillStyle = CHANNEL;
      ctx.fillRect(x, H - ha - hb, barW, hb);
      ctx.fillStyle = SIGNAL;
      ctx.fillRect(x, H - ha, barW, ha);
    }
  }, [JSON.stringify(rows)]);
  return (
    <canvas
      ref={ref}
      style={{ width: w, height: h, display: "block" }}
      aria-hidden
    />
  );
}

/* ── hour bars: single-segment
 *   rows: Array<{ v: number } | number> ─────────────────────── */

export function HourBars({ rows = [] }) {
  const ref = useRef(null);
  const w = 140;
  const h = 48;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const W = w * 2;
    const H = h * 2;
    cv.width = W;
    cv.height = H;
    ctx.clearRect(0, 0, W, H);
    const n = Math.max(1, rows.length || 7);
    const gap = 3;
    const barW = (W - gap * (n - 1)) / n;
    let max = 1;
    for (const r of rows) {
      const v = typeof r === "number" ? r : (r?.v || 0);
      max = Math.max(max, v);
    }
    for (let i = 0; i < n; i++) {
      const r = rows[i];
      const v = typeof r === "number" ? r : (r?.v || 0);
      const x = i * (barW + gap);
      const hh = (v / max) * (H - 4);
      ctx.fillStyle = LINE;
      ctx.fillRect(x, 0, barW, H);
      ctx.fillStyle = SIGNAL;
      ctx.fillRect(x, H - hh, barW, hh);
    }
  }, [JSON.stringify(rows)]);
  return (
    <canvas
      ref={ref}
      style={{ width: w, height: h, display: "block" }}
      aria-hidden
    />
  );
}
