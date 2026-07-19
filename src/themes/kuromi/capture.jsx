import React, { useEffect, useMemo, useRef, useState } from "react";
import { captureTask, useStore, setUI } from "../../core/store.js";
import { enrichCapturedTask, captureProject } from "../../core/enrich.js";
import { parseQuickAdd } from "../../core/domain.js";
import { setCaptureFocus } from "../../core/keys.js";
import { Kbd } from "./components.jsx";

/* ══════════════════════════════════════════════════════════════
   Capture slab — "whisper a scheme into the handheld."
   task     → SCHEME   (grammar-parsed, chips echo live)
   subtasks → STEPS    (lines become subtasks of the on-deck task…
                        core semantics: captureTask handles mode)
   project  → BIG SCORE (a boss fight)
   ══════════════════════════════════════════════════════════════ */

const MODES = [
  { id: "task", label: "SCHEME" },
  { id: "subtasks", label: "STEPS" },
  { id: "project", label: "BIG SCORE" },
];

export function CaptureSlab({ scheduleToday = false, autoFocus = false, placeholder }) {
  const captureMode = useStore((s) => s.ui.captureMode) || "task";
  const projects = useStore((s) => s.projects);
  const [v, setV] = useState("");
  const inputRef = useRef(null);

  // mandatory: the `n` key focuses this input (fallback: full form)
  useEffect(() => {
    setCaptureFocus(() => inputRef.current?.focus());
    return () => setCaptureFocus(null);
  }, []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const parsed = useMemo(() => {
    if (captureMode !== "task" || !v.trim()) return null;
    try {
      return parseQuickAdd(v, { projects });
    } catch {
      return null;
    }
  }, [v, captureMode, projects]);

  const grammarActive = !!(parsed && parsed.chips && parsed.chips.length);

  const submit = () => {
    const val = v.trim();
    if (!val) return;
    if (captureMode === "project") {
      captureProject(val);
    } else {
      const task = captureTask(val, { mode: captureMode, scheduleToday, parsed });
      if (task) {
        enrichCapturedTask(task.id, grammarActive ? parsed.title : val, captureMode, {
          grammarUsed: grammarActive,
          hasHours: !!parsed?.hours,
        });
      }
    }
    setV("");
    inputRef.current?.focus();
  };

  const hint =
    captureMode === "project"
      ? "name the big score — a new boss fight appears in the dock"
      : captureMode === "subtasks"
        ? "each line becomes a step of the scheme"
        : "try: fix the rig !urgent #client 2h fri";

  return (
    <div className="k-slab">
      <div className="k-slab-types">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={captureMode === m.id ? "is-on" : ""}
            onClick={() => setUI({ captureMode: m.id })}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="k-slab-inputrow">
        <span className="k-slab-caret">▸</span>
        <input
          ref={inputRef}
          value={v}
          placeholder={placeholder || "plot something devious…"}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
      </div>
      {grammarActive && (
        <div className="k-chips">
          {parsed.chips.map((c, i) => (
            <span key={i} className="k-chip-echo">{c.label}</span>
          ))}
        </div>
      )}
      <div className="k-slab-hint">
        <Kbd>N</Kbd>
        <span>{hint}</span>
      </div>
    </div>
  );
}
