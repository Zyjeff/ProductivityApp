// capture.jsx — the command slab. Full-width well under the view
// header; Enter saves locally in the same tick, AI enriches after.
// Logic identical to the previous version — presentation only.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Kbd, AiDot } from "./components.jsx";
import { parseQuickAdd } from "../../core/domain.js";
import { useStore, captureTask, setUI, notify } from "../../core/store.js";
import { enrichCapturedTask, captureProject } from "../../core/enrich.js";
import { setCaptureFocus } from "../../core/keys.js";

const CHIP_TONE = {
  priority: "var(--port)", tag: "var(--fg-dim)", project: "var(--channel)",
  hours: "var(--amber-hot)", date: "var(--starboard)", deadline: "var(--warn)",
  recurring: "var(--channel)",
};

const MODES = [
  { id: "task", label: "Task", sub: "single action item", placeholder: "Capture — saved instantly · !prio #tag @project 2h fri…" },
  { id: "subtasks", label: "Steps", sub: "task with concrete steps", placeholder: "Describe a multi-step task — AI adds the steps" },
  { id: "project", label: "Project", sub: "multi-task initiative", placeholder: "Describe a project — AI drafts its tasks" },
];

export function CaptureBar({ scheduleToday = false, autoRegister = true }) {
  const aiStatus = useStore((s) => s.ui.aiStatus);
  const aiDetail = useStore((s) => s.ui.aiDetail);
  const mode = useStore((s) => s.ui.captureMode);
  const projects = useStore((s) => s.projects);
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef(null);
  const wrapRef = useRef(null);

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

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false); };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [menuOpen]);

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
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <div className="w-well" style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
        <button type="button" onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="listbox" aria-expanded={menuOpen} title="Capture mode"
          className="w-stencil"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "0 12px", border: "none", cursor: "pointer",
            background: menuOpen ? "var(--amber)" : "var(--plate-hi)",
            color: menuOpen ? "var(--ink)" : "var(--fg-dim)",
            flexShrink: 0, letterSpacing: "0.18em",
          }}>
          {current.label}
          <Icon name="chevron" size={9} />
        </button>
        <input ref={inputRef} value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            else if (e.key === "Escape") { setText(""); inputRef.current?.blur(); }
          }}
          placeholder={current.placeholder}
          aria-label="Capture a task"
          style={{ height: 40 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 12px", flexShrink: 0 }}>
          <AiDot status={aiStatus} detail={aiDetail} />
          <button type="button" className="w-icon-btn" onClick={() => setUI({ formOpen: true, editingTaskId: null })}
            title="Full form (Shift+N)" aria-label="Open full task form" style={{ padding: 2 }}><Icon name="edit" size={12} /></button>
          <Kbd>N</Kbd>
        </div>
      </div>

      {grammarActive && !menuOpen && (
        <div className="w-fade-in" style={{
          position: "absolute", top: "100%", left: 0, zIndex: 49,
          display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap",
          background: "var(--plate-hi)", boxShadow: "inset 0 1px 0 var(--line), 0 0 0 1px var(--ground)",
          padding: "5px 9px", maxWidth: "100%",
        }}>
          <span style={{ fontSize: 11, color: "var(--fg)", fontWeight: 500, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {parsed.title || "(untitled)"}
          </span>
          {parsed.chips.map((c, i) => (
            <span key={i} className="w-stamp w-stamp--lamp" style={{ color: CHIP_TONE[c.type] || "var(--fg-dim)" }}>{c.label}</span>
          ))}
        </div>
      )}

      {menuOpen && (
        <div role="listbox" className="w-fade-in" style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50, minWidth: 240,
          background: "var(--plate-hi)", boxShadow: "inset 0 1px 0 var(--line), 0 0 0 1px var(--ground)",
          padding: 4, display: "flex", flexDirection: "column", gap: 2,
        }}>
          {MODES.map((m) => (
            <button key={m.id} type="button" role="option" aria-selected={mode === m.id}
              onClick={() => { setUI({ captureMode: m.id }); setMenuOpen(false); inputRef.current?.focus(); }}
              style={{
                display: "flex", flexDirection: "column", gap: 2, textAlign: "left", cursor: "pointer",
                background: "transparent", border: "none", padding: "8px 10px",
                borderLeft: mode === m.id ? "3px solid var(--amber)" : "3px solid transparent",
                color: "var(--fg)",
              }}>
              <span className="w-stencil" style={{ color: mode === m.id ? "var(--amber)" : "var(--fg-dim)" }}>{m.label}</span>
              <span style={{ font: "400 11px var(--t-body)", color: "var(--fg-faint)" }}>{m.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
