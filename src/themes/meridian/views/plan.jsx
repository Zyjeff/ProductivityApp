import React from "react";
export default function PlanView() {
  return (
    <div>
      <h1 className="mer-serif" style={{ color: "var(--brass)", fontSize: 22, marginBottom: 8 }}>Ephemeris</h1>
      <p className="mer-dim">Rolling agenda, capacity editor (0–10h / weekday), AI Schedule / Rebuild, chunk cards with drag-to-day, locked days, adrift notice. Full wiring lifts from core Plan contract (P1–P9).</p>
      <div className="mer-plate" style={{ padding: 16, marginTop: 16 }}>
        <div className="mer-gauge-label">CAPACITY THIS WEEK</div>
        <p className="mer-faint" style={{ fontSize: 12 }}>Inline hour editors + load meters go here.</p>
      </div>
    </div>
  );
}
