import React, { useState } from "react";
import { Icon, Chip, CompleteButton, Checkbox, PriorityDot, DifficultyPip } from "./components.jsx";
import { DIFFICULTY, taskHours, effectiveTodayIso, todayFocusMs, fmtMs } from "../../core/domain.js";
import { useStore, setUI, setCompletion, deleteTask, toggleSubtask, updateChunk, moveChunkDate } from "../../core/store.js";

export function DeadlineChip({ task }) {
  if (!task.deadlineAt || task.completed) return null;
  const now = Date.now();
  const dueDate = new Date(task.deadlineAt);
  const daysLeft = Math.floor((task.deadlineAt - now) / 86400000);
  const overdue = task.deadlineAt < now && daysLeft < 0;
  const label = overdue ? `OVR ${Math.abs(daysLeft)}D`
    : daysLeft === 0 ? "DUE TODAY"
    : daysLeft === 1 ? "DUE TMRW"
    : daysLeft < 7 ? `DUE ${dueDate.toLocaleDateString("en-US", { weekday: "short" })}`
    : `DUE ${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  // Urgent deadlines are tape, not bezel — spend the loudness where it counts.
  if (overdue || daysLeft <= 3) {
    return (
      <span className={"w-tape " + (overdue ? "w-tape--port" : "w-tape--warn")}
        title={`Deadline: ${dueDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`}
        style={{ fontSize: 8.5, padding: "1px 5px", flexShrink: 0 }}>{label}</span>
    );
  }
  return (
    <span className="w-stamp" title={`Deadline: ${dueDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`}
      style={{ flexShrink: 0 }}>{label}</span>
  );
}

// Actual-vs-estimate (F4) chip; falls back to today's live focus time.
function ActualsChip({ task, done, dayStartHour }) {
  const actualMs = useStore((s) => {
    let sum = 0;
    for (const x of s.sessions || []) if (x.taskId === task.id) sum += x.ms || 0;
    return sum;
  });
  if (task.recurring !== "none") return null;
  if (actualMs >= 60000) {
    const est = taskHours(task);
    const over = actualMs / 3600000 > est;
    return (
      <span className="w-num" title={`Actual focus ${fmtMs(actualMs)} vs ~${est}h estimated`}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: over ? "var(--warn)" : "var(--fg-dim)" }}>
        <Icon name="focus" size={10} />{fmtMs(actualMs)}<span style={{ color: "var(--fg-faint)" }}>/{est}h</span>
      </span>
    );
  }
  const fm = todayFocusMs(task, dayStartHour);
  if (!fm || done) return null;
  return (
    <span className="w-num" title="Time focused today" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: "var(--amber-hot)" }}>
      <Icon name="focus" size={10} />{fmtMs(fm)}
    </span>
  );
}

export function TaskRow({task,project,doneHere,onToggleDone,chunkNote,chunkLabel,splitBadge,isCursor,onHoverCursor,expanded,onToggleExpand,extraExpanded,compact=false,showAge=true,dayStartHour=0,ordinal}) {
  const done=doneHere??task.completed;
  const [actions,setActions]=useState(false);
  const sub=task.subtasks||[],diff=DIFFICULTY[task.difficulty]||DIFFICULTY.medium;
  const age=task.createdAt?Math.floor((Date.now()-task.createdAt)/86400000):0;
  return <article className={'f-task-row'+(done?' is-complete':'')+(isCursor?' is-cursor':'')+(expanded?' is-expanded':'')} onMouseEnter={onHoverCursor}>
    <div className="f-proof-edge" aria-hidden="true">{ordinal!=null?String(ordinal).padStart(2,'0'):'§'}</div>
    <div className="f-task-main">
      <div className="f-proof-overline"><span>{project?project.title:'An independent work'}</span><span>{done?'IMPRESSION MADE':task.aiPending?'SCORING…':(task.priority==='high'?'PRIORITY PROOF':diff.label+' effort')}</span></div>
      <div className="f-task-copy" role={onToggleExpand?'button':undefined} tabIndex={onToggleExpand?0:undefined} aria-expanded={onToggleExpand?!!expanded:undefined} aria-label={'Expand '+task.title} onClick={onToggleExpand} onKeyDown={e=>{if(onToggleExpand&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();onToggleExpand();}}}>
        <h3>{task.title}</h3>{chunkNote&&<p className="f-proof-note">{chunkLabel&&chunkLabel+' / '}{chunkNote}</p>}
      </div>
      <div className="f-proof-bottom"><div className="f-proof-details"><span>~{taskHours(task)}h</span><span>{task.xp} XP</span>{sub.length>0&&<span>{sub.filter(s=>s.done).length}/{sub.length} steps</span>}{task.recurring&&task.recurring!=='none'&&<span>↻ {task.recurring}</span>}{splitBadge&&<span>{splitBadge}</span>}<ActualsChip task={task} done={done} dayStartHour={dayStartHour}/><DeadlineChip task={{...task,completed:done}}/>{showAge&&!done&&age>7&&<span>{age}d waiting</span>}{!compact&&(task.tags||[]).map(tag=><span key={tag}>#{tag}</span>)}</div>
        {!compact&&<button className={'f-proof-tools-toggle'+(actions?' is-open':'')} aria-label={'Actions for '+task.title} aria-expanded={actions} onClick={()=>setActions(!actions)}><span>···</span></button>}
      </div>
      {!compact&&actions&&<div className="f-task-actions"><span className="f-kicker">This manuscript</span>{!done&&<button className="w-link" aria-label="Enter focus mode" title="Focus (F)" onClick={()=>setUI({focusTaskId:task.id})}><Icon name="focus"/>Focus</button>}<button className="w-link" aria-label="Edit" title="Edit (E)" onClick={()=>setUI({editingTaskId:task.id,formOpen:true})}><Icon name="edit"/>Edit</button><button className="w-link" aria-label="Delete" title="Delete (undoable)" onClick={()=>deleteTask(task.id)}><Icon name="close"/>Delete</button></div>}
      {!compact&&expanded&&<div className="f-proof-inside">{task.desc&&<p>{task.desc}</p>}{task.notes&&<p className="f-proof-note">{task.notes}</p>}{sub.length>0&&<div className="f-proof-steps"><span className="f-kicker">The small steps</span>{sub.map(s=><div key={s.id}><Checkbox checked={s.done} label={'Toggle '+s.title} onChange={()=>toggleSubtask(task.id,s.id)}/><button className="f-subtask-label" onClick={()=>toggleSubtask(task.id,s.id)} style={{textDecoration:s.done?'line-through':'none'}}>{s.title}</button></div>)}</div>}{extraExpanded}{!task.desc&&!task.notes&&!sub.length&&!extraExpanded&&<p className="f-proof-note">An open margin. Add notes or steps in the manuscript editor.</p>}</div>}
    </div>
    <div className="f-proof-stamp"><CompleteButton done={done} onComplete={()=>onToggleDone(true)} onReopen={()=>onToggleDone(false)}/><span>{done?'PRINTED':'MAKE A MARK'}</span></div>
  </article>;
}

// Inline editor for a split task's chunks (date / hours / note / done).
export function ChunksEditor({ task, chunks, dayStartHour = 0 }) {
  const [edits, setEdits] = useState({});
  const keyOf = (c) => `${c.date}:${task.id}`;
  const valOr = (c, field) => {
    const k = keyOf(c);
    if (edits[k] && Object.prototype.hasOwnProperty.call(edits[k], field)) return edits[k][field];
    return field === "hours" ? (c.item.hours ?? "") : (c.item.note || "");
  };
  const setVal = (c, field, value) => setEdits((p) => ({ ...p, [keyOf(c)]: { ...(p[keyOf(c)] || {}), [field]: value } }));
  const commit = (c, field) => {
    const k = keyOf(c);
    const cell = edits[k];
    if (!cell || !Object.prototype.hasOwnProperty.call(cell, field)) return;
    const v = cell[field];
    if (field === "hours") {
      const num = parseFloat(v);
      if (Number.isFinite(num) && num > 0) updateChunk(task.id, c.date, { hours: Math.round(num * 4) / 4 });
      else if (v === "") updateChunk(task.id, c.date, { hours: null });
    } else {
      updateChunk(task.id, c.date, { note: typeof v === "string" ? v.trim() : null });
    }
    setEdits((p) => {
      const next = { ...p };
      const cc = { ...next[k] };
      delete cc[field];
      if (Object.keys(cc).length === 0) delete next[k]; else next[k] = cc;
      return next;
    });
  };
  const todayIso = effectiveTodayIso(dayStartHour);
  return (
    <div style={{ marginTop: 8 }}>
      <div className="w-stencil" style={{ marginBottom: 6 }}>Split across {chunks.length} days</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {chunks.map((c) => {
          const isPast = c.date < todayIso;
          const isToday = c.date === todayIso;
          return (
            <div key={keyOf(c)} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
              background: "var(--plate)", boxShadow: "inset 0 1px 0 var(--line-dim)",
              opacity: c.item.done ? 0.6 : 1, flexWrap: "wrap",
            }}>
              <CompleteButton done={!!c.item.done}
                onComplete={() => setCompletion(task.id, { done: true, chunkDate: c.date })}
                onReopen={() => setCompletion(task.id, { done: false, chunkDate: c.date })} />
              <input type="date" value={c.date} disabled={c.item.done}
                onChange={(e) => { const v = e.target.value; if (v && v !== c.date) moveChunkDate(task.id, c.date, v); }}
                className="w-bare"
                style={{ fontSize: 11, width: 135, color: c.item.done ? "var(--starboard)" : isToday ? "var(--amber)" : isPast ? "var(--warn)" : "var(--fg)" }} />
              {(isToday || (isPast && !c.item.done)) && (
                <span className={"w-tape " + (isToday ? "" : "w-tape--warn")} style={{ fontSize: 8, padding: "1px 4px" }}>
                  {isToday ? "TODAY" : "LATE"}
                </span>
              )}
              <input type="number" min="0.25" max="24" step="0.25" placeholder="hrs" disabled={c.item.done}
                value={valOr(c, "hours")}
                onChange={(e) => setVal(c, "hours", e.target.value)}
                onBlur={() => commit(c, "hours")}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
                className="w-bare" style={{ width: 58, textAlign: "center" }} />
              <input type="text" placeholder="What happens this day" disabled={c.item.done}
                value={valOr(c, "note")}
                onChange={(e) => setVal(c, "note", e.target.value)}
                onBlur={() => commit(c, "note")}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
                className="w-bare" style={{ flex: 1, minWidth: 140, fontSize: 12, fontFamily: "var(--t-body)" }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
