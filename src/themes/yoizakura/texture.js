// texture.js — Yoizakura's seeded dither engine. Same lineage as
// Nightwatch/Drydock: rendered ONCE per parameter set, cached as a data
// URL, never touched per frame. Recipes retuned for washi, sumi ink,
// dusk indigo, hanko vermillion, and tansu wood.

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
export function rngFrom(seed) { return mulberry32(hashSeed(String(seed))); }

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

export function cssColor(c, fallback = "#dfa14e") {
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

  const { seed = "werf", algo = "bayer", w = 96, h = 96, cell = 2, fg = "#dfa14e", bg = null, alpha = 1 } = opts;
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

// Faint cream-on-cream paper grain. Density is capped at 0.08 so body
// copy on washi stays ≥7:1.
export function washiGrain(seed = "washi") {
  return tex({
    seed: "washi-" + seed, algo: "noise", w: 128, h: 128, cell: 3,
    fg: "#c9b896", density: 0.08, alpha: 0.55,
  });
}

// Brush-wash sumi fade: Floyd–Steinberg creeping in from one edge.
// Depth 10–16 — heavier eats the text (same lesson as statementBg).
export function sumiEdge({ seed = "sumi", side = "bottom", depth = 14, fg = "#2a2433", from = 0.34 } = {}) {
  const d = Math.max(10, Math.min(16, depth));
  return edgeTex({ seed: "sumi-" + seed, algo: "fs", side, depth: d, fg, from, cell: 2 });
}

// Dusk plate under-fade — indigo pooling at a chrome foot.
export function duskFade(seed, fg = "#0c0917", from = 0.38, depth = 22) {
  return edgeTex({ seed: "dusk-" + seed, side: "bottom", depth, fg, from, algo: "noise", cell: 2 });
}

// Vermillion grain for hanko seals.
export function hankoTex(seed = "hanko") {
  return tex({
    seed: "hanko-" + seed, algo: "noise", w: 48, h: 48, cell: 2,
    fg: "#b03a32", density: 0.42, alpha: 0.9,
  });
}

// Horizontal tansu wood grain (label plates, drawer fronts).
export function woodGrain(seed = "wood") {
  return tex({
    seed: "wood-" + seed, algo: "fs", w: 160, h: 48, cell: 2,
    fg: "#5a4634", grad: { from: 0.42, to: 0.06, dir: "right" }, alpha: 0.55,
  });
}

// Shared dusk atmosphere: indigo sky, moon-glow, mist, stars, treeline.
// Generated once per seed/size, Map-cached, never per frame. Keep it
// faint — body copy and controls sit on top (legibility law).
export function duskSky(seed = "dusk", opts = {}) {
  const w = Math.max(64, opts.w || 400);
  const h = Math.max(64, opts.h || 720);
  const key = JSON.stringify({ recipe: "duskSky", seed, w, h });
  const hit = cache.get(key);
  if (hit) return hit;
  if (typeof document === "undefined") {
    cache.set(key, "none");
    return "none";
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const rand = rngFrom("duskSky|" + seed);

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#221a36");
  sky.addColorStop(0.46, "#171225");
  sky.addColorStop(1, "#120e1d");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const mx = w * 0.78, my = h * 0.14, mr = Math.max(w, h) * 0.38;
  const moon = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
  moon.addColorStop(0, "rgba(237,230,255,0.18)");
  moon.addColorStop(0.28, "rgba(210,200,235,0.08)");
  moon.addColorStop(0.62, "rgba(34,26,54,0.02)");
  moon.addColorStop(1, "rgba(34,26,54,0)");
  ctx.fillStyle = moon;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 3; i++) {
    const cy = h * (0.36 + i * 0.16 + (rand() - 0.5) * 0.03);
    const bh = h * (0.06 + rand() * 0.035);
    const mist = ctx.createLinearGradient(0, cy - bh, 0, cy + bh);
    const a = 0.04 + rand() * 0.022;
    mist.addColorStop(0, "rgba(186,176,214,0)");
    mist.addColorStop(0.5, `rgba(198,188,222,${a})`);
    mist.addColorStop(1, "rgba(186,176,214,0)");
    ctx.fillStyle = mist;
    ctx.fillRect(0, cy - bh, w, bh * 2);
  }

  const starCount = 58;
  for (let i = 0; i < starCount; i++) {
    const x = rand() * w;
    const y = rand() * h * 0.62;
    const bright = rand() > 0.78;
    const r = bright ? 1.15 : 0.5 + rand() * 0.4;
    ctx.fillStyle = `rgba(247,242,230,${0.32 + rand() * 0.42})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (bright) {
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x - 2.6, y - 0.35, 5.2, 0.7);
      ctx.fillRect(x - 0.35, y - 2.6, 0.7, 5.2);
      ctx.globalAlpha = 1;
    }
  }

  const base = h * 0.88;
  ctx.fillStyle = "rgba(8,6,16,0.52)";
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, base);
  const steps = 44;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    const ridge = Math.sin(i * 0.62 + 0.4) * 11 + Math.sin(i * 1.7) * 6;
    const spike = (i % 7 === 3) ? 10 + rand() * 12 : rand() * 5;
    ctx.lineTo(x, base - 10 - ridge - spike);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(6,4,14,0.32)";
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.945);
  for (let i = 0; i <= 30; i++) {
    const x = (i / 30) * w;
    ctx.lineTo(x, h * 0.945 - rand() * 8 - Math.sin(i * 0.9) * 5);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  const url = `url("${canvas.toDataURL("image/png")}")`;
  cache.set(key, url);
  return url;
}

export function installDuskSky() {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--dusk-sky", duskSky("atmosphere"));
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installDuskSky, { once: true });
  } else {
    installDuskSky();
  }
}

export function plateFade(seedString, fg = "#120e1d", from = 0.35, depth = 20) {
  return duskFade(seedString, fg, from, depth);
}

// Statement plate: sumi dither creeping from the top and bottom of a
// lantern-gold surface; the center stays clean for text.
export function statementBg(seedString, ink = "#2a2433", amber = "#dfa14e") {
  const topUrl = sumiEdge({ seed: seedString + ":t", side: "top", depth: 10, fg: ink, from: 0.32 });
  const botUrl = sumiEdge({ seed: seedString + ":b", side: "bottom", depth: 16, fg: ink, from: 0.36 });
  return {
    backgroundColor: amber,
    backgroundImage: `${topUrl}, ${botUrl}`,
    backgroundRepeat: "repeat-x, repeat-x",
    backgroundPosition: "top left, bottom left",
  };
}

export const REDUCED_MOTION = typeof window !== "undefined"
  && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
