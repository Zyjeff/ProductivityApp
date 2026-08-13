// components.jsx — Kaze primitives. Dumb, presentational. The
// instrument language is charms, seals, blossoms and petals: no rings,
// arcs, rotary gauges, dither bars or level gauges anywhere.

import React, { useEffect, useMemo } from "react";
import { DIFFICULTY, PRIORITIES } from "../../core/domain.js";
import { tex, REDUCED_MOTION } from "./texture.js";

export { IS_MAC, MOD } from "../../core/keys.js";

export function Icon({ name, size = 14 }) {
  const common = { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "plus":     return <svg {...common}><path d="M8 3v10M3 8h10" /></svg>;
    case "chevron":  return <svg {...common}><path d="M4 6l4 4 4-4" /></svg>;
    case "chevronR": return <svg {...common}><path d="M6 4l4 4-4 4" /></svg>;
    case "chevronL": return <svg {...common}><path d="M10 4L6 8l4 4" /></svg>;
    case "close":    return <svg {...common}><path d="M4 4l8 8M12 4l-8 8" /></svg>;
    case "check":    return <svg {...common}><path d="M3 8.5L6.5 12L13 4.5" /></svg>;
    case "edit":     return <svg {...common}><path d="M11.5 2.5l2 2L6 12H4v-2L11.5 2.5z" /></svg>;
    case "reset":    return <svg {...common}><path d="M3 8a5 5 0 109-3" /><path d="M9 2L12 5L9 8" /></svg>;
    case "search":   return <svg {...common}><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg>;
    case "camera":   return <svg {...common}><rect x="2" y="4.5" width="12" height="9" rx="1.5" /><circle cx="8" cy="9" r="2.5" /><path d="M6 4.5L7 2.5h2l1 2" /></svg>;
    case "lock":     return <svg {...common}><rect x="3.5" y="7.5" width="9" height="6" rx="1" /><path d="M5.5 7.5V5a2.5 2.5 0 015 0v2.5" /></svg>;
    case "unlock":   return <svg {...common}><rect x="3.5" y="7.5" width="9" height="6" rx="1" /><path d="M5.5 7.5V5a2.5 2.5 0 014.95-.5" /></svg>;
    case "recur":    return <svg {...common}><path d="M3 6a4 4 0 016-3l1 1M13 10a4 4 0 01-6 3l-1-1M2 4v3h3M14 12V9h-3" /></svg>;
    // Kaze's own glyphs
    case "torii":    return <svg {...common}><path d="M2 4h12M3 6h10M4.5 4v9M11.5 4v9M2.5 3.2h11" /></svg>;
    case "path":     return <svg {...common}><path d="M8 14c0-3 4-3 4-6s-4-3-4-6" /><circle cx="8" cy="14" r="1" fill="currentColor" stroke="none" /></svg>;
    case "satchel":  return <svg {...common}><path d="M3 6h10l-1 8H4L3 6z" /><path d="M6 6V4.5a2 2 0 014 0V6" /></svg>;
    case "journal":  return <svg {...common}><path d="M4 3h8a1 1 0 011 1v9a1 1 0 01-1 1H4V3z" /><path d="M4 3a1 1 0 00-1 1v9a1 1 0 001 1" /><path d="M6.5 6.5h4M6.5 9h3" /></svg>;
    case "petal":    return <svg {...common}><path d="M8 2c2.5 2.5 4 4 4 6a4 4 0 11-8 0c0-2 1.5-3.5 4-6z" /></svg>;
    case "lantern":  return <svg {...common}><path d="M6 3h4M6 13h4M5 5.5c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5v5c0 1.4-1.3 2.5-3 2.5s-3-1.1-3-2.5v-5z" /></svg>;
    case "wind":     return <svg {...common}><path d="M2 5h7a2 2 0 10-2-2M2 8h9a2 2 0 11-2 2M2 11h6" /></svg>;
    case "fire":     return <svg {...common}><path d="M8 2c1 2-1 3 0 5 1 1 3 0 3 3a3 3 0 11-6 0c0-2 1-2 1-4S7 3 8 2z" /></svg>;
    case "spring":   return <svg {...common}><path d="M3 11c1.5-1 3.5-1 5 0s3.5 1 5 0" /><path d="M3 13.5c1.5-1 3.5-1 5 0s3.5 1 5 0" /><path d="M6 7c0-1.5 1.5-1.5 1.5-3M9.5 7.5C9.5 6 11 6 11 4.5" /></svg>;
    case "charm":    return <svg {...common}><rect x="4.5" y="4" width="7" height="10" rx="1" /><path d="M6.5 4V2.8a1.5 1.5 0 013 0V4" /></svg>;
    case "map":      return <svg {...common}><path d="M2 4l4-1.5 4 1.5 4-1.5v10L10 14l-4-1.5L2 14V4z" /><path d="M6 2.5v10M10 4v10" /></svg>;
    default: return null;
  }
}

