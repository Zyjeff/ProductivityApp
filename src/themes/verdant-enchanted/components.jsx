// Verdant presentation. State and mutations use the shared core contract.
import React, { useEffect, useMemo } from "react";
import { DIFFICULTY, PRIORITIES } from "../../core/domain.js";
import { tex } from "./texture.js";
import { PixelIcon, Glyph, RuneRule, Sprite } from "./art.jsx";

export { IS_MAC, MOD } from "../../core/keys.js";

export function Icon({name,size=14}){return name==='ship'?<Sprite kind="book" size={size}/>:name==='anchor'?<Glyph seed={2} size={size}/>:<PixelIcon name={name} size={size}/>;}

/* stamps — square mono markings; tone colors the bezel + text */
const STAMP_TONE = { green: "var(--starboard)", red: "var(--port)", amber: "var(--amber-hot)", blue: "var(--channel)" };
export function Stamp({ kind, tone, children, style, title }) {
  const c = tone || STAMP_TONE[kind];
  return (
    <span className="stamp" title={title} style={c ? { color: c, borderColor: c, ...style } : style}>{children}</span>
  );
}

// Stamp toggle — Verdant's chooser (priority, difficulty, filters…).
export function StampPick({ active, color, onClick, children, title }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={"stamp stamp--pick" + (active ? " stamp--on" : "")}
      aria-pressed={active}>
      {children}
    </button>
  );
}

export function PriorityDot({ p }) {
  const cfg = PRIORITIES[p] || PRIORITIES.medium;
  return <span style={{ width: 4, height: 4, borderRadius: "50%", background: cfg.dot, flexShrink: 0, display: "inline-block" }} />;
}

export function DifficultyPip({ d }) {
  const cfg = DIFFICULTY[d] || DIFFICULTY.medium;
  return <span style={{ width: 6, height: 6, borderRadius: 1.5, background: cfg.tone, flexShrink: 0, display: "inline-block" }} />;
}

// Completion seal — the completion control.
export function HLight({ done, onComplete, onReopen, square = false, size = null, label }) {
  return (
    <button type="button"
      className={"hlight" + (done ? " hlight--on" : "") + (square ? " hlight--sq" : "")}
      style={size ? { width: size, height: size } : undefined}
      onClick={(e) => { e.stopPropagation(); done ? onReopen && onReopen() : onComplete && onComplete(); }}
      title={done ? "Reopen" : "Complete"} aria-label={label || (done ? "Reopen" : "Complete")}>
      {done ? (
        <svg width="9" height="9" viewBox="0 0 12 12">
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="square" fill="none" />
        </svg>
      ) : <span className="e-check-rune"><Glyph seed={2} size={12}/></span>}
    </button>
  );
}

export function Meter({ pct, tone = "var(--amber)", height = 5 }) {
  return (
    <div className="meter" style={{ height }}>
      <div className="meter-fill" style={{ width: Math.max(0, Math.min(100, pct)) + "%", backgroundColor: tone }} />
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
  return <span className="kbd">{children}</span>;
}

export function Lamp({ status, detail }) {
  const cls = status === "ok" ? "lamp--ok" : status === "busy" ? "lamp--busy" : status === "off" ? "lamp--off" : "lamp--unknown";
  const label = status === "ok" ? "AI ready" : status === "busy" ? "AI working…" : status === "off" ? `AI off${detail ? ` (${detail})` : ""} — everything still works, scored manually` : "AI status unknown until first use";
  return <span className={"lamp " + cls} title={label} aria-label={label} />;
}

// Mineral grain at the foot of a rail/section, with an optional caption.
export function GhostFoot(){return <RuneRule/>;}

export function EmptyState({ children, caption = "quiet progress" }) {
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
  const colors = ["#93f36a", "#d4ffba", "#ffffff", "#6bb84b", "#9ae774"];
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
          animation: `v-pixels 1.1s ${p.delay}s ease-out forwards`,
          "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--rot": `${p.angle}deg`,
          opacity: 0,
        }} />
      ))}
    </div>
  );
}
