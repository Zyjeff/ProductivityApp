// components.jsx — Mould Loft primitives. Same component names as the
// other themes' kits (mechanical reuse of view structure), drafting
// vocabulary throughout: callouts, rubber stamps, the inkwell.

import React, { useEffect, useMemo } from "react";
import { DIFFICULTY, PRIORITIES } from "../../core/domain.js";
import { tex } from "./texture.js";

export { IS_MAC, MOD } from "../../core/keys.js";

export function Icon({ name, size = 14 }) {
  const common = { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "plus":     return <svg {...common}><path d="M8 3v10M3 8h10" /></svg>;
    case "chevron":  return <svg {...common}><path d="M4 6l4 4 4-4" /></svg>;
    case "chevronR": return <svg {...common}><path d="M6 4l4 4-4 4" /></svg>;
    case "close":    return <svg {...common}><path d="M4 4l8 8M12 4l-8 8" /></svg>;
    case "check":    return <svg {...common}><path d="M3 8.5L6.5 12L13 4.5" /></svg>;
    case "edit":     return <svg {...common}><path d="M11.5 2.5l2 2L6 12H4v-2L11.5 2.5z" /></svg>;
    case "today":    return <svg {...common}><circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" /></svg>;
    case "focus":    return <svg {...common}><path d="M6 4l5.5 4L6 12V4z" fill="currentColor" stroke="none" /></svg>;
    case "bolt":     return <svg {...common}><path d="M9 2L4 10h3l-1 4 5-8H8l1-4z" fill="currentColor" stroke="none" /></svg>;
    case "moon":     return <svg {...common}><path d="M13 9a5 5 0 11-6-6 4 4 0 006 6z" /></svg>;
    case "lock":     return <svg {...common}><rect x="3.5" y="7.5" width="9" height="6" rx="1" /><path d="M5.5 7.5V5a2.5 2.5 0 015 0v2.5" /></svg>;
    case "unlock":   return <svg {...common}><rect x="3.5" y="7.5" width="9" height="6" rx="1" /><path d="M5.5 7.5V5a2.5 2.5 0 014.95-.5" /></svg>;
    case "reset":    return <svg {...common}><path d="M3 8a5 5 0 109-3" /><path d="M9 2L12 5L9 8" /></svg>;
    case "calendar": return <svg {...common}><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></svg>;
    case "anchor":   return <svg {...common}><circle cx="8" cy="4" r="1.8" /><path d="M8 5.8V14M3 9.5c0 3 2.2 4.5 5 4.5s5-1.5 5-4.5M3 9.5H5M13 9.5h-2" /></svg>;
    case "ship":     return <svg {...common}><path d="M2 11l1.5 2.5h9L14 11M3 8l5-5 5 5M8 3v8" /></svg>;
    case "flame":    return <svg {...common}><path d="M8 2c1 2-1 3 0 5 1 1 3 0 3 3a3 3 0 11-6 0c0-2 1-2 1-4S7 3 8 2z" /></svg>;
    case "recur":    return <svg {...common}><path d="M3 6a4 4 0 016-3l1 1M13 10a4 4 0 01-6 3l-1-1M2 4v3h3M14 12V9h-3" /></svg>;
    case "trophy":   return <svg {...common}><path d="M5 3h6v4a3 3 0 11-6 0V3zM3 4h2v2a1 1 0 01-2 0V4zM11 4h2v2a1 1 0 01-2 0V4zM6.5 11v2h3v-2M5 13h6" /></svg>;
    case "stats":    return <svg {...common}><path d="M3 13V8M8 13V3M13 13v-4" /></svg>;
    case "search":   return <svg {...common}><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg>;
    case "camera":   return <svg {...common}><rect x="2" y="4.5" width="12" height="9" rx="1.5" /><circle cx="8" cy="9" r="2.5" /><path d="M6 4.5L7 2.5h2l1 2" /></svg>;
    case "pen":      return <svg {...common}><path d="M2 14l1-3.5L11.5 2l2.5 2.5L5.5 13 2 14z" /><path d="M10 3.5l2.5 2.5" /></svg>;
    default: return null;
  }
}

/* dimension callout (the stamp/chip role) */
const STAMP_TONE = { green: "var(--starboard)", red: "var(--port)", amber: "var(--amber)", blue: "var(--channel)" };
export function Stamp({ kind, tone, children, style, title }) {
  const c = tone || STAMP_TONE[kind];
  return (
    <span className="lf-callout" title={title} style={c ? { color: c, borderColor: c, ...style } : style}>{children}</span>
  );
}

// Callout toggle — the chooser control.
export function StampPick({ active, color, onClick, children, title }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={"lf-callout lf-callout--pick" + (active ? " lf-callout--on" : "")}
      style={active && color ? { background: color, color: "var(--ink)", borderColor: "transparent" } : undefined}>
      {children}
    </button>
  );
}

