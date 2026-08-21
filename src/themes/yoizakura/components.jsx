// components.jsx — Yoizakura primitives. Dumb, presentational.

import React, { useEffect, useMemo } from "react";
import { DIFFICULTY, PRIORITIES } from "../../core/domain.js";
import { REDUCED_MOTION, installDuskSky } from "./texture.js";

if (typeof document !== "undefined") installDuskSky();

export { IS_MAC, MOD } from "../../core/keys.js";

export function Icon({ name, size = 14 }) {
  const common = { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.25, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "plus":     return <svg {...common}><path d="M8.08 2.55c.1 2.2-.12 5.1.04 7.4.08 1.9-.06 3.8.02 5.5M2.5 8.1c2.4-.14 4.9.12 7.3-.04 2.2-.14 4.3.16 6.2-.02" /></svg>;
    case "chevron":  return <svg {...common}><path d="M4.1 6.15c1.2 1.15 2.45 2.5 3.95 3.7 1.45-1.15 2.7-2.5 3.85-3.75" /></svg>;
    case "chevronR": return <svg {...common}><path d="M6.1 4.05c1.2 1.25 2.55 2.5 3.75 3.95-1.2 1.35-2.5 2.65-3.8 3.9" /></svg>;
    case "chevronL": return <svg {...common}><path d="M10.05 4.1C8.8 5.3 7.5 6.6 6.3 8.05c1.25 1.3 2.5 2.6 3.85 3.85" /></svg>;
    case "close":    return <svg {...common}><path d="M4.15 3.95c2.4 2.5 4.9 5.1 7.7 8.15M12.1 4.05C9.6 6.5 7.1 9.1 4.2 12.1" /></svg>;
    case "check":    return <svg {...common}><path d="M3.15 8.35c1.15 1.2 2.2 2.55 3.35 3.85 2.15-2.7 4.5-5.55 6.7-7.85" /></svg>;
    case "edit":     return <svg {...common}><path d="M11.35 2.55c.7.15 1.55.95 2.05 1.7L6.2 11.7 3.9 12.2l.55-2.35L11.35 2.55z" /><path d="M10.4 3.45l2.15 2.05" /></svg>;
    case "today":    return <svg {...common}><path d="M8.15 2.15c3.35.2 5.85 2.85 5.65 6.05-.22 3.15-2.95 5.7-6.15 5.5C4.5 13.5 2.15 10.7 2.35 7.55 2.55 4.45 5.15 1.95 8.15 2.15z" /><circle cx="8" cy="8" r="1.7" fill="currentColor" stroke="none" /></svg>;
    case "focus":    return <svg {...common}><path d="M5.85 3.85c.15-.2.5-.25.8-.1l5.4 3.55c.4.25.4.8 0 1.05l-5.45 3.6c-.45.3-.95-.05-.9-.55V4.5c0-.3.1-.5.15-.65z" fill="currentColor" stroke="none" /></svg>;
    case "bolt":     return <svg {...common}><path d="M9.15 1.95 4.2 9.7h3.05l-1.15 4.35 5.15-8.05H8.15z" fill="currentColor" stroke="none" /></svg>;
    case "lock":     return <svg {...common}><path d="M4.1 7.55h7.85c.5 0 .9.4.9.9v4.15c0 .55-.4.95-.95.95H4.15c-.5 0-.9-.4-.9-.95V8.45c0-.5.4-.9.85-.9z" /><path d="M5.55 7.5V5.15c.05-1.35 1.15-2.4 2.5-2.4 1.3 0 2.4 1.05 2.45 2.35V7.5" /></svg>;
    case "unlock":   return <svg {...common}><path d="M4.1 7.55h7.85c.5 0 .9.4.9.9v4.15c0 .55-.4.95-.95.95H4.15c-.5 0-.9-.4-.9-.95V8.45c0-.5.4-.9.85-.9z" /><path d="M5.55 7.5V5.2c.1-1.3 1.15-2.25 2.4-2.35 1.15-.08 2.2.7 2.5 1.75" /></svg>;
    case "reset":    return <svg {...common}><path d="M3.15 8.1c.2 2.55 2.35 4.7 5 4.75 2.7.05 4.95-2.15 5.05-4.8.1-2.5-1.85-4.7-4.4-4.95" /><path d="M8.85 2.15c1.05.9 2.05 1.85 3.15 2.7-1.15.85-2.15 1.85-3.2 2.75" /></svg>;
    case "calendar": return <svg {...common}><path d="M3.15 4.05h9.7c.55.05.95.5.95 1.05v7.15c0 .6-.45 1.05-1.05 1.1H3.2c-.55 0-1-.5-1-1.1V5.15c0-.55.45-1.05 1-1.1z" /><path d="M2.2 7h11.5M5.45 2.2v2.7M10.5 2.25v2.65" /></svg>;
    case "recur":    return <svg {...common}><path d="M3.15 6.15c.35-2.05 2.15-3.55 4.25-3.5 1.1 0 2.05.4 2.8 1.1l.85.85M12.85 9.9c-.4 2.05-2.2 3.55-4.3 3.45-1.05 0-2-.4-2.75-1.1l-.85-.8M2.2 4.15v2.7h2.65M13.85 11.85V9.2h-2.7" /></svg>;
    case "search":   return <svg {...common}><path d="M7.05 2.45c2.45.1 4.35 2.15 4.25 4.55-.1 2.4-2.2 4.25-4.6 4.15-2.35-.1-4.2-2.2-4.1-4.55.1-2.35 2.15-4.25 4.45-4.15z" /><path d="M10.55 10.45 13.9 13.9" /></svg>;
    case "camera":   return <svg {...common}><path d="M2.6 5.05h10.8c.5.05.9.5.9 1v6.15c0 .55-.4 1-.95 1.05H2.65c-.55 0-1-.5-1-1.05V6.1c0-.55.4-1 .95-1.05z" /><path d="M8.05 6.55c1.35.05 2.4 1.2 2.35 2.55-.05 1.3-1.2 2.35-2.5 2.3-1.3-.05-2.3-1.2-2.25-2.5.05-1.3 1.15-2.4 2.4-2.35z" /><path d="M6.05 5.05 6.95 2.85h2.15L10.1 5.1" /></svg>;
    case "stats":    return <svg {...common}><path d="M3.1 13.1V8.05M8.05 13.15V3.2M12.95 13.1v-4.2" /></svg>;
    case "inbox":    return <svg {...common}><path d="M2.15 9.05 4.05 3.2h7.9l2 5.85" /><path d="M2.1 9.1h2.85l1.05 1.9h3.95l1-1.9h2.9v3.7H2.15V9.1z" /></svg>;
    case "all":      return <svg {...common}><path d="M3.1 4.1h9.8M3.05 8.05h9.85M3.15 12.05h6.7" /></svg>;
    case "help":     return <svg {...common}><path d="M8.1 2.15c3.3.15 5.8 2.85 5.65 6.05-.15 3.15-2.9 5.7-6.1 5.55C4.5 13.6 2.15 10.75 2.3 7.6 2.45 4.5 5.15 2 8.1 2.15z" /><path d="M6.45 6.15c.15-.95 1.05-1.6 2.05-1.5.95.1 1.6.9 1.5 1.8-.12.7-.55 1.05-1.05 1.4-.4.3-.65.55-.65 1.15M8.05 11.35h.08" /></svg>;
    case "blossom":  return <svg {...common}><path d="M8.05 2.85c1.15 1.45 1.45 2.85.7 4.05 1.35-.35 2.55.45 3.15 1.7-1.25.5-2.15.35-2.95-.45.5 1.35-.05 2.65-1.2 3.55-.5-1.25-.2-2.3.5-3.15-1.25.7-2.7.4-3.75-.65 1.05-.75 2.05-.7 2.95.05C6.55 6.7 6.25 5.2 8.05 2.85z" /><circle cx="8" cy="8.15" r="1.05" /></svg>;
    case "lantern":  return <svg {...common}><path d="M6.15 2.4c1.25-.12 2.5.05 3.75-.1" /><path d="M5.2 5.15c.08-1.25 1.25-2.25 2.9-2.3 1.6-.05 2.8 1.1 2.75 2.35v5.05c.08 1.2-1.1 2.25-2.8 2.3-1.65.05-2.9-1-2.85-2.25V5.15z" /><path d="M5.25 7.55c1.9-.14 3.85.1 5.7-.06" /><path d="M6.55 13.4c1.05.1 2.15-.04 3.2.12" /></svg>;
    case "leaf":     return <svg {...common}><path d="M4.05 12.1c1.5-.45 3.35-1.55 5.05-3.2 1.55-1.5 2.55-3.45 3.2-5.55-3.55 1.35-5.85 3.55-7.15 6.7-.3.7-.4 1.35-.1 2.05z" /><path d="M5.55 10.55c1.35-1.15 2.85-3.05 4.05-5.45" /></svg>;
    case "drawer":   return <svg {...common}><path d="M3.1 3.55h9.8c.5.05.9.45.9.95v7.95c0 .55-.4.95-.95 1H3.15c-.55 0-.95-.45-.95-1V4.5c0-.5.4-.9.9-.95z" /><path d="M2.25 8.05h11.5M6.45 5.45h3.15M6.5 10.55h3.1" /></svg>;
    case "scroll":   return <svg {...common}><path d="M4.1 3.45h7.35c.9.05 1.55.75 1.5 1.55-.05.8-.7 1.4-1.5 1.45H5.55c-.85.05-1.5.7-1.45 1.5.05.8.7 1.4 1.5 1.45h6.85" /><path d="M4.05 3.5v8.85M12.45 12.4H5.55" /></svg>;
    case "stamp":    return <svg {...common}><path d="M4.1 4.05h7.8c.55.05.95.5.95 1.05v6.85c0 .55-.45 1-1 1.05H4.15c-.55 0-1-.5-1-1.1V5.1c0-.55.4-1 .95-1.05z" /><path d="M6.05 8.05h3.9M7.15 6.2h1.8" /></svg>;
    case "teacup":   return <svg {...common}><path d="M3.55 6.45h7.35s.25 2.35-.55 3.85c-.85 1.5-2.55 2.15-3.7 1.15-1.05-.9-1.35-3.15-1.35-5z" /><path d="M11 7.25c1.45.1 2.35 1.15 2.3 2.15-.05.9-.8 1.7-1.95 1.7" /><path d="M4.1 13.05h6.35" /></svg>;
    case "broom":    return <svg {...common}><path d="M9.55 2.45C7.6 6.15 5.85 9.4 4.05 12.95" /><path d="M3.25 11.15c.35.9.85 1.8 1.4 2.45 1.45-.7 2.85-1.5 4.15-2.4-.25-.55-.55-1.1-.85-1.6z" /><path d="M10.05 3.25c1.3.25 2.45 1.15 2.9 2.3" /></svg>;
    case "house":    return <svg {...common}><path d="M2.55 8.15 7.95 3.2l5.55 4.9" /><path d="M4.15 7.55V12.9h7.7V7.6" /></svg>;
    default: return null;
  }
}

