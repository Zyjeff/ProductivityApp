// charts.jsx — Kaze's instruments. Brush traces, torii progress,
// knot strips and the incense stick. Every canvas paints once per data
// change (never in a rAF loop); the bar sets are plain divs.
//
// Deliberately absent: rotary gauges, arcs, rings, dither bars, level
// gauges — that vocabulary belongs to the other themes.

import React, { useEffect, useRef } from "react";
import { cssColor } from "./texture.js";

/* ── ink trace: a brush stroke whose weight follows the value ── */

export function InkTrace({ data, height = 34, tone = "var(--sakura)" }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !data || data.length < 2) return;
    const ctx = cv.getContext("2d");
    const W = (cv.width = Math.max(60, cv.offsetWidth) * 2);
    const H = (cv.height = height * 2);
    const max = Math.max(...data, 1);
    ctx.clearRect(0, 0, W, H);

    const px = (i) => (i / (data.length - 1)) * (W - 10) + 5;
    const py = (v) => H - 8 - (v / max) * (H - 18);
    const col = cssColor(tone, "#f0a3bd");

    // The stroke is drawn as a filled ribbon: thick where the value is
    // high, tapering to nothing at the ends. Reads as a brush, not a line.
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const w = 1.5 + (data[i] / max) * 4;
      const x = px(i), y = py(data[i]);
      i === 0 ? ctx.moveTo(x, y - w) : ctx.lineTo(x, y - w);
    }
    for (let i = data.length - 1; i >= 0; i--) {
      const w = 1.5 + (data[i] / max) * 4;
      ctx.lineTo(px(i), py(data[i]) + w);
    }
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.75;
    ctx.fill();

    // The wet head of the stroke.
    ctx.globalAlpha = 1;
    ctx.fillStyle = cssColor("var(--sakura-hot)", "#ffc3d6");
    ctx.beginPath();
    ctx.arc(px(data.length - 1), py(data[data.length - 1]), 3.4, 0, Math.PI * 2);
    ctx.fill();
  }, [JSON.stringify(data), height, tone]);
  return <canvas ref={ref} style={{ width: "100%", height, display: "block" }} aria-hidden />;
}

/* ── torii progress: gates that ink themselves in ───────────── */

export function ToriiRow({ pct, count = 5, size = 17, color = "var(--amber)" }) {
  const lit = Math.round((Math.max(0, Math.min(100, pct)) / 100) * count);
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "flex-end" }} aria-label={`${pct}% of the way`}>
      {Array.from({ length: count }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 16 16" aria-hidden
          style={{ opacity: i < lit ? 1 : 0.22, transition: "opacity 320ms" }}>
          <path d="M2 4h12M3 6h10M4.5 4v9M11.5 4v9M2.5 3.2h11"
            stroke={i < lit ? cssColor(color, "#e0993f") : "currentColor"}
            strokeWidth="1.4" strokeLinecap="round" fill="none" />
        </svg>
      ))}
    </span>
  );
}

/* ── knots: a project's progress as cord bindings ───────────── */

export function Knots({ pct, color, count = 8 }) {
  const lit = Math.round((Math.max(0, Math.min(100, pct)) / 100) * count);
  const full = pct >= 100;
  return (
    <span className="kz-knots" aria-label={`${pct}% complete`}>
      {Array.from({ length: count }, (_, i) => (
        <i key={i}
          className={"kz-knot" + (i < lit ? (full ? " kz-knot--full" : " kz-knot--lit") : "")}
          style={i < lit && !full && color ? { background: color } : undefined} />
      ))}
    </span>
  );
}

/* ── day bars: the week's activity ──────────────────────────── */

export function DayBars({ data, max = null, showLabels = true }) {
  const top = Math.max(1, max ?? Math.max(...data.map((d) => d.value)));
  return (
    <>
      <div className="kz-bars">
        {data.map((d, i) => (
          <div key={i} className={"b" + (d.isToday ? " today" : "")} title={d.title || `${d.value}`}>
            <i style={{ height: Math.min(100, (d.value / top) * 100) + "%" }} />
          </div>
        ))}
      </div>
      {showLabels && (
        <div className="kz-bars-lbl">
          {data.map((d, i) => <span key={i} className={d.isToday ? "today" : ""}>{d.label}</span>)}
        </div>
      )}
    </>
  );
}

/* ── screen weather bars, heavy days marked ─────────────────── */

export function WeatherBars({ data, threshold = null, height = 42 }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="kz-bars" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className={"b" + (threshold != null && d.value > threshold ? " port" : "")} title={d.title || `${d.value}`}>
          <i style={{ height: (d.value / max) * 100 + "%" }} />
        </div>
      ))}
    </div>
  );
}

/* ── labelled meter row (calibration / averages) ────────────── */

export function CalRow({ label, pct, tone = "var(--amber)", value, last = false }) {
  return (
    <div className="kz-cal-row" style={last ? { marginBottom: 0 } : undefined}>
      <span className="kz-label">{label}</span>
      <div className="kz-meter" style={{ flex: 1 }}>
        <div className="kz-meter-fill" style={{ width: Math.max(0, Math.min(100, pct)) + "%", backgroundColor: tone }} />
      </div>
      <span className="kz-cal-val" style={{ color: tone }}>{value}</span>
    </div>
  );
}

/* ── the incense stick — Meditation's real-time instrument ──── */
// Burns down against the REAL session timer: `pct` is elapsed ÷
// estimate, clamped. Nothing here is stored; it reads the live clock
// the tunnel already keeps.

export function Incense({ pct, height = 132 }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="kz-incense" style={{ height }} aria-label={`${Math.round(p)}% of the estimate burned`}>
      <div className="kz-incense-stick">
        <div className="kz-incense-ash" style={{ height: p + "%" }} />
        <div className="kz-incense-ember" style={{ top: `calc(${p}% - 3.5px)` }} />
        <div className="kz-incense-smoke" style={{ top: `calc(${p}% - 36px)` }} />
      </div>
    </div>
  );
}
