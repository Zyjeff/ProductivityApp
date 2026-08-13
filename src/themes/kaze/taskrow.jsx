// taskrow.jsx — a waypoint stone on the road. The row is the station:
// the marker on the path is drawn by the .kz-station wrapper, so the
// list IS the road rather than a ledger with a path beside it.
// All handlers and data flow identical to the core contract.

import React, { useState } from "react";
import { Icon, Seal, Bloom, PriorityDot, PetalRelease } from "./components.jsx";
import { DIFFICULTY, taskHours, effectiveTodayIso, todayFocusMs, fmtMs } from "../../core/domain.js";
import { useStore, setUI, setCompletion, deleteTask, toggleSubtask, updateChunk, moveChunkDate } from "../../core/store.js";

export function DeadlineSeal({ task }) {
  if (!task.deadlineAt || task.completed) return null;
  const now = Date.now();
  const dueDate = new Date(task.deadlineAt);
  const daysLeft = Math.floor((task.deadlineAt - now) / 86400000);
  const overdue = task.deadlineAt < now && daysLeft < 0;
  const label = overdue ? `${Math.abs(daysLeft)}D PAST`
    : daysLeft === 0 ? "DUE TODAY"
    : daysLeft === 1 ? "DUE TMRW"
    : daysLeft < 7 ? `DUE ${dueDate.toLocaleDateString("en-US", { weekday: "short" })}`
    : `DUE ${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const title = `Deadline: ${dueDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`;
  if (overdue || daysLeft <= 3) {
    return <span className={"kz-tape " + (overdue ? "kz-tape--port" : "kz-tape--warn")} title={title} style={{ fontSize: 8.5, padding: "1px 6px", flexShrink: 0 }}>{label}</span>;
  }
  return <Seal style={{ flexShrink: 0 }} title={title}>{label}</Seal>;
}

function WalkedReadout({ task, done, dayStartHour }) {
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
      <span title={`Walked ${fmtMs(actualMs)} against a ~${est}h stretch`}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, color: over ? "var(--warn)" : "var(--fg-faint)" }}>
        <Icon name="path" size={9} />{fmtMs(actualMs)}/{est}H
      </span>
    );
  }
  const fm = todayFocusMs(task, dayStartHour);
  if (!fm || done) return null;
  return (
    <span title="Time walked today" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--amber-hot)" }}>
      <Icon name="path" size={9} />{fmtMs(fm)}
    </span>
  );
}

export function WaypointRow({
  task, project, doneHere, onToggleDone,
  chunkNote, chunkLabel, splitBadge,
  index = null,
  isCursor, onHoverCursor,
  expanded, onToggleExpand, extraExpanded,
  compact = false, showAge = true, dayStartHour = 0,
}) {
  const done = doneHere ?? task.completed;
  const [burst, setBurst] = useState(0);
  const ageDays = task.createdAt ? Math.floor((Date.now() - task.createdAt) / 86400000) : 0;
  const sub = task.subtasks || [];
  const doneSub = sub.filter((s) => s.done).length;
  const diff = DIFFICULTY[task.difficulty] || DIFFICULTY.medium;
  const settling = task.justEnriched && Date.now() - task.justEnriched < 2000;
  const lamp = project?.color || diff.tone;

  const complete = (next) => {
    if (next && !done) setBurst((b) => b + 1);
    onToggleDone(next);
  };

  return (
    <div
      className={"kz-stone" + (done ? " kz-stone--done" : "") + (isCursor ? " kz-stone--cursor" : "") + (settling ? " kz-stone--settling" : "")}
      style={{ flexDirection: "column", alignItems: "stretch", "--row-lamp": done ? "var(--line-dim)" : lamp }}
      onMouseEnter={onHoverCursor}
    >
      {burst > 0 && <PetalRelease key={burst} seed={burst * 31 + (index ?? 0)} />}
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        {index != null && <span className="kz-stone-idx">{String(index + 1).padStart(2, "0")}</span>}
        <Bloom done={done} onComplete={() => complete(true)} onReopen={() => complete(false)} />
        <div style={{ flex: 1, minWidth: 0, cursor: onToggleExpand ? "pointer" : "default" }}
          onClick={onToggleExpand || undefined}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PriorityDot p={task.priority || "medium"} />
            <span className="kz-stone-title" style={{ minWidth: 0 }}>{task.title}</span>
            {task.aiPending && (
              <span className="kz-num" title="The oracle is weighing this — the numbers may settle in a moment"
                style={{ fontSize: 9, color: "var(--amber-hot)", flexShrink: 0 }}>…</span>
            )}
            {task.recurring && task.recurring !== "none" && (
              <span title={`A ${task.recurring} ritual`} style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--channel)", fontSize: 10, flexShrink: 0 }}>
                <Icon name="recur" size={10} /> {task.recurring}
              </span>
            )}
            {splitBadge && <Seal style={{ flexShrink: 0 }}>{splitBadge}</Seal>}
            <DeadlineSeal task={{ ...task, completed: done }} />
            {showAge && !done && task.recurring === "none" && ageDays > 7 && (
              <Seal title={`Waiting ${ageDays} days`} tone={ageDays > 14 ? "var(--warn)" : undefined} style={{ flexShrink: 0 }}>{ageDays}d</Seal>
            )}
          </div>
          <div className="kz-stone-meta">
            {project && <span style={{ color: done ? "var(--fg-faint)" : project.color }}>{project.title}</span>}
            <span>{taskHours(task)}H</span>
            {chunkLabel && <Seal>{chunkLabel}</Seal>}
            {chunkNote && <span style={{ fontStyle: "italic", textTransform: "none", letterSpacing: 0, overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 }} title={chunkNote}>{chunkNote}</span>}
            <span style={{ color: diff.tone }}>{(task.difficulty || "medium")}</span>
            {(task.tags || []).map((t) => <span key={t}>#{t}</span>)}
            {sub.length > 0 && <span>{doneSub}/{sub.length} steps</span>}
            <WalkedReadout task={task} done={done} dayStartHour={dayStartHour} />
          </div>
        </div>
        <span className="kz-stone-xp" title={`${diff.label} · ~${taskHours(task)}h · ${task.xp} resolve`}>+{task.xp}</span>
        {!compact && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
            {!done && (
              <button className="kz-icon-btn" onClick={(e) => { e.stopPropagation(); setUI({ focusTaskId: task.id }); }} aria-label="Sit with this" title="Meditation (F)"><Icon name="lantern" size={13} /></button>
            )}
            <button className="kz-icon-btn" onClick={(e) => { e.stopPropagation(); setUI({ editingTaskId: task.id, formOpen: true }); }} aria-label="Edit" title="Edit (E)"><Icon name="edit" size={13} /></button>
            <button className="kz-icon-btn" onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} aria-label="Scatter" title="Scatter — petals fall (undoable)"><Icon name="close" size={13} /></button>
          </div>
        )}
      </div>

      {!compact && expanded && (
        <div className="kz-stone-expand kz-fade-in" style={{ margin: "10px -13px -11px", borderRadius: 0 }}>
          {task.desc && <div style={{ fontSize: 12.5, color: "var(--fg-dim)", lineHeight: 1.6, marginBottom: 8 }}>{task.desc}</div>}
          {task.notes && <div style={{ fontSize: 12, color: "var(--fg-dim)", fontStyle: "italic", marginBottom: 8 }}>{task.notes}</div>}
          {sub.length > 0 && (
            <div>
              <div className="kz-label" style={{ marginBottom: 6 }}>Steps</div>
              {sub.map((s) => (
                <div key={s.id} onClick={() => toggleSubtask(task.id, s.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer" }}>
                  <Bloom square size={14} done={s.done} onComplete={() => toggleSubtask(task.id, s.id)} onReopen={() => toggleSubtask(task.id, s.id)} label="toggle step" />
                  <span style={{ fontSize: 12.5, color: s.done ? "var(--fg-faint)" : "var(--fg)", textDecoration: s.done ? "line-through" : "none" }}>{s.title}</span>
                </div>
              ))}
            </div>
          )}
          {extraExpanded}
        </div>
      )}
    </div>
  );
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
      <div className="kz-label" style={{ marginBottom: 6 }}>The road splits across {chunks.length} days</div>
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
              <Bloom done={!!c.item.done}
                onComplete={() => setCompletion(task.id, { done: true, chunkDate: c.date })}
                onReopen={() => setCompletion(task.id, { done: false, chunkDate: c.date })} />
              <input type="date" value={c.date} disabled={c.item.done}
                onChange={(e) => { const v = e.target.value; if (v && v !== c.date) moveChunkDate(task.id, c.date, v); }}
                className="kz-bare"
                style={{ width: 135, color: c.item.done ? "var(--sakura)" : isToday ? "var(--amber)" : isPast ? "var(--warn)" : "var(--fg)" }} />
              {(isToday || (isPast && !c.item.done)) && (
                <span className={"kz-tape " + (isToday ? "" : "kz-tape--warn")} style={{ fontSize: 8, padding: "1px 5px" }}>
                  {isToday ? "TODAY" : "WEATHERED"}
                </span>
              )}
              <input type="number" min="0.25" max="24" step="0.25" placeholder="hrs" disabled={c.item.done}
                value={valOr(c, "hours")}
                onChange={(e) => setVal(c, "hours", e.target.value)}
                onBlur={() => commit(c, "hours")}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
                className="kz-bare" style={{ width: 58, textAlign: "center" }} />
              <input type="text" placeholder="What happens on this stretch" disabled={c.item.done}
                value={valOr(c, "note")}
                onChange={(e) => setVal(c, "note", e.target.value)}
                onBlur={() => commit(c, "note")}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
                className="kz-bare" style={{ flex: 1, minWidth: 140, fontSize: 12, fontFamily: "var(--t-body)" }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
