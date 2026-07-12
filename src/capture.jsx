// capture.jsx — the instant capture bar. Enter saves LOCALLY in the same
// tick (raw title, deterministic score) and AI enrichment runs after,
// updating the row in place. The AI status dot tells the truth.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Kbd, AiDot } from "./components.jsx";
import { parseQuickAdd } from "./domain.js";
import { useStore, captureTask, setUI, notify } from "./store.js";
import { enrichCapturedTask, captureProject } from "./enrich.js";
import { setCaptureFocus } from "./keys.js";

const CHIP_TONE = {
  priority: "var(--port)", tag: "var(--text-muted)", project: "var(--channel)",
  hours: "var(--amber-strong)", date: "var(--starboard)", deadline: "var(--warning)",
  recurring: "var(--channel)",
};

const MODES = [
  { id: "task", label: "Task", sub: "single action item", placeholder: "Capture a task — saved instantly, AI tidies after" },
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

  // Live quick-add grammar preview (task mode only).
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
    setText("");                      // input frees IMMEDIATELY
    if (mode === "project") {
      captureProject(v);              // async; its own toasts
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
    <div className="w-capture-wrap" ref={wrapRef}>
      <div className="w-capture">
        <button type="button" className="w-capture-mode" onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="listbox" aria-expanded={menuOpen} title="Capture mode">
          {current.label}
          <Icon name="chevron" size={10} />
        </button>
        <input ref={inputRef} value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            else if (e.key === "Escape") { setText(""); inputRef.current?.blur(); }
          }}
          placeholder={current.placeholder}
          aria-label="Capture a task" />
        <AiDot status={aiStatus} detail={aiDetail} />
        <button type="button" className="w-icon-btn" onClick={() => setUI({ formOpen: true, editingTaskId: null })}
          title="Full form (Shift+N)" aria-label="Open full task form"><Icon name="edit" size={13} /></button>
        <Kbd>N</Kbd>
      </div>
      {grammarActive && !menuOpen && (
        <div className="w-fade-in" style={{
          position: "absolute", top: "calc(100% + 5px)", left: 0, zIndex: 49,
          display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap",
          background: "var(--bg-elev)", border: "1px solid var(--border-strong)",
          borderRadius: "var(--r-md)", padding: "5px 8px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
        }}>
          <span style={{ fontSize: 11, color: "var(--text)", fontWeight: 500, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {parsed.title || "(untitled)"}
          </span>
          {parsed.chips.map((c, i) => (
            <span key={i} style={{
              fontSize: 10, fontFamily: "var(--font-mono)", padding: "1px 6px",
              borderRadius: 3, border: `1px solid ${CHIP_TONE[c.type] || "var(--border)"}`,
              color: CHIP_TONE[c.type] || "var(--text-muted)",
            }}>{c.label}</span>
          ))}
        </div>
      )}
      {menuOpen && (
        <div className="w-capture-menu" role="listbox">
          {MODES.map((m) => (
            <button key={m.id} type="button" role="option" aria-selected={mode === m.id}
              className={mode === m.id ? "is-active" : ""}
              onClick={() => { setUI({ captureMode: m.id }); setMenuOpen(false); inputRef.current?.focus(); }}>
              <span>{m.label}</span>
              <span className="w-capture-menu-sub">{m.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
