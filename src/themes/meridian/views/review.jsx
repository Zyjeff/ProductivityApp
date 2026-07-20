import React from "react";
import { useStore, setUI } from "../../core/store.js";

export default function ReviewOverlay() {
  const reviewWeek = useStore((s) => s.ui.reviewWeek);
  if (reviewWeek == null) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "grid", placeItems: "center" }}>
      <div className="mer-plate" style={{ padding: 24, maxWidth: 520, width: "90%" }}>
        <h2 className="mer-serif" style={{ color: "var(--brass)" }}>Weekly Reduction</h2>
        <p className="mer-dim">Week stats, AI retro, effort by project (R1–R3+).</p>
        <button className="mer-plate" style={{ marginTop: 16, padding: "8px 14px" }} onClick={() => setUI({ reviewWeek: null })}>Close</button>
      </div>
    </div>
  );
}
