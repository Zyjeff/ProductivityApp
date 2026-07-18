// drafting.jsx — Mould Loft's signature chrome: the title block, the
// ghost sheet number, and the SHEER DRAUGHT — a hull lines-plan where
// today's lineup rows are the station lines (pencil = pending, ink =
// done, red pencil = NOW) and the waterline floats on today's XP.
// The draught paints once per data change — no animation loop.

import React, { useEffect, useRef } from "react";
import { sheetFill } from "./texture.js";

/* ── title block ────────────────────────────────────────────── */

export function TitleBlock({ cells }) {
  return (
    <div className="lf-titleblock">
      {cells.filter(Boolean).map((c, i) => (
        <div key={i} className={"lf-cell" + (c.push ? " lf-cell--push" : "")}>
          <span className="k">{c.k}</span>
          <span className="v" style={c.tone ? { color: c.tone } : undefined}>{c.v}</span>
        </div>
      ))}
    </div>
  );
}

/* ── ghost sheet number ─────────────────────────────────────── */

export function GhostSheetNo({ text, fontSize = null, top = null }) {
  return (
    <div className="lf-ghost" aria-hidden style={{
      backgroundImage: sheetFill(String(text), Math.max(220, String(text).length * 110)),
      ...(fontSize ? { fontSize } : {}),
      ...(top != null ? { top } : {}),
    }}>{text}</div>
  );
}

/* ── the sheer draught ──────────────────────────────────────── */
// stations: [{ done, now, title }] in run order (today's lineup).
// waterlinePct: 0..1 — today's XP against the 14-day high water.

export function SheerDraught({ stations, waterlinePct, height = 128 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const W = (cv.width = Math.max(300, cv.offsetWidth) * 2);
    const H = (cv.height = height * 2);
    ctx.clearRect(0, 0, W, H);

    const INK = "#211c12", PENCIL = "rgba(84,76,55,0.75)", RED = "#b3341f", BLUE = "#1f4e77";
    const sheerY = (t) => H * (0.46 - 0.10 * t + 0.05 * Math.sin(t * Math.PI));
    const keelY = (t) => t < 0.75 ? H * 0.80 : H * (0.80 - 0.42 * Math.pow((t - 0.75) / 0.25, 1.5));

    // grid paper
    ctx.strokeStyle = "rgba(31,78,119,0.14)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // waterline — floats on today's XP
    const wl = H * (0.80 - 0.30 * Math.max(0, Math.min(1, waterlinePct)));
    ctx.setLineDash([8, 5]);
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, wl); ctx.lineTo(W, wl); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = BLUE;
    ctx.font = "600 15px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText("▽ LWL", 8, wl - 7);

    // hull profile: sheer + keel + stem + stern, in ink
    const drawCurve = (fn, t0, t1) => {
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const t = t0 + (i / 60) * (t1 - t0);
        const x = W * (0.05 + 0.90 * t);
        i === 0 ? ctx.moveTo(x, fn(t)) : ctx.lineTo(x, fn(t));
      }
      ctx.stroke();
    };
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    drawCurve(sheerY, 0, 1);
    drawCurve(keelY, 0, 1);
    ctx.beginPath(); ctx.moveTo(W * 0.05, sheerY(0)); ctx.lineTo(W * 0.05, keelY(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W * 0.95, sheerY(1)); ctx.lineTo(W * 0.95, keelY(1)); ctx.stroke();

    // stations — one per lineup row, in order, stern → bow
    const n = stations.length;
    stations.forEach((st, i) => {
      const t = n === 1 ? 0.5 : 0.12 + (i / (n - 1)) * 0.74;
      const x = W * (0.05 + 0.90 * t);
      const y0 = sheerY(t), y1 = keelY(t);
      if (st.now) {
        ctx.strokeStyle = RED; ctx.lineWidth = 3; ctx.setLineDash([]);
      } else if (st.done) {
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = PENCIL; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      }
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
      ctx.setLineDash([]);
      // station number under the keel
      ctx.fillStyle = st.now ? RED : st.done ? INK : PENCIL;
      ctx.font = "600 13px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(String(i + 1), x, H * 0.93);
      // NOW marker above the sheer
      if (st.now) {
        ctx.beginPath();
        ctx.moveTo(x, y0 - 14); ctx.lineTo(x - 6, y0 - 24); ctx.lineTo(x + 6, y0 - 24); ctx.closePath();
        ctx.fillStyle = RED; ctx.fill();
      }
    });
  }, [JSON.stringify(stations.map((s) => [s.done, s.now])), stations.length, waterlinePct, height]);

  return (
    <div style={{ position: "relative", border: "1px solid var(--fg)", background: "var(--plate)", boxShadow: "2px 2px 0 rgba(33,28,18,0.12)" }}>
      <canvas ref={ref} style={{ width: "100%", height, display: "block" }} aria-hidden />
      <div style={{ position: "absolute", right: 8, top: 6 }} className="w-stencil">Sheer draught · stations = today's lineup</div>
    </div>
  );
}
