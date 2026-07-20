// components.jsx — Relay primitives. Path labels, glass, rank ring.

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
    case "today":    return <svg {...common}><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3.5l2 1.2" /></svg>;
    case "focus":    return <svg {...common}><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" /></svg>;
    case "bolt":     return <svg {...common}><path d="M9 2L4 10h3l-1 4 5-8H8l1-4z" fill="currentColor" stroke="none" /></svg>;
    case "moon":     return <svg {...common}><path d="M13 9a5 5 0 11-6-6 4 4 0 006 6z" /></svg>;
    case "lock":     return <svg {...common}><rect x="3.5" y="7.5" width="9" height="6" rx="1" /><path d="M5.5 7.5V5a2.5 2.5 0 015 0v2.5" /></svg>;
    case "unlock":   return <svg {...common}><rect x="3.5" y="7.5" width="9" height="6" rx="1" /><path d="M5.5 7.5V5a2.5 2.5 0 014.95-.5" /></svg>;
    case "reset":    return <svg {...common}><path d="M3 8a5 5 0 109-3" /><path d="M9 2L12 5L9 8" /></svg>;
    case "calendar": return <svg {...common}><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></svg>;
    case "anchor":   return <svg {...common}><rect x="3" y="3" width="10" height="10" rx="1.5" /><path d="M6 8h4M8 6v4" /></svg>;
    case "ship":     return <svg {...common}><path d="M3 11h10l-1.5 2h-7L3 11zM4 11V7l4-3 4 3v4" /></svg>;
    case "flame":    return <svg {...common}><path d="M8 2c1 2-1 3 0 5 1 1 3 0 3 3a3 3 0 11-6 0c0-2 1-2 1-4S7 3 8 2z" /></svg>;
    case "recur":    return <svg {...common}><path d="M3 6a4 4 0 016-3l1 1M13 10a4 4 0 01-6 3l-1-1M2 4v3h3M14 12V9h-3" /></svg>;
    case "trophy":   return <svg {...common}><path d="M5 3h6v4a3 3 0 11-6 0V3zM3 4h2v2a1 1 0 01-2 0V4zM11 4h2v2a1 1 0 01-2 0V4zM6.5 11v2h3v-2M5 13h6" /></svg>;
    case "stats":    return <svg {...common}><path d="M3 13V8M8 13V3M13 13v-4" /></svg>;
    case "search":   return <svg {...common}><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg>;
    case "camera":   return <svg {...common}><rect x="2" y="4.5" width="12" height="9" rx="1.5" /><circle cx="8" cy="9" r="2.5" /><path d="M6 4.5L7 2.5h2l1 2" /></svg>;
    case "grid":     return <svg {...common}><path d="M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z" /></svg>;
    case "node":     return <svg {...common}><circle cx="8" cy="8" r="2.5" /><path d="M8 2.5v2M8 11.5v2M2.5 8h2M11.5 8h2" /></svg>;
    case "drag":     return <svg {...common}><path d="M5 4h.01M8 4h.01M11 4h.01M5 8h.01M8 8h.01M11 8h.01M5 12h.01M8 12h.01M11 12h.01" strokeWidth="2.2" /></svg>;
    case "up":       return <svg {...common}><path d="M8 12V4M4.5 7.5L8 4l3.5 3.5" /></svg>;
    case "down":     return <svg {...common}><path d="M8 4v8M4.5 8.5L8 12l3.5-3.5" /></svg>;
    default: return null;
  }
}

export function Stamp({ kind, tone, children, style }) {
  const map = { green: "var(--starboard)", red: "var(--port)", amber: "var(--amber-hot)", blue: "var(--channel)" };
  const c = tone || map[kind];
  return (
    <span className="r-stamp" style={c ? { color: c, borderColor: c, ...style } : style}>{children}</span>
  );
}

