// store.js — one store, one completion mutation, undo everywhere.
// Views subscribe via useStore(selector). All XP/streak/level numbers
// are derived in selectors from domain.js — never written.

import { useSyncExternalStore, useRef } from "react";
import * as D from "./domain.js";
import * as db from "./db.js";

/* ── core ──────────────────────────────────────────────────── */

let state = null;
const listeners = new Set();

export function getState() { return state; }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() {
  // One faulty listener must never starve the others (React's
  // subscriptions live in this set).
  for (const fn of [...listeners]) {
    try { fn(); } catch (e) { console.error("werf: listener failed", e); }
  }
}

// set() replaces slices immutably, persists the named slices, emits.
function set(patch, slices = Object.keys(patch)) {
  state = { ...state, ...patch };
  db.persist(state, slices.filter((s) => s !== "ui"));
  emit();
}
function setUI(patch) {
  state = { ...state, ui: { ...state.ui, ...patch } };
  emit();
}
export { setUI };

export function initStore(storage = window.localStorage) {
  db.bindPersistence(storage);
  const loaded = db.loadState(storage);
  state = {
    ...loaded,
    caps: loaded.caps || { ...D.DEFAULT_CAPS },
    ui: {
      view: "today",                 // today | plan | dock
      statsOpen: false,
      paletteOpen: false,
      helpOpen: false,
      captureMode: "task",
      editingTaskId: null,
      formOpen: false,
      focusTaskId: null,
      reviewWeek: null,
      launchNoteFor: null,
      energy: "normal",
      toast: null,                   // { msg, xp?, undoId? }
      confetti: 0,
      levelUp: null,
      endOfDayOpen: false,
      previewMode: !!loaded.previewSnapshot,
      aiStatus: "unknown",           // unknown | ok | off | busy
      aiDetail: "",
      dockFilter: { tab: "projects", status: "pending", project: null, tag: null, sort: "priority", q: "" },
      cursor: null,                  // keyboard cursor: { list, index }
      externalChange: false,
    },
  };
  db.maybeBackup(storage, state, state.meta.dayStartHour);
  // Cross-tab awareness: warn instead of silently clobbering.
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key && e.key.startsWith("werf_") && !e.key.startsWith(db.KEYS.backupPrefix)) {
        setUI({ externalChange: true });
      }
    });
  }
  emit();
}

function shallowEq(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.is(a[k], b[k])) return false;
  return true;
}

export function useStore(selector) {
  // getSnapshot must return a STABLE reference for an unchanged store,
  // or React loops. Cache on state identity (state only changes via
  // set(), immutably) and keep the previous result when shallow-equal.
  const ref = useRef({ state: null, value: undefined, selector: null });
  ref.current.selector = selector;
  return useSyncExternalStore(subscribe, () => {
    const c = ref.current;
    if (c.state === state) return c.value;
    const next = c.selector(state);
    c.state = state;
    if (c.value !== undefined && shallowEq(next, c.value)) return c.value;
    c.value = next;
    return next;
  });
}

/* ── toasts + undo ─────────────────────────────────────────── */

let toastTimer = null;
const undoStack = new Map(); // undoId → fn
let undoSeq = 0;

export function notify(msg, xp = null, undoFn = null) {
  let undoId = null;
  if (undoFn) {
    undoId = ++undoSeq;
    undoStack.set(undoId, undoFn);
    // Undo entries expire with their toast.
    setTimeout(() => undoStack.delete(undoId), 8000);
  }
  setUI({ toast: { msg, xp, undoId, at: Date.now() } });
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => setUI({ toast: null }), undoFn ? 6000 : 2600);
}
export function runUndo(undoId) {
  const fn = undoStack.get(undoId);
  if (fn) { undoStack.delete(undoId); fn(); }
  setUI({ toast: null });
}
export function undoLast() {
  const ids = [...undoStack.keys()];
  if (ids.length) runUndo(ids[ids.length - 1]);
}

/* ── derived selectors ─────────────────────────────────────── */

export const sel = {
  dayStartHour: (s) => s.meta.dayStartHour || 0,
  todayIso: (s) => D.effectiveTodayIso(s.meta.dayStartHour || 0),
  tasksById: (s) => {
    const m = new Map();
    for (const t of s.tasks) m.set(t.id, t);
    return m;
  },
  projectsById: (s) => {
    const m = new Map();
    for (const p of s.projects) m.set(p.id, p);
    return m;
  },
  totalXP: (s) => D.totalXP(s.tasks, s.plan, s.meta.xpBaseline, s.meta.dayStartHour),
  todayXP: (s) => D.todayXP(s.tasks, s.plan, s.meta.dayStartHour),
  streak: (s) => D.streak(s.tasks, s.plan, s.meta.dayStartHour),
  level: (s) => D.levelInfo(D.totalXP(s.tasks, s.plan, s.meta.xpBaseline, s.meta.dayStartHour)),
  missed: (s) => D.getMissedWork(s.tasks, s.plan, s.meta.dayStartHour),
};

