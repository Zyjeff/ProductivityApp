// db.js — synchronous localStorage persistence, versioned migration
// from every legacy generation (quest_* v≤8, vsq_*, shiplist), rotating
// auto-backups, export/import. All functions take an optional `storage`
// (anything with getItem/setItem/removeItem) so migrations are testable
// in node without a browser.

import {
  isoDate, effectiveTodayIso, effectiveIsoOf, totalXP, mondayOf, addDays,
  parseIsoDate, pickProjectColor, uid,
} from "./domain.js";

export const KEYS = {
  tasks: "werf_tasks",
  projects: "werf_projects",
  plan: "werf_plan",
  caps: "werf_caps",
  screen: "werf_screen",
  locks: "werf_locks",
  achievements: "werf_achievements",
  customTags: "werf_custom_tags",
  sessions: "werf_sessions",   // v2: focus session ledger [{id,taskId,dateIso,ms,at}]
  briefs: "werf_briefs",       // v2: morning briefs { dateIso: {...} }
  reviews: "werf_reviews",     // v2: weekly reviews { weekStartIso: {...} }
  meta: "werf_meta",          // { schema, xpBaseline, migratedFrom, dayStartHour, dayClosed, ... }
  preview: "werf_preview_snapshot",
  backupPrefix: "werf_backup_", // + weekday index 0-6
};

// v1 → v2: adds the sessions ledger, morning-brief cache, and weekly
// review store (all empty defaults; nothing existing is touched).
export const SCHEMA_VERSION = 2;

const DEFAULT_META = {
  schema: SCHEMA_VERSION,
  xpBaseline: 0,
  migratedFrom: null,
  dayStartHour: 0,
  dayClosed: null,
  pulseDismissed: null,
  lastBackupDay: null,
};

function readJSON(storage, key, fallback) {
  try {
    const v = storage.getItem(key);
    if (v == null) return fallback;
    return JSON.parse(v);
  } catch (e) {
    console.error(`werf: corrupt JSON in "${key}"`, e);
    return fallback;
  }
}
function writeJSON(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.error(`werf: failed writing "${key}"`, e); }
}