export function StampPick({ active, color, onClick, children, title }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={"r-stamp r-stamp--pick" + (active ? " r-stamp--on" : "")}
      style={active && color ? { background: color, color: "var(--ink)", borderColor: "transparent" } : undefined}>
      {children}
    </button>
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

export function ResolveBtn({ done, onComplete, onReopen, size = null, label }) {
  return (
    <button type="button"
      className={"r-resolve" + (done ? " r-resolve--on" : "")}
      style={size ? { width: size, height: size } : undefined}
      onClick={(e) => { e.stopPropagation(); done ? onReopen && onReopen() : onComplete && onComplete(); }}
      title={done ? "Reopen signal" : "Resolve"}
      aria-label={label || (done ? "Reopen" : "Resolve")}>
      {done && (
        <svg width="9" height="9" viewBox="0 0 12 12">
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="square" fill="none" />
        </svg>
      )}
    </button>
  );
}

export function Meter({ pct, tone = "var(--channel)", height = 4 }) {
  return (
    <div className="r-meter" style={{ height }}>
      <div className="r-meter-fill" style={{ width: Math.max(0, Math.min(100, pct)) + "%", backgroundColor: tone }} />
    </div>
  );
}

export function RankRing({ pct, lvl, size = 36 }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" className="r-rank-ring" aria-hidden>
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--line-strong)" strokeWidth="2.5" />
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--channel)" strokeWidth="2.5"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        transform="rotate(-90 18 18)" />
      <text x="18" y="21" textAnchor="middle" className="r-rank-num">{lvl}</text>
    </svg>
  );
}

export function Eyebrow({ children, right, lit }) {
  return (
    <div className="r-eyebrow">
      <div className="r-stencil-row" style={{ flex: 1, minWidth: 0 }}>
        <span className={"r-lab" + (lit ? " r-lab--lit" : "")}>{children}</span>
      </div>
      {right}
    </div>
  );
}

export function Kbd({ children }) {
  return <span className="r-kbd">{children}</span>;
}

export function Lamp({ status, detail }) {
  const cls = status === "ok" ? "r-lamp--ok" : status === "busy" ? "r-lamp--busy" : status === "off" ? "r-lamp--off" : "r-lamp--unknown";
  const label = status === "ok" ? "AI link ready" : status === "busy" ? "AI cycling…" : status === "off" ? `AI off${detail ? ` (${detail})` : ""} — everything still works` : "AI status unknown until first use";
  return <span className={"r-lamp " + cls} title={label} aria-label={label} />;
}

export function EmptyState({ children, caption = "no traffic on the grid" }) {
  const url = useMemo(
    () => tex({ seed: "empty-relay", algo: "noise", w: 240, h: 40, cell: 2, fg: "#5b6cff", grad: { from: 0.25, to: 0.02, dir: "up" }, alpha: 0.5 }),
    []
  );
  return (
    <div className="r-empty">
      <div className="r-empty-body">{children}</div>
      <div aria-hidden style={{ height: 40, backgroundImage: url, backgroundRepeat: "repeat-x" }} />
      <div className="r-lab" style={{ textAlign: "center", marginTop: 6, opacity: 0.6 }}>{caption}</div>
    </div>
  );
}

export function Confetti({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);
  const colors = ["#5b6cff", "#b6ff3c", "#ff4d3a", "#8b9dff", "#f0a13e"];
  const particles = useMemo(() => Array.from({ length: 32 }, (_, i) => ({
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
          width: 6, height: 6, background: p.color, borderRadius: p.id % 3 === 0 ? "50%" : 1,
          animation: `r-confetti 1.1s ${p.delay}s ease-out forwards`,
          "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--rot": `${p.angle}deg`,
          opacity: 0,
        }} />
      ))}
    </div>
  );
}

export function PathLabel({ children }) {
  return <span className="r-path">{children}</span>;
}

export function Glass({ children, className = "", style, seed = "g" }) {
  const grain = useMemo(
    () => tex({ seed: "glass-" + seed, algo: "noise", w: 96, h: 64, cell: 2, fg: "#5b6cff", density: 0.06, alpha: 0.4 }),
    [seed]
  );
  return (
    <div className={"r-glass " + className} style={{ ...style, backgroundImage: grain }}>
      {children}
    </div>
  );
}
