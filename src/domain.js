// domain.js — pure logic. No React, no storage, no fetch.
// Everything here is a deterministic function of its inputs, which is
// the point: XP, streak, and activity are DERIVED from the completion
// history, never stored as mutated counters. The double-pay / drift
// bug class of the previous app cannot exist here by construction.

/* ── constants ─────────────────────────────────────────────── */

export const DIFFICULTY = {
  easy:   { label: "easy",   hours: 0.5, xp: 12, tone: "var(--starboard)" },
  medium: { label: "medium", hours: 1.5, xp: 25, tone: "var(--channel)" },
  hard:   { label: "hard",   hours: 3.0, xp: 45, tone: "var(--warning)" },
  epic:   { label: "epic",   hours: 5.0, xp: 70, tone: "var(--port)" },
};
export const DIFFICULTY_ORDER = ["easy", "medium", "hard", "epic"];

export const PRIORITIES = {
  urgent: { label: "Urgent", dot: "var(--port)",       order: 0 },
  high:   { label: "High",   dot: "var(--warning)",    order: 1 },
  medium: { label: "Medium", dot: "var(--channel)",    order: 2 },
  low:    { label: "Low",    dot: "var(--text-faint)", order: 3 },
};

export const LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1500, 2400, 3700, 5500, 8000, 12000];
export const LEVEL_NAMES = ["Rookie", "Initiate", "Builder", "Craftsman", "Architect", "Expert", "Master", "Elite", "Legend", "Ascended", "Immortal"];

export const PROJECT_TYPES = [
  { id: "template",  label: "Template" },
  { id: "component", label: "Component" },
  { id: "client",    label: "Client" },
  { id: "side",      label: "Side Project" },
  { id: "other",     label: "Other" },
];

export const PROJECT_PALETTE = [
  "#f5a524", "#5b9dff", "#3fd68f", "#e8c353", "#f0716b",
  "#e18fd8", "#4fd1e0", "#a3e06b", "#f59a6b", "#8fa3c0",
];
export function pickProjectColor(rand = Math.random) {
  return PROJECT_PALETTE[Math.floor(rand() * PROJECT_PALETTE.length)];
}

export const TAGS_BUILTIN = ["framer", "client", "admin", "creative", "music", "personal"];
export function allKnownTags(customTags) {
  const out = [...TAGS_BUILTIN];
  for (const t of customTags || []) if (t && !out.includes(t)) out.push(t);
  return out;
}

export const WEEK_ALL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const DEFAULT_CAPS = { Monday: 4, Tuesday: 4, Wednesday: 4, Thursday: 4, Friday: 3, Saturday: 0, Sunday: 0 };

export const ACHIEVEMENTS = [
  { id: "first",     title: "First Strike",   desc: "Complete your first task" },
  { id: "five",      title: "Warming Up",     desc: "Complete 5 tasks" },
  { id: "twenty",    title: "On Fire",        desc: "Complete 20 tasks" },
  { id: "streak3",   title: "Tidal",          desc: "3-day streak" },
  { id: "streak7",   title: "Week Warrior",   desc: "7-day streak" },
  { id: "day100",    title: "Century Day",    desc: "100 XP in one day" },
  { id: "xp500",     title: "Half K",         desc: "500 total XP" },
  { id: "xp1000",    title: "One Thou",       desc: "1000 total XP" },
  { id: "epic",      title: "Epic Slayer",    desc: "Complete an epic task" },
  { id: "decompose", title: "Decomposer",     desc: "Task with 3+ subtasks done" },
  { id: "framer3",   title: "Framer Grinder", desc: "3 Framer tasks in a week" },
  { id: "speed",     title: "Speed Run",      desc: "Done within 30min of adding" },
  { id: "clean_day", title: "Clean Day",      desc: "Zero social opens + under 1h mobile" },
  { id: "project",   title: "Architect",      desc: "Launch your first project" },
  { id: "fleet3",    title: "Small Fleet",    desc: "Launch 3 projects" },
  { id: "fleet10",   title: "Armada",         desc: "Launch 10 projects" },
];

