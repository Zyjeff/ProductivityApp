// Verdant presentation. State and mutations use the shared core contract.
import React, { useEffect, useRef, useState } from "react";
import { Icon, Kbd } from "../components.jsx";
import { Shrine, Glyph, PixelText, Sprite, RuneRule } from "../art.jsx";
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
    const current = baseRef.current + (startRef.current == null ? 0 : Date.now() - startRef.current);
    logSession(taskId, Math.max(0, current - sessionSeedRef.current));
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
      startRef.current = null;
      latestRef.current = cur;
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

  return <div className="tunnel e-focus" role="dialog" aria-label="Focus mode" aria-modal="true"><header><span className="e-focus-brand"><Sprite kind="crystal" size={26}/><PixelText size={12}>VERDANT ENCHANTED</PixelText></span><button className="bezel" onClick={()=>setUI({focusTaskId:null})}>Return to workspace <Kbd>Esc</Kbd></button></header><div className="e-focus-content"><span className="e-eyebrow">{running?'THE RITUAL OF ATTENTION':'THE RITUAL IS PAUSED'}</span><h1>{task.title}</h1><p>{project?.title||'Personal intention'} · {task.difficulty} · ~{D.taskHours(task)}h estimated</p><div className="e-focus-time"><span className="tunnel-timer"><span className="e-sr-only">{timeStr}</span><PixelText size={58}>{timeStr}</PixelText></span><small>{running?'FOCUSING':'PAUSED'}</small></div><Shrine active={running} pct={Math.min(100,elapsed/(D.taskHours(task)*3600000)*100)}/><div className="e-focus-transport"><button className="bezel" onClick={()=>setRunning(r=>!r)}><Icon name={running?'pause':'focus'} size={12}/>{running?'Pause':'Resume'} <Kbd>Space</Kbd></button><button className="icon-btn" title="Reset timer" aria-label="Reset timer" disabled={elapsed===0} onClick={()=>{const current=baseRef.current+(startRef.current==null?0:Date.now()-startRef.current);logSession(taskId,Math.max(0,current-sessionSeedRef.current));sessionSeedRef.current=0;baseRef.current=0;latestRef.current=0;startRef.current=running?Date.now():null;setElapsed(0);saveFocusTime(taskId,0);}}><Icon name="reset"/></button><button className="switch" onClick={complete}><Icon name="check" size={13}/> Mark complete</button></div></div><footer><span>One intention. Nothing else.</span>{nextTask&&<button onClick={()=>setUI({focusTaskId:nextId})}><span>UP NEXT</span>{nextTask.title}<span>Skip ↗</span></button>}</footer></div>;
}
