// taskrow.jsx — the task row + inline chunk editor.

import React, { useState } from "react";
import { Icon, Chip, CompleteButton, Checkbox, PriorityDot, DifficultyPip } from "./components.jsx";
import { DIFFICULTY, taskHours, effectiveTodayIso, todayFocusMs, fmtMs } from "./domain.js";
import { useStore, setUI, setCompletion, deleteTask, toggleSubtask, updateChunk, moveChunkDate } from "./store.js";

// Actual-vs-estimate (F4): once sessions are logged, the row shows
// lifetime actuals against the estimate (amber = over). Before any
// session exists, today's live focus time is the running signal.
function ActualsChip({ task, done, dayStartHour }) {
  const actualMs = useStore((s) => {
    let sum = 0;
    for (const x of s.sessions || []) if (x.taskId === task.id) sum += x.ms || 0;
    return sum;
  });
  if (task.recurring !== "none") return null;
  if (actualMs >= 60000) {
    const est = taskHours(task);
    const actH = actualMs / 3600000;
    const over = actH > est;
    return (
      <span title={`Actual focus ${fmtMs(actualMs)} vs ~${est}h estimated`}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontFamily: "var(--font-mono)", color: over ? "var(--warning)" : "var(--text-muted)" }}>
        <Icon name="focus" size={10} />{fmtMs(actualMs)}<span style={{ color: "var(--text-faint)" }}>/{est}h</span>
      </span>
    );
  }
  const fm = todayFocusMs(task, dayStartHour);
  if (!fm || done) return null;
  return (
    <span title="Time focused today" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--amber-strong)" }}>
      <Icon name="focus" size={10} />{fmtMs(fm)}
    </span>
  );
}