/* ── dates — ONE convention: local time, ISO strings ───────── */
// The previous app mixed toISOString (UTC) with local isoDate and broke
// nightly. Here every date string is local. Nothing in this file may
// call toISOString for a date.

export function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function parseIsoDate(s) {
  if (!s || typeof s !== "string") return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  r.setHours(0, 0, 0, 0);
  return r;
}
export function mondayOf(d) {
  const dow = d.getDay();
  const m = new Date(d);
  m.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  m.setHours(0, 0, 0, 0);
  return m;
}
export function weekdayName(d) {
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

// Day-rollover hour: with hour=4, 01:30 still counts as "yesterday".
export function effectiveToday(hour = 0, now = new Date()) {
  const out = new Date(now);
  if (hour && out.getHours() < hour) out.setDate(out.getDate() - 1);
  out.setHours(0, 0, 0, 0);
  return out;
}
export function effectiveTodayIso(hour = 0, now = new Date()) {
  return isoDate(effectiveToday(hour, now));
}
export function effectiveIsoOf(ms, hour = 0) {
  return isoDate(effectiveToday(hour, new Date(ms)));
}

export function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
export function fmtIsoShort(iso) {
  const d = parseIsoDate(iso);
  return d ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : iso;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ── task + chunk helpers ──────────────────────────────────── */

export function taskHours(t) {
  if (t && typeof t.hours === "number" && t.hours > 0) return t.hours;
  return DIFFICULTY[t?.difficulty]?.hours ?? 1.5;
}

// Deterministic score — the honest default when AI is off, and the
// floor the AI suggestion is checked against. xp scales with hours off
// the difficulty base so a 6h "hard" is worth more than a 2.5h one.
export function deterministicScore(difficulty = "medium", hours = null) {
  const d = DIFFICULTY[difficulty] || DIFFICULTY.medium;
  const h = typeof hours === "number" && hours > 0 ? hours : d.hours;
  const xp = Math.max(5, Math.min(100, Math.round(d.xp * (h / d.hours) ** 0.7)));
  return { xp, hours: h, difficulty };
}

// All plan chunks for a task, sorted by date, 1-indexed.
export function getTaskChunks(taskId, plan) {
  const chunks = [];
  for (const e of plan || []) {
    for (const it of e.items || []) {
      if (it.taskId === taskId) chunks.push({ date: e.date, item: it });
    }
  }
  chunks.sort((a, b) => a.date.localeCompare(b.date));
  chunks.forEach((c, i) => { c.index = i + 1; });
  return chunks;
}

export function getTaskScheduledDate(taskId, plan) {
  let earliest = "";
  for (const e of plan || []) {
    if ((e.items || []).some((i) => i.taskId === taskId)) {
      if (!earliest || e.date < earliest) earliest = e.date;
    }
  }
  return earliest;
}

// XP share of one chunk: proportional to hours, ≥1, and the LAST chunk
// tops up so the shares always sum to exactly task.xp.
export function chunkXpShares(task, chunks) {
  const totalH = chunks.reduce((s, c) => s + (c.item.hours ?? taskHours(task)), 0) || taskHours(task);
  const shares = chunks.map((c) =>
    Math.max(1, Math.round((task.xp || 0) * (c.item.hours ?? taskHours(task)) / totalH))
  );
  if (shares.length > 1) {
    const sumButLast = shares.slice(0, -1).reduce((s, v) => s + v, 0);
    shares[shares.length - 1] = Math.max(1, (task.xp || 0) - sumButLast);
  } else if (shares.length === 1) {
    shares[0] = task.xp || 0;
  }
  return shares;
}

/* ── recurring semantics ───────────────────────────────────── */
// Both daily and weekly recurring tasks keep a history[] of local ISO
// dates. "Done for the current period" is DERIVED:
//   daily  → history contains effective-today
//   weekly → history contains a date within the current Mon-Sun week
export function isRecurringDoneNow(task, dayStartHour = 0, now = new Date()) {
  const history = task.history || [];
  if (task.recurring === "daily") {
    return history.includes(effectiveTodayIso(dayStartHour, now));
  }
  if (task.recurring === "weekly") {
    const weekStart = isoDate(mondayOf(effectiveToday(dayStartHour, now)));
    return history.some((d) => d >= weekStart);
  }
  return false;
}
export function isRecurringDoneOn(task, dateIso) {
  return (task.history || []).includes(dateIso);
}

/* ── the XP ledger: one derivation for everything ──────────── */
// xpEvents() flattens the completion history into [{dateIso, taskId, xp}].
// totalXP, todayXP, per-day charts, streak — all read from this.
export function xpEvents(tasks, plan, dayStartHour = 0) {
  const events = [];
  const chunksByTask = new Map();
  for (const e of plan || []) {
    for (const it of e.items || []) {
      if (!chunksByTask.has(it.taskId)) chunksByTask.set(it.taskId, []);
      chunksByTask.get(it.taskId).push({ date: e.date, item: it });
    }
  }
  for (const arr of chunksByTask.values()) arr.sort((a, b) => a.date.localeCompare(b.date));

  for (const t of tasks || []) {
    if (t.recurring === "daily" || t.recurring === "weekly") {
      for (const dateIso of t.history || []) {
        events.push({ dateIso, taskId: t.id, xp: t.xp || 0 });
      }
      continue;
    }
    const chunks = chunksByTask.get(t.id) || [];
    if (chunks.length > 1) {
      const shares = chunkXpShares(t, chunks);
      let paid = 0;
      chunks.forEach((c, i) => {
        if (c.item.done) {
          const dateIso = c.item.doneAt ? effectiveIsoOf(c.item.doneAt, dayStartHour) : c.date;
          events.push({ dateIso, taskId: t.id, xp: shares[i] });
          paid += shares[i];
        }
      });
      // Migration edge: task marked completed while some chunks are
      // undone (the old app allowed this). Pay the remainder at the
      // completion date so the ledger still sums to task.xp.
      if (t.completed && paid < (t.xp || 0)) {
        const dateIso = t.completedAt ? effectiveIsoOf(t.completedAt, dayStartHour) : (chunks[chunks.length - 1] || {}).date;
        if (dateIso) events.push({ dateIso, taskId: t.id, xp: (t.xp || 0) - paid });
      }
    } else if (t.completed && t.completedAt) {
      events.push({ dateIso: effectiveIsoOf(t.completedAt, dayStartHour), taskId: t.id, xp: t.xp || 0 });
    } else if (chunks.length === 1 && chunks[0].item.done) {
      const c = chunks[0];
      const dateIso = c.item.doneAt ? effectiveIsoOf(c.item.doneAt, dayStartHour) : c.date;
      events.push({ dateIso, taskId: t.id, xp: t.xp || 0 });
    }
  }
  return events;
}

// Activity: dateIso → Set<taskId> that had work completed that day.
export function activityByDay(tasks, plan, dayStartHour = 0) {
  const map = new Map();
  for (const ev of xpEvents(tasks, plan, dayStartHour)) {
    let set = map.get(ev.dateIso);
    if (!set) { set = new Set(); map.set(ev.dateIso, set); }
    set.add(ev.taskId);
  }
  return map;
}

export function xpByDay(tasks, plan, dayStartHour = 0) {
  const map = new Map();
  for (const ev of xpEvents(tasks, plan, dayStartHour)) {
    map.set(ev.dateIso, (map.get(ev.dateIso) || 0) + ev.xp);
  }
  return map;
}

export function totalXP(tasks, plan, baseline = 0, dayStartHour = 0) {
  return baseline + xpEvents(tasks, plan, dayStartHour).reduce((s, e) => s + e.xp, 0);
}

export function todayXP(tasks, plan, dayStartHour = 0, now = new Date()) {
  const today = effectiveTodayIso(dayStartHour, now);
  return xpEvents(tasks, plan, dayStartHour)
    .filter((e) => e.dateIso === today)
    .reduce((s, e) => s + e.xp, 0);
}

export function completedCount(tasks) {
  let n = 0;
  for (const t of tasks || []) {
    if (t.recurring === "daily" || t.recurring === "weekly") n += (t.history || []).length;
    else if (t.completed) n += 1;
  }
  return n;
}

// Streak: consecutive active days ending today or yesterday (an active
// yesterday keeps the flame alive until today's first completion).
export function streak(tasks, plan, dayStartHour = 0, now = new Date()) {
  const activity = activityByDay(tasks, plan, dayStartHour);
  const today = effectiveToday(dayStartHour, now);
  let cursor = activity.has(isoDate(today)) ? today : addDays(today, -1);
  let run = 0;
  while (activity.has(isoDate(cursor))) {
    run += 1;
    cursor = addDays(cursor, -1);
  }
  return run;
}

export function levelInfo(xp) {
  const thr = LEVEL_THRESHOLDS;
  let lvl = 0;
  for (let i = 0; i < thr.length; i++) if (xp >= thr[i]) lvl = i + 1;
  lvl = Math.min(lvl, thr.length);
  const prev = thr[Math.min(lvl - 1, thr.length - 1)];
  const next = thr[Math.min(lvl, thr.length - 1)] || prev * 2 || 200;
  const range = next - prev;
  const pct = range > 0 ? Math.min(((xp - prev) / range) * 100, 100) : 100;
  return {
    lvl,
    title: LEVEL_NAMES[Math.min(lvl - 1, LEVEL_NAMES.length - 1)],
    pct: Number.isNaN(pct) ? 100 : pct,
    xpToNext: Math.max(0, next - xp),
  };
}

/* ── plan helpers (pure transforms of the weekplan array) ──── */

export function getMissedWork(tasks, plan, dayStartHour = 0, now = new Date()) {
  const todayIso = effectiveTodayIso(dayStartHour, now);
  const byId = new Map((tasks || []).map((t) => [t.id, t]));
  const missed = [];
  for (const e of plan || []) {
    if (!e.date || e.date >= todayIso) continue;
    for (const it of e.items || []) {
      if (it.done) continue;
      const task = byId.get(it.taskId);
      if (!task || task.completed || task.recurring === "daily" || task.recurring === "weekly") continue;
      missed.push({ date: e.date, taskId: it.taskId, item: it, task });
    }
  }
  return missed.sort((a, b) => a.date.localeCompare(b.date));
}

export function planWith(plan, mutate) {
  const byDate = new Map();
  for (const e of plan || []) {
    byDate.set(e.date, { date: e.date, items: (e.items || []).map((it) => ({ ...it })) });
  }
  mutate(byDate);
  return Array.from(byDate.values())
    .filter((e) => e.items.length)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Pin task to a single date (replaces its undone chunks; done stay).
export function pinTask(plan, taskId, dateIso) {
  return planWith(plan, (byDate) => {
    for (const e of byDate.values()) {
      e.items = e.items.filter((it) => !(it.taskId === taskId && !it.done));
    }
    if (dateIso) {
      if (!byDate.has(dateIso)) byDate.set(dateIso, { date: dateIso, items: [] });
      byDate.get(dateIso).items.push({ taskId, done: false });
    }
  });
}

// Move one chunk between dates, keeping its hours/note/done state.
export function moveChunk(plan, taskId, fromDate, toDate) {
  if (!fromDate || !toDate || fromDate === toDate) return plan;
  let moved = null;
  const next = planWith(plan, (byDate) => {
    const src = byDate.get(fromDate);
    if (!src) return;
    const out = [];
    for (const it of src.items) {
      if (it.taskId === taskId && !moved) moved = it;
      else out.push(it);
    }
    src.items = out;
    if (!moved) return;
    const collision = byDate.get(toDate)?.items.some((i) => i.taskId === taskId);
    if (collision) { src.items.push(moved); moved = null; return; }
    if (!byDate.has(toDate)) byDate.set(toDate, { date: toDate, items: [] });
    byDate.get(toDate).items.push({ ...moved });
  });
  return moved === null && !plan.some(e => e.date === fromDate && e.items.some(i => i.taskId === taskId)) ? plan : next;
}

export function patchChunk(plan, taskId, dateIso, patch) {
  return planWith(plan, (byDate) => {
    const e = byDate.get(dateIso);
    if (!e) return;
    e.items = e.items.map((it) => {
      if (it.taskId !== taskId) return it;
      const merged = { ...it };
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") delete merged[k];
        else merged[k] = v;
      }
      return merged;
    });
  });
}

export function removeChunk(plan, taskId, dateIso, { undoneOnly = true } = {}) {
  return planWith(plan, (byDate) => {
    const e = byDate.get(dateIso);
    if (!e) return;
    e.items = e.items.filter((it) => !(it.taskId === taskId && (!undoneOnly || !it.done)));
  });
}

// Unified completion on the PLAN side: set a chunk's done state, and
// report whether the whole task is now fully done on the plan.
export function setChunkDone(plan, taskId, dateIso, done, nowMs = Date.now()) {
  const next = planWith(plan, (byDate) => {
    const e = byDate.get(dateIso);
    if (!e) return;
    e.items = e.items.map((it) =>
      it.taskId === taskId ? { ...it, done, doneAt: done ? nowMs : null } : it
    );
  });
  const all = [];
  for (const e of next) for (const it of e.items) if (it.taskId === taskId) all.push(it);
  return { plan: next, allDone: all.length > 0 && all.every((i) => i.done) };
}

// Mark every chunk of a task done/undone (used when completing the task
// itself so the two completion systems can never diverge).
export function setAllChunksDone(plan, taskId, done, nowMs = Date.now()) {
  return planWith(plan, (byDate) => {
    for (const e of byDate.values()) {
      e.items = e.items.map((it) =>
        it.taskId === taskId && it.done !== done
          ? { ...it, done, doneAt: done ? nowMs : null }
          : it
      );
    }
  });
}

/* ── replan operations applier (ported — it earned its place) ── */

export function normalizeTitleKey(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function applyReplanOps(existingPlan, ops, resolveTitle, lockedDates) {
  const lockSet = lockedDates instanceof Set ? lockedDates : new Set(lockedDates || []);
  const byDate = new Map();
  for (const e of existingPlan || []) {
    byDate.set(e.date, { date: e.date, items: (e.items || []).map((it) => ({ ...it })) });
  }
  const ensureDate = (date) => {
    if (!byDate.has(date)) byDate.set(date, { date, items: [] });
    return byDate.get(date);
  };
  const removeUndoneOf = (taskId) => {
    for (const entry of byDate.values()) {
      entry.items = entry.items.filter((it) => !(it.taskId === taskId && !it.done));
    }
  };
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;

  const applied = [];
  const skipped = [];
  for (const op of ops || []) {
    if (!op || typeof op !== "object" || !op.op || !op.task) {
      skipped.push({ op, reason: "malformed" });
      continue;
    }
    const taskId = resolveTitle(op.task);
    if (!taskId) { skipped.push({ op, reason: "unknown task" }); continue; }

    if (op.op === "move" || op.op === "schedule") {
      const date = op.to;
      if (!date || !isoRe.test(date)) { skipped.push({ op, reason: "bad date" }); continue; }
      if (lockSet.has(date)) { skipped.push({ op, reason: "locked target" }); continue; }
      removeUndoneOf(taskId);
      ensureDate(date).items.push({ taskId, done: false });
      applied.push(op);
    } else if (op.op === "unschedule") {
      removeUndoneOf(taskId);
      applied.push(op);
    } else if (op.op === "split") {
      if (!Array.isArray(op.chunks) || !op.chunks.length) {
        skipped.push({ op, reason: "no chunks" });
        continue;
      }
      const validChunks = op.chunks.filter((c) =>
        c && isoRe.test(c.date) && !lockSet.has(c.date)
        && typeof c.hours === "number" && c.hours > 0
      );
      if (!validChunks.length) { skipped.push({ op, reason: "no valid chunks" }); continue; }
      removeUndoneOf(taskId);
      for (const c of validChunks) {
        const item = { taskId, done: false, hours: Math.round(c.hours * 10) / 10 };
        if (typeof c.note === "string" && c.note.trim()) item.note = c.note.trim().slice(0, 80);
        ensureDate(c.date).items.push(item);
      }
      applied.push(op);
    } else {
      skipped.push({ op, reason: "unknown op" });
    }
  }

  const next = Array.from(byDate.values())
    .filter((e) => e.items.length)
    .sort((a, b) => a.date.localeCompare(b.date));
  return { next, applied, skipped };
}

/* ── energy sort ───────────────────────────────────────────── */

export function sortForEnergy(arr, energy) {
  const priorityOf = (t) => PRIORITIES[t.priority || "medium"].order;
  const diffOf = (t) => DIFFICULTY_ORDER.indexOf(t.difficulty || "medium");
  if (energy === "normal" || !energy) {
    return arr.slice().sort((a, b) => priorityOf(a) - priorityOf(b));
  }
  return arr.slice().sort((a, b) => {
    const da = diffOf(a), db = diffOf(b);
    if (da !== db) return energy === "high" ? db - da : da - db;
    return priorityOf(a) - priorityOf(b);
  });
}

export function progressOfProject(p, tasksById) {
  const ids = p.childTaskIds || [];
  if (!ids.length) return 0;
  let total = 0, done = 0;
  for (const id of ids) {
    const t = tasksById.get(id);
    if (!t) continue;
    total += 1;
    if (t.completed) done += 1;
  }
  return total ? Math.round((done / total) * 100) : 0;
}

/* ── achievements (derived checks) ─────────────────────────── */

export function checkAchievements({ tasks, plan, projects, screenToday, dayStartHour = 0, baseline = 0 }) {
  const total = totalXP(tasks, plan, baseline, dayStartHour);
  const tXP = todayXP(tasks, plan, dayStartHour);
  const count = completedCount(tasks);
  const run = streak(tasks, plan, dayStartHour);
  const wk = Date.now() - 7 * 86400000;
  const launched = (projects || []).filter((p) => p.completedAt).length;
  return {
    first:     count >= 1,
    five:      count >= 5,
    twenty:    count >= 20,
    streak3:   run >= 3,
    streak7:   run >= 7,
    day100:    tXP >= 100,
    xp500:     total >= 500,
    xp1000:    total >= 1000,
    epic:      (tasks || []).some((x) => x.completed && x.difficulty === "epic"),
    decompose: (tasks || []).some((x) => x.completed && (x.subtasks || []).filter((s) => s.done).length >= 3),
    framer3:   (tasks || []).filter((x) => x.completed && x.completedAt > wk && (x.tags || []).includes("framer")).length >= 3,
    speed:     (tasks || []).some((x) => x.completed && x.completedAt && x.createdAt && (x.completedAt - x.createdAt) < 1800000),
    clean_day: !!screenToday && (screenToday.xOpens || 0) === 0 && (screenToday.ytOpens || 0) === 0 && screenToday.mobileHours != null && screenToday.mobileHours <= 1,
    project:   launched >= 1,
    fleet3:    launched >= 3,
    fleet10:   launched >= 10,
  };
}

export function achievementProgress(id, { tasks, plan, projects, dayStartHour = 0, baseline = 0 }) {
  const count = completedCount(tasks);
  const run = streak(tasks, plan, dayStartHour);
  const total = totalXP(tasks, plan, baseline, dayStartHour);
  const tXP = todayXP(tasks, plan, dayStartHour);
  const launched = (projects || []).filter((p) => p.completedAt).length;
  switch (id) {
    case "first":   return { cur: count, target: 1 };
    case "five":    return { cur: count, target: 5 };
    case "twenty":  return { cur: count, target: 20 };
    case "streak3": return { cur: run, target: 3 };
    case "streak7": return { cur: run, target: 7 };
    case "day100":  return { cur: tXP, target: 100 };
    case "xp500":   return { cur: total, target: 500 };
    case "xp1000":  return { cur: total, target: 1000 };
    case "fleet3":  return { cur: launched, target: 3 };
    case "fleet10": return { cur: launched, target: 10 };
    default:        return null;
  }
}
