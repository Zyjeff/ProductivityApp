// texture.js — Kaze's paper-and-ink engine. Same lineage as the other
// themes' dither engines (seeded, rendered ONCE per parameter set,
// cached as a data URL, never touched per frame) — but the recipes are
// washi paper grain, sumi ink wash, and gold-leaf flake instead of
// 1-bit dither. Nothing here runs in a rAF loop.

/* ── seeded randomness ─────────────────────────────────────── */

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashSeed(str) { return xmur3(String(str))(); }

// Deterministic per-cell hash — the fibre field for washi grain.
export function cellNoise(gx, gy, cols, rows, seed) {
  let h = seed ^ Math.imul(((gx % cols) + cols) % cols, 374761393) ^ Math.imul(((gy % rows) + rows) % rows, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ── color plumbing ────────────────────────────────────────── */

export function cssColor(c, fallback = "#c8763c") {
  if (!c) return fallback;
  const m = /^var\((--[a-z0-9-]+)\)$/i.exec(String(c).trim());
  if (!m) return c;
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || fallback;
}

function withAlpha(hex, a) {
  const h = cssColor(hex);
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h.trim());
  if (!m) return h;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}

/* ── the renderer ──────────────────────────────────────────── */

const cache = new Map();
export function textureCacheSize() { return cache.size; }

function densityAt(gx, gy, cols, rows, opts) {
  if (opts.grad) {
    const { from, to, dir = "down" } = opts.grad;
    let t;
    if (dir === "down") t = gy / Math.max(1, rows - 1);
    else if (dir === "up") t = 1 - gy / Math.max(1, rows - 1);
    else if (dir === "right") t = gx / Math.max(1, cols - 1);
    else if (dir === "left") t = 1 - gx / Math.max(1, cols - 1);
    else {
      const dx = gx / (cols - 1) - 0.5, dy = gy / (rows - 1) - 0.5;
      t = Math.min(1, Math.hypot(dx, dy) * 2);
    }
    return from + (to - from) * t;
  }
  return opts.density ?? 0.3;
}

// The base renderer. algo:
//   "washi"  — long paper fibres, soft and irregular (the ground)
//   "sumi"   — ink-wash stipple that thins with the gradient
//   "kinpaku"— gold-leaf flakes, sparse angular specks (elevated surfaces)
export function tex(opts) {
  const key = JSON.stringify(opts);
  const hit = cache.get(key);
  if (hit) return hit;
  if (typeof document === "undefined") return "none";

  const { seed = "kaze", algo = "washi", w = 96, h = 96, cell = 2, fg = "#2b2119", bg = null, alpha = 1 } = opts;
  const cols = Math.max(1, Math.ceil(w / cell));
  const rows = Math.max(1, Math.ceil(h / cell));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (bg) { ctx.fillStyle = cssColor(bg); ctx.fillRect(0, 0, w, h); }
  ctx.globalAlpha = alpha;

  const sd = hashSeed(seed + "|" + algo);
  const col = cssColor(fg);

  if (algo === "washi") {
    // Paper fibres: short horizontal-ish strokes at low opacity, plus
    // a faint speckle. Reads as handmade stock, not as noise.
    const rand = mulberry32(sd);
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const d = densityAt(gx, gy, cols, rows, opts);
        if (cellNoise(gx, gy, cols, rows, sd) < d * 0.5) {
          ctx.fillStyle = withAlpha(col, 0.06 + rand() * 0.06);
          ctx.fillRect(gx * cell, gy * cell, cell, cell * 0.6);
        }
      }
    }
    const fibres = Math.round((w * h) / 900);
    for (let i = 0; i < fibres; i++) {
      const x = rand() * w, y = rand() * h;
      const len = 6 + rand() * 18;
      const drift = (rand() - 0.5) * 3;
      ctx.strokeStyle = withAlpha(col, 0.05 + rand() * 0.05);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + drift);
      ctx.stroke();
    }
  } else if (algo === "sumi") {
    // Ink wash: stipple whose density follows the gradient, with a
    // slight pooling bias so edges read wet.
    const rand = mulberry32(sd);
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const d = densityAt(gx, gy, cols, rows, opts);
        const n = cellNoise(gx, gy, cols, rows, sd);
        if (n < d) {
          const wet = 0.10 + (d - n) * 0.5;
          ctx.fillStyle = withAlpha(col, Math.min(0.5, wet));
          const r = cell * (0.5 + rand() * 0.6);
          ctx.beginPath();
          ctx.arc(gx * cell + cell / 2, gy * cell + cell / 2, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  } else if (algo === "kinpaku") {
    // Gold leaf: sparse angular flakes. Deliberately few — this marks
    // elevated surfaces, it must never become a texture wall.
    const rand = mulberry32(sd);
    const flakes = Math.max(4, Math.round((w * h) / 1400));
    for (let i = 0; i < flakes; i++) {
      const gx = Math.floor(rand() * cols), gy = Math.floor(rand() * rows);
      const d = densityAt(gx, gy, cols, rows, opts);
      if (rand() > d) continue;
      const x = gx * cell, y = gy * cell;
      const s = cell * (1 + rand() * 2.4);
      ctx.fillStyle = withAlpha(col, 0.16 + rand() * 0.30);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + s, y + s * (0.2 + rand() * 0.5));
      ctx.lineTo(x + s * (0.3 + rand() * 0.5), y + s);
      ctx.closePath();
      ctx.fill();
    }
  }

  const url = `url("${canvas.toDataURL("image/png")}")`;
  cache.set(key, url);
  return url;
}