/* ── legacy readers ────────────────────────────────────────── */
// The quest app stored weekplan in four historical shapes; normalize
// them all to the final {date, items:[{taskId, hours?, note?, done, doneAt?}]}.
function normalizeQuestPlan(wp, tasks) {
  if (!Array.isArray(wp) || !wp.length) return [];
  const titleToId = new Map();
  for (const t of tasks || []) if (!titleToId.has(t.title)) titleToId.set(t.title, t.id);
  const byId = new Map((tasks || []).map((t) => [t.id, t]));

  const out = [];
  const today = new Date();
  const thisMonday = mondayOf(today);
  const dayIdx = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 };

  for (const e of wp) {
    if (!e) continue;
    let date = e.date;
    // v1: {week: "current"|"next", day: "Monday", tasks:[titles]}
    if (!date && e.day) {
      const base = (e.week || "current") === "next" ? addDays(thisMonday, 7) : thisMonday;
      const idx = dayIdx[e.day];
      if (idx == null) continue;
      date = isoDate(addDays(base, idx));
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    let items = [];
    if (Array.isArray(e.items)) {
      items = e.items.map((it) => ({ ...it, done: !!it.done }));
    } else if (Array.isArray(e.taskIds)) {
      items = e.taskIds.map((id) => ({ taskId: id, done: !!byId.get(id)?.completed }));
    } else if (Array.isArray(e.tasks)) {
      items = e.tasks
        .map((title) => titleToId.get(title))
        .filter(Boolean)
        .map((id) => ({ taskId: id, done: !!byId.get(id)?.completed }));
    }
    // Backfill doneAt for done items missing it (quest <v7 data).
    items = items.map((it) => {
      if (it.done && !it.doneAt) {
        const t = byId.get(it.taskId);
        const d = parseIsoDate(date);
        return { ...it, doneAt: t?.completedAt || (d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime() : Date.now()) };
      }
      return it;
    }).filter((it) => it.taskId);
    if (items.length) out.push({ date, items });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Normalize a quest/vsq task record into the werf shape. The one real
// change: recurring tasks keep a completion `history` (quest v8 called
// it dailyCompletions and only for daily; weekly gets seeded from
// completedAt so the current period's state survives).
function normalizeTask(t) {
  if (!t || !t.id || !t.title) return null;
  const recurring = ["daily", "weekly"].includes(t.recurring) ? t.recurring : "none";
  let history;
  if (recurring !== "none") {
    history = Array.isArray(t.dailyCompletions) ? [...t.dailyCompletions] : [];
    if (!history.length && t.completed && t.completedAt) {
      history.push(effectiveIsoOf(t.completedAt, 0));
    }
    history = Array.from(new Set(history)).sort();
  }
  return {
    id: t.id,
    title: String(t.title),
    desc: t.desc || "",
    notes: t.notes || "",
    tags: Array.isArray(t.tags) ? t.tags : [],
    subtasks: Array.isArray(t.subtasks)
      ? t.subtasks.map((s, i) => ({ id: s.id || uid() + i, title: s.title || String(s), done: !!s.done }))
      : [],
    xp: typeof t.xp === "number" ? t.xp : 20,
    difficulty: ["easy", "medium", "hard", "epic"].includes(t.difficulty) ? t.difficulty : "medium",
    hours: typeof t.hours === "number" && t.hours > 0 ? t.hours : null,
    recurring,
    history,
    priority: ["urgent", "high", "medium", "low"].includes(t.priority) ? t.priority : "medium",
    projectId: t.projectId || null,
    deadlineAt: typeof t.deadlineAt === "number" ? t.deadlineAt : null,
    completed: !!t.completed,
    completedAt: t.completedAt || null,
    createdAt: t.createdAt || Date.now(),
    focusMs: t.focusMs || 0,
    focusDate: t.focusDate || null,
    aiPending: false,
  };
}

function normalizeProject(p) {
  if (!p || !p.id || !p.title) return null;
  return {
    id: p.id,
    title: String(p.title),
    desc: p.desc || "",
    notes: p.notes || "",
    type: p.type || "other",
    color: p.color || pickProjectColor(),
    createdAt: p.createdAt || Date.now(),
    completedAt: p.completedAt || null,
    shippedAt: p.shippedAt || p.completedAt || null,
    childTaskIds: Array.isArray(p.childTaskIds) ? p.childTaskIds : [],
  };
}

/* ── migration ─────────────────────────────────────────────── */
// Runs once: if werf_meta exists, nothing happens. Otherwise gathers
// whatever legacy generations are present (newest wins per-slice):
//   quest_* (v1..v8) → primary source
//   vsq_*            → used where quest_* is absent
//   shiplist-projects-v2 → appended as projects+tasks (quest's own
//                          migration did this; replicate for users who
//                          never opened quest post-migration)
export function migrate(storage) {
  const existing = readJSON(storage, KEYS.meta, null);
  if (existing && existing.schema >= 1) {
    // Incremental werf upgrades (additive only).
    if (existing.schema < 2) {
      if (storage.getItem(KEYS.sessions) == null) writeJSON(storage, KEYS.sessions, []);
      if (storage.getItem(KEYS.briefs) == null) writeJSON(storage, KEYS.briefs, {});
      if (storage.getItem(KEYS.reviews) == null) writeJSON(storage, KEYS.reviews, {});
      const upgraded = { ...existing, schema: 2 };
      writeJSON(storage, KEYS.meta, upgraded);
      return { migrated: false, meta: upgraded };
    }
    return { migrated: false, meta: existing };
  }

  const q = (suffix) => readJSON(storage, "quest_" + suffix, null);
  const v = (suffix) => readJSON(storage, "vsq_" + suffix, null);

  const rawTasks = q("tasks") ?? v("tasks") ?? [];
  const rawProjects = q("projects") ?? v("projects") ?? [];
  const rawPlan = q("weekplan") ?? v("weekplan") ?? [];
  const rawProfile = q("profile") ?? v("profile") ?? null;
  const rawAch = q("achievements") ?? v("achievements") ?? [];
  const rawCaps = q("caps") ?? v("caps") ?? null;
  const rawScreen = q("screen") ?? v("screenlog") ?? {};
  const rawLocks = readJSON(storage, "quest_locks", {});
  const rawTags = q("custom_tags") ?? [];
  const rawDayStart = q("day_start_hour");
  const rawDayClosed = readJSON(storage, "quest_day_closed", null);

  let tasks = (Array.isArray(rawTasks) ? rawTasks : []).map(normalizeTask).filter(Boolean);
  let projects = (Array.isArray(rawProjects) ? rawProjects : []).map(normalizeProject).filter(Boolean);

  // shiplist import (skip anything quest already imported via its own
  // "p-mig-" convention).
  const shiplist = readJSON(storage, "shiplist-projects-v2", null);
  if (Array.isArray(shiplist) && shiplist.length) {
    const have = new Set(projects.map((p) => p.id));
    for (const sp of shiplist) {
      const pid = "p-mig-" + sp.id;
      if (have.has(pid)) continue;
      const childIds = [];
      for (const t of sp.tasks || []) {
        const tid = "ct-mig-" + sp.id + "-" + t.id;
        childIds.push(tid);
        tasks.push(normalizeTask({
          id: tid, title: t.name, xp: 15, difficulty: "easy",
          recurring: "none", priority: "medium", projectId: pid,
          completed: !!t.done,
          completedAt: t.done ? (sp.shippedAt || sp.createdAt || Date.now()) : null,
          createdAt: sp.createdAt || Date.now(),
        }));
      }
      projects.push(normalizeProject({
        id: pid, title: sp.name, type: sp.type ? String(sp.type).toLowerCase().replace("side project", "side") : "other",
        createdAt: sp.createdAt || Date.now(),
        completedAt: sp.shipped ? (sp.shippedAt || Date.now()) : null,
        shippedAt: sp.shipped ? (sp.shippedAt || Date.now()) : null,
        childTaskIds: childIds,
      }));
    }
  }

  const plan = normalizeQuestPlan(rawPlan, tasks);

  // Lifetime XP baseline: the old app's counter is the number the owner
  // knows; the derived ledger may compute less (or more, where the old
  // counter drifted). Baseline = old counter − derived, so day one
  // shows the same lifetime total and everything after is honest.
  const dayStartHour = typeof rawDayStart === "number" && rawDayStart >= 0 && rawDayStart <= 23 ? rawDayStart : 0;
  const derived = totalXP(tasks, plan, 0, dayStartHour);
  const legacyTotal = rawProfile && typeof rawProfile.totalXP === "number" ? rawProfile.totalXP : null;
  const xpBaseline = legacyTotal != null ? Math.max(0, legacyTotal - derived) : 0;

  const hadLegacy = !!(rawTasks?.length || rawProjects?.length || rawProfile || (Array.isArray(shiplist) && shiplist.length));

  const meta = {
    ...DEFAULT_META,
    xpBaseline,
    migratedFrom: hadLegacy
      ? { quest: !!q("tasks"), vsq: !!v("tasks"), shiplist: Array.isArray(shiplist) && shiplist.length > 0, legacyTotalXP: legacyTotal, at: Date.now() }
      : null,
    dayStartHour,
    dayClosed: rawDayClosed || null,
  };

  writeJSON(storage, KEYS.tasks, tasks);
  writeJSON(storage, KEYS.projects, projects);
  writeJSON(storage, KEYS.plan, plan);
  writeJSON(storage, KEYS.caps, rawCaps && typeof rawCaps === "object" ? rawCaps : null);
  writeJSON(storage, KEYS.screen, rawScreen && typeof rawScreen === "object" ? rawScreen : {});
  writeJSON(storage, KEYS.locks, rawLocks && typeof rawLocks === "object" ? rawLocks : {});
  writeJSON(storage, KEYS.achievements, Array.isArray(rawAch) ? rawAch : []);
  writeJSON(storage, KEYS.customTags, Array.isArray(rawTags) ? rawTags : []);
  writeJSON(storage, KEYS.sessions, []);
  writeJSON(storage, KEYS.briefs, {});
  writeJSON(storage, KEYS.reviews, {});
  writeJSON(storage, KEYS.meta, meta);
  // Legacy keys are left untouched on purpose: the old app (and its
  // export) keeps working, and a re-migration can be forced by clearing
  // werf_* only.
  return { migrated: hadLegacy, meta };
}

/* ── load / persist ────────────────────────────────────────── */

export function loadState(storage = window.localStorage) {
  const { meta } = migrate(storage);
  return {
    tasks: readJSON(storage, KEYS.tasks, []),
    projects: readJSON(storage, KEYS.projects, []),
    plan: readJSON(storage, KEYS.plan, []),
    caps: readJSON(storage, KEYS.caps, null),
    screen: readJSON(storage, KEYS.screen, {}),
    locks: readJSON(storage, KEYS.locks, {}),
    achievements: readJSON(storage, KEYS.achievements, []),
    customTags: readJSON(storage, KEYS.customTags, []),
    sessions: readJSON(storage, KEYS.sessions, []),
    briefs: readJSON(storage, KEYS.briefs, {}),
    reviews: readJSON(storage, KEYS.reviews, {}),
    meta: { ...DEFAULT_META, ...meta, schema: SCHEMA_VERSION },
    previewSnapshot: readJSON(storage, KEYS.preview, null),
  };
}

const SLICE_TO_KEY = {
  tasks: KEYS.tasks, projects: KEYS.projects, plan: KEYS.plan,
  caps: KEYS.caps, screen: KEYS.screen, locks: KEYS.locks,
  achievements: KEYS.achievements, customTags: KEYS.customTags, meta: KEYS.meta,
  sessions: KEYS.sessions, briefs: KEYS.briefs, reviews: KEYS.reviews,
};

// Debounced per-slice persistence: callers mark slices dirty; one timer
// flushes them. flush() is exported for tests and beforeunload.
const dirty = new Set();
let flushTimer = null;
let boundStorage = null;
let latestState = null;

export function bindPersistence(storage) {
  boundStorage = storage;
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => flush());
  }
}
export function persist(state, slices) {
  latestState = state;
  for (const s of slices) if (SLICE_TO_KEY[s]) dirty.add(s);
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 150);
}
export function flush() {
  if (!boundStorage || !latestState) return;
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  for (const s of dirty) {
    writeJSON(boundStorage, SLICE_TO_KEY[s], latestState[s]);
  }
  dirty.clear();
}

