// capture.jsx — the lock entrance, Sluis cut: a floating pill at the
// chamber mouth. Gate glyph, mode toggles (Vaartuig/Lading/Schip) as
// pick chips, live grammar chips moored below. Enter saves in the same
// tick; AI enriches after. Logic identical to the core contract —
// only the hull differs from Nightwatch.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Kbd, Chip, ChipPick } from "./components.jsx";
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
  { id: "task", label: "Vaartuig", placeholder: "Meld een vaartuig aan… (!urgent #tag @schip 2h fri)", title: "Vaartuig — one task, saved instantly" },
  { id: "subtasks", label: "Lading", placeholder: "Beschrijf de lading — AI zet de stappen klaar", title: "Lading — AI adds the steps" },
  { id: "project", label: "Schip", placeholder: "Leg een schip aan — AI ontwerpt de taken", title: "Schip — AI drafts its tasks, it gets a berth" },
];

export function CaptureSlab({ scheduleToday = false, autoRegister = true }) {
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
    if (task) enrichCapturedTask(task.id, grammarActive ? parsed.title : v, mode, { grammarUsed: grammarActive, hasHours: !!parsed?.hours });
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div className="s-capture">
        <span style={{ color: "var(--water)", display: "inline-flex", flexShrink: 0 }} aria-hidden>
          <Icon name="gate" size={16} />
        </span>
        <input ref={inputRef} value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            else if (e.key === "Escape") { setText(""); inputRef.current?.blur(); }
          }}
          placeholder={current.placeholder}
          aria-label="Vaartuig aanmelden"
          autoComplete="off" />
        <div role="group" aria-label="Capture type" style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {MODES.map((m) => (
            <ChipPick key={m.id} active={mode === m.id} title={m.title}
              onClick={() => { setUI({ captureMode: m.id }); inputRef.current?.focus(); }}>
              {m.label}
            </ChipPick>
          ))}
        </div>
        <span style={{ flexShrink: 0 }} title="Focus capture"><Kbd>N</Kbd></span>
        <button type="button" className="s-icon-btn" style={{ flexShrink: 0 }}
          onClick={() => setUI({ formOpen: true, editingTaskId: null })}
          title="Full form (Shift+N)" aria-label="Open full task form">
          <Icon name="plus" />
        </button>
      </div>

      {grammarActive && (
        <div className="s-capture-chips s-fade-in">
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--fg)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", alignSelf: "center" }}>
            {parsed.title || "(naamloos)"}
          </span>
          {parsed.chips.map((c, i) => (
            <Chip key={i} tone={CHIP_TONE[c.type]}>{c.label}</Chip>
          ))}
        </div>
      )}
    </div>
  );
}