const STAMP_TONE = { green: "var(--starboard)", red: "var(--port)", amber: "var(--amber-hot)", blue: "var(--channel)", sakura: "var(--sakura)" };

export function Stamp({ kind, tone, children, style, title }) {
  const c = tone || STAMP_TONE[kind];
  return (
    <span className="yz-stamp" title={title} style={c ? { color: c, borderColor: c, ...style } : style}>{children}</span>
  );
}

export function StampPick({ active, color, onClick, children, title }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={"yz-stamp yz-stamp--pick" + (active ? " yz-stamp--on" : "")}
      style={active && color ? { background: color, color: "var(--ink)", borderColor: "transparent" } : undefined}>
      {children}
    </button>
  );
}

export function Hanko({ children, style, title }) {
  return <span className="yz-hanko" title={title} style={style}>{children}</span>;
}

export function Chip({ active, onClick, children, title, dusk }) {
  const pick = typeof onClick === "function";
  const cls = "yz-chip" + (pick ? " yz-chip--pick" : "") + (active ? " yz-chip--on" : "") + (dusk ? " yz-chip--dusk" : "");
  if (pick) {
    return <button type="button" className={cls} onClick={onClick} title={title}>{children}</button>;
  }
  return <span className={cls} title={title}>{children}</span>;
}