/* ── rotating auto-backup (7 slots, one per weekday) ───────── */

export function maybeBackup(storage, state, dayStartHour = 0) {
  const today = effectiveTodayIso(dayStartHour);
  const meta = readJSON(storage, KEYS.meta, DEFAULT_META);
  if (meta.lastBackupDay === today) return false;
  const slot = new Date().getDay(); // 0-6
  writeJSON(storage, KEYS.backupPrefix + slot, {
    at: Date.now(), day: today, schema: SCHEMA_VERSION,
    data: {
      tasks: state.tasks, projects: state.projects, plan: state.plan,
      caps: state.caps, screen: state.screen, locks: state.locks,
      achievements: state.achievements, customTags: state.customTags,
      meta: { ...state.meta, lastBackupDay: today },
    },
  });
  // Record the day so the ring advances once per day, not per load.
  writeJSON(storage, KEYS.meta, { ...meta, ...state.meta, lastBackupDay: today });
  return true;
}
export function listBackups(storage = window.localStorage) {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const b = readJSON(storage, KEYS.backupPrefix + i, null);
    if (b) out.push({ slot: i, at: b.at, day: b.day });
  }
  return out.sort((a, b) => b.at - a.at);
}
export function readBackup(storage, slot) {
  return readJSON(storage, KEYS.backupPrefix + slot, null);
}