/* ── convenience recipes ───────────────────────────────────── */

// The page ground: washi stock. One tile, repeated.
export function washi(seedString = "ground", fg = "#3a2c20") {
  return tex({ seed: "washi-" + seedString, algo: "washi", w: 128, h: 128, cell: 2, fg, density: 0.5 });
}

// An ink wash creeping in from one edge — used to close a surface.
export function inkEdge({ seed = "edge", side = "bottom", depth = 30, fg = "#241b14", cell = 2, from = 0.55, alpha = 1 }) {
  const vertical = side === "top" || side === "bottom";
  return tex({
    seed, algo: "sumi", cell, fg, alpha,
    w: vertical ? 72 : depth,
    h: vertical ? depth : 72,
    grad: { from, to: 0, dir: side === "bottom" ? "up" : side === "top" ? "down" : side === "left" ? "right" : "left" },
  });
}

// Surface under-fade: the ink pooling at a card's foot.
export function plateFade(seedString, fg = "#241b14", from = 0.4, depth = 22) {
  return inkEdge({ seed: "fade-" + seedString, side: "bottom", depth, fg, from });
}

// A lit surface (the amber statement plates): gold leaf caught in the
// top and bottom edges, the middle left clean so text stays legible.
// The ground defaults to the phase's --leaf token, which is held above
// the 9:1 ink-on-amber contrast floor in every phase.
export function leafBg(seedString, ground = "var(--leaf)", leaf = "#f3dca6") {
  ground = cssColor(ground, "#e8a468");
  const topUrl = tex({ seed: seedString + ":lt", algo: "kinpaku", w: 90, h: 16, cell: 2, fg: leaf, grad: { from: 0.85, to: 0, dir: "down" } });
  const botUrl = tex({ seed: seedString + ":lb", algo: "kinpaku", w: 90, h: 22, cell: 2, fg: leaf, grad: { from: 0.85, to: 0, dir: "up" } });
  return {
    backgroundColor: ground,
    backgroundImage: `${topUrl}, ${botUrl}`,
    backgroundRepeat: "repeat-x, repeat-x",
    backgroundPosition: "top left, bottom left",
  };
}

// The ghost kanji/numeral behind a view header.
export function ghostWash(seedString, w = 260, h = 168) {
  return tex({ seed: "ghost-" + seedString, algo: "sumi", w, h, cell: 3, fg: "#4a3828", grad: { from: 0.6, to: 0.05, dir: "down" } });
}

/* ── motion budget ─────────────────────────────────────────── */

export const REDUCED_MOTION = typeof window !== "undefined"
  && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ── the clock → palette phase (departure #7) ──────────────── */
// The whole app's palette tracks the real day. Derived from the
// system clock only — nothing is stored, nothing is faked.
export function phaseAt(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h < 5) return "night";
  if (h < 8) return "dawn";
  if (h < 16) return "day";
  if (h < 19.5) return "golden";
  if (h < 21.5) return "dusk";
  return "night";
}

export const PHASE_LABEL = {
  dawn: "first light",
  day: "high sun",
  golden: "golden hour",
  dusk: "dusk",
  night: "night road",
};
