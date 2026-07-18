// taskrow.jsx — the Sluis vessel: a rounded white card with a porthole
// hull button, index numeral, meta chips, per-row +XP. Completion locks
// the vessel through: ripple rings fire, the card sinks, then the done
// state takes over. All handlers and data flow identical to the core
// contract (lifted from the Nightwatch ledger row).

import React, { useEffect, useRef, useState } from "react";
import { Icon, CompleteButton, PriorityDot, DifficultyPip } from "./components.jsx";
import { DIFFICULTY, DIFFICULTY_ORDER, taskHours, effectiveTodayIso, todayFocusMs, fmtMs } from "../../core/domain.js";
import { useStore, setUI, setCompletion, deleteTask, toggleSubtask, updateChunk, moveChunkDate } from "../../core/store.js";

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
    return (
      <span className="s-chip" title={title}
        style={{ flexShrink: 0, color: overdue ? "var(--port)" : "var(--amber-deep)", borderColor: overdue ? "var(--port)" : "var(--amber)" }}>
        {label}
      </span>
    );
  }
  return <span className="s-chip" title={title} style={{ flexShrink: 0 }}>{label}</span>;
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
      <span className="s-num" title={`Actual focus ${fmtMs(actualMs)} vs ~${est}h estimated`}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, color: over ? "var(--warn)" : "var(--fg-faint)" }}>
        <Icon name="focus" size={9} />{fmtMs(actualMs)}/{est}h
      </span>
    );
  }
  const fm = todayFocusMs(task, dayStartHour);
  if (!fm || done) return null;
  return (
    <span className="s-num" title="Time focused today" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, color: "var(--amber-hot)" }}>
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
  adrift = false,
}) {
  const done = doneHere ?? task.completed;
  const ageDays = task.createdAt ? Math.floor((Date.now() - task.createdAt) / 86400000) : 0;
  const sub = task.subtasks || [];
  const doneSub = sub.filter((s) => s.done).length;
  const diff = DIFFICULTY[task.difficulty] || DIFFICULTY.medium;
  const diffIdx = Math.max(0, DIFFICULTY_ORDER.indexOf(task.difficulty || "medium"));
  const settling = task.justEnriched && Date.now() - task.justEnriched < 2000;

  // Schut microinteraction: on complete the card sinks for ~480ms while
  // two ripple rings fire from the porthole; then --done takes over.
  const [sinking, setSinking] = useState(false);
  const sinkTimer = useRef(null);
  useEffect(() => () => clearTimeout(sinkTimer.current), []);
  const handleComplete = () => {
    clearTimeout(sinkTimer.current);
    setSinking(true);
    sinkTimer.current = setTimeout(() => setSinking(false), 480);
    onToggleDone(true);
  };
  const handleReopen = () => {
    clearTimeout(sinkTimer.current);
    setSinking(false);
    onToggleDone(false);
  };

  return (
    <div
      className={"s-vessel" + (done ? " s-vessel--done" : "") + (isCursor ? " s-vessel--cursor" : "") + (settling ? " s-vessel--sailin" : "") + (sinking ? " s-vessel--sinking" : "") + (adrift ? " s-vessel--adrift" : "")}
      style={{ "--bob-delay": `${(index || 0) * 0.35}s`, flexWrap: "wrap", rowGap: 0 }}
      onMouseEnter={onHoverCursor}
    >
      <span className="s-vessel-wake" aria-hidden />
      {index != null && (
        <span className="s-num" style={{ fontSize: 10.5, color: "var(--fg-faint)", flexShrink: 0, marginTop: 4, minWidth: 17 }}>
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
      <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
        <CompleteButton done={done} onComplete={handleComplete} onReopen={handleReopen} />
        {sinking && (
          <>
            <span className="s-ripple" aria-hidden />
            <span className="s-ripple s-ripple--late" aria-hidden />
          </>
        )}
      </span>
      <div className="s-vessel-body" style={{ cursor: onToggleExpand ? "pointer" : "default" }}
        onClick={onToggleExpand || undefined}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="s-vessel-title" style={{ minWidth: 0 }}>{task.title}</span>
          {task.aiPending && (
            <span className="s-num" title="AI is scoring this task — the numbers may refine in a moment"
              style={{ fontSize: 9, color: "var(--amber-hot)", flexShrink: 0 }}>AI…</span>
          )}
          {task.recurring && task.recurring !== "none" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--fg-faint)", fontSize: 10, flexShrink: 0 }}>
              <Icon name="recur" size={10} /> {task.recurring}
            </span>
          )}
          <DeadlineStamp task={{ ...task, completed: done }} />
          {showAge && !done && task.recurring === "none" && ageDays > 7 && (
            <span className="s-chip" title={`Pending ${ageDays} days`}
              style={{ flexShrink: 0, color: ageDays > 14 ? "var(--amber-deep)" : undefined, borderColor: ageDays > 14 ? "var(--amber)" : undefined }}>
              {ageDays}d
            </span>
          )}
        </div>
        <div className="s-vessel-meta" style={{ fontSize: 11, color: "var(--fg-dim)" }}>
          {project && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: done ? "var(--fg-faint)" : project.color }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: done ? "var(--fg-faint)" : project.color, flexShrink: 0 }} />
              <span className="s-num" style={{ fontSize: 10, letterSpacing: ".04em" }}>{project.title.toUpperCase()}</span>
            </span>
          )}
          <PriorityDot p={task.priority || "medium"} />
          <span title={diff.label} style={{ display: "inline-flex", alignItems: "center", gap: 2.5 }}>
            {Array.from({ length: diffIdx + 1 }, (_, i) => <DifficultyPip key={i} d={task.difficulty || "medium"} />)}
          </span>
          <span className="s-num" style={{ fontSize: 10.5 }}>{taskHours(task)}H</span>
          {splitBadge && <span className="s-chip">{splitBadge}</span>}
          {chunkLabel && <span className="s-chip">{chunkLabel}</span>}
          {chunkNote && <span style={{ fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }} title={chunkNote}>{chunkNote}</span>}
          {(task.tags || []).map((t) => <span key={t} className="s-num" style={{ fontSize: 10, color: "var(--fg-faint)" }}>#{t}</span>)}
          {sub.length > 0 && <span className="s-num" style={{ fontSize: 10, color: "var(--fg-faint)" }}>{doneSub}/{sub.length} STEPS</span>}
          <ActualsReadout task={task} done={done} dayStartHour={dayStartHour} />
        </div>
      </div>
      <span className="s-num" title={`${diff.label} · ~${taskHours(task)}h · ${task.xp} XP`}
        style={{ color: "var(--water)", fontWeight: 600, fontSize: 11.5, flexShrink: 0, marginTop: 2 }}>
        +{task.xp} XP
      </span>
      {!compact && (
        <div className="s-vessel-actions">
          {!done && (
            <button className="s-icon-btn" onClick={(e) => { e.stopPropagation(); setUI({ focusTaskId: task.id }); }} aria-label="Enter focus mode" title="Focus (F)"><Icon name="focus" size={13} /></button>
          )}
          <button className="s-icon-btn" onClick={(e) => { e.stopPropagation(); setUI({ editingTaskId: task.id, formOpen: true }); }} aria-label="Edit" title="Edit (E)"><Icon name="edit" size={13} /></button>
          <button className="s-icon-btn" onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} aria-label="Delete" title="Uit de vaart (undoable)"><Icon name="close" size={13} /></button>
        </div>
      )}

      {!compact && expanded && (
        <div className="s-vessel-expand s-fade-in" style={{ flexBasis: "100%" }}>
          {task.desc && <div style={{ fontSize: 12.5, color: "var(--fg-dim)", lineHeight: 1.55, marginBottom: 8 }}>{task.desc}</div>}
          {task.notes && <div style={{ fontSize: 12, color: "var(--fg-dim)", fontStyle: "italic", marginBottom: 8 }}>{task.notes}</div>}
          {sub.length > 0 && (
            <div>
              <div className="s-stencil" style={{ marginBottom: 6 }}>Steps</div>
              {sub.map((s) => (
                <div key={s.id} onClick={() => toggleSubtask(task.id, s.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer" }}>
                  <CompleteButton size={15} done={s.done} onComplete={() => toggleSubtask(task.id, s.id)} onReopen={() => toggleSubtask(task.id, s.id)} label="toggle step" />
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
      <div className="s-stencil" style={{ marginBottom: 6 }}>Split across {chunks.length} days</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {chunks.map((c) => {
          const isPast = c.date < todayIso;
          const isToday = c.date === todayIso;
          return (
            <div key={keyOf(c)} className="s-chunk" style={{
              marginBottom: 0, gap: 8, padding: "6px 10px", flexWrap: "wrap",
              opacity: c.item.done ? 0.6 : 1,
            }}>
              <CompleteButton size={18} done={!!c.item.done}
                onComplete={() => setCompletion(task.id, { done: true, chunkDate: c.date })}
                onReopen={() => setCompletion(task.id, { done: false, chunkDate: c.date })} />
              <input type="date" value={c.date} disabled={c.item.done}
                onChange={(e) => { const v = e.target.value; if (v && v !== c.date) moveChunkDate(task.id, c.date, v); }}
                className="s-field"
                style={{ width: 132, padding: "3px 7px", fontSize: 11, color: c.item.done ? "var(--starboard)" : isToday ? "var(--amber)" : isPast ? "var(--warn)" : "var(--fg)" }} />
              {(isToday || (isPast && !c.item.done)) && (
                <span className="s-chip" style={{ fontSize: 9, padding: "1px 6px", color: isToday ? "var(--water)" : "var(--amber-deep)", borderColor: isToday ? "var(--water)" : "var(--amber)" }}>
                  {isToday ? "TODAY" : "LATE"}
                </span>
              )}
              <input type="number" min="0.25" max="24" step="0.25" placeholder="hrs" disabled={c.item.done}
                value={valOr(c, "hours")}
                onChange={(e) => setVal(c, "hours", e.target.value)}
                onBlur={() => commit(c, "hours")}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
                className="s-field s-num" style={{ width: 58, textAlign: "center", padding: "3px 6px", fontSize: 11.5 }} />
              <input type="text" placeholder="What happens this day" disabled={c.item.done}
                value={valOr(c, "note")}
                onChange={(e) => setVal(c, "note", e.target.value)}
                onBlur={() => commit(c, "note")}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
                className="s-field" style={{ flex: 1, minWidth: 140, padding: "3px 8px", fontSize: 12 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