// Today's lineup: recurring tasks due now + today's scheduled chunks.
// Each entry: { task, chunk?, doneHere, chunkLabel?, chunkNote? }
export function todayLineup(s) {
  const hour = s.meta.dayStartHour || 0;
  const todayIso = D.effectiveTodayIso(hour);
  const byId = new Map(s.tasks.map((t) => [t.id, t]));
  const entry = (s.plan || []).find((e) => e.date === todayIso);
  const rows = [];
  for (const t of s.tasks) {
    if (t.recurring === "daily" || t.recurring === "weekly") {
      rows.push({ task: t, doneHere: D.isRecurringDoneNow(t, hour), recurringRow: true });
    }
  }
  const seen = new Set();
  for (const it of entry?.items || []) {
    const t = byId.get(it.taskId);
    if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    const chunks = D.getTaskChunks(t.id, s.plan);
    const idx = chunks.findIndex((c) => c.date === todayIso);
    rows.push({
      task: t,
      chunk: it,
      doneHere: !!(it.done || t.completed),
      chunkLabel: chunks.length > 1 && idx >= 0 ? `${idx + 1}/${chunks.length}` : null,
      chunkNote: it.note || null,
    });
  }
  const energySorted = D.sortForEnergy(rows.map((r) => ({ ...r, priority: r.task.priority, difficulty: r.task.difficulty })), s.ui.energy)
    .map(({ priority, difficulty, ...r }) => r);
  // User-owned run order (F3) wins over the energy heuristic: rows the
  // user has placed keep their placement; new arrivals append in energy
  // order after them.
  const order = s.meta.lineupOrder?.[todayIso];
  if (!order || !order.length) return energySorted;
  const pos = new Map(order.map((id, i) => [id, i]));
  const placed = energySorted.filter((r) => pos.has(r.task.id)).sort((a, b) => pos.get(a.task.id) - pos.get(b.task.id));
  const rest = energySorted.filter((r) => !pos.has(r.task.id));
  return [...placed, ...rest];
}

// Persist today's run order (full ordered id list). Old days pruned.
export function setLineupOrder(ids) {
  const hour = state.meta.dayStartHour || 0;
  const todayIso = D.effectiveTodayIso(hour);
  const cutoff = D.isoDate(D.addDays(D.parseIsoDate(todayIso), -7));
  const lineupOrder = {};
  for (const [k, v] of Object.entries(state.meta.lineupOrder || {})) {
    if (k >= cutoff) lineupOrder[k] = v;
  }
  lineupOrder[todayIso] = ids;
  set({ meta: { ...state.meta, lineupOrder } });
}

// Move a lineup row up/down by one. Returns true if it moved.
export function moveLineupRow(taskId, dir) {
  const ids = todayLineup(state).map((r) => r.task.id);
  const idx = ids.indexOf(taskId);
  const to = idx + dir;
  if (idx < 0 || to < 0 || to >= ids.length) return false;
  ids.splice(idx, 1);
  ids.splice(to, 0, taskId);
  setLineupOrder(ids);
  return true;
}