export function DeadlineChip({ task }) {
  if (!task.deadlineAt || task.completed) return null;
  const now = Date.now();
  const dueDate = new Date(task.deadlineAt);
  const daysLeft = Math.floor((task.deadlineAt - now) / 86400000);
  const overdue = task.deadlineAt < now && daysLeft < 0;
  const tone = overdue ? "var(--port)" : daysLeft <= 3 ? "var(--warning)" : "var(--text-faint)";
  const label = overdue ? `Overdue ${Math.abs(daysLeft)}d`
    : daysLeft === 0 ? "Due today"
    : daysLeft === 1 ? "Due tomorrow"
    : daysLeft < 7 ? `Due ${dueDate.toLocaleDateString("en-US", { weekday: "short" })}`
    : `Due ${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  return (
    <span title={`Deadline: ${dueDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`}
      style={{
        fontSize: 10, fontFamily: "var(--font-mono)", color: tone, fontWeight: 600,
        border: `1px solid ${tone}`, borderRadius: 3, padding: "1px 5px", flexShrink: 0,
        background: overdue ? "var(--port-soft)" : daysLeft <= 3 ? "var(--warning-soft)" : "transparent",
      }}>{label}</span>
  );
}

export function TaskRow({
  task, project, doneHere, onToggleDone,
  chunkNote, chunkLabel, splitBadge,
  isCursor, onHoverCursor,
  expanded, onToggleExpand, extraExpanded,
  compact = false, showAge = true, dayStartHour = 0,
}) {
  const done = doneHere ?? task.completed;
  const ageDays = task.createdAt ? Math.floor((Date.now() - task.createdAt) / 86400000) : 0;
  const sub = task.subtasks || [];
  const doneSub = sub.filter((s) => s.done).length;
  const diff = DIFFICULTY[task.difficulty] || DIFFICULTY.medium;
  const settling = task.justEnriched && Date.now() - task.justEnriched < 2000;

  return (
    <div
      className={"w-row" + (done ? " w-row--done" : "") + (isCursor ? " w-row--cursor" : "") + (settling ? " w-row--settling" : "")}
      style={{ flexDirection: "column", alignItems: "stretch", padding: 0 }}
      onMouseEnter={onHoverCursor}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px" }}>
        <CompleteButton done={done} tone={diff.tone}
          onComplete={() => onToggleDone(true)} onReopen={() => onToggleDone(false)} />
        <div style={{ flex: 1, minWidth: 0, cursor: onToggleExpand ? "pointer" : "default" }}
          onClick={onToggleExpand || undefined}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PriorityDot p={task.priority || "medium"} />
            <span style={{
              fontSize: 13.5, fontWeight: done ? 400 : 500,
              color: done ? "var(--text-faint)" : "var(--text)",
              textDecoration: done ? "line-through" : "none",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
            }}>{task.title}</span>
            {task.aiPending && (
              <span title="AI is scoring this task — the numbers may refine in a moment"
                style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--amber-strong)", flexShrink: 0 }}>AI…</span>
            )}
            {task.recurring && task.recurring !== "none" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--text-faint)", fontSize: 10, flexShrink: 0 }}>
                <Icon name="recur" size={10} /> {task.recurring}
              </span>
            )}
            {splitBadge && (
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-faint)", border: "1px solid var(--border-strong)", borderRadius: 3, padding: "1px 5px", flexShrink: 0 }}>{splitBadge}</span>
            )}
            <DeadlineChip task={{ ...task, completed: done }} />
            {showAge && !done && task.recurring === "none" && ageDays > 7 && (
              <span title={`Pending ${ageDays} days`} style={{
                fontSize: 10, fontFamily: "var(--font-mono)", flexShrink: 0,
                color: ageDays > 14 ? "var(--warning)" : "var(--text-faint)",
                border: `1px solid ${ageDays > 14 ? "var(--warning)" : "var(--border-strong)"}`,
                borderRadius: 3, padding: "0 5px",
              }}>{ageDays}d</span>
            )}
          </div>
          {chunkNote && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontSize: 11, color: done ? "var(--text-faint)" : "var(--text-muted)", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={chunkNote}>
              {chunkLabel && (
                <span style={{ fontStyle: "normal", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-faint)", border: "1px solid var(--border)", borderRadius: 3, padding: "1px 4px", flexShrink: 0 }}>{chunkLabel}</span>
              )}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{chunkNote}</span>
            </div>
          )}
          {(task.tags?.length || project) && !compact && (
            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
              {project && (
                <Chip style={{ color: project.color, borderColor: project.color, background: "transparent" }}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: project.color, marginRight: 4 }} />
                  {project.title}
                </Chip>
              )}
              {(task.tags || []).map((tag) => <Chip key={tag}>{tag}</Chip>)}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <ActualsChip task={task} done={done} dayStartHour={dayStartHour} />
          {sub.length > 0 && (
            <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>{doneSub}/{sub.length}</span>
          )}
          <span title={`${diff.label} · ~${taskHours(task)}h · ${task.xp} XP`} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, color: "var(--text-muted)" }}>
            <DifficultyPip d={task.difficulty} />
            <span>{taskHours(task)}h</span>
            <span style={{ color: "var(--text-faint)" }}>·</span>
            <span>{task.xp} XP</span>
          </span>
          {!compact && !done && (
            <button className="w-icon-btn" onClick={(e) => { e.stopPropagation(); setUI({ focusTaskId: task.id }); }} aria-label="Enter focus mode" title="Focus (F)"><Icon name="focus" size={13} /></button>
          )}
          {!compact && (
            <button className="w-icon-btn" onClick={(e) => { e.stopPropagation(); setUI({ editingTaskId: task.id, formOpen: true }); }} aria-label="Edit" title="Edit (E)"><Icon name="edit" size={13} /></button>
          )}
          {!compact && (
            <button className="w-icon-btn" onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} aria-label="Delete" title="Delete (undoable)"><Icon name="close" size={13} /></button>
          )}
        </div>
      </div>

      {!compact && expanded && (
        <div className="w-fade-in" style={{ padding: "10px 12px 12px 40px", borderTop: "1px solid var(--border)" }}>
          {task.desc && <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.55, marginBottom: 8 }}>{task.desc}</div>}
          {task.notes && <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", marginBottom: 8 }}>{task.notes}</div>}
          {sub.length > 0 && (
            <div>
              <div className="w-eyebrow" style={{ marginBottom: 6 }}>Subtasks</div>
              {sub.map((s) => (
                <div key={s.id} onClick={() => toggleSubtask(task.id, s.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer" }}>
                  <Checkbox checked={s.done} onChange={() => toggleSubtask(task.id, s.id)} />
                  <span style={{ fontSize: 12.5, color: s.done ? "var(--text-faint)" : "var(--text)", textDecoration: s.done ? "line-through" : "none" }}>{s.title}</span>
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
      <div className="w-eyebrow" style={{ marginBottom: 6 }}>Split across {chunks.length} days</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {chunks.map((c) => {
          const isPast = c.date < todayIso;
          const isToday = c.date === todayIso;
          return (
            <div key={keyOf(c)} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
              background: "var(--bg-soft)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)",
              opacity: c.item.done ? 0.65 : 1, flexWrap: "wrap",
            }}>
              <CompleteButton done={!!c.item.done}
                onComplete={() => setCompletion(task.id, { done: true, chunkDate: c.date })}
                onReopen={() => setCompletion(task.id, { done: false, chunkDate: c.date })} />
              <input type="date" value={c.date} disabled={c.item.done}
                onChange={(e) => { const v = e.target.value; if (v && v !== c.date) moveChunkDate(task.id, c.date, v); }}
                className="w-input w-input--sm"
                style={{ fontFamily: "var(--font-mono)", fontSize: 11, padding: "4px 6px", width: 135, color: c.item.done ? "var(--starboard)" : isToday ? "var(--amber)" : isPast ? "var(--warning)" : "var(--text)" }} />
              {(isToday || (isPast && !c.item.done)) && (
                <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600, color: isToday ? "var(--amber)" : "var(--warning)" }}>
                  {isToday ? "TODAY" : "LATE"}
                </span>
              )}
              <input type="number" min="0.25" max="24" step="0.25" placeholder="hrs" disabled={c.item.done}
                value={valOr(c, "hours")}
                onChange={(e) => setVal(c, "hours", e.target.value)}
                onBlur={() => commit(c, "hours")}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
                className="w-input w-input--sm" style={{ width: 58, fontFamily: "var(--font-mono)", textAlign: "center" }} />
              <input type="text" placeholder="What happens this day" disabled={c.item.done}
                value={valOr(c, "note")}
                onChange={(e) => setVal(c, "note", e.target.value)}
                onBlur={() => commit(c, "note")}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
                className="w-input w-input--sm" style={{ flex: 1, minWidth: 140, fontSize: 12 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
