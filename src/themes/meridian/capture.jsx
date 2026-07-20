// capture.jsx — the command slab, Nightwatch cut: block caret, inline
// type toggles, "N FOCUS · ↵ STOW" hints. Enter saves locally in the
// same tick; AI enriches after. Logic identical to the core contract —
// only the chassis differs from Drydock.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Kbd, Lamp } from "./components.jsx";
import { parseQuickAdd } from "../../core/domain.js";
import { useStore, captureTask, setUI } from "../../core/store.js";
import { enrichCapturedTask, captureProject } from "../../core/enrich.js";
import { setCaptureFocus } from "../../core/keys.js";

const CHIP_TONE = {
  priority: "var(--port)", tag: "var(--fg-dim)", project: "var(--channel)",
  hours: "var(--amber-hot)", date: "var(--starboard)", deadline: "var(--warn)",
  recurring: "var(--channel)",
};

const MODES = [
  { id: "task", label: "Task", placeholder: "Capture — saved instantly · !prio #tag @project 2h fri…" },
  { id: "subtasks", label: "Steps", placeholder: "Describe a multi-step task — AI adds the steps" },
  { id: "project", label: "Project", placeholder: "Found a project — AI drafts its tasks, it gets a berth" },
];

export function CaptureSlab({ scheduleToday = false, autoRegister = true }) {
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
      <div className="slab">
        <span className="slab-caret" aria-hidden />
        <input ref={inputRef} value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            else if (e.key === "Escape") { setText(""); inputRef.current?.blur(); }
          }}
          placeholder={current.placeholder}
          aria-label="Capture a task"
          autoComplete="off" />
        <div className="slab-types" role="group" aria-label="Capture type">
          {MODES.map((m) => (
            <button key={m.id} type="button" className={mode === m.id ? "on" : ""}
              aria-pressed={mode === m.id}
              onClick={() => { setUI({ captureMode: m.id }); inputRef.current?.focus(); }}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="slab-hint w-num" style={{ fontSize: 9, color: "var(--fg-faint)", flexShrink: 0 }}>
          <Kbd>N</Kbd><span style={{ marginLeft: 2 }}>FOCUS</span>
          <Kbd>↵</Kbd><span style={{ marginLeft: 2 }}>STOW</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
          <Lamp status={aiStatus} detail={aiDetail} />
          <button type="button" className="icon-btn" onClick={() => setUI({ formOpen: true, editingTaskId: null })}
            title="Full form (Shift+N)" aria-label="Open full task form" style={{ padding: 2 }}><Icon name="edit" size={12} /></button>
        </div>
      </div>

      {grammarActive && (
        <div className="slab-chips fade-in">
          <span style={{ fontSize: 11, color: "var(--fg)", fontWeight: 500, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {parsed.title || "(untitled)"}
          </span>
          {parsed.chips.map((c, i) => (
            <span key={i} className="stamp" style={{ color: CHIP_TONE[c.type] || "var(--fg-dim)", borderColor: CHIP_TONE[c.type] || "var(--line)" }}>{c.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
