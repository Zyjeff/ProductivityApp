import React from "react";
import { useStore, setUI } from "../../../core/store.js";

export default function ReviewOverlay() {
  const reviewWeek = useStore((s) => s.ui.reviewWeek);
  if (reviewWeek == null) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "grid", placeItems: "center" }}>
      <div className="mer-plate" style={{ padding: 24, maxWidth: 520, width: "90%" }}>
        <h2 style={{ fontFamily: "var(--t-display)", color: "var(--brass)", marginTop: 0 }}>Weekly Reduction</h2>
        <p style={{ color: "var(--fg-dim)" }}>Week stats, AI retro, effort by project (R1–R3+).</p>
        <button className="mer-nav-btn" style={{ marginTop: 16 }} onClick={() => setUI({ reviewWeek: null })}>
          Close
        </button>
      </div>
    </div>
  );
}
