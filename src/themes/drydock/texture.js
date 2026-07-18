// texture.js — the 1-Bit Harbor procedural texture engine.
// Seeded, multi-algorithm ordered/blue-noise/error-diffusion dither,
// rendered ONCE per parameter set to an offscreen canvas and cached as
// a data URL. Nothing here ever runs per frame; applying a texture to a
// surface is one function call in a style attribute.

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

// Tileable per-cell hash noise (blue-noise-ish threshold field).
function cellNoise(gx, gy, cols, rows, seed) {
  let h = seed ^ Math.imul(((gx % cols) + cols) % cols, 374761393) ^ Math.imul(((gy % rows) + rows) % rows, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const BAYER8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
];
const bayerAt = (gx, gy) => (BAYER8[(gy & 7) * 8 + (gx & 7)] + 0.5) / 64;

/* ── color plumbing ────────────────────────────────────────── */

export function cssColor(c, fallback = "#f5a524") {
  if (!c) return fallback;
  const m = /^var\((--[a-z0-9-]+)\)$/i.exec(String(c).trim());
  if (!m) return c;
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || fallback;
}

/* ── the renderer ──────────────────────────────────────────── */

const cache = new Map();
export function textureCacheSize() { return cache.size; }

// Density at a grid position, 0..1.
function densityAt(gx, gy, cols, rows, opts) {
  if (opts.grad) {
    const { from, to, dir = "down" } = opts.grad;
    let t;
    if (dir === "down") t = gy / Math.max(1, rows - 1);
    else if (dir === "up") t = 1 - gy / Math.max(1, rows - 1);
    else if (dir === "right") t = gx / Math.max(1, cols - 1);
    else if (dir === "left") t = 1 - gx / Math.max(1, cols - 1);
    else { // radial: dense center → airy edge (or inverse via from>to)
      const dx = gx / (cols - 1) - 0.5, dy = gy / (rows - 1) - 0.5;
      t = Math.min(1, Math.hypot(dx, dy) * 2);
    }
    return from + (to - from) * t;
  }
  return opts.density ?? 0.3;
}

/**
 * tex(opts) → dataURL. Options:
 *  seed   string — identity; same seed, same texture, forever
 *  algo   'bayer' | 'noise' | 'fs'
 *  w,h    px; cell px (chunk size, default 2)
 *  fg     dot color (css or var()); bg optional solid backing
 *  density 0..1  OR  grad {from,to,dir:'down'|'up'|'left'|'right'|'radial'}
 *  alpha  dot opacity (default 1)
 */
export function tex(opts) {
  const key = JSON.stringify(opts);
  const hit = cache.get(key);
  if (hit) return hit;

  const { seed = "werf", algo = "bayer", w = 96, h = 96, cell = 2, fg = "#f5a524", bg = null, alpha = 1 } = opts;
  const cols = Math.max(1, Math.ceil(w / cell));
  const rows = Math.max(1, Math.ceil(h / cell));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (bg) { ctx.fillStyle = cssColor(bg); ctx.fillRect(0, 0, w, h); }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = cssColor(fg);

  const sd = hashSeed(seed + "|" + algo);

  if (algo === "fs") {
    // Floyd–Steinberg error diffusion over the density field, with a
    // whisper of seeded noise so identical fields still differ by seed.
    const rand = mulberry32(sd);
    const err = new Float32Array(cols * rows);
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const i = gy * cols + gx;
        const want = densityAt(gx, gy, cols, rows, opts) + err[i] + (rand() - 0.5) * 0.06;
        const on = want >= 0.5;
        const e = want - (on ? 1 : 0);
        if (on) ctx.fillRect(gx * cell, gy * cell, cell - 0.5, cell - 0.5);
        if (gx + 1 < cols) err[i + 1] += e * 7 / 16;
        if (gy + 1 < rows) {
          if (gx > 0) err[i + cols - 1] += e * 3 / 16;
          err[i + cols] += e * 5 / 16;
          if (gx + 1 < cols) err[i + cols + 1] += e * 1 / 16;
        }
      }
    }
  } else {
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const d = densityAt(gx, gy, cols, rows, opts);
        const thr = algo === "noise" ? cellNoise(gx, gy, cols, rows, sd) : bayerAt(gx + (sd & 7), gy + ((sd >> 3) & 7));
        if (d > thr) ctx.fillRect(gx * cell, gy * cell, cell - 0.5, cell - 0.5);
      }
    }
  }

  const url = `url("${canvas.toDataURL("image/png")}")`;
  cache.set(key, url);
  return url;
}

/* ── convenience recipes ───────────────────────────────────── */

// Edge fade strip: dense at `side`, dissolving away. Tileable along the
// perpendicular axis — repeat it with CSS.
export function edgeTex({ seed = "edge", algo = "bayer", side = "bottom", depth = 28, fg, cell = 2, from = 0.5, alpha = 1 }) {
  const vertical = side === "top" || side === "bottom";
  return tex({
    seed, algo, cell, fg, alpha,
    w: vertical ? 64 : depth,
    h: vertical ? depth : 64,
    grad: { from, to: 0, dir: side === "bottom" ? "up" : side === "top" ? "down" : side === "left" ? "right" : "left" },
  });
}

// Per-card identity texture: the seed picks the algorithm, density, and
// grain size, so no two loud plates ever match — and a given card keeps
// its texture across re-renders because the cache is keyed by seed.
export function plateTex(seedString, fg = "#9fb0d0", alphaScale = 1) {
  const h = hashSeed(seedString);
  const algo = ["bayer", "noise", "fs"][h % 3];
  const cell = 2 + ((h >> 4) % 2);              // 2 or 3
  const base = 0.10 + ((h >> 6) % 5) * 0.02;    // 0.10 – 0.18
  const dirs = ["down", "right", "radial", "up"];
  return tex({
    seed: seedString, algo, cell, fg,
    w: 192, h: 192,
    grad: { from: base + 0.12, to: Math.max(0.02, base - 0.08), dir: dirs[(h >> 8) % 4] },
    alpha: 0.5 * alphaScale,
  });
}

// The statement-plate treatment: dark ink dither creeping from top and
// bottom edges of an amber surface. Returns a two-layer background.
export function statementBg(seedString, ink = "#14100a", amber = "#f5a524") {
  // Restrained by the legibility law: the dither creeps in from the
  // edges but the center panel stays clean for text.
  const topUrl = edgeTex({ seed: seedString + ":t", algo: "bayer", side: "top", depth: 10, fg: ink, from: 0.3, cell: 2 });
  const botUrl = edgeTex({ seed: seedString + ":b", algo: "noise", side: "bottom", depth: 14, fg: ink, from: 0.34, cell: 2 });
  return {
    backgroundColor: amber,
    backgroundImage: `${topUrl}, ${botUrl}`,
    backgroundRepeat: "repeat-x, repeat-x",
    backgroundPosition: "top left, bottom left",
  };
}

export const REDUCED_MOTION = typeof window !== "undefined"
  && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
