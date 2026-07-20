import React from "react";
import { useStore, setUI } from "../../../core/store.js";

export default function FocusTunnel() {
  const focusTaskId = useStore((s) => s.ui.focusTaskId);
  if (!focusTaskId) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--ground)", zIndex: 45, display: "grid", placeItems: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--brass)", marginBottom: 12 }}>TELESCOPE LOCKED</div>
        <div style={{ fontFamily: "var(--t-display)", fontSize: 22, color: "var(--star)" }}>Tracking target…</div>
        <p style={{ color: "var(--fg-dim)", marginTop: 12 }}>
          Full focus tunnel (timer, pause/resume, complete + auto-advance) lifts from core Focus contract (X1–X6).
        </p>
        <button className="mer-nav-btn" style={{ marginTop: 20 }} onClick={() => setUI({ focusTaskId: null })}>
          Release mount
        </button>
      </div>
    </div>
  );
}