/* ── the ONE completion mutation ───────────────────────────── */
// Everything that completes work goes through here. Semantics:
//  - recurring task: toggles today's (or dateIso's) history entry
//  - task with chunks, chunkDate given: toggles that chunk; task
//    auto-completes when all chunks done, auto-reopens otherwise
//  - task without chunkDate: completes the task AND all its chunks
// XP is never written — the ledger derives it. The toast shows the
// delta by diffing derived todayXP before/after.
export function setCompletion(taskId, { done, chunkDate = null, dateIso = null } = {}) {
  const s = state;
  const hour = s.meta.dayStartHour || 0;
  const task = s.tasks.find((t) => t.id === taskId);
  if (!task) return;
  const before = D.totalXP(s.tasks, s.plan, 0, hour);

  let tasks = s.tasks;
  let plan = s.plan;

  if (task.recurring === "daily" || task.recurring === "weekly") {
    const target = dateIso || D.effectiveTodayIso(hour);
    const history = task.history || [];
    const nextHistory = done
      ? Array.from(new Set([...history, target])).sort()
      : history.filter((d) => d !== target);
    tasks = tasks.map((t) => t.id === taskId ? {
      ...t,
      history: nextHistory,
      completed: D.isRecurringDoneNow({ ...t, history: nextHistory }, hour),
      completedAt: done ? Date.now() : t.completedAt,
    } : t);
  } else if (chunkDate) {
    const res = D.setChunkDone(plan, taskId, chunkDate, done);
    plan = res.plan;
    const nowCompleted = res.allDone;
    if (nowCompleted !== task.completed) {
      tasks = tasks.map((t) => t.id === taskId
        ? { ...t, completed: nowCompleted, completedAt: nowCompleted ? Date.now() : null }
        : t);
    }
  } else {
    tasks = tasks.map((t) => t.id === taskId
      ? { ...t, completed: done, completedAt: done ? Date.now() : null }
      : t);
    plan = D.setAllChunksDone(plan, taskId, done);
  }

  set({ tasks, plan });

  const after = D.totalXP(tasks, plan, 0, hour);
  const delta = after - before;
  const nowTask = tasks.find((t) => t.id === taskId);
  const chunks = D.getTaskChunks(taskId, plan);
  const doneChunks = chunks.filter((c) => c.item.done).length;

  let msg;
  if (done && nowTask.completed) msg = "Done";
  else if (done && chunkDate && chunks.length > 1) msg = `Chunk done · ${doneChunks}/${chunks.length}`;
  else if (done) msg = "Logged";
  else msg = "Reopened";
  notify(msg, delta || null, done ? () => setCompletion(taskId, { done: false, chunkDate, dateIso }) : null);

  // Day-cleared moment: once per effective day, when the LAST lineup
  // item lands. (The original only counted dailies — dead-schema bug.)
  if (done) {
    const todayIsoNow = D.effectiveTodayIso(hour);
    const rows = todayLineup(state);
    if (rows.length > 0 && rows.every((r) => r.doneHere) && state.meta.dayClearedShown !== todayIsoNow) {
      set({ meta: { ...state.meta, dayClearedShown: todayIsoNow } });
      setTimeout(() => notify("Day cleared. Solid day."), 1400);
    }
  }

  checkNewAchievements();
  if (done && nowTask.completed && nowTask.projectId) {
    const proj = state.projects.find((p) => p.id === nowTask.projectId);
    if (proj && !proj.completedAt) {
      const allDone = (proj.childTaskIds || []).every((cid) => {
        const c = tasks.find((t) => t.id === cid);
        return c ? c.completed : true;
      });
      if (allDone && (proj.childTaskIds || []).length > 0) notify("Ready to launch: " + proj.title);
    }
  }
  if (!done && nowTask.projectId) {
    // Reopening a task un-ships its project (mirrors quest behavior).
    const proj = state.projects.find((p) => p.id === nowTask.projectId);
    if (proj && proj.completedAt) {
      set({ projects: state.projects.map((p) => p.id === proj.id ? { ...p, completedAt: null, shippedAt: null } : p) });
    }
  }
}

/* ── achievements ──────────────────────────────────────────── */

function checkNewAchievements() {
  const s = state;
  const hour = s.meta.dayStartHour || 0;
  const screenToday = (s.screen || {})[D.effectiveTodayIso(hour)] || null;
  const checks = D.checkAchievements({
    tasks: s.tasks, plan: s.plan, projects: s.projects,
    screenToday, dayStartHour: hour, baseline: s.meta.xpBaseline,
  });
  const fresh = Object.keys(checks).filter((id) => checks[id] && !s.achievements.includes(id));
  if (fresh.length) {
    set({ achievements: [...s.achievements, ...fresh] });
    const def = D.ACHIEVEMENTS.find((a) => a.id === fresh[0]);
    if (def) setTimeout(() => notify("Trophy: " + def.title), 900);
  }
}

let lastLevel = null;
let levelWatcherBusy = false;
export function watchLevel() {
  // Guard order matters: update lastLevel BEFORE the setUI below —
  // setUI synchronously re-enters this watcher via emit(), and with a
  // stale lastLevel that recursion never terminates.
  if (levelWatcherBusy) return;
  const lvl = sel.level(state).lvl;
  const prev = lastLevel;
  lastLevel = lvl;
  if (prev != null && lvl > prev) {
    levelWatcherBusy = true;
    try {
      setUI({ levelUp: { lvl, title: D.LEVEL_NAMES[Math.min(lvl, D.LEVEL_NAMES.length) - 1] }, confetti: state.ui.confetti + 1 });
    } finally {
      levelWatcherBusy = false;
    }
    setTimeout(() => setUI({ levelUp: null }), 2800);
  }
}
subscribeLevelWatcher();
function subscribeLevelWatcher() {
  // Initialized after initStore; subscribe lazily.
  let started = false;
  subscribe(() => {
    if (!state) return;
    if (!started) { lastLevel = sel.level(state).lvl; started = true; return; }
    watchLevel();
  });
}

/* ── task CRUD ─────────────────────────────────────────────── */

