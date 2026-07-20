import React from "react";
import { useStore, setUI } from "../../core/store.js";

export default function TaskFormModal() {
  const open = useStore((s) => s.ui.formOpen);
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 50, display: "grid", placeItems: "center" }}>
      <div className="mer-plate" style={{ padding: 24, maxWidth: 480, width: "92%" }}>
        <h2 className="mer-serif" style={{ color: "var(--brass)" }}>Observation Log</h2>
        <p className="mer-dim">Full form fields: title, description, notes, priority, repeats, difficulty, hours/XP, schedule, deadline, project, tags, subtasks + Promote to project (F1–F7).</p>
        <button className="mer-plate" style={{ marginTop: 16, padding: "8px 14px" }} onClick={() => setUI({ formOpen: false, editingTaskId: null })}>Close</button>
      </div>
    </div>
  );
}
