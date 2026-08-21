// focus.jsx — the Night garden (DESIGN.md §5.5).
// TIMER LOGIC VERBATIM from nightwatch/views/focus.jsx: elapsed seeds
// from today's focusMs, 250ms tick, saveFocusTime every 5s AND on
// pause/unmount, logSession delta ≥60s once on unmount, local key
// listener with input-tag guard. Composition is a dusk clearing: giant
// Shippori Mincho timer beside the shishi-odoshi, washi controls, a
// stone for what's up next.

import React, { useEffect, useRef, useState } from "react";
import { Icon, Kbd } from "../components.jsx";
import { ShishiOdoshi } from "../garden.jsx";
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

  const estMs = D.taskHours(task) * 3600000;
  const pct = estMs > 0 ? (elapsed / estMs) * 100 : 0;
  const diff = D.DIFFICULTY[task.difficulty] || D.DIFFICULTY.medium;

  return (
    <div className="yz-overlay yzt-night" role="dialog" aria-label="Night garden">
      <div className="yzt-night-moon" aria-hidden>
        <i className="yzt-night-moon-halo" />
        <i className="yzt-night-moon-disc" />
        <i className="yzt-night-moon-cloud" />
      </div>
      <div className="yzt-night-top">
        <button type="button" className="yz-btn yz-btn--dusk" onClick={() => setUI({ focusTaskId: null })}>
          <Icon name="close" size={13} /> Exit <Kbd>Esc</Kbd>
        </button>
        <span className="yz-sec yz-sec--dusk">{running ? "Tending" : "Paused"}</span>
        {nextTask ? (
          <button type="button" className="yz-btn yz-btn--dusk yz-btn--sm" onClick={() => setUI({ focusTaskId: nextId })}>
            Skip <Icon name="chevronR" size={12} />
          </button>
        ) : <span />}
      </div>

      <div className="yzt-night-stage">
        <div className="yzt-night-clock">
          <div className="yzt-night-meta">
            {project && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <i className="yz-dot" style={{ background: project.color || "var(--amber)" }} />
                {project.title}
              </span>
            )}
            <span>{diff.label}</span>
            <span>~{D.taskHours(task)}h</span>
          </div>
          <h1 className="yz-display yzt-night-title">{task.title}</h1>
          <div className="yzt-night-timer">{timeStr}</div>
        </div>
        <div className="yzt-shishi-lg">
          <div className="yzt-tsukubai" aria-hidden>
            <i className="yzt-tsukubai-stone" />
            <i className="yzt-tsukubai-pool" />
          </div>
          <ShishiOdoshi pct={pct} className="yz-shishi--lg" />
        </div>
      </div>

      <div className="yzt-night-controls">
        <button type="button" className="yz-btn yz-btn--gold" onClick={() => setRunning((r) => !r)} style={{ minWidth: 140 }}>
          {running ? "Pause" : "Resume"} <Kbd>Space</Kbd>
        </button>
        <button type="button" className="yz-btn yz-btn--dusk" disabled={elapsed === 0}
          onClick={() => { baseRef.current = 0; startRef.current = Date.now(); setElapsed(0); saveFocusTime(taskId, 0); }}>
          <Icon name="reset" size={13} /> Reset
        </button>
        <button type="button" className="yz-btn yz-btn--leaf" onClick={complete}>
          <Icon name="check" size={13} /> Complete
        </button>
      </div>

      {nextTask && (
        <button type="button" className="yzt-stone fade-in" onClick={() => setUI({ focusTaskId: nextId })}>
          <span className="yz-sec yz-sec--dusk">Up next</span>
          <span className="yzt-stone-title">{nextTask.title}</span>
        </button>
      )}
    </div>
  );
}
