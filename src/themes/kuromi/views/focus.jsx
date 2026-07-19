// focus.jsx — MISCHIEF MODE: one scheme, the clock, the imp watching
// from the bottom of the tunnel. Timer/session logic lifted verbatim
// from the shipped themes (core contract).

import React, { useEffect, useRef, useState } from "react";
import { Icon, Kbd } from "../components.jsx";
import { KuroVision } from "../chrome.jsx";
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
    <div className="k-tunnel" role="dialog" aria-label="Mischief mode">
      <div className="k-rowline" style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "18px 26px" }}>
        <button className="k-btn" onClick={() => setUI({ focusTaskId: null })}>
          <Icon name="x" size={11} /> SLINK OUT <Kbd>Esc</Kbd>
        </button>
        <span className="k-spacer" />
        <span className="k-mono-sm k-faint">{running ? "SCHEMING…" : "HELD"}</span>
        <span className="k-spacer" />
        {nextTask ? (
          <button className="k-btn is-sm" onClick={() => setUI({ focusTaskId: nextId })}>
            SKIP ▸
          </button>
        ) : <span style={{ width: 60 }} />}
      </div>

      <div className="k-rowline k-dim k-sm" style={{ gap: 12 }}>
        <span style={{ width: 11, height: 11, borderRadius: 2, background: "var(--amber)", boxShadow: "0 0 14px 2px rgba(255,77,158,0.45)" }} />
        {project && <><span style={{ color: project.color }}>BOSS: {project.title.toUpperCase()}</span><span className="k-faint">·</span></>}
        <span className="k-mono-sm k-faint">{task.difficulty} · ~{D.taskHours(task)}h</span>
      </div>

      <h1 className="k-display" style={{ fontSize: "clamp(15px, 2.6vw, 24px)", maxWidth: 720, lineHeight: 1.6 }}>{task.title}</h1>

      <div className="k-tunnel-time">{timeStr}</div>

      <div className="k-tunnel-acts">
        <button className="k-btn" onClick={() => setRunning((r) => !r)} style={{ minWidth: 140 }}>
          {running ? "HOLD IT" : "RESUME"} <Kbd>Space</Kbd>
        </button>
        <button
          className="k-btn" disabled={elapsed === 0}
          onClick={() => { baseRef.current = 0; startRef.current = Date.now(); setElapsed(0); saveFocusTime(taskId, 0); }}
        >
          <Icon name="rewind" size={11} /> RESET
        </button>
        <button className="k-btn is-green" onClick={complete}>
          <Icon name="check" size={12} /> PULLED IT OFF
        </button>
      </div>

      {nextTask && (
        <div className="k-plate k-plate-pad" style={{ minWidth: 300, textAlign: "left" }}>
          <div className="k-eyebrow" style={{ marginBottom: 5 }}>UP NEXT</div>
          <div className="k-dim" style={{ fontSize: 13.5 }}>{nextTask.title}</div>
        </div>
      )}

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 18px 14px", opacity: 0.75 }}>
        <KuroVision mood={running ? "work" : "bored"} height={118} caption={running ? "MISCHIEF MODE" : "HELD"} hud={[]} />
      </div>
    </div>
  );
}
