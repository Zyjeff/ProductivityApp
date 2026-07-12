// taskrow.jsx — the ledger row + inline chunk editor.
// 1-Bit Harbor: no boxes. Rows sit directly on a plate, separated by
// dotted dither baselines, keyed by a left status lamp channel; the
// cursor row gets the amber channel + corner bracket. All handlers and
// data flow are identical to the previous version — presentation only.

import React, { useState } from "react";
import { Icon, Chip, CompleteButton, Checkbox, PriorityDot, DifficultyPip } from "./components.jsx";
import { DIFFICULTY, taskHours, effectiveTodayIso, todayFocusMs, fmtMs } from "./domain.js";
import { useStore, setUI, setCompletion, deleteTask, toggleSubtask, updateChunk, moveChunkDate } from "./store.js";

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
  const lamp = project?.color || diff.tone;

  return (
    <div
      className={"w-ledger-row" + (done ? " w-ledger-row--done" : "") + (isCursor ? " w-ledger-row--cursor" : "") + (settling ? " w-row--settling" : "")}
      style={{ flexDirection: "column", alignItems: "stretch", "--row-lamp": done ? "var(--line-dim)" : lamp }}
      onMouseEnter={onHoverCursor}
    >
      <span className="w-cursor-bracket" aria-hidden />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <CompleteButton done={done} tone={diff.tone}
          onComplete={() => onToggleDone(true)} onReopen={() => onToggleDone(false)} />
        <div style={{ flex: 1, minWidth: 0, cursor: onToggleExpand ? "pointer" : "default" }}
          onClick={onToggleExpand || undefined}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PriorityDot p={task.priority || "medium"} />
            <span style={{
              fontSize: 13.5, fontWeight: done ? 400 : 500,
              color: done ? "var(--fg-faint)" : "var(--fg)",
              textDecoration: done ? "line-through" : "none",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
            }}>{task.title}</span>
            {task.aiPending && (
              <span className="w-num" title="AI is scoring this task — the numbers may refine in a moment"
                style={{ fontSize: 9, color: "var(--amber-hot)", flexShrink: 0 }}>AI…</span>
            )}
            {task.recurring && task.recurring !== "none" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--fg-faint)", fontSize: 10, flexShrink: 0 }}>
                <Icon name="recur" size={10} /> {task.recurring}
              </span>
            )}
            {splitBadge && <span className="w-stamp" style={{ flexShrink: 0 }}>{splitBadge}</span>}
            <DeadlineChip task={{ ...task, completed: done }} />
            {showAge && !done && task.recurring === "none" && ageDays > 7 && (
              <span className="w-stamp" title={`Pending ${ageDays} days`}
                style={{ flexShrink: 0, color: ageDays > 14 ? "var(--warn)" : undefined, borderColor: ageDays > 14 ? "var(--warn)" : undefined }}>
                {ageDays}d
              </span>
            )}
          </div>
          {chunkNote && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontSize: 11, color: done ? "var(--fg-faint)" : "var(--fg-dim)", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={chunkNote}>
              {chunkLabel && <span className="w-stamp" style={{ fontStyle: "normal", flexShrink: 0 }}>{chunkLabel}</span>}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{chunkNote}</span>
            </div>
          )}
          {(task.tags?.length || project) && !compact && (
            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
              {project && (
                <span className="w-stamp w-stamp--lamp" style={{ color: project.color }}>
                  <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: project.color }} />
                  {project.title}
                </span>
              )}
              {(task.tags || []).map((tag) => <Chip key={tag}>{tag}</Chip>)}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <ActualsChip task={task} done={done} dayStartHour={dayStartHour} />
          {sub.length > 0 && (
            <span className="w-num" style={{ fontSize: 10.5, color: "var(--fg-faint)" }}>{doneSub}/{sub.length}</span>
          )}
          <span className="w-num" title={`${diff.label} · ~${taskHours(task)}h · ${task.xp} XP`} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 500, color: "var(--fg-dim)" }}>
            <DifficultyPip d={task.difficulty} />
            <span>{taskHours(task)}h</span>
            <span style={{ color: "var(--fg-faint)" }}>·</span>
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
        <div className="w-fade-in" style={{ margin: "8px -10px -8px -14px", padding: "10px 12px 12px 42px", background: "var(--well)", boxShadow: "inset 0 1px 0 var(--line-dim)" }}>
          {task.desc && <div style={{ fontSize: 12.5, color: "var(--fg-dim)", lineHeight: 1.55, marginBottom: 8 }}>{task.desc}</div>}
          {task.notes && <div style={{ fontSize: 12, color: "var(--fg-dim)", fontStyle: "italic", marginBottom: 8 }}>{task.notes}</div>}
          {sub.length > 0 && (
            <div>
              <div className="w-stencil" style={{ marginBottom: 6 }}>Subtasks</div>
              {sub.map((s) => (
                <div key={s.id} onClick={() => toggleSubtask(task.id, s.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer" }}>
                  <Checkbox checked={s.done} onChange={() => toggleSubtask(task.id, s.id)} />
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
