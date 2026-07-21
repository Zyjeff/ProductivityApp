// texture.js — Apogee's seeded dither engine. Same lineage as
// Nightwatch/Drydock: rendered ONCE per parameter set, cached as a
// data URL, never touched per frame. Recipes tuned for CRT phosphor
// red / white / cyan / deep-blue mission aesthetic.

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

/* ── color plumbing ────────────────────────────────────────── */

export function cssColor(c, fallback = "#ff2b1a") {
  if (!c) return fallback;
  const m = /^var\((--[a-z0-9-]+)\)$/i.exec(String(c).trim());
  if (!m) return c;
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || fallback;
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

export function tex(opts) {
  const key = JSON.stringify(opts);
  const hit = cache.get(key);
  if (hit) return hit;

  const { seed = "werf", algo = "bayer", w = 96, h = 96, cell = 2, fg = "#ff2b1a", bg = null, alpha = 1 } = opts;
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

/* ── convenience recipes ───────────────────────────────────── */

export function edgeTex({ seed = "edge", algo, side = "bottom", depth = 28, fg, cell = 2, from = 0.5, alpha = 1 }) {
  const vertical = side === "top" || side === "bottom";
  return tex({
    seed, algo: algo || (side === "top" ? "bayer" : "noise"), cell, fg, alpha,
    w: vertical ? 64 : depth,
    h: vertical ? depth : 64,
    grad: { from, to: 0, dir: side === "bottom" ? "up" : side === "top" ? "down" : side === "left" ? "right" : "left" },
  });
}

// Four-stop vertical ramp: signal red → white → channel cyan → deep blue.
// Custom FS dither inside rampTex (base tex() only supports 2-stop grads).
export function rampTex(seed = "ramp", w = 96, h = 160) {
  const key = "ramp:" + seed + ":" + w + ":" + h;
  const hit = cache.get(key);
  if (hit) return hit;

  const STOPS = [
    { hex: "#ff2b1a", r: 255, g: 43, b: 26 },   // signal
    { hex: "#e8ecee", r: 232, g: 236, b: 238 }, // fg/white
    { hex: "#4fd8eb", r: 79, g: 216, b: 235 },  // channel
    { hex: "#0a2540", r: 10, g: 37, b: 64 },    // deep blue (local literal)
  ];
  const cell = 2;
  const cols = Math.max(1, Math.ceil(w / cell));
  const rows = Math.max(1, Math.ceil(h / cell));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  const sd = hashSeed("ramp|" + seed);
  const rand = mulberry32(sd);
  const errR = new Float32Array(cols * rows);
  const errG = new Float32Array(cols * rows);
  const errB = new Float32Array(cols * rows);

  function sampleStop(t) {
    const segs = STOPS.length - 1;
    const x = Math.max(0, Math.min(1, t)) * segs;
    const i = Math.min(segs - 1, Math.floor(x));
    const f = x - i;
    const a = STOPS[i], b = STOPS[i + 1];
    return {
      r: a.r + (b.r - a.r) * f,
      g: a.g + (b.g - a.g) * f,
      b: a.b + (b.b - a.b) * f,
    };
  }

  for (let gy = 0; gy < rows; gy++) {
    const t = gy / Math.max(1, rows - 1);
    const want = sampleStop(t);
    for (let gx = 0; gx < cols; gx++) {
      const i = gy * cols + gx;
      const noise = (rand() - 0.5) * 8;
      let r = want.r + errR[i] + noise;
      let g = want.g + errG[i] + noise;
      let b = want.b + errB[i] + noise;
      // nearest stop (quantize to palette for dithered band feel)
      let best = 0, bestD = Infinity;
      for (let s = 0; s < STOPS.length; s++) {
        const dr = r - STOPS[s].r, dg = g - STOPS[s].g, db = b - STOPS[s].b;
        const d = dr * dr + dg * dg + db * db;
        if (d < bestD) { bestD = d; best = s; }
      }
      const q = STOPS[best];
      ctx.fillStyle = q.hex;
      ctx.fillRect(gx * cell, gy * cell, cell, cell);
      const eR = r - q.r, eG = g - q.g, eB = b - q.b;
      if (gx + 1 < cols) {
        errR[i + 1] += eR * 7 / 16;
        errG[i + 1] += eG * 7 / 16;
        errB[i + 1] += eB * 7 / 16;
      }
      if (gy + 1 < rows) {
        if (gx > 0) {
          errR[i + cols - 1] += eR * 3 / 16;
          errG[i + cols - 1] += eG * 3 / 16;
          errB[i + cols - 1] += eB * 3 / 16;
        }
        errR[i + cols] += eR * 5 / 16;
        errG[i + cols] += eG * 5 / 16;
        errB[i + cols] += eB * 5 / 16;
        if (gx + 1 < cols) {
          errR[i + cols + 1] += eR * 1 / 16;
          errG[i + cols + 1] += eG * 1 / 16;
          errB[i + cols + 1] += eB * 1 / 16;
        }
      }
    }
  }

  const url = `url("${canvas.toDataURL("image/png")}")`;
  cache.set(key, url);
  return url;
}

// Mission-patch tile: algo/cell/color derived from project id seed.
export function patchTex(seed) {
  const h = hashSeed("patch-" + seed);
  const algo = ["bayer", "noise", "fs"][h % 3];
  const cell = 2 + (h % 2);
  const colors = ["#ff2b1a", "#4fd8eb", "#33ff99", "#ffb000"];
  const fg = colors[h % colors.length];
  const density = 0.35 + ((h >>> 8) % 16) / 100; // ~0.35–0.50
  return tex({
    seed: "patch-" + seed,
    algo,
    w: 48,
    h: 48,
    cell,
    fg,
    density,
    alpha: 0.95,
  });
}

// Edge-fade for downrange board day columns (subtle, seeded by day iso).
export function boardFade(seed) {
  return edgeTex({
    seed: "board-" + seed,
    side: "bottom",
    depth: 16,
    fg: "#ff2b1a",
    from: 0.28,
    alpha: 0.85,
  });
}

// Small dense tile for one filled HANGAR gauge segment.
export function segTex(color) {
  return tex({
    seed: "seg-" + String(color),
    algo: "bayer",
    w: 12,
    h: 8,
    cell: 2,
    fg: color || "#ff2b1a",
    density: 0.72,
    alpha: 0.95,
  });
}

export const REDUCED_MOTION = typeof window !== "undefined"
  && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
