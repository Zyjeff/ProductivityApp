// focus.jsx — Deep Cycle tunnel. Timer logic identical to core contract.

import React, { useEffect, useRef, useState } from "react";
import { Icon, Kbd } from "../components.jsx";
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

  const estMs = (D.taskHours(task) || 1) * 3600000;
  const pct = Math.min(100, (elapsed / estMs) * 100);
  const C = 2 * Math.PI * 96;
  const dash = (pct / 100) * C;

  return (
    <div className="r-tunnel" role="dialog" aria-label="Deep cycle">
      <div style={{ position: "absolute", top: 18, left: 28, right: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button className="r-btn r-btn--ghost" onClick={() => setUI({ focusTaskId: null })}>
          <Icon name="close" size={14} /> Exit <Kbd>Esc</Kbd>
        </button>
        <span className="r-lab">{running ? "In cycle" : "Paused"}</span>
        {nextTask ? (
          <button className="r-btn r-btn--ghost r-btn--sm" onClick={() => setUI({ focusTaskId: nextId })}>
            Skip <Icon name="chevronR" size={12} />
          </button>
        ) : <span />}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, color: "var(--fg-dim)", fontSize: 13 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: running ? "var(--lime)" : "var(--fg-faint)", boxShadow: running ? "0 0 12px var(--lime)" : "none" }} />
        {project && <><span style={{ color: project.color }}>{project.title}</span><span style={{ color: "var(--fg-faint)" }}>·</span></>}
        <span className="r-lab">{task.difficulty} · ~{D.taskHours(task)}h</span>
      </div>

      <h1 className="r-display" style={{ fontSize: 28, textAlign: "center", maxWidth: 520, margin: 0 }}>{task.title}</h1>

      <div className="r-cycle-rings">
        <svg viewBox="0 0 220 220" aria-hidden>
          <circle cx="110" cy="110" r="96" fill="none" stroke="var(--line-strong)" strokeWidth="6" />
          <circle cx="110" cy="110" r="96" fill="none" stroke="url(#r-spec)" strokeWidth="6"
            strokeDasharray={`${dash} ${C}`} strokeLinecap="round" transform="rotate(-90 110 110)" />
          <defs>
            <linearGradient id="r-spec" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff4d3a" />
              <stop offset="50%" stopColor="#5b6cff" />
              <stop offset="100%" stopColor="#b6ff3c" />
            </linearGradient>
          </defs>
        </svg>
        <div className="r-cycle-time">
          <div className="r-display r-num" style={{ fontSize: 42 }}>{timeStr}</div>
          <div className="r-lab">of ~{D.taskHours(task)}h target</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        <button className="r-btn r-btn--ghost" onClick={() => setRunning((r) => !r)} style={{ minWidth: 130 }}>
          {running ? "Pause" : "Resume"} <Kbd>Space</Kbd>
        </button>
        <button className="r-btn r-btn--ghost" disabled={elapsed === 0}
          onClick={() => { baseRef.current = 0; startRef.current = Date.now(); setElapsed(0); saveFocusTime(taskId, 0); }}>
          <Icon name="reset" size={13} /> Reset
        </button>
        <button className="r-btn r-btn--lime" onClick={complete}>
          <Icon name="check" size={13} /> Resolve
        </button>
      </div>

      {nextTask && (
        <div className="r-glass fade-in" style={{ minWidth: 280 }}>
          <div className="r-lab" style={{ marginBottom: 4 }}>Next packet</div>
          <div style={{ fontSize: 13 }}>{nextTask.title}</div>
        </div>
      )}
    </div>
  );
}