/* ── seals & stamps ────────────────────────────────────────── */

const SEAL_TONE = { sakura: "var(--sakura)", port: "var(--port)", amber: "var(--amber-hot)", channel: "var(--channel)" };

export function Seal({ kind, tone, children, style, title }) {
  const c = tone || SEAL_TONE[kind];
  return (
    <span className="kz-seal" title={title} style={c ? { color: c, borderColor: c, ...style } : style}>{children}</span>
  );
}

// The chooser used everywhere a set of options must be picked.
export function SealPick({ active, color, onClick, children, title }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={"kz-seal kz-seal--pick" + (active ? " kz-seal--on" : "")}
      style={active && color ? { background: color, color: "var(--ink)", borderColor: "transparent" } : undefined}>
      {children}
    </button>
  );
}

export function Kbd({ children }) {
  return <span className="kz-kbd">{children}</span>;
}

export function PriorityDot({ p }) {
  const cfg = PRIORITIES[p] || PRIORITIES.medium;
  return <span title={cfg.label} style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0, display: "inline-block" }} />;
}

export function DifficultyPip({ d }) {
  const cfg = DIFFICULTY[d] || DIFFICULTY.medium;
  return <span title={cfg.label} style={{ width: 6, height: 6, borderRadius: 1, background: cfg.tone, flexShrink: 0, display: "inline-block" }} />;
}

/* ── the completion control: a blossom that opens ──────────── */

export function Bloom({ done, onComplete, onReopen, square = false, size = null, label }) {
  return (
    <button type="button"
      className={"kz-bloom" + (done ? " kz-bloom--on" : "") + (square ? " kz-bloom--sq" : "")}
      style={size ? { width: size, height: size } : undefined}
      onClick={(e) => { e.stopPropagation(); done ? onReopen && onReopen() : onComplete && onComplete(); }}
      title={done ? "Reopen" : "Complete"} aria-label={label || (done ? "Reopen" : "Complete")}>
      {done && (
        <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden>
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </svg>
      )}
    </button>
  );
}

export function Meter({ pct, tone = "var(--amber)", height = 5 }) {
  return (
    <div className="kz-meter" style={{ height }}>
      <div className="kz-meter-fill" style={{ width: Math.max(0, Math.min(100, pct)) + "%", backgroundColor: tone }} />
    </div>
  );
}

export function Eyebrow({ children, right, lit }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 11 }}>
      <div className="kz-label-row" style={{ flex: 1, minWidth: 0 }}>
        <span className={"kz-label" + (lit ? " kz-label--lit" : "")}>{children}</span>
      </div>
      {right}
    </div>
  );
}

export function Lamp({ status, detail }) {
  const cls = status === "ok" ? "kz-lamp--ok" : status === "busy" ? "kz-lamp--busy" : status === "off" ? "kz-lamp--off" : "kz-lamp--unknown";
  const label = status === "ok" ? "The oracle is listening"
    : status === "busy" ? "The oracle is thinking…"
    : status === "off" ? `Oracle silent${detail ? ` (${detail})` : ""} — the road still walks; scores stay honest and manual`
    : "Oracle unknown until first asked";
  return <span className={"kz-lamp " + cls} title={label} aria-label={label} />;
}

/* ── the Resolve charm — omamori, not a gauge ──────────────── */

