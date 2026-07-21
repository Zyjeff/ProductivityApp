// components.jsx — Apogee primitives. Dumb, presentational. ap- classes only.

import React, { useEffect, useMemo } from "react";
import { REDUCED_MOTION } from "./texture.js";

export { MOD } from "../../core/keys.js";

export function Icon({ name, size = 14 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  switch (name) {
    case "check":
      return <svg {...common}><path d="M3 8.5L6.5 12L13 4.5" /></svg>;
    case "x":
    case "close":
      return <svg {...common}><path d="M4 4l8 8M12 4l-8 8" /></svg>;
    case "edit":
      return <svg {...common}><path d="M11.5 2.5l2 2L6 12H4v-2L11.5 2.5z" /></svg>;
    case "focus":
      return <svg {...common}><path d="M8 2c1 2-1 3 0 5 1 1 3 0 3 3a3 3 0 11-6 0c0-2 1-2 1-4S7 3 8 2z" /></svg>;
    case "flame":
      return <svg {...common}><path d="M8 2c1 2-1 3 0 5 1 1 3 0 3 3a3 3 0 11-6 0c0-2 1-2 1-4S7 3 8 2z" /></svg>;
    case "plus":
      return <svg {...common}><path d="M8 3v10M3 8h10" /></svg>;
    case "minus":
      return <svg {...common}><path d="M3 8h10" /></svg>;
    case "drag":
      return <svg {...common}><path d="M5 4h.01M8 4h.01M11 4h.01M5 8h.01M8 8h.01M11 8h.01M5 12h.01M8 12h.01M11 12h.01" strokeWidth="2.2" /></svg>;
    case "lock":
      return <svg {...common}><rect x="3.5" y="7.5" width="9" height="6" /><path d="M5.5 7.5V5a2.5 2.5 0 015 0v2.5" /></svg>;
    case "unlock":
      return <svg {...common}><rect x="3.5" y="7.5" width="9" height="6" /><path d="M5.5 7.5V5a2.5 2.5 0 014.95-.5" /></svg>;
    case "calendar":
      return <svg {...common}><rect x="2.5" y="3.5" width="11" height="10" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></svg>;
    case "tag":
      return <svg {...common}><path d="M2.5 8.5V3.5H7.5l6 6-5 5-6-6z" /><path d="M5.5 5.5h.01" strokeWidth="2" /></svg>;
    case "bolt":
      return <svg {...common}><path d="M9 2L4 10h3l-1 4 5-8H8l1-4z" fill="currentColor" stroke="none" /></svg>;
    case "upload":
      return <svg {...common}><path d="M8 11V3M4.5 6.5L8 3l3.5 3.5M3 13h10" /></svg>;
    case "download":
      return <svg {...common}><path d="M8 3v8M4.5 7.5L8 11l3.5-3.5M3 13h10" /></svg>;
    case "camera":
      return <svg {...common}><rect x="2" y="4.5" width="12" height="9" /><path d="M6 4.5L7 2.5h2l1 2M8 9.5v0" /><path d="M6.5 9h3" /></svg>;
    case "chevron-l":
      return <svg {...common}><path d="M10 4L6 8l4 4" /></svg>;
    case "chevron-r":
      return <svg {...common}><path d="M6 4l4 4-4 4" /></svg>;
    case "chevron-u":
      return <svg {...common}><path d="M4 10l4-4 4 4" /></svg>;
    case "chevron-d":
      return <svg {...common}><path d="M4 6l4 4 4-4" /></svg>;
    case "undo":
      return <svg {...common}><path d="M3 8a5 5 0 109-3" /><path d="M3 4v4h4" /></svg>;
    case "launch":
      return <svg {...common}><path d="M8 14V6M5 9l3-5 3 5M4 14h8" /></svg>;
    case "patch":
      return <svg {...common}><rect x="3" y="3" width="10" height="10" /><path d="M6 8h4M8 6v4" /></svg>;
    case "warn":
      return <svg {...common}><path d="M8 3L2.5 13h11L8 3z" /><path d="M8 7v3M8 11.5h.01" strokeWidth="1.8" /></svg>;
    default:
      return null;
  }
}

export function Kbd({ children }) {
  return <span className="ap-kbd">{children}</span>;
}

export function Lamp({ status, detail }) {
  const cls =
    status === "ok" ? "ap-lamp--ok"
    : status === "busy" ? "ap-lamp--busy"
    : status === "off" ? "ap-lamp--off"
    : "ap-lamp--unknown";
  const label =
    status === "ok" ? "COMMS ok — GUIDANCE ready"
    : status === "busy" ? "COMMS busy — GUIDANCE working…"
    : status === "off"
      ? `COMMS off${detail ? ` (${detail})` : ""} — flying manual`
      : "COMMS status unknown until first use";
  return <span className={"ap-lamp " + cls} title={label} aria-label={label} />;
}

const STAMP_KEYWORDS = {
  nominal: "ap-stamp--nominal",
  hold: "ap-stamp--hold",
  go: "ap-stamp--go",
  "go for launch": "ap-stamp--go",
  liftoff: "ap-stamp--liftoff",
};

export function Stamp({ tone, children, style }) {
  const key = tone != null ? String(tone).toLowerCase() : "";
  const mod = STAMP_KEYWORDS[key];
  if (mod) {
    return <span className={"ap-stamp " + mod} style={style}>{children}</span>;
  }
  const c = tone || undefined;
  return (
    <span
      className="ap-stamp"
      style={c ? { color: c, borderColor: c, ...style } : style}
    >
      {children}
    </span>
  );
}

export function Cell({ label, children }) {
  return (
    <div className="ap-cell">
      {label != null && <div className="ap-cell-label">{label}</div>}
      <div className="ap-cell-value">{children}</div>
    </div>
  );
}

export function Meter({ pct, tone = "var(--signal)" }) {
  const w = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div className="ap-meter">
      <div className="ap-meter-fill" style={{ width: w + "%", backgroundColor: tone }} />
    </div>
  );
}

