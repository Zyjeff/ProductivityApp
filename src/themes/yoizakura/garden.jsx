// garden.jsx — signature visuals. Tree body is offscreen-cached and
// repaints only when its data key changes. Falling petals are the
// theme's ONE animated canvas (~9fps stepped cadence, hidden-tab pause,
// reduced-motion static scatter, synchronous first frame). Enso /
// lantern / shishi-odoshi paint on data/prop change — never rAF.
//
// Tree geometry is generated once from a fixed seed ("sakura-arbor-v3")
// so the silhouette is THE user's tree. Level+pct scale that destined
// shape (girth, height, spread) and reveal more generations — existing
// foliage is anchored to limb identity so it never teleports. Sky light
// is upper-right (moon / dusk); bark hashes, grass, and shadows are
// seeded — never Math.random.

import React, { useEffect, useId, useRef, useState } from "react";
import { rngFrom, REDUCED_MOTION } from "./texture.js";

const TW = 380;
const TH = 440;
const PAD_TOP = 62;
const PAD_SIDE = 38;
const PAD_BOT = 52;
const GEN_MAX = 6; // generations 0..6 = 7 levels of branching
const ARBOR_SEED = "sakura-arbor-v3";
const PETAL_STEP_MS = 110; // ~9fps

const SAKURA = "rgb(232,139,176)";
const SAKURA_HOT = "rgb(242,169,198)";
const SAKURA_DEEP = "rgb(176,90,128)";
const SUMI = "#2a2433";
// Moon / dusk sky sits upper-right; rim light on that edge, cast
// shadows fall down-left (opposite).
const LIGHT_X = 0.52;
const LIGHT_Y = -0.85;

function dpr() {
  return typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
}

function qAt(x0, y0, cx, cy, x1, y1, t) {
  const u = 1 - t;
  return {
    x: u * u * x0 + 2 * u * t * cx + t * t * x1,
    y: u * u * y0 + 2 * u * t * cy + t * t * y1,
  };
}

function qTan(x0, y0, cx, cy, x1, y1, t) {
  const u = 1 - t;
  return {
    x: 2 * u * (cx - x0) + 2 * t * (x1 - cx),
    y: 2 * u * (cy - y0) + 2 * t * (y1 - cy),
  };
}

function visT(reveal, depthNow) {
  return Math.max(0, Math.min(1, depthNow - reveal));
}

function stageOf(lvl, pct) {
  return Math.max(0, (lvl || 1) - 1) + Math.max(0, Math.min(100, pct || 0)) / 100;
}

