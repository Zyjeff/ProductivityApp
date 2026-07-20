import React, { useState, useEffect, useRef } from "react";
import { useStore, setUI, captureTask } from "../../core/store.js";
import { setCaptureFocus } from "../../core/keys.js";

export default function CaptureBar() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState("task");
  const inputRef = useRef(null);
  const view = useStore((s) => s.ui.view);

  useEffect(() => {
    setCaptureFocus(() => {
      if (inputRef.current) inputRef.current.focus();
      else setUI({ formOpen: true, editingTaskId: null });
    });
    return () => setCaptureFocus(null);
  }, []);

  function submit() {
    if (!text.trim()) return;
    captureTask(text, { mode, scheduleToday: view === "today" });
    setText("");
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, maxWidth: 520 }}>
      <select value={mode} onChange={(e) => setMode(e.target.value)}
        style={{ background: "var(--plate)", border: "1px solid var(--line)", color: "var(--fg-dim)", borderRadius: 4, padding: "6px 8px", fontSize: 12 }}>
        <option value="task">Sighting</option>
        <option value="steps">Steps</option>
        <option value="project">Campaign</option>
      </select>
      <input
        ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setText(""); e.target.blur(); } }}
        placeholder="Log a sighting…  !high #tag @proj 2h fri"
        style={{ flex: 1, background: "var(--well)", border: "1px solid var(--line)", borderRadius: 4, padding: "8px 12px", color: "var(--fg)", outline: "none" }}
      />
      <button className="mer-nav-btn active" onClick={submit} disabled={!text.trim()}>Log</button>
      <button className="mer-nav-btn" onClick={() => setUI({ formOpen: true, editingTaskId: null })} title="Full form">+</button>
    </div>
  );
}
