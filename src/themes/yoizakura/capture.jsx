// capture.jsx — washi entry strip. Sacred sequence on Enter is
// verbatim from the core contract. N focuses via setCaptureFocus.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Kbd } from "./components.jsx";
import { parseQuickAdd } from "../../core/domain.js";
import { useStore, captureTask, setUI } from "../../core/store.js";
import { enrichCapturedTask, captureProject } from "../../core/enrich.js";
import { setCaptureFocus } from "../../core/keys.js";

const CHIP_TONE = {
  priority: "var(--port)", tag: "var(--sumi-dim)", project: "var(--channel)",
  hours: "var(--amber-deep)", date: "var(--starboard)", deadline: "var(--warn)",
  recurring: "var(--channel)",
};

const MODES = [
  { id: "task", label: "Task", placeholder: "Add a task… (!urgent #tag @list 2h fri)" },
  { id: "subtasks", label: "Steps", placeholder: "Describe a multi-step task — the Attendant adds the steps" },
  { id: "project", label: "List", placeholder: "Name a list — the Attendant drafts its tasks" },
];

export function CaptureStrip({ scheduleToday = false, autoRegister = true }) {
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
    if (task) {
      enrichCapturedTask(task.id, grammarActive ? parsed.title : v, mode, {
        grammarUsed: grammarActive,
        hasHours: !!parsed?.hours,
      });
    }
  };

  return (
    <div className="yz-capture-wrap">
      <div className="yz-capture">
        <span className="yz-capture-caret" aria-hidden />
        <input ref={inputRef} value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            else if (e.key === "Escape") { setText(""); inputRef.current?.blur(); }
          }}
          placeholder={current.placeholder}
          aria-label="Capture a task"
          autoComplete="off" />
        <div className="yz-modes" role="group" aria-label="Capture type">
          {MODES.map((m) => (
            <button key={m.id} type="button"
              className={"yz-mode" + (mode === m.id ? " is-on" : "")}
              aria-pressed={mode === m.id}
              onClick={() => { setUI({ captureMode: m.id }); inputRef.current?.focus(); }}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="yz-capture-hint">
          <Kbd>N</Kbd>
          <button type="button" className="yz-icon-btn" onClick={() => setUI({ formOpen: true, editingTaskId: null })}
            title="Full form (Shift+N)" aria-label="Open full task form">
            <Icon name="edit" size={12} />
          </button>
        </div>
      </div>

      {grammarActive && (
        <div className="yz-capture-chips fade-in">
          <span style={{ fontSize: 12, color: "var(--sumi)", fontWeight: 500, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {parsed.title || "(untitled)"}
          </span>
          {parsed.chips.map((c, i) => (
            <span key={i} className="yz-stamp yz-stamp--syntax" style={{ color: CHIP_TONE[c.type] || "var(--sumi-dim)", borderColor: CHIP_TONE[c.type] || "var(--washi-line)" }}>{c.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
