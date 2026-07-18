// charts.jsx — Mould Loft's instruments: the ink sparkline, the
// body-plan section gauge, and dithered-div bars. Canvases paint on
// data change only (synchronous), never in a rAF loop — Loft budgets
// ZERO continuously animating canvases.

import React, { useEffect, useRef } from "react";
import { bayerAt, cssColor } from "./texture.js";

/* ── ink sparkline: faired curve with measurement spots ─────── */

export function InkSpark({ data, height = 34 }) {
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
    const py = (v) => H - 7 - (v / max) * (H - 16);
    // pencil under-shading below the curve
    for (let gx = 0; gx < W; gx += 3) {
      const t = gx / W;
      const i = Math.min(data.length - 2, Math.floor(t * (data.length - 1)));
      const f = t * (data.length - 1) - i;
      const v = data[i] + (data[i + 1] - data[i]) * f;
      const top = py(v);
      for (let gy = Math.floor(top); gy < H; gy += 3) {
        const depth = (gy - top) / (H - top || 1);
        if (bayerAt(gx / 3, gy / 3) < 0.3 * (1 - depth * 0.8)) {
          ctx.fillStyle = "rgba(84,76,55,0.45)";
          ctx.fillRect(gx, gy, 2, 2);
        }
      }
    }
    // the inked line
    ctx.strokeStyle = "#1f4e77";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    data.forEach((v, i) => { i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v)); });
    ctx.stroke();
    // measurement spots at each station
    data.forEach((v, i) => {
      ctx.fillStyle = i === data.length - 1 ? "#b3341f" : "#1f4e77";
      ctx.fillRect(px(i) - 2, py(v) - 2, 4, 4);
    });
  }, [JSON.stringify(data), height]);
  return <canvas ref={ref} style={{ width: "100%", height, display: "block" }} aria-hidden />;
}

/* ── section gauge: body-plan half-section inked keel→sheer ──── */

export function SectionGauge({ pct, color = "#1f4e77", size = 64, frames = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const S = size;
    cv.width = S * 2; cv.height = S * 2;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, S, S);
    const col = cssColor(color);
    const cx = S / 2;
    const keelY = S * 0.86, sheerY = S * 0.14;
    const hull = (t) => {
      // half-breadth at height t (0 = keel, 1 = sheer): a fair hull curve
      const b = Math.pow(t, 0.55) * (S * 0.34);
      return b;
    };
    // faint grid behind
    ctx.strokeStyle = "rgba(31,78,119,0.16)";
    ctx.lineWidth = 1;
    for (let y = sheerY; y <= keelY; y += (keelY - sheerY) / 6) {
      ctx.beginPath(); ctx.moveTo(cx - S * 0.4, y); ctx.lineTo(cx + S * 0.4, y); ctx.stroke();
    }
    // centerline
    ctx.setLineDash([3, 2]);
    ctx.strokeStyle = "rgba(33,28,18,0.4)";
    ctx.beginPath(); ctx.moveTo(cx, sheerY - 3); ctx.lineTo(cx, keelY + 3); ctx.stroke();
    ctx.setLineDash([]);
    // full section in pencil
    const drawSection = (toT, style, width) => {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = (i / 40) * toT;
        const y = keelY - t * (keelY - sheerY);
        const x = cx - hull(t);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = (i / 40) * toT;
        const y = keelY - t * (keelY - sheerY);
        const x = cx + hull(t);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    drawSection(1, "rgba(84,76,55,0.55)", 1);          // pencil construction
    drawSection(Math.max(0, Math.min(100, pct)) / 100, col, 2.5); // inked to pct
    // sheer marks when complete
    if (pct >= 100) {
      ctx.fillStyle = cssColor("var(--starboard)", "#206b46");
      ctx.fillRect(cx - hull(1) - 3, sheerY - 1.5, 3, 3);
      ctx.fillRect(cx + hull(1), sheerY - 1.5, 3, 3);
    }
    // percent + frame count
    ctx.fillStyle = pct === 100 ? cssColor("var(--starboard)", "#206b46") : "#211c12";
    ctx.font = `600 ${Math.round(S * 0.19)}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(pct + "%", cx, S * 0.5);
    if (frames > 0) {
      ctx.fillStyle = "rgba(84,76,55,0.85)";
      ctx.font = `500 ${Math.round(S * 0.11)}px 'JetBrains Mono', monospace`;
      ctx.fillText(frames + " FR", cx, S * 0.66);
    }
  }, [pct, color, size, frames]);
  return <canvas ref={ref} style={{ width: size, height: size, flexShrink: 0 }} aria-label={`${pct}% complete`} />;
}

/* ── div bars ───────────────────────────────────────────────── */

export function WeekBars({ data, max = null, showLabels = true }) {
  const top = Math.max(1, max ?? Math.max(...data.map((d) => d.value)));
  return (
    <>
      <div className="lf-wkb">
        {data.map((d, i) => (
          <div key={i} className={"b" + (d.isToday ? " today" : "")} title={d.title || `${d.value}`}>
            <i style={{ height: Math.min(100, (d.value / top) * 100) + "%" }} />
          </div>
        ))}
      </div>
      {showLabels && (
        <div className="lf-wkb-lbl">
          {data.map((d, i) => <span key={i} className={d.isToday ? "today" : ""}>{d.label}</span>)}
        </div>
      )}
    </>
  );
}

export function WeatherBars({ data, threshold = null, height = 44 }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="lf-b14" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className={"b" + (threshold != null && d.value > threshold ? " port" : "")} title={d.title || `${d.value}`}>
          <i style={{ height: (d.value / max) * 100 + "%" }} />
        </div>
      ))}
    </div>
  );
}

export function CalRow({ label, pct, tone = "var(--amber)", value, last = false }) {
  return (
    <div className="lf-cal-row" style={last ? { marginBottom: 0 } : undefined}>
      <span className="lbl w-stencil" style={{ fontSize: 8.5 }}>{label}</span>
      <div className="lf-meter" style={{ flex: 1 }}>
        <div className="lf-fill" style={{ width: Math.max(0, Math.min(100, pct)) + "%", backgroundColor: tone }} />
      </div>
      <span className="val w-num" style={{ fontSize: 11, color: tone }}>{value}</span>
    </div>
  );
}
