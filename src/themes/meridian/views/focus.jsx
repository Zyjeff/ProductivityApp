// focus.jsx — the night tunnel: one task, the clock, the sea at the
// bottom of the screen. Timer chaining and the session ledger behave
// identically to the core contract.

import React, { useEffect, useRef, useState } from "react";
import { Icon, Kbd } from "../components.jsx";
import { Horizon } from "../chrome.jsx";
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

export function FocusTunnel() {
  const focusTaskId = useStore((s) => s.ui.focusTaskId);
  if (!focusTaskId) return null;
  return <Tunnel key={focusTaskId} taskId={focusTaskId} />;
}

function Tunnel({ taskId }) {
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

  return (
    <div className="tunnel" role="dialog" aria-label="Focus mode">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 28px" }}>
        <button className="bezel" onClick={() => setUI({ focusTaskId: null })}>
          <Icon name="close" size={14} /> Exit <Kbd>Esc</Kbd>
        </button>
        <span className="w-stencil">{running ? "On watch" : "Paused"}</span>
        {nextTask ? (
          <button className="bezel bezel--sm" onClick={() => setUI({ focusTaskId: nextId })}>
            Skip <Icon name="chevronR" size={12} />
          </button>
        ) : <span />}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, color: "var(--fg-dim)", fontSize: 13 }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--amber)", boxShadow: "0 0 16px 2px rgba(245,165,36,0.35)" }} />
          {project && <><span style={{ color: project.color }}>{project.title}</span><span style={{ color: "var(--fg-faint)" }}>·</span></>}
          <span className="w-stencil">{task.difficulty} · ~{D.taskHours(task)}h</span>
        </div>
        <h1 className="w-display tunnel-title">{task.title}</h1>
        <div className="tunnel-timer">{timeStr}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 4, alignItems: "center" }}>
          <button className="bezel" onClick={() => setRunning((r) => !r)} style={{ minWidth: 130 }}>
            {running ? "Pause" : "Resume"} <Kbd>Space</Kbd>
          </button>
          <button className="bezel" disabled={elapsed === 0}
            onClick={() => { baseRef.current = 0; startRef.current = Date.now(); setElapsed(0); saveFocusTime(taskId, 0); }}>
            <Icon name="reset" size={13} /> Reset
          </button>
          <button className="switch switch--launch" onClick={complete}>
            <Icon name="check" size={13} /> Mark complete
          </button>
        </div>
        {nextTask && (
          <div className="fade-in" style={{ background: "var(--plate)", boxShadow: "inset 0 1px 0 var(--line)", padding: "12px 18px", minWidth: 280, textAlign: "left" }}>
            <div className="w-stencil" style={{ marginBottom: 4 }}>Up next</div>
            <div style={{ fontSize: 13, color: "var(--fg)" }}>{nextTask.title}</div>
          </div>
        )}
      </div>
      <div style={{ opacity: 0.55 }}>
        <Horizon height={90} />
      </div>
    </div>
  );
}