// DOM + CSS particle burst (not canvas). Bounded one-shot; reduced-motion
// skips straight to onDone. Colors: flare magenta + signal red + channel cyan.
export function Confetti({ onDone }) {
  useEffect(() => {
    if (REDUCED_MOTION) {
      const t = setTimeout(() => onDone && onDone(), 16);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => onDone && onDone(), 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  const colors = ["#ff2e9a", "#ff2b1a", "#4fd8eb"];
  const particles = useMemo(() => {
    if (REDUCED_MOTION) return [];
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: 40 + Math.random() * 20,
      angle: Math.random() * 360,
      color: colors[i % colors.length],
      delay: Math.random() * 0.25,
      dx: (Math.random() - 0.5) * 240,
      dy: -(50 + Math.random() * 120),
    }));
  }, []);

  if (REDUCED_MOTION) return null;

  return (
    <div className="ap-confetti-layer" aria-hidden>
      {particles.map((p) => (
        <div
          key={p.id}
          className="ap-confetti-particle"
          style={{
            left: `${p.x}%`,
            top: "48%",
            background: p.color,
            animationDelay: `${p.delay}s`,
            "--dx": `${p.dx}px`,
            "--dy": `${p.dy}px`,
            "--rot": `${p.angle}deg`,
          }}
        />
      ))}
    </div>
  );
}

export function fitFontSize(chars, basePx, maxWidthPx, K = 0.72) {
  const n = Math.max(1, chars);
  const fit = Math.floor(maxWidthPx / (n * K));
  return Math.max(14, Math.min(basePx, fit));
}

export function DotNumeral({ children, size, style }) {
  const cls =
    size === "xl" ? "ap-readout ap-readout--xl"
    : size === "lg" ? "ap-readout ap-readout--lg"
    : size === "md" ? "ap-readout ap-readout--md"
    : size === "sm" ? "ap-readout ap-readout--sm"
    : "ap-readout";
  return <span className={cls} style={style}>{children}</span>;
}

export function RegPanel({ children, className = "", ...rest }) {
  const merged = ["ap-panel", "ap-panel--reg", className].filter(Boolean).join(" ");
  return (
    <div className={merged} {...rest}>
      {children}
    </div>
  );
}

export function EmptyState({ title, line, action }) {
  return (
    <div className="ap-empty">
      {title != null && <div className="ap-empty-title">{title}</div>}
      {line != null && <div className="ap-empty-line">{line}</div>}
      {action != null && <div className="ap-empty-action">{action}</div>}
    </div>
  );
}
