// focus.jsx — Meditation. The ink-wash vignette closes in, one lantern
// burns, and a single incense stick burns down against the REAL
// session timer (elapsed ÷ this task's estimate). Timer chaining and
// the session ledger behave exactly as the core contract.

import React, { useEffect, useRef, useState } from "react";
import { Icon, Kbd } from "../components.jsx";
import { Incense } from "../charts.jsx";
import * as D from "../../../core/domain.js";
import { useStore, getState, setUI, setCompletion, saveFocusTime, logSession, todayLineup } from "../../../core/store.js";

function effectiveFocusMs(t, hour) {
  if (!t?.focusMs || !t.focusDate) return 0;
  if (t.focusDate !== D.effectiveTodayIso(hour)) return 0;
  return t.focusMs;
}

function nextFocusId(s, currentId) {
  const rows = todayLineup(s).filter((r) => !r.doneHere && r.task.id !== currentId);
  return rows[0]?.task.id || null;
}

export function Meditation() {
  const focusTaskId = useStore((s) => s.ui.focusTaskId);
  if (!focusTaskId) return null;
  return <Sitting key={focusTaskId} taskId={focusTaskId} />;
}

function Sitting({ taskId }) {
  const s = getState();
  const task = s.tasks.find((t) => t.id === taskId);
  const hour = s.meta.dayStartHour || 0;
  const project = task?.projectId ? s.projects.find((p) => p.id === task.projectId) : null;
  const nextId = nextFocusId(s, taskId);
  const nextTask = nextId ? s.tasks.find((t) => t.id === nextId) : null;
  const todayIso = D.effectiveTodayIso(hour);
  const hasChunkToday = (s.plan || []).some((e) => e.date === todayIso && e.items.some((i) => i.taskId === taskId));

  const [running, setRunning] = useState(true);
  const [elapsed, setElapsed] = useState(() => effectiveFocusMs(task, hour));
  const baseRef = useRef(effectiveFocusMs(task, hour));
  const startRef = useRef(null);
  const sessionSeedRef = useRef(effectiveFocusMs(task, hour));
  const latestRef = useRef(effectiveFocusMs(task, hour));
  useEffect(() => { latestRef.current = elapsed; }, [elapsed]);
  useEffect(() => () => {
    logSession(taskId, latestRef.current - sessionSeedRef.current);
  }, [taskId]);

  useEffect(() => {
    if (!running || !task) return;
    startRef.current = Date.now();
    const tick = setInterval(() => setElapsed(baseRef.current + (Date.now() - startRef.current)), 250);
    const save = setInterval(() => saveFocusTime(taskId, baseRef.current + (Date.now() - startRef.current)), 5000);
    return () => {
      clearInterval(tick); clearInterval(save);
      const cur = baseRef.current + (Date.now() - startRef.current);
      baseRef.current = cur;
      saveFocusTime(taskId, cur);
    };
  }, [running, taskId]);

  useEffect(() => {
    const h = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "Escape") { e.preventDefault(); setUI({ focusTaskId: null }); }
      else if (e.key === " ") { e.preventDefault(); setRunning((r) => !r); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  if (!task) { setUI({ focusTaskId: null }); return null; }

  const complete = () => {
    const advance = nextFocusId(getState(), taskId);
    setCompletion(taskId, { done: true, chunkDate: hasChunkToday ? todayIso : null });
    setUI({ focusTaskId: advance });
  };

  const sec = Math.floor(elapsed / 1000);
  const p2 = (n) => String(n).padStart(2, "0");
  const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
  const timeStr = hh > 0 ? `${hh}:${p2(mm)}:${p2(ss)}` : `${p2(mm)}:${p2(ss)}`;

  // The incense burns against the real estimate for this task.
  const estMs = D.taskHours(task) * 3600000;
  const burned = Math.min(100, (elapsed / estMs) * 100);

  return (
    <div className="kz-medit" role="dialog" aria-label="Meditation">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 28px" }}>
        <button className="kz-btn" onClick={() => setUI({ focusTaskId: null })}>
          <Icon name="close" size={14} /> Rise <Kbd>Esc</Kbd>
        </button>
        <span className="kz-label">{running ? "sitting with it" : "still"}</span>
        {nextTask ? (
          <button className="kz-btn kz-btn--sm" onClick={() => setUI({ focusTaskId: nextId })}>
            Walk on <Icon name="chevronR" size={12} />
          </button>
        ) : <span />}
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 46, padding: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
          <Incense pct={burned} />
          <span className="kz-label" title={`${D.fmtMs(elapsed)} of a ~${D.taskHours(task)}h stretch`}>
            {burned >= 100 ? "burned through" : `${Math.round(burned)}% burned`}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, maxWidth: 700 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, color: "var(--fg-dim)", fontSize: 13, flexWrap: "wrap", justifyContent: "center" }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--amber)", boxShadow: "0 0 18px 3px var(--amber-deep)" }} />
            {project && <><span style={{ color: project.color }}>{project.title}</span><span style={{ color: "var(--fg-faint)" }}>·</span></>}
            <span className="kz-label">{task.difficulty} · ~{D.taskHours(task)}h</span>
          </div>
          <h1 className="kz-brush kz-medit-title">{task.title}</h1>
          <div className="kz-medit-timer">{timeStr}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 4, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <button className="kz-btn" onClick={() => setRunning((r) => !r)} style={{ minWidth: 128, justifyContent: "center" }}>
              {running ? "Be still" : "Go on"} <Kbd>Space</Kbd>
            </button>
            <button className="kz-btn" disabled={elapsed === 0}
              onClick={() => { baseRef.current = 0; startRef.current = Date.now(); setElapsed(0); saveFocusTime(taskId, 0); }}>
              <Icon name="reset" size={13} /> Begin again
            </button>
            <button className="kz-go kz-go--bloom" onClick={complete}>
              <Icon name="check" size={13} /> Reached it
            </button>
          </div>
          {nextTask && (
            <div className="kz-fade-in kz-card" style={{ padding: "12px 18px", minWidth: 280, textAlign: "left" }}>
              <div className="kz-label" style={{ marginBottom: 4 }}>Then the road turns to</div>
              <div style={{ fontSize: 13, color: "var(--fg)" }}>{nextTask.title}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