/* ── export / import ───────────────────────────────────────── */

export function buildExport(state) {
  return {
    app: "werf",
    format: 2,
    schema: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      tasks: state.tasks, projects: state.projects, plan: state.plan,
      caps: state.caps, screen: state.screen, locks: state.locks,
      achievements: state.achievements, customTags: state.customTags,
      sessions: state.sessions || [], briefs: state.briefs || {}, reviews: state.reviews || {},
      meta: state.meta,
    },
  };
}

// Accepts a werf export (format 2) OR a quest backup (format 1). Returns
// a normalized partial state, or throws with a human-readable message.
export function parseImport(payload) {
  if (payload?.app === "werf" && payload?.format === 2) {
    if (typeof payload.schema === "number" && payload.schema > SCHEMA_VERSION) {
      throw new Error(`This backup is from a newer Werf (schema v${payload.schema} > v${SCHEMA_VERSION}). Update first.`);
    }
    const d = payload.data || {};
    return {
      tasks: (d.tasks || []).map(normalizeTask).filter(Boolean),
      projects: (d.projects || []).map(normalizeProject).filter(Boolean),
      plan: Array.isArray(d.plan) ? d.plan : [],
      caps: d.caps || null,
      screen: d.screen || {},
      locks: d.locks || {},
      achievements: d.achievements || [],
      customTags: d.customTags || [],
      sessions: Array.isArray(d.sessions) ? d.sessions : [],
      briefs: d.briefs || {},
      reviews: d.reviews || {},
      meta: d.meta || null,
    };
  }
  if (payload?.app === "quest" && payload?.format === 1) {
    const d = payload.data || {};
    const tasks = (d.tasks || []).map(normalizeTask).filter(Boolean);
    return {
      tasks,
      projects: (d.projects || []).map(normalizeProject).filter(Boolean),
      plan: normalizeQuestPlan(d.weekplan || [], tasks),
      caps: d.caps || null,
      screen: d.screen || {},
      locks: d.locks || {},
      achievements: d.achievements || [],
      customTags: d.customTags || [],
      sessions: [], briefs: {}, reviews: {},
      meta: null,
      legacyProfile: d.profile || null,
    };
  }
  throw new Error("Not a Werf or Quest backup file.");
}

