import React, { useEffect, useMemo, useState } from "react";
import { Icon, CompleteButton, EmptyState, PageHeader, ProgressBar, AiDot, Kbd, MOD } from "../components.jsx";
import * as D from "../../../core/domain.js";
import {
  useStore, setUI, setCompletion, setCaps, toggleDayLock,
  applyPlan, moveChunkDate, pinTaskToDate, notify, dismissChunk,
} from "../../../core/store.js";
import { aiPlan, aiReplan, aiFailureMessage } from "../../../core/ai.js";

import { registerActiveList } from "../../../core/keys.js";
export function PlanView() {
  useEffect(() => { registerActiveList("plan", []); }, []);
  const tasks = useStore((s) => s.tasks);
  const plan = useStore((s) => s.plan);
  const projects = useStore((s) => s.projects);
  const caps = useStore((s) => s.caps);
  const locks = useStore((s) => s.locks);
  const meta = useStore((s) => s.meta);
  const aiStatus = useStore((s) => s.ui.aiStatus);
  const aiDetail = useStore((s) => s.ui.aiDetail);

  const [busy, setBusy] = useState(null);
  const [instruction, setInstruction] = useState("");
  const [replanText, setReplanText] = useState("");
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [editingCap, setEditingCap] = useState(null);
  const [dragged, setDragged] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [horizon, setHorizon] = useState(28);
  const [moveTarget,setMoveTarget]=useState(null);
  const [moveDate,setMoveDate]=useState("");
  const [selectedDate,setSelectedDate]=useState(null);
  const [direction,setDirection]=useState(1);

  const hour = meta.dayStartHour || 0;
  const todayIso = D.effectiveTodayIso(hour);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const lockedDateSet = useMemo(() => new Set(Object.keys(locks || {}).filter((k) => locks[k])), [locks]);

  const pending = tasks.filter((t) => !t.completed && t.recurring === "none");
  const recurring = tasks.filter((t) => t.recurring !== "none");
  const recurringHours = recurring.reduce((s, t) => s + (t.recurring === "daily" ? D.taskHours(t) : D.taskHours(t) / 5), 0);
  const scheduledIds = new Set((plan || []).flatMap((e) => e.items.map((i) => i.taskId)));
  const unscheduled = pending.filter((t) => !scheduledIds.has(t.id));
  const totalH = pending.reduce((s, t) => s + D.taskHours(t), 0);

  const agendaDays = useMemo(() => {
    const out = [];
    const planByDate = new Map((plan || []).map((e) => [e.date, e]));
    for (let i = 0; i < horizon; i++) {
      const d = D.addDays(D.parseIsoDate(todayIso), i);
      const iso = D.isoDate(d);
      const wd = D.weekdayName(d);
      const cap = caps[wd] ?? 0;
      const entry = planByDate.get(iso);
      const items = entry?.items || [];

      out.push({ iso, d, wd, cap, items, isToday: i === 0, locked: !!locks[iso] });
    }
    return out;
  }, [plan, caps, locks, todayIso, horizon]);

  const missed = useMemo(() => D.getMissedWork(tasks, plan, hour), [tasks, plan, hour]);

  const failToast = (e) => notify(aiFailureMessage(e.kind));

  const runSchedule = async (withInstruction = "") => {
    setBusy("schedule");
    try {
      const next = await aiPlan(tasks, caps, {
        mode: plan?.length ? "append" : "fresh",
        existingPlan: plan || [], lockedDates: lockedDateSet, projects,
        instruction: withInstruction, dayStartHour: hour,
      });
      applyPlan(next, { snapshotLabel: "Plan updated" });
    } catch (e) { failToast(e); }
    setBusy(null); setInstructionOpen(false); setInstruction("");
  };

  const runOptimize = async () => {
    setBusy("optimize");
    try {
      const next = await aiPlan(tasks, caps, {
        mode: "optimize", existingPlan: plan || [], lockedDates: lockedDateSet,
        projects, dayStartHour: hour,
      });
      applyPlan(next, { snapshotLabel: "Plan rebuilt" });
    } catch (e) { failToast(e); }
    setBusy(null);
  };

  const runReplan = async () => {
    const instr = replanText.trim();
    if (!instr || busy) return;
    setBusy("replan");
    try {
      const res = await aiReplan(tasks, caps, {
        existingPlan: plan || [], instruction: instr,
        lockedDates: lockedDateSet, projects,
      });
      if (res.empty || !res.plan) {
        notify("The AI couldn't map that request onto the plan — nothing was changed");
      } else {
        applyPlan(res.plan, { snapshotLabel: `Applied ${res.applied.length} change${res.applied.length === 1 ? "" : "s"}` });
        setReplanText("");
      }
    } catch (e) { failToast(e); }
    setBusy(null);
  };

  const updateCap = (day, val) => {
    const raw = parseFloat(val);
    const v = Number.isNaN(raw) ? 0 : Math.max(0, Math.min(10, raw));
    setCaps({ ...caps, [day]: v });
  };

  const day=agendaDays.find(d=>d.iso===selectedDate)||agendaDays[0];
  const dayIndex=agendaDays.indexOf(day);
  const dayH=day.items.reduce((n,it)=>n+(it.hours??D.taskHours(tasksById.get(it.taskId)||{})),0)+(day.cap>0?recurringHours:0);
  const load=day.cap?Math.min(100,dayH/day.cap*100):0;
  const select=(iso)=>{setDirection(iso<day.iso?-1:1);setSelectedDate(iso);};
  const drop=(iso,event)=>{let work=dragged;try{const data=event?.dataTransfer.getData('application/x-folio-task');if(data)work=JSON.parse(data);}catch{}if(locks[iso])notify('That day is locked');else if(work&&tasksById.has(work.taskId)){if(work.fromDate)moveChunkDate(work.taskId,work.fromDate,iso);else pinTaskToDate(work.taskId,iso);}setDragged(null);setDragOver(null);};
  const place=()=>{if(locks[moveDate]){notify('That day is locked');return;}if(moveTarget.fromDate)moveChunkDate(moveTarget.taskId,moveTarget.fromDate,moveDate);else pinTaskToDate(moveTarget.taskId,moveDate);setSelectedDate(moveDate);const distance=Math.round((D.parseIsoDate(moveDate)-D.parseIsoDate(todayIso))/86400000);if(distance>=horizon)setHorizon(distance+7);setMoveTarget(null);};
  return <div className="f-page f-plan">
    <header className="f-editorial-header"><div><span className="f-kicker">II / THE ART OF MAKING ROOM</span><h1>Space is<br/><em>part of the work.</em></h1></div><div className="f-header-aside"><p>{pending.length} manuscripts. About {totalH.toFixed(1)} hours.<br/>Give each one a page of its own.</p><div className="f-button-row">{unscheduled.length>0&&<button className="w-switch" disabled={!!busy} onClick={()=>runSchedule('')}>{busy==='schedule'?'Scheduling…':'Schedule '+unscheduled.length+' pending'}</button>}<button className="w-bezel" disabled={!!busy} title="Schedule with custom instructions" aria-expanded={instructionOpen} onClick={()=>setInstructionOpen(!instructionOpen)}>With a little direction ↗</button>{plan.length>0&&<button className="w-link" disabled={!!busy} onClick={runOptimize} title="Rebuild the whole plan from scratch (undoable)">{busy==='optimize'?'Rebuilding…':'Rebuild'}</button>}</div></div></header>
    {instructionOpen&&<section className="f-instruction"><label className="f-kicker" htmlFor="folio-instruction">A note to the compositor</label><textarea id="folio-instruction" className="w-field" autoFocus value={instruction} disabled={!!busy} onChange={e=>setInstruction(e.target.value)} onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();runSchedule(instruction);}else if(e.key==='Escape')setInstructionOpen(false);}} placeholder="e.g. spread over the next 2 weeks · finish by Friday"/><div className="f-button-row"><button className="w-switch" disabled={!!busy} onClick={()=>runSchedule(instruction)}>Schedule</button><button className="w-link" onClick={()=>setInstructionOpen(false)}>Cancel</button><AiDot status={aiStatus} detail={aiDetail}/></div></section>}
    {missed.length>0&&<div className="f-notice"><span>{missed.length} unfinished pages from earlier days.</span><button className="w-link" onClick={()=>setUI({view:'today'})}>Triage on Today ↗</button></div>}
    <div className="f-calendar-ribbon"><span className="f-kicker">TURN TO A PAGE</span><div className="f-atlas">{agendaDays.map(d=><button key={d.iso} className={'f-atlas-day'+(d.iso===day.iso?' is-selected':'')+(d.isToday?' is-today':'')+(dragOver===d.iso?' is-over':'')} aria-label={'View '+d.iso} aria-pressed={d.iso===day.iso} title={d.iso+' · '+d.items.length+' tasks'} onClick={()=>select(d.iso)} onDragOver={e=>{e.preventDefault();setDragOver(d.iso);}} onDragLeave={()=>setDragOver(null)} onDrop={e=>{e.preventDefault();drop(d.iso,e);select(d.iso);}}><span>{d.wd.slice(0,2)}</span><b>{d.d.getDate()}</b><small>{d.d.toLocaleDateString('en-GB',{month:'short'})}</small>{d.items.length>0&&<i/>}{d.locked&&<Icon name="lock" size={9}/>}</button>)}</div><button className="w-link" onClick={()=>setHorizon(h=>h+28)}>Show 4 more weeks +</button></div>
    <div className="f-imposition">
      <section key={day.iso} id={'folio-day-'+day.iso} className={'f-day-sheet'+(day.locked?' is-locked':'')+(dragOver===day.iso?' is-over':'')} style={{'--page-direction':direction}}>
        <div className="f-page-number"><span>THE WORKING PAGE / {day.d.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</span><span>{day.isToday?'TODAY':'PAGE '+String(dayIndex+1).padStart(2,'0')}</span></div>
        <header className="f-day-date"><div><span className="f-kicker">{day.wd}</span><strong>{String(day.d.getDate()).padStart(2,'0')}<em>.</em></strong></div><div className="f-capacity-dial"><svg viewBox="0 0 140 140" aria-hidden="true"><circle cx="70" cy="70" r="62" fill="none" stroke="var(--line-dim)" strokeWidth="1"/><circle cx="70" cy="70" r="62" fill="none" stroke={dayH>day.cap?'var(--port)':'var(--amber)'} strokeWidth="3" pathLength="100" strokeDasharray={load+' 100'} transform="rotate(-90 70 70)"/>{Array.from({length:28},(_,i)=><path key={i} d="M70 17v4" stroke="var(--fg-faint)" transform={'rotate('+i*360/28+' 70 70)'}/>)}</svg><div><strong>{dayH.toFixed(1)}<small>h</small></strong><span>{day.cap?'OF '+day.cap+'H AVAILABLE':'A DAY OF REST'}</span></div></div></header>
        <div className="f-day-tools"><span>{dayH>day.cap?'A crowded page. Consider moving a task.':day.cap?Math.max(0,day.cap-dayH).toFixed(1)+' hours of breathing room.':'Leave space for life.'}</span><button className="w-link" onClick={()=>toggleDayLock(day.iso)} title={day.locked?'Locked — planner skips it. Click to unlock.':'Lock day (planner will skip it)'} aria-pressed={day.locked}><Icon name={day.locked?'lock':'unlock'} size={13}/>{day.locked?'Protected page':'Protect this page'}</button></div>
        <div className="f-day-body" onDragOver={e=>{e.preventDefault();setDragOver(day.iso);}} onDragLeave={()=>setDragOver(null)} onDrop={e=>{e.preventDefault();drop(day.iso,e);}}>
          {day.items.length===0?<div className="f-blank-page"><span aria-hidden="true">✳</span><h2>Room to make<br/><em>something.</em></h2><p>Drop a manuscript here.<br/>Or choose its date from the waiting pile.</p></div>:<div className="f-day-items">{day.items.map((it,index)=>{const t=tasksById.get(it.taskId);if(!t)return null;const project=projectsById.get(t.projectId),chunks=D.getTaskChunks(t.id,plan),done=!!(it.done||t.completed);return <article key={it.taskId} className={'f-plan-task'+(done?' is-complete':'')} draggable onDragStart={e=>{setDragged({taskId:t.id,fromDate:day.iso});e.dataTransfer.setData("application/x-folio-task",JSON.stringify({taskId:t.id,fromDate:day.iso}));e.dataTransfer.effectAllowed='move';}} onDragEnd={()=>{setDragged(null);setDragOver(null);}}><span className="f-plan-ordinal">{String(index+1).padStart(2,'0')}</span><div><span className="f-kicker">{project?.title||'An independent work'}</span><button className="f-task-title" onClick={()=>setUI({editingTaskId:t.id,formOpen:true})}>{t.title}</button><p>{it.hours??D.taskHours(t)}h{chunks.length>1?' · Part '+(chunks.findIndex(c=>c.date===day.iso)+1)+' of '+chunks.length:''}{it.note?' / '+it.note:''}</p><div className="f-plan-actions"><button className="w-link" aria-label={'Move '+t.title} onClick={()=>{setMoveTarget({taskId:t.id,fromDate:day.iso});setMoveDate(day.iso);}}>Move to a date ↗</button><button className="w-link" aria-label="Unschedule" onClick={()=>dismissChunk(t.id,day.iso)}>Return to pile</button></div></div><CompleteButton done={done} onComplete={()=>setCompletion(t.id,{done:true,chunkDate:day.iso})} onReopen={()=>setCompletion(t.id,{done:false,chunkDate:day.iso})}/></article>})}</div>}
          {recurring.length>0&&day.cap>0&&<div className="f-recurring-note"><span className="f-kicker">THE DAILY PRACTICE · {recurringHours.toFixed(1)}H RESERVED</span><p>{recurring.map(t=>t.title+' ('+t.recurring+')').join(' / ')}</p></div>}
        </div>
        <footer className="f-page-turn"><button className="w-link" disabled={dayIndex===0} aria-label="Previous day" onClick={()=>select(agendaDays[dayIndex-1].iso)}>← Previous page</button><span>f.</span><button className="w-link" disabled={dayIndex===agendaDays.length-1} aria-label="Next day" onClick={()=>select(agendaDays[dayIndex+1].iso)}>Turn the page →</button></footer>
      </section>
      <aside className="f-unplaced"><div className="f-kicker">THE WAITING PILE / {unscheduled.length}</div><h2>All in<br/><em>good time.</em></h2><p>Loose manuscripts, ready to find their place.</p><div className="f-unplaced-list">{unscheduled.map((t,i)=><article key={t.id} draggable className="f-unplaced-task" style={{'--slip-angle':(i%3-1)*1.2+'deg'}} onDragStart={e=>{setDragged({taskId:t.id,fromDate:null});e.dataTransfer.setData("application/x-folio-task",JSON.stringify({taskId:t.id,fromDate:null}));e.dataTransfer.effectAllowed='move';}} onDragEnd={()=>setDragged(null)}><span className="f-kicker">UNPLACED / {D.taskHours(t)}H</span><h3>{t.title}</h3><button className="w-link" aria-label={'Schedule '+t.title} onClick={()=>{setMoveTarget({taskId:t.id,fromDate:null});setMoveDate(day.iso);}}>Give it a date ↗</button></article>)}</div>{!unscheduled.length&&<p className="f-pile-empty">Every manuscript has a home. A lovely kind of order.</p>}</aside>
    </div>
    {moveTarget&&<div className="f-move-strip" role="group" aria-label="Choose task date"><span>Place this task on</span><input type="date" aria-label="Destination date" value={moveDate} onChange={e=>setMoveDate(e.target.value)} className="w-field"/><button className="w-switch" disabled={!moveDate} onClick={place}>Place task</button><button className="w-bezel" onClick={()=>setMoveTarget(null)}>Cancel</button></div>}
    <section className="f-weekly-rhythm"><div><span className="f-kicker">THE WEEKLY RHYTHM</span><h2>A little room,<br/><em>every day.</em></h2><p>Set your available hours. Zero is a day off.</p></div><div className="w-cap-grid">{D.WEEK_ALL.map(wd=><label key={wd}><span>{wd.slice(0,3)}</span><input type="number" aria-label={wd+' capacity'} min="0" max="10" step="0.5" value={caps[wd]??0} onChange={e=>updateCap(wd,e.target.value)}/><small>hours</small></label>)}</div></section>
    {plan.length>0&&<section className="f-replan"><span className="f-kicker">A CHANGE OF PLANS</span><div className="f-writing-line"><input value={replanText} disabled={!!busy} onChange={e=>setReplanText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();runReplan();}else if(e.key==='Escape')setReplanText('');}} placeholder="Push everything past Friday…" aria-label="Replan instruction"/><button className="w-switch" disabled={!replanText.trim()||!!busy} onClick={runReplan}>{busy==='replan'?'Replanning…':'Replan'}</button></div><div className="f-replan-suggestions">{['Spread the client work over 2 weeks','Push everything past Friday','Move design tasks earlier'].map(ex=><button key={ex} className="w-link" onClick={()=>setReplanText(ex)}>{ex}</button>)}<AiDot status={aiStatus} detail={aiDetail}/></div></section>}
  </div>;
}