export function Charm({ pct, glyph = "風", title, size = 1 }) {
  return (
    <span className="kz-charm" title={title} aria-label={title}
      style={size !== 1 ? { width: 26 * size, height: 34 * size } : undefined}>
      <span className="kz-charm-cord" aria-hidden />
      <span className="kz-charm-fill" style={{ height: Math.max(0, Math.min(100, pct)) + "%" }} />
      <span className="kz-charm-glyph" style={size !== 1 ? { fontSize: 13 * size } : undefined}>{glyph}</span>
    </span>
  );
}

/* ── empty states — haiku-shaped, three lines ──────────────── */

export function EmptyState({ children, haiku }) {
  return (
    <div className="kz-empty">
      {haiku && <div className="kz-haiku" style={{ marginBottom: 16 }}>{haiku}</div>}
      <div style={{ maxWidth: 440, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

// A soft ink-wash foot that closes a column.
export function InkFoot({ caption, height = 40 }) {
  const url = useMemo(
    () => tex({ seed: "kz-foot", algo: "sumi", w: 240, h: height, cell: 3, fg: "#5a4432", grad: { from: 0.4, to: 0.02, dir: "up" } }),
    [height]
  );
  return (
    <div aria-hidden>
      <div style={{ height, backgroundImage: url, backgroundRepeat: "repeat-x", backgroundPosition: "bottom left", opacity: .8 }} />
      {caption && <div className="kz-label" style={{ textAlign: "center", marginTop: 7, opacity: .65 }}>{caption}</div>}
    </div>
  );
}

/* ── petal burst — the theme's confetti ────────────────────── */

export function PetalBurst({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, REDUCED_MOTION ? 200 : 1900);
    return () => clearTimeout(t);
  }, [onDone]);
  const colors = ["#f0a3bd", "#ffc3d6", "#f5bd6a", "#e0993f", "#ffe1ec"];
  const petals = useMemo(() => Array.from({ length: 34 }, (_, i) => ({
    id: i,
    x: 38 + Math.random() * 24,
    rot: Math.random() * 360,
    color: colors[i % colors.length],
    delay: Math.random() * 0.3,
    dx: (Math.random() - 0.4) * 300,
    dy: -(40 + Math.random() * 150),
  })), []);
  if (REDUCED_MOTION) return null;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 10009 }} aria-hidden>
      {petals.map((p) => (
        <div key={p.id} className="kz-petal" style={{
          left: `${p.x}%`, top: "50%", background: p.color,
          animation: `kz-petal-fall 1.5s ${p.delay}s cubic-bezier(.25,.6,.35,1) forwards`,
          "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--rot": `${p.rot}deg`,
          opacity: 0,
        }} />
      ))}
      <style>{`@keyframes kz-petal-fall {
        0% { opacity: 0; transform: translate(0,0) rotate(0deg) scale(.6); }
        14% { opacity: 1; }
        100% { opacity: 0; transform: translate(var(--dx), calc(var(--dy) + 62vh)) rotate(var(--rot)) scale(1); }
      }`}</style>
    </div>
  );
}

// A single petal released from a completed row — the small celebration.
export function PetalRelease({ seed = 0 }) {
  const petals = useMemo(() => Array.from({ length: 5 }, (_, i) => ({
    id: i,
    dx: 14 + i * 13 + (seed % 7),
    dy: -(8 + ((seed + i * 5) % 22)),
    rot: ((seed * 37 + i * 61) % 360),
    delay: i * 0.05,
  })), [seed]);
  if (REDUCED_MOTION) return null;
  return (
    <span style={{ position: "absolute", left: 8, top: 14, pointerEvents: "none" }} aria-hidden>
      {petals.map((p) => (
        <span key={p.id} className="kz-petal" style={{
          position: "absolute", width: 6, height: 6, background: "var(--sakura)",
          animation: `kz-petal-drift 1.15s ${p.delay}s ease-out forwards`,
          "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--rot": `${p.rot}deg`,
          opacity: 0,
        }} />
      ))}
      <style>{`@keyframes kz-petal-drift {
        0% { opacity: 0; transform: translate(0,0) rotate(0); }
        20% { opacity: .9; }
        100% { opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); }
      }`}</style>
    </span>
  );
}
