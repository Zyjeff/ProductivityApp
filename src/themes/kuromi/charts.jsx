import React, { useEffect, useMemo, useRef } from "react";
import { REDUCED_MOTION } from "./texture.js";

/* ── Spark: canvas pixel sparkline ─────────────────────────────
   Points: number[]. Paints synchronously first, then a stepped
   reveal via rAF (skipped under reduced motion). */
export function Spark({ points, width = 150, height = 30, color = "#ff4d9e", title }) {
  const ref = useRef(null);
  const key = JSON.stringify(points);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = width * dpr;
    cv.height = height * dpr;
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    const draw = (t) => {
      ctx.clearRect(0, 0, width, height);
      const pts = points.length ? points : [0];
      const max = Math.max(1, ...pts);
      const n = pts.length;
      const upto = Math.max(1, Math.ceil(n * t));
      // pixel columns
      for (let i = 0; i < upto; i++) {
        const v = pts[i] / max;
        const x = Math.round((i / Math.max(1, n - 1)) * (width - 4)) + 2;
        const y = Math.round(height - 3 - v * (height - 8));
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 3, 3);
        if (i > 0) {
          const pv = pts[i - 1] / max;
          const px = Math.round(((i - 1) / Math.max(1, n - 1)) * (width - 4)) + 2;
          const py = Math.round(height - 3 - pv * (height - 8));
          // stepped connector
          ctx.fillRect(Math.min(px, x) + 1, Math.min(py, y) + 1, Math.abs(x - px) + 1, 2);
          ctx.fillRect(x + 1, Math.min(py, y) + 1, 2, Math.abs(y - py) + 1);
        }
      }
      // baseline
      ctx.fillStyle = "rgba(141,111,168,0.5)";
      for (let x = 0; x < width; x += 4) ctx.fillRect(x, height - 2, 2, 1);
    };

    draw(1); // synchronous first paint
    if (REDUCED_MOTION) return;
    let raf;
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 420);
      draw(Math.round(t * 6) / 6); // stepped, not smooth
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key, width, height, color]);

  return (
    <canvas
      ref={ref}
      style={{ width, height, display: "block", imageRendering: "pixelated" }}
      title={title}
      aria-label={title}
    />
  );
}

/* ── WeekBars: dithered div bars, 7 days ─────────────────────── */
export function WeekBars({ days, tone = "pink", height = 54 }) {
  // days: [{ label, value, title, isToday }]
  const max = Math.max(1, ...days.map((d) => d.value));
  const color =
    tone === "green" ? "var(--starboard)" : tone === "violet" ? "var(--port)" : "var(--amber)";
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height }}>
      {days.map((d, i) => (
        <div
          key={i}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}
          title={d.title}
        >
          <div
            style={{
              width: "100%",
              flex: "0 0 auto",
              height: Math.max(d.value > 0 ? 4 : 2, Math.round((d.value / max) * (height - 18))),
              background: color,
              opacity: d.isToday ? 1 : 0.72,
              borderRadius: "3px 3px 0 0",
              position: "relative",
              outline: d.isToday ? "1.5px solid var(--fg)" : "none",
              outlineOffset: 1,
            }}
          >
            <div style={{ position: "absolute", inset: 0, background: "var(--dither-dot)", borderRadius: "inherit" }} />
          </div>
          <div className="k-mono" style={{ fontSize: 11.5, color: "var(--fg-faint)" }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── ScreenBars: 7-day screen-time (x / yt / mobile) ─────────── */
export function ScreenBars({ days }) {
  // days: [{ label, x, yt, mobile, title }]
  const hasAny = days.some((d) => d.x > 0 || d.yt > 0 || (d.mobile || 0) > 0);
  if (!hasAny) {
    return (
      <div className="k-mono-sm k-faint" style={{ padding: "10px 2px" }}>
        No openings logged this week. Either you behaved… or you forgot to confess.
      </div>
    );
  }
  const max = Math.max(1, ...days.map((d) => d.x + d.yt));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 64 }}>
        {days.map((d, i) => (
          <div
            key={i}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}
            title={d.title}
          >
            <div style={{ width: "100%", display: "flex", flexDirection: "column-reverse", gap: 1 }}>
              <div
                style={{
                  height: Math.max(d.x > 0 ? 3 : 0, Math.round((d.x / max) * 48)),
                  background: "var(--port)",
                  borderRadius: 2,
                }}
              />
              <div
                style={{
                  height: Math.max(d.yt > 0 ? 3 : 0, Math.round((d.yt / max) * 48)),
                  background: "var(--warn)",
                  borderRadius: 2,
                }}
              />
            </div>
            <div className="k-mono" style={{ fontSize: 11.5, color: "var(--fg-faint)" }}>{d.label}</div>
          </div>
        ))}
      </div>
      <div className="k-rowline k-mono-sm k-faint" style={{ gap: 14, marginTop: 8 }}>
        <span><span style={{ color: "var(--port)" }}>■</span> X opens</span>
        <span><span style={{ color: "var(--warn)" }}>■</span> YT opens</span>
        <span><span style={{ color: "var(--amber-hot)" }}>■</span> mobile {days.reduce((a, d) => a + (d.mobile || 0), 0).toFixed(1)}h wk</span>
      </div>
    </div>
  );
}

/* ── CalRow: calibration factor meter (1.0 = honest) ─────────── */
export function CalRow({ label, factor, n }) {
  // factor: actual/estimated; >1 means things take longer than guessed
  const pct = Math.max(4, Math.min(100, (factor / 2) * 100));
  const tone = factor <= 1.15 ? "green" : factor <= 1.6 ? "warn" : undefined;
  return (
    <div style={{ marginBottom: 9 }}>
      <div className="k-rowline k-mono-sm" style={{ marginBottom: 4 }}>
        <span className="k-dim">{label}</span>
        <span className="k-spacer" />
        <span className="k-faint">{n} pulled off</span>
        <span className={factor <= 1.15 ? "k-green" : "k-pink"}>×{factor.toFixed(2)}</span>
      </div>
      <div className="k-meter" style={{ height: 8 }}>
        <div
          className={"k-meter-fill" + (tone ? " is-" + tone : "")}
          style={{ width: pct + "%" }}
        />
      </div>
    </div>
  );
}

/* ── HPBar: boss health — drains as children complete ────────── */
export function HPBar({ pct, seedTex }) {
  // pct: 0..100 remaining "fight" (100 = untouched, 0 = beaten)
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="k-meter"
      style={{ height: 14, borderRadius: 4, backgroundImage: seedTex || "none" }}
    >
      <div
        className="k-meter-fill"
        style={{
          width: p + "%",
          background:
            p > 55 ? "var(--amber)" : p > 25 ? "var(--warn)" : "var(--starboard)",
        }}
      />
    </div>
  );
}

/* ── DraughtGauge: vertical level gauge for the nav strip ────── */
export function PixelGauge({ pct, tone }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="k-meter" style={{ height: 8, width: 64 }} title={`${p}%`}>
      <div className={"k-meter-fill" + (tone ? " is-" + tone : "")} style={{ width: p + "%" }} />
    </div>
  );
}