export function captureTask(rawTitle, { mode = "task", scheduleToday = false, parsed = null } = {}) {
  const grammar = parsed && parsed.chips?.length ? parsed : null;
  const title = (grammar?.title || rawTitle).trim();
  if (!title) return null;
  const det = D.deterministicScore("medium", grammar?.hours ?? null);
  const recurring = grammar?.recurring || "none";
  const task = {
    id: D.uid(),
    title,                       // grammar-cleaned or raw; AI may tidy async
    desc: "", notes: "",
    tags: grammar?.tags?.length ? [...grammar.tags] : [],
    subtasks: [],
    xp: det.xp, difficulty: "medium", hours: det.hours,
    recurring, history: recurring !== "none" ? [] : undefined,
    priority: grammar?.priority || "medium",
    projectId: grammar?.projectId || null,
    deadlineAt: grammar?.deadlineAt || null,
    completed: false, completedAt: null,
    createdAt: Date.now(), focusMs: 0, focusDate: null,
    aiPending: true,
  };
  let plan = state.plan;
  const pinDate = recurring === "none"
    ? (grammar?.scheduleDate || (scheduleToday ? D.effectiveTodayIso(state.meta.dayStartHour) : null))
    : null;
  if (pinDate) plan = D.pinTask(plan, task.id, pinDate);
  let projects = state.projects;
  if (task.projectId) {
    projects = projects.map((p) => p.id === task.projectId
      ? { ...p, childTaskIds: [...(p.childTaskIds || []), task.id] }
      : p);
  }
  for (const tag of task.tags) {
    if (!D.TAGS_BUILTIN.includes(tag) && !state.customTags.includes(tag)) {
      set({ customTags: [...state.customTags, tag] });
    }
  }
  set({ tasks: [task, ...state.tasks], plan, projects });
  return task;
}

export function applyEnrichment(taskId, patch) {
  if (!state.tasks.some((t) => t.id === taskId)) return;
  set({
    tasks: state.tasks.map((t) => t.id === taskId ? { ...t, ...patch, aiPending: false, justEnriched: Date.now() } : t),
  });
}

export function addTask(data) {
  const hasScore = typeof data.xp === "number" && typeof data.hours === "number";
  const det = D.deterministicScore(data.difficulty || "medium", data.hours);
  const recurring = ["daily", "weekly"].includes(data.recurring) ? data.recurring : "none";
  const task = {
    id: D.uid(),
    title: (data.title || "").trim(),
    desc: data.desc || "", notes: data.notes || "",
    tags: data.tags || [],
    subtasks: (data.subtasks || []).map((st, i) => ({ id: D.uid() + i, title: st, done: false })),
    xp: hasScore ? data.xp : det.xp,
    difficulty: data.difficulty || "medium",
    hours: hasScore ? data.hours : det.hours,
    recurring,
    history: recurring !== "none" ? [] : undefined,
    priority: data.priority || "medium",
    projectId: data.projectId || null,
    deadlineAt: typeof data.deadlineAt === "number" ? data.deadlineAt : null,
    completed: data.completed === true,
    completedAt: data.completed === true ? Date.now() : null,
    createdAt: Date.now(), focusMs: 0, focusDate: null,
    aiPending: !hasScore,
  };
  if (!task.title) return null;
  let plan = state.plan;
  if (data.scheduleDate && recurring === "none") plan = D.pinTask(plan, task.id, data.scheduleDate);
  let projects = state.projects;
  if (task.projectId) {
    projects = projects.map((p) => p.id === task.projectId
      ? { ...p, childTaskIds: [...(p.childTaskIds || []), task.id] }
      : p);
  }
  set({ tasks: [task, ...state.tasks], plan, projects });
  notify("Task added");
  return task;
}

export function updateTask(id, data) {
  const existing = state.tasks.find((t) => t.id === id);
  if (!existing) return;
  const next = { ...existing, ...data };
  if (data.subtasks) {
    next.subtasks = data.subtasks.map((st, i) => {
      const old = (existing.subtasks || []).find((x) => x.title === st);
      return { id: D.uid() + i, title: st, done: old ? old.done : false };
    });
  }
  if (data.recurring && ["daily", "weekly"].includes(data.recurring) && !next.history) next.history = [];
  let tasks = state.tasks.map((t) => (t.id === id ? next : t));
  let plan = state.plan;
  if (data.scheduleDateChanged) plan = D.pinTask(plan, id, data.scheduleDate || null);
  let projects = state.projects;
  if (data.projectIdChanged) {
    const oldP = existing.projectId, newP = data.projectId || null;
    projects = projects.map((p) => {
      const has = (p.childTaskIds || []).includes(id);
      if (p.id === oldP && has) return { ...p, childTaskIds: p.childTaskIds.filter((x) => x !== id) };
      if (p.id === newP && !has) return { ...p, childTaskIds: [...(p.childTaskIds || []), id] };
      return p;
    });
  }
  set({ tasks, plan, projects });
}