export function mergeStates(cur, inc) {
  const mergeById = (a, b) => {
    const byId = new Map();
    for (const x of a || []) if (x?.id) byId.set(x.id, x);
    for (const x of b || []) if (x?.id && !byId.has(x.id)) byId.set(x.id, x);
    return Array.from(byId.values());
  };
  const planByDate = new Map();
  for (const e of cur.plan || []) planByDate.set(e.date, { date: e.date, items: [...(e.items || [])] });
  for (const e of inc.plan || []) {
    const dst = planByDate.get(e.date) || { date: e.date, items: [] };
    const have = new Set(dst.items.map((i) => i.taskId));
    for (const it of e.items || []) if (!have.has(it.taskId)) dst.items.push(it);
    planByDate.set(e.date, dst);
  }
  return {
    tasks: mergeById(cur.tasks, inc.tasks),
    projects: mergeById(cur.projects, inc.projects),
    plan: Array.from(planByDate.values()).filter((e) => e.items.length).sort((a, b) => a.date.localeCompare(b.date)),
    caps: { ...(inc.caps || {}), ...(cur.caps || {}) },
    screen: { ...(inc.screen || {}), ...(cur.screen || {}) },
    locks: { ...(inc.locks || {}), ...(cur.locks || {}) },
    achievements: Array.from(new Set([...(cur.achievements || []), ...(inc.achievements || [])])),
    customTags: Array.from(new Set([...(cur.customTags || []), ...(inc.customTags || [])])),
    sessions: mergeById(cur.sessions, inc.sessions),
    briefs: { ...(inc.briefs || {}), ...(cur.briefs || {}) },
    reviews: { ...(inc.reviews || {}), ...(cur.reviews || {}) },
  };
}