export function TagChip({ tag, active, onClick }) {
  return (
    <Chip active={active} onClick={onClick} title={"#" + tag}>
      #{tag}
    </Chip>
  );
}

export function PriorityDot({ p }) {
  const cfg = PRIORITIES[p] || PRIORITIES.medium;
  return <span title={cfg.label} style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0, display: "inline-block" }} />;
}

export function DifficultyPip({ d }) {
  const cfg = DIFFICULTY[d] || DIFFICULTY.medium;
  return <span title={cfg.label} style={{ width: 6, height: 6, borderRadius: 1, background: cfg.tone, flexShrink: 0, display: "inline-block" }} />;
}

export function BudButton({ done, onComplete, onReopen, square = false, size = null, label }) {
  return (
    <button type="button"
      className={"yz-bud" + (done ? " yz-bud--on" : "") + (square ? " yz-bud--sq" : "")}
      style={size ? { width: size, height: size } : undefined}
      onClick={(e) => { e.stopPropagation(); done ? onReopen && onReopen() : onComplete && onComplete(); }}
      title={done ? "Reopen" : "Complete"}
      aria-label={label || (done ? "Reopen" : "Complete")}>
      {done
        ? <Icon name="blossom" size={square ? 9 : 12} />
        : <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "block" }} />}
    </button>
  );
}

