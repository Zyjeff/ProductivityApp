import React from "react";

export default function PlanView() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontFamily: "var(--t-display)", color: "var(--brass)", fontSize: 22, marginBottom: 8 }}>Ephemeris</h1>
      <p style={{ color: "var(--fg-dim)" }}>
        Rolling agenda, capacity editor, AI Schedule / Rebuild, chunk cards with drag-to-day, locked days.
        Full wiring lifts from the core Plan contract (P1–P9).
      </p>
      <div className="mer-plate" style={{ padding: 16, marginTop: 16 }}>
        <div className="mer-gauge-label">CAPACITY THIS WEEK</div>
        <p style={{ fontSize: 12, color: "var(--fg-faint)" }}>Inline hour editors + load meters go here.</p>
      </div>
    </div>
  );
}
