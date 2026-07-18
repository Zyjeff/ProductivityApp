// components.jsx — Sluis primitives. Dumb, presentational. The one
// animated thing in the theme (KolkCanvas) lives here too and follows
// the horizon rules: low-res buffer upscaled, stepped ~9fps, one
// synchronous first frame, paused when hidden or reduced-motion.

import React, { useEffect, useMemo, useRef } from "react";
import { DIFFICULTY, PRIORITIES } from "../../core/domain.js";
import { tex, waterGrain, cssColor, REDUCED_MOTION, hashSeed } from "./texture.js";

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
    case "gate":     return <svg {...common}><path d="M6 2L2 8l4 6M10 2l4 6-4 6" /></svg>;
    case "wave":     return <svg {...common}><path d="M2 6c2-2 4-2 6 0s4 2 6 0M2 11c2-2 4-2 6 0s4 2 6 0" /></svg>;
    case "droplet":  return <svg {...common}><path d="M8 2.5S3.5 7 3.5 10a4.5 4.5 0 009 0C12.5 7 8 2.5 8 2.5z" /></svg>;
    case "up":       return <svg {...common}><path d="M8 13V3M4 7l4-4 4 4" /></svg>;
    case "down":     return <svg {...common}><path d="M8 3v10M4 9l4 4 4-4" /></svg>;
    case "send":     return <svg {...common}><path d="M2 8l12-5-4 12-3-5-5-2z" /></svg>;
    case "drag":     return <svg {...common}><circle cx="6" cy="4" r="1" fill="currentColor" stroke="none" /><circle cx="10" cy="4" r="1" fill="currentColor" stroke="none" /><circle cx="6" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="10" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="6" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="10" cy="12" r="1" fill="currentColor" stroke="none" /></svg>;
    default: return null;
  }
}

export function Kbd({ children }) {
  return <span className="s-kbd">{children}</span>;
}

export function Lamp({ status, detail }) {
  const cls = status === "ok" ? "s-lamp--ok" : status === "busy" ? "s-lamp--busy" : status === "off" ? "s-lamp--off" : "s-lamp--unknown";
  const label = status === "ok" ? "AI ready" : status === "busy" ? "AI working…" : status === "off" ? `AI off${detail ? ` (${detail})` : ""} — everything still works, scored manually` : "AI status unknown until first use";
  return <span className={"s-lamp " + cls} title={label} aria-label={label} />;
}

export function Meter({ pct, tone = "var(--water)", height = 5 }) {
  return (
    <div className="s-meter" style={{ height }}>
      <div className="s-meter-fill" style={{ width: Math.max(0, Math.min(100, pct)) + "%", background: tone }} />
    </div>
  );
}

export function Chip({ tone, children, style }) {
  return <span className="s-chip" style={tone ? { color: tone, ...style } : style}>{children}</span>;
}

