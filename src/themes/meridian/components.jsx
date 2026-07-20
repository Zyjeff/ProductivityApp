import React from "react";

export function Icon({ name, size = 16 }) {
  const map = {
    today: "⊙", plan: "☰", dock: "▣", journal: "▤", focus: "◎", complete: "✓",
    edit: "✎", delete: "×", capture: "+", star: "★", brass: "◈"
  };
  return <span style={{ fontSize: size, lineHeight: 1 }} aria-hidden>{map[name] || "•"}</span>;
}

export function Kbd({ children }) {
  return (
    <kbd style={{
      fontFamily: "var(--t-mono)", fontSize: 10, padding: "1px 5px",
      borderRadius: 3, background: "var(--well)", border: "1px solid var(--line)",
      color: "var(--fg-dim)",
    }}>{children}</kbd>
  );
}

export function Lamp({ status = "unknown", title }) {
  return (
    <span className={"mer-ai-lamp " + status} title={title || status} style={{ display: "inline-block" }} />
  );
}

export function ProgressRing({ pct = 0, size = 36, stroke = 3, color = "var(--brass)" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
  );
}

export function ViewfinderFrame({ children, label }) {
  return (
    <div className="mer-viewfinder" style={{ padding: 20, minHeight: 140 }}>
      <div className="mer-reticle" />
      <div style={{ position: "relative", zIndex: 1 }}>
        {label && <div className="mer-gauge-label" style={{ marginBottom: 8 }}>{label}</div>}
        {children}
      </div>
    </div>
  );
}

export function BrassPlaque({ label, value }) {
  return (
    <div className="mer-gauge">
      <span className="mer-gauge-label">{label}</span>
      <span className="mer-gauge-value" style={{ color: "var(--brass)" }}>{value}</span>
    </div>
  );
}

export function EmptyState({ title, body }) {
  return (
    <div className="mer-plate" style={{ padding: 28, textAlign: "center" }}>
      <div style={{ fontFamily: "var(--t-display)", color: "var(--fg-dim)", fontSize: 18 }}>{title}</div>
      <div style={{ color: "var(--fg-faint)", marginTop: 8, fontSize: 13 }}>{body}</div>
    </div>
  );
}
