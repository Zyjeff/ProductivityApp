// Verdant presentation. State and mutations use the shared core contract.
import React, { useEffect, useRef } from "react";
import { bayerAt, cssColor } from "./texture.js";

/* ── XP sparkline: amber line over a dithered area fill ─────── */

export function Spark({ data, height = 34 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !data || data.length < 2) return;
    const ctx = cv.getContext("2d");
    const W = (cv.width = Math.max(60, cv.offsetWidth) * 2);
    const H = (cv.height = height * 2);
    const max = Math.max(...data, 1);
    ctx.clearRect(0, 0, W, H);
    const px = (i) => (i / (data.length - 1)) * (W - 8) + 4;
    const py = (v) => H - 6 - (v / max) * (H - 14);
    for (let gx = 0; gx < W; gx += 3) {
      const t = gx / W;
      const i = Math.min(data.length - 2, Math.floor(t * (data.length - 1)));
      const f = t * (data.length - 1) - i;
      const v = data[i] + (data[i + 1] - data[i]) * f;
      const top = py(v);
      for (let gy = Math.floor(top); gy < H; gy += 3) {
        const depth = (gy - top) / (H - top || 1);
        if (bayerAt(gx / 3, gy / 3) < 0.42 * (1 - depth * 0.75)) {
          ctx.fillStyle = "rgba(142,236,109,0.3)";
          ctx.fillRect(gx, gy, 2, 2);
        }
      }
    }
    ctx.strokeStyle = "#93e970";
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((v, i) => { i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v)); });
    ctx.stroke();
    ctx.fillStyle = "#c5ffab";
    ctx.fillRect(px(data.length - 1) - 2.5, py(data[data.length - 1]) - 2.5, 5, 5);
  }, [JSON.stringify(data), height]);
  return <canvas ref={ref} style={{ width: "100%", height, display: "block" }} aria-hidden />;
}

/* ── week bars: dithered div columns with labels ────────────── */

export function WeekBars({ data, max = null, showLabels = true }) {
  const top = Math.max(1, max ?? Math.max(...data.map((d) => d.value)));
  return (
    <>
      <div className="weekbars">
        {data.map((d, i) => (
          <div key={i} className={"wb" + (d.isToday ? " today" : "")} title={d.title || `${d.value}`}>
            <i style={{ height: Math.min(100, (d.value / top) * 100) + "%" }} />
          </div>
        ))}
      </div>
      {showLabels && (
        <div className="weekbars-lbl">
          {data.map((d, i) => <span key={i} className={d.isToday ? "today" : ""}>{d.label}</span>)}
        </div>
      )}
    </>
  );
}

/* ── screen-weather bars: value columns, heavy days marked ──── */

export function WeatherBars({ data, threshold = null, height = 44 }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="screen14" style={{ height }}>
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
    <div className="cal-row" style={last ? { marginBottom: 0 } : undefined}>
      <span className="cal-label w-stencil" style={{ fontSize: 8.5 }}>{label}</span>
      <div className="meter" style={{ flex: 1 }}>
        <div className="meter-fill" style={{ width: Math.max(0, Math.min(100, pct)) + "%", backgroundColor: tone }} />
      </div>
      <span className="cal-val w-num" style={{ fontSize: 11, color: tone }}>{value}</span>
    </div>
  );
}
