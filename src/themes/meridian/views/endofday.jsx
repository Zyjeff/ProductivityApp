import React from "react";
import { useStore, setUI } from "../../../core/store.js";

export default function EndOfDayDialog() {
  const open = useStore((s) => s.ui.endOfDayOpen);
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "grid", placeItems: "center" }}>
      <div className="mer-plate" style={{ padding: 24, maxWidth: 480, width: "90%" }}>
        <h2 style={{ fontFamily: "var(--t-display)", color: "var(--brass)", marginTop: 0 }}>End Session</h2>
        <p style={{ color: "var(--fg-dim)" }}>Recap, roll unfinished, screen-time capture, close day (E1–E5).</p>
        <button className="mer-nav-btn" style={{ marginTop: 16 }} onClick={() => setUI({ endOfDayOpen: false })}>
          Close
        </button>
      </div>
    </div>
  );
}
