import React from "react";

export default function DockView() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontFamily: "var(--t-display)", color: "var(--brass)", fontSize: 22, marginBottom: 8 }}>Instrument Bay</h1>
      <p style={{ color: "var(--fg-dim)" }}>
        Projects as campaigns / surveys with % aperture, Library filters, ship-log (First light),
        AI add tasks, screenshot import. Full Dock contract (D1–D13).
      </p>
    </div>
  );
}
