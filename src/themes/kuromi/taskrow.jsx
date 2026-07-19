import React, { useMemo, useState } from "react";
import {
  setCompletion,
  updateTask,
  toggleSubtask,
  deleteTask,
  updateChunk,
  dismissChunk,
  setUI,
  useStore,
} from "../../core/store.js";
import * as D from "../../core/domain.js";
import { Icon, Kbd, PriorityDot, SkullBox, Tag } from "./components.jsx";

/* ── ChunksEditor: the split-scheme ledger ───────────────────── */
export function ChunksEditor({ task, todayIso }) {
  const plan = useStore((s) => s.plan);
  const chunks = useMemo(() => D.getTaskChunks(task.id, plan), [task.id, plan]);
  if (!chunks.length) return null;

  return (
    <div className="k-mt">
      <div className="k-eyebrow is-violet">SPLIT SCHEME</div>
      {chunks.map((c) => (
        <div key={c.date} className="k-rowline" style={{ marginBottom: 7 }}>
          <span className="k-mono-sm k-violet k-nowrap">{D.fmtIsoShort(c.date)}</span>
          <input
            className="k-input"
            style={{ width: 74, padding: "4px 8px" }}
            type="number"
            min="0.25"
            step="0.25"
            defaultValue={c.hours ?? ""}
            placeholder="hrs"
            onBlur={(e) => {
              const h = parseFloat(e.target.value);
              if (!isNaN(h) && h > 0 && h !== c.hours) updateChunk(task.id, c.date, { hours: h });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.target.blur();
            }}
          />
          <input
            className="k-input"
            style={{ flex: 1, padding: "4px 8px" }}
            defaultValue={c.note || ""}
            placeholder="what happens in this part…"
            onBlur={(e) => {
              if (e.target.value !== (c.note || "")) updateChunk(task.id, c.date, { note: e.target.value });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.target.blur();
            }}
          />
          {c.done ? (
            <span className="k-mono-sm k-green">done</span>
          ) : (
            <button
              className="k-mini-btn"
              title="unschedule this part"
              onClick={() => dismissChunk(task.id, c.date)}
            >
              <Icon name="x" size={10} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── TaskRow: one scheme in the list ─────────────────────────── */
export function TaskRow({
  task,
  chunk,          // optional plan chunk for today rows
  doneHere,
  chunkLabel,
  chunkNote,
  recurringRow,
  cursor = false,
  globalIdx,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  dragState,      // "drag" | "dragover" | null
  badge,          // extra row-sub chip (split/schedule info)
  children,       // extra row content (project ledger etc.)
}) {
  const [open, setOpen] = useState(false);
  const hour = useStore((s) => s.meta.dayStartHour);
  const todayIso = D.effectiveTodayIso(hour);
  const done = doneHere ?? task.completed;

  const complete = () => {
    if (recurringRow) {
      setCompletion(task.id, { done: !done, dateIso: todayIso });
    } else if (chunk) {
      setCompletion(task.id, { done: !done, chunkDate: todayIso });
    } else {
      setCompletion(task.id, { done: !done });
    }
  };

  const subtasks = task.subtasks || [];
  const subsDone = subtasks.filter((s) => s.done).length;

  return (
    <div>
      <div
        className={
          "k-row" +
          (cursor ? " is-cursor" : "") +
          (done ? " is-done" : "") +
          (dragState === "drag" ? " is-drag" : "") +
          (dragState === "dragover" ? " is-dragover" : "")
        }
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onMouseEnter={() => { if (globalIdx != null) setUI({ cursor: { index: globalIdx } }); }}
      >
        <SkullBox done={done} onClick={complete} title={done ? "reopen (X)" : "pull it off (X)"} />
        <div className="k-row-main" onClick={() => setOpen((o) => !o)} style={{ cursor: "pointer" }}>
          <div className="k-row-title">
            {recurringRow && <span className="k-violet" title="recurring">↻ </span>}
            {chunkLabel && <span className="k-pink">{chunkLabel} </span>}
            {task.title}
          </div>
          <div className="k-row-sub">
            <PriorityDot priority={task.priority} />
            {chunkNote && <span className="k-faint">· {chunkNote}</span>}
            {chunk?.hours != null && <span className="k-pink">{chunk.hours}h</span>}
            {!chunk && task.hours != null && <span>{task.hours}h</span>}
            {subtasks.length > 0 && (
              <span>
                {subsDone}/{subtasks.length} steps
              </span>
            )}
            {(task.tags || []).slice(0, 3).map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
            {badge && <span className="k-faint">▸ {badge}</span>}
            {task.deadlineAt && <span className="k-warn">☠ {D.fmtDate(task.deadlineAt)}</span>}
          </div>
        </div>
        <span className="k-row-xp">
          {task.xp}
          <span className="k-lab"> XP</span>
        </span>
        <div className="k-row-acts">
          <button
            className="k-mini-btn"
            title="mischief mode (F)"
            onClick={() => setUI({ focusTaskId: task.id })}
          >
            <Icon name="play" size={10} />
          </button>
          <button
            className="k-mini-btn"
            title="edit (E)"
            onClick={() => setUI({ formOpen: true, editingTaskId: task.id })}
          >
            <Icon name="pen" size={10} />
          </button>
          <button
            className="k-mini-btn"
            title="scuttle (Del)"
            onClick={() => deleteTask(task.id)}
          >
            <Icon name="trash" size={10} />
          </button>
        </div>
      </div>

      {open && (
        <div className="k-row-expand">
          {task.desc && <p className="k-dim k-sm" style={{ margin: "0 0 10px" }}>{task.desc}</p>}
          {task.notes && (
            <p className="k-faint k-sm" style={{ margin: "0 0 10px", fontStyle: "italic" }}>{task.notes}</p>
          )}
          {subtasks.length > 0 && (
            <div className="k-mb">
              {subtasks.map((s) => (
                <div
                  key={s.id}
                  className={"k-sub" + (s.done ? " is-done" : "")}
                  onClick={() => toggleSubtask(task.id, s.id)}
                >
                  <span className="k-sub-dot" />
                  <span className="k-sub-title">{s.title}</span>
                </div>
              ))}
            </div>
          )}
          <ChunksEditor task={task} todayIso={todayIso} />
          <div className="k-rowline k-mono-sm k-faint" style={{ marginTop: 10, gap: 12 }}>
            <span>
              <Kbd>X</Kbd> pull off
            </span>
            <span>
              <Kbd>E</Kbd> edit
            </span>
            <span>
              <Kbd>F</Kbd> focus
            </span>
            <span>
              <Kbd>Del</Kbd> scuttle
            </span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