export function ChipPick({ active, color, onClick, children, title }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={"s-chip s-chip--pick" + (active ? " s-chip--on" : "")}
      style={active && color ? { background: color, borderColor: "transparent", color: "#fff" } : undefined}>
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

// The hull button — Sluis's completion control. Round like a porthole;
// fills with water when the vessel is locked through.
export function CompleteButton({ done, onComplete, onReopen, size = null, label }) {
  return (
    <button type="button"
      className={"s-vessel-hull" + (done ? " s-vessel-hull--on" : "")}
      style={size ? { width: size, height: size } : undefined}
      onClick={(e) => { e.stopPropagation(); done ? onReopen && onReopen() : onComplete && onComplete(); }}
      title={done ? "Terug in de kolk" : "Schut door"} aria-label={label || (done ? "Reopen" : "Complete")}>
      {done && (
        <svg width="9" height="9" viewBox="0 0 12 12">
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </svg>
      )}
    </button>
  );
}

// Two gate leaves forming a chevron; they part when `open`.
export function GateMark({ open = false, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 4L4 12l6 8" style={{ transition: "transform 500ms cubic-bezier(.5,0,.2,1)", transform: open ? "translateX(-4px)" : "none" }} />
      <path d="M14 4l6 8-6 8" style={{ transition: "transform 500ms cubic-bezier(.5,0,.2,1)", transform: open ? "translateX(4px)" : "none" }} />
    </svg>
  );
}

// One full-height gate leaf for the chamber overlay.
export function GateLeaf({ side, open }) {
  return (
    <div className={"s-gate s-gate--" + side + (open ? " s-gate--open" : "")} aria-hidden>
      <svg width="26" height="100%" preserveAspectRatio="none" viewBox="0 0 26 100">
        <path d={side === "l" ? "M2 0 L24 50 L2 100 Z" : "M24 0 L2 50 L24 100 Z"}
          fill="var(--rail)" stroke="var(--line-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

// The level rendered as a gauge staff.
export function PeilStaff({ pct, height = 34, width = 8 }) {
  return (
    <div className="s-peil-staff" style={{ height, width }}>
      <div className="s-peil-staff-fill" style={{ height: Math.max(0, Math.min(100, pct)) + "%" }} />
    </div>
  );
}

// The global waterline — a 3px edge of rising water at the top of the app.
export function Waterline({ pct }) {
  return (
    <div className="s-waterline" aria-hidden>
      <div className="s-waterline-fill" style={{ width: Math.max(0, Math.min(100, pct)) + "%" }} />
    </div>
  );
}

// Eb / Getij / Vloed — the energy switch as a tide staff.
const TIDES = [
  { id: "low", label: "Eb" },
  { id: "normal", label: "Getij" },
  { id: "high", label: "Vloed" },
];
export function TideSwitch({ value, onChange }) {
  const idx = Math.max(0, TIDES.findIndex((t) => t.id === value));
  return (
    <div className="s-tide" role="group" aria-label="Tide — energy sort">
      <span className="s-tide-pill" style={{ left: `calc(${idx} * 33.333% + 3px)`, width: "calc(33.333% - 3px)" }} />
      {TIDES.map((t) => (
        <button key={t.id} type="button" className={t.id === value ? "s-on" : ""}
          onClick={() => onChange(t.id)} title={`Tide: ${t.label}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Eyebrow({ children, right, lit }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
      <div className="s-stencil-row" style={{ flex: 1, minWidth: 0 }}>
        <span className={"s-stencil" + (lit ? " s-stencil--lit" : "")}>{children}</span>
      </div>
      {right}
    </div>
  );
}

// Ghost water at the foot of a section, with an optional caption.
export function WakeFoot({ caption, height = 34 }) {
  const url = useMemo(() => waterGrain("sluis-foot", height, 0.22), [height]);
  return (
    <div aria-hidden>
      <div style={{ height, backgroundImage: url, backgroundRepeat: "repeat-x", backgroundPosition: "top left", opacity: .8 }} />
      {caption && <div className="s-stencil" style={{ fontSize: 8, textAlign: "center", marginTop: 6, opacity: .7 }}>{caption}</div>}
    </div>
  );
}

export function EmptyState({ children, caption = "stil water" }) {
  return (
    <div style={{ padding: "30px 20px 0", textAlign: "center", color: "var(--fg-faint)", fontSize: 13, lineHeight: 1.65 }}>
      <div style={{ maxWidth: 460, margin: "0 auto 18px" }}>{children}</div>
      <WakeFoot caption={caption} />
    </div>
  );
}

// Splash confetti — water droplets with a few amber chips.
export function Confetti({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [onDone]);
  const colors = ["#21b3d4", "#0b7d9e", "#095b70", "#f0a13e", "#8ad4e6"];
  const particles = useMemo(() => Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: 40 + Math.random() * 20,
    color: colors[i % colors.length],
    size: i % 4 === 3 ? 7 : 5,
    delay: Math.random() * 0.22,
    dx: (Math.random() - 0.5) * 240,
    dy: -(50 + Math.random() * 120),
  })), []);
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }} aria-hidden>
      {particles.map((p) => (
        <div key={p.id} className="s-splash" style={{
          left: `${p.x}%`, top: "46%",
          width: p.size, height: p.size, background: p.color,
          animationDelay: `${p.delay}s`,
          "--dx": `${p.dx}px`, "--dy": `${p.dy}px`,
        }} />
      ))}
    </div>
  );
}

/* ── KolkCanvas — the chamber cross-section ────────────────────
   fillPct: water level 0..1. vessels: [{x (0..1), w (0..1), done}].
   animate: stepped ripple at ~9fps (the theme's one live canvas);
   otherwise paints synchronously on prop change. */
export function KolkCanvas({ fillPct = 0, vessels = [], height = 150, animate = true, tone = null }) {
  const ref = useRef(null);
  const stateRef = useRef({ fillPct, vessels });
  stateRef.current = { fillPct, vessels };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const W = 440, H = Math.max(60, Math.round(height / 2));
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    const ink = cssColor("var(--ink)");
    const water = tone || cssColor("var(--water)");
    const deep = cssColor("var(--water-deep)");
    const bright = cssColor("var(--water-bright)");
    const rail = cssColor("var(--rail)");
    const faint = cssColor("var(--fg-faint)");

    function paint(phase) {
      const { fillPct: fp, vessels: vs } = stateRef.current;
      const lvl = Math.round(H * (1 - Math.max(0, Math.min(1, fp))));
      // air / concrete
      ctx.fillStyle = "#f4f8f7"; ctx.fillRect(0, 0, W, H);
      // back wall ticks (gauge marks on the left wall)
      ctx.fillStyle = faint;
      for (let y = 12; y < H; y += 12) ctx.fillRect(6, y, y % 24 === 0 ? 7 : 4, 1);
      // water body
      const grad = ctx.createLinearGradient(0, lvl, 0, H);
      grad.addColorStop(0, bright); grad.addColorStop(0.25, water); grad.addColorStop(1, deep);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 4) {
        const y = lvl + Math.round(Math.sin((x + phase * 14) * 0.055) * 1.6 + Math.sin((x - phase * 9) * 0.021) * 1.2);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath(); ctx.fill();
      // surface sparkle cells
      ctx.fillStyle = "rgba(255,255,255,.55)";
      for (let x = 0; x < W; x += 14) {
        const y = lvl + Math.round(Math.sin((x + phase * 14) * 0.055) * 1.6 + Math.sin((x - phase * 9) * 0.021) * 1.2);
        if ((x / 14 + phase) % 3 === 0) ctx.fillRect(x, y - 1, 4, 1);
      }
      // vessels at the waterline
      for (const v of vs) {
        const bob = animate ? Math.round(Math.sin(phase * 0.9 + v.x * 9) * 1.5) : 0;
        const cx = 14 + v.x * (W - 28);
        const hw = Math.max(8, v.w * (W - 28) * 0.5);
        const y = lvl + bob;
        ctx.fillStyle = v.done ? faint : ink;
        // hull
        ctx.beginPath();
        ctx.moveTo(cx - hw, y - 1);
        ctx.lineTo(cx - hw + 3, y + 5);
        ctx.lineTo(cx + hw - 3, y + 5);
        ctx.lineTo(cx + hw, y - 1);
        ctx.closePath(); ctx.fill();
        // cabin
        ctx.fillRect(cx - hw * 0.35, y - 6, Math.max(4, hw * 0.7), 5);
      }
      // silt at the bottom
      ctx.fillStyle = "rgba(16,34,43,.18)"; ctx.fillRect(0, H - 3, W, 3);
      // chamber walls
      ctx.fillStyle = rail;
      ctx.fillRect(0, 0, 4, H); ctx.fillRect(W - 4, 0, 4, H);
      ctx.fillStyle = "rgba(16,34,43,.25)";
      ctx.fillRect(4, 0, 1, H); ctx.fillRect(W - 5, 0, 1, H);
    }

    paint(0); // synchronous first frame — never a blank pane
    if (!animate || REDUCED_MOTION) return;

    let phase = 0;
    const id = setInterval(() => {
      if (document.hidden) return;
      phase = (phase + 1) % 100000;
      paint(phase);
    }, 110); // ~9fps — the step IS the aesthetic
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, animate, tone, JSON.stringify(vessels), fillPct]);

  return <canvas ref={ref} className="s-kolk-canvas" style={{ height }} aria-hidden />;
}

// A stable pseudo-random unit position from an id (for vessels, ships).
export function seededUnit(id, salt = "") {
  return (hashSeed(String(id) + "|" + salt) % 1000) / 1000;
}
