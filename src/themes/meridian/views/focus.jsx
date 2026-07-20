import React from "react";
import { useStore, setUI } from "../../core/store.js";

export default function FocusTunnel() {
  const focusTaskId = useStore((s) => s.ui.focusTaskId);
  if (!focusTaskId) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "#03060c", zIndex: 45, display: "grid", placeItems: "center" }}>
      <div className="mer-viewfinder" style={{ width: "min(480px, 90vw)", height: "min(480px, 70vh)", display: "grid", placeItems: "center" }}>
        <div className="mer-reticle" />
        <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <div className="mer-serif" style={{ fontSize: 18, color: "var(--cyan)" }}>Tracking…</div>
          <p className="mer-dim">Focus tunnel (X1–X6): timer from session ledger, Space pause, Skip, Mark complete + auto-advance.</p>
          <button className="mer-plate" style={{ marginTop: 16, padding: "8px 16px" }} onClick={() => setUI({ focusTaskId: null })}>Exit</button>
        </div>
      </div>
    </div>
  );
}
