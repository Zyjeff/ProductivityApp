// pane.jsx — the paper pane: a place, not a popup.
// Resting state is the garden. Opening a task slides a task sheet over
// it. The writing desk (formOpen) occupies the same slot.
//
// API (W2 agents — read HANDOFF-W1.md):
//   Wrap the shell in <PaneProvider>. Views call:
//     const { selectedTaskId, openTask, closeTask } = usePane();
//   Row click → openTask(id). Close × → closeTask().
//   `e` / Edit still uses core formOpen; the pane flips to the desk.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Icon, BudButton, TagChip } from "./components.jsx";
import { Tree, Lantern } from "./garden.jsx";
import { ChunksEditor } from "./taskrow.jsx";
import { TaskFormModal } from "./taskform.jsx";
import * as D from "../../core/domain.js";
import {
  useStore, getState, sel, setUI, setCompletion, updateTask, deleteTask,
  toggleSubtask, pinTaskToDate, todayLineup,
} from "../../core/store.js";

const PaneCtx = createContext(null);

export function usePane() {
  return useContext(PaneCtx) || { selectedTaskId: null, openTask() {}, closeTask() {} };
}
export function usePaneState() { return usePane(); }

export function PaneProvider({ children }) {
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const tasks = useStore((s) => s.tasks);

  const openTask = useCallback((id) => {
    if (!id) return;
    setSelectedTaskId(id);
    const ui = getState().ui;
    if (ui.formOpen) setUI({ formOpen: false, editingTaskId: null });
  }, []);

  const closeTask = useCallback(() => setSelectedTaskId(null), []);

  useEffect(() => {
    if (selectedTaskId && !tasks.some((t) => t.id === selectedTaskId)) setSelectedTaskId(null);
  }, [tasks, selectedTaskId]);

  const value = useMemo(
    () => ({ selectedTaskId, openTask, closeTask, setSelectedTaskId }),
    [selectedTaskId, openTask, closeTask]
  );
  return <PaneCtx.Provider value={value}>{children}</PaneCtx.Provider>;
}

export function PaperPane({ view }) {
  const formOpen = useStore((s) => s.ui.formOpen);
  const { selectedTaskId, closeTask } = usePane();
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(max-width: 1080px)");
    const apply = () => setNarrow(!!mq.matches);
    apply();
    if (mq.addEventListener) mq.addEventListener("change", apply);
    else mq.addListener(apply);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", apply);
      else mq.removeListener(apply);
    };
  }, []);
  const detail = !!(formOpen || selectedTaskId);
  const needed = detail || (view !== "plan" && !narrow);
  return (
    <>
      {needed && formOpen && (
        <div className="yz-pane-backdrop" onClick={() => setUI({ formOpen: false, editingTaskId: null })} />
      )}
      {needed && !formOpen && selectedTaskId && (
        <div className="yz-pane-backdrop" onClick={closeTask} />
      )}
      {needed && (
        <aside className={"yz-pane" + ((formOpen || selectedTaskId) ? " yz-pane--paper" : "")} aria-label={formOpen ? "Writing desk" : selectedTaskId ? "Task sheet" : "Garden"}>
          <div className="yz-pane-frame">
            {formOpen ? <TaskFormModal embedded /> : selectedTaskId ? <TaskSheet taskId={selectedTaskId} /> : <GardenPane />}
          </div>
        </aside>
      )}
    </>
  );
}

/* ── garden (resting) ───────────────────────────────────────── */