// Rubber stamp: loud, rotated, bordered. Renders as a button with onClick.
export function Rubber({ tone = "var(--port)", onClick, children, title, style }) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag className="lf-rubber" onClick={onClick} title={title}
      style={{ color: tone, ...(onClick ? { cursor: "pointer", background: "transparent" } : {}), ...style }}>
      {children}
    </Tag>
  );
}

export function PriorityDot({ p }) {
  const cfg = PRIORITIES[p] || PRIORITIES.medium;
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0, display: "inline-block" }} />;
}

export function DifficultyPip({ d }) {
  const cfg = DIFFICULTY[d] || DIFFICULTY.medium;
  return <span style={{ width: 6, height: 6, borderRadius: 1.5, background: cfg.tone, flexShrink: 0, display: "inline-block" }} />;
}

// The inkwell — completion control. Pencil outline pending, ink filled done.
export function HLight({ done, onComplete, onReopen, square = false, size = null, label }) {
  return (
    <button type="button"
      className={"lf-light" + (done ? " lf-light--on" : "") + (square ? " lf-light--sq" : "")}
      style={size ? { width: size, height: size } : undefined}
      onClick={(e) => { e.stopPropagation(); done ? onReopen && onReopen() : onComplete && onComplete(); }}
      title={done ? "Back to pencil" : "Ink it"} aria-label={label || (done ? "Reopen" : "Complete")}>
      {done && (
        <svg width="9" height="9" viewBox="0 0 12 12">
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="square" fill="none" />
        </svg>
      )}
    </button>
  );
}

export function Meter({ pct, tone = "var(--amber)", height = 5 }) {
  return (
    <div className="lf-meter" style={{ height }}>
      <div className="lf-fill" style={{ width: Math.max(0, Math.min(100, pct)) + "%", backgroundColor: tone }} />
    </div>
  );
}

export function Eyebrow({ children, right, lit }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
      <div className="w-stencil-row" style={{ flex: 1, minWidth: 0 }}>
        <span className={"w-stencil" + (lit ? " w-stencil--lit" : "")}>{children}</span>
      </div>
      {right}
    </div>
  );
}

export function Kbd({ children }) {
  return <span className="lf-kbd">{children}</span>;
}

export function Lamp({ status, detail }) {
  const cls = status === "ok" ? "lf-lamp--ok" : status === "busy" ? "lf-lamp--busy" : status === "off" ? "lf-lamp--off" : "lf-lamp--unknown";
  const label = status === "ok" ? "AI ready" : status === "busy" ? "AI working…" : status === "off" ? `AI off${detail ? ` (${detail})` : ""} — everything still works, scored manually` : "AI status unknown until first use";
  return <span className={"lf-lamp " + cls} title={label} aria-label={label} />;
}

// Pencil shading at a section's foot, with an optional margin note.
export function GhostFoot({ caption, tone = "#a89d80", height = 40 }) {
  const url = useMemo(
    () => tex({ seed: "lf-foot-" + tone, algo: "noise", w: 240, h: height, cell: 2, fg: tone, grad: { from: 0.34, to: 0.02, dir: "up" }, alpha: 0.8 }),
    [tone, height]
  );
  return (
    <div aria-hidden>
      <div style={{ height, backgroundImage: url, backgroundRepeat: "repeat-x", backgroundPosition: "bottom left" }} />
      {caption && <div className="w-stencil" style={{ fontSize: 8, textAlign: "center", marginTop: 6, opacity: 0.7 }}>{caption}</div>}
    </div>
  );
}

export function EmptyState({ children, caption = "a clean sheet" }) {
  return (
    <div style={{ padding: "30px 20px 0", textAlign: "center", color: "var(--fg-faint)", fontSize: 13, lineHeight: 1.65 }}>
      <div style={{ maxWidth: 460, margin: "0 auto 18px" }}>{children}</div>
      <GhostFoot caption={caption} />
    </div>
  );
}

export function Confetti({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);
  const colors = ["#1f4e77", "#206b46", "#b3341f", "#9a6a13", "#2f5f9e"];
  const particles = useMemo(() => Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: 40 + Math.random() * 20,
    angle: Math.random() * 360,
    color: colors[i % colors.length],
    delay: Math.random() * 0.25,
    dx: (Math.random() - 0.5) * 240,
    dy: -(50 + Math.random() * 120),
  })), []);
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }} aria-hidden>
      {particles.map((p) => (
        <div key={p.id} style={{
          position: "absolute", left: `${p.x}%`, top: "48%",
          width: 7, height: 7, background: p.color,
          animation: `lf-confetti 1.1s ${p.delay}s ease-out forwards`,
          "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--rot": `${p.angle}deg`,
          opacity: 0,
        }} />
      ))}
    </div>
  );
}
