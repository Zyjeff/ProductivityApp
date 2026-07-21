// taskrow.jsx — sequence ledger row + expand well + ChunksEditor.
// Logic lifted from nightwatch; Apogee ap- classes and local helpers.

import React, { useState } from "react";
import { Icon, Stamp } from "./components.jsx";
import { DIFFICULTY, PRIORITIES, taskHours, effectiveTodayIso, todayFocusMs, fmtMs } from "../../core/domain.js";
import { useStore, setUI, setCompletion, deleteTask, toggleSubtask, updateChunk, moveChunkDate } from "../../core/store.js";

// Local completion toggle — Apogee square checkbox (replaces nightwatch HLight).
function CompleteToggle({ done, onComplete, onReopen, square: _square = false, size = null, label, title }) {
  const s = size || 16;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        done ? onReopen && onReopen() : onComplete && onComplete();
      }}
      title={title || (done ? "Reopen" : "Confirm nominal")}
      aria-label={label || (done ? "Reopen" : "Confirm nominal")}
      style={{
        width: s,
        height: s,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        border: "1px solid " + (done ? "var(--signal)" : "var(--line-strong)"),
        background: done ? "var(--signal)" : "transparent",
        color: done ? "var(--ink)" : "var(--fg-dim)",
        cursor: "pointer",
        font: "700 10px var(--t-mono)",
        lineHeight: 1,
      }}
    >
      {done ? "✓" : ""}
    </button>
  );
}