export function GardenPane() {
  const tasks = useStore((s) => s.tasks);
  const plan = useStore((s) => s.plan);
  const projects = useStore((s) => s.projects);
  const meta = useStore((s) => s.meta);
  const energy = useStore((s) => s.ui.energy);
  const level = useStore(sel.level);
  const streak = useStore(sel.streak);
  const hour = meta.dayStartHour || 0;
  const todayIso = D.effectiveTodayIso(hour);

  const lineup = useMemo(() => todayLineup(getState()), [tasks, plan, energy, hour, meta]);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const garden = useMemo(() => {
    const activity = D.activityByDay(tasks, plan, hour);
    const blossoms = activity.get(todayIso)?.size || 0;
    const buds = lineup.filter((r) => !r.doneHere).length;
    const monday = D.isoDate(D.mondayOf(D.effectiveToday(hour)));
    let groundPetals = 0;
    for (let i = 0; i < 7; i++) {
      const iso = D.isoDate(D.addDays(D.parseIsoDate(monday), i));
      groundPetals += activity.get(iso)?.size || 0;
    }
    const pending = tasks.filter((t) => !t.completed && t.recurring === "none");
    const ready = projects.filter((p) => !p.completedAt && (p.childTaskIds || []).length > 0 && D.progressOfProject(p, tasksById) === 100);
    const todayXP = D.todayXP(tasks, plan, hour);
    const xpLeft = lineup.reduce((n, r) => n + (r.doneHere ? 0 : (r.task.xp || 0)), 0);
    const slate = todayXP + xpLeft;
    const allDone = lineup.length > 0 && lineup.every((r) => r.doneHere);
    const upcoming = (plan || []).filter((e) => e.date > todayIso && e.items.length).sort((a, b) => a.date.localeCompare(b.date))[0];
    return {
      blossoms, buds, groundPetals, pending: pending.length, linedUp: lineup.length,
      ready, todayXP, xpLeft, slate, allDone, glow: slate > 0 ? todayXP / slate : (allDone ? 1 : 0),
      upcoming,
    };
  }, [tasks, plan, projects, hour, todayIso, lineup, tasksById]);

  const plaque = `${level.title} · ${streak} days tended`;

  return (
    <div className="yz-garden">
      <div className="yz-garden-hero">
        <div className="yz-garden-scene">
          <Tree
            level={level.lvl}
            pct={level.pct}
            blossoms={garden.blossoms}
            buds={garden.buds}
            groundPetals={garden.groundPetals}
            streak={streak}
          />
          <Lantern glow={garden.glow} full={garden.allDone} />
        </div>
        <div className="yz-garden-plaque">{plaque}</div>
      </div>

      <div className="yz-slip">
        <div className="yz-slip-h">The house</div>
        <div style={{ fontSize: 13.5, color: "var(--sumi-dim)", lineHeight: 1.55 }}>
          {garden.pending} waiting · {garden.linedUp} lined up
          {garden.ready.length ? <span style={{ color: "var(--starboard)" }}> · {garden.ready.length} ready to seal</span> : null}
        </div>
      </div>

      {garden.ready.length > 0 && (
        <div className="yz-slip">
          <div className="yz-slip-h">Ready to seal</div>
          {garden.ready.slice(0, 4).map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <i className="yz-dot" style={{ background: p.color || "var(--starboard)" }} />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{p.title}</span>
              <button type="button" className="yz-btn yz-btn--sm yz-btn--leaf"
                onClick={() => setUI({ view: "dock", statsOpen: false, cursor: null, dockFilter: { ...getState().ui.dockFilter, tab: "projects", project: p.id } })}>
                Lists
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="yz-slip">
        <div className="yz-slip-h">Next planned{garden.upcoming ? ` · ${D.fmtIsoShort(garden.upcoming.date)}` : ""}</div>
        {garden.upcoming ? (
          <>
            {garden.upcoming.items.slice(0, 4).map((it) => {
              const t = tasksById.get(it.taskId);
              if (!t) return null;
              return (
                <div key={it.taskId} style={{ fontSize: 12.5, color: "var(--sumi-dim)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.title}{it.note ? <em style={{ color: "var(--sumi-faint)" }}> — {it.note}</em> : null}
                </div>
              );
            })}
            <button type="button" className="yz-link" style={{ marginTop: 6 }} onClick={() => setUI({ view: "plan", cursor: null, statsOpen: false })}>Week →</button>
          </>
        ) : (
          <div style={{ fontSize: 12, color: "var(--sumi-faint)" }}>Nothing on the next page yet.</div>
        )}
      </div>
    </div>
  );
}

/* ── task sheet (5.10) ──────────────────────────────────────── */

export function TaskSheet({ taskId }) {
  const { closeTask } = usePane();
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId));
  const projects = useStore((s) => s.projects);
  const plan = useStore((s) => s.plan);
  const hour = useStore((s) => s.meta.dayStartHour || 0);
  const todayIso = D.effectiveTodayIso(hour);
  const project = task?.projectId ? projects.find((p) => p.id === task.projectId) : null;
  const chunks = useMemo(() => (task ? D.getTaskChunks(task.id, plan) : []), [task, plan]);
  const split = chunks.length > 1;
  const todayChunk = chunks.find((c) => c.date === todayIso);
  const done = todayChunk ? !!todayChunk.item.done : !!task?.completed;

  const [title, setTitle] = useState(task?.title || "");
  const [descEdit, setDescEdit] = useState(false);
  const [desc, setDesc] = useState(task?.desc || "");
  const [notesEdit, setNotesEdit] = useState(false);
  const [notes, setNotes] = useState(task?.notes || "");
  const [newSub, setNewSub] = useState("");

  useEffect(() => {
    setTitle(task?.title || "");
    setDesc(task?.desc || "");
    setNotes(task?.notes || "");
    setDescEdit(false);
    setNotesEdit(false);
  }, [taskId, task?.title, task?.desc, task?.notes]);

  if (!task) return null;

  const commitTitle = () => {
    const v = title.trim();
    if (v && v !== task.title) updateTask(task.id, { title: v });
    else setTitle(task.title);
  };
  const commitField = (field, value, setEditing) => {
    if (value !== (task[field] || "")) updateTask(task.id, { [field]: value });
    setEditing(false);
  };
  const onMetaEnter = (e, fn) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); fn(); }
  };
  const addSub = () => {
    const v = newSub.trim();
    if (!v) return;
    updateTask(task.id, { subtasks: [...(task.subtasks || []).map((s) => s.title), v] });
    setNewSub("");
  };
  const scheduled = D.getTaskScheduledDate(task.id, plan);
  const complete = () => setCompletion(task.id, { done: !done, chunkDate: todayChunk ? todayIso : null });

  return (
    <div className="yz-sheet-task">
      <div className="yz-sheet-task-top">
        <input className="yz-title-input" value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
          aria-label="Task title" />
        <button type="button" className="yz-icon-btn" onClick={closeTask} aria-label="Close task sheet" title="Close">
          <Icon name="close" size={14} />
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {project && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--sumi-dim)" }}>
            <i className="yz-dot" style={{ background: project.color }} />
            {project.title}
          </span>
        )}
        {(task.tags || []).map((t) => <TagChip key={t} tag={t} />)}
      </div>

      <h2 className="yz-sec" style={{ margin: "14px 0 4px" }}>Description</h2>
      {descEdit ? (
        <textarea className="yz-field" value={desc} onChange={(e) => setDesc(e.target.value)}
          onBlur={() => commitField("desc", desc, setDescEdit)}
          onKeyDown={(e) => onMetaEnter(e, () => commitField("desc", desc, setDescEdit))}
          autoFocus rows={5} />
      ) : (
        <div className={"yz-prose" + (task.desc ? "" : " is-empty")} onClick={() => setDescEdit(true)}>
          {task.desc || "Add a description…"}
        </div>
      )}

      <h2 className="yz-sec" style={{ margin: "14px 0 4px" }}>Notes</h2>
      {notesEdit ? (
        <textarea className="yz-field" value={notes} onChange={(e) => setNotes(e.target.value)}
          onBlur={() => commitField("notes", notes, setNotesEdit)}
          onKeyDown={(e) => onMetaEnter(e, () => commitField("notes", notes, setNotesEdit))}
          autoFocus rows={3} />
      ) : (
        <div className={"yz-prose" + (task.notes ? "" : " is-empty")} onClick={() => setNotesEdit(true)}>
          {task.notes || "Add a note…"}
        </div>
      )}

      <h2 className="yz-sec" style={{ margin: "14px 0 4px" }}>Subtasks</h2>
      <div>
        {(task.subtasks || []).map((s) => (
          <div key={s.id} className="yz-sub" onClick={() => toggleSubtask(task.id, s.id)}>
            <BudButton square size={16} done={s.done}
              onComplete={() => toggleSubtask(task.id, s.id)}
              onReopen={() => toggleSubtask(task.id, s.id)}
              label="toggle step" />
            <span style={{ fontSize: 13, color: s.done ? "var(--sumi-faint)" : "var(--sumi)", textDecoration: s.done ? "line-through" : "none" }}>{s.title}</span>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input className="yz-field" placeholder="Add a step" value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } }} />
          <button type="button" className="yz-btn yz-btn--sm yz-btn--ghost" onClick={addSub}>Add</button>
        </div>
      </div>

      {split && <ChunksEditor task={task} chunks={chunks} dayStartHour={hour} />}

      <dl className="yz-deflist">
        <div>
          <dt>Priority</dt>
          <dd>{task.priority || "medium"}</dd>
        </div>
        <div>
          <dt>Difficulty</dt>
          <dd>{task.difficulty || "medium"}</dd>
        </div>
        <div>
          <dt>Hours</dt>
          <dd className="yz-num">{D.taskHours(task)}h</dd>
        </div>
        <div>
          <dt>XP</dt>
          <dd className="yz-num">+{task.xp}</dd>
        </div>
        {scheduled && (
          <div>
            <dt>Scheduled</dt>
            <dd>{D.fmtIsoShort(scheduled)}</dd>
          </div>
        )}
        {task.deadlineAt && (
          <div>
            <dt>Deadline</dt>
            <dd style={{ color: "var(--port)" }}>{new Date(task.deadlineAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</dd>
          </div>
        )}
        {task.recurring && task.recurring !== "none" && (
          <div>
            <dt>Repeats</dt>
            <dd>{task.recurring}</dd>
          </div>
        )}
      </dl>

      <div className="yz-actions">
        <button type="button" className="yz-btn" onClick={complete}>{done ? "Reopen" : "Complete"}</button>
        {!done && (
          <button type="button" className="yz-btn yz-btn--ghost" onClick={() => setUI({ focusTaskId: task.id })}>Focus</button>
        )}
        <button type="button" className="yz-btn yz-btn--ghost" onClick={() => pinTaskToDate(task.id, todayIso)}>Today</button>
        <button type="button" className="yz-btn yz-btn--ghost" onClick={() => setUI({ formOpen: true, editingTaskId: task.id })}>Edit</button>
        <button type="button" className="yz-btn yz-btn--port yz-btn--ghost" onClick={() => { deleteTask(task.id); closeTask(); }}>Sweep away</button>
      </div>
      <p className="yz-sheet-hint">Close returns the garden. Edit opens the desk.</p>
    </div>
  );
}
