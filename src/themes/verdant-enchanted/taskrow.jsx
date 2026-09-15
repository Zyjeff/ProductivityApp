// Verdant presentation. State and mutations use the shared core contract.
import React, { useState, useEffect, useRef } from "react";
import { Icon, Stamp, HLight, PriorityDot } from "./components.jsx";
import { DIFFICULTY, taskHours, effectiveTodayIso, todayFocusMs, fmtMs } from "../../core/domain.js";
import { useStore, setUI, setCompletion, deleteTask, toggleSubtask, updateChunk, moveChunkDate } from "../../core/store.js";

import { Glyph, PixelIcon, RuneRule, RuneCircle } from "./art.jsx";

export function DeadlineStamp({ task }) {
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
  const title = `Deadline: ${dueDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`;
  if (overdue || daysLeft <= 3) {
    return <span className={"w-tape " + (overdue ? "w-tape--port" : "w-tape--warn")} title={title} style={{ fontSize: 8.5, padding: "1px 5px", flexShrink: 0 }}>{label}</span>;
  }
  return <Stamp style={{ flexShrink: 0 }} title={title}>{label}</Stamp>;
}

function ActualsReadout({ task, done, dayStartHour }) {
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
        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, color: over ? "var(--warn)" : "var(--fg-faint)" }}>
        <Icon name="focus" size={9} />{fmtMs(actualMs)}/{est}h
      </span>
    );
  }
  const fm = todayFocusMs(task, dayStartHour);
  if (!fm || done) return null;
  return (
    <span className="w-num" title="Time focused today" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, color: "var(--amber-hot)" }}>
      <Icon name="focus" size={9} />{fmtMs(fm)}
    </span>
  );
}

