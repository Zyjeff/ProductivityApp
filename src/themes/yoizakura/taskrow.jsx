// taskrow.jsx — washi ledger row. Click opens the paper-pane task
// sheet (expansion is a place). Chunk editor logic lifted from
// Nightwatch; composition is Yoizakura's.

import React, { useState } from "react";
import { Icon, Stamp, BudButton, PriorityDot } from "./components.jsx";
import { DIFFICULTY, taskHours, effectiveTodayIso, todayFocusMs, fmtMs } from "../../core/domain.js";
import { useStore, setUI, setCompletion, deleteTask, updateChunk, moveChunkDate } from "../../core/store.js";

export function DeadlineStamp({ task }) {
  if (!task.deadlineAt || task.completed) return null;
  const now = Date.now();
  const dueDate = new Date(task.deadlineAt);
  const daysLeft = Math.floor((task.deadlineAt - now) / 86400000);
  const overdue = task.deadlineAt < now && daysLeft < 0;
  const label = overdue ? `overdue ${Math.abs(daysLeft)}d`
    : daysLeft === 0 ? "due today"
    : daysLeft === 1 ? "due tomorrow"
    : daysLeft < 7 ? `due ${dueDate.toLocaleDateString("en-US", { weekday: "short" })}`
    : `due ${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const title = `Deadline: ${dueDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`;
  const tone = overdue ? "var(--port)" : daysLeft <= 3 ? "var(--warn)" : undefined;
  return <Stamp style={{ flexShrink: 0 }} tone={tone} title={title}>{label}</Stamp>;
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
      <span className="yz-num" title={`Actual focus ${fmtMs(actualMs)} vs ~${est}h estimated`}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, color: over ? "var(--warn)" : "var(--sumi-faint)" }}>
        <Icon name="focus" size={9} />{fmtMs(actualMs)}/{est}h
      </span>
    );
  }
  const fm = todayFocusMs(task, dayStartHour);
  if (!fm || done) return null;
  return (
    <span className="yz-num" title="Time focused today" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, color: "var(--amber-deep)" }}>
      <Icon name="focus" size={9} />{fmtMs(fm)}
    </span>
  );
}

export function TaskRow({
  task, project, doneHere, onToggleDone,
  chunkNote, chunkLabel, splitBadge,
  isCursor, onHoverCursor,
  onOpen,
  compact = false, showAge = true, dayStartHour = 0,
  variant,
  dragging = false,
  onDragStart, onDragOver, onDrop, onDragEnd, draggable = false,
}) {
  const done = doneHere ?? task.completed;
  const ageDays = task.createdAt ? Math.floor((Date.now() - task.createdAt) / 86400000) : 0;
  const sub = task.subtasks || [];
  const doneSub = sub.filter((s) => s.done).length;
  const diff = DIFFICULTY[task.difficulty] || DIFFICULTY.medium;
  const settling = task.justEnriched && Date.now() - task.justEnriched < 2000;
  const open = onOpen;

  return (
    <div
      className={
        "yz-row"
        + (done ? " yz-row--done" : "")
        + (isCursor ? " yz-row--cursor" : "")
        + (settling ? " settling" : "")
        + (variant === "fallen" ? " yz-row--fallen" : "")
        + (dragging ? " yz-row--lift" : "")
        + (task.justEnriched ? " yz-row--fresh" : "")
      }
      onMouseEnter={onHoverCursor}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={() => open && open(task.id)}
    >
      <BudButton done={done} onComplete={() => onToggleDone(true)} onReopen={() => onToggleDone(false)} />
      <div className="yz-row-main">
        <div className="yz-row-head">
          <PriorityDot p={task.priority || "medium"} />
          <span className="yz-row-title">{task.title}</span>
          {task.aiPending && (
            <span className="yz-num" title="The Attendant is scoring this — numbers may refine"
              style={{ fontSize: 9, color: "var(--amber-deep)", flexShrink: 0 }}>…</span>
          )}
          {task.recurring && task.recurring !== "none" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--sumi-faint)", fontSize: 10, flexShrink: 0 }}>
              <Icon name="recur" size={10} /> {task.recurring}
            </span>
          )}
          {splitBadge && <Stamp style={{ flexShrink: 0 }}>{splitBadge}</Stamp>}
          <DeadlineStamp task={{ ...task, completed: done }} />
          {showAge && !done && task.recurring === "none" && ageDays > 7 && (
            <Stamp title={`Pending ${ageDays} days`} tone={ageDays > 14 ? "var(--warn)" : undefined} style={{ flexShrink: 0 }}>{ageDays}d</Stamp>
          )}
        </div>
        <div className="yz-row-meta">
          {project && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <i className="yz-dot" style={{ background: project.color || "var(--sumi-faint)" }} />
              {project.title}
            </span>
          )}
          <span>{taskHours(task)}h</span>
          {chunkLabel && <Stamp style={{ fontStyle: "normal" }}>{chunkLabel}</Stamp>}
          {chunkNote && <span style={{ fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }} title={chunkNote}>{chunkNote}</span>}
          <span style={{ color: diff.tone }}>{(task.difficulty || "medium")}</span>
          {(task.tags || []).map((t) => <span key={t}>#{t}</span>)}
          {sub.length > 0 && <span>{doneSub}/{sub.length} steps</span>}
          <ActualsReadout task={task} done={done} dayStartHour={dayStartHour} />
        </div>
      </div>
      <span className="yz-row-xp" title={`${diff.label} · ~${taskHours(task)}h · ${task.xp} XP`}>+{task.xp}</span>
      {!compact && (
        <div className="yz-row-actions" onClick={(e) => e.stopPropagation()}>
          {!done && (
            <button className="yz-icon-btn" onClick={() => setUI({ focusTaskId: task.id })} aria-label="Focus" title="Focus (F)">
              <Icon name="focus" size={13} />
            </button>
          )}
          <button className="yz-icon-btn" onClick={() => setUI({ editingTaskId: task.id, formOpen: true })} aria-label="Edit" title="Edit (E)">
            <Icon name="edit" size={13} />
          </button>
          <button className="yz-icon-btn" onClick={() => deleteTask(task.id)} aria-label="Sweep away" title="Sweep away (undoable)">
            <Icon name="broom" size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

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
    <div className="yz-chunks">
      <div className="yz-sec" style={{ marginBottom: 4 }}>Split across {chunks.length} days</div>
      {chunks.map((c) => {
        const isPast = c.date < todayIso;
        const isToday = c.date === todayIso;
        return (
          <div key={keyOf(c)} className="yz-chunk" style={{ opacity: c.item.done ? 0.6 : 1 }}>
            <BudButton done={!!c.item.done}
              onComplete={() => setCompletion(task.id, { done: true, chunkDate: c.date })}
              onReopen={() => setCompletion(task.id, { done: false, chunkDate: c.date })} />
            <input type="date" value={c.date} disabled={c.item.done}
              onChange={(e) => { const v = e.target.value; if (v && v !== c.date) moveChunkDate(task.id, c.date, v); }}
              className="yz-bare"
              style={{ fontSize: 11, width: 135, color: c.item.done ? "var(--starboard)" : isToday ? "var(--amber-deep)" : isPast ? "var(--port)" : "var(--sumi)" }} />
            {(isToday || (isPast && !c.item.done)) && (
              <Stamp tone={isToday ? "var(--amber-deep)" : "var(--warn)"}>{isToday ? "today" : "late"}</Stamp>
            )}
            <input type="number" min="0.25" max="24" step="0.25" placeholder="hrs" disabled={c.item.done}
              value={valOr(c, "hours")}
              onChange={(e) => setVal(c, "hours", e.target.value)}
              onBlur={() => commit(c, "hours")}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
              className="yz-bare" style={{ width: 58, textAlign: "center" }} />
            <input type="text" placeholder="What happens this day" disabled={c.item.done}
              value={valOr(c, "note")}
              onChange={(e) => setVal(c, "note", e.target.value)}
              onBlur={() => commit(c, "note")}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
              className="yz-bare" style={{ flex: 1, minWidth: 120, fontSize: 12, fontFamily: "var(--t-body)" }} />
          </div>
        );
      })}
    </div>
  );
}