// Local priority indicator — sharp square (0px corners).
function PriorityMark({ p }) {
  const cfg = PRIORITIES[p] || PRIORITIES.medium;
  return (
    <span
      style={{
        width: 7,
        height: 7,
        background: cfg.dot,
        flexShrink: 0,
        display: "inline-block",
      }}
    />
  );
}

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
  if (overdue) {
    /* gap: no .ap-stamp--overdue; port-tinted inline */
    return (
      <span
        className="ap-stamp"
        title={title}
        style={{ flexShrink: 0, color: "var(--port)", borderColor: "var(--port)" }}
      >
        {label}
      </span>
    );
  }
  if (daysLeft <= 3) {
    return (
      <span className="ap-stamp ap-stamp--hold" title={title} style={{ flexShrink: 0 }}>
        {label}
      </span>
    );
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
      <span
        className="ap-num"
        title={`Actual focus ${fmtMs(actualMs)} vs ~${est}h estimated`}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, color: over ? "var(--warn)" : "var(--fg-faint)" }}
      >
        <Icon name="focus" size={9} />{fmtMs(actualMs)}/{est}h
      </span>
    );
  }
  const fm = todayFocusMs(task, dayStartHour);
  if (!fm || done) return null;
  return (
    <span
      className="ap-num"
      title="Time focused today"
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, color: "var(--amber-hot)" }}
    >
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
  const ageDays = task.createdAt ? Math.floor((Date.now() - task.createdAt) / 86400000) : 0;
  const sub = task.subtasks || [];
  const doneSub = sub.filter((s) => s.done).length;
  const diff = DIFFICULTY[task.difficulty] || DIFFICULTY.medium;
  const settling = task.justEnriched && Date.now() - task.justEnriched < 2000;
  const lamp = project?.color || diff.tone;

  const rowCls =
    "ap-lrow"
    + (done ? " ap-lrow--done" : "")
    + (isCursor ? " ap-lrow--cursor" : "");

  return (
    <div
      className={rowCls}
      /* gap: .ap-lrow does not consume --row-lamp; set var + left accent via inline */
      style={{
        flexDirection: "column",
        alignItems: "stretch",
        "--row-lamp": done ? "var(--line-dim)" : lamp,
        boxShadow: settling ? "inset 0 0 0 1px var(--signal-ground)" : undefined,
        background: settling ? "var(--signal-ground)" : undefined,
      }}
      onMouseEnter={onHoverCursor}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* gap: project/difficulty lamp accent — .ap-lrow ignores --row-lamp */}
        <span
          aria-hidden
          style={{
            width: 2,
            alignSelf: "stretch",
            minHeight: 28,
            background: done ? "var(--line-dim)" : lamp,
            flexShrink: 0,
          }}
        />
        {index != null && (
          <span className="ap-lrow-idx">{String(index + 1).padStart(2, "0")}</span>
        )}
        <CompleteToggle
          done={done}
          onComplete={() => onToggleDone(true)}
          onReopen={() => onToggleDone(false)}
          title={done ? "Reopen" : "Confirm nominal"}
        />
        <div
          style={{ flex: 1, minWidth: 0, cursor: onToggleExpand ? "pointer" : "default" }}
          onClick={onToggleExpand || undefined}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PriorityMark p={task.priority || "medium"} />
            <span className="ap-lrow-title" style={{ minWidth: 0 }}>{task.title}</span>
            {task.aiPending && (
              <span
                className="ap-num"
                title="GUIDANCE is scoring this payload — numbers may refine in a moment"
                style={{ fontSize: 9, color: "var(--amber-hot)", flexShrink: 0 }}
              >
                AI…
              </span>
            )}
            {task.recurring && task.recurring !== "none" && (
              /* gap: Icon has no "recur" case; mono recycle glyph */
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  color: "var(--fg-faint)",
                  fontSize: 10,
                  flexShrink: 0,
                  fontFamily: "var(--t-mono)",
                }}
                title={`Repeats ${task.recurring}`}
              >
                ↻ {task.recurring}
              </span>
            )}
            {splitBadge && <span className="ap-stamp" style={{ flexShrink: 0 }}>{splitBadge}</span>}
            <DeadlineStamp task={{ ...task, completed: done }} />
            {showAge && !done && task.recurring === "none" && ageDays > 7 && (
              <span
                className="ap-stamp"
                title={`Pending ${ageDays} days`}
                style={{
                  flexShrink: 0,
                  /* gap: no warn-tinted stamp modifier for age > 14 */
                  ...(ageDays > 14
                    ? { color: "var(--warn)", borderColor: "var(--warn)" }
                    : {}),
                }}
              >
                {ageDays}d
              </span>
            )}
            {done && (
              <span className="ap-stamp ap-stamp--nominal" style={{ flexShrink: 0 }}>NOMINAL</span>
            )}
          </div>
          <div className="ap-lrow-meta">
            {project && (
              <span style={{ color: done ? "var(--fg-faint)" : project.color }}>
                {project.title.toUpperCase()}
              </span>
            )}
            <span>{taskHours(task)}H</span>
            {chunkLabel && <span className="ap-stamp" style={{ fontStyle: "normal" }}>{chunkLabel}</span>}
            {chunkNote && (
              <span
                style={{ fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }}
                title={chunkNote}
              >
                {chunkNote}
              </span>
            )}
            <span style={{ color: diff.tone }}>{(task.difficulty || "medium").toUpperCase()}</span>
            {(task.tags || []).map((t) => <span key={t}>#{t}</span>)}
            {sub.length > 0 && <span>{doneSub}/{sub.length} STEPS</span>}
            <ActualsReadout task={task} done={done} dayStartHour={dayStartHour} />
          </div>
        </div>
        <span
          className="ap-lrow-xp"
          title={`${diff.label} · ~${taskHours(task)}h · ${task.xp} XP`}
        >
          +{task.xp} XP
        </span>
        {!compact && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {!done && (
              <button
                className="ap-icon-btn"
                onClick={(e) => { e.stopPropagation(); setUI({ focusTaskId: task.id }); }}
                aria-label="Burn"
                title="Burn (F)"
              >
                <Icon name="focus" size={13} />
              </button>
            )}
            <button
              className="ap-icon-btn"
              onClick={(e) => { e.stopPropagation(); setUI({ editingTaskId: task.id, formOpen: true }); }}
              aria-label="Service"
              title="Service (E)"
            >
              <Icon name="edit" size={13} />
            </button>
            <button
              className="ap-icon-btn"
              onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
              aria-label="Scrub"
              title="Scrub (Del, undoable)"
            >
              <Icon name="close" size={13} />
            </button>
          </div>
        )}
      </div>

      {!compact && expanded && (
        <div className="ap-lrow-expand">
          {task.desc && (
            <div style={{ fontSize: 12.5, color: "var(--fg-dim)", lineHeight: 1.55, marginBottom: 8 }}>
              {task.desc}
            </div>
          )}
          {task.notes && (
            <div style={{ fontSize: 12, color: "var(--fg-dim)", fontStyle: "italic", marginBottom: 8 }}>
              {task.notes}
            </div>
          )}
          {sub.length > 0 && (
            <div>
              <div className="ap-stencil" style={{ marginBottom: 6 }}>Steps</div>
              {sub.map((s) => (
                <div
                  key={s.id}
                  onClick={() => toggleSubtask(task.id, s.id)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer" }}
                >
                  <CompleteToggle
                    square
                    size={14}
                    done={s.done}
                    onComplete={() => toggleSubtask(task.id, s.id)}
                    onReopen={() => toggleSubtask(task.id, s.id)}
                    label="toggle step"
                  />
                  <span
                    style={{
                      fontSize: 12.5,
                      color: s.done ? "var(--fg-faint)" : "var(--fg)",
                      textDecoration: s.done ? "line-through" : "none",
                    }}
                  >
                    {s.title}
                  </span>
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
      <div className="ap-stencil" style={{ marginBottom: 6 }}>
        SPLIT ACROSS {chunks.length} DAYS
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {chunks.map((c) => {
          const isPast = c.date < todayIso;
          const isToday = c.date === todayIso;
          return (
            <div
              key={keyOf(c)}
              className="ap-panel ap-panel--well"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                opacity: c.item.done ? 0.6 : 1,
                flexWrap: "wrap",
              }}
            >
              <CompleteToggle
                done={!!c.item.done}
                onComplete={() => setCompletion(task.id, { done: true, chunkDate: c.date })}
                onReopen={() => setCompletion(task.id, { done: false, chunkDate: c.date })}
              />
              <input
                type="date"
                value={c.date}
                disabled={c.item.done}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v && v !== c.date) moveChunkDate(task.id, c.date, v);
                }}
                className="ap-field ap-field--mono"
                style={{
                  fontSize: 11,
                  width: 135,
                  padding: "3px 6px",
                  color: c.item.done
                    ? "var(--starboard)"
                    : isToday
                      ? "var(--amber)"
                      : isPast
                        ? "var(--warn)"
                        : "var(--fg)",
                }}
              />
              {(isToday || (isPast && !c.item.done)) && (
                isToday
                  ? <span className="ap-stamp">TODAY</span>
                  : <span className="ap-stamp ap-stamp--hold">LATE</span>
              )}
              <input
                type="number"
                min="0.25"
                max="24"
                step="0.25"
                placeholder="hrs"
                disabled={c.item.done}
                value={valOr(c, "hours")}
                onChange={(e) => setVal(c, "hours", e.target.value)}
                onBlur={() => commit(c, "hours")}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
                className="ap-field ap-field--mono"
                style={{ width: 58, textAlign: "center", padding: "3px 4px" }}
              />
              <input
                type="text"
                placeholder="What happens this day"
                disabled={c.item.done}
                value={valOr(c, "note")}
                onChange={(e) => setVal(c, "note", e.target.value)}
                onBlur={() => commit(c, "note")}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
                className="ap-field"
                style={{ flex: 1, minWidth: 140, fontSize: 12 }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