export function deleteTask(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  const snapshot = { tasks: state.tasks, plan: state.plan, projects: state.projects };
  const tasks = state.tasks.filter((t) => t.id !== id);
  const plan = state.plan.map((e) => ({ ...e, items: e.items.filter((i) => i.taskId !== id) })).filter((e) => e.items.length);
  const projects = task.projectId
    ? state.projects.map((p) => p.id === task.projectId ? { ...p, childTaskIds: (p.childTaskIds || []).filter((x) => x !== id) } : p)
    : state.projects;
  set({ tasks, plan, projects });
  notify(`Deleted "${task.title.slice(0, 32)}${task.title.length > 32 ? "…" : ""}"`, null, () => {
    set({ tasks: snapshot.tasks, plan: snapshot.plan, projects: snapshot.projects });
  });
}

// Promote a task with subtasks into a project: subtasks become child
// tasks (deterministic-scored; callers may AI-refine), the original
// task and its undone plan chunks disappear. Fully undoable.
export function promoteToProject(taskId) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || !(task.subtasks || []).length) return null;
  const snapshot = { tasks: state.tasks, projects: state.projects, plan: state.plan };
  const projectId = "p-" + D.uid();
  const proj = {
    id: projectId, title: task.title, desc: task.desc || "", notes: task.notes || "",
    type: "other", color: D.pickProjectColor(),
    createdAt: Date.now(), completedAt: null, shippedAt: null, childTaskIds: [],
  };
  const det = D.deterministicScore("medium");
  const children = task.subtasks.map((st, i) => ({
    id: "ct-" + D.uid() + i,
    title: st.title, desc: "", notes: "", tags: task.tags || [], subtasks: [],
    xp: det.xp, difficulty: "medium", hours: det.hours,
    recurring: "none", history: undefined,
    priority: task.priority || "medium",
    projectId, deadlineAt: task.deadlineAt || null,
    completed: !!st.done, completedAt: st.done ? Date.now() : null,
    createdAt: Date.now() + i, focusMs: 0, focusDate: null, aiPending: true,
  }));
  proj.childTaskIds = children.map((c) => c.id);
  set({
    projects: [proj, ...state.projects],
    tasks: [...children, ...state.tasks.filter((t) => t.id !== taskId)],
    plan: state.plan.map((e) => ({ ...e, items: e.items.filter((i) => i.taskId !== taskId) })).filter((e) => e.items.length),
  });
  notify(`Promoted to project · ${children.length} task${children.length > 1 ? "s" : ""}`, null, () => set(snapshot));
  return { projectId, childIds: children.map((c) => c.id) };
}

export function toggleSubtask(taskId, subId) {
  set({
    tasks: state.tasks.map((t) => t.id !== taskId ? t : {
      ...t, subtasks: (t.subtasks || []).map((st) => st.id === subId ? { ...st, done: !st.done } : st),
    }),
  });
}

export function saveFocusTime(taskId, ms) {
  const today = D.effectiveTodayIso(state.meta.dayStartHour);
  set({
    tasks: state.tasks.map((t) => t.id === taskId ? { ...t, focusMs: Math.max(0, Math.round(ms)), focusDate: today } : t),
  });
}

// Append one focus session to the ledger (F4). Sub-minute runs are
// noise, not work — skipped.
export function logSession(taskId, ms) {
  if (!taskId || !(ms >= 60000)) return;
  const entry = {
    id: D.uid(),
    taskId,
    dateIso: D.effectiveTodayIso(state.meta.dayStartHour),
    ms: Math.round(ms),
    at: Date.now(),
  };
  set({ sessions: [...(state.sessions || []), entry] });
}

/* ── plan mutations ────────────────────────────────────────── */

export function pinTaskToDate(taskId, dateIso) {
  set({ plan: D.pinTask(state.plan, taskId, dateIso) });
}
export function moveChunkDate(taskId, fromDate, toDate) {
  set({ plan: D.moveChunk(state.plan, taskId, fromDate, toDate) });
}
export function updateChunk(taskId, dateIso, patch) {
  set({ plan: D.patchChunk(state.plan, taskId, dateIso, patch) });
}
export function dismissChunk(taskId, dateIso) {
  const before = state.plan;
  set({ plan: D.removeChunk(state.plan, taskId, dateIso) });
  notify("Removed from plan", null, () => set({ plan: before }));
}
export function applyPlan(nextPlan, { snapshotLabel = null } = {}) {
  const before = state.plan;
  set({ plan: nextPlan });
  if (snapshotLabel) {
    notify(snapshotLabel, null, () => set({ plan: before }));
  }
}
export function toggleDayLock(iso) {
  const locks = { ...state.locks };
  if (locks[iso]) delete locks[iso]; else locks[iso] = true;
  set({ locks });
}
export function setCaps(caps) { set({ caps }); }

/* ── projects ──────────────────────────────────────────────── */

