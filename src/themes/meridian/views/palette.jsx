import React from "react";
import { useStore, setUI } from "../../core/store.js";

export default function Palette() {
  const open = useStore((s) => s.ui.paletteOpen);
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 55, display: "grid", placeItems: "start center", paddingTop: 80 }} onClick={() => setUI({ paletteOpen: false })}>
      <div className="mer-plate" style={{ padding: 16, width: 420 }} onClick={(e) => e.stopPropagation()}>
        <input autoFocus placeholder="Issue a command or > quick add…" style={{ width: "100%", background: "var(--well)", border: "1px solid var(--line)", padding: 8, borderRadius: 4 }} />
        <p className="mer-faint" style={{ fontSize: 11, marginTop: 8 }}>Command palette (L1–L5) — fuzzy commands + task search + quick-add grammar.</p>
      </div>
    </div>
  );
}
