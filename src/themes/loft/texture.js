// texture.js — Mould Loft's seeded dither engine. Same lineage as the
// other themes' (copied, never imported across themes), retuned for
// paper: vellum grain, pencil fades, blueprint statement sheets.
// Everything renders once per parameter set and is cached; nothing
// here ever runs per frame.

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

export function cellNoise(gx, gy, cols, rows, seed) {
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
export const bayerAt = (gx, gy) => (BAYER8[(gy & 7) * 8 + (gx & 7)] + 0.5) / 64;

export function cssColor(c, fallback = "#1f4e77") {
  if (!c) return fallback;
  const m = /^var\((--[a-z0-9-]+)\)$/i.exec(String(c).trim());
  if (!m) return c;
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || fallback;
}

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

export function tex(opts) {
  const key = JSON.stringify(opts);
  const hit = cache.get(key);
  if (hit) return hit;

  const { seed = "loft", algo = "bayer", w = 96, h = 96, cell = 2, fg = "#1f4e77", bg = null, alpha = 1 } = opts;
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

/* ── loft recipes ──────────────────────────────────────────── */

// Edge fade strip, dense at `side`, dissolving away.
export function edgeTex({ seed = "edge", algo, side = "bottom", depth = 28, fg, cell = 2, from = 0.5, alpha = 1 }) {
  const vertical = side === "top" || side === "bottom";
  return tex({
    seed, algo: algo || (side === "top" ? "bayer" : "noise"), cell, fg, alpha,
    w: vertical ? 64 : depth,
    h: vertical ? depth : 64,
    grad: { from, to: 0, dir: side === "bottom" ? "up" : side === "top" ? "down" : side === "left" ? "right" : "left" },
  });
}

// Graphite fade pooling at a sheet's foot — the pencil shadow.
export function pencilFade(seedString, from = 0.22, depth = 18) {
  return edgeTex({ seed: "pencil-" + seedString, side: "bottom", depth, fg: "#8f8569", from });
}

// Blueprint statement sheet: Prussian ground with pale-line dither
// creeping from top and bottom edges; the center stays clean for text
// (statementBg's proven restraint values — a real legibility failure
// set these numbers, don't crank them).
export function blueprintBg(seedString, pale = "#f2ecdc", prussian = "#1f4e77") {
  const topUrl = edgeTex({ seed: seedString + ":t", side: "top", depth: 10, fg: pale, from: 0.3, cell: 2 });
  const botUrl = edgeTex({ seed: seedString + ":b", side: "bottom", depth: 15, fg: pale, from: 0.34, cell: 2 });
  return {
    backgroundColor: prussian,
    backgroundImage: `${topUrl}, ${botUrl}`,
    backgroundRepeat: "repeat-x, repeat-x",
    backgroundPosition: "top left, bottom left",
  };
}

// Faint vellum grain, seeded per entity so every sheet ages its own way.
export function vellumTex(seedString, alphaScale = 1) {
  return tex({
    seed: "vellum-" + seedString, algo: "noise", w: 192, h: 192, cell: 2,
    fg: "#b8ad92", grad: { from: 0.16, to: 0.04, dir: "down" }, alpha: 0.5 * alphaScale,
  });
}

// Ghost sheet-number fill (background-clip: text).
export function sheetFill(seedString, w = 240) {
  return tex({ seed: "sheetno-" + seedString, algo: "bayer", w, h: 168, cell: 3, fg: "#a8bccb", grad: { from: 0.6, to: 0.1, dir: "down" } });
}

export const REDUCED_MOTION = typeof window !== "undefined"
  && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
