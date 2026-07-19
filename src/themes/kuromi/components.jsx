import React from "react";
import { GLYPH_SKULL, GLYPH_HEART, GLYPH_STAR, glyph } from "./sprite.js";

export const MOD = navigator.platform.includes("Mac") ? "⌘" : "Ctrl";

/* ── tiny pixel icons (currentColor, 9×9-ish viewBox) ────────── */
const ICONS = {
  bolt: "M5 0 1 6h3L3 12 9 4H5l2-4z",
  skull: "M2 1h8v6H8v2H6V7H4v2H2V7H0V1h2zm1 3h2v2H3zm4 0h2v2H7z",
  heart: "M1 1h3v1h2V1h3v4H7v2H5v2H3V7H1V6H0V2h1z",
  star: "M4 0h2v3h3v2H6v1H4V5H1V3h3z",
  x: "M1 1h2v2h2v2h2V3h2V1h2v2H9v2H7v2h2v2h2v2H9V9H7V7H5v2H3v2H1V9h2V7h2V5H3V3H1z",
  check: "M0 5h2v2h2V5h2V3h2V1h2v2H8v2H6v2H4v2H2V7H0z",
  plus: "M4 0h2v4h4v2H6v4H4V6H0V4h4z",
  minus: "M0 4h10v2H0z",
  pen: "M8 0h2v2h2v2h-2v2H8v2H6v2H4v2H2v2H0v-2h2v-2h2V8h2V6h2V4h2zM2 8H0v2h2z",
  trash: "M2 1h6v1h2v2H0V2h2zm0 4h1v6H2zm2 0h2v6H4zm3 0h1v6H7z",
  clock: "M4 0h2v1h2v1h1v2h1v2h-1v2H8v1H6v1H4V9H2V8H1V6H0V4h1V2h1V1h2zm0 2h1v3h3v1H4z",
  eye: "M0 4h2V3h2V2h2v1h2v1h2v2H8v1H6v1H4V7H2V6H0zm4-1v2h2V3z",
  play: "M2 0h2v2h2v2h2v2H6v2H4v2H2z",
  pause: "M1 0h3v10H1zm5 0h3v10H6z",
  flag: "M1 0h2v10H1zm2 1h6v2H7v2H3z",
  lock: "M3 0h4v2h1v2h1v6H1V4h1V2h1zm1 2v2h2V2z",
  unlock: "M3 0h4v2H5v2h4v6H1V4h2V2zm2 6H3v2h2z",
  spark: "M4 0h2v4h4v2H6v4H4V6H0V4h4z",
  book: "M1 0h4v1h1V0h4v10H6V9H5v1H1zm1 2v6h2V2zm5 0v6h2V2z",
  rewind: "M9 0v10L5 6v4L1 5l4-1V0z",
  note: "M2 0h6v2h2v8H0V2h2zm0 3v1h6V3zm0 3v1h4V6z",
  target: "M4 0h2v2h2v2h2v2H8v2H6v2H4V8H2V6H0V4h2V2h2zm0 3v1H3v2h1v1h2V6h1V4H6V3z",
  moon: "M6 0h4v2h1v4h-1v4H6v1H3V9H1V7H0V3h1V1h2zm0 3v4h1v1h2V7h1V4H8V3z",
  sun: "M4 0h2v2H4zM0 4h2v2H0zm8 0h2v2H8zM4 8h2v2H4zM3 3h4v4H3z",
};

export function Icon({ name, size = 12, color, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 12"
      style={{ flex: "0 0 auto", display: "block", ...style }}
      aria-hidden
    >
      <path d={ICONS[name] || ICONS.spark} fill={color || "currentColor"} />
    </svg>
  );
}

/* ── pixel skull checkbox ────────────────────────────────────── */
export function SkullBox({ done, onClick, title }) {
  return (
    <button
      className={"k-row-check" + (done ? " is-done" : "")}
      onClick={onClick}
      title={title}
      aria-pressed={done}
    >
      <Icon name="check" size={11} />
    </button>
  );
}

export function Kbd({ children }) {
  return <span className="k-kbd">{children}</span>;
}

/* ── meter ───────────────────────────────────────────────────── */
export function Meter({ pct, tone, title }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="k-meter" title={title}>
      <div
        className={"k-meter-fill" + (tone ? " is-" + tone : "")}
        style={{ width: p + "%" }}
      />
    </div>
  );
}

export function Tag({ children }) {
  return <span className="k-tag">#{children}</span>;
}

/* ── chip picker (form) ──────────────────────────────────────── */
export function ChipPick({ options, value, onChange, tone }) {
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
      {options.map((o) => {
        const v = typeof o === "object" ? o.value : o;
        const lab = typeof o === "object" ? o.label : o;
        return (
          <button
            key={v}
            type="button"
            className={
              "k-chip" + (tone ? " is-" + tone : "") + (value === v ? " is-on" : "")
            }
            onClick={() => onChange(v)}
          >
            {lab}
          </button>
        );
      })}
    </div>
  );
}

/* ── priority dot ────────────────────────────────────────────── */
export function PriorityDot({ priority }) {
  if (!priority || priority === "medium") return null;
  return (
    <span className={"k-pri is-" + priority}>
      <i />
      {priority}
    </span>
  );
}

/* ── empty state ─────────────────────────────────────────────── */
export function EmptyState({ title, sub, action, glyphRows, glyphColor }) {
  const src = glyph(glyphRows || GLYPH_SKULL, glyphColor || "#ff4d9e");
  return (
    <div className="k-empty">
      <img src={src} alt="" />
      <div className="k-display">{title}</div>
      {sub && <div className="k-sub-line">{sub}</div>}
      {action}
    </div>
  );
}

/* ── ghost footer glyphs ─────────────────────────────────────── */
export function GhostFoot({ rows, color, size = 54, style }) {
  return (
    <img
      src={glyph(rows || GLYPH_STAR, color || "#37234e")}
      alt=""
      aria-hidden
      style={{ height: size, imageRendering: "pixelated", ...style }}
    />
  );
}

export { GLYPH_SKULL, GLYPH_HEART, GLYPH_STAR };
