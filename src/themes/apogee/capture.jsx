// capture.jsx — MANIFEST INTAKE: block caret, mode chips, COMMS lamp.
// Sacred Enter sequence lifted from nightwatch; Apogee chassis only.

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
  { id: "task", label: "PAYLOAD", placeholder: "manifest a payload... (!urgent #tag @vehicle 2h fri)" },
  { id: "subtasks", label: "SEQUENCE", placeholder: "describe a multi-step sequence — GUIDANCE drafts the steps" },
  { id: "project", label: "VEHICLE", placeholder: "name a vehicle — GUIDANCE drafts its payloads" },
];

export function CaptureBar({ scheduleToday = false }) {
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
    setCaptureFocus(() => inputRef.current && inputRef.current.focus());
    return () => setCaptureFocus(null);
  }, []);

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
      hasHours: !!(parsed && parsed.hours),
    });
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div className="ap-intake">
        {/* gap: .ap-intake has no block-caret glyph; signal block stands in */}
        <span
          aria-hidden
          style={{
            width: 7,
            height: "1em",
            background: "var(--signal)",
            flexShrink: 0,
            display: "inline-block",
          }}
        />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            else if (e.key === "Escape") {
              setText("");
              inputRef.current && inputRef.current.blur();
            }
          }}
          placeholder={current.placeholder}
          aria-label="Manifest a payload"
          autoComplete="off"
        />
        <div role="group" aria-label="Capture type" style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={"ap-chip" + (mode === m.id ? " ap-chip--on" : "")}
              aria-pressed={mode === m.id}
              onClick={() => {
                setUI({ captureMode: m.id });
                inputRef.current && inputRef.current.focus();
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div
          className="ap-num"
          style={{ fontSize: 9, color: "var(--fg-faint)", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}
        >
          <Kbd>N</Kbd>
          <span>FOCUS</span>
          <Kbd>↵</Kbd>
          <span>MANIFEST</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
          <Lamp status={aiStatus} detail={aiDetail} />
          <button
            type="button"
            className="ap-icon-btn"
            onClick={() => setUI({ formOpen: true, editingTaskId: null })}
            title="Full form (Shift+N)"
            aria-label="Open full payload form"
          >
            <Icon name="edit" size={12} />
          </button>
        </div>
      </div>

      {grammarActive && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 6, padding: "0 2px" }}>
          <span
            style={{
              fontSize: 11,
              color: "var(--fg)",
              fontWeight: 500,
              maxWidth: 240,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {parsed.title || "(untitled)"}
          </span>
          {parsed.chips.map((c, i) => (
            <span
              key={i}
              className="ap-chip"
              style={{
                color: CHIP_TONE[c.type] || "var(--fg-dim)",
                borderColor: CHIP_TONE[c.type] || "var(--line)",
              }}
            >
              {c.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