export function createProject({ title, type = "other", desc = "" }) {
  const proj = {
    id: "p-" + D.uid(), title: title.trim(), desc, notes: "",
    type, color: D.pickProjectColor(),
    createdAt: Date.now(), completedAt: null, shippedAt: null, childTaskIds: [],
  };
  set({ projects: [proj, ...state.projects] });
  return proj.id;
}
export function updateProject(id, patch) {
  set({ projects: state.projects.map((p) => p.id === id ? { ...p, ...patch } : p) });
}
export function deleteProject(id) {
  const proj = state.projects.find((p) => p.id === id);
  if (!proj) return;
  const snapshot = { tasks: state.tasks, projects: state.projects, plan: state.plan };
  const childIds = new Set(proj.childTaskIds || []);
  set({
    tasks: state.tasks.filter((t) => !childIds.has(t.id)),
    projects: state.projects.filter((p) => p.id !== id),
    plan: state.plan.map((e) => ({ ...e, items: e.items.filter((i) => !childIds.has(i.taskId)) })).filter((e) => e.items.length),
  });
  notify(`Deleted project "${proj.title}"`, null, () => set(snapshot));
}
export function shipProject(id) {
  const now = Date.now();
  const proj = state.projects.find((p) => p.id === id);
  if (!proj) return;
  // Freeze the ship-log stats at the moment of launch (F5).
  const launchStats = D.computeLaunchStats(proj, state.tasks, state.sessions, now);
  set({ projects: state.projects.map((p) => p.id === id ? { ...p, completedAt: now, shippedAt: now, launchStats } : p) });
  setUI({ confetti: state.ui.confetti + 1, launchNoteFor: id });
  notify("Launched: " + (proj?.title || "project"));
  checkNewAchievements();
}

export function saveLaunchNote(projectId, note) {
  set({ projects: state.projects.map((p) => p.id === projectId ? { ...p, launchNote: (note || "").trim() } : p) });
  setUI({ launchNoteFor: null });
  if ((note || "").trim()) notify("Logged in the fleet");
}
export function unshipProject(id) {
  set({ projects: state.projects.map((p) => p.id === id ? { ...p, completedAt: null, shippedAt: null } : p) });
}
export function addChildToProject(projectId, data) {
  const task = addTask({ ...data, projectId });
  return task;
}
export function detachFromProject(taskId) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task?.projectId) return;
  set({
    tasks: state.tasks.map((t) => t.id === taskId ? { ...t, projectId: null } : t),
    projects: state.projects.map((p) => p.id === task.projectId ? { ...p, childTaskIds: (p.childTaskIds || []).filter((x) => x !== taskId) } : p),
  });
}

/* ── morning brief (F1) ────────────────────────────────────── */
// The skeleton is deterministic and always fresh; the AI prose is
// generated once per day (or on demand) and cached in the briefs slice.

function pruneBriefs(briefs, todayIso) {
  const cutoff = D.isoDate(D.addDays(D.parseIsoDate(todayIso), -14));
  const out = {};
  for (const [k, v] of Object.entries(briefs || {})) if (k >= cutoff) out[k] = v;
  return out;
}

export function briefFor(s, dateIso) {
  return (s.briefs || {})[dateIso] || null;
}

export function ensureMorningBrief() {
  const hour = state.meta.dayStartHour || 0;
  const todayIso = D.effectiveTodayIso(hour);
  if (state.briefs?.[todayIso]) return;
  const briefs = pruneBriefs(state.briefs, todayIso);
  briefs[todayIso] = { text: null, order: null, ai: false, attempted: false, dismissed: false, generatedAt: Date.now() };
  set({ briefs });
}

export function patchBrief(dateIso, patch) {
  set({ briefs: { ...(state.briefs || {}), [dateIso]: { ...(state.briefs?.[dateIso] || {}), ...patch } } });
}

// Apply an AI-suggested run order (titles) to today's lineup.
export function applyBriefOrder(titles) {
  const rows = todayLineup(state);
  const norm = new Map(rows.map((r) => [D.normalizeTitleKey(r.task.title), r.task.id]));
  const orderedIds = [];
  for (const title of titles || []) {
    const id = norm.get(D.normalizeTitleKey(title));
    if (id && !orderedIds.includes(id)) orderedIds.push(id);
  }
  for (const r of rows) if (!orderedIds.includes(r.task.id)) orderedIds.push(r.task.id);
  setLineupOrder(orderedIds);
  notify("Run order applied");
}

/* ── weekly review (F2) ────────────────────────────────────── */

export function openReview(weekStartIso = null) {
  const hour = state.meta.dayStartHour || 0;
  const target = weekStartIso
    || D.isoDate(D.addDays(D.mondayOf(D.effectiveToday(hour)), -7)); // default: last week
  setUI({ reviewWeek: target });
}
export function closeReview() { setUI({ reviewWeek: null }); }