export function Meter({ pct, tone = "var(--sumi)", height = 5, gold = false }) {
  return (
    <div className={"yz-meter" + (gold ? " yz-meter--gold" : " yz-meter--ink")} style={{ height }}>
      <div className="yz-meter-fill" style={{ width: Math.max(0, Math.min(100, pct)) + "%", backgroundColor: tone }} />
    </div>
  );
}

export function Eyebrow({ children, right, lit, sumi, flush, dusk }) {
  return (
    <div className={"yz-eyebrow" + (flush ? " yz-eyebrow--flush" : "")}>
      <h3 className={"yz-sec" + (dusk || lit ? " yz-sec--dusk" : "")}>{children}</h3>
      {right}
    </div>
  );
}

export function Kbd({ children }) {
  return <span className="yz-kbd">{children}</span>;
}

export function Lamp({ status, detail }) {
  const cls = status === "ok" ? "yz-lamp--ok"
    : status === "busy" ? "yz-lamp--busy"
    : status === "off" ? "yz-lamp--off"
    : "yz-lamp--unknown";
  const label = status === "ok" ? "The Attendant is present"
    : status === "busy" ? "The Attendant is working…"
    : status === "off" ? `The Attendant is away${detail ? ` (${detail})` : ""} — the house runs itself.`
    : "The Attendant has not been called yet";
  return (
    <span className={"yz-lamp " + cls} title={label} aria-label={label}>
      <Icon name="lantern" size={14} />
    </span>
  );
}

export function EmptyState({ children, caption = "The garden waits." }) {
  return (
    <div className="yz-empty">
      <div style={{ maxWidth: 460, margin: "0 auto 4px" }}>{children}</div>
      {caption && <div className="yz-empty-caption">{caption}</div>}
    </div>
  );
}

export function Field({ as = "input", className = "", dusk, mono, ...rest }) {
  const Cmp = as;
  const cls = ["yz-field", dusk ? "yz-field--dusk" : "", mono ? "yz-field--mono" : "", className].filter(Boolean).join(" ");
  return <Cmp className={cls} {...rest} />;
}

export function Confetti({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, REDUCED_MOTION ? 200 : 1800);
    return () => clearTimeout(t);
  }, [onDone]);
  const colors = ["#e88bb0", "#dfa14e", "#63c3cf", "#f2a9c6", "#f0bc74"];
  const particles = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    id: i,
    x: 38 + Math.random() * 24,
    rot: (Math.random() * 360) | 0,
    color: colors[i % colors.length],
    delay: Math.random() * 0.28,
    dx: (Math.random() - 0.5) * 280,
    dy: -(40 + Math.random() * 140),
  })), []);
  if (REDUCED_MOTION) return null;
  return (
    <div className="yz-origami" aria-hidden>
      {particles.map((p) => (
        <i key={p.id} style={{
          left: `${p.x}%`, top: "48%",
          background: p.color,
          animationDelay: `${p.delay}s`,
          "--dx": `${p.dx}px`,
          "--dy": `${p.dy}px`,
          "--rot": `${p.rot}deg`,
        }} />
      ))}
    </div>
  );
}
