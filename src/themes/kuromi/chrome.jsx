import React, { useEffect, useMemo, useState } from "react";
import { impFrame, GLYPH_SKULL, glyph } from "./sprite.js";
import { REDUCED_MOTION } from "./texture.js";

/* ══════════════════════════════════════════════════════════════
   KURO-VISION — the signature panel.

   A CRT screen inside the handheld where a pixel jester-imp lives.
   Her mood is an honest readout of real app state:
     bored — nothing pending, nothing done (an idle menace)
     plot  — schemes pending
     work  — at least one pulled off, more to go
     win   — the day is cleared
   Frames are baked PNG data-URLs (cached in sprite.js); a slow
   interval swaps A/B frames. No per-frame drawing, pauses hidden.
   ══════════════════════════════════════════════════════════════ */

export function KuroVision({ mood = "plot", hud = [], height = 152, caption }) {
  const [frame, setFrame] = useState("a");

  useEffect(() => {
    if (REDUCED_MOTION) return;
    let iv = null;
    const start = () => {
      if (iv || document.hidden) return;
      iv = setInterval(() => setFrame((f) => (f === "a" ? "b" : "a")), 620);
    };
    const stop = () => {
      if (iv) clearInterval(iv);
      iv = null;
    };
    const onVis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const src = useMemo(() => impFrame(`${mood}-${frame}`), [mood, frame]);
  const spriteH = Math.min(135, height - 16);
  const spriteW = Math.round(spriteH * (28 / 24));

  const moodLabel = { bored: "BORED.", plot: "PLOTTING", work: "MID-SCHEME", win: "VICTORY!!" }[mood] || "PLOTTING";

  return (
    <div className="k-vision">
      <div className="k-vision-screen" style={{ minHeight: height }}>
        <div className="k-vision-hud">
          {hud.map((h, i) => (
            <span key={i}>
              <span style={{ color: "rgba(237,220,247,0.55)" }}>{h.label} </span>
              {h.value}
            </span>
          ))}
        </div>
        <img
          className="k-vision-sprite"
          src={src}
          width={spriteW}
          height={spriteH}
          alt={`Kuromi imp — ${moodLabel.toLowerCase()}`}
          draggable={false}
        />
        <div className="k-vision-mood">{caption || moodLabel}</div>
        <div className="k-vision-scan" />
        <div className="k-vision-glass" />
      </div>
    </div>
  );
}

/* ── GhostSkull: giant faint numeral/glyph behind a page head ── */
export function GhostSkull({ size = 120, style }) {
  return (
    <img
      src={glyph(GLYPH_SKULL, "#241632")}
      alt=""
      aria-hidden
      style={{ height: size, imageRendering: "pixelated", ...style }}
    />
  );
}
