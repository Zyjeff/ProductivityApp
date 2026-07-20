import React from "react";
import { useStore, setUI } from "../../core/store.js";

export default function EndOfDayDialog() {
  const open = useStore((s) => s.ui.endOfDayOpen);
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "grid", placeItems: "center" }}>
      <div className="mer-plate" style={{ padding: 24, maxWidth: 420, width: "90%" }}>
        <h2 className="mer-serif" style={{ color: "var(--brass)" }}>End Session</h2>
        <p className="mer-dim">Recap completed + XP, roll unfinished, screen-time, Close day (E1–E5).</p>
        <button className="mer-plate" style={{ marginTop: 16, padding: "8px 14px" }} onClick={() => setUI({ endOfDayOpen: false })}>Close</button>
      </div>
    </div>
  );
}