export function patchReview(weekStartIso, patch) {
  set({ reviews: { ...(state.reviews || {}), [weekStartIso]: { ...(state.reviews?.[weekStartIso] || {}), ...patch } } });
}

// Should Today nudge for an unreviewed last week? (Mon/Tue, activity
// existed, no review entry yet.)
export function reviewPromptDue(s) {
  const hour = s.meta.dayStartHour || 0;
  const dow = D.effectiveToday(hour).getDay();
  if (dow !== 1 && dow !== 2) return null;
  const lastMonday = D.isoDate(D.addDays(D.mondayOf(D.effectiveToday(hour)), -7));
  const entry = s.reviews?.[lastMonday];
  if (entry && (entry.text || entry.promptDismissed)) return null;
  const stats = D.weeklyReviewData(s.tasks, s.plan, s.projects, s.sessions, lastMonday, hour);
  return stats.total > 0 ? lastMonday : null;
}

/* ── misc slices ───────────────────────────────────────────── */

export function patchScreenToday(patch) {
  const today = D.effectiveTodayIso(state.meta.dayStartHour);
  const entry = state.screen[today] || { xOpens: 0, ytOpens: 0, mobileHours: null };
  set({ screen: { ...state.screen, [today]: { ...entry, ...patch } } });
}
export function addCustomTag(tag) {
  if (!tag || D.TAGS_BUILTIN.includes(tag) || state.customTags.includes(tag)) return;
  set({ customTags: [...state.customTags, tag] });
}
export function setDayStartHour(raw) {
  const n = parseInt(raw, 10);
  const safe = Number.isNaN(n) ? 0 : Math.max(0, Math.min(23, n));
  set({ meta: { ...state.meta, dayStartHour: safe } });
}
export function closeDay({ rollForward }) {
  let moved = 0;
  const hour = state.meta.dayStartHour;
  const todayIso = D.effectiveTodayIso(hour);
  if (rollForward) {
    const entry = (state.plan || []).find((e) => e.date === todayIso);
    const byId = new Map(state.tasks.map((t) => [t.id, t]));
    const moving = (entry?.items || []).filter((it) => {
      const t = byId.get(it.taskId);
      return t && !t.completed && !it.done;
    });
    if (moving.length) {
      let target = null;
      for (let off = 1; off < 21; off++) {
        const d = D.addDays(D.parseIsoDate(todayIso), off);
        if ((state.caps[D.weekdayName(d)] || 0) > 0) { target = D.isoDate(d); break; }
      }
      if (target) {
        let plan = state.plan;
        for (const it of moving) plan = D.moveChunk(plan, it.taskId, todayIso, target);
        set({ plan });
        moved = moving.length;
      }
    }
  }
  set({ meta: { ...state.meta, dayClosed: { date: todayIso, closedAt: Date.now() } } });
  setUI({ endOfDayOpen: false });
  notify(moved > 0 ? `Day closed · ${moved} task${moved > 1 ? "s" : ""} rolled forward` : "Day closed");
}
export function reopenDay() {
  set({ meta: { ...state.meta, dayClosed: null } });
  notify("Day reopened");
}

/* ── preview mode ──────────────────────────────────────────── */

export function enterPreview() {
  if (state.ui.previewMode) return;
  const snap = {
    tasks: state.tasks, projects: state.projects, plan: state.plan,
    caps: state.caps, screen: state.screen, achievements: state.achievements,
    sessions: state.sessions, briefs: state.briefs, reviews: state.reviews,
    meta: state.meta,
  };
  window.localStorage.setItem(db.KEYS.preview, JSON.stringify(snap));
  const demo = generateDemoData();
  set({ ...demo, sessions: [], briefs: {}, reviews: {} }, ["tasks", "projects", "plan", "caps", "screen", "achievements", "sessions", "briefs", "reviews"]);
  setUI({ previewMode: true, view: "today" });
  notify("Preview on — your data is snapshotted");
}
export function exitPreview() {
  const raw = window.localStorage.getItem(db.KEYS.preview);
  if (!raw) { setUI({ previewMode: false }); return; }
  const snap = JSON.parse(raw);
  set({
    tasks: snap.tasks || [], projects: snap.projects || [], plan: snap.plan || [],
    caps: snap.caps || { ...D.DEFAULT_CAPS }, screen: snap.screen || {},
    achievements: snap.achievements || [], meta: snap.meta || state.meta,
    sessions: snap.sessions || [], briefs: snap.briefs || {}, reviews: snap.reviews || {},
  });
  window.localStorage.removeItem(db.KEYS.preview);
  setUI({ previewMode: false });
  notify("Your data is back");
}

