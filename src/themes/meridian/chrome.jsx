// chrome.jsx — Nightwatch's signature chrome: the harbor strip (ship's
// clock, watch, bells), the ghost numeral, and the horizon canvas.
// Everything shown derives from the real clock or real app state; the
// horizon is decoration and honors reduced-motion + hidden tabs.

import React, { useEffect, useRef, useState } from "react";
import { cellNoise, bayerAt, ghostFill, REDUCED_MOTION } from "./texture.js";

/* ── ship's time: 4-hour watches, a bell each half hour ─────── */

const WATCHES = [
  [0, "MIDDLE WATCH"], [4, "MORNING WATCH"], [8, "FORENOON"],
  [12, "AFTERNOON"], [16, "FIRST DOG"], [18, "LAST DOG"], [20, "FIRST WATCH"],
];

export function bells(now = new Date()) {
  const h = now.getHours(), m = now.getMinutes();
  const watchStart = Math.floor(h / 4) * 4;
  const into = (h - watchStart) * 60 + m;
  const n = Math.min(8, Math.max(1, Math.floor(into / 30) + 1));
  let name = "MIDDLE WATCH";
  for (const [start, label] of WATCHES) if (h >= start) name = label;
  return { n, name, time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) };
}

// The strip: port cell, per-view context cells, then clock · watch · bells.
export function HarborStrip({ view, cells = [] }) {
  const [b, setB] = useState(() => bells());
  useEffect(() => {
    const t = setInterval(() => setB(bells()), 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="harbor-strip">
      <div className="strip-cell">
        <span className="lamp lamp--ok" /> PORT OF WERF{view ? <span style={{ color: "var(--fg-faint)" }}>/ {view}</span> : null}
      </div>
      {cells.filter(Boolean).map((c, i) => (
        <div key={i} className="strip-cell strip-cell--optional">{c}</div>
      ))}
      <div className="strip-cell strip-cell--push"><span className="w-num">{b.time} LT</span></div>
      <div className="strip-cell"><span>{b.name}</span></div>
      <div className="strip-cell">
        <span className="strip-bells" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => <i key={i} className={i < b.n ? "on" : ""} />)}
        </span>
        <span className="w-num" style={{ color: "var(--amber)" }}>{b.n} {b.n === 1 ? "BELL" : "BELLS"}</span>
      </div>
    </div>
  );
}

/* ── ghost numeral: the view's big dithered digit ───────────── */

export function GhostNumeral({ text, fontSize = null, top = null }) {
  return (
    <div className="ghost-numeral" aria-hidden style={{
      backgroundImage: ghostFill(text, Math.max(220, String(text).length * 110)),
      ...(fontSize ? { fontSize } : {}),
      ...(top != null ? { top } : {}),
    }}>{text}</div>
  );
}

/* ── the horizon: dithered night sea, stepped ~9fps ─────────── */

export function Horizon({ hud = null, height = 132 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const CELL = 3;
    let cols, rows, alive = true;

    function size() {
      const r = cv.parentElement.getBoundingClientRect();
      cols = Math.max(60, Math.floor(r.width / CELL));
      rows = Math.max(24, Math.floor(r.height / CELL));
      cv.width = cols; cv.height = rows;
    }
    size();
    const onResize = () => { size(); frame(performance.now()); };
    window.addEventListener("resize", onResize);

    const waterline = (gx, base, amp, k, phase) =>
      base + amp * Math.sin(gx * k + phase) + amp * 0.5 * Math.sin(gx * k * 2.7 + phase * 1.6);

    function frame(t) {
      const phase = t * 0.00045;
      ctx.fillStyle = "#04060a";
      ctx.fillRect(0, 0, cols, rows);
      const horizonY = Math.floor(rows * 0.42);

      for (let i = 0; i < 40; i++) {
        const sx = Math.floor(cellNoise(i, 3, 40, 1, 777) * cols);
        const sy = Math.floor(cellNoise(i, 9, 40, 1, 555) * horizonY * 0.8);
        if (cellNoise(sx, sy, cols, rows, 111) > 0.55) {
          ctx.fillStyle = "rgba(151,161,181,0.5)";
          ctx.fillRect(sx, sy, 1, 1);
        }
      }

      const mx = Math.floor(cols * 0.78), my = Math.floor(rows * 0.17), mr = Math.floor(rows * 0.15);
      for (let gy = my - mr; gy <= my + mr; gy++) {
        for (let gx = mx - mr; gx <= mx + mr; gx++) {
          const d = Math.hypot(gx - mx, gy - my);
          if (d <= mr && bayerAt(gx, gy) > (d / mr) * 0.45) {
            ctx.fillStyle = d < mr * 0.55 ? "#ffc25e" : "#f5a524";
            ctx.fillRect(gx, gy, 1, 1);
          }
        }
      }

      for (let gx = 0; gx < cols; gx++) {
        const wl = horizonY + waterline(gx, 4, 2.2, 0.05, phase * 0.6);
        for (let gy = Math.max(0, Math.floor(wl)); gy < rows; gy++) {
          const depth = (gy - wl) / (rows - wl);
          if (cellNoise(gx, gy, cols, rows, 42) < 0.3 + depth * 0.55) {
            ctx.fillStyle = "#1a2540";
            ctx.fillRect(gx, gy, 1, 1);
          }
        }
      }

      for (let gy = horizonY + 2; gy < rows; gy++) {
        const spread = 4 + (gy - horizonY) * 0.55;
        for (let gx = Math.floor(mx - spread); gx < mx + spread; gx++) {
          if (gx < 0 || gx >= cols) continue;
          const wob = Math.sin(gy * 0.7 + phase * 3) * 2;
          const d = Math.abs(gx - mx + wob) / spread;
          if (cellNoise(gx, gy, cols, rows, 99) < 0.62 * (1 - d) * (1 - (gy - horizonY) / rows)) {
            ctx.fillStyle = "rgba(255,194,94,0.9)";
            ctx.fillRect(gx, gy, 1, 1);
          }
        }
      }

      for (let gx = 0; gx < cols; gx++) {
        const wl = horizonY + 7 + waterline(gx, 2, 2.8, 0.075, phase * 1.4 + 2);
        for (let gy = Math.max(0, Math.floor(wl)); gy < rows; gy++) {
          const depth = (gy - wl) / (rows - wl);
          if (bayerAt(gx, gy) < 0.5 + depth * 0.5) {
            ctx.fillStyle = "#27395e";
            ctx.fillRect(gx, gy, 1, 1);
          }
          if (gy === Math.floor(wl) && cellNoise(gx, Math.floor(t / 700), cols, rows, 7) > 0.55) {
            ctx.fillStyle = "#4d6494";
            ctx.fillRect(gx, gy, 1, 1);
          }
        }
      }
    }

    frame(0); // always paint one frame, even without the loop

    let raf = null;
    if (!REDUCED_MOTION) {
      let last = 0;
      const loop = (t) => {
        if (!alive) return;
        if (!document.hidden && t - last > 110) { frame(t); last = t; }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    return () => { alive = false; if (raf) cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);

  return (
    <div className="horizon" style={{ height }}>
      <canvas ref={ref} aria-hidden />
      {hud && (
        <div className="horizon-hud">
          {hud.map((h, i) => (
            <span key={i} className={h.right ? "right" : undefined}>
              {h.right
                ? h.items.map((x, j) => <span key={j}>{x.label} {x.value != null && <b>{x.value}</b>}</span>)
                : <>{h.label} {h.value != null && <b>{h.value}</b>}</>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