export function TaskRow({
  task, project, doneHere, onToggleDone,
  chunkNote, chunkLabel, splitBadge,
  index = null,
  isCursor, onHoverCursor,
  expanded, onToggleExpand, extraExpanded,
  compact = false, showAge = true, dayStartHour = 0,
}) {
  const done = doneHere ?? task.completed;
  const previousDone=useRef(done),[sealPulse,setSealPulse]=useState(false);
  useEffect(()=>{let timer;if(done&&!previousDone.current&&!matchMedia("(prefers-reduced-motion: reduce)").matches){setSealPulse(true);timer=setTimeout(()=>setSealPulse(false),850);}previousDone.current=done;return()=>clearTimeout(timer);},[done]);
  const ageDays = task.createdAt ? Math.floor((Date.now() - task.createdAt) / 86400000) : 0;
  const sub = task.subtasks || [];
  const doneSub = sub.filter((s) => s.done).length;
  const diff = DIFFICULTY[task.difficulty] || DIFFICULTY.medium;
  const settling = task.justEnriched && Date.now() - task.justEnriched < 2000;
  const lamp = project?.color || diff.tone;

  return <article className={'lrow e-task-card'+(done?' lrow--done':'')+(isCursor?' lrow--cursor':'')+(settling?' settling':'')+(sealPulse?' is-sealing':'')} style={{'--row-lamp':lamp}} onMouseEnter={onHoverCursor}>
    {sealPulse&&<div className="e-completion-burst"><RuneCircle pct={100}/></div>}<div className="e-task-card-top"><span className="e-task-number"><Glyph seed={index??task.id} size={17}/>{index!=null?String(index+1).padStart(2,'0'):'TASK'}</span><span className="lrow-xp">{done?'SEALED':'+'+task.xp+' XP'}</span><HLight done={done} onComplete={()=>onToggleDone(true)} onReopen={()=>onToggleDone(false)}/></div>
    <button className="e-task-title-button" onClick={onToggleExpand} aria-label={(expanded?'Collapse ':'Expand ')+task.title} aria-expanded={!!expanded} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();onToggleExpand?.();}}}><h3 className="lrow-title">{task.title}</h3></button>
    <div className="e-task-context">{project?<span><i style={{background:project.color}}/>{project.title}</span>:<span>Personal intention</span>}{task.aiPending&&<span>AI…</span>}<DeadlineStamp task={{...task,completed:done}}/></div>
    <div className="e-task-metadata"><span><PixelIcon name="today" size={10}/>{taskHours(task)}h</span><span><PriorityDot p={task.priority}/>{task.priority||'medium'}</span><span>{task.difficulty}</span>{task.recurring!=='none'&&<span><Icon name="recur" size={10}/>{task.recurring}</span>}{splitBadge&&<Stamp>{splitBadge}</Stamp>}{chunkLabel&&<Stamp>{chunkLabel}</Stamp>}{sub.length>0&&<span>{doneSub}/{sub.length} steps</span>}{showAge&&!done&&ageDays>7&&<span>{ageDays}d waiting</span>}<ActualsReadout task={task} done={done} dayStartHour={dayStartHour}/></div>
    {chunkNote&&<p className="e-chunk-note">{chunkNote}</p>}{task.tags?.length>0&&<p className="e-task-tags">{task.tags.map(tag=>'#'+tag).join('  ')}</p>}
    {!compact&&<footer className="e-task-actions">{!done&&<button className="e-card-focus" onClick={()=>setUI({focusTaskId:task.id})} aria-label="Enter focus mode"><Icon name="focus" size={10}/> Focus</button>}<button className="icon-btn" onClick={()=>setUI({editingTaskId:task.id,formOpen:true})} aria-label="Edit" title="Edit (E)"><Icon name="edit"/></button><button className="icon-btn" onClick={()=>deleteTask(task.id)} aria-label="Delete" title="Delete (undoable)"><Icon name="close" size={11}/></button><button className="icon-btn" onClick={onToggleExpand} aria-label={(expanded?'Collapse details':'Expand details')} title="Details"><Icon name="chevron" size={12}/></button></footer>}
      {!compact && expanded && (
        <div className="lrow-expand fade-in">
          {task.desc && <div style={{ fontSize: 12.5, color: "var(--fg-dim)", lineHeight: 1.55, marginBottom: 8 }}>{task.desc}</div>}
          {task.notes && <div style={{ fontSize: 12, color: "var(--fg-dim)", fontStyle: "italic", marginBottom: 8 }}>{task.notes}</div>}
          {sub.length > 0 && (
            <div>
              <div className="w-stencil" style={{ marginBottom: 6 }}>Steps</div>
              {sub.map((s) => (
                <div key={s.id} onClick={() => toggleSubtask(task.id, s.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer" }}>
                  <HLight square size={14} done={s.done} onComplete={() => toggleSubtask(task.id, s.id)} onReopen={() => toggleSubtask(task.id, s.id)} label="toggle step" />
                  <span style={{ fontSize: 12.5, color: s.done ? "var(--fg-faint)" : "var(--fg)", textDecoration: s.done ? "line-through" : "none" }}>{s.title}</span>
                </div>
              ))}
            </div>
          )}
          {extraExpanded}
        </div>
      )}

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
              <HLight done={!!c.item.done}
                onComplete={() => setCompletion(task.id, { done: true, chunkDate: c.date })}
                onReopen={() => setCompletion(task.id, { done: false, chunkDate: c.date })} />
              <input type="date" value={c.date} disabled={c.item.done}
                onChange={(e) => { const v = e.target.value; if (v && v !== c.date) moveChunkDate(task.id, c.date, v); }}
                className="bare"
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
                className="bare" style={{ width: 58, textAlign: "center" }} />
              <input type="text" placeholder="What happens this day" disabled={c.item.done}
                value={valOr(c, "note")}
                onChange={(e) => setVal(c, "note", e.target.value)}
                onBlur={() => commit(c, "note")}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
                className="bare" style={{ flex: 1, minWidth: 140, fontSize: 12, fontFamily: "var(--t-body)" }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