function generateDemoData() {
  const now = Date.now();
  const day = 86400000;
  const mk = (title, o = {}) => ({
    id: "demo-" + D.uid(), title, desc: o.desc || "", notes: "", tags: o.tags || [], subtasks: [],
    xp: o.xp || 25, difficulty: o.diff || "medium", hours: o.hours || 1.5,
    recurring: o.rec || "none", history: o.rec ? (o.history || []) : undefined,
    priority: o.prio || "medium", projectId: o.pid || null, deadlineAt: o.deadline || null,
    completed: !!o.done, completedAt: o.done ? (o.doneAt || now - day) : null,
    createdAt: now - (o.age || 5) * day, focusMs: 0, focusDate: null, aiPending: false,
  });
  const p1 = { id: "demo-p1", title: "Landing redesign", desc: "Client site refresh", notes: "", type: "client", color: "#3fd68f", createdAt: now - 12 * day, completedAt: null, shippedAt: null, childTaskIds: [] };
  const p2 = { id: "demo-p2", title: "Component kit", desc: "", notes: "", type: "component", color: "#5b9dff", createdAt: now - 8 * day, completedAt: null, shippedAt: null, childTaskIds: [] };
  const t = [
    mk("Audit hero section", { pid: "demo-p1", prio: "high" }),
    mk("Rework navigation", { pid: "demo-p1", diff: "hard", xp: 45, hours: 3, prio: "urgent", deadline: now + 3 * day }),
    mk("Build stat chips", { pid: "demo-p2" }),
    mk("Tighten pricing copy", { pid: "demo-p1", diff: "easy", xp: 12, hours: 0.5, done: true, doneAt: now - 2 * 3600000 }),
    mk("Reply to procurement", { prio: "urgent", diff: "easy", xp: 10, hours: 0.5 }),
    mk("Morning planning", { rec: "daily", diff: "easy", xp: 10, hours: 0.25, history: [D.isoDate(new Date(now - 2 * day)), D.isoDate(new Date(now - day))] }),
  ];
  for (let i = 0; i < 10; i++) {
    t.push(mk(["Fix drawer overlap", "Push staging", "Sketch onboarding", "Refactor toasts", "Write release notes", "Lighthouse pass", "Tidy Figma", "Draft case study", "Pair prep", "Update README"][i], {
      done: true, doneAt: now - (1 + (i % 7)) * day - (i * 3600000) % (8 * 3600000), xp: 15 + (i % 4) * 10, age: 10,
      pid: i % 3 === 0 ? "demo-p1" : i % 3 === 1 ? "demo-p2" : null,
    }));
  }
  p1.childTaskIds = t.filter((x) => x.projectId === "demo-p1").map((x) => x.id);
  p2.childTaskIds = t.filter((x) => x.projectId === "demo-p2").map((x) => x.id);
  const todayIso = D.effectiveTodayIso(state.meta.dayStartHour);
  const plan = [
    { date: todayIso, items: [{ taskId: t[0].id, done: false }, { taskId: t[4].id, done: false }] },
    { date: D.isoDate(D.addDays(new Date(), 1)), items: [{ taskId: t[1].id, done: false, hours: 1.5, note: "Wireframe + direction" }] },
    { date: D.isoDate(D.addDays(new Date(), 2)), items: [{ taskId: t[1].id, done: false, hours: 1.5, note: "Build + polish" }, { taskId: t[2].id, done: false }] },
  ];
  return {
    tasks: t, projects: [p1, p2], plan,
    caps: { ...D.DEFAULT_CAPS }, screen: {},
    achievements: ["first", "five", "speed"],
  };
}

/* ── export / import ───────────────────────────────────────── */

export function exportData() {
  if (state.ui.previewMode) { notify("Exit preview first"); return; }
  const payload = db.buildExport(state);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `werf-backup-${D.isoDate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  notify("Backup downloaded");
}

export function importDataFromFile(file, mode) {
  if (state.ui.previewMode) { notify("Exit preview first"); return Promise.resolve(false); }
  return file.text().then((text) => {
    const payload = JSON.parse(text);
    const inc = db.parseImport(payload); // throws with readable message
    if (mode === "replace") {
      const meta = inc.meta
        ? { ...state.meta, ...inc.meta }
        : (() => {
            // Quest backup: recompute baseline from its profile.
            const derived = D.totalXP(inc.tasks, inc.plan, 0, state.meta.dayStartHour);
            const legacy = inc.legacyProfile?.totalXP ?? null;
            return { ...state.meta, xpBaseline: legacy != null ? Math.max(0, legacy - derived) : 0 };
          })();
      set({
        tasks: inc.tasks, projects: inc.projects, plan: inc.plan,
        caps: inc.caps || { ...D.DEFAULT_CAPS }, screen: inc.screen,
        locks: inc.locks, achievements: inc.achievements, customTags: inc.customTags,
        meta,
      });
    } else {
      const merged = db.mergeStates(state, inc);
      set({ ...merged });
    }
    notify("Import complete");
    return true;
  });
}
