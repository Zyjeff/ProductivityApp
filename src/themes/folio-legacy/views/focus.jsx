// focus.jsx — the focus tunnel. Ported, with the chaining fixed: "up
// next" reads today's actual lineup (recurring + scheduled chunks),
// which the old app's dead `taskIds` read never did.

import React, { useEffect, useRef, useState } from "react";
import { FocusDial, PressMark } from "../print.jsx";
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
  // Session ledger (F4): whatever this tunnel visit adds beyond the
  // seed gets logged once, on unmount (covers complete/skip/exit).
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

  return <div className="w-focus-overlay" role="dialog" aria-modal="true" aria-label="Focus mode">
    <header className="f-focus-head"><button className="w-bezel" onClick={()=>setUI({focusTaskId:null})}>← Leave the press room <Kbd>Esc</Kbd></button><span className="f-kicker"><PressMark size={20}/> FOLIO / THE PRESS ROOM</span>{nextTask&&<button className="w-link" onClick={()=>setUI({focusTaskId:nextId})}>Skip task →</button>}</header>
    <div className="f-focus-stage"><div className="f-kicker">{project?project.title+' / ':''}{task.difficulty} · ~{D.taskHours(task)}h estimated</div><h1 className="w-focus-title">{task.title}</h1><FocusDial elapsed={elapsed} hours={D.taskHours(task)} time={timeStr} running={running}/><div className="f-focus-controls"><button className="w-bezel" onClick={()=>setRunning(r=>!r)}>{running?'Pause':'Resume'} <Kbd>Space</Kbd></button><button className="w-bezel" disabled={elapsed===0} onClick={()=>{baseRef.current=0;startRef.current=Date.now();setElapsed(0);saveFocusTime(taskId,0);}}>Reset</button><button className="w-switch" onClick={complete}>Make your impression <Icon name="check"/></button></div></div>
    <footer className="f-focus-foot"><span>THE REST CAN WAIT.</span>{nextTask&&<span>UP NEXT <b>{nextTask.title}</b></span>}<PressMark size={22}/></footer>
  </div>;
}