function smooth01(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function geomOf(stage) {
  // Levels 1–11 → stage 0–10. Depth ticks generations in linearly;
  // size eases so L1 is a short sapling and L11 is the full arbor.
  // L1 (stage 0–1): depth ≈ 1.02–1.64  short trunk + 1–3 tiny limbs
  // L3 (stage 2–3): depth ≈ 2.22–2.81  first twigs, young tree
  // L7 (stage 6–7): depth ≈ 4.61–5.21  spreading crown
  // L11 (stage 10): depth = 7          full canopy
  const u = Math.max(0, Math.min(1, stage / 10));
  const s = smooth01(u);
  return {
    depthNow: 1.02 + u * 5.98,
    growK: 0.54 + 0.46 * Math.pow(u, 0.72),
    spreadK: 0.20 + 0.80 * s,
    girthK: 0.34 + 0.78 * (0.22 * u + 0.78 * s),
  };
}

function revealOf(gen, seq) {
  if (gen <= 0) return -1; // trunk is always fully drawn; height comes from growK
  if (gen === 1) return 0.62 + seq * 0.28;
  return gen + (1 - Math.exp(-seq * 0.1)) * 0.88;
}

/* ── arbor: full adult tree, fixed seed, built once ─────────── */

let ARBOR = null;

function pushLimb(limbs, rand, x0, y0, ang, len, w0, gen, side) {
  len = Math.max(5, len);
  let x1 = x0 + Math.cos(ang) * len;
  let y1 = y0 + Math.sin(ang) * len;
  if (y1 < PAD_TOP) {
    const t = (PAD_TOP - y0) / ((y1 - y0) || 1);
    if (t > 0.15 && t < 1) {
      len *= t;
      x1 = x0 + Math.cos(ang) * len;
      y1 = y0 + Math.sin(ang) * len;
    }
  }
  if (x1 < PAD_SIDE || x1 > TW - PAD_SIDE) {
    const edge = x1 < PAD_SIDE ? PAD_SIDE : TW - PAD_SIDE;
    const t = (edge - x0) / ((x1 - x0) || 1);
    if (t > 0.2 && t < 1) {
      len *= t;
      x1 = x0 + Math.cos(ang) * len;
      y1 = y0 + Math.sin(ang) * len;
    }
  }
  if (y1 > TH - PAD_BOT && gen > 0) {
    len *= 0.55;
    x1 = x0 + Math.cos(ang) * len;
    y1 = y0 + Math.sin(ang) * len;
  }
  const curl = side * (0.08 + rand() * 0.12) * (gen < 2 ? 0.45 : 0.85);
  const px = Math.cos(ang + Math.PI / 2);
  const py = Math.sin(ang + Math.PI / 2);
  const cx = (x0 + x1) / 2 + px * curl * len;
  const cy = (y0 + y1) / 2 + py * curl * len;
  const w1 = Math.max(0.95, w0 * (gen === 0 ? 0.82 : gen === 1 ? 0.7 : 0.58));
  const limb = { x0, y0, x1, y1, cx, cy, w0, w1, gen, ang, side, len, id: limbs.length };
  limbs.push(limb);
  return limb;
}

function growFrom(limbs, rand, limb, gen) {
  if (gen >= GEN_MAX) return;
  let n;
  if (gen === 1) n = 2 + (rand() < 0.7 ? 1 : 0);
  else if (gen === 2) n = 2 + (rand() < 0.45 ? 1 : 0);
  else if (gen === 3) n = rand() < 0.4 ? 3 : 2;
  else if (gen === 4) n = rand() < 0.72 ? 2 : 1;
  else n = rand() < 0.5 ? 2 : 1;

  for (let i = 0; i < n; i++) {
    const mid = n === 1 ? (rand() - 0.5) * 0.22 : (i - (n - 1) / 2);
    const spread = 0.28 + gen * 0.035;
    const da = mid * spread + (rand() - 0.5) * 0.18;
    const droop = (gen >= 4 ? 0.18 : 0.03) * limb.side;
    let ang = limb.ang + da + droop;
    const up = -Math.PI / 2;
    ang += (up - ang) * (gen < 3 ? 0.42 : 0.12);
    const len = limb.len * (0.76 + rand() * 0.12) * (i === 0 ? 1.08 : 0.86);
    const w = Math.max(0.95, limb.w1 * 0.62);
    const side = da >= 0 ? 1 : -1;
    const child = pushLimb(limbs, rand, limb.x1, limb.y1, ang, len, w, gen + 1, side);
    growFrom(limbs, rand, child, gen + 1);
  }
}

function decorateSlots(limbs) {
  const leafSlots = [];
  const blossomSlots = [];
  const budSlots = [];
  const outerIds = [];
  for (const limb of limbs) {
    if (limb.gen >= 1) {
      const br = rngFrom("bud-slot-" + limb.id);
      budSlots.push({ id: limb.id, t: 0.70 + br() * 0.22 });
      const bl = rngFrom("bl-slot-" + limb.id);
      blossomSlots.push({ id: limb.id, t: 0.78 + bl() * 0.18 });
      const keep = limb.gen <= 2 || rngFrom("leaf-keep-" + limb.id)() > 0.38;
      if (keep) {
        const extra = limb.gen >= 4 && rngFrom("leaf-n-" + limb.id)() > 0.58 ? 1 : 0;
        const n = 1 + extra;
        for (let k = 0; k < n; k++) {
          const t = (limb.gen === 1 ? 0.36 : 0.52) + rngFrom("leaf-t-" + limb.id + "-" + k)() * (limb.gen === 1 ? 0.38 : 0.42);
          leafSlots.push({ id: limb.id, k, t });
        }
      }
    }
    if (limb.gen >= 2) outerIds.push(limb.id);
  }
  const byReveal = (a, b) => limbs[a.id].reveal - limbs[b.id].reveal || a.id - b.id || (a.k || 0) - (b.k || 0);
  blossomSlots.sort(byReveal);
  budSlots.sort(byReveal);
  leafSlots.sort(byReveal);
  outerIds.sort((a, b) => limbs[b].crownScore - limbs[a].crownScore || a - b);
  return { leafSlots, blossomSlots, budSlots, outerIds };
}

function getArbor() {
  if (ARBOR && ARBOR.v === 4) return ARBOR;
  const rand = rngFrom(ARBOR_SEED);
  const limbs = [];
  const bx = 188 + (rand() - 0.5) * 6;
  const by = 408;
  let x = bx;
  let y = by;
  let a = -Math.PI / 2 + (rand() - 0.5) * 0.08;
  let w = 26;

  const segs = [
    { len: 42, da: -0.1 },
    { len: 40, da: 0.08 },
    { len: 36, da: -0.04 },
  ];
  const joints = [];
  for (const seg of segs) {
    a += seg.da + (rand() - 0.5) * 0.03;
    const limb = pushLimb(limbs, rand, x, y, a, seg.len + rand() * 5, w, 0, -1);
    joints.push(limb);
    x = limb.x1;
    y = limb.y1;
    w = limb.w1;
  }

  const primaries = [];
  const plant = (joint, angOff, len, wk, side) => {
    const ang = joint.ang + angOff;
    const limb = pushLimb(limbs, rand, joint.x1, joint.y1, ang, len, joint.w1 * wk, 1, side);
    growFrom(limbs, rand, limb, 1);
    primaries.push(limb);
    return limb;
  };

  // Trained sakura: short trunk, long rising crown, one low character limb.
  plant(joints[0], 1.08 + rand() * 0.12, 124 + rand() * 12, 0.68, 1);
  plant(joints[1], -0.78 - rand() * 0.12, 148 + rand() * 10, 0.8, -1);
  plant(joints[1], 0.82 + rand() * 0.12, 96 + rand() * 10, 0.52, 1);
  plant(joints[2], -0.2 - rand() * 0.08, 172 + rand() * 10, 0.78, -1);
  plant(joints[2], 0.26 + rand() * 0.08, 164 + rand() * 10, 0.74, 1);
  plant(joints[2], -0.58 - rand() * 0.08, 128 + rand() * 8, 0.56, -1);
  plant(joints[2], 0.64 + rand() * 0.08, 118 + rand() * 8, 0.54, 1);

  const genSeq = [];
  let crownX = 0;
  let crownY = 0;
  let crownN = 0;
  for (const limb of limbs) {
    const seq = genSeq[limb.gen] || 0;
    genSeq[limb.gen] = seq + 1;
    limb.reveal = revealOf(limb.gen, seq);
    limb.crownScore =
      (TH * 0.7 - limb.y1) * 1.2 + Math.abs(limb.x1 - TW / 2) * 0.72 + limb.gen * 10;
    if (limb.gen >= 3) {
      crownX += limb.x1;
      crownY += limb.y1;
      crownN++;
    }
  }
  if (!crownN) {
    for (const limb of limbs) {
      if (limb.gen < 1) continue;
      crownX += limb.x1;
      crownY += limb.y1;
      crownN++;
    }
  }
  const slots = decorateSlots(limbs);

  ARBOR = {
    limbs,
    baseX: bx,
    baseY: by,
    joints,
    primaries,
    pad: PAD_TOP,
    v: 4,
    crownX: crownX / (crownN || 1),
    crownY: crownY / (crownN || 1),
    ...slots,
  };
  return ARBOR;
}

/* ── painting helpers ───────────────────────────────────────── */

function fillTaper(ctx, limb, tEnd, widthK, fill) {
  if (tEnd <= 0.02) return;
  const { x0, y0, cx, cy, x1, y1, w0, w1 } = limb;
  ctx.strokeStyle = fill;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const segs = Math.max(6, Math.round(limb.len / 5));
  let prev = { x: x0, y: y0 };
  for (let i = 1; i <= segs; i++) {
    const t = (i / segs) * tEnd;
    const p = qAt(x0, y0, cx, cy, x1, y1, t);
    ctx.lineWidth = Math.max(1.4, (w0 + (w1 - w0) * t) * widthK);
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    prev = p;
  }

  const steps = Math.max(5, Math.round(limb.len / 6));
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * tEnd;
    const p = qAt(x0, y0, cx, cy, x1, y1, t);
    const d = qTan(x0, y0, cx, cy, x1, y1, t);
    const hyp = Math.hypot(d.x, d.y) || 1;
    const nx = -d.y / hyp;
    const ny = d.x / hyp;
    const hw = Math.max(0.7, (w0 + (w1 - w0) * t) * widthK * 0.5);
    if (i === 0) ctx.moveTo(p.x + nx * hw, p.y + ny * hw);
    else ctx.lineTo(p.x + nx * hw, p.y + ny * hw);
  }
  for (let i = steps; i >= 0; i--) {
    const t = (i / steps) * tEnd;
    const p = qAt(x0, y0, cx, cy, x1, y1, t);
    const d = qTan(x0, y0, cx, cy, x1, y1, t);
    const hyp = Math.hypot(d.x, d.y) || 1;
    const nx = -d.y / hyp;
    const ny = d.x / hyp;
    const hw = Math.max(0.7, (w0 + (w1 - w0) * t) * widthK * 0.5);
    ctx.lineTo(p.x - nx * hw, p.y - ny * hw);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function barkCore(gen) {
  const k = Math.min(1, gen / 6);
  const r = 58 + k * 16;
  const g = 44 + k * 12;
  const b = 38 + k * 8;
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function barkBody(gen) {
  const k = Math.min(1, gen / 6);
  const r = 92 + k * 18;
  const g = 70 + k * 14;
  const b = 54 + k * 10;
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function barkEdge(gen) {
  // ~40% lighter warm-brown than the sumi core, slightly more red/gold.
  const k = Math.min(1, gen / 6);
  const r = Math.min(255, (58 + k * 16) * 1.48 + 16);
  const g = Math.min(255, (44 + k * 12) * 1.42 + 18);
  const b = Math.min(255, (38 + k * 8) * 1.22 + 8);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function strokeLimbSide(ctx, limb, tEnd, girthK, towardLight, color, width) {
  const { x0, y0, cx, cy, x1, y1, w0, w1 } = limb;
  const segs = Math.max(8, Math.round(limb.len / 4));
  ctx.beginPath();
  for (let i = 0; i <= segs; i++) {
    const tt = (i / segs) * tEnd;
    const p = qAt(x0, y0, cx, cy, x1, y1, tt);
    const d = qTan(x0, y0, cx, cy, x1, y1, tt);
    const hyp = Math.hypot(d.x, d.y) || 1;
    let nx = -d.y / hyp;
    let ny = d.x / hyp;
    const facing = nx * LIGHT_X + ny * LIGHT_Y;
    if (towardLight ? facing < 0 : facing > 0) {
      nx = -nx;
      ny = -ny;
    }
    const hw = Math.max(0.55, (w0 + (w1 - w0) * tt) * girthK * 0.5);
    const x = p.x + nx * hw;
    const y = p.y + ny * hw;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function barkFill(gen) {
  return barkEdge(gen);
}

function barkShadow(gen) {
  return barkCore(gen);
}

function paintBarkHash(ctx, visible, girthK) {
  ctx.save();
  ctx.lineCap = "round";
  for (const { limb, t } of visible) {
    const thick = limb.w0 * girthK;
    if (limb.gen > 2) continue;
    if (limb.gen > 1 && thick < 7.5) continue;
    const rand = rngFrom("bark-hash-" + limb.id);
    const spacing = 8.5 + limb.gen * 3.2;
    const n = Math.max(0, Math.floor(limb.len / spacing));
    for (let i = 0; i < n; i++) {
      const keep = rand() > 0.55;
      const tt = 0.1 + ((i + 0.32) / (n + 0.45)) * 0.78;
      const side = rand() < 0.5 ? 1 : -1;
      const insetK = 0.08 + rand() * 0.45;
      const tick = 1.35 + rand() * 2.15;
      const alpha = 0.28 + rand() * 0.34;
      const lw = 0.65 + rand() * 0.5;
      if (!keep || tt > t - 0.05) continue;
      const p = qAt(limb.x0, limb.y0, limb.cx, limb.cy, limb.x1, limb.y1, tt);
      const d = qTan(limb.x0, limb.y0, limb.cx, limb.cy, limb.x1, limb.y1, tt);
      const hyp = Math.hypot(d.x, d.y) || 1;
      const nx = -d.y / hyp;
      const ny = d.x / hyp;
      const hw = Math.max(1.1, (limb.w0 + (limb.w1 - limb.w0) * tt) * girthK * 0.42);
      const inset = hw * insetK;
      ctx.strokeStyle = `rgba(32, 26, 38, ${alpha})`;
      ctx.lineWidth = lw;
      const ox = p.x + nx * side * inset;
      const oy = p.y + ny * side * inset;
      ctx.beginPath();
      ctx.moveTo(ox - nx * tick * 0.12, oy - ny * tick * 0.12);
      ctx.lineTo(ox + nx * side * tick, oy + ny * side * tick);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function paintRimLight(ctx, visible, girthK) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const { limb, t } of visible) {
    if (limb.gen > 2) continue;
    const { x0, y0, cx, cy, x1, y1, w0, w1 } = limb;
    const segs = Math.max(8, Math.round(limb.len / 4));
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const tt = (i / segs) * t;
      const p = qAt(x0, y0, cx, cy, x1, y1, tt);
      const d = qTan(x0, y0, cx, cy, x1, y1, tt);
      const hyp = Math.hypot(d.x, d.y) || 1;
      let nx = -d.y / hyp;
      let ny = d.x / hyp;
      if (nx * LIGHT_X + ny * LIGHT_Y < 0) {
        nx = -nx;
        ny = -ny;
      }
      const hw = Math.max(0.55, (w0 + (w1 - w0) * tt) * girthK * 0.5);
      pts.push({ x: p.x + nx * hw, y: p.y + ny * hw });
    }
    if (pts.length < 2) continue;
    const a = Math.max(0.1, 0.36 - limb.gen * 0.07);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = `rgba(242, 169, 198, ${a})`;
    ctx.lineWidth = Math.max(0.75, 2.15 - limb.gen * 0.42);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = `rgba(237, 230, 255, ${a * 0.62})`;
    ctx.lineWidth = Math.max(0.4, 1.1 - limb.gen * 0.22);
    ctx.stroke();
  }
  ctx.restore();
}

function paintTrunkShadow(ctx, arbor, growK, girthK) {
  const bx = arbor.baseX - 4 - 8 * growK;
  const by = arbor.baseY + 9;
  const rx = 10 + 24 * girthK * growK;
  const ry = 5.5 + 2.8 * growK;
  const g = ctx.createRadialGradient(bx, by, 1.2, bx, by, rx);
  g.addColorStop(0, "rgba(8, 6, 16, 0.7)");
  g.addColorStop(0.42, "rgba(8, 6, 16, 0.36)");
  g.addColorStop(1, "rgba(8, 6, 16, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(bx, by, rx, ry, -0.32, 0, Math.PI * 2);
  ctx.fill();
}

function moundPath(ctx, mx, my) {
  ctx.beginPath();
  ctx.moveTo(mx - 168, my + 12);
  ctx.quadraticCurveTo(mx - 120, my - 18, mx - 52, my - 26);
  ctx.quadraticCurveTo(mx, my - 36, mx + 48, my - 24);
  ctx.quadraticCurveTo(mx + 122, my - 14, mx + 170, my + 12);
  ctx.quadraticCurveTo(mx, my + 22, mx - 168, my + 12);
  ctx.closePath();
}

function mapPt(x, y, baseX, baseY, spreadK, growK) {
  return {
    x: baseX + (x - baseX) * spreadK,
    y: baseY - (baseY - y) * growK,
  };
}

function mapLimb(limb, baseX, baseY, spreadK, growK) {
  const a = mapPt(limb.x0, limb.y0, baseX, baseY, spreadK, growK);
  const b = mapPt(limb.x1, limb.y1, baseX, baseY, spreadK, growK);
  const c = mapPt(limb.cx, limb.cy, baseX, baseY, spreadK, growK);
  return {
    ...limb,
    x0: a.x, y0: a.y,
    x1: b.x, y1: b.y,
    cx: c.x, cy: c.y,
  };
}

function limbTip(limb, t) {
  return qAt(limb.x0, limb.y0, limb.cx, limb.cy, limb.x1, limb.y1, t);
}

function paintSakura(ctx, x, y, s, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((i / 5) * Math.PI * 2);
    const grd = ctx.createRadialGradient(0, -s * 0.6, s * 0.15, 0, -s * 1.1, s * 1.8);
    grd.addColorStop(0, "rgba(255, 244, 248, 0.98)");
    grd.addColorStop(0.35, "rgba(242, 169, 198, 0.96)");
    grd.addColorStop(0.78, "rgba(232, 139, 176, 0.9)");
    grd.addColorStop(1, "rgba(176, 90, 128, 0.2)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.12);
    ctx.bezierCurveTo(s * 0.95, -s * 0.15, s * 0.55, -s * 1.45, 0.15 * s, -s * 1.55);
    ctx.lineTo(0, -s * 1.28);
    ctx.lineTo(-0.15 * s, -s * 1.55);
    ctx.bezierCurveTo(-s * 0.55, -s * 1.45, -s * 0.95, -s * 0.15, 0, s * 0.12);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = "rgba(255, 252, 246, 0.98)";
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(240, 188, 116, 0.88)";
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintCluster(ctx, x, y, ang, idx) {
  const r = rngFrom("blossom-cluster-" + idx);
  const n = 2 + (r() > 0.42 ? 1 : 0);
  ctx.save();
  ctx.fillStyle = "rgba(22, 16, 40, 0.28)";
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  for (let i = 0; i < n; i++) {
    const da = (i - (n - 1) / 2) * 0.62 + (r() - 0.5) * 0.35;
    const dist = 4 + r() * 8;
    const s = 8.8 + r() * 2.6;
    paintSakura(
      ctx,
      x + Math.cos(ang + da) * dist,
      y + Math.sin(ang + da) * dist,
      s,
      r() * Math.PI * 2
    );
  }
}

function bloomRadius(x, y, desired) {
  const maxR = Math.min(x - 10, TW - 10 - x, y - 10, TH * 0.6 - y);
  return Math.max(0, Math.min(desired, maxR));
}

function paintBloomMass(ctx, x, y, r, a, seed) {
  if (r < 6) return;
  const g = ctx.createRadialGradient(x, y, r * 0.14, x, y, r);
  g.addColorStop(0, `rgba(250, 224, 228,${a * 0.34})`);
  g.addColorStop(0.4, `rgba(236, 186, 196,${a * 0.2})`);
  g.addColorStop(0.72, `rgba(196, 148, 164,${a * 0.08})`);
  g.addColorStop(1, "rgba(28, 22, 42, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.05, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  const pr = rngFrom(seed || "mass-petals-fallback");
  const n = 3 + (pr() > 0.45 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const px = x + (pr() - 0.5) * r * 0.62;
    const py = y + (pr() - 0.5) * r * 0.48;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(pr() * Math.PI);
    ctx.globalAlpha = a * 0.42;
    ctx.fillStyle = "rgba(255, 236, 240, 0.78)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.1 + pr() * 1.1, 3.2 + pr() * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function paintTwiglets(ctx, visible, growK) {
  const hosts = visible.filter(({ limb, t }) => limb.gen >= 1 && limb.gen <= 4 && t > 0.48);
  if (!hosts.length) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const { limb, t } of hosts) {
    const r = rngFrom("twiglet-" + limb.id);
    if (r() > 0.58) continue;
    const t0 = 0.50 + r() * 0.40;
    if (t < t0) continue;
    const p = limbTip(limb, t0);
    const fork = (r() < 0.5 ? 1 : -1) * (0.42 + r() * 0.78);
    const ang = limb.ang + fork;
    const len = (7 + r() * 16) * (0.5 + 0.5 * growK);
    let x1 = p.x + Math.cos(ang) * len;
    let y1 = p.y + Math.sin(ang) * len;
    x1 = Math.max(PAD_SIDE, Math.min(TW - PAD_SIDE, x1));
    y1 = Math.max(PAD_TOP, Math.min(TH - PAD_BOT, y1));
    ctx.strokeStyle = barkFill(Math.min(6, limb.gen + 1));
    ctx.lineWidth = Math.max(0.85, 1.55 - limb.gen * 0.16);
    ctx.globalAlpha = 0.82;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(
      (p.x + x1) / 2 + (r() - 0.5) * 7,
      (p.y + y1) / 2 + (r() - 0.5) * 6,
      x1,
      y1
    );
    ctx.stroke();
  }
  ctx.restore();
}

function paintPetalShape(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  const w = p.w;
  const h = p.h;
  ctx.moveTo(0, -h);
  ctx.bezierCurveTo(w, -h * 0.32, w * 0.82, h * 0.42, 0, h);
  ctx.bezierCurveTo(-w * 0.82, h * 0.42, -w, -h * 0.32, 0, -h);
  ctx.fill();
  ctx.globalAlpha = p.alpha * 0.4;
  ctx.fillStyle = "rgba(255, 244, 248, 0.85)";
  ctx.beginPath();
  ctx.ellipse(-w * 0.12, -h * 0.22, w * 0.22, h * 0.28, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintMound(ctx, stage, rand) {
  const mx = TW / 2;
  const my = TH - 18;

  moundPath(ctx, mx, my);
  const earth = ctx.createLinearGradient(mx - 50, my - 38, mx + 90, my + 16);
  earth.addColorStop(0, "rgba(38, 52, 34, 0.94)");
  earth.addColorStop(0.32, "rgba(66, 92, 50, 0.92)");
  earth.addColorStop(0.58, "rgba(48, 68, 42, 0.88)");
  earth.addColorStop(1, "rgba(22, 20, 28, 0.38)");
  ctx.fillStyle = earth;
  ctx.fill();

  const moss = ctx.createRadialGradient(mx + 30, my - 26, 5, mx + 6, my - 6, 124);
  moss.addColorStop(0, "rgba(132, 172, 94, 0.56)");
  moss.addColorStop(0.42, "rgba(76, 110, 58, 0.32)");
  moss.addColorStop(1, "rgba(30, 40, 32, 0)");
  ctx.fillStyle = moss;
  ctx.beginPath();
  ctx.ellipse(mx + 8, my - 12, 114 + stage * 3, 17, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  moundPath(ctx, mx, my);
  ctx.clip();
  ctx.lineCap = "round";
  for (let i = 0; i < 72; i++) {
    const x = mx + (rand() - 0.5) * 300;
    const y = my - 2 + (rand() - 0.5) * 26;
    const h = 3.6 + rand() * 8.2;
    const lean = (rand() - 0.32) * 0.55;
    const lit = x > mx - 12;
    const r = (lit ? 58 : 42) + rand() * 48;
    const gch = (lit ? 118 : 86) + rand() * 58;
    const b = 40 + rand() * 28;
    ctx.strokeStyle = `rgba(${r | 0},${gch | 0},${b | 0},${0.34 + rand() * 0.5})`;
    ctx.lineWidth = 0.7 + rand() * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * h * 0.4, y - h * 0.45, x + lean * h, y - h);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = "rgba(58, 78, 48, 0.82)";
  ctx.beginPath();
  ctx.ellipse(82, my + 4, 32, 9, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(92, 88, 104, 0.55)";
  ctx.beginPath();
  ctx.ellipse(mx - 92, my + 2, 11, 5.5, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(78, 74, 90, 0.65)";
  ctx.beginPath();
  ctx.ellipse(mx + 98, my + 4, 9, 5, 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function paintTreeBody(ctx, data) {
  const { lvl, pct, blossoms, buds, groundPetals, streak } = data;
  const stage = stageOf(lvl, pct);
  const { depthNow, growK, spreadK, girthK } = geomOf(stage);
  const bloomMul = streak <= 0 ? 0.12 : Math.min(1, 0.28 + streak / 7);
  const arbor = getArbor();
  const moundRand = rngFrom("mound-v1");

  ctx.clearRect(0, 0, TW, TH);

  const wash = ctx.createLinearGradient(0, 0, 0, TH);
  wash.addColorStop(0, "rgba(42, 30, 72, 0.0)");
  wash.addColorStop(0.55, "rgba(22, 16, 40, 0.12)");
  wash.addColorStop(1, "rgba(12, 9, 23, 0.28)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, TW, TH);
  ctx.save();
  ctx.beginPath();
  ctx.rect(8, 8, TW - 16, TH - 16);
  ctx.clip();

  paintMound(ctx, stage, moundRand);
  paintTrunkShadow(ctx, arbor, growK, girthK);

  const visible = [];
  const visById = new Map();
  for (const raw of arbor.limbs) {
    const t = visT(raw.reveal, depthNow);
    if (t <= 0.02) continue;
    const mapped = mapLimb(raw, arbor.baseX, arbor.baseY, spreadK, growK);
    const item = { limb: mapped, t };
    visible.push(item);
    visById.set(raw.id, item);
  }

  // Destined crown, scaled with the tree — centroid does not jump as
  // new tips appear. Skip the wash on a sapling (no canopy yet).
  if (depthNow > 2.15) {
    const c = mapPt(arbor.crownX, arbor.crownY, arbor.baseX, arbor.baseY, spreadK, growK);
    const cx = c.x;
    const cy = c.y;
    const folR = bloomRadius(cx, cy, (42 + stage * 3.2) * growK);
    if (folR > 8) {
      const foliage = ctx.createRadialGradient(cx, cy, 8, cx, cy, folR);
      foliage.addColorStop(0, `rgba(58, 72, 52,${0.16 + (1 - bloomMul) * 0.14})`);
      foliage.addColorStop(1, "rgba(58, 72, 52, 0)");
      ctx.fillStyle = foliage;
      ctx.beginPath();
      ctx.ellipse(cx, cy, folR * 1.15, folR * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Limb shadows fall down-left (opposite the upper-right sky). Each
  // limb is then a mid bark body plus two edge strokes: dark sumi core
  // on the shadow side, ~40% lighter warm-brown on the lit side.
  visible.sort((a, b) => a.limb.gen - b.limb.gen);
  ctx.save();
  ctx.translate(-1.1 * growK - 0.4, 1.2 * growK + 0.5);
  for (const { limb, t } of visible) {
    fillTaper(ctx, limb, t, girthK, "rgba(12, 9, 23, 0.34)");
  }
  ctx.restore();

  for (const { limb, t } of visible) {
    fillTaper(ctx, limb, t, girthK, barkBody(limb.gen));
  }
  ctx.save();
  ctx.globalAlpha = 0.92;
  for (const { limb, t } of visible) {
    const wCore = Math.max(1.15, (2.15 - limb.gen * 0.28) * girthK);
    strokeLimbSide(ctx, limb, t, girthK, false, barkCore(limb.gen), wCore);
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.88;
  for (const { limb, t } of visible) {
    const wEdge = Math.max(1.05, (2.05 - limb.gen * 0.3) * girthK);
    strokeLimbSide(ctx, limb, t, girthK, true, barkEdge(limb.gen), wEdge);
  }
  ctx.restore();

  paintBarkHash(ctx, visible, girthK);
  paintRimLight(ctx, visible, girthK);

  // Root flare into the mound
  const flareW = 6 + 22 * girthK;
  const flare = ctx.createLinearGradient(arbor.baseX, arbor.baseY - 14 * growK, arbor.baseX, arbor.baseY + 10);
  flare.addColorStop(0, barkShadow(0));
  flare.addColorStop(1, "rgba(48, 40, 36, 0)");
  ctx.fillStyle = flare;
  ctx.beginPath();
  ctx.moveTo(arbor.baseX - 5, arbor.baseY - 14 * growK);
  ctx.quadraticCurveTo(arbor.baseX - flareW * 0.45, arbor.baseY + 4, arbor.baseX - flareW, arbor.baseY + 12);
  ctx.lineTo(arbor.baseX + flareW, arbor.baseY + 12);
  ctx.quadraticCurveTo(arbor.baseX + flareW * 0.45, arbor.baseY + 4, arbor.baseX + 5, arbor.baseY - 14 * growK);
  ctx.closePath();
  ctx.fill();

  paintTwiglets(ctx, visible, growK);

  const leafScale = 0.55 + 0.45 * growK;
  for (const slot of arbor.leafSlots) {
    const item = visById.get(slot.id);
    if (!item || item.t < slot.t) continue;
    const p = limbTip(item.limb, slot.t);
    const lr = rngFrom("leaf-" + slot.id + "-" + slot.k);
    ctx.save();
    ctx.translate(p.x + (lr() - 0.5) * 6 * leafScale, p.y + (lr() - 0.5) * 4 * leafScale);
    ctx.rotate(item.limb.ang + (lr() - 0.5) * 0.8);
    ctx.fillStyle = `rgba(143, 181, 115,${0.34 + lr() * 0.36})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, (2.6 + lr() * 1.8) * leafScale, (1.2 + lr() * 0.7) * leafScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Soft blossom masses sit ON the destined outer tips. Index i is always
  // the same limb; undrawn until that limb has grown far enough — never
  // backfilled onto a different branch.
  if (bloomMul > 0.15) {
    const nMass = Math.round(3 + bloomMul * 4);
    for (let i = 0; i < nMass && i < arbor.outerIds.length; i++) {
      const id = arbor.outerIds[i];
      const item = visById.get(id);
      if (!item || item.t < 0.92) continue;
      const p = limbTip(item.limb, 1);
      const blob = rngFrom("canopy-blobs-" + id);
      const veil = rngFrom("canopy-veil-" + id);
      const desired = (16 + blob() * 8 + bloomMul * 5) * (0.55 + 0.45 * growK);
      const rr = bloomRadius(p.x, p.y, desired);
      paintBloomMass(ctx, p.x, p.y, rr, 0.7 + bloomMul * 0.22, "mass-petals-" + id);
      const rr2 = bloomRadius(p.x + 6, p.y + 4, (10 + veil() * 6) * growK);
      paintBloomMass(
        ctx,
        p.x + (blob() - 0.5) * 8,
        p.y + (blob() - 0.5) * 6,
        rr2,
        0.45,
        "mass-petals-b-" + id
      );
    }
  }

  const budN = Math.max(0, buds | 0);
  for (let i = 0; i < budN; i++) {
    const slots = arbor.budSlots;
    if (!slots.length) break;
    const slot = slots[i % slots.length];
    const item = visById.get(slot.id);
    if (!item || item.t < slot.t) continue;
    const p = limbTip(item.limb, slot.t);
    const br = rngFrom("bud-" + i);
    const x = p.x + (br() - 0.5) * 7;
    const y = p.y + (br() - 0.5) * 5;
    ctx.fillStyle = `rgba(176, 90, 128,${0.72 + br() * 0.22})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 1.7 + br() * 0.7, 2.4 + br() * 0.8, item.limb.ang * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(143, 181, 115, 0.55)";
    ctx.beginPath();
    ctx.ellipse(x - 2.4, y + 1.2, 1.5, 0.7, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const bCount = Math.max(0, blossoms | 0);
  for (let i = 0; i < bCount; i++) {
    const slots = arbor.blossomSlots;
    if (!slots.length) break;
    const slot = slots[i % slots.length];
    const item = visById.get(slot.id);
    if (!item || item.t < slot.t) continue;
    const p = limbTip(item.limb, slot.t);
    const jx = (rngFrom("b-jit-" + i)() - 0.5) * 5;
    paintCluster(ctx, p.x + jx, p.y, item.limb.ang, i);
  }

  const groundRand = rngFrom("ground-petals-v1");
  const gp = Math.max(0, groundPetals | 0);
  for (let i = 0; i < gp; i++) {
    const x = TW * 0.14 + groundRand() * TW * 0.72;
    const y = TH - 42 + groundRand() * 22;
    const s = 2.6 + groundRand() * 2.1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(groundRand() * Math.PI);
    ctx.globalAlpha = 0.32 + groundRand() * 0.5;
    ctx.fillStyle = groundRand() > 0.18 ? SAKURA : SAKURA_HOT;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.85, -s * 0.3, s * 0.7, s * 0.45, 0, s);
    ctx.bezierCurveTo(-s * 0.7, s * 0.45, -s * 0.85, -s * 0.3, 0, -s);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function paintPetals(ctx, particles) {
  ctx.clearRect(0, 0, TW, TH);
  for (const p of particles) paintPetalShape(ctx, p);
}

function makeParticles(n, streak) {
  const rand = rngFrom("fall-v2-" + (streak || 0));
  const colors = [
    "rgba(232,139,176,0.9)",
    "rgba(242,169,198,0.88)",
    "rgba(224,150,178,0.82)",
    "rgba(223,161,78,0.42)",
  ];
  return Array.from({ length: n }, (_, i) => ({
    x: 22 + rand() * (TW - 44),
    y: rand() * TH,
    rot: rand() * Math.PI * 2,
    vr: (rand() - 0.5) * 0.05,
    vy: 0.38 + rand() * 0.85,
    vx: (rand() - 0.5) * 0.42,
    w: 4.6 + rand() * 2.8,
    h: 7.2 + rand() * 2.6,
    color: colors[i % colors.length],
    phase: rand() * Math.PI * 2,
    freq: 0.018 + rand() * 0.022,
    sway: 0.28 + rand() * 0.55,
    baseAlpha: 0.55 + rand() * 0.4,
    alpha: 1,
  }));
}

function fadeNearGround(p) {
  const start = TH - 78;
  const end = TH - 22;
  if (p.y < start) return p.baseAlpha;
  const t = Math.max(0, Math.min(1, (p.y - start) / (end - start)));
  return p.baseAlpha * (1 - t * 0.92);
}

export function Tree({
  level = 1,
  pct = 0,
  blossoms = 0,
  buds = 0,
  groundPetals = 0,
  streak = 0,
}) {
  const bodyRef = useRef(null);
  const petalRef = useRef(null);
  const cacheRef = useRef(null);
  const dataKey = JSON.stringify({ level, pct, blossoms, buds, groundPetals, streak });

  useEffect(() => {
    const canvas = bodyRef.current;
    if (!canvas) return;
    const px = dpr();
    canvas.width = TW * px;
    canvas.height = TH * px;
    if (!cacheRef.current) cacheRef.current = document.createElement("canvas");
    const off = cacheRef.current;
    off.width = TW * px;
    off.height = TH * px;
    const octx = off.getContext("2d");
    octx.setTransform(px, 0, 0, px, 0, 0);
    paintTreeBody(octx, {
      lvl: level, pct, blossoms, buds, groundPetals, streak,
    });
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off, 0, 0);
  }, [dataKey, level, pct, blossoms, buds, groundPetals, streak]);

  useEffect(() => {
    const canvas = petalRef.current;
    if (!canvas) return;
    const px = dpr();
    canvas.width = TW * px;
    canvas.height = TH * px;
    const ctx = canvas.getContext("2d");
    const blit = (parts) => {
      ctx.setTransform(px, 0, 0, px, 0, 0);
      paintPetals(ctx, parts);
    };

    const staticN = Math.min(14, 3 + (streak || 0));
    const scatter = makeParticles(staticN, (streak || 0) + 99).map((p) => {
      const rest = rngFrom("rest-" + p.x.toFixed(1))();
      return { ...p, y: 48 + rest * (TH - 110), alpha: p.baseAlpha * 0.7 };
    });

    if (REDUCED_MOTION || !streak) {
      blit(streak ? scatter : []);
      return undefined;
    }

    // Density from streak — calm, not a blizzard.
    const particles = makeParticles(5 + Math.min(9, Math.round(streak * 0.85)), streak);
    for (const p of particles) p.alpha = fadeNearGround(p);
    let alive = true;
    let raf = null;
    let last = 0;
    const frame = () => {
      for (const p of particles) {
        p.y += p.vy;
        p.x += p.vx + Math.sin(p.y * p.freq + p.phase) * p.sway;
        p.rot += p.vr;
        if (p.x < 8) p.x = 8;
        if (p.x > TW - 8) p.x = TW - 8;
        if (p.y > TH - 16) {
          p.y = -12;
          p.x = 24 + ((p.x * 1.37) % (TW - 48));
        }
        p.alpha = fadeNearGround(p);
      }
      blit(particles);
    };
    frame(); // synchronous first frame
    const loop = (t) => {
      if (!alive) return;
      if (!document.hidden && t - last > PETAL_STEP_MS) {
        frame();
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [streak]);

  return (
    <div className="yz-tree-wrap" aria-hidden>
      <canvas ref={bodyRef} className="yz-tree-body" />
      <canvas ref={petalRef} className="yz-tree-petals" />
    </div>
  );
}

/* ── lantern: stone tōrō, glow from today's progress ────────── */

export function Lantern({ glow = 0, full = false }) {
  const g = full ? 1 : Math.max(0, Math.min(1, glow));
  const uid = useId().replace(/:/g, "");
  const fire = uid + "-fire";
  const halo = uid + "-halo";
  const pool = uid + "-pool";
  const stone = uid + "-stone";
  const roof = uid + "-roof";
  const bloom = full ? 1 : 0;
  return (
    <div
      className={"yz-lantern" + (full ? " yz-lantern--bloom" : "")}
      style={{
        "--glow": g,
        background: "none",
        borderRadius: 0,
        width: 66,
        height: 104,
        overflow: "visible",
        boxShadow: "none",
        transform: "none",
        transformOrigin: "50% 100%",
        filter: full
          ? `drop-shadow(0 0 16px rgba(223,161,78,${0.38 + g * 0.32})) drop-shadow(0 8px 6px rgba(12,9,23,0.5))`
          : `drop-shadow(0 0 ${6 + g * 14}px rgba(223,161,78,${0.1 + g * 0.4})) drop-shadow(0 7px 5px rgba(12,9,23,0.48))`,
      }}
      title={full ? "The garden is tended." : `Lantern ${Math.round(g * 100)}%`}
      aria-hidden
    >
      <svg width="66" height="104" viewBox="0 0 72 112" fill="none" overflow="visible" aria-hidden>
        <defs>
          <radialGradient id={fire} cx="48%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#fff8e0" stopOpacity={0.5 + g * 0.5} />
            <stop offset="38%" stopColor="#f0bc74" stopOpacity={0.38 + g * 0.58} />
            <stop offset="78%" stopColor="#dfa14e" stopOpacity={0.22 + g * 0.4} />
            <stop offset="100%" stopColor="#a06c25" stopOpacity={0.08 + g * 0.22} />
          </radialGradient>
          <radialGradient id={halo} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff6d8" stopOpacity={0.38 + g * 0.48} />
            <stop offset="42%" stopColor="#f0bc74" stopOpacity={0.22 + g * 0.38} />
            <stop offset="100%" stopColor="#dfa14e" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={pool} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f0bc74" stopOpacity={0.38 + g * 0.52} />
            <stop offset="55%" stopColor="#dfa14e" stopOpacity={0.16 + g * 0.32} />
            <stop offset="100%" stopColor="#dfa14e" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={stone} x1="0.15" y1="0" x2="0.92" y2="1">
            <stop offset="0%" stopColor="#8e889c" />
            <stop offset="48%" stopColor="#6a6478" />
            <stop offset="100%" stopColor="#3e384c" />
          </linearGradient>
          <linearGradient id={roof} x1="0.2" y1="0" x2="0.9" y2="1">
            <stop offset="0%" stopColor="#9a94a8" />
            <stop offset="45%" stopColor="#6e687c" />
            <stop offset="100%" stopColor="#4a4458" />
          </linearGradient>
        </defs>

        <ellipse
          cx="36" cy="46" rx={24 + g * 12 + bloom * 7} ry={21 + g * 9 + bloom * 6}
          fill={`url(#${halo})`}
        />
        {full && (
          <g opacity={0.42 + g * 0.18} stroke="#f0bc74" strokeLinecap="round">
            <line x1="36" y1="30" x2="36" y2="12" strokeWidth="1.05" opacity="0.7" />
            <line x1="36" y1="32" x2="24" y2="16" strokeWidth="0.85" opacity="0.5" />
            <line x1="36" y1="32" x2="48" y2="16" strokeWidth="0.85" opacity="0.55" />
            <line x1="24" y1="44" x2="8" y2="40" strokeWidth="0.75" opacity="0.4" />
            <line x1="48" y1="44" x2="64" y2="40" strokeWidth="0.75" opacity="0.45" />
            <line x1="24" y1="54" x2="10" y2="62" strokeWidth="0.7" opacity="0.32" />
            <line x1="48" y1="54" x2="62" y2="62" strokeWidth="0.7" opacity="0.36" />
          </g>
        )}

        <ellipse
          cx="36" cy="104.5"
          rx={18 + g * 16} ry={3.8 + g * 3}
          fill={`url(#${pool})`}
        />
        <ellipse cx="36" cy="101.6" rx="18" ry="3.3" fill="#0c0917" opacity="0.5" />
        <ellipse cx="36" cy="100.4" rx="13.5" ry="2.2" fill="#3a3448" opacity="0.62" />
        <path d="M18 98.5 L54 98.5 L50 102.2 L22 102.2 Z" fill="#4a4458" />
        <path d="M22 98.5 L32 98.5 L30 99.6 L24 99.6 Z" fill="#9a94a8" opacity="0.28" />

        <path d="M11 90 L61 90 L56 98.5 L16 98.5 Z" fill={`url(#${stone})`} />
        <path d="M46 90 L61 90 L56 98.5 L46 98.5 Z" fill="#2e283c" opacity="0.32" />
        <path d="M14 90.2 L26 90.2 L24 91.6 L16 91.6 Z" fill="#c4becc" opacity="0.22" />
        <path d="M17 84 L55 84 L51 90 L21 90 Z" fill="#7a7488" />
        <path d="M44 84 L55 84 L51 90 L44 90 Z" fill="#3e384c" opacity="0.38" />
        <path d="M19 84.2 L30 84.2 L29 85.4 L20 85.4 Z" fill="#b0aabc" opacity="0.28" />

        <path d="M31.4 59.5 L40.6 59.5 L38.7 84 L33.3 84 Z" fill="#6e687c" />
        <path d="M36.6 59.5 L40.6 59.5 L38.7 84 L36.1 84 Z" fill="#3e384c" opacity="0.38" />
        <path d="M31.7 59.5 L34.6 59.5 L34.2 84 L32.5 84 Z" fill="#a8a2b4" opacity="0.32" />
        <ellipse cx="36" cy="71.8" rx="7.4" ry="2.15" fill="#5c566a" />
        <ellipse cx="36" cy="71" rx="6.5" ry="1.45" fill="#8a8498" />
        <rect x="33.6" y="68.4" width="1.1" height="6.6" rx="0.4" fill="#2a2433" opacity="0.28" />
        <ellipse
          cx="36" cy="61.5" rx="9" ry="5"
          fill="#f0bc74" opacity={0.06 + g * 0.16}
        />

        <path d="M20.5 55.5 L51.5 55.5 L47.5 60.2 L24.5 60.2 Z" fill="#6a6478" />
        <path d="M42 55.5 L51.5 55.5 L47.5 60.2 L42 60.2 Z" fill="#3a3448" opacity="0.4" />

        {full && (
          <ellipse cx="36" cy="43" rx="18" ry="16" fill="#f0bc74" opacity="0.26" />
        )}
        <rect x="22.5" y="29.5" width="27" height="26.2" rx="1.5" fill="#3a3448" />
        <rect x="25" y="32" width="22" height="21.2" rx="0.9" fill={`url(#${fire})`} />
        <ellipse
          cx="36.4" cy="41.6" rx="7.6" ry="8.2"
          fill="#fff6d8" opacity={0.38 + g * 0.55}
        />
        <ellipse
          cx="34.6" cy="39.2" rx="2.6" ry="3"
          fill="#fffdf4" opacity={0.42 + g * 0.5}
        />
        <line x1="36" y1="32" x2="36" y2="53.2" stroke="#2a2433" strokeOpacity="0.5" strokeWidth="1.15" />
        <line x1="25" y1="42.6" x2="47" y2="42.6" stroke="#2a2433" strokeOpacity="0.38" strokeWidth="1" />
        <rect x="22.5" y="29.5" width="27" height="26.2" rx="1.5" fill="none" stroke="#7a7488" strokeWidth="1.35" />
        <path d="M22.5 29.5 L27 29.5 L26.2 31 L22.5 31 Z" fill="#c4becc" opacity="0.22" />

        <path d="M7 32.2 L65 32.2 L36 28.2 Z" fill="#3a3448" />
        <path
          d="M3.5 31.2 Q8 21.5 16.5 26.2 L36 13.2 L55.5 26.2 Q64 21.5 68.5 31.2 Q36 26.8 3.5 31.2 Z"
          fill={`url(#${roof})`}
        />
        <path
          d="M36 13.2 L55.5 26.2 Q64 21.5 68.5 31.2 Q50 27.2 36 25.4 Z"
          fill="#b0aabc" opacity="0.28"
        />
        <path d="M3.5 31.2 Q8 21.5 16.5 26.2" stroke="#8a8498" strokeWidth="1.15" strokeLinecap="round" />
        <path d="M68.5 31.2 Q64 21.5 55.5 26.2" stroke="#c4becc" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M3.2 31 Q5 19.5 14.5 23.5" stroke="#7a7488" strokeWidth="1.35" strokeLinecap="round" />
        <path d="M68.8 31 Q67 19.5 57.5 23.5" stroke="#b0aabc" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M36 13.2 L36 27" stroke="#4a4458" strokeWidth="0.55" opacity="0.45" />

        <rect x="34.5" y="9.4" width="3" height="5.6" rx="0.45" fill="#8a8498" />
        <ellipse cx="36" cy="7.6" rx="3.15" ry="4.35" fill="#c4a060" />
        <ellipse cx="36" cy="6.6" rx="2.15" ry="2.85" fill="#dfa14e" opacity={0.45 + g * 0.5} />
        <circle cx="36" cy="4.9" r="1.25" fill="#fff6d8" opacity={0.32 + g * 0.5} />
      </svg>
    </div>
  );
}

/* ── ensō: brush stroke whose gap closes as pct → 100% ──────── */

function paintEnso(ctx, size, pct) {
  const p = Math.max(0, Math.min(100, pct));
  const complete = p >= 100;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const n = Math.max(48, Math.round(size * 1.35));
  const rand = rngFrom("enso-sumi-v1-" + size);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = -Math.PI * 0.28 + t * Math.PI * 2;
    const wob = (rand() - 0.5) * (size * 0.028) * (0.35 + Math.sin(t * Math.PI));
    const rag = (rand() - 0.5) * (size * 0.012);
    pts.push({
      t,
      x: cx + Math.cos(a) * (r + wob + rag),
      y: cy + Math.sin(a) * (r + wob + rag),
      a,
    });
  }

  const drawnT = complete ? 1 : Math.max(0.035, p / 100);
  const last = Math.max(2, Math.round(drawnT * n));
  const slice = pts.slice(0, last + 1);
  const sc = size / 72;

  const widthAt = (t) => {
    const rise = Math.min(1, t / 0.1);
    const belly = 0.55 + 0.45 * Math.sin(Math.min(1, t) * Math.PI * 0.9);
    const tail = t > 0.7 ? Math.pow((1 - t) / 0.3, 1.25) : 1;
    return sc * (2.0 + 5.8 * rise * belly * Math.max(0.1, tail));
  };

  const ribbon = (offset, alpha, color) => {
    if (slice.length < 2) return;
    ctx.beginPath();
    const left = [];
    const right = [];
    for (let i = 0; i < slice.length; i++) {
      const a = slice[i];
      const b = slice[Math.min(i + 1, slice.length - 1)];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const hyp = Math.hypot(dx, dy) || 1;
      const nx = -dy / hyp;
      const ny = dx / hyp;
      const hw = widthAt(a.t) * 0.5;
      left.push(a.x + nx * hw + nx * offset, a.y + ny * hw + ny * offset);
      right.push(a.x - nx * hw + nx * offset, a.y - ny * hw + ny * offset);
    }
    ctx.moveTo(left[0], left[1]);
    for (let i = 2; i < left.length; i += 2) ctx.lineTo(left[i], left[i + 1]);
    for (let i = right.length - 2; i >= 0; i -= 2) ctx.lineTo(right[i], right[i + 1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  ribbon(0, 0.92, SUMI);
  ribbon(sc * 0.7, 0.28, SUMI);
  ribbon(-sc * 0.55, 0.18, "#1a1620");

  // Dry-brush raggedness along the outer edge
  ctx.fillStyle = SUMI;
  for (let i = 2; i < slice.length; i += 2) {
    const a = slice[i];
    const b = slice[Math.min(i + 1, slice.length - 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const hyp = Math.hypot(dx, dy) || 1;
    const nx = -dy / hyp;
    const ny = dx / hyp;
    const hw = widthAt(a.t) * 0.5;
    const len = (0.45 + rand() * 1.85) * sc;
    ctx.globalAlpha = 0.16 + rand() * 0.4;
    ctx.beginPath();
    ctx.ellipse(
      a.x + nx * (hw + rand() * 1.05),
      a.y + ny * (hw + rand() * 1.05),
      len,
      0.32 * sc,
      a.a,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  for (let i = 4; i < slice.length; i += 5) {
    const a = slice[i];
    const b = slice[Math.min(i + 1, slice.length - 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const hyp = Math.hypot(dx, dy) || 1;
    const nx = -dy / hyp;
    const ny = dx / hyp;
    const hw = widthAt(a.t) * 0.5;
    ctx.globalAlpha = 0.1 + rand() * 0.22;
    ctx.beginPath();
    ctx.ellipse(
      a.x - nx * (hw * (0.55 + rand() * 0.3)),
      a.y - ny * (hw * (0.55 + rand() * 0.3)),
      (0.28 + rand() * 0.9) * sc,
      0.26 * sc,
      a.a,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (complete) {
    const join = pts[pts.length - 1];
    const head = pts[0];
    ctx.strokeStyle = SAKURA_DEEP;
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 1.4 * sc;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(join.x, join.y);
    ctx.quadraticCurveTo(
      (join.x + head.x) / 2 + 3 * sc,
      (join.y + head.y) / 2 - 4 * sc,
      head.x + 2 * sc,
      head.y - 1 * sc
    );
    ctx.stroke();
    ctx.globalAlpha = 1;
    paintSakura(ctx, head.x + 3.2 * sc, head.y - 2.4 * sc, 2.1 * sc, -0.4);
  }
}

export function Enso({ pct = 0, size = 72, title }) {
  const ref = useRef(null);
  const p = Math.max(0, Math.min(100, pct));
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const px = dpr();
    canvas.width = size * px;
    canvas.height = size * px;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(px, 0, 0, px, 0, 0);
    ctx.clearRect(0, 0, size, size);
    paintEnso(ctx, size, p);
  }, [p, size]);
  return <canvas ref={ref} className="yz-enso" width={size} height={size} title={title} />;
}

/* ── shishi-odoshi: bamboo arm + basin; CSS tip, no rAF ─────── */

export function ShishiOdoshi({ pct = 0, className = "" }) {
  const p = Math.max(0, Math.min(100, pct));
  const quarter = Math.floor(p / 25);
  const fill = p >= 100 ? 0 : ((p % 25) / 25) * 100;
  const [tip, setTip] = useState(false);
  const prevQ = useRef(quarter);
  useEffect(() => {
    if (REDUCED_MOTION) {
      prevQ.current = quarter;
      return undefined;
    }
    if (quarter > prevQ.current && quarter > 0) {
      setTip(true);
      const t = setTimeout(() => setTip(false), 640);
      prevQ.current = quarter;
      return () => clearTimeout(t);
    }
    prevQ.current = quarter;
    return undefined;
  }, [quarter]);

  return (
    <div
      className={"yz-shishi" + (tip ? " yz-shishi--tip" : "") + (className ? " " + className : "")}
      aria-hidden
      title={`${Math.round(p)}%`}
      style={{ overflow: "visible" }}
    >
      <svg
        viewBox="0 0 120 90"
        width="120"
        height="90"
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
        aria-hidden
      >
        <ellipse cx="62" cy="80" rx="34" ry="9" fill="#3a3648" opacity="0.85" />
        <ellipse cx="62" cy="76" rx="28" ry="8" fill="#4e4a5c" />
        <ellipse cx="62" cy="75" rx="22" ry="5.5" fill="#2a3850" />
        <ellipse cx="62" cy="74.2" rx="18" ry="4.2" fill="#63c3cf" opacity="0.55" />
        <rect x="28" y="20" width="9" height="54" rx="2" fill="#6f8f58" />
        <rect x="28.6" y="20" width="2.2" height="54" rx="1" fill="#8fb573" opacity="0.45" />
        {[32, 46, 60].map((yy) => (
          <rect key={yy} x="26.5" y={yy} width="12" height="3.2" rx="1" fill="#556f42" />
        ))}
        <rect x="26" y="28" width="14" height="8" rx="1.5" fill="#4a5e38" />
        <circle cx="33" cy="32" r="2.1" fill="#2a2433" />
      </svg>
      <div
        className="yz-shishi-arm"
        style={{
          background: "transparent",
          overflow: "hidden",
          height: 20,
          top: 20,
          borderRadius: 0,
        }}
      >
        <svg
          viewBox="0 0 78 20"
          width="78"
          height="20"
          style={{ position: "absolute", inset: 0 }}
          aria-hidden
        >
          <path d="M2 7 L64 5.5 L72 3 L76 10 L72 17 L64 14.5 L2 13 Z" fill="#7a9a5c" />
          <path d="M2 7 L64 5.5 L72 3 L72 8 L64 9 L2 10 Z" fill="#8fb573" opacity="0.55" />
          <rect x="18" y="5.2" width="4" height="9.4" rx="0.8" fill="#556f42" />
          <rect x="36" y="5" width="4" height="9.8" rx="0.8" fill="#556f42" />
          <rect x="54" y="4.6" width="4" height="10.4" rx="0.8" fill="#556f42" />
          <path d="M70 3 L78 9.5 L70 17 Z" fill="#6b8f5a" />
        </svg>
        <div
          className="yz-shishi-fill"
          style={{
            "--fill": fill + "%",
            left: "auto",
            right: 8,
            width: fill + "%",
            maxWidth: "70%",
            background: "linear-gradient(90deg, rgba(99,195,207,0.35), rgba(99,195,207,0.85))",
            opacity: 0.9,
          }}
        />
      </div>
      <div className="yz-shishi-basin" style={{ border: "none", background: "transparent" }} />
      <div className="yz-shishi-ripple" />
      <div className="yz-shishi-kon">kon</div>
    </div>
  );
}
