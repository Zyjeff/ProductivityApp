// wind.jsx — The Guiding Wind. Kaze's signature instrument AND its
// navigation, fused into one object (the departure: no other theme
// makes its live data visual the thing you click to travel).
//
// Everything it draws is derived from real state:
//   petal density   ← adrift (Weathered) count
//   wind steadiness ← current streak (a long streak = a steady wind)
//   ribbon warmth   ← the real clock, via texture.js phaseAt()
//   ribbon lift     ← today's completed share of the lineup
//
// Animation budget, same four rules as the reference horizon:
//   low-res buffer upscaled · stepped ~9fps · one synchronous first
//   frame · stops under document.hidden and prefers-reduced-motion.

import React, { useEffect, useRef } from "react";
import { REDUCED_MOTION, cssColor } from "./texture.js";

const FPS = 9;

function hash(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export function WindRibbon({ adrift = 0, streak = 0, lift = 0, phase = "golden" }) {
  const ref = useRef(null);
  const state = useRef({ adrift, streak, lift, phase });
  state.current = { adrift, streak, lift, phase };

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    // Low-res buffer; CSS upscales it. Cheap by construction.
    const W = 320, H = 66;
    cv.width = W; cv.height = H;

    let raf = null, timer = null, t = 0, stopped = false;

    const draw = () => {
      const { adrift: ad, streak: st, lift: lf } = state.current;
      const sky1 = cssColor("var(--sky-1)", "#e0993f");
      const sky2 = cssColor("var(--sky-2)", "#c86a3a");
      const petalCol = cssColor("var(--petal)", "#f0a3bd");

      ctx.clearRect(0, 0, W, H);

      // The ribbon: three stacked strokes. Steadiness rises with the
      // streak — a long streak makes the wind lie flat and calm.
      const steadiness = Math.min(1, st / 12);
      const wobble = 1 - steadiness * 0.72;
      const baseY = H * 0.56 - lf * 8;

      for (let layer = 0; layer < 3; layer++) {
        const amp = (3.4 + layer * 2.1) * wobble;
        const speed = 0.5 + layer * 0.26;
        const yOff = baseY + (layer - 1) * 5.5;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 4) {
          const y = yOff
            + Math.sin((x * 0.021) + t * speed * 0.09 + layer) * amp
            + Math.sin((x * 0.007) - t * speed * 0.05) * amp * 0.5;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        const grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(0.22, layer === 1 ? sky1 : sky2);
        grad.addColorStop(0.8, layer === 1 ? sky1 : sky2);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.strokeStyle = grad;
        ctx.globalAlpha = layer === 1 ? 0.5 : 0.24;
        ctx.lineWidth = layer === 1 ? 1.5 : 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Petals stream along the wind. One petal per adrift item, capped
      // so a bad week doesn't become a blizzard.
      const n = Math.min(14, ad);
      for (let i = 0; i < n; i++) {
        const seed = hash(i * 977 + 13);
        const speed = 0.6 + seed * 0.9;
        const x = (W + 40 - ((t * speed * 2.1) + seed * W) % (W + 60));
        const y = baseY + Math.sin(x * 0.02 + i) * (7 * wobble) + (seed - 0.5) * 15;
        const s = 1.6 + seed * 1.5;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 0.06 + i);
        ctx.fillStyle = petalCol;
        ctx.globalAlpha = 0.32 + seed * 0.35;
        ctx.beginPath();
        ctx.ellipse(0, 0, s, s * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };

    // One synchronous first frame — never render a blank pane.
    draw();

    const loop = () => {
      if (stopped) return;
      timer = setTimeout(() => {
        raf = requestAnimationFrame(() => {
          if (document.hidden) { loop(); return; }
          t += 1;
          draw();
          loop();
        });
      }, 1000 / FPS);
    };

    if (!REDUCED_MOTION) loop();

    const onVis = () => { if (!document.hidden && REDUCED_MOTION) draw(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} className="kz-wind-canvas" aria-hidden />;
}
