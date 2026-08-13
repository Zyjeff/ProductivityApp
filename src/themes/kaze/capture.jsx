// capture.jsx — Traveler's notes. Enter saves instantly and locally;
// AI enrichment runs after and never blocks. Escape clears and blurs.
// Logic identical to the core contract — only the chassis is Kaze's.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Kbd, Lamp } from "./components.jsx";
import { parseQuickAdd } from "../../core/domain.js";
import { useStore, captureTask, setUI } from "../../core/store.js";
import { enrichCapturedTask, captureProject } from "../../core/enrich.js";
import { setCaptureFocus } from "../../core/keys.js";

const CHIP_TONE = {
  priority: "var(--port)", tag: "var(--fg-dim)", project: "var(--channel)",
  hours: "var(--amber-hot)", date: "var(--sakura)", deadline: "var(--warn)",
  recurring: "var(--channel)",
};

const MODES = [
  { id: "task", label: "Note", placeholder: "Mark a waypoint — saved the moment you press ↵ · !prio #tag @project 2h fri daily…" },
  { id: "subtasks", label: "Steps", placeholder: "Describe a longer stretch of road — the oracle marks the steps" },
  { id: "project", label: "Journey", placeholder: "Name a journey — the oracle drafts its waypoints" },
];

export function CaptureNote({ scheduleToday = false, autoRegister = true }) {
  const aiStatus = useStore((s) => s.ui.aiStatus);
  const aiDetail = useStore((s) => s.ui.aiDetail);
  const mode = useStore((s) => s.ui.captureMode);
  const projects = useStore((s) => s.projects);
  const [text, setText] = useState("");
  const inputRef = useRef(null);

  const parsed = useMemo(
    () => (mode === "task" && text.trim() ? parseQuickAdd(text, { projects }) : null),
    [text, mode, projects]
  );
  const grammarActive = !!(parsed && parsed.chips.length);

  useEffect(() => {
    if (!autoRegister) return;
    setCaptureFocus(() => inputRef.current?.focus());
    return () => setCaptureFocus(null);
  }, [autoRegister]);

  const current = MODES.find((m) => m.id === mode) || MODES[0];

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    setText("");
    if (mode === "project") {
      captureProject(v);
      return;
    }
    const task = captureTask(v, { mode, scheduleToday, parsed });
    if (!task) return;
    enrichCapturedTask(task.id, grammarActive ? parsed.title : v, mode, {
      grammarUsed: grammarActive,
      hasHours: !!parsed?.hours,
    });
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div className="kz-note">
        <span className="kz-note-brush" aria-hidden />
        <input ref={inputRef} value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            else if (e.key === "Escape") { setText(""); inputRef.current?.blur(); }
          }}
          placeholder={current.placeholder}
          aria-label="Mark a waypoint"
          autoComplete="off" />
        <div className="kz-note-modes" role="group" aria-label="Note type">
          {MODES.map((m) => (
            <button key={m.id} type="button" className={mode === m.id ? "on" : ""}
              aria-pressed={mode === m.id}
              onClick={() => { setUI({ captureMode: m.id }); inputRef.current?.focus(); }}>
              {m.label}
            </button>
          ))}
        </div>
        <span className="kz-label" style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
          <Kbd>N</Kbd> here <Kbd>↵</Kbd> mark
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Lamp status={aiStatus} detail={aiDetail} />
          <button type="button" className="kz-icon-btn"
            onClick={() => setUI({ formOpen: true, editingTaskId: null })}
            title="The long form (Shift+N)" aria-label="Open the full task form">
            <Icon name="edit" size={12} />
          </button>
        </span>
      </div>

      {grammarActive && (
        <div className="kz-note-chips kz-fade-in">
          <span style={{ fontSize: 11.5, color: "var(--fg)", fontWeight: 500, maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {parsed.title || "(unnamed)"}
          </span>
          {parsed.chips.map((c, i) => (
            <span key={i} className="kz-seal" style={{ color: CHIP_TONE[c.type] || "var(--fg-dim)", borderColor: CHIP_TONE[c.type] || "var(--line)" }}>{c.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
