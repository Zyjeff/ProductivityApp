import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ───── CONSTANTS ───── */

const LEVEL_THRESHOLDS = [0,100,250,500,900,1500,2400,3700,5500,8000,12000];
const LEVEL_NAMES = ["Rookie","Initiate","Builder","Craftsman","Architect","Expert","Master","Elite","Legend","Ascended","Immortal"];

const DIFFICULTY = {
  easy:   { label: "easy",   hours: 0.5, tone: "var(--success)" },
  medium: { label: "medium", hours: 1.5, tone: "var(--info)" },
  hard:   { label: "hard",   hours: 3.0, tone: "var(--warning)" },
  epic:   { label: "epic",   hours: 5.0, tone: "var(--danger)" },
};

const PRIORITIES = {
  urgent: { label: "Urgent", dot: "var(--danger)",     order: 0 },
  high:   { label: "High",   dot: "var(--warning)",    order: 1 },
  medium: { label: "Medium", dot: "var(--info)",       order: 2 },
  low:    { label: "Low",    dot: "var(--text-faint)", order: 3 },
};

const TASK_TAGS_BUILTIN = ["framer","client","admin","creative","music","personal"];
// Convenience: returns the union of builtin + user-added custom tags, with
// builtin first. Used for tag pickers, filters, and the editor.
function allKnownTags(customTags) {
  const out = [...TASK_TAGS_BUILTIN];
  for (const t of (customTags || [])) {
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

const PROJECT_TYPES = [
  { id: "template",  label: "Template" },
  { id: "component", label: "Component" },
  { id: "client",    label: "Client" },
  { id: "side",      label: "Side Project" },
  { id: "other",     label: "Other" },
];
const PROJECT_TYPE_LABEL_TO_ID = {
  "Template": "template", "Component": "component",
  "Client":   "client",   "Side Project": "side",
};

// 10 hand-picked palette swatches — distinguishable on dark bg, not loud.
// Stable order so the swatch row in the editor renders deterministically.
const PROJECT_PALETTE = [
  "#a78bfa", // violet (accent)
  "#60a5fa", // blue
  "#34d399", // emerald
  "#fbbf24", // amber
  "#f87171", // red
  "#f472b6", // pink
  "#22d3ee", // cyan
  "#a3e635", // lime
  "#fb923c", // orange
  "#94a3b8", // slate
];
function pickProjectColor() {
  return PROJECT_PALETTE[Math.floor(Math.random() * PROJECT_PALETTE.length)];
}

const WEEKDAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
const WEEK_ALL  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DEFAULT_CAPS = { Monday:4, Tuesday:4, Wednesday:4, Thursday:4, Friday:3, Saturday:0, Sunday:0 };

const ACHIEVEMENTS = [
  { id:"first",     title:"First Strike",   desc:"Complete your first task" },
  { id:"five",      title:"Warming Up",     desc:"Complete 5 tasks" },
  { id:"twenty",    title:"On Fire",        desc:"Complete 20 tasks" },
  { id:"streak3",   title:"Tidal",          desc:"3-day streak" },
  { id:"streak7",   title:"Week Warrior",   desc:"7-day streak" },
  { id:"day100",    title:"Century Day",    desc:"100 XP in one day" },
  { id:"xp500",     title:"Half K",         desc:"500 total XP" },
  { id:"xp1000",    title:"One Thou",       desc:"1000 total XP" },
  { id:"epic",      title:"Epic Slayer",    desc:"Complete an epic task" },
  { id:"decompose", title:"Decomposer",     desc:"Task with 3+ subtasks done" },
  { id:"framer3",   title:"Framer Grinder", desc:"3 Framer tasks in a week" },
  { id:"speed",     title:"Speed Run",      desc:"Done within 30min of adding" },
  { id:"clean_day", title:"Clean Day",      desc:"Zero social opens + under 1h mobile" },
  { id:"project",   title:"Architect",      desc:"Ship your first project" },
];

const KEYS = {
  tasks: "quest_tasks",
  projects: "quest_projects",
  profile: "quest_profile",
  achievements: "quest_achievements",
  weekplan: "quest_weekplan",
  caps: "quest_caps",
  screen: "quest_screen",
  schema: "quest_schema_v",
  customTags: "quest_custom_tags",
};
const SCHEMA_VERSION = 8;

const NAV_ITEMS = [
  { id: "today",    label: "Today",    glyph: "T", shortcut: "1" },
  { id: "queue",    label: "Queue",    glyph: "Q", shortcut: "2" },
  { id: "pipeline", label: "Pipeline", glyph: "P", shortcut: "3" },
  { id: "planner",  label: "Planner",  glyph: "L", shortcut: "4" },
  { id: "habits",   label: "Habits",   glyph: "H", shortcut: "5" },
  { id: "trophies", label: "Trophies", glyph: "*", shortcut: "6" },
];

const PREVIEW_KEY = "quest_preview_snapshot";
const LOCKS_KEY = "quest_locks";

/* ───── STORAGE ───── */

async function loadKV(key, fallback) {
  let r;
  try { r = await window.storage.get(key); }
  catch (e) { console.error(`storage.get("${key}") failed:`, e); return fallback; }
  if (!r || r.value == null) return fallback;
  try { return JSON.parse(r.value); }
  catch (e) { console.error(`corrupt JSON in "${key}":`, e, r.value?.slice?.(0, 120)); return fallback; }
}
async function saveKV(key, value) {
  try { await window.storage.set(key, JSON.stringify(value)); }
  catch (e) { console.error("storage save", key, e); }
}

/* ───── MIGRATION ───── */

async function runMigrations() {
  const v = await loadKV(KEYS.schema, 0);
  if (v >= SCHEMA_VERSION) return;

  // Pull legacy vsq_* (Quest) keys forward.
  const legacy = await Promise.all([
    loadKV("vsq_tasks",        null),
    loadKV("vsq_projects",     null),
    loadKV("vsq_profile",      null),
    loadKV("vsq_achievements", null),
    loadKV("vsq_weekplan",     null),
    loadKV("vsq_caps",         null),
    loadKV("vsq_screenlog",    null),
  ]);
  const [lt, lp, lpr, la, lw, lc, ls] = legacy;
  if (lt  != null && !(await loadKV(KEYS.tasks,        null))) await saveKV(KEYS.tasks,        lt);
  if (lp  != null && !(await loadKV(KEYS.projects,     null))) await saveKV(KEYS.projects,     lp);
  if (lpr != null && !(await loadKV(KEYS.profile,      null))) await saveKV(KEYS.profile,      lpr);
  if (la  != null && !(await loadKV(KEYS.achievements, null))) await saveKV(KEYS.achievements, la);
  if (lw  != null && !(await loadKV(KEYS.weekplan,     null))) await saveKV(KEYS.weekplan,     lw);
  if (lc  != null && !(await loadKV(KEYS.caps,         null))) await saveKV(KEYS.caps,         lc);
  if (ls  != null && !(await loadKV(KEYS.screen,       null))) await saveKV(KEYS.screen,       ls);

  // Pull ship-list-projects-v2 forward — convert to Quest projects + child tasks.
  const shipList = await loadKV("shiplist-projects-v2", null);
  if (Array.isArray(shipList) && shipList.length) {
    const curTasks    = (await loadKV(KEYS.tasks,    [])) || [];
    const curProjects = (await loadKV(KEYS.projects, [])) || [];

    const newTasks = [];
    const newProjects = [];
    for (const sp of shipList) {
      const pid = "p-mig-" + sp.id;
      const childIds = [];
      for (const t of (sp.tasks || [])) {
        const tid = "ct-mig-" + sp.id + "-" + t.id;
        childIds.push(tid);
        newTasks.push({
          id: tid,
          title: t.name,
          desc: "", notes: "", tags: [], subtasks: [],
          xp: 15, difficulty: "easy", reason: "imported",
          recurring: "none", priority: "medium",
          projectId: pid,
          completed: !!t.done,
          completedAt: t.done ? (sp.shippedAt || sp.createdAt || Date.now()) : null,
          createdAt: sp.createdAt || Date.now(),
        });
      }
      newProjects.push({
        id: pid,
        title: sp.name,
        desc: "", notes: "", tags: [],
        type: PROJECT_TYPE_LABEL_TO_ID[sp.type] || "other",
        createdAt: sp.createdAt || Date.now(),
        completedAt: sp.shipped ? (sp.shippedAt || Date.now()) : null,
        shippedAt:   sp.shipped ? (sp.shippedAt || Date.now()) : null,
        childTaskIds: childIds,
      });
    }
    if (newProjects.length) {
      await saveKV(KEYS.projects, curProjects.concat(newProjects));
      await saveKV(KEYS.tasks,    curTasks.concat(newTasks));
    }
  }

  // Backfill `type` on any existing projects that don't have one.
  const existing = await loadKV(KEYS.projects, []);
  if (Array.isArray(existing) && existing.some(p => !p.type)) {
    await saveKV(KEYS.projects, existing.map(p => ({ ...p, type: p.type || "other" })));
  }

  // v1 → v2: weekPlan stored as {week, day} relative to "now" — convert to
  // absolute ISO dates so the planner can support a full year of scheduling.
  if (v < 2) {
    const wp = await loadKV(KEYS.weekplan, null);
    if (Array.isArray(wp) && wp.length && wp[0] && wp[0].day && !wp[0].date) {
      const today = new Date();
      const thisMonday = mondayOf(today);
      const nextMonday = addDays(thisMonday, 7);
      const dayIdx = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 };
      const converted = wp
        .map(e => {
          const base = (e.week || "current") === "next" ? nextMonday : thisMonday;
          const idx = dayIdx[e.day];
          if (idx == null) return null;
          return { date: isoDate(addDays(base, idx)), tasks: e.tasks || [] };
        })
        .filter(Boolean);
      await saveKV(KEYS.weekplan, converted);
    }
  }

  // v2 → v3: weekPlan entries reference scheduled tasks by title (fragile —
  // rename or duplicate title silently drops/mis-matches them). Convert to
  // {date, taskIds: [id]}. Unresolvable titles are dropped.
  if (v < 3) {
    const wp = await loadKV(KEYS.weekplan, null);
    const ts = await loadKV(KEYS.tasks, []) || [];
    if (Array.isArray(wp) && wp.length && wp[0] && wp[0].tasks && !wp[0].taskIds) {
      const titleToId = new Map();
      for (const t of ts) if (!titleToId.has(t.title)) titleToId.set(t.title, t.id);
      const converted = wp.map(e => ({
        date: e.date,
        taskIds: (e.tasks || []).map(title => titleToId.get(title)).filter(Boolean),
      })).filter(e => e.taskIds.length);
      await saveKV(KEYS.weekplan, converted);
    }
  }

  // v3 → v4: weekPlan entries gain items[]: a richer shape that lets a
  // single task be split across multiple days with a per-day note + hours.
  // {date, taskIds:[id]} -> {date, items:[{taskId:id}]}.
  if (v < 4) {
    const wp = await loadKV(KEYS.weekplan, null);
    if (Array.isArray(wp) && wp.length && wp[0] && wp[0].taskIds && !wp[0].items) {
      const converted = wp
        .map(e => ({ date: e.date, items: (e.taskIds || []).map(id => ({ taskId: id })) }))
        .filter(e => e.items.length);
      await saveKV(KEYS.weekplan, converted);
    }
  }

  // v4 → v5: items gain `done` (per-chunk completion). For each existing
  // item, mirror the parent task's completion so prior visual state holds.
  if (v < 5) {
    const wp = await loadKV(KEYS.weekplan, null);
    const ts = (await loadKV(KEYS.tasks, [])) || [];
    if (Array.isArray(wp) && wp.length && wp[0] && Array.isArray(wp[0].items)) {
      const byId = new Map(ts.map(t => [t.id, t]));
      const converted = wp.map(e => ({
        date: e.date,
        items: (e.items || []).map(it => ({
          ...it,
          done: typeof it.done === "boolean" ? it.done : !!byId.get(it.taskId)?.completed,
        })),
      }));
      await saveKV(KEYS.weekplan, converted);
    }
  }

  // v5 → v6: projects gain a `color` from PROJECT_PALETTE. Existing projects
  // without one get a random pick so the new color chip has something to
  // show. Future projects assign on creation.
  if (v < 6) {
    const ps = (await loadKV(KEYS.projects, [])) || [];
    if (Array.isArray(ps) && ps.some(p => !p.color)) {
      const next = ps.map(p => p.color ? p : { ...p, color: pickProjectColor() });
      await saveKV(KEYS.projects, next);
    }
  }

  // v6 → v7: items gain `doneAt` (timestamp of chunk completion) so daily
  // activity stats can attribute partial-chunk work to the day it actually
  // happened. For items that were already done before this migration, fall
  // back to the parent task's completedAt; failing that, the item's date
  // (parsed as local midnight) — both are approximations but better than
  // dropping the data point.
  if (v < 7) {
    const wp = await loadKV(KEYS.weekplan, null);
    const ts = (await loadKV(KEYS.tasks, [])) || [];
    if (Array.isArray(wp) && wp.length && wp[0] && Array.isArray(wp[0].items)) {
      const byId = new Map(ts.map(t => [t.id, t]));
      const converted = wp.map(e => ({
        date: e.date,
        items: (e.items || []).map(it => {
          if (!it.done || it.doneAt) return it;
          const task = byId.get(it.taskId);
          const fallback = task?.completedAt || (() => {
            const [y, m, d] = (e.date || "").split("-").map(Number);
            return y && m && d ? new Date(y, m - 1, d, 12).getTime() : Date.now();
          })();
          return { ...it, doneAt: fallback };
        }),
      }));
      await saveKV(KEYS.weekplan, converted);
    }
  }

  // v7 → v8: daily tasks gain `dailyCompletions: string[]` — array of ISO
  // date strings on which the task was completed. Before this, daily
  // tasks' historical completions were lost when processRecurring reset
  // them at next-day rollover, so the This Week graph and trend stats
  // had no record of yesterday's daily-task work after rollover.
  //
  // Seed: if a task is currently completed and we have a completedAt,
  // push that completion's iso date so today's bar doesn't drop right
  // after the migration runs. Otherwise empty — we can't reconstruct
  // history we never stored.
  if (v < 8) {
    const ts = (await loadKV(KEYS.tasks, [])) || [];
    if (Array.isArray(ts) && ts.some(t => t.recurring === "daily" && !Array.isArray(t.dailyCompletions))) {
      const next = ts.map(t => {
        if (t.recurring !== "daily") return t;
        if (Array.isArray(t.dailyCompletions)) return t;
        const seed = [];
        if (t.completed && t.completedAt) {
          seed.push(isoDate(new Date(t.completedAt)));
        }
        return { ...t, dailyCompletions: seed };
      });
      await saveKV(KEYS.tasks, next);
    }
  }

  await saveKV(KEYS.schema, SCHEMA_VERSION);
}

/* ───── AI ─────
   Both calls use Anthropic prompt caching via cache_control on the
   stable rules prefix. Cache only activates when the prefix exceeds
   the per-model token threshold (1024 Sonnet, 2048 Haiku); our
   prefixes are smaller today, so cache_control is a no-op for now
   but free hygiene against future prompt growth. */

const AI_SCORE_RULES =
  "You are scoring tasks for a freelance UI/UX dev productivity app. " +
  "Apply the rules below carefully and return only JSON.\n\n" +
  "BASE XP: admin/email=5-15, simple fix=15-30, component/feature=30-60, " +
  "complex build=60-85, major deliverable=85-100.\n" +
  "SUBTASKS: 0=no change, 1-2=+3-8, 3-4=+10-18, 5+=+20-30.\n" +
  "DESCRIPTION: one-liner=no change, paragraph=+5-12, extensive=+10-20.\n" +
  "DIFFICULTY: easy=simple+no subtasks, medium=some complexity or 1-3 subtasks, " +
  "hard=complex or 4+ subtasks, epic=major or 6+ subtasks.\n" +
  "HOURS: realistic focused-work hours to ship this task end-to-end (review " +
  "the full description, subtasks, notes, tags). Round to 0.25 or 0.5 " +
  "increments. Typical ranges: easy 0.25-1, medium 1-2.5, hard 2.5-5, " +
  "epic 5-10. Larger work can exceed a single day — the planner handles " +
  "splitting later, you just need an honest total.\n\n" +
  "Output schema: {\"xp\":<int 5-100>,\"difficulty\":\"easy|medium|hard|epic\"," +
  "\"hours\":<float 0.25-12>,\"reason\":\"<10 words>\"}. No markdown, no commentary.";

async function aiScore(title, desc, subtasks, tags, notes) {
  const subCount = subtasks ? subtasks.length : 0;
  const subList  = subCount ? subtasks.join(", ") : "";
  const dynamic =
    `Task: "${title}"\n` +
    (desc  ? `Description: ${desc}\n` : "") +
    (notes ? `Notes: ${notes}\n` : "") +
    (subCount ? `Subtasks (${subCount}): ${subList}\n` : "") +
    (tags && tags.length ? `Tags: ${tags.join(", ")}\n` : "");
  try {
    const r = await fetch("/api/anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 120,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: AI_SCORE_RULES, cache_control: { type: "ephemeral" } },
            { type: "text", text: dynamic },
          ],
        }],
      }),
    });
    const d = await r.json();
    return JSON.parse(d.content[0].text.replace(/```\w*|```/g, "").trim());
  } catch {
    return { xp: 20, difficulty: "medium", reason: "auto" };
  }
}

function extractJsonArray(text) {
  if (!text) return null;
  const stripped = String(text).replace(/```\w*|```/g, "").trim();
  // Direct attempt
  try { const j = JSON.parse(stripped); if (Array.isArray(j)) return j; } catch {}
  // Fall back: find the first '[' and the matching final ']'
  const first = stripped.indexOf("[");
  const last = stripped.lastIndexOf("]");
  if (first === -1 || last === -1 || last <= first) return null;
  try { const j = JSON.parse(stripped.slice(first, last + 1)); if (Array.isArray(j)) return j; } catch {}
  return null;
}

function normalizeTitleKey(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Apply a list of replan operations to an existing plan, mutating only the
// tasks the ops reference. Done chunks stay put always. Locked dates are
// rejected as op targets (caller filters before invoking, but we double-check).
function applyReplanOps(existingPlan, ops, resolveTitle, lockedDates) {
  const lockSet = lockedDates instanceof Set ? lockedDates : new Set(lockedDates || []);
  // Deep copy so the original isn't mutated on early failures.
  const byDate = new Map();
  for (const e of existingPlan) {
    byDate.set(e.date, { date: e.date, items: (e.items || []).map(it => ({ ...it })) });
  }
  const ensureDate = (date) => {
    if (!byDate.has(date)) byDate.set(date, { date, items: [] });
    return byDate.get(date);
  };
  const removeUndoneOf = (taskId) => {
    for (const entry of byDate.values()) {
      entry.items = entry.items.filter(it => !(it.taskId === taskId && !it.done));
    }
  };
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;

  const applied = [];
  const skipped = [];
  for (const op of (ops || [])) {
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
      const validChunks = op.chunks.filter(c =>
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
    .filter(e => e.items.length)
    .sort((a, b) => a.date.localeCompare(b.date));
  return { next, applied, skipped };
}

const AI_PLAN_RULES =
  "OUTPUT FORMAT — STRICT. Your entire response is a single JSON array. " +
  "Do NOT think out loud, do NOT include any prose, headers, code fences, " +
  "explanations, or commentary before, between, or after the JSON. The " +
  "response starts with `[` and ends with `]`. If you need to reason, do " +
  "it internally and only output the final array.\n\n" +
  "You are a scheduler for Jeffrey (freelance UI/UX dev, Netherlands). " +
  "Given a list of unscheduled tasks and a set of workdays with their " +
  "remaining capacity (hours), assign tasks to specific dates.\n\n" +
  "RULES:\n" +
  "1. Never exceed a day's REMAINING capacity.\n" +
  "2. SPLIT BIG TASKS. If a task's estimated hours exceed any single day's " +
  "remaining capacity, split it across consecutive days. For each chunk, " +
  "provide hours and a one-line note describing what specifically happens " +
  "that day. Split chunks should sum to the task's total estimate.\n" +
  "3. Default: fill earlier days before later ones — don't artificially spread " +
  "work when it could finish sooner. EXCEPTION: if the user's request " +
  "explicitly specifies a timeline (\"spread over 3 months\", \"by end of " +
  "October\", \"a few per week until X\"), honor it as a top-priority " +
  "constraint and distribute accordingly across the requested range. You may " +
  "still split tasks across consecutive days within that range.\n" +
  "4. Priority order: urgent > high > medium > low.\n" +
  "5. Pair hard/focus work with mornings; light/admin work with afternoons.\n" +
  "6. Daily recurring tasks are NOT in the task list — they're already " +
  "subtracted from each day's capacity. Do not schedule them.\n" +
  "7. Tasks already on the calendar (when listed) stay put unless you are " +
  "explicitly asked to optimize.\n" +
  "8. You may schedule onto any date in the workdays-available list, " +
  "including months out — choose the date(s) that best fit the request.\n" +
  "9. DEADLINES are immovable upper bounds. When a task line shows a " +
  "`deadline: YYYY-MM-DD`, all of that task's scheduling MUST land on or " +
  "before that date. If priority or earliest-first packing would push a " +
  "deadlined task past its deadline, override the default and pull it " +
  "forward — even if that displaces lower-priority work. If a deadline " +
  "literally cannot fit (the date is in the past or the days before it " +
  "have no capacity), schedule on the latest day you can and leave the " +
  "overflow as your best attempt.\n\n" +
  "Output schema: a JSON array of day entries, each {\"date\":\"YYYY-MM-DD\"," +
  "\"items\":[...]}. Each item is one of:\n" +
  "  {\"title\":\"exact task title\"}                                — task fits in one day\n" +
  "  {\"title\":\"exact task title\",\"hours\":<num>,\"note\":\"<10-15 word slice>\"} — one chunk of a split task\n" +
  "Include only dates that receive at least one item. No markdown, no " +
  "commentary, no code fences.";

// Replan is a SURGICAL EDIT — output operations, not a full plan. The applier
// only touches tasks named in ops; everything else stays exactly where it is.
// This kills the old failure mode where "move just the IGP work" would
// accidentally reshuffle non-IGP tasks because the AI re-output the entire
// schedule from scratch.
const AI_REPLAN_RULES =
  "OUTPUT FORMAT — STRICT. Your entire response is a single JSON array of " +
  "edit operations. Do NOT think out loud, do NOT wrap in code fences. " +
  "Response starts with `[` and ends with `]`. If the request is impossible " +
  "to interpret, return `[]`.\n\n" +
  "You are EDITING an existing schedule. Tasks NOT mentioned in your output " +
  "stay EXACTLY where they are. Be SURGICAL — emit only the operations needed " +
  "to satisfy the user's request. If a task is unrelated to the request, " +
  "don't touch it.\n\n" +
  "OPERATIONS (each item in the array is one of):\n" +
  "  {\"op\":\"move\",\"task\":\"<exact title>\",\"to\":\"YYYY-MM-DD\"}\n" +
  "      Move task to a single date. If currently split across days, this " +
  "collapses it to one date.\n\n" +
  "  {\"op\":\"split\",\"task\":\"<exact title>\",\"chunks\":[{\"date\":\"YYYY-MM-DD\",\"hours\":N,\"note\":\"<10-15 word slice>\"},...]}\n" +
  "      Replace the task's UNDONE scheduling with these chunks. Done chunks " +
  "are immutable — leave them out of the chunks array; the system keeps them. " +
  "Sum of `hours` should match the task's UNDONE remainder.\n\n" +
  "  {\"op\":\"schedule\",\"task\":\"<exact title>\",\"to\":\"YYYY-MM-DD\"}\n" +
  "      Schedule a currently-unscheduled task to a date. Use `split` shape " +
  "instead if it needs multiple days.\n\n" +
  "  {\"op\":\"unschedule\",\"task\":\"<exact title>\"}\n" +
  "      Remove all undone chunks of a task from the schedule.\n\n" +
  "CONSTRAINTS:\n" +
  "1. NEVER include operations for tasks the user didn't reference (by name " +
  "or by project). When unsure, omit — leaving a task alone is always safe.\n" +
  "2. Done chunks (listed with DONE in the current plan) are immutable. Your " +
  "split chunks cover only the undone remainder.\n" +
  "3. Locked days are unavailable as targets.\n" +
  "4. Respect day capacity, but when the user explicitly asks to spread or " +
  "concentrate, honor that — it overrides the bunching default.\n" +
  "5. The user may reference tasks by project name (\"the IGP tasks\", " +
  "\"client work\") — the project tag in [brackets] on each plan line is " +
  "your guide. Match all tasks whose project matches the reference.\n\n" +
  "No markdown, no commentary, no code fences. Only the JSON array.";

const AI_CAPTURE_RULES =
  "You turn freeform descriptions into structured tasks for a productivity " +
  "app. Be concrete, action-oriented, and concise. Sentence case. No trailing " +
  "periods on titles.\n\n" +
  "Three output schemas keyed by MODE.\n\n" +
  "MODE: TASK — single action item.\n" +
  "{\"title\":\"<5-10 word title>\",\"description\":\"<one-sentence summary or empty if input is already concise>\"," +
  "\"recurring\":\"none|daily|weekly\"}\n\n" +
  "MODE: SUBTASKS — a task with concrete steps.\n" +
  "{\"title\":\"<5-10 word title>\",\"description\":\"<optional one-sentence summary>\"," +
  "\"recurring\":\"none|daily|weekly\"," +
  "\"subtasks\":[\"<~5 word action step>\",...3-6 items, each starting with a verb...]}\n\n" +
  "MODE: PROJECT — a multi-task initiative.\n" +
  "{\"title\":\"<2-5 word project name, noun phrase>\",\"description\":\"<brief goal>\"," +
  "\"tasks\":[{\"title\":\"<~5-8 word action task>\",\"description\":\"\"}, ...3-7 items...]}\n\n" +
  "Rules:\n" +
  "- If the user already provided a good title, keep it but tidy it.\n" +
  "- Don't pad with filler. Specific > generic.\n" +
  "- For PROJECT mode, the tasks should cover the project end-to-end and be " +
  "sized to ~0.5-3h each.\n" +
  "- For TASK / SUBTASKS modes, detect recurrence from the input:\n" +
  "    * \"daily\", \"every day\", \"each morning\", \"every evening\", or any\n" +
  "      phrase implying a once-per-day cadence → \"daily\"\n" +
  "    * \"weekly\", \"every week\", \"every Monday\", \"each Friday\", \"once\n" +
  "      a week\" → \"weekly\"\n" +
  "    * Otherwise → \"none\". Don't guess — only set non-none when the\n" +
  "      input clearly indicates repetition.\n" +
  "  When you set recurring to daily or weekly, the title should NOT include\n" +
  "  the cadence word (\"Daily standup\" → \"Standup\" with recurring:daily).\n\n" +
  "Return ONLY valid JSON matching the requested mode's schema. No markdown, " +
  "no commentary, no code fences.";

// AI-extend a project — adds N new tasks to an existing project, sized to
// fit alongside the tasks already there. Returns scored tasks ready for
// addChildToProject (no re-score needed). The AI sees the project title +
// description plus the existing child tasks for context, so it can match
// their sizing and avoid duplicates.
const AI_PROJECT_EXTEND_RULES =
  "OUTPUT FORMAT — STRICT. Your entire response is a single JSON array. " +
  "Do NOT include prose, headers, or code fences. Starts with `[`, ends with `]`.\n\n" +
  "You are adding new tasks to an existing project. Generate tasks that fit " +
  "the project's scope, satisfy the user's request, and DO NOT duplicate " +
  "existing tasks (you'll be shown the current list). Score each task with " +
  "XP and hours so they integrate cleanly with the rest.\n\n" +
  "Output schema: an array of task objects, each:\n" +
  "{\"title\":\"<5-10 word action title, sentence case, no period>\"," +
  "\"description\":\"<one-line summary or empty>\"," +
  "\"hours\":<float 0.25-12>," +
  "\"xp\":<int 5-100>," +
  "\"difficulty\":\"easy|medium|hard|epic\"," +
  "\"priority\":\"urgent|high|medium|low\"," +
  "\"reason\":\"<10 word note explaining the score>\"}\n\n" +
  "SIZING REFERENCE:\n" +
  "  HOURS: easy 0.25-1, medium 1-2.5, hard 2.5-5, epic 5-10 (focused work).\n" +
  "  XP base: admin/email 5-15, simple 15-30, component/feature 30-60, " +
  "complex 60-85, major deliverable 85-100.\n\n" +
  "GUIDELINES:\n" +
  "1. Match the existing tasks' style + granularity. If the project has many " +
  "small (~1h) tasks, prefer small. If it has a few big (~5h) tasks, you can " +
  "go bigger.\n" +
  "2. Tasks should be concrete and action-oriented (start with a verb).\n" +
  "3. Default to 1-5 tasks unless the user explicitly asks for more.\n" +
  "4. If the user asks for one specific task, return one. Don't pad.\n" +
  "5. Priority: default medium unless the user request implies urgency.\n" +
  "6. Recurring tasks aren't typical for projects — leave it out.\n\n" +
  "Return ONLY the JSON array. No markdown, no commentary.";

async function aiExtendProject(project, existingTasks, query) {
  const existingLines = (existingTasks || [])
    .map(t => `- "${t.title}" ~${taskHours(t)}h, ${t.xp}XP, ${t.difficulty}`)
    .join("\n");
  const dynamic =
    `PROJECT: "${project.title}"\n` +
    (project.desc ? `Description: ${project.desc}\n` : "") +
    (project.notes ? `Notes: ${project.notes}\n` : "") +
    `\nEXISTING TASKS (${existingTasks?.length || 0} — don't duplicate, match sizing):\n` +
    (existingLines || "(none yet)") +
    `\n\nUSER REQUEST: ${query.trim()}\n`;
  try {
    const r = await fetch("/api/anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: AI_PROJECT_EXTEND_RULES, cache_control: { type: "ephemeral" } },
            { type: "text", text: dynamic },
          ],
        }],
      }),
    });
    if (!r.ok) {
      let errBody = "";
      try { errBody = await r.text(); } catch {}
      console.error(`aiExtendProject HTTP ${r.status}:`, errBody.slice(0, 800));
      return null;
    }
    const d = await r.json();
    const rawText = d?.content?.[0]?.text || "";
    const parsed = extractJsonArray(rawText);
    if (!Array.isArray(parsed)) {
      console.warn("aiExtendProject: couldn't extract JSON array", rawText.slice(0, 500));
      return null;
    }
    // Sanitize each task — clamp ranges, defaults for missing fields.
    return parsed
      .map(t => {
        if (!t || !t.title) return null;
        const difficulty = ["easy", "medium", "hard", "epic"].includes(t.difficulty) ? t.difficulty : "medium";
        const priority = ["urgent", "high", "medium", "low"].includes(t.priority) ? t.priority : "medium";
        const hours = typeof t.hours === "number" && t.hours > 0
          ? Math.min(12, Math.max(0.25, Math.round(t.hours * 4) / 4))
          : DIFFICULTY[difficulty]?.hours || 1.5;
        const xp = typeof t.xp === "number" && t.xp > 0
          ? Math.min(100, Math.max(5, Math.round(t.xp)))
          : 20;
        return {
          title: String(t.title).trim().slice(0, 120),
          description: typeof t.description === "string" ? t.description.trim().slice(0, 240) : "",
          hours, xp, difficulty, priority,
          reason: typeof t.reason === "string" ? t.reason.trim().slice(0, 80) : "ai-extended",
        };
      })
      .filter(Boolean);
  } catch (e) {
    console.error("aiExtendProject failed:", e);
    return null;
  }
}

// Vision-based import — user uploads a screenshot of a third-party task
// board (Trello, Asana, Linear, Notion, paper, anything), and Claude
// extracts tasks from it. Sonnet because vision quality matters. The user
// can pre-edit the list before committing.
const AI_IMPORT_VISION_RULES =
  "OUTPUT FORMAT — STRICT. Your entire response is a single JSON array. " +
  "Do NOT wrap in code fences. Starts with `[`, ends with `]`.\n\n" +
  "You are reading a screenshot from a task management tool (Trello, Asana, " +
  "Linear, Notion, paper notebook, anything) and extracting the tasks shown " +
  "into a structured list. Be conservative: only emit a task for things that " +
  "look like actionable items. Section headers, dates, usernames, and column " +
  "labels (like \"To-do\" / \"In progress\" / \"Done\") are NOT tasks.\n\n" +
  "Per-task schema:\n" +
  "{\"title\":\"<5-12 word action title, sentence case, no period>\"," +
  "\"description\":\"<one-line context if visible, else empty>\"," +
  "\"difficulty\":\"easy|medium|hard|epic\"," +
  "\"hours\":<float 0.25-12>," +
  "\"xp\":<int 5-100>," +
  "\"priority\":\"urgent|high|medium|low\"," +
  "\"projectHint\":\"<group/column/board name if obvious, else empty>\"," +
  "\"completed\":<true|false based on visible state>}\n\n" +
  "GUIDELINES:\n" +
  "- Title style: rephrase to sentence case action ('Build login screen'), " +
  "even if the source uses other casing.\n" +
  "- If the source shows estimated hours / story points / labels, infer " +
  "difficulty + hours + XP accordingly. Otherwise pick conservative medium " +
  "defaults (1.5h, 20XP, medium).\n" +
  "- Completed = true ONLY if visually marked done (struck through, in a " +
  "Done column, checkbox ticked, etc.). When uncertain, false.\n" +
  "- projectHint: if the screenshot shows a board/project name or column " +
  "header that all visible tasks belong under, put it here so the user can " +
  "group them. Otherwise empty string.\n" +
  "- Don't invent tasks the screenshot doesn't show.\n" +
  "- Order tasks roughly top-to-bottom, left-to-right as they appear.\n\n" +
  "If the image doesn't contain anything task-like, return `[]`.\n" +
  "No markdown, no commentary.";

async function aiImportFromScreenshot(imageBase64, mediaType) {
  try {
    const r = await fetch("/api/anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: AI_IMPORT_VISION_RULES, cache_control: { type: "ephemeral" } },
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            { type: "text", text: "Extract the tasks visible in this screenshot." },
          ],
        }],
      }),
    });
    if (!r.ok) {
      let errBody = "";
      try { errBody = await r.text(); } catch {}
      console.error(`aiImportFromScreenshot HTTP ${r.status}:`, errBody.slice(0, 800));
      return null;
    }
    const d = await r.json();
    const rawText = d?.content?.[0]?.text || "";
    const parsed = extractJsonArray(rawText);
    if (!Array.isArray(parsed)) {
      console.warn("aiImportFromScreenshot: couldn't extract JSON array", rawText.slice(0, 500));
      return null;
    }
    // Sanitize each task.
    return parsed
      .map(t => {
        if (!t || !t.title) return null;
        const difficulty = ["easy", "medium", "hard", "epic"].includes(t.difficulty) ? t.difficulty : "medium";
        const priority = ["urgent", "high", "medium", "low"].includes(t.priority) ? t.priority : "medium";
        const hours = typeof t.hours === "number" && t.hours > 0
          ? Math.min(12, Math.max(0.25, Math.round(t.hours * 4) / 4))
          : DIFFICULTY[difficulty]?.hours || 1.5;
        const xp = typeof t.xp === "number" && t.xp > 0
          ? Math.min(100, Math.max(5, Math.round(t.xp)))
          : 20;
        return {
          title: String(t.title).trim().slice(0, 120),
          description: typeof t.description === "string" ? t.description.trim().slice(0, 240) : "",
          hours, xp, difficulty, priority,
          completed: t.completed === true,
          projectHint: typeof t.projectHint === "string" ? t.projectHint.trim().slice(0, 80) : "",
        };
      })
      .filter(Boolean);
  } catch (e) {
    console.error("aiImportFromScreenshot failed:", e);
    return null;
  }
}

async function aiFromDescription(description, mode) {
  const dynamic = `MODE: ${mode.toUpperCase()}\nInput: ${description.trim()}`;
  try {
    const r = await fetch("/api/anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: AI_CAPTURE_RULES, cache_control: { type: "ephemeral" } },
            { type: "text", text: dynamic },
          ],
        }],
      }),
    });
    const d = await r.json();
    return JSON.parse(d.content[0].text.replace(/```\w*|```/g, "").trim());
  } catch {
    const title = description.trim().slice(0, 60);
    if (mode === "project")  return { title, description: "", tasks: [] };
    if (mode === "subtasks") return { title, description: "", subtasks: [] };
    return { title, description: "" };
  }
}

// Surgical replan — outputs operations, applies them to the existing plan,
// leaves un-mentioned tasks alone. Replaces the old replan flow that asked
// the AI to rewrite the entire schedule (causing unrelated tasks to shift).
async function aiReplanOps(tasks, caps, opts = {}) {
  const existingPlan = Array.isArray(opts.existingPlan) ? opts.existingPlan : [];
  const instruction = (opts.instruction || "").trim();
  if (!instruction) return null;

  const lockedDates = opts.lockedDates instanceof Set
    ? opts.lockedDates
    : new Set(Array.isArray(opts.lockedDates) ? opts.lockedDates : []);

  const projectsById = opts.projectsById instanceof Map
    ? opts.projectsById
    : new Map(Array.isArray(opts.projects) ? opts.projects.map(p => [p.id, p]) : []);
  const projectTitleOf = (t) => {
    if (!t?.projectId) return null;
    const p = projectsById.get(t.projectId);
    return p?.title || null;
  };

  const allPending = tasks.filter(t => !t.completed);
  const tasksById = new Map(tasks.map(t => [t.id, t]));
  const titleToId = new Map();
  const normTitleToId = new Map();
  for (const t of allPending) {
    if (!titleToId.has(t.title)) titleToId.set(t.title, t.id);
    const key = normalizeTitleKey(t.title);
    if (key && !normTitleToId.has(key)) normTitleToId.set(key, t.id);
  }
  const resolveTitle = (title) =>
    titleToId.get(title) || normTitleToId.get(normalizeTitleKey(title)) || null;

  const dailyHours = allPending
    .filter(t => t.recurring === "daily")
    .reduce((s, t) => s + taskHours(t), 0);

  // Current plan listing — flat, one line per chunk, with DONE / locked
  // markers so the AI knows what's immutable. Project tags in [brackets]
  // let the user say "the IGP tasks" and have it resolve.
  const planLines = existingPlan
    .filter(e => (e.items || []).length)
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap(e => {
      const isLocked = lockedDates.has(e.date);
      return (e.items || []).map(it => {
        const t = tasksById.get(it.taskId);
        if (!t) return null;
        const proj = projectTitleOf(t);
        const projPart = proj ? ` [${proj}]` : "";
        const deadlinePart = t.deadlineAt ? ` (due ${isoDate(new Date(t.deadlineAt))})` : "";
        const lockedPart = isLocked ? " LOCKED-DAY" : "";
        const donePart = it.done ? " DONE" : "";
        const hoursPart = it.hours != null
          ? ` (${it.hours}h${it.note ? `: ${it.note}` : ""})`
          : "";
        return `- ${e.date}: "${t.title}"${projPart}${deadlinePart}${donePart}${hoursPart}${lockedPart}`;
      }).filter(Boolean);
    }).join("\n");

  // Pending tasks not currently scheduled — eligible for `schedule` ops.
  const scheduledIds = new Set(existingPlan.flatMap(e => (e.items || []).map(i => i.taskId)));
  const unscheduledLines = allPending
    .filter(t => !scheduledIds.has(t.id) && t.recurring !== "daily")
    .map(t => {
      const proj = projectTitleOf(t);
      const projPart = proj ? ` [${proj}]` : "";
      const deadlinePart = t.deadlineAt ? ` (due ${isoDate(new Date(t.deadlineAt))})` : "";
      return `- "${t.title}"${projPart}${deadlinePart} ~${taskHours(t)}h, ${t.priority || "medium"}`;
    }).join("\n");

  // 90 workdays of available dates so the AI has room for "spread over 3
  // months" or "schedule next month" instructions.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dayLines = [];
  for (let i = 0; dayLines.length < 90 && i < 240; i++) {
    const d = addDays(today, i);
    const iso = isoDate(d);
    const wd = weekdayName(d);
    const cap = caps[wd] || 0;
    if (cap === 0 || lockedDates.has(iso)) continue;
    // Show capacity remaining after existing scheduled work + daily overhead.
    const existingHrs = (existingPlan.find(e => e.date === iso)?.items || [])
      .reduce((s, it) => {
        const t = tasksById.get(it.taskId);
        if (!t || t.recurring === "daily") return s;
        return s + (it.hours != null ? it.hours : taskHours(t));
      }, 0);
    const remaining = Math.max(0, cap - existingHrs - dailyHours);
    dayLines.push(`- ${iso} ${wd}: ${cap}h cap, ${remaining.toFixed(1)}h free`);
  }

  const dynamic =
    `Today: ${isoDate(today)} (${weekdayName(today)}).\n\n` +
    `User request: ${JSON.stringify(instruction)}\n\n` +
    (planLines ? `Current plan:\n${planLines}\n\n` : "Current plan: (empty)\n\n") +
    (unscheduledLines ? `Unscheduled pending tasks:\n${unscheduledLines}\n\n` : "") +
    `Workdays available (next 90 working days):\n${dayLines.join("\n")}\n`;

  try {
    const r = await fetch("/api/anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: AI_REPLAN_RULES, cache_control: { type: "ephemeral" } },
            { type: "text", text: dynamic },
          ],
        }],
      }),
    });
    if (!r.ok) {
      let errBody = "";
      try { errBody = await r.text(); } catch {}
      console.error(`aiReplanOps HTTP ${r.status}:`, errBody.slice(0, 800));
      return null;
    }
    const d = await r.json();
    const rawText = d?.content?.[0]?.text || "";
    console.group("[aiReplanOps]");
    console.log("instruction:", instruction);
    console.log("raw AI response:\n" + rawText);

    const ops = extractJsonArray(rawText);
    if (!ops) {
      console.warn("aiReplanOps: couldn't extract JSON array");
      console.groupEnd();
      return null;
    }
    console.log("parsed ops:", JSON.parse(JSON.stringify(ops)));

    if (ops.length === 0) {
      console.warn("aiReplanOps: AI returned empty ops — request may have been uninterpretable");
      console.groupEnd();
      return null;
    }

    const result = applyReplanOps(existingPlan, ops, resolveTitle, lockedDates);
    console.log("applied:", result.applied.length, "skipped:", result.skipped.length);
    if (result.skipped.length) console.warn("skipped ops:", result.skipped);
    console.groupEnd();

    return result.next;
  } catch (e) {
    console.error("aiReplanOps failed:", e);
    return null;
  }
}

async function aiPlanWeek(tasks, caps, opts = {}) {
  const mode = opts.mode || "fresh";              // "fresh" | "append" | "optimize" | "replan"
  // Replan is a surgical-edit flow; route through the operations-based path.
  if (mode === "replan") return aiReplanOps(tasks, caps, opts);
  const existingPlan = Array.isArray(opts.existingPlan) ? opts.existingPlan : [];
  const lockedDates = opts.lockedDates instanceof Set
    ? opts.lockedDates
    : new Set(Array.isArray(opts.lockedDates) ? opts.lockedDates : []);
  // Project lookup so the AI sees the project a task belongs to. This lets
  // replan instructions like "push the Acme stuff to next week" actually
  // resolve to specific tasks.
  const projectsById = opts.projectsById instanceof Map
    ? opts.projectsById
    : new Map(Array.isArray(opts.projects) ? opts.projects.map(p => [p.id, p]) : []);
  const projectTitleOf = (t) => {
    if (!t?.projectId) return null;
    const p = projectsById.get(t.projectId);
    return p?.title || null;
  };

  // Items on locked days are immovable. We pull them out of the AI's view
  // entirely (locked dates are never listed as availability slots) and merge
  // them back into the final plan after the model responds. Tasks already on
  // locked days are excluded from tasksToPlan so the AI doesn't try to
  // schedule them somewhere else.
  //
  // Done chunks (it.done === true) get the same treatment — they represent
  // work the user already paid XP for, so replan/optimize should leave them
  // exactly where they are. If a task has at least one done chunk, the whole
  // task freezes (rescheduling the undone chunks elsewhere would orphan the
  // done ones and look weird).
  const frozenByDate = new Map();
  const frozenTaskIds = new Set();
  const addToFrozen = (date, item) => {
    if (!frozenByDate.has(date)) frozenByDate.set(date, []);
    frozenByDate.get(date).push({ ...item });
  };
  // First pass: identify tasks the replanner must not touch.
  //   1) Any task with a done chunk anywhere — user paid XP for at least one
  //      slice, so the whole task freezes (so the undone siblings don't get
  //      relocated and orphan the done one).
  //   2) Any fully-completed task — the user explicitly wants finished work
  //      preserved on the planner in place, not removed.
  const completedTaskIds = new Set(tasks.filter(t => t.completed).map(t => t.id));
  for (const e of existingPlan) {
    for (const it of (e.items || [])) {
      if (it.done) frozenTaskIds.add(it.taskId);
      if (completedTaskIds.has(it.taskId)) frozenTaskIds.add(it.taskId);
    }
  }
  for (const e of existingPlan) {
    const items = e.items || [];
    if (!items.length) continue;
    if (lockedDates.has(e.date)) {
      for (const it of items) addToFrozen(e.date, it);
      for (const it of items) frozenTaskIds.add(it.taskId);
      continue;
    }
    // Freeze any chunk that belongs to a "frozen task" so the whole task
    // stays intact across days.
    for (const it of items) {
      if (frozenTaskIds.has(it.taskId)) addToFrozen(e.date, it);
    }
  }

  const allPending = tasks.filter(t => !t.completed);
  if (!allPending.length) return null;
  const dailyTasks = allPending.filter(t => t.recurring === "daily");
  const nonDailyPending = allPending.filter(t => t.recurring !== "daily");
  const dailyHours = dailyTasks.reduce((s, t) => s + (taskHours(t)), 0);
  if (!nonDailyPending.length) return existingPlan.length ? existingPlan : [];

  // Horizon: how many workdays the AI sees as available. Two failure modes
  // we're balancing:
  //   1. Too short — the AI runs out of room and crams overflow into the
  //      last visible day. Old behavior at horizon=14.
  //   2. Too long — the prompt balloons and the model has more decisions
  //      to make than necessary.
  //
  // We pick the max of three signals:
  //   - workload: ceil(totalHours / effectiveDailyCap) + 14 workdays slack
  //   - mode floor: 60 (fresh/append/optimize) or 90 (replan, since the
  //     user's instruction might explicitly call for a longer timeline
  //     like "spread this over 3 months")
  //   - opts.horizon override (rarely used in-app)
  // Capped at 120 workdays (~6 months) to keep prompt size bounded.
  const workingCaps = WEEK_ALL.map(w => caps[w] || 0).filter(c => c > 0);
  const avgCap = workingCaps.length
    ? workingCaps.reduce((s, c) => s + c, 0) / workingCaps.length
    : 4;
  const effectiveDailyCap = Math.max(0.5, avgCap - dailyHours);
  const totalNeededHours = nonDailyPending.reduce((s, t) => s + taskHours(t), 0);
  const workloadDays = Math.ceil(totalNeededHours / effectiveDailyCap);
  const modeFloor = mode === "replan" ? 90 : 60;
  const horizonDays = opts.horizon != null
    ? opts.horizon
    : Math.min(120, Math.max(modeFloor, workloadDays + 14));

  // Loop limit needs slack for sparse caps (e.g., only Monday is a workday).
  const calendarLimit = horizonDays * 3 + 14;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dates = [];
  for (let i = 0; dates.length < horizonDays && i < calendarLimit; i++) {
    const d = addDays(today, i);
    const wd = weekdayName(d);
    const iso = isoDate(d);
    if ((caps[wd] || 0) > 0 && !lockedDates.has(iso)) dates.push(d);
  }
  if (!dates.length) return existingPlan;

  // Storage shape: {date, items:[{taskId,hours?,note?}]}. Prompt + AI use
  // titles (more readable for Claude); we translate at the boundary using
  // a normalized-key map so casing/punctuation differences in the model
  // output don't lose items.
  const tasksById = new Map(tasks.map(t => [t.id, t]));
  const titleToId = new Map();
  const normTitleToId = new Map();
  for (const t of allPending) {
    if (!titleToId.has(t.title)) titleToId.set(t.title, t.id);
    const key = normalizeTitleKey(t.title);
    if (key && !normTitleToId.has(key)) normTitleToId.set(key, t.id);
  }
  const resolveTitle = (title) =>
    titleToId.get(title) || normTitleToId.get(normalizeTitleKey(title)) || null;

  // Per-date scheduled hours from existingPlan (only used for append).
  const scheduledIds = new Set(existingPlan.flatMap(e => (e.items || []).map(i => i.taskId)));
  const dateToScheduledHours = {};
  for (const e of existingPlan) {
    const hrs = (e.items || []).reduce((s, it) => {
      const t = tasksById.get(it.taskId);
      if (!t || t.recurring === "daily") return s;
      // If the item has explicit hours (split chunk), use them; otherwise
      // use the task's estimated hours.
      return s + (it.hours != null ? it.hours : (taskHours(t)));
    }, 0);
    dateToScheduledHours[e.date] = hrs;
  }

  // Tasks the model needs to place. Tasks already on locked days are
  // frozen and excluded so the model doesn't try to relocate them.
  const baseToPlan = (mode === "optimize" || mode === "replan")
    ? nonDailyPending
    : nonDailyPending.filter(t => !scheduledIds.has(t.id));
  const tasksToPlan = baseToPlan.filter(t => !frozenTaskIds.has(t.id));
  if (!tasksToPlan.length) return existingPlan;

  const sorted = tasksToPlan.slice().sort((a, b) =>
    PRIORITIES[a.priority || "medium"].order - PRIORITIES[b.priority || "medium"].order);

  // For optimize + replan we plan from scratch, so the visible "remaining"
  // capacity is full minus daily overhead — NOT minus the existing plan's
  // hours. (Previously replan inherited the append calc here, so the AI
  // saw "0h remaining" on days that were already populated in the existing
  // plan and pushed everything to later weeks, leaving gaps.)
  const ignoreExistingForCapacity = mode === "optimize" || mode === "replan";
  const dayLines = dates.map(d => {
    const iso = isoDate(d);
    const wd = weekdayName(d);
    const cap = (caps[wd] || 4);
    const used = (ignoreExistingForCapacity ? 0 : (dateToScheduledHours[iso] || 0)) + dailyHours;
    const remaining = Math.max(0, cap - used);
    return `- ${iso} ${wd}: cap ${cap}h, remaining ${remaining.toFixed(1)}h`;
  }).join("\n");

  const taskLines = sorted.map(t => {
    const proj = projectTitleOf(t);
    const projPart = proj ? `, project: "${proj}"` : "";
    const deadlinePart = t.deadlineAt
      ? `, deadline: ${isoDate(new Date(t.deadlineAt))}`
      : "";
    return `- "${t.title}" — ${t.xp}XP, ${t.difficulty}, ~${taskHours(t)}h, ${t.priority || "medium"}${projPart}${deadlinePart}`;
  }).join("\n");

  let existingBlock = "";
  if (mode !== "optimize" && existingPlan.length) {
    const lines = existingPlan
      .filter(e => (e.items || []).length)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(e => {
        const parts = (e.items || []).map(it => {
          const t = tasksById.get(it.taskId);
          if (!t) return null;
          const proj = projectTitleOf(t);
          const projPart = proj ? ` [${proj}]` : "";
          if (it.hours != null && it.note) return `"${t.title}"${projPart} (${it.hours}h: ${it.note})`;
          return `"${t.title}"${projPart}`;
        }).filter(Boolean);
        return parts.length ? `- ${e.date}: ${parts.join(", ")}` : "";
      })
      .filter(Boolean)
      .join("\n");
    if (lines) {
      const label = mode === "replan"
        ? "Current plan (context only — you may rearrange entirely; the density and priority rules above still apply)"
        : "Already scheduled (do not move)";
      existingBlock = `\n${label}:\n${lines}\n`;
    }
  }

  const hasInstruction = !!(opts.instruction && opts.instruction.trim());
  const modeLine = mode === "optimize"
    ? "Mode: OPTIMIZE — replan all listed tasks from scratch."
    : mode === "append"
    ? `Mode: APPEND — only place the listed unscheduled tasks; respect already-scheduled days' remaining capacity.${hasInstruction ? " Honor the user request below as a top-priority constraint — it may specify a timeline (\"spread over 2 weeks\", \"alternate with deep work\") that overrides the default earliest-first packing." : ""}`
    : mode === "replan"
    ? "Mode: REPLAN — replan all listed tasks from scratch, honoring the additional user request below as a top-priority constraint. The request may explicitly specify a timeline (\"spread over 3 months\", \"start next week\", \"finish by Oct 31\") — when it does, distribute tasks across that range per rule 3's EXCEPTION, picking dates from the workdays-available list. Without a timeline hint, default to packing earliest days first."
    : "Mode: FRESH — no prior plan exists; place all listed tasks.";

  const instructionBlock = (mode === "replan" || mode === "append" || mode === "optimize" || mode === "fresh") && hasInstruction
    ? `\nUser request: ${JSON.stringify(opts.instruction.trim())}\n`
    : "";

  const totalH = tasksToPlan.reduce((s, t) => s + (taskHours(t)), 0);

  const dynamic =
    `Today: ${isoDate(today)} (${weekdayName(today)}).\n` +
    `${modeLine}\n` +
    `Daily recurring overhead: ${dailyHours.toFixed(1)}h/day (already subtracted from remaining).\n\n` +
    `Workdays available:\n${dayLines}\n${existingBlock}${instructionBlock}\n` +
    `Tasks to place (total ~${totalH.toFixed(1)}h, ${tasksToPlan.length} tasks):\n${taskLines}`;

  try {
    const r = await fetch("/api/anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 6000,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: AI_PLAN_RULES, cache_control: { type: "ephemeral" } },
            { type: "text", text: dynamic },
          ],
        }],
      }),
    });
    if (!r.ok) {
      let errBody = "";
      try { errBody = await r.text(); } catch {}
      console.error(`aiPlanWeek HTTP ${r.status}:`, errBody.slice(0, 800));
      return mode === "replan" ? null : (existingPlan.length ? existingPlan : null);
    }
    const d = await r.json();
    const rawText = d?.content?.[0]?.text || "";
    if (mode === "replan") {
      console.group(`[aiPlanWeek/${mode}]`);
      console.log("instruction:", opts.instruction);
      console.log("raw AI response:\n" + rawText);
    }
    const parsed = extractJsonArray(rawText);
    if (!parsed) {
      console.warn("aiPlanWeek: couldn't extract JSON array from response", rawText.slice(0, 800));
      if (mode === "replan") console.groupEnd();
      return mode === "replan" ? null : (existingPlan.length ? existingPlan : null);
    }
    if (mode === "replan") console.log("parsed entries:", JSON.parse(JSON.stringify(parsed)));
    // Accept both shapes — the model occasionally returns the older
    // {tasks:[...]} format. Normalize to items[].
    const droppedTitles = [];
    const droppedDates = [];
    const isoRe = /^\d{4}-\d{2}-\d{2}$/;
    const normalizeEntry = (e) => {
      if (!e) return null;
      if (!e.date || typeof e.date !== "string" || !isoRe.test(e.date)) {
        droppedDates.push(e?.date);
        return null;
      }
      const rawItems = Array.isArray(e.items)
        ? e.items
        : Array.isArray(e.tasks)
          ? e.tasks.map(x => typeof x === "string" ? { title: x } : x)
          : [];
      const items = rawItems
        .map(it => {
          const title = it && it.title;
          if (!title) { droppedTitles.push("(empty title)"); return null; }
          const id = resolveTitle(title);
          if (!id) { droppedTitles.push(title); return null; }
          const out = { taskId: id, done: false };
          if (typeof it.hours === "number" && it.hours > 0) out.hours = Math.round(it.hours * 10) / 10;
          if (typeof it.note === "string" && it.note.trim()) out.note = it.note.trim().slice(0, 80);
          return out;
        })
        .filter(Boolean);
      return items.length ? { date: e.date, items } : null;
    };
    const newEntries = parsed.map(normalizeEntry).filter(Boolean);
    if (mode === "replan") {
      console.log("normalized entries:", JSON.parse(JSON.stringify(newEntries)));
      if (droppedTitles.length) console.warn("dropped (title didn't resolve):", droppedTitles);
      if (droppedDates.length) console.warn("dropped (bad date format):", droppedDates);
      console.groupEnd();
    }

    // Merge any frozen (locked-day) entries back into the result for modes
    // that planned from scratch. The AI never saw those dates so it can't
    // have produced overlapping items.
    const mergeFrozen = (entries) => {
      const byDate = new Map();
      for (const e of entries) byDate.set(e.date, [...e.items]);
      for (const [date, items] of frozenByDate.entries()) {
        if (byDate.has(date)) {
          const list = byDate.get(date);
          const have = new Set(list.map(i => i.taskId));
          for (const it of items) if (!have.has(it.taskId)) list.push(it);
        } else {
          byDate.set(date, [...items]);
        }
      }
      return Array.from(byDate.entries())
        .map(([date, items]) => ({ date, items }))
        .filter(e => e.items.length)
        .sort((a, b) => a.date.localeCompare(b.date));
    };

    if (mode === "replan") {
      // Defensive: if the model wiped or significantly dropped items, keep
      // the existing plan instead of clobbering with nothing. Frozen tasks
      // were already pulled out of the count on both sides.
      const newUniqueIds = new Set(newEntries.flatMap(e => e.items.map(i => i.taskId)));
      const existingIds = new Set(
        existingPlan.flatMap(e => (e.items || []).map(i => i.taskId))
                    .filter(id => !frozenTaskIds.has(id))
      );
      if (existingIds.size > 0 && (newUniqueIds.size === 0 || newUniqueIds.size < existingIds.size * 0.5)) {
        console.warn("aiPlanWeek replan: refusing to apply — result drops too many tasks", {
          existingIds: existingIds.size, newUniqueIds: newUniqueIds.size,
          droppedTitles, droppedDates, rawText: rawText.slice(0, 500),
        });
        return null; // signal "no change applied"
      }
      // Preserve per-chunk `done` values from the previous plan where the
      // model retained the assignment unchanged.
      const prevDone = new Map();
      for (const e of existingPlan) {
        for (const it of (e.items || [])) {
          if (it.done) prevDone.set(`${e.date}:${it.taskId}`, true);
        }
      }
      const stamped = newEntries.map(e => ({
        ...e,
        items: e.items.map(it => prevDone.get(`${e.date}:${it.taskId}`) ? { ...it, done: true } : it),
      }));
      return mergeFrozen(stamped);
    }
    if (mode === "optimize") return mergeFrozen(newEntries);
    if (mode === "fresh") return mergeFrozen(newEntries);

    // Append: merge new entries into existing, preserving order by date.
    // We dedupe items by taskId-per-day; a new chunk replaces an existing
    // one if the day already had the same task (rare in append flow).
    const byDate = new Map();
    for (const e of existingPlan) byDate.set(e.date, [...(e.items || [])]);
    for (const e of newEntries) {
      const list = byDate.get(e.date) || [];
      for (const it of e.items) {
        if (!list.some(x => x.taskId === it.taskId)) list.push(it);
      }
      byDate.set(e.date, list);
    }
    return Array.from(byDate.entries())
      .map(([date, items]) => ({ date, items }))
      .filter(e => e.items.length)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (e) {
    console.error("aiPlanWeek failed:", e);
    return mode === "replan" ? null : (existingPlan.length ? existingPlan : null);
  }
}

/* ───── HELPERS ───── */

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function todayKey() { return new Date().toISOString().slice(0,10); }
function todayName() { return new Date().toLocaleDateString("en-US", { weekday: "long" }); }

function getLevelInfo(xp) {
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
    pct: isNaN(pct) ? 100 : pct,
    xpToNext: Math.max(0, next - xp),
  };
}

function processRecurring(tasks, dayStartHour = 0) {
  const todayIso = effectiveTodayIso(dayStartHour);
  const now = Date.now();
  return tasks.map(t => {
    let next = t;
    // Daily: `completed` mirrors whether today's iso date is in the
    // dailyCompletions history. This makes the "is it done today?" flag
    // derived state — no risk of losing history during the rollover.
    if (t.recurring === "daily") {
      const history = Array.isArray(t.dailyCompletions) ? t.dailyCompletions : [];
      const completedToday = history.includes(todayIso);
      if (t.completed !== completedToday) {
        next = { ...next, completed: completedToday };
      }
    }
    if (t.recurring === "weekly" && t.completed && t.completedAt
        && (now - t.completedAt) >= 7 * 86400000) {
      next = { ...next, completed: false, completedAt: null };
    }
    // Stale focus time is "today's focus" semantics — wipe yesterday's value
    // so a new day starts at 0:00. effectiveFocusMs already returns 0 for
    // stale data, but clearing the stored field makes downstream code safer
    // (e.g., the focus tunnel re-mount, future migrations).
    if (next.focusDate && next.focusDate !== todayIso) {
      next = { ...next, focusMs: 0, focusDate: null };
    }
    return next;
  });
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Day-rollover hour. With hour=0 (midnight), the "day" turns over at 00:00.
// With hour=4, the user's day rolls at 4am, so 1am still counts as the
// previous day. All "today"-derived comparisons (completion grouping, daily
// recurrence reset, focus-time reset, screen-log key, day-closed marker)
// should respect this.
function effectiveToday(hour = 0, d = new Date()) {
  if (!hour) return d;
  const out = new Date(d);
  if (out.getHours() < hour) out.setDate(out.getDate() - 1);
  out.setHours(0, 0, 0, 0);
  return out;
}
function effectiveTodayIso(hour = 0) { return isoDate(effectiveToday(hour)); }
function effectiveTodayDateStr(hour = 0) { return effectiveToday(hour).toDateString(); }
function effectiveDateStrOf(ms, hour = 0) { return effectiveToday(hour, new Date(ms)).toDateString(); }
function effectiveIsoOf(ms, hour = 0) { return isoDate(effectiveToday(hour, new Date(ms))); }

function taskHours(t) {
  if (t && typeof t.hours === "number" && t.hours > 0) return t.hours;
  return DIFFICULTY[t?.difficulty]?.hours || 1.5;
}

// Focus time on `task.focusMs` is treated as "time focused today" everywhere
// it's surfaced, so any value whose focusDate isn't the current day reads
// as stale and returns 0. This covers daily-recurring tasks (next day's
// instance starts fresh) and split tasks (each day's chunk is its own
// session) without needing per-chunk storage. Single-instance tasks lose
// their cross-day cumulative count, which matches the "today" framing the
// badge already implies.
// Build a map of effective-date string → Set<taskId> of tasks that had work
// completed that day. "Work completed" counts both:
//   - A full task completion (task.completedAt on that day)
//   - A partial chunk completion (item.doneAt on that day)
// Dedup'd by task ID so a single task with three chunks done on the same day
// counts as one, not three. Use this for daily activity stats.
function buildActivityByDay(tasks, weekPlan, dayStartHour = 0) {
  const map = new Map();
  const add = (dayStr, taskId) => {
    let set = map.get(dayStr);
    if (!set) { set = new Set(); map.set(dayStr, set); }
    set.add(taskId);
  };
  for (const t of tasks) {
    if (t.recurring === "daily") {
      // Iterate every iso date in the history — each day gets credit for
      // this task once. This is what makes yesterday's daily-task tick
      // survive the next-day rollover.
      for (const iso of (t.dailyCompletions || [])) {
        const d = parseIsoDate(iso);
        if (d) add(d.toDateString(), t.id);
      }
    } else if (t.completed && t.completedAt) {
      add(effectiveDateStrOf(t.completedAt, dayStartHour), t.id);
    }
  }
  for (const e of (weekPlan || [])) {
    for (const it of (e.items || [])) {
      if (it.done && it.doneAt) {
        add(effectiveDateStrOf(it.doneAt, dayStartHour), it.taskId);
      }
    }
  }
  return map;
}

// Missed work: any undone chunk scheduled for a past date. Returns a flat
// list of {date, taskId, item, task} sorted by date (oldest first). Daily-
// recurring tasks are skipped since they reset on their own. Tasks the user
// fully completed are skipped (the chunk was done elsewhere via direct
// completeTask). Today's chunks aren't "missed" — only strictly past ones.
function getMissedWork(tasks, weekPlan, dayStartHour = 0) {
  if (!Array.isArray(weekPlan)) return [];
  const todayIso = effectiveTodayIso(dayStartHour);
  const byId = new Map(tasks.map(t => [t.id, t]));
  const missed = [];
  for (const e of weekPlan) {
    if (!e.date || e.date >= todayIso) continue;
    for (const it of (e.items || [])) {
      if (it.done) continue;
      const task = byId.get(it.taskId);
      if (!task || task.completed || task.recurring === "daily") continue;
      missed.push({ date: e.date, taskId: it.taskId, item: it, task });
    }
  }
  return missed.sort((a, b) => a.date.localeCompare(b.date));
}

// Look up the first scheduled date for a task in the weekPlan. Returns the
// earliest ISO date of any chunk belonging to the task, or "" if unscheduled.
// Used to pre-populate the schedule picker when editing.
// Return all plan chunks for a task, sorted by date. Each entry is
// {date, item, index} where index is the chunk's position (1-based) across
// all chunks. Useful for rendering split-task context in non-planner views.
function getTaskChunks(taskId, weekPlan) {
  if (!Array.isArray(weekPlan)) return [];
  const chunks = [];
  for (const e of weekPlan) {
    for (const it of (e.items || [])) {
      if (it.taskId === taskId) chunks.push({ date: e.date, item: it });
    }
  }
  chunks.sort((a, b) => a.date.localeCompare(b.date));
  chunks.forEach((c, i) => { c.index = i + 1; });
  return chunks;
}

// Was this daily task completed on a specific date? Reads from the
// task.dailyCompletions history (ISO date strings). Defensive — returns
// false for non-daily tasks, missing history, malformed inputs.
function isDailyCompletedOn(task, dateIso) {
  if (!task || task.recurring !== "daily" || !dateIso) return false;
  return Array.isArray(task.dailyCompletions) && task.dailyCompletions.includes(dateIso);
}

function getTaskScheduledDate(taskId, weekPlan) {
  if (!Array.isArray(weekPlan)) return "";
  let earliest = "";
  for (const e of weekPlan) {
    if ((e.items || []).some(i => i.taskId === taskId)) {
      if (!earliest || e.date < earliest) earliest = e.date;
    }
  }
  return earliest;
}

function effectiveFocusMs(t, dayStartHour = 0) {
  if (!t || !t.focusMs) return 0;
  // No focusDate means we don't know when this was logged — treat as stale
  // so it doesn't bleed across days. Same for any mismatch with today.
  if (!t.focusDate) return 0;
  if (t.focusDate !== effectiveTodayIso(dayStartHour)) return 0;
  return t.focusMs;
}

function fmtFocusMs(ms) {
  if (!ms || ms < 1000) return "0m";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseIsoDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  r.setHours(0, 0, 0, 0);
  return r;
}
function mondayOf(d) {
  const dow = d.getDay();
  const m = new Date(d);
  m.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  m.setHours(0, 0, 0, 0);
  return m;
}
function isWeekday(d) { const x = d.getDay(); return x >= 1 && x <= 5; }
function weekdayName(d) { return d.toLocaleDateString("en-US", { weekday: "long" }); }
function fmtWeekLabel(monday) {
  const sun = addDays(monday, 6);
  const sameMonth = monday.getMonth() === sun.getMonth();
  const m1 = monday.toLocaleDateString("en-US", { month: "short" });
  const m2 = sun.toLocaleDateString("en-US",   { month: "short" });
  return sameMonth
    ? `${m1} ${monday.getDate()} – ${sun.getDate()}, ${monday.getFullYear()}`
    : `${m1} ${monday.getDate()} – ${m2} ${sun.getDate()}, ${monday.getFullYear()}`;
}

function generateDemoData() {
  const now = Date.now();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toDateString();
  const rng = () => Math.random();
  const choice = (arr) => arr[Math.floor(rng() * arr.length)];

  const projects = [
    { id: "demo-p-1", title: "Landing redesign",  type: "client",    desc: "", notes: "", tags: [], createdAt: now - 12 * 86400000, completedAt: null, shippedAt: null, childTaskIds: [] },
    { id: "demo-p-2", title: "Quest mobile",       type: "side",      desc: "", notes: "", tags: [], createdAt: now -  8 * 86400000, completedAt: null, shippedAt: null, childTaskIds: [] },
    { id: "demo-p-3", title: "Component library",  type: "component", desc: "", notes: "", tags: [], createdAt: now -  5 * 86400000, completedAt: null, shippedAt: null, childTaskIds: [] },
    { id: "demo-p-4", title: "Hero illustration",  type: "template",  desc: "", notes: "", tags: [], createdAt: now - 20 * 86400000, completedAt: now - 3 * 86400000, shippedAt: now - 3 * 86400000, childTaskIds: [] },
  ];

  const xpFor = (diff) => diff === "easy" ? 12 + Math.floor(rng() * 8) : diff === "medium" ? 30 + Math.floor(rng() * 18) : diff === "hard" ? 55 + Math.floor(rng() * 22) : 82 + Math.floor(rng() * 18);

  const tasks = [];

  // Active project tasks
  const active = [
    { title: "Audit current hero section",       diff: "medium", prio: "high",   pid: "demo-p-1" },
    { title: "Redesign primary navigation",      diff: "hard",   prio: "urgent", pid: "demo-p-1" },
    { title: "Build animated counters component",diff: "medium", prio: "medium", pid: "demo-p-3" },
    { title: "Define color tokens v2",           diff: "easy",   prio: "medium", pid: "demo-p-3" },
    { title: "Spec offline-first sync model",    diff: "hard",   prio: "high",   pid: "demo-p-2" },
    { title: "Tighten copy on pricing page",     diff: "easy",   prio: "low",    pid: "demo-p-1" },
    { title: "Run accessibility scan",           diff: "medium", prio: "medium", pid: "demo-p-1" },
    { title: "Wire up dark mode toggle",         diff: "medium", prio: "medium", pid: "demo-p-2" },
    { title: "Write Storybook stories for chips",diff: "easy",   prio: "low",    pid: "demo-p-3" },
    { title: "Plan next sprint",                 diff: "easy",   prio: "high",   pid: null         },
    { title: "Reply to procurement email",       diff: "easy",   prio: "urgent", pid: null         },
  ];
  active.forEach((t, i) => {
    tasks.push({
      id: "demo-ta-" + i,
      title: t.title, desc: "", notes: "", tags: [], subtasks: [],
      xp: xpFor(t.diff), difficulty: t.diff, reason: "demo",
      recurring: "none", priority: t.prio,
      projectId: t.pid, completed: false,
      createdAt: now - (2 + Math.floor(rng() * 10)) * 86400000,
    });
  });

  // Daily recurring (one done today, two pending)
  const daily = [
    { title: "Morning standup",           done: true  },
    { title: "Inbox triage",              done: true  },
    { title: "Day journal entry",         done: false },
  ];
  daily.forEach((t, i) => {
    const at = new Date(today); at.setHours(8 + i * 2, 0, 0, 0);
    tasks.push({
      id: "demo-tr-" + i,
      title: t.title, desc: "", notes: "", tags: [], subtasks: [],
      xp: 10, difficulty: "easy", reason: "demo",
      recurring: "daily", priority: "medium", projectId: null,
      completed: t.done, completedAt: t.done ? at.getTime() : null,
      createdAt: now - 30 * 86400000,
    });
  });

  // Completed today (a few visible wins)
  const todaysWins = [
    { title: "Reply to Sara about Q3 ask",     diff: "easy",   pid: null         },
    { title: "Fix mobile nav drawer overlap",  diff: "medium", pid: "demo-p-2"   },
    { title: "Tidy up Figma library",          diff: "easy",   pid: "demo-p-3"   },
    { title: "Push staging build",             diff: "medium", pid: "demo-p-1"   },
    { title: "Sketch onboarding flow",         diff: "hard",   pid: "demo-p-2"   },
  ];
  todaysWins.forEach((t, i) => {
    const at = new Date(today); at.setHours(9 + i, 10 + i * 7, 0, 0);
    tasks.push({
      id: "demo-tw-" + i,
      title: t.title, desc: "", notes: "", tags: [], subtasks: [],
      xp: xpFor(t.diff), difficulty: t.diff, reason: "demo",
      recurring: "none", priority: "medium",
      projectId: t.pid, completed: true, completedAt: at.getTime(),
      createdAt: at.getTime() - 86400000,
    });
  });

  // Historical completions distributed across the last 14 days for trend lines
  const historyTitles = [
    "Wireframe pricing tiers", "Sync with client on scope", "Refactor toast component",
    "Build progress ring", "Update README", "Address PR feedback round 1",
    "Polish loading skeletons", "Document API endpoints", "Schedule kickoff call",
    "Add keyboard shortcuts overlay", "Set up linting rules", "Write release notes",
    "Audit Lighthouse scores", "Implement command palette stub", "Trim CSS bundle",
    "Configure Sentry", "Draft case study outline", "Bug fix: state hydration",
    "Pair on hard layout problem", "Update homepage copy",
  ];
  for (let i = 0; i < 22; i++) {
    const daysAgo = 1 + Math.floor(rng() * 13);
    const dt = new Date(today); dt.setDate(dt.getDate() - daysAgo);
    dt.setHours(8 + Math.floor(rng() * 10), Math.floor(rng() * 59), 0, 0);
    if (dt.toDateString() === todayStr) dt.setDate(dt.getDate() - 1);
    const diff = choice(["easy", "easy", "medium", "medium", "hard"]);
    tasks.push({
      id: "demo-th-" + i,
      title: historyTitles[i % historyTitles.length] + (i >= historyTitles.length ? ` (${Math.floor(i / historyTitles.length) + 1})` : ""),
      desc: "", notes: "", tags: [], subtasks: [],
      xp: xpFor(diff), difficulty: diff, reason: "demo",
      recurring: "none", priority: "medium",
      projectId: rng() < 0.55 ? choice(projects).id : null,
      completed: true, completedAt: dt.getTime(),
      createdAt: dt.getTime() - 86400000,
    });
  }

  // Hook child IDs into projects
  projects.forEach(p => {
    p.childTaskIds = tasks.filter(t => t.projectId === p.id).map(t => t.id);
  });

  // Week plan: scatter 1-2 active tasks per day over the next 5 working days
  const activeIds = tasks.filter(t => !t.completed && t.recurring !== "daily").map(t => t.id);
  const weekPlan = [];
  let cursor = 0;
  for (let dayOffset = 0; dayOffset < 14 && cursor < activeIds.length; dayOffset++) {
    const d = addDays(today, dayOffset);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    const count = dayOffset === 0 ? 3 : 1 + Math.floor(rng() * 2);
    const ids = activeIds.slice(cursor, cursor + count);
    if (ids.length) weekPlan.push({ date: isoDate(d), items: ids.map(id => ({ taskId: id })) });
    cursor += count;
  }

  // Plant one split task across 3 consecutive working days to showcase the
  // multi-day chunk feature.
  const bigTask = tasks.find(t => !t.completed && t.difficulty === "hard");
  if (bigTask) {
    // Remove the big task from any current single-day entry
    for (const entry of weekPlan) {
      entry.items = entry.items.filter(it => it.taskId !== bigTask.id);
    }
    const splitNotes = [
      "Wireframe + research direction",
      "Build core component shell",
      "Polish, review, hand off",
    ];
    let placed = 0;
    for (let off = 1; off < 14 && placed < 3; off++) {
      const d = addDays(today, off);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      const iso = isoDate(d);
      let entry = weekPlan.find(e => e.date === iso);
      if (!entry) { entry = { date: iso, items: [] }; weekPlan.push(entry); }
      entry.items.push({ taskId: bigTask.id, hours: 1.5, note: splitNotes[placed] });
      placed += 1;
    }
  }
  weekPlan.sort((a, b) => a.date.localeCompare(b.date));

  // Profile
  const totalCompletedXP = tasks.filter(t => t.completed).reduce((s, t) => s + (t.xp || 0), 0);
  const todayXP = tasks
    .filter(t => t.completed && t.completedAt && new Date(t.completedAt).toDateString() === todayStr)
    .reduce((s, t) => s + (t.xp || 0), 0);
  const profile = {
    totalXP: totalCompletedXP,
    todayXP,
    streak: 6,
    lastDate: todayStr,
    completedCount: tasks.filter(t => t.completed).length,
  };

  // Screen log: last 7 days
  const screen = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    screen[isoDate(d)] = {
      xOpens: Math.floor(rng() * 12),
      ytOpens: Math.floor(rng() * 6),
      mobileHours: Math.round((1 + rng() * 3) * 2) / 2,
    };
  }

  const achievements = ["first", "five", "twenty", "streak3", "xp500", "decompose", "project"];
  const caps = { Monday: 4, Tuesday: 4, Wednesday: 4, Thursday: 4, Friday: 3, Saturday: 0, Sunday: 0 };

  return { tasks, projects, profile, weekPlan, screen, achievements, caps };
}

function progressOfProject(p, tasksById) {
  const ids = p.childTaskIds || [];
  if (!ids.length) return 0;
  let total = 0, done = 0;
  for (const id of ids) {
    const t = tasksById.get(id);
    if (!t) continue;
    total += 1;
    if (t.completed) done += 1;
  }
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

/* ───── PRIMITIVES ───── */

function Chip({ kind, children, style }) {
  const cls = "q-chip" + (kind ? " q-chip--" + kind : "");
  return <span className={cls} style={style}>{children}</span>;
}

function PriorityDot({ p }) {
  const cfg = PRIORITIES[p] || PRIORITIES.medium;
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0, display: "inline-block" }} />;
}

function DifficultyPip({ d }) {
  const cfg = DIFFICULTY[d] || DIFFICULTY.medium;
  return <span style={{ width: 6, height: 6, borderRadius: 1.5, background: cfg.tone, flexShrink: 0, display: "inline-block" }} />;
}

function Checkbox({ checked, onChange, label }) {
  return (
    <button
      type="button"
      className={"q-check-sq" + (checked ? " q-check-sq--done" : "")}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      aria-label={label || "toggle"}
      aria-pressed={checked}
    >
      {checked && (
        <svg width="9" height="9" viewBox="0 0 12 12">
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      )}
    </button>
  );
}

function CompleteButton({ done, onComplete, onReopen, tone }) {
  if (done) {
    return (
      <button
        type="button"
        className="q-check q-check--done"
        onClick={(e) => { e.stopPropagation(); onReopen && onReopen(); }}
        title="Reopen"
        aria-label="Reopen task"
      >
        <svg width="10" height="10" viewBox="0 0 12 12">
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>
    );
  }
  return (
    <button
      type="button"
      className="q-check"
      style={tone ? { borderColor: tone } : undefined}
      onClick={(e) => { e.stopPropagation(); onComplete && onComplete(); }}
      title="Complete"
      aria-label="Complete task"
    />
  );
}

function ProgressBar({ pct, tone = "var(--accent)", height = 4 }) {
  return (
    <div style={{
      height, background: "var(--bg-muted)", borderRadius: 999,
      overflow: "hidden", width: "100%",
    }}>
      <div style={{
        height: "100%", width: Math.max(0, Math.min(100, pct)) + "%",
        background: tone, borderRadius: 999,
        transition: "width 320ms cubic-bezier(.2,.8,.2,1), background 200ms",
      }} />
    </div>
  );
}

function ProgressRing({ pct, size = 28, stroke = 2.5, tone = "var(--accent)" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }} aria-hidden>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-muted)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={tone} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={off}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 360ms cubic-bezier(.2,.8,.2,1)" }} />
    </svg>
  );
}

function ShipConfetti({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);
  const colors = ["#c45a28","#2c7a4e","#2766a8","#a86a18","#1c1b17"];
  const particles = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    x: 40 + Math.random() * 20,
    y: 48,
    angle: Math.random() * 360,
    color: colors[i % colors.length],
    delay: Math.random() * 0.25,
    dx: (Math.random() - 0.5) * 220,
    dy: -(50 + Math.random() * 110),
  }));
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }} aria-hidden>
      {particles.map(p => (
        <div key={p.id} style={{
          position: "absolute", left: `${p.x}%`, top: `${p.y}%`,
          width: 7, height: 7, borderRadius: 1, background: p.color,
          animation: `q-confetti 1.1s ${p.delay}s ease-out forwards`,
          "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--rot": `${p.angle}deg`,
          opacity: 0,
        }} />
      ))}
    </div>
  );
}

function Icon({ name, size = 14 }) {
  const s = size;
  const common = { width: s, height: s, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "plus":     return <svg {...common}><path d="M8 3v10M3 8h10" /></svg>;
    case "chevron":  return <svg {...common}><path d="M4 6l4 4 4-4" /></svg>;
    case "chevronR": return <svg {...common}><path d="M6 4l4 4-4 4" /></svg>;
    case "close":    return <svg {...common}><path d="M4 4l8 8M12 4l-8 8" /></svg>;
    case "check":    return <svg {...common}><path d="M3 8.5L6.5 12L13 4.5" /></svg>;
    case "edit":     return <svg {...common}><path d="M11.5 2.5l2 2L6 12H4v-2L11.5 2.5z" /></svg>;
    case "trash":    return <svg {...common}><path d="M3 4h10M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1" /></svg>;
    case "today":    return <svg {...common}><circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" /></svg>;
    case "focus":    return <svg {...common}><path d="M6 4l5.5 4L6 12V4z" fill="currentColor" stroke="none" /></svg>;
    case "bolt":     return <svg {...common}><path d="M9 2L4 10h3l-1 4 5-8H8l1-4z" fill="currentColor" stroke="none" /></svg>;
    case "moon":     return <svg {...common}><path d="M13 9a5 5 0 11-6-6 4 4 0 006 6z" /></svg>;
    case "ring":     return <svg {...common}><circle cx="8" cy="8" r="5" strokeDasharray="6 4" /></svg>;
    case "lock":     return <svg {...common}><rect x="3.5" y="7.5" width="9" height="6" rx="1" /><path d="M5.5 7.5V5a2.5 2.5 0 015 0v2.5" /></svg>;
    case "unlock":   return <svg {...common}><rect x="3.5" y="7.5" width="9" height="6" rx="1" /><path d="M5.5 7.5V5a2.5 2.5 0 014.95-.5" /></svg>;
    case "reset":    return <svg {...common}><path d="M3 8a5 5 0 109-3" /><path d="M9 2L12 5L9 8" /></svg>;
    case "queue":    return <svg {...common}><path d="M3 5h10M3 8h10M3 11h7" /></svg>;
    case "ship":     return <svg {...common}><path d="M2 11l1.5 2.5h9L14 11M3 8l5-5 5 5M8 3v8" /></svg>;
    case "calendar": return <svg {...common}><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></svg>;
    case "habit":    return <svg {...common}><path d="M2 12l3-4 3 2 3-5 3 4" /></svg>;
    case "trophy":   return <svg {...common}><path d="M5 3h6v4a3 3 0 11-6 0V3zM3 4h2v2a1 1 0 01-2 0V4zM11 4h2v2a1 1 0 01-2 0V4zM6.5 11v2h3v-2M5 13h6" /></svg>;
    case "flame":    return <svg {...common}><path d="M8 2c1 2-1 3 0 5 1 1 3 0 3 3a3 3 0 11-6 0c0-2 1-2 1-4S7 3 8 2z" /></svg>;
    case "recur":    return <svg {...common}><path d="M3 6a4 4 0 016-3l1 1M13 10a4 4 0 01-6 3l-1-1M2 4v3h3M14 12V9h-3" /></svg>;
    case "split":    return <svg {...common}><path d="M3 3v3a3 3 0 003 3h4a3 3 0 013 3v2M3 3h2M3 3v2M11 13h2M13 11v2" /></svg>;
    case "key":      return <svg {...common}><circle cx="5" cy="8" r="2.5" /><path d="M7.5 8H14M11 8v3M13 8v2" /></svg>;
    default: return null;
  }
}

const NAV_ICON_FOR_ID = { today: "today", queue: "queue", pipeline: "ship", planner: "calendar", habits: "habit", trophies: "trophy" };

function Eyebrow({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
      <span className="q-eyebrow">{children}</span>
      {right}
    </div>
  );
}

function EmptyState({ children, dashed }) {
  return (
    <div style={{
      padding: "32px 20px",
      textAlign: "center",
      color: "var(--text-faint)",
      fontSize: 13,
      lineHeight: 1.6,
      border: `1px ${dashed ? "dashed" : "solid"} var(--border)`,
      borderRadius: "var(--r-lg)",
      background: "var(--bg-elev)",
    }}>
      {children}
    </div>
  );
}

function Toast({ msg, xp }) {
  return (
    <div className="q-fade-in" style={{
      position: "fixed", top: 16, right: 16, zIndex: 10000,
      background: "var(--bg-elev)",
      border: "1px solid var(--border-strong)",
      borderRadius: "var(--r-lg)",
      padding: "10px 14px",
      display: "flex", alignItems: "center", gap: 10,
      fontSize: 13, fontWeight: 500, color: "var(--text)",
      boxShadow: "0 6px 24px rgba(28,27,23,0.10)",
    }}>
      {xp != null && (
        <span style={{
          fontFamily: "var(--font-mono)",
          color: xp >= 0 ? "var(--success)" : "var(--danger)",
          fontWeight: 600,
        }}>
          {xp >= 0 ? "+" : ""}{xp} XP
        </span>
      )}
      <span>{msg}</span>
    </div>
  );
}

/* ───── TASK FORM ───── */

function ChipChoice({ active, color, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: "var(--r-sm)",
        font: (active ? 500 : 400) + " 11px var(--font-sans)",
        cursor: "pointer",
        border: `1px solid ${active ? (color || "var(--text)") : "var(--border)"}`,
        background: active ? "var(--bg-soft)" : "var(--bg-elev)",
        color: active ? (color || "var(--text)") : "var(--text-muted)",
        transition: "all var(--t-fast)",
        display: "inline-flex", alignItems: "center", gap: 5,
      }}
    >
      {children}
    </button>
  );
}

function TaskForm({ initial, onSave, onCancel, isEdit, autoFocus = true, initialScheduledDate = null, customTags = [], onAddCustomTag = null, lockedFields = null, projects = [] }) {
  // lockedFields = Set<string> of field keys the form should display as
  // read-only. Used for split tasks where hours/xp/scheduleDate are
  // managed per-chunk in the queue's inline editor, not here.
  const locked = lockedFields instanceof Set
    ? lockedFields
    : new Set(Array.isArray(lockedFields) ? lockedFields : []);
  const isLocked = (k) => locked.has(k);
  const [title,     setTitle]     = useState(initial?.title || "");
  const [desc,      setDesc]      = useState(initial?.desc  || "");
  const [notes,     setNotes]     = useState(initial?.notes || "");
  const [tags,      setTags]      = useState(initial?.tags  || []);
  const [subs,      setSubs]      = useState(() => (initial?.subtasks || []).map(s => ({ k: s.id || uid(), title: s.title })));
  const [recurring, setRecurring] = useState(initial?.recurring || "none");
  const [priority,  setPriority]  = useState(initial?.priority  || "medium");
  // Manual scheduling — empty string = "let the planner decide". Setting a
  // date pins the task to it (replaces any existing scheduling for the task,
  // but preserves done chunks). Stays empty for daily-recurring tasks since
  // those don't get pinned to a single date.
  const [scheduleDate, setScheduleDate] = useState(initialScheduledDate || "");
  // Project picker — null means unattached. Defaults to whatever the
  // task is already attached to. Changes here flow as data.projectId
  // through onSave.
  const initialProjectId = initial?.projectId || "";
  const [projectId, setProjectId] = useState(initialProjectId);
  // Due date — immutable deadline. Distinct from scheduleDate (which is
  // where the planner pinned the task). The planner respects this as a
  // hard upper bound when present.
  const [deadlineDate, setDeadlineDate] = useState(initial?.deadlineAt
    ? isoDate(new Date(initial.deadlineAt)) : "");
  const initialDeadlineStr = initial?.deadlineAt ? isoDate(new Date(initial.deadlineAt)) : "";
  // Manual hours/XP overrides — only show on edit (no estimate exists until AI
  // scores a fresh task). When the user edits hours, scale XP using the prior
  // XP-per-hour ratio so the relationship stays honest. Editing XP directly
  // is also allowed and decouples from the ratio.
  const initialHours = isEdit ? (typeof initial?.hours === "number" ? initial.hours : (DIFFICULTY[initial?.difficulty]?.hours || 1.5)) : null;
  const initialXp = isEdit ? (initial?.xp || 20) : null;
  const [hours,     setHours]     = useState(initialHours);
  const [xp,        setXp]        = useState(initialXp);
  const [scoreOverridden, setScoreOverridden] = useState(false);
  const [stIn,      setStIn]      = useState("");
  const titleRef = useRef(null);

  useEffect(() => { if (autoFocus && titleRef.current) titleRef.current.focus(); }, [autoFocus]);

  const addSub = () => { if (!stIn.trim()) return; setSubs(p => p.concat([{ k: uid(), title: stIn.trim() }])); setStIn(""); };
  const delSub = (k) => setSubs(p => p.filter(s => s.k !== k));
  const toggleTag = (t) => setTags(p => p.indexOf(t) >= 0 ? p.filter(x => x !== t) : p.concat([t]));

  const adjustHours = (newH) => {
    const h = Math.max(0.25, Math.min(24, parseFloat(newH) || 0));
    if (!h) return;
    // Scale XP proportionally so the per-hour ratio is preserved.
    const prevH = hours || initialHours || 1.5;
    const ratio = (xp || initialXp || 20) / prevH;
    const newXp = Math.max(5, Math.min(200, Math.round(h * ratio)));
    setHours(h);
    setXp(newXp);
    setScoreOverridden(true);
  };
  const adjustXp = (newX) => {
    const x = Math.max(5, Math.min(200, parseInt(newX, 10) || 0));
    if (!x) return;
    setXp(x);
    setScoreOverridden(true);
  };

  const canSubmit = title.trim().length > 0;
  const submit = () => {
    if (!canSubmit) return;
    const payload = { title, desc, notes, tags, subtasks: subs.map(s => s.title), recurring, priority };
    // Only ship manual overrides when the user actually touched them.
    // This keeps the AI rescore path intact for description-only edits.
    if (scoreOverridden && hours != null && xp != null) {
      payload.hours = hours;
      payload.xp = xp;
      payload.manualScore = true;
    }
    // Schedule date — null clears any pinning intent, "" means leave-as-is,
    // a value means pin to that date. We differentiate via a sentinel so
    // editing a task without touching the date doesn't unschedule it.
    if (scheduleDate !== (initialScheduledDate || "")) {
      payload.scheduleDate = scheduleDate || null;  // null = clear schedule
      payload.scheduleDateChanged = true;
    }
    // Deadline — store as timestamp at noon local on the chosen day so
    // comparisons in either direction across timezones are safe. null
    // means clear.
    if (deadlineDate !== initialDeadlineStr) {
      if (deadlineDate) {
        const [y, m, d] = deadlineDate.split("-").map(Number);
        payload.deadlineAt = new Date(y, m - 1, d, 12).getTime();
      } else {
        payload.deadlineAt = null;
      }
    }
    // Project membership change — null = detach, string id = attach to.
    if (projectId !== initialProjectId) {
      payload.projectId = projectId || null;
      payload.projectIdChanged = true;
    }
    onSave(payload);
  };

  return (
    <div className="q-card q-fade-in" style={{ padding: 18 }}>
      <Eyebrow>{isEdit ? "Edit task" : "New task"}</Eyebrow>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          ref={titleRef}
          className="q-input"
          placeholder="What needs doing?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
            else if (e.key === "Enter" && !e.shiftKey) submit();
            else if (e.key === "Escape") onCancel();
          }}
          style={{ fontSize: 15, padding: "10px 12px" }}
        />
        <textarea
          className="q-textarea"
          placeholder="Description (optional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          style={{ height: 56 }}
        />
        <textarea
          className="q-textarea"
          placeholder="Notes — context, blockers, references"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ height: 44 }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div className="q-eyebrow" style={{ marginBottom: 6 }}>Priority</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {Object.keys(PRIORITIES).map(k => (
                <ChipChoice key={k} active={priority === k} color={PRIORITIES[k].dot} onClick={() => setPriority(k)}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: PRIORITIES[k].dot, display: "inline-block" }} />
                  {PRIORITIES[k].label}
                </ChipChoice>
              ))}
            </div>
          </div>
          <div>
            <div className="q-eyebrow" style={{ marginBottom: 6 }}>Recurrence</div>
            <div style={{ display: "flex", gap: 5 }}>
              <ChipChoice active={recurring === "none"}   onClick={() => setRecurring("none")}>Once</ChipChoice>
              <ChipChoice active={recurring === "daily"}  onClick={() => setRecurring("daily")}>Daily</ChipChoice>
              <ChipChoice active={recurring === "weekly"} onClick={() => setRecurring("weekly")}>Weekly</ChipChoice>
            </div>
          </div>
        </div>

        {recurring === "none" && (
          <div>
            <div className="q-eyebrow" style={{ marginBottom: 6 }}>
              Schedule {isLocked("scheduleDate") ? "(per chunk)" : initialScheduledDate ? "(currently planned)" : "(optional — leave empty to let the planner decide)"}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", opacity: isLocked("scheduleDate") ? 0.5 : 1 }}>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="q-input q-input--sm"
                disabled={isLocked("scheduleDate")}
                style={{ fontFamily: "var(--font-mono)", padding: "6px 8px" }}
                title={isLocked("scheduleDate") ? "Task is split — change individual chunk dates from the queue's chunk panel." : undefined}
              />
              <button
                type="button"
                className="q-btn q-btn--ghost q-btn--sm"
                onClick={() => setScheduleDate(isoDate(new Date()))}
                disabled={isLocked("scheduleDate")}
              >Today</button>
              <button
                type="button"
                className="q-btn q-btn--ghost q-btn--sm"
                onClick={() => setScheduleDate(isoDate(addDays(new Date(), 1)))}
                disabled={isLocked("scheduleDate")}
              >Tomorrow</button>
              {scheduleDate && !isLocked("scheduleDate") && (
                <button
                  type="button"
                  className="q-btn q-btn--ghost q-btn--sm"
                  onClick={() => setScheduleDate("")}
                  style={{ color: "var(--text-faint)" }}
                >Clear</button>
              )}
            </div>
            {isLocked("scheduleDate") && (
              <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 6 }}>
                Task is split across multiple dates. Move individual chunks in the chunk panel.
              </div>
            )}
          </div>
        )}

        {projects.length > 0 && (
          <div>
            <div className="q-eyebrow" style={{ marginBottom: 6 }}>Project</div>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="q-input q-input--sm"
              style={{ fontSize: 13, padding: "6px 8px", maxWidth: 280 }}
            >
              <option value="">No project</option>
              {projects.filter(p => !p.completedAt).map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
              {/* If the current project is shipped, keep it selectable so the
                  user doesn't lose the link by editing the task. */}
              {projects.filter(p => p.completedAt && p.id === initialProjectId).map(p => (
                <option key={p.id} value={p.id}>{p.title} (shipped)</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <div className="q-eyebrow" style={{ marginBottom: 6 }}>
            Deadline {deadlineDate ? "(hard date)" : "(optional)"}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="date"
              value={deadlineDate}
              onChange={(e) => setDeadlineDate(e.target.value)}
              className="q-input q-input--sm"
              style={{ fontFamily: "var(--font-mono)", padding: "6px 8px" }}
            />
            {deadlineDate && (
              <button
                type="button"
                className="q-btn q-btn--ghost q-btn--sm"
                onClick={() => setDeadlineDate("")}
                style={{ color: "var(--text-faint)" }}
              >Clear</button>
            )}
            <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: "auto" }}>
              The planner treats deadlines as immovable upper bounds.
            </span>
          </div>
        </div>

        {isEdit && hours != null && xp != null && (
          <div>
            <div className="q-eyebrow" style={{ marginBottom: 6 }}>
              Estimate {isLocked("hours") ? "(per chunk)" : scoreOverridden ? "(manual)" : "(AI scored)"}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", opacity: isLocked("hours") ? 0.5 : 1 }}>
                <span style={{ fontFamily: "var(--font-mono)" }}>Hours</span>
                <input
                  type="number" min="0.25" max="24" step="0.25"
                  value={hours}
                  onChange={(e) => adjustHours(e.target.value)}
                  className="q-input q-input--sm"
                  disabled={isLocked("hours")}
                  style={{ width: 80, textAlign: "center", fontFamily: "var(--font-mono)" }}
                  title={isLocked("hours") ? "Hours are decided per chunk for split tasks. Edit them in the chunks list." : undefined}
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", opacity: isLocked("xp") ? 0.5 : 1 }}>
                <span style={{ fontFamily: "var(--font-mono)" }}>XP</span>
                <input
                  type="number" min="5" max="200" step="5"
                  value={xp}
                  onChange={(e) => adjustXp(e.target.value)}
                  className="q-input q-input--sm"
                  disabled={isLocked("xp")}
                  style={{ width: 80, textAlign: "center", fontFamily: "var(--font-mono)" }}
                  title={isLocked("xp") ? "XP for split tasks is distributed across chunks proportional to hours. Editing chunk hours updates the share." : undefined}
                />
              </label>
              <span style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                {(xp / (hours || 1)).toFixed(0)} XP/h
              </span>
            </div>
            {(isLocked("hours") || isLocked("xp")) && (
              <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 6 }}>
                Task is split across days — edit hours/notes per chunk in the queue's chunk panel.
              </div>
            )}
          </div>
        )}

        <div>
          <div className="q-eyebrow" style={{ marginBottom: 6 }}>Tags</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            {allKnownTags(customTags).map(t => (
              <ChipChoice key={t} active={tags.indexOf(t) >= 0} onClick={() => toggleTag(t)}>{t}</ChipChoice>
            ))}
            {/* Tags selected on the task but not in the known list (e.g.
                shared by another device, or removed from custom tags after
                being applied). Show them so the user can still toggle them
                off without losing the data. */}
            {tags.filter(t => !allKnownTags(customTags).includes(t)).map(t => (
              <ChipChoice key={t} active onClick={() => toggleTag(t)}>{t}</ChipChoice>
            ))}
            <input
              className="q-input q-input--sm"
              placeholder="+ new tag"
              style={{ width: 110, fontSize: 11 }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const raw = e.target.value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                  if (!raw) return;
                  if (!tags.includes(raw)) setTags(p => p.concat([raw]));
                  if (onAddCustomTag && !TASK_TAGS_BUILTIN.includes(raw) && !customTags.includes(raw)) {
                    onAddCustomTag(raw);
                  }
                  e.target.value = "";
                }
              }}
            />
          </div>
        </div>

        <div>
          <div className="q-eyebrow" style={{ marginBottom: 6 }}>Subtasks</div>
          <input
            className="q-input q-input--sm"
            placeholder="Type subtask + Enter"
            value={stIn}
            onChange={(e) => setStIn(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } }}
          />
          {subs.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {subs.map((s) => (
                <div key={s.k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 4px" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, border: "1.5px solid var(--border-strong)", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)", flex: 1 }}>{s.title}</span>
                  <button className="q-icon-btn" onClick={() => delSub(s.k)} aria-label="Remove subtask"><Icon name="close" size={11} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button className="q-btn q-btn--primary" onClick={submit} disabled={!canSubmit} style={{ flex: 1 }}>
            {isEdit ? "Save changes" : "Add task"}
          </button>
          <button className="q-btn q-btn--ghost" onClick={onCancel}>Cancel</button>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: -4 }}>
          XP is scored automatically after add. <span className="q-kbd">⌘</span> <span className="q-kbd">↵</span> to submit, <span className="q-kbd">Esc</span> to cancel.
        </div>
      </div>
    </div>
  );
}

/* ───── TASK ROW ───── */

function TaskRow({
  task, projectName, projectColor,
  onComplete, onUncomplete, onDelete, onEdit, onToggleSub, onSplit, onFocus,
  compact, expanded, onToggleExpand, dayStartHour = 0,
  // Optional context for split tasks. chunkNote is the AI-generated slice
  // description for whichever chunk is contextually relevant (today's chunk
  // on the Today view, the next undone chunk in the Queue). chunkLabel is
  // an optional indicator like "2 of 3" or "today".
  chunkNote, chunkLabel,
  // A neutral "this task is split" indicator for views that don't want to
  // surface a specific chunk's note (Queue whole-mode). Renders next to
  // the title as a small chip.
  splitBadge = null,
  // Optional JSX rendered inside the expand area after subtasks. Used for
  // the chunks editor in Queue's whole-mode.
  extraExpanded = null,
}) {
  const done = task.completed;
  const ageDays = task.createdAt ? Math.floor((Date.now() - task.createdAt) / 86400000) : 0;
  const sub  = task.subtasks || [];
  const doneSub = sub.filter(s => s.done).length;
  const diff = DIFFICULTY[task.difficulty] || DIFFICULTY.medium;
  const prio = PRIORITIES[task.priority || "medium"];

  return (
    <div className={"q-row" + (done ? " q-row--done" : "")} style={{ flexDirection: "column", alignItems: "stretch", padding: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
        <CompleteButton
          done={done}
          tone={diff.tone}
          onComplete={() => onComplete && onComplete(task.id)}
          onReopen={() => onUncomplete && onUncomplete(task.id)}
        />
        <div
          style={{ flex: 1, minWidth: 0, cursor: onToggleExpand ? "pointer" : "default" }}
          onClick={onToggleExpand ? () => onToggleExpand() : undefined}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PriorityDot p={task.priority || "medium"} />
            <span style={{
              fontSize: 13.5, fontWeight: done ? 400 : 500,
              color: done ? "var(--text-faint)" : "var(--text)",
              textDecoration: done ? "line-through" : "none",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
            }}>{task.title}</span>
            {task.recurring && task.recurring !== "none" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--text-faint)", fontSize: 10 }}>
                <Icon name="recur" size={10} /> {task.recurring}
              </span>
            )}
            {splitBadge && (
              <span style={{
                fontSize: 10, fontFamily: "var(--font-mono)",
                color: "var(--text-faint)",
                border: "1px solid var(--border-strong)", borderRadius: 3,
                padding: "1px 5px",
              }}>{splitBadge}</span>
            )}
            {task.deadlineAt && !done && (() => {
              // Show "Due Fri" or "Due Jun 12". Color by urgency:
              //   past         → red (overdue)
              //   ≤ 3 days     → amber
              //   ≤ 7 days     → faint
              //   else         → very faint
              const now = Date.now();
              const dueDate = new Date(task.deadlineAt);
              const daysLeft = Math.floor((task.deadlineAt - now) / 86400000);
              const overdue = task.deadlineAt < now && daysLeft < 0;
              const tone = overdue ? "var(--danger)"
                : daysLeft <= 3 ? "var(--warning)"
                : daysLeft <= 7 ? "var(--text-muted)" : "var(--text-faint)";
              const label = overdue
                ? `Overdue ${Math.abs(daysLeft)}d`
                : daysLeft === 0 ? "Due today"
                : daysLeft === 1 ? "Due tomorrow"
                : daysLeft < 7 ? `Due ${dueDate.toLocaleDateString("en-US", { weekday: "short" })}`
                : `Due ${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
              return (
                <span
                  title={`Deadline: ${dueDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`}
                  style={{
                    fontSize: 10, fontFamily: "var(--font-mono)",
                    color: tone, fontWeight: 600,
                    border: `1px solid ${tone}`, borderRadius: 3,
                    padding: "1px 5px",
                    background: overdue ? "var(--danger-soft)"
                      : daysLeft <= 3 ? "var(--warning-soft)" : "transparent",
                  }}
                >{label}</span>
              );
            })()}
            {!done && ageDays > 7 && (
              <span
                title={`Pending ${ageDays} day${ageDays !== 1 ? "s" : ""}`}
                style={{
                  display: "inline-flex", alignItems: "center",
                  fontSize: 10, fontFamily: "var(--font-mono)",
                  color: ageDays > 14 ? "var(--warning)" : "var(--text-faint)",
                  border: `1px solid ${ageDays > 14 ? "var(--warning)" : "var(--border-strong)"}`,
                  borderRadius: 3, padding: "0 5px",
                  background: ageDays > 14 ? "var(--warning-soft)" : "transparent",
                }}
              >
                {ageDays}d
              </span>
            )}
          </div>
          {chunkNote && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              marginTop: 3,
              fontSize: 11, color: done ? "var(--text-faint)" : "var(--text-muted)",
              fontStyle: "italic",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              minWidth: 0,
            }} title={chunkNote}>
              {chunkLabel && (
                <span style={{
                  fontStyle: "normal",
                  fontFamily: "var(--font-mono)", fontSize: 9,
                  color: "var(--text-faint)",
                  border: "1px solid var(--border)", borderRadius: 3,
                  padding: "1px 4px", flexShrink: 0,
                }}>{chunkLabel}</span>
              )}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{chunkNote}</span>
            </div>
          )}
          {(task.tags?.length || projectName) && (
            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
              {projectName && (
                <Chip
                  kind={projectColor ? undefined : "accent"}
                  style={projectColor ? {
                    color: projectColor,
                    borderColor: projectColor,
                    background: "transparent",
                  } : undefined}
                >
                  <span style={{
                    display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                    background: projectColor || "var(--accent)",
                    marginRight: 5, verticalAlign: "middle",
                  }} />
                  {projectName}
                </Chip>
              )}
              {(task.tags || []).map(tag => <Chip key={tag}>{tag}</Chip>)}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {(() => {
            const fm = effectiveFocusMs(task, dayStartHour);
            if (!(fm > 0) || done) return null;
            return (
              <span
                title={task.recurring === "daily" ? "Time focused today" : "Time focused on this task"}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 11, fontFamily: "var(--font-mono)",
                  color: "var(--accent-strong)",
                }}
              >
                <Icon name="focus" size={10} />
                {fmtFocusMs(fm)}
              </span>
            );
          })()}
          {sub.length > 0 && (
            <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
              {doneSub}/{sub.length}
            </span>
          )}
          <span title={`${diff.label} · ${taskHours(task)}h estimated · ${task.xp} XP`} style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
            color: "var(--text-muted)",
          }}>
            <DifficultyPip d={task.difficulty} />
            <span>{taskHours(task)}h</span>
            <span style={{ color: "var(--text-faint)" }}>·</span>
            <span>{task.xp} XP</span>
          </span>
          {!compact && !done && onFocus && (
            <button
              className="q-icon-btn"
              onClick={(e) => { e.stopPropagation(); onFocus(task.id); }}
              aria-label="Enter focus mode"
              title="Focus on this task"
            ><Icon name="focus" size={13} /></button>
          )}
          {!compact && onEdit && (
            <button className="q-icon-btn" onClick={(e) => { e.stopPropagation(); onEdit(task); }} aria-label="Edit"><Icon name="edit" size={13} /></button>
          )}
          {!compact && onDelete && (
            <button className="q-icon-btn" onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} aria-label="Delete"><Icon name="close" size={13} /></button>
          )}
        </div>
      </div>

      {!compact && expanded && (
        <div className="q-fade-in" style={{ padding: "0 12px 12px 40px", borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 0 }}>
          {task.desc && <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.55, marginBottom: 8 }}>{task.desc}</div>}
          {task.notes && <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", marginBottom: 8 }}>{task.notes}</div>}
          {task.reason && task.reason !== "auto" && task.reason !== "imported" && (
            <div style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)", marginBottom: sub.length ? 8 : 0 }}>
              scored: {task.reason}
            </div>
          )}
          {sub.length > 0 && (
            <div>
              <div className="q-eyebrow" style={{ marginBottom: 6 }}>Subtasks</div>
              {sub.map(s => (
                <div key={s.id} onClick={() => onToggleSub && onToggleSub(task.id, s.id)} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer",
                }}>
                  <Checkbox checked={s.done} onChange={() => onToggleSub && onToggleSub(task.id, s.id)} />
                  <span style={{
                    fontSize: 12.5,
                    color: s.done ? "var(--text-faint)" : "var(--text)",
                    textDecoration: s.done ? "line-through" : "none",
                  }}>{s.title}</span>
                </div>
              ))}
              {onSplit && !task.projectId && (
                <button className="q-btn q-btn--outline q-btn--sm" style={{ marginTop: 10 }} onClick={() => onSplit(task.id)}>
                  <Icon name="split" size={12} /> Split into {sub.length} tasks
                </button>
              )}
            </div>
          )}
          {extraExpanded}
        </div>
      )}
    </div>
  );
}

/* ───── SIDEBAR ───── */

function Sidebar({ view, setView, lvl, profile, onOpenHelp, previewMode, onEnterPreview, onExitPreview, dayStartHour, onChangeDayStartHour, onExportData, onImportData }) {
  // Day rollover presets — natural-language shortcuts to the numeric input
  // for users who don't intuit what "rolls at 4" means.
  const presets = [
    { label: "Standard", hour: 0, hint: "rolls at midnight" },
    { label: "Late", hour: 22, hint: "rolls at 10pm — tomorrow starts after 10pm tonight" },
    { label: "Overnight", hour: 4, hint: "rolls at 4am — late-night work counts as today" },
  ];
  return (
    <aside className="q-sidebar" style={{
      width: 200, flexShrink: 0, height: "100vh",
      background: "var(--bg-elev)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      padding: "20px 0",
    }}>
      <div className="q-brand" style={{ padding: "0 16px 18px", borderBottom: "1px solid var(--border)" }}>
        <div className="q-eyebrow" style={{ marginBottom: 2 }}>Personal&nbsp;OS</div>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text)" }}>Quest</div>
      </div>
      <nav style={{ flex: 1, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map(n => {
          const active = view === n.id;
          return (
            <button
              key={n.id}
              className={"q-nav-btn" + (active ? " q-nav-btn--active" : "")}
              onClick={() => setView(n.id)}
              title={`${n.label} (${n.shortcut})`}
            >
              <span className="q-nav-glyph"><Icon name={NAV_ICON_FOR_ID[n.id]} size={15} /></span>
              <span className="q-nav-label" style={{ flex: 1 }}>{n.label}</span>
              <span className="q-kbd q-nav-label" style={{ opacity: active ? 0.9 : 0.5 }}>{n.shortcut}</span>
            </button>
          );
        })}
      </nav>
      <div className="q-sidebar-foot" style={{ padding: "14px 16px", borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>Lv.{lvl.lvl}</span>
          <span style={{ fontSize: 11, color: "var(--text)", fontWeight: 500 }}>{lvl.title}</span>
        </div>
        <ProgressBar pct={lvl.pct} tone="var(--accent)" height={3} />
        <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)", display: "flex", justifyContent: "space-between" }}>
          <span>{profile.totalXP} XP</span>
          <span>{lvl.xpToNext > 0 ? `${lvl.xpToNext} to next` : "max"}</span>
        </div>
        {profile.streak > 0 && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--accent)" }}>
            <Icon name="flame" size={12} />
            <span style={{ fontFamily: "var(--font-mono)" }}>{profile.streak}-day streak</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
          <button className="q-btn q-btn--ghost q-btn--xs" style={{ padding: 0 }} onClick={onOpenHelp}>
            <Icon name="key" size={11} /> shortcuts
          </button>
          {previewMode ? (
            <button className="q-btn q-btn--ghost q-btn--xs" style={{ padding: 0, color: "var(--accent-strong)" }} onClick={onExitPreview}>
              exit preview
            </button>
          ) : (
            <button className="q-btn q-btn--ghost q-btn--xs" style={{ padding: 0 }} onClick={onEnterPreview}>
              <Icon name="bolt" size={11} /> preview
            </button>
          )}
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 8, fontSize: 11, color: "var(--text-faint)", marginBottom: 5,
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Icon name="moon" size={11} /> day rolls at
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <input
                type="number" min="0" max="23"
                value={dayStartHour}
                onChange={(e) => onChangeDayStartHour && onChangeDayStartHour(e.target.value)}
                style={{
                  width: 34, textAlign: "right",
                  padding: "2px 4px",
                  background: "var(--bg-soft)", border: "1px solid var(--border)", borderRadius: 3,
                  color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 11,
                }}
                aria-label="Day rollover hour"
              />
              <span style={{ fontFamily: "var(--font-mono)" }}>:00</span>
            </span>
          </div>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {presets.map(p => (
              <button
                key={p.label}
                onClick={() => onChangeDayStartHour && onChangeDayStartHour(p.hour)}
                title={p.hint}
                style={{
                  fontSize: 9, fontFamily: "var(--font-mono)",
                  padding: "2px 5px", borderRadius: 3,
                  background: dayStartHour === p.hour ? "var(--accent-soft)" : "transparent",
                  border: "1px solid " + (dayStartHour === p.hour ? "var(--accent)" : "var(--border)"),
                  color: dayStartHour === p.hour ? "var(--accent-strong)" : "var(--text-faint)",
                  cursor: "pointer",
                }}
              >{p.label}</button>
            ))}
          </div>
        </div>
        {(onExportData || onImportData) && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 10,
            borderTop: "1px solid var(--border)",
            fontSize: 11, color: "var(--text-faint)",
          }}>
            {onExportData && (
              <button
                className="q-btn q-btn--ghost q-btn--xs"
                style={{ padding: 0 }}
                onClick={onExportData}
                title="Download a JSON backup of every task, project, plan, profile, and trophy"
              >export</button>
            )}
            {onImportData && (
              <button
                className="q-btn q-btn--ghost q-btn--xs"
                style={{ padding: 0 }}
                onClick={onImportData}
                title="Restore from a JSON backup file"
              >import</button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

/* ───── PAGE SHELL ───── */

const captureFocusBus = { focus: () => {} };

function Sparkline({ data, tone = "var(--accent)" }) {
  const sparkId = useMemo(() => "spark-" + Math.random().toString(36).slice(2, 8), []);
  if (!data || data.length === 0) return null;
  const width = 200, height = 48;  // viewBox; SVG scales via preserveAspectRatio=none
  const max = Math.max(1, ...data);
  const stepX = width / Math.max(1, data.length - 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - (v / max) * (height - 6) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePath = "M" + points.join("L");
  const areaPath = linePath + `L${width},${height}L0,${height}Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="q-stat-spark" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={sparkId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.38" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${sparkId})`} />
      <path d={linePath} fill="none" stroke={tone} strokeWidth="1.6"
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function StreakHistogram({ data }) {
  const max = Math.max(1, ...data);
  return (
    <div className="q-stat-hist" aria-hidden>
      {data.map((v, i) => {
        const h = v > 0 ? Math.max(4, Math.round((v / max) * 28)) : 3;
        const isLast = i === data.length - 1;
        const cls = isLast
          ? "q-stat-hist-bar q-stat-hist-bar--active"
          : "q-stat-hist-bar" + (v === 0 ? " q-stat-hist-bar--low" : "");
        return <div key={i} className={cls} style={{ height: h }} />;
      })}
    </div>
  );
}

function TrendBadge({ pct, label = "vs last week" }) {
  if (pct == null) return null;
  const kind = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  const arrow = kind === "up" ? "↑" : kind === "down" ? "↓" : "·";
  return (
    <div className={"q-stat-trend q-stat-trend--" + kind}>
      <span style={{ fontFamily: "var(--font-mono)" }}>{arrow}</span>
      {Math.abs(pct)}% {label}
    </div>
  );
}

const PROJECT_TYPE_COLOR = {
  template:  "var(--proj-template)",
  component: "var(--proj-component)",
  client:    "var(--proj-client)",
  side:      "var(--proj-side)",
  other:     "var(--proj-other)",
};
function projectColor(type) { return PROJECT_TYPE_COLOR[type] || PROJECT_TYPE_COLOR.other; }

// Inline chunk editor for split tasks — renders one row per chunk with
// editable hours / note inputs and a done checkbox. Pure-ish component:
// owns local state for the inputs (debounced via blur) so typing doesn't
// thrash the full plan on every keystroke.
function ChunksEditor({ taskId, chunks, updateChunk, toggleChunkDone, moveChunkDate, dayStartHour = 0 }) {
  // Local mirrors keyed by `${date}:${taskId}` so multiple rows can edit
  // independently without echoing each other.
  const [edits, setEdits] = useState({});
  const keyOf = (c) => `${c.date}:${taskId}`;

  const valOr = (c, field) => {
    const k = keyOf(c);
    if (edits[k] != null && Object.prototype.hasOwnProperty.call(edits[k], field)) {
      return edits[k][field];
    }
    return field === "hours" ? (c.item.hours != null ? c.item.hours : "") : (c.item.note || "");
  };

  const setVal = (c, field, value) => {
    setEdits(prev => ({ ...prev, [keyOf(c)]: { ...(prev[keyOf(c)] || {}), [field]: value } }));
  };

  const commit = (c, field) => {
    const k = keyOf(c);
    const localEdit = edits[k];
    if (!localEdit || !Object.prototype.hasOwnProperty.call(localEdit, field)) return;
    const v = localEdit[field];
    if (field === "hours") {
      const num = parseFloat(v);
      if (Number.isFinite(num) && num > 0) {
        updateChunk(taskId, c.date, { hours: Math.round(num * 4) / 4 });
      } else if (v === "") {
        updateChunk(taskId, c.date, { hours: null });
      }
    } else if (field === "note") {
      updateChunk(taskId, c.date, { note: typeof v === "string" ? v.trim() : null });
    }
    // Clear the local edit so future renders read from the source.
    setEdits(prev => {
      const next = { ...prev };
      if (next[k]) {
        const cell = { ...next[k] };
        delete cell[field];
        if (Object.keys(cell).length === 0) delete next[k];
        else next[k] = cell;
      }
      return next;
    });
  };

  const todayIso = effectiveTodayIso(dayStartHour);

  return (
    <div style={{ marginTop: 4 }}>
      <div className="q-eyebrow" style={{ marginBottom: 6 }}>
        Split across {chunks.length} day{chunks.length === 1 ? "" : "s"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {chunks.map((c) => {
          const isPast = c.date < todayIso;
          const isToday = c.date === todayIso;
          const dateColor = c.item.done ? "var(--success)"
            : isToday ? "var(--accent)"
            : isPast ? "var(--warning)" : "var(--text)";
          return (
            <div key={keyOf(c)} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 8px",
              background: "var(--bg-elev)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
              opacity: c.item.done ? 0.65 : 1,
              flexWrap: "wrap",
            }}>
              <CompleteButton
                done={!!c.item.done}
                tone={DIFFICULTY[c.item.difficulty]?.tone || "var(--info)"}
                onComplete={() => toggleChunkDone(c.date, taskId, true)}
                onReopen={() => toggleChunkDone(c.date, taskId, false)}
              />
              <input
                type="date"
                value={c.date}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v && v !== c.date && moveChunkDate) moveChunkDate(taskId, c.date, v);
                }}
                className="q-input q-input--sm"
                disabled={c.item.done}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 11,
                  padding: "4px 6px",
                  color: dateColor,
                  width: 140,
                }}
                title={isToday ? "Today" : isPast && !c.item.done ? `Late` : ""}
              />
              {(isToday || (isPast && !c.item.done)) && (
                <span style={{
                  fontSize: 9, fontFamily: "var(--font-mono)",
                  color: isToday ? "var(--accent)" : "var(--warning)",
                  fontWeight: 600,
                }}>
                  {isToday ? "TODAY" : "LATE"}
                </span>
              )}
              <input
                type="number"
                min="0.25"
                max="24"
                step="0.25"
                value={valOr(c, "hours")}
                onChange={(e) => setVal(c, "hours", e.target.value)}
                onBlur={() => commit(c, "hours")}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
                className="q-input q-input--sm"
                style={{ width: 56, fontFamily: "var(--font-mono)", textAlign: "center" }}
                placeholder="hrs"
                disabled={c.item.done}
              />
              <input
                type="text"
                value={valOr(c, "note")}
                onChange={(e) => setVal(c, "note", e.target.value)}
                onBlur={() => commit(c, "note")}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
                className="q-input q-input--sm"
                style={{ flex: 1, minWidth: 160, fontSize: 12 }}
                placeholder="What happens this day"
                disabled={c.item.done}
              />
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 6 }}>
        Tip: change a chunk's date to reschedule it. Drag in the planner also works.
      </div>
    </div>
  );
}

// Missed work strip — past-due undone chunks. Each item gets three actions:
// "Move to today" reschedules the chunk to today's date, "Done" marks it
// complete in place (in case the user actually did the work but forgot to
// check off), and "Dismiss" removes the chunk from the plan entirely. The
// strip self-hides when there's nothing missed.
function MissedWork({
  tasks, weekPlan, setWeekPlan, projectsMap, toggleChunkDone,
  pinTaskToDate, notify, dayStartHour = 0,
  compact = false,
}) {
  const missed = useMemo(
    () => getMissedWork(tasks, weekPlan, dayStartHour),
    [tasks, weekPlan, dayStartHour],
  );
  if (!missed.length) return null;

  const todayIso = effectiveTodayIso(dayStartHour);

  // Move a single chunk between dates without disturbing the task's other
  // chunks. (pinTaskToDate would collapse split chunks together; this only
  // shifts the one missed slice.)
  const moveChunkToToday = (fromDate, taskId) => {
    setWeekPlan(prev => {
      const planSrc = Array.isArray(prev) ? prev : [];
      let movedItem = null;
      const stripped = planSrc.map(entry => {
        if (entry.date !== fromDate) return entry;
        const out = [];
        for (const it of (entry.items || [])) {
          if (it.taskId === taskId && !movedItem && !it.done) movedItem = it;
          else out.push(it);
        }
        return { ...entry, items: out };
      });
      const item = movedItem || { taskId, done: false };
      // Reset doneAt since the chunk is being moved, not completed.
      const movedClean = { ...item, done: false, doneAt: null };
      const byDate = new Map();
      for (const e of stripped) {
        byDate.set(e.date, { date: e.date, items: [...e.items] });
      }
      if (!byDate.has(todayIso)) byDate.set(todayIso, { date: todayIso, items: [] });
      const todayEntry = byDate.get(todayIso);
      if (!todayEntry.items.some(x => x.taskId === taskId && !x.done)) {
        todayEntry.items.push(movedClean);
      }
      const next = Array.from(byDate.values())
        .filter(e => e.items.length)
        .sort((a, b) => a.date.localeCompare(b.date));
      saveKV(KEYS.weekplan, next);
      return next;
    });
    if (notify) notify("Moved to today");
  };

  const dismissChunk = (fromDate, taskId) => {
    setWeekPlan(prev => {
      const planSrc = Array.isArray(prev) ? prev : [];
      const next = planSrc.map(entry => {
        if (entry.date !== fromDate) return entry;
        return { ...entry, items: (entry.items || []).filter(it => !(it.taskId === taskId && !it.done)) };
      }).filter(e => (e.items || []).length);
      saveKV(KEYS.weekplan, next);
      return next;
    });
    if (notify) notify("Removed from plan");
  };

  const total = missed.length;
  return (
    <div className="q-fade-in" style={{
      marginBottom: 18,
      border: "1px solid var(--warning)",
      borderRadius: "var(--r-md)",
      background: "var(--warning-soft)",
      padding: compact ? "10px 12px" : "12px 14px",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10, gap: 8,
      }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="bolt" size={12} />
          <span style={{
            fontSize: 11, fontWeight: 600, color: "var(--warning)",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>Missed work</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {total} item{total === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {missed.map(({ date, taskId, task, item }) => {
          const project = task.projectId && projectsMap ? projectsMap[task.projectId] : null;
          const daysAgo = Math.max(1, Math.round((parseIsoDate(todayIso) - parseIsoDate(date)) / 86400000));
          return (
            <div key={`${date}-${taskId}`} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px",
              background: "var(--bg-elev)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
              borderLeft: "3px solid " + (project?.color || DIFFICULTY[task.difficulty]?.tone || "var(--warning)"),
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 500, color: "var(--text)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{task.title}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 2, fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                  <span>{daysAgo}d late</span>
                  {project && (
                    <>
                      <span>·</span>
                      <span style={{ color: project.color || "var(--text-faint)" }}>{project.title}</span>
                    </>
                  )}
                  {item.hours && <><span>·</span><span>{item.hours}h chunk</span></>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button
                  className="q-btn q-btn--ghost q-btn--sm"
                  onClick={() => moveChunkToToday(date, taskId)}
                  title="Reschedule to today"
                >Today</button>
                <button
                  className="q-btn q-btn--ghost q-btn--sm"
                  onClick={() => toggleChunkDone(date, taskId, true)}
                  title="Mark this chunk done at its original date"
                  style={{ color: "var(--success)" }}
                >Done</button>
                <button
                  className="q-icon-btn"
                  onClick={() => dismissChunk(date, taskId)}
                  title="Remove from plan"
                  aria-label="Dismiss"
                ><Icon name="close" size={11} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ThisWeekCard({ tasks, weekPlan, dayStartHour = 0 }) {
  const data = useMemo(() => {
    // Anchor the week on the effective "today" so the rollover-hour user
    // sees consistent groupings everywhere.
    const monday = mondayOf(effectiveToday(dayStartHour));
    const todayIso = effectiveTodayIso(dayStartHour);
    const activity = buildActivityByDay(tasks, weekPlan, dayStartHour);
    const labels = ["M","T","W","T","F","S","S"];
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i);
      const dStr = d.toDateString();
      const iso = isoDate(d);
      const count = activity.get(dStr)?.size || 0;
      days.push({ iso, label: labels[i], count, isToday: iso === todayIso, inPast: iso < todayIso, isCurrent: iso === todayIso });
    }
    const elapsedDays = Math.max(1, days.filter(d => d.iso <= todayIso).length);
    const total = days.reduce((s, d) => s + d.count, 0);
    const avg = (total / elapsedDays).toFixed(1);
    return { days, total, avg };
  }, [tasks, weekPlan, dayStartHour]);
  const max = Math.max(1, ...data.days.map(d => d.count));

  return (
    <div className="q-week-card">
      <div className="q-week-hero">
        <span className="q-section-title" style={{ marginBottom: 14 }}>This week</span>
        <div style={{
          fontSize: 34, fontWeight: 600, color: "var(--text)",
          letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums",
          lineHeight: 1.05, marginTop: 6,
        }}>{data.avg}</div>
        <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>tasks / day avg</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, fontFamily: "var(--font-mono)" }}>
          {data.total} total · {data.days.filter(d => d.count > 0).length}/7 days
        </div>
      </div>
      <div className="q-week-bars">
        {data.days.map((d, i) => {
          const h = d.count > 0 ? Math.max(4, Math.round((d.count / max) * 56)) : 2;
          const cls = d.isToday
            ? "q-week-bar q-week-bar--active"
            : d.count > 0
              ? "q-week-bar q-week-bar--filled"
              : "q-week-bar q-week-bar--empty";
          return (
            <div key={i} className="q-week-bar-col" title={`${d.label} · ${d.count} task${d.count !== 1 ? "s" : ""}`}>
              <div className="q-week-bar-track">
                <div className={cls} style={{ height: h }} />
              </div>
              <div className={"q-week-day-label" + (d.isToday ? " q-week-day-label--active" : "")}>{d.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EnergyToggle({ value, onChange }) {
  const opts = [
    { id: "low",    label: "Easy", title: "Surface easy tasks first (low energy)" },
    { id: "normal", label: "Auto", title: "Default sort by priority" },
    { id: "high",   label: "Hard", title: "Surface hard tasks first (high energy)" },
  ];
  return (
    <div className="q-energy" role="group" aria-label="Energy mode">
      {opts.map(o => (
        <button
          key={o.id}
          type="button"
          className={value === o.id ? "is-active" : ""}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          title={o.title}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const DIFFICULTY_ORDER = ["easy", "medium", "hard", "epic"];
function sortForEnergy(arr, energy) {
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

const CAPTURE_MODES = [
  { id: "task",     label: "Task",     sub: "single action item", placeholder: "Describe a task — AI writes the title" },
  { id: "subtasks", label: "Subtasks", sub: "task with concrete steps", placeholder: "Describe a multi-step task — AI suggests steps" },
  { id: "project",  label: "Project",  sub: "multi-task initiative", placeholder: "Describe a project — AI suggests child tasks" },
];

function QuickCapture({ onCreateTask, onCreateProject, onOpenManual }) {
  const [mode, setMode] = useState("task");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    captureFocusBus.focus = () => inputRef.current?.focus();
    return () => { captureFocusBus.focus = () => {}; };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const currentMode = CAPTURE_MODES.find(m => m.id === mode);

  const submit = async () => {
    const v = text.trim();
    if (!v || loading) return;
    setLoading(true);
    try {
      const result = await aiFromDescription(v, mode);
      setText("");
      if (mode === "project") {
        onCreateProject({
          title: result.title || v.slice(0, 60),
          description: result.description || "",
          tasks: Array.isArray(result.tasks) ? result.tasks : [],
        });
      } else {
        const aiRecurring = ["daily", "weekly"].includes(result.recurring) ? result.recurring : "none";
        onCreateTask({
          title: result.title || v.slice(0, 60),
          desc: result.description || "",
          notes: "",
          tags: [],
          subtasks: mode === "subtasks" && Array.isArray(result.subtasks) ? result.subtasks : [],
          recurring: aiRecurring,
          priority: "medium",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="q-capture-wrap" ref={menuRef}>
      <div className="q-capture" style={{ opacity: loading ? 0.85 : 1 }}>
        <button
          type="button"
          className="q-capture-mode"
          onClick={() => setMenuOpen(o => !o)}
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          title="Switch capture mode"
        >
          <span className={"q-capture-mode-dot q-capture-mode-dot--" + mode} />
          {currentMode.label}
          <Icon name="chevron" size={10} />
        </button>
        <input
          ref={inputRef}
          value={text}
          disabled={loading}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            else if (e.key === "Escape") { setText(""); inputRef.current?.blur(); }
          }}
          placeholder={loading ? "Generating…" : currentMode.placeholder}
          aria-label="Describe a task"
        />
        {loading ? (
          <span className="q-spin" style={{ display: "inline-flex" }}>
            <Icon name="ring" size={12} />
          </span>
        ) : (
          <button
            type="button"
            className="q-icon-btn"
            onClick={onOpenManual}
            title="Open the full task form"
            aria-label="Manual task entry"
          ><Icon name="edit" size={13} /></button>
        )}
        <span className="q-kbd" title="Press N to focus">N</span>
      </div>
      {menuOpen && (
        <div className="q-capture-menu" role="listbox">
          {CAPTURE_MODES.map(m => (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={mode === m.id}
              className={mode === m.id ? "is-active" : ""}
              onClick={() => { setMode(m.id); setMenuOpen(false); inputRef.current?.focus(); }}
            >
              <div className="q-capture-menu-row">
                <span className={"q-capture-mode-dot q-capture-mode-dot--" + m.id} />
                <span>{m.label}</span>
              </div>
              <div className="q-capture-menu-sub">{m.sub}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PageHeader({ eyebrow, title, sub, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, marginBottom: 24 }}>
      <div>
        <div className="q-eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>
        <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--text)" }}>{title}</div>
        {sub && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

const VIEW_PAD = "32px 40px 48px";

/* ───── TODAY VIEW ───── */

function TodayView({
  tasks, projects, projectsMap, tasksById, profile, lvl, unlocked,
  weekPlan, setWeekPlan, completeTask, uncompleteTask, toggleChunkDone,
  pinTaskToDate, notify,
  addTask, updateTask, deleteTask, toggleSub, splitTask, setView,
  openNewTask, setOpenNewTask, createProjectFromCapture,
  startFocus, energy, setEnergy,
  endOfDayOpen, setEndOfDayOpen, weeklyDismissed, setWeeklyDismissed,
  previewMode, dayClosed, reopenDay,
  firstLaunch = false, enterPreview, dismissFirstLaunch,
  customTags = [], addCustomTag = null,
  dayStartHour = 0,
}) {
  const [editing, setEditing] = useState(null);
  const [exp,     setExp]     = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [screenLog, setScreenLog] = useState({});

  useEffect(() => { loadKV(KEYS.screen, {}).then(setScreenLog); }, []);

  const tName = todayName();
  const today = effectiveTodayIso(dayStartHour);
  const entry = screenLog[today] || { xOpens: 0, ytOpens: 0, mobileHours: null };
  const patchScreen = (obj) => {
    const next = { ...screenLog, [today]: { ...entry, ...obj } };
    setScreenLog(next); saveKV(KEYS.screen, next);
  };

  const allPending = tasks.filter(t => !t.completed);
  // All daily tasks — completed-today included so the row stays visible
  // (it disappears via processRecurring on the next calendar day).
  const dailyAll = tasks.filter(t => t.recurring === "daily");
  const dailyPending = dailyAll;  // alias for downstream consumers
  const todayDateStr = effectiveTodayDateStr(dayStartHour);
  // Tasks "done today" includes both fully completed tasks and any task with
  // a chunk marked done today — so partial split-task progress counts toward
  // the day's stat.
  const todayActivityIds = useMemo(() => {
    const m = buildActivityByDay(tasks, weekPlan, dayStartHour);
    return m.get(todayDateStr) || new Set();
  }, [tasks, weekPlan, dayStartHour, todayDateStr]);
  const todayDone = tasks.filter(t => todayActivityIds.has(t.id));

  const todayIso = effectiveTodayIso(dayStartHour);
  const todayPlanData = weekPlan
    ? (weekPlan.find(d => d.date === todayIso) || { items: [] })
    : null;
  const todayItems = todayPlanData ? (todayPlanData.items || []) : [];
  // De-duplicate by task id (defensive — should not normally repeat per day).
  const todayScheduledSeen = new Set();
  const todayScheduled = todayItems
    .map(it => tasksById.get(it.taskId))
    .filter(t => t && !todayScheduledSeen.has(t.id) && todayScheduledSeen.add(t.id));
  const todayPlanTasks = sortForEnergy(dailyPending.concat(todayScheduled), energy);
  const planXP = todayPlanTasks.reduce((s,t) => s + (t.xp || 0), 0);
  // Count a split chunk on today as "done for today" even if the parent task
  // isn't fully complete yet — otherwise users see "0/3 done" while every
  // chunk for the day is checked.
  const planDone = todayPlanTasks.filter(t => {
    if (t.completed) return true;
    const it = todayItems.find(i => i.taskId === t.id);
    return !!it?.done;
  }).length;

  const generatePlan = () => {
    setPlanLoading(true);
    aiPlanWeek(tasks, DEFAULT_CAPS, { mode: weekPlan ? "append" : "fresh", existingPlan: weekPlan || [], projects }).then(p => {
      if (p) { setWeekPlan(p); saveKV(KEYS.weekplan, p); }
      setPlanLoading(false);
    });
  };

  const handleAdd = (data) => { addTask(data); setOpenNewTask(false); };
  const handleUpdate = (data) => updateTask(editing.id, data).then(() => setEditing(null));

  const activeProjects = projects.filter(p => !p.completedAt);
  const readyToShip = activeProjects.filter(p => progressOfProject(p, tasksById) === 100 && (p.childTaskIds || []).length > 0);

  const trendStats = useMemo(() => {
    // 14 days of history; the last 7 power trend calcs, the full 14 power
    // the streak histogram. Anchored on effective today so the day-rollover
    // hour applies consistently across all aggregates.
    const anchor = effectiveToday(dayStartHour);
    const days14 = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(anchor); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      days14.push(d.toDateString());
    }
    const activity = buildActivityByDay(tasks, weekPlan, dayStartHour);
    const taskById = new Map(tasks.map(t => [t.id, t]));
    const doneByDay14 = days14.map(s => (activity.get(s)?.size) || 0);
    // For XP per day, sum task.xp for each unique task active that day. For
    // a fully-completed task on day X, this is its full XP. For partial
    // chunks the task's full XP is included on the chunk's day — that
    // matches the "task touched today" lens used by the bar count.
    const xpByDay14 = days14.map(s => {
      const ids = activity.get(s) || new Set();
      let sum = 0;
      for (const id of ids) sum += (taskById.get(id)?.xp || 0);
      return sum;
    });

    const lastWeek = xpByDay14.slice(0, 7);
    const thisWeek = xpByDay14.slice(7, 14);
    const lastWeekDone = doneByDay14.slice(0, 7);
    const thisWeekDone = doneByDay14.slice(7, 14);
    const trend = (a, b) => {
      const sumA = a.reduce((s, v) => s + v, 0);
      const sumB = b.reduce((s, v) => s + v, 0);
      if (sumA === 0) return null;
      return Math.round(((sumB - sumA) / sumA) * 100);
    };
    return {
      xpByDay: xpByDay14.slice(7, 14),
      doneByDay: doneByDay14.slice(7, 14),
      doneByDay14,
      xpTrend:   trend(lastWeek, thisWeek),
      doneTrend: trend(lastWeekDone, thisWeekDone),
    };
  }, [tasks, weekPlan, dayStartHour]);

  const hour = new Date().getHours();
  const planDoneAll = todayPlanTasks.length > 0 && planDone === todayPlanTasks.length;
  const greeting = (() => {
    if (planDoneAll)              return "Everything's done. Solid day.";
    if (allPending.length === 0)  return "Queue empty. Take the win.";
    if (hour < 5)                 return "Late one.";
    if (hour < 12)                return "Morning. Let's ship.";
    if (hour < 14)                return "Midday. Keep moving.";
    if (hour < 18)                return "Back at it.";
    if (hour < 22)                return "Evening push.";
    return "Still here.";
  })();

  const dow = effectiveToday(dayStartHour).getDay();
  const showWeeklyPulse = !weeklyDismissed && (previewMode || dow === 1 || dow === 2);
  const dismissWeekly = () => {
    const wid = isoDate(mondayOf(effectiveToday(dayStartHour)));
    saveKV("quest_pulse_dismissed", wid);
    setWeeklyDismissed(true);
  };

  const closedTime = dayClosed && dayClosed.closedAt
    ? new Date(dayClosed.closedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <div className="q-view-pad" style={{ padding: VIEW_PAD, maxWidth: 1180, margin: "0 auto" }}>
      {dayClosed && closedTime && (
        <div className="q-day-closed q-fade-in">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon name="moon" size={13} /> Day closed at {closedTime}
          </span>
          <button className="q-link" onClick={reopenDay}>Reopen</button>
        </div>
      )}
      {showWeeklyPulse && <WeeklyPulse tasks={tasks} weekPlan={weekPlan} onDismiss={dismissWeekly} dayStartHour={dayStartHour} />}
      <MissedWork
        tasks={tasks} weekPlan={weekPlan} setWeekPlan={setWeekPlan}
        projectsMap={projectsMap} toggleChunkDone={toggleChunkDone}
        pinTaskToDate={pinTaskToDate} notify={notify}
        dayStartHour={dayStartHour}
      />
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        title={greeting}
        sub={
          allPending.length === 0
            ? `${todayDone.length} shipped today${profile.todayXP ? ` · ${profile.todayXP} XP` : ""}`
            : readyToShip.length
              ? `${allPending.length} pending · ${readyToShip.length} project${readyToShip.length>1?"s":""} ready to ship`
              : `${allPending.length} pending · ${todayPlanTasks.length} on today's plan`
        }
        right={<QuickCapture
          onCreateTask={handleAdd}
          onCreateProject={(data) => { createProjectFromCapture(data); setView("pipeline"); }}
          onOpenManual={() => { setEditing(null); setOpenNewTask(true); }}
        />}
      />

      <div className="q-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 24 }}>
        <div className="q-stat">
          <div className="q-stat-top">
            <div className="q-stat-label">Today's XP</div>
            <div className="q-stat-value">{profile.todayXP}</div>
            <TrendBadge pct={trendStats.xpTrend} />
          </div>
          <div className="q-stat-bottom">
            <Sparkline data={trendStats.xpByDay} tone="var(--accent)" />
          </div>
        </div>
        <div className="q-stat">
          <div className="q-stat-top">
            <div className="q-stat-label">Streak</div>
            <div className="q-stat-value" style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              {profile.streak}<span style={{ fontSize: 13, color: "var(--text-faint)", fontWeight: 500 }}>days</span>
            </div>
            {profile.streak > 0 ? (
              <div className="q-stat-trend q-stat-trend--flat">
                <Icon name="flame" size={11} /> {profile.streak === 1 ? "first day" : "going"}
              </div>
            ) : (
              <div className="q-stat-trend q-stat-trend--flat">Ship something today</div>
            )}
          </div>
          <div className="q-stat-bottom">
            <StreakHistogram data={trendStats.doneByDay14} />
          </div>
        </div>
        <div className="q-stat">
          <div className="q-stat-top">
            <div className="q-stat-label">Done today</div>
            <div className="q-stat-value">{todayDone.length}</div>
            <TrendBadge pct={trendStats.doneTrend} />
          </div>
          <div className="q-stat-bottom">
            <Sparkline data={trendStats.doneByDay} tone="var(--success)" />
          </div>
        </div>
        <div className="q-stat">
          <div className="q-stat-top">
            <div className="q-stat-label">Pending</div>
            <div className="q-stat-value">{allPending.length}</div>
            <div className="q-stat-trend q-stat-trend--flat">
              {readyToShip.length > 0 ? `${readyToShip.length} ready to ship` : "open queue"}
            </div>
          </div>
          <div className="q-stat-bottom">
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: "8px 18px", height: "100%" }}>
              {/* tiny stack of difficulty pips for variety */}
              {["epic","hard","medium","easy"].map(d => {
                const count = allPending.filter(t => t.difficulty === d).length;
                return count > 0 ? (
                  <span key={d} title={`${count} ${d}`} style={{
                    display: "inline-flex", alignItems: "center", gap: 3,
                    marginLeft: 10, fontSize: 10, fontFamily: "var(--font-mono)",
                    color: "var(--text-faint)",
                  }}>
                    <DifficultyPip d={d} /> {count}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="q-today-grid" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
        <div>
          {openNewTask && <div style={{ marginBottom: 12 }}><TaskForm onSave={handleAdd} onCancel={() => setOpenNewTask(false)} customTags={customTags} onAddCustomTag={addCustomTag} projects={projects} /></div>}
          {editing &&  <div style={{ marginBottom: 12 }}><TaskForm initial={editing} isEdit initialScheduledDate={getTaskScheduledDate(editing.id, weekPlan)} onSave={handleUpdate} onCancel={() => setEditing(null)} customTags={customTags} onAddCustomTag={addCustomTag} lockedFields={getTaskChunks(editing.id, weekPlan).length > 1 ? ["hours", "xp", "scheduleDate"] : null} projects={projects} /></div>}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <span className="q-section-title">Today</span>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <EnergyToggle value={energy} onChange={setEnergy} />
              {todayDone.length > 0 && !dayClosed && (
                <button className="q-link" onClick={() => setEndOfDayOpen(true)} title="Close the day">
                  Close day →
                </button>
              )}
              <button className="q-link" onClick={() => setView("queue")}>Full queue →</button>
            </div>
          </div>
          {todayPlanTasks.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {todayPlanTasks.map(t => {
                // Tasks that have a chunk on today's plan complete chunk-by-
                // chunk: clicking the circle marks ONLY today's chunk done,
                // and the parent task auto-completes once every chunk across
                // all days is done. The circle's visual reflects the chunk's
                // state, not the whole task's. Daily-recurring + non-
                // scheduled tasks fall back to direct task completion.
                const todayItem = todayItems.find(i => i.taskId === t.id);
                const onCompleteHere = todayItem
                  ? () => toggleChunkDone(todayIso, t.id, true)
                  : completeTask;
                const onUncompleteHere = todayItem
                  ? () => toggleChunkDone(todayIso, t.id, false)
                  : uncompleteTask;
                const renderTask = todayItem
                  ? { ...t, completed: !!(todayItem.done || t.completed) }
                  : t;
                // For split tasks, surface today's chunk note + part indicator
                // so the user sees "what specifically am I doing today" without
                // bouncing to the planner.
                let chunkNote = null, chunkLabel = null;
                if (todayItem) {
                  const chunks = getTaskChunks(t.id, weekPlan);
                  if (chunks.length > 1) {
                    const idx = chunks.findIndex(c => c.date === todayIso);
                    if (idx >= 0) chunkLabel = `${idx + 1}/${chunks.length}`;
                  }
                  if (todayItem.note) chunkNote = todayItem.note;
                }
                return (
                <TaskRow key={t.id} task={renderTask}
                  onComplete={onCompleteHere} onUncomplete={onUncompleteHere}
                  onEdit={(task) => { setOpenNewTask(false); setEditing(task); }}
                  onDelete={deleteTask} onToggleSub={toggleSub} onSplit={splitTask} onFocus={startFocus}
                  projectName={t.projectId && projectsMap[t.projectId] ? projectsMap[t.projectId].title : null}
                  projectColor={t.projectId && projectsMap[t.projectId] ? projectsMap[t.projectId].color : null}
                  chunkNote={chunkNote} chunkLabel={chunkLabel}
                  expanded={exp === t.id} onToggleExpand={() => setExp(exp === t.id ? null : t.id)}
                  dayStartHour={dayStartHour}
                />
                );
              })}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                <span>{planDone}/{todayPlanTasks.length} done</span>
                <span>{planXP} XP planned</span>
              </div>
            </div>
          ) : (
            (() => {
              const upcoming = (weekPlan || [])
                .filter(e => e.date > todayIso && (e.items || []).length > 0)
                .sort((a, b) => a.date.localeCompare(b.date))[0];
              const tWeekday = weekdayName(new Date());
              const isWeekendDay = tWeekday === "Saturday" || tWeekday === "Sunday";
              if (upcoming) {
                const upDate = parseIsoDate(upcoming.date);
                const dayLabel = upDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
                const n = upcoming.items.length;
                return (
                  <EmptyState dashed>
                    <div style={{ marginBottom: 6, fontWeight: 500, color: "var(--text)" }}>
                      {isWeekendDay ? "Off today. Enjoy the weekend." : "Nothing scheduled today."}
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      Next up: <span style={{ color: "var(--text-muted)" }}>{dayLabel}</span> · {n} task{n > 1 ? "s" : ""}
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                      <button className="q-btn q-btn--outline q-btn--sm" onClick={() => setView("planner")}>
                        Open planner
                      </button>
                      {!isWeekendDay && allPending.length > 0 && (
                        <button className="q-btn q-btn--ghost q-btn--sm" disabled={planLoading} onClick={generatePlan}>
                          {planLoading ? "Planning…" : "Schedule pending"}
                        </button>
                      )}
                    </div>
                  </EmptyState>
                );
              }
              if (!weekPlan || weekPlan.length === 0) {
                return (
                  <EmptyState dashed>
                    <div style={{ marginBottom: 12 }}>
                      {allPending.length === 0
                        ? "Queue empty. Capture a task to get started."
                        : "No plan yet. Let the planner sort the next two weeks."}
                    </div>
                    {allPending.length === 0 ? (
                      firstLaunch ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                            <button
                              className="q-btn q-btn--primary q-btn--sm"
                              onClick={() => { dismissFirstLaunch && dismissFirstLaunch(); captureFocusBus.focus(); }}
                            >Capture your first task</button>
                            <button
                              className="q-btn q-btn--outline q-btn--sm"
                              onClick={() => { dismissFirstLaunch && dismissFirstLaunch(); enterPreview && enterPreview(); }}
                            >
                              <Icon name="bolt" size={11} /> Try with sample data
                            </button>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "center", maxWidth: 320 }}>
                            Preview loads tasks, projects, history, and a planner so you can poke around without committing.
                          </div>
                        </div>
                      ) : (
                        <button
                          className="q-btn q-btn--primary q-btn--sm"
                          onClick={() => captureFocusBus.focus()}
                        >Capture your first task</button>
                      )
                    ) : (
                      <button className="q-btn q-btn--outline q-btn--sm" disabled={planLoading} onClick={generatePlan}>
                        {planLoading ? "Planning…" : "Generate plan"}
                      </button>
                    )}
                  </EmptyState>
                );
              }
              // Plan exists but everything's already done; no upcoming entries
              return (
                <EmptyState dashed>
                  <div style={{ fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>
                    {isWeekendDay ? "Off today. Enjoy the weekend." : "Plan cleared."}
                  </div>
                  <div>Capture something new, or generate a fresh plan when you're ready.</div>
                </EmptyState>
              );
            })()
          )}
        </div>

        <div className="q-today-rail" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {readyToShip.length > 0 && (
            <div className="q-card" style={{ padding: 14, borderColor: "var(--success)", background: "var(--success-soft)" }}>
              <Eyebrow right={<button className="q-link" onClick={() => setView("pipeline")}>Pipeline →</button>}>
                Ready to ship
              </Eyebrow>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {readyToShip.slice(0, 4).map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <ProgressRing pct={100} size={24} stroke={2.5} tone="var(--success)" />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                    <button className="q-btn q-btn--success q-btn--xs" onClick={() => setView("pipeline")}>Ship</button>
                  </div>
                ))}
              </div>
            </div>
          )}


          <div className="q-card" style={{ padding: 14 }}>
            <Eyebrow right={<button className="q-link" onClick={() => setView("habits")}>Habits →</button>}>
              Screen log
            </Eyebrow>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              {[
                { label: "X", key: "xOpens" },
                { label: "YT", key: "ytOpens" },
              ].map(item => {
                const count = entry[item.key] || 0;
                return (
                  <div key={item.key} style={{
                    background: "var(--bg-soft)", borderRadius: "var(--r-md)",
                    padding: "10px 12px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{item.label} opens</span>
                      <span style={{ fontSize: 18, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text)" }}>{count}</span>
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button className="q-btn q-btn--outline q-btn--xs" style={{ flex: 1 }} onClick={() => { const o={}; o[item.key]=count+1; patchScreen(o); }}>+1</button>
                      {count > 0 && <button className="q-btn q-btn--ghost q-btn--xs" onClick={() => { const o={}; o[item.key]=Math.max(0, count-1); patchScreen(o); }}>−</button>}
                    </div>
                  </div>
                );
              })}
            </div>
            {entry.mobileHours != null && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {entry.mobileHours}h on mobile today
              </div>
            )}
          </div>

          <div className="q-card" style={{ padding: 14 }}>
            <Eyebrow right={<button className="q-link" onClick={() => setView("trophies")}>All →</button>}>
              Latest trophies
            </Eyebrow>
            {unlocked.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>Complete tasks to unlock trophies.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {unlocked.slice(-3).reverse().map(id => {
                  const def = ACHIEVEMENTS.find(a => a.id === id);
                  if (!def) return null;
                  return (
                    <div key={id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Icon name="trophy" size={14} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)" }}>{def.title}</div>
                        <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{def.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="q-bottom-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 28 }}>
        <div className="q-card" style={{ padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span className="q-section-title">Projects</span>
            <button className="q-link" onClick={() => setView("pipeline")}>All →</button>
          </div>
          {activeProjects.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--text-faint)", padding: "8px 0" }}>
              No active projects yet. Capture one with the project mode.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {activeProjects.slice(0, 6).map(p => {
                const pct = progressOfProject(p, tasksById);
                const total = (p.childTaskIds || []).length;
                const done = (p.childTaskIds || []).map(id => tasksById.get(id)).filter(t => t && t.completed).length;
                const color = pct === 100 ? "var(--success)" : (p.color || projectColor(p.type));
                return (
                  <div key={p.id} className="q-proj-row">
                    <div className="q-proj-head">
                      <span className="q-proj-bullet" style={{ background: color, color }} />
                      <span className="q-proj-name">{p.title}</span>
                      <span className="q-proj-count">{done} / {total}</span>
                    </div>
                    <div className="q-proj-bar">
                      <div className="q-proj-bar-fill" style={{ width: pct + "%", background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <ThisWeekCard tasks={tasks} weekPlan={weekPlan} dayStartHour={dayStartHour} />
      </div>
    </div>
  );
}

/* ───── QUEUE VIEW ───── */

function QueueView({
  tasks, projects, projectsMap, tasksById, startFocus, energy,
  completeTask, uncompleteTask, addTask, updateTask,
  deleteTask, toggleSub, splitTask, createProject, createProjectFromCapture, setView,
  openNewTask, setOpenNewTask, weekPlan, toggleChunkDone, updateChunk, moveChunkDate,
  customTags = [], addCustomTag = null,
  dayStartHour = 0,
}) {
  const [filter, setFilter] = useState("pending");
  const [sortBy, setSortBy] = useState("priority");
  const [editing, setEditing] = useState(null);
  const [exp,     setExp]     = useState(null);
  const [projectFilter, setProjectFilter] = useState(null);
  const [tagFilter, setTagFilter] = useState(null);  // selected tag, or null
  // "whole" = one row per task (default); "split" = one row per scheduled
  // chunk so the user sees every slice as its own line.
  const [viewMode, setViewMode] = useState("whole");
  // Screenshot import state.
  const [importing, setImporting] = useState(false);   // true while AI is parsing
  const [parsedTasks, setParsedTasks] = useState(null); // null = no import in progress
  const [importSelected, setImportSelected] = useState(new Set()); // indices to keep
  const [importMakeProject, setImportMakeProject] = useState(false);
  const [importProjectName, setImportProjectName] = useState("");
  const fileInputRef = useRef(null);

  // Available tags = anything actually applied to existing tasks (so the
  // filter doesn't show stale entries) plus known custom tags.
  const usedTags = useMemo(() => {
    const set = new Set();
    for (const t of tasks) for (const tag of (t.tags || [])) set.add(tag);
    return Array.from(set).sort();
  }, [tasks]);

  const filtered = tasks
    .filter(t => {
      if (filter === "pending")   return !t.completed;
      if (filter === "recurring") return t.recurring && t.recurring !== "none";
      if (filter === "done")      return t.completed;
      return true;
    })
    .filter(t => !projectFilter || t.projectId === projectFilter)
    .filter(t => !tagFilter || (t.tags || []).includes(tagFilter));
  const list = (() => {
    if (filter !== "pending") return filtered.slice().sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    if (sortBy === "energy")   return sortForEnergy(filtered, energy);
    if (sortBy === "priority") return filtered.slice().sort((a, b) => (PRIORITIES[a.priority||"medium"].order) - (PRIORITIES[b.priority||"medium"].order));
    if (sortBy === "xp")       return filtered.slice().sort((a, b) => (b.xp || 0) - (a.xp || 0));
    if (sortBy === "created")  return filtered.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (sortBy === "age")      return filtered.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return filtered;
  })();

  const handleAdd = (d) => { addTask(d); setOpenNewTask(false); };
  const handleUpdate = (d) => updateTask(editing.id, d).then(() => setEditing(null));

  // Screenshot import: read the file as base64 (sans data: prefix), send to
  // vision API, render results for user review.
  const handleImportFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setImporting(true);
    setParsedTasks(null);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
      if (!m) throw new Error("bad data URL");
      const result = await aiImportFromScreenshot(m[2], m[1]);
      if (!Array.isArray(result) || !result.length) {
        setImporting(false);
        return alert("Couldn't find any tasks in that screenshot. Try a clearer image.");
      }
      setParsedTasks(result);
      setImportSelected(new Set(result.map((_, i) => i)));
      // Default project name from first non-empty projectHint.
      const hint = result.find(t => t.projectHint)?.projectHint || "";
      setImportProjectName(hint);
      setImportMakeProject(!!hint);
    } catch (e) {
      console.error("Screenshot import failed:", e);
      alert("Import failed — check console for details.");
    } finally {
      setImporting(false);
    }
  };

  const commitImport = () => {
    if (!parsedTasks || !parsedTasks.length) return;
    const picks = parsedTasks.filter((_, i) => importSelected.has(i));
    if (!picks.length) { setParsedTasks(null); return; }
    let projectId = null;
    if (importMakeProject && importProjectName.trim()) {
      // createProject (not createProjectFromCapture) so children aren't run
      // through aiScore — we already have scores from the vision pass.
      projectId = createProject({ title: importProjectName.trim(), type: "other" });
    }
    for (const p of picks) {
      addTask({
        title: p.title,
        desc: p.description,
        notes: "",
        tags: [],
        subtasks: [],
        recurring: "none",
        priority: p.priority,
        projectId,
        hours: p.hours,
        xp: p.xp,
        difficulty: p.difficulty,
        manualScore: true,  // skip the AI rescore since we already have values
      });
    }
    setParsedTasks(null);
    setImportSelected(new Set());
    setImportMakeProject(false);
    setImportProjectName("");
  };

  return (
    <div className="q-view-pad" style={{ padding: VIEW_PAD, maxWidth: 880, margin: "0 auto" }}>
      <PageHeader
        eyebrow="All tasks"
        title="Queue"
        sub={`${list.length} ${filter === "pending" ? "pending" : filter}${projectFilter && projectsMap[projectFilter] ? ` · ${projectsMap[projectFilter].title}` : ""}${tagFilter ? ` · #${tagFilter}` : ""}`}
        right={
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                e.target.value = "";
              }}
            />
            <button
              className="q-btn q-btn--outline q-btn--sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              title="Import tasks from a screenshot of another tool"
            >
              {importing ? "Reading…" : <><Icon name="bolt" size={11} /> Import</>}
            </button>
            <QuickCapture
              onCreateTask={handleAdd}
              onCreateProject={(data) => { createProjectFromCapture(data); setView("pipeline"); }}
              onOpenManual={() => { setEditing(null); setOpenNewTask(true); }}
            />
          </div>
        }
      />

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {["pending","recurring","done","all"].map(f => (
            <ChipChoice key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</ChipChoice>
          ))}
        </div>
        {filter === "pending" && (
          <>
            <div style={{ height: 14, width: 1, background: "var(--border)" }} />
            <span className="q-eyebrow">Sort</span>
            <div style={{ display: "flex", gap: 4 }}>
              {[["priority","priority"],["energy","energy"],["xp","XP"],["created","newest"],["age","oldest"]].map(([id, lbl]) => (
                <ChipChoice key={id} active={sortBy === id} onClick={() => setSortBy(id)}>{lbl}</ChipChoice>
              ))}
            </div>
          </>
        )}
        {projectFilter && (
          <button className="q-link" onClick={() => setProjectFilter(null)}>clear project filter</button>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 4 }} title="Show tasks as whole or per chunk">
          <span className="q-eyebrow" style={{ marginRight: 4, alignSelf: "center" }}>View</span>
          <ChipChoice active={viewMode === "whole"} onClick={() => setViewMode("whole")}>whole</ChipChoice>
          <ChipChoice active={viewMode === "split"} onClick={() => setViewMode("split")}>per chunk</ChipChoice>
        </div>
      </div>

      {usedTags.length > 0 && (
        <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <span className="q-eyebrow" style={{ marginRight: 4 }}>Tags</span>
          {usedTags.map(t => (
            <ChipChoice
              key={t}
              active={tagFilter === t}
              onClick={() => setTagFilter(tagFilter === t ? null : t)}
            >#{t}</ChipChoice>
          ))}
          {tagFilter && (
            <button className="q-link" onClick={() => setTagFilter(null)} style={{ marginLeft: 4 }}>clear</button>
          )}
        </div>
      )}

      {openNewTask && <div style={{ marginBottom: 12 }}><TaskForm onSave={handleAdd} onCancel={() => setOpenNewTask(false)} customTags={customTags} onAddCustomTag={addCustomTag} projects={projects} /></div>}
      {editing  && <div style={{ marginBottom: 12 }}><TaskForm initial={editing} isEdit initialScheduledDate={getTaskScheduledDate(editing.id, weekPlan)} onSave={handleUpdate} onCancel={() => setEditing(null)} customTags={customTags} onAddCustomTag={addCustomTag} lockedFields={getTaskChunks(editing.id, weekPlan).length > 1 ? ["hours", "xp", "scheduleDate"] : null} projects={projects} /></div>}

      {parsedTasks && (
        <div className="q-card q-fade-in" style={{ padding: 14, marginBottom: 16, borderColor: "var(--accent)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Eyebrow>Import preview · {parsedTasks.length} task{parsedTasks.length === 1 ? "" : "s"} found</Eyebrow>
            <button className="q-icon-btn" onClick={() => { setParsedTasks(null); setImportSelected(new Set()); }} aria-label="Discard import">
              <Icon name="close" size={12} />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 380, overflowY: "auto", marginBottom: 10 }}>
            {parsedTasks.map((p, i) => {
              const selected = importSelected.has(i);
              return (
                <div
                  key={i}
                  onClick={() => {
                    setImportSelected(prev => {
                      const next = new Set(prev);
                      if (next.has(i)) next.delete(i); else next.add(i);
                      return next;
                    });
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "7px 10px",
                    background: selected ? "var(--bg-elev)" : "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-sm)",
                    opacity: selected ? 1 : 0.5,
                    cursor: "pointer",
                    borderLeft: "3px solid " + (selected ? (DIFFICULTY[p.difficulty]?.tone || "var(--info)") : "var(--border)"),
                  }}
                >
                  <Checkbox checked={selected} onChange={() => {}} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                    {p.description && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.description}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                    <span title={`${p.difficulty}`}><DifficultyPip d={p.difficulty} /></span>
                    <span>{p.hours}h</span>
                    <span>·</span>
                    <span>{p.xp}XP</span>
                    {p.completed && <span style={{ color: "var(--success)" }}>· done</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
              <Checkbox checked={importMakeProject} onChange={() => setImportMakeProject(v => !v)} />
              <span>Group as project:</span>
            </label>
            <input
              className="q-input q-input--sm"
              value={importProjectName}
              onChange={(e) => setImportProjectName(e.target.value)}
              placeholder="Project name"
              disabled={!importMakeProject}
              style={{ flex: 1, maxWidth: 240 }}
            />
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
              {importSelected.size} of {parsedTasks.length} selected
            </span>
            <button
              className="q-btn q-btn--ghost q-btn--sm"
              onClick={() => { setParsedTasks(null); setImportSelected(new Set()); }}
            >Cancel</button>
            <button
              className="q-btn q-btn--primary q-btn--sm"
              onClick={commitImport}
              disabled={importSelected.size === 0}
            >Import {importSelected.size}</button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState>Nothing here.</EmptyState>
      ) : viewMode === "split" ? (
        /* Per-chunk view: one row per scheduled chunk. Unscheduled tasks
           collapse to a single "unscheduled" entry. Sorted by date so the
           user sees their work in execution order. */
        (() => {
          const rows = [];
          for (const t of list) {
            const chunks = getTaskChunks(t.id, weekPlan);
            if (chunks.length === 0) {
              rows.push({ task: t, chunk: null, sortKey: "9999-12-31" });
            } else {
              for (const c of chunks) {
                rows.push({ task: t, chunk: c, sortKey: c.date });
              }
            }
          }
          rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {rows.map((row, i) => {
                const t = row.task;
                const c = row.chunk;
                const project = t.projectId && projectsMap[t.projectId] ? projectsMap[t.projectId] : null;
                if (!c) {
                  // Unscheduled task — show as plain row.
                  return (
                    <TaskRow
                      key={`u-${t.id}`} task={t}
                      onComplete={completeTask} onUncomplete={uncompleteTask}
                      onEdit={(task) => { setOpenNewTask(false); setEditing(task); }}
                      onDelete={deleteTask} onToggleSub={toggleSub} onSplit={splitTask} onFocus={startFocus}
                      projectName={project?.title || null}
                      projectColor={project?.color || null}
                      expanded={exp === `u-${t.id}`} onToggleExpand={() => setExp(exp === `u-${t.id}` ? null : `u-${t.id}`)}
                      dayStartHour={dayStartHour}
                    />
                  );
                }
                // Chunk row: a synthetic task object with chunk-local
                // completion + hours so TaskRow renders accurately. The
                // underlying task is unchanged.
                const chunks = getTaskChunks(t.id, weekPlan);
                const idx = chunks.findIndex(x => x.date === c.date);
                const label = chunks.length > 1 ? `${idx + 1}/${chunks.length}` : null;
                const dateLabel = parseIsoDate(c.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                const synthetic = {
                  ...t,
                  completed: !!(c.item.done || t.completed),
                  hours: c.item.hours != null ? c.item.hours : t.hours,
                };
                return (
                  <TaskRow
                    key={`${c.date}-${t.id}-${i}`}
                    task={synthetic}
                    onComplete={() => toggleChunkDone(c.date, t.id, true)}
                    onUncomplete={() => toggleChunkDone(c.date, t.id, false)}
                    onEdit={(task) => { setOpenNewTask(false); setEditing(task); }}
                    onDelete={deleteTask} onToggleSub={toggleSub} onSplit={splitTask} onFocus={startFocus}
                    projectName={project?.title || null}
                    projectColor={project?.color || null}
                    chunkNote={c.item.note || null} chunkLabel={label ? `${label} · ${dateLabel}` : dateLabel}
                    expanded={exp === `${c.date}-${t.id}`} onToggleExpand={() => setExp(exp === `${c.date}-${t.id}` ? null : `${c.date}-${t.id}`)}
                    dayStartHour={dayStartHour}
                    extraExpanded={chunks.length > 1 ? (
                      <ChunksEditor
                        taskId={t.id}
                        chunks={chunks}
                        updateChunk={updateChunk}
                        toggleChunkDone={toggleChunkDone}
                        moveChunkDate={moveChunkDate}
                        dayStartHour={dayStartHour}
                      />
                    ) : null}
                  />
                );
              })}
            </div>
          );
        })()
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {list.map(t => {
            const chunks = getTaskChunks(t.id, weekPlan);
            const isSplit = chunks.length > 1;
            return (
            <TaskRow key={t.id} task={t}
              onComplete={completeTask} onUncomplete={uncompleteTask}
              onEdit={(task) => { setOpenNewTask(false); setEditing(task); }}
              onDelete={deleteTask} onToggleSub={toggleSub} onSplit={splitTask} onFocus={startFocus}
              projectName={t.projectId && projectsMap[t.projectId] ? projectsMap[t.projectId].title : null}
              projectColor={t.projectId && projectsMap[t.projectId] ? projectsMap[t.projectId].color : null}
              splitBadge={isSplit ? `Split · ${chunks.length} days` : null}
              expanded={exp === t.id} onToggleExpand={() => setExp(exp === t.id ? null : t.id)}
              dayStartHour={dayStartHour}
              extraExpanded={isSplit ? (
                <ChunksEditor
                  taskId={t.id}
                  chunks={chunks}
                  updateChunk={updateChunk}
                  toggleChunkDone={toggleChunkDone}
                  moveChunkDate={moveChunkDate}
                  dayStartHour={dayStartHour}
                />
              ) : null}
            />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───── PIPELINE VIEW (ship-list lens) ───── */

// Inline editable description for a project. Click to edit, blur to save,
// Escape to cancel. Renders nothing visible when there's no description
// AND nothing's being edited — adds a small "+ add description" affordance
// instead so the field can be discovered.
function ProjectDescField({ project, updateProjectMeta }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project?.desc || "");
  useEffect(() => { setDraft(project?.desc || ""); }, [project?.desc]);
  const commit = () => {
    const next = draft.trim();
    if (next !== (project.desc || "")) {
      updateProjectMeta && updateProjectMeta(project.id, { desc: next });
    }
    setEditing(false);
  };
  const cancel = () => {
    setDraft(project?.desc || "");
    setEditing(false);
  };
  if (!editing) {
    if (!project.desc) {
      return (
        <button
          className="q-btn q-btn--ghost q-btn--xs"
          style={{ marginTop: 12, padding: "2px 0", color: "var(--text-faint)", fontStyle: "italic" }}
          onClick={() => setEditing(true)}
        >+ add description</button>
      );
    }
    return (
      <div
        onClick={() => setEditing(true)}
        style={{
          marginTop: 12, padding: "8px 10px",
          background: "var(--bg-soft)",
          border: "1px dashed var(--border)",
          borderRadius: "var(--r-sm)",
          fontSize: 12.5, color: "var(--text-muted)",
          lineHeight: 1.5, cursor: "text", whiteSpace: "pre-wrap",
        }}
        title="Click to edit"
      >{project.desc}</div>
    );
  }
  return (
    <textarea
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); cancel(); }
        else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
      }}
      className="q-textarea"
      placeholder="What this project is, why it matters, what done looks like."
      style={{ marginTop: 12, height: 70, fontSize: 12.5 }}
    />
  );
}

function PipelineView({
  tasks, projects, projectsMap, tasksById,
  completeTask, uncompleteTask, addTask, addChildToProject,
  removeChildFromProject, deleteTask, createProject, renameProject,
  updateProjectMeta, updateProjectColor, shipProject, unshipProject, deleteProject, setView,
  notify,
}) {
  const [filter, setFilter] = useState("All");
  const [expandedId, setExpandedId] = useState(null);
  const [showShipped, setShowShipped] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("template");
  const [addingTaskTo, setAddingTaskTo] = useState(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskPrio, setNewTaskPrio] = useState("medium");
  // AI extend state — one project at a time, holds the text input and the
  // loading flag while the model is generating.
  const [aiAddingTo, setAiAddingTo] = useState(null);
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const nameInputRef = useRef(null);
  const taskInputRef = useRef(null);
  const aiInputRef = useRef(null);
  useEffect(() => { if (adding && nameInputRef.current) nameInputRef.current.focus(); }, [adding]);
  useEffect(() => { if (addingTaskTo && taskInputRef.current) taskInputRef.current.focus(); }, [addingTaskTo]);
  useEffect(() => { if (aiAddingTo && aiInputRef.current) aiInputRef.current.focus(); }, [aiAddingTo]);

  // AI-extend a project: send the project + its existing tasks + the user's
  // query to the model, then add each returned task as a pre-scored child.
  const submitAiExtend = async (project) => {
    const q = aiQuery.trim();
    if (!q || aiLoading) return;
    setAiLoading(true);
    try {
      const childTasks = (project.childTaskIds || [])
        .map(id => tasksById.get(id))
        .filter(Boolean);
      const newTasks = await aiExtendProject(project, childTasks, q);
      if (!Array.isArray(newTasks) || !newTasks.length) {
        if (notify) notify("AI couldn't generate tasks — try rephrasing");
        return;
      }
      for (const t of newTasks) {
        addChildToProject(project.id, t);
      }
      if (notify) notify(`Added ${newTasks.length} task${newTasks.length > 1 ? "s" : ""}`);
      setAiQuery("");
      setAiAddingTo(null);
    } catch (e) {
      console.error("AI extend failed:", e);
      if (notify) notify("AI extend failed — check console");
    } finally {
      setAiLoading(false);
    }
  };

  const active = projects.filter(p => !p.completedAt);
  const shipped = projects.filter(p => p.completedAt).sort((a, b) => (b.shippedAt || b.completedAt || 0) - (a.shippedAt || a.completedAt || 0));
  const filtered = active
    .filter(p => filter === "All" || p.type === filter)
    .sort((a, b) => progressOfProject(b, tasksById) - progressOfProject(a, tasksById));

  const submitNew = () => {
    if (!newName.trim()) return;
    const id = createProject({ title: newName.trim(), type: newType });
    setNewName(""); setAdding(false);
    setExpandedId(id);
    setAddingTaskTo(id);
  };

  const startRename = (p) => { setEditingId(p.id); setEditName(p.title); };
  const commitRename = () => {
    if (editName.trim() && editingId) renameProject(editingId, editName.trim());
    setEditingId(null); setEditName("");
  };

  const submitTask = (projectId) => {
    if (!newTaskName.trim()) return;
    addChildToProject(projectId, { title: newTaskName.trim(), priority: newTaskPrio });
    setNewTaskName("");
  };

  const readyCount = active.filter(p => progressOfProject(p, tasksById) === 100 && (p.childTaskIds || []).length > 0).length;

  return (
    <div className="q-view-pad" style={{ padding: VIEW_PAD, maxWidth: 720, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Shipping"
        title="Pipeline"
        sub={
          active.length === 0 && shipped.length === 0
            ? "Nothing in the pipeline yet."
            : readyCount > 0
              ? `${readyCount} project${readyCount > 1 ? "s" : ""} ready to ship`
              : `${active.length} in flight · ${shipped.length} shipped`
        }
        right={
          <button className="q-btn q-btn--primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={13} /> New project
          </button>
        }
      />

      {adding && (
        <div className="q-card q-fade-in" style={{ padding: 14, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            ref={nameInputRef}
            className="q-input"
            placeholder="Project name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitNew(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
          />
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {PROJECT_TYPES.map(t => (
              <ChipChoice key={t.id} active={newType === t.id} onClick={() => setNewType(t.id)}>{t.label}</ChipChoice>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="q-btn q-btn--primary" onClick={submitNew} disabled={!newName.trim()}>Create project</button>
            <button className="q-btn q-btn--ghost" onClick={() => { setAdding(false); setNewName(""); }}>Cancel</button>
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
          <ChipChoice active={filter === "All"} onClick={() => setFilter("All")}>All</ChipChoice>
          {PROJECT_TYPES.map(t => (
            <ChipChoice key={t.id} active={filter === t.id} onClick={() => setFilter(t.id)}>{t.label}</ChipChoice>
          ))}
        </div>
      )}

      {filtered.length === 0 && !adding && (
        <EmptyState dashed>
          {active.length === 0
            ? <>Add a project to get started. Closest-to-done floats to the top.<br/>Or expand a task with subtasks and split it into one.</>
            : <>No {PROJECT_TYPES.find(t => t.id === filter)?.label || filter} projects in flight.</>
          }
        </EmptyState>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(p => {
          const pct = progressOfProject(p, tasksById);
          const children = (p.childTaskIds || []).map(id => tasksById.get(id)).filter(Boolean);
          const doneCount = children.filter(c => c.completed).length;
          const total = children.length;
          const isReady = pct === 100 && total > 0;
          const isOpen = expandedId === p.id;
          const projColor = p.color || PROJECT_PALETTE[0];
          const tone = isReady ? "var(--success)" : projColor;
          const typeLbl = PROJECT_TYPES.find(t => t.id === p.type)?.label || "Other";
          return (
            <div key={p.id} className="q-card" style={{
              borderColor: isReady ? "var(--success)" : isOpen ? "var(--border-strong)" : "var(--border)",
              background: isReady ? "var(--success-soft)" : "var(--bg-elev)",
              transition: "border-color var(--t-med), background var(--t-med)",
            }}>
              <div
                onClick={() => setExpandedId(isOpen ? null : p.id)}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", cursor: "pointer", userSelect: "none" }}
              >
                <ProgressRing pct={pct} size={36} stroke={3} tone={tone} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingId === p.id ? (
                    <input
                      autoFocus
                      className="q-input q-input--sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setEditingId(null); } }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ fontSize: 14, padding: "4px 8px", margin: "-4px 0" }}
                    />
                  ) : (
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <Chip>{typeLbl}</Chip>
                    <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                      {total === 0 ? "no tasks" : `${doneCount}/${total} tasks`}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", color: tone, minWidth: 40, textAlign: "right" }}>{pct}%</span>
                  <span style={{ color: "var(--text-faint)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform var(--t-fast)" }}>
                    <Icon name="chevron" size={14} />
                  </span>
                </div>
              </div>

              {isOpen && (
                <div className="q-fade-in" style={{ borderTop: "1px solid var(--border)", padding: "12px 16px 14px" }}>
                  <ProgressBar pct={pct} tone={tone} height={3} />
                  <ProjectDescField project={p} updateProjectMeta={updateProjectMeta} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 12 }}>
                    {children.map(t => (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 4px", borderRadius: "var(--r-sm)" }}>
                        <Checkbox checked={t.completed} onChange={() => t.completed ? uncompleteTask(t.id) : completeTask(t.id)} />
                        <span style={{
                          flex: 1, fontSize: 13,
                          color: t.completed ? "var(--text-faint)" : "var(--text)",
                          textDecoration: t.completed ? "line-through" : "none",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{t.title}</span>
                        <span style={{
                          fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-faint)",
                        }}>{t.xp} XP</span>
                        <button className="q-icon-btn" onClick={() => removeChildFromProject(t.id)} title="Detach from project" aria-label="Detach">
                          <Icon name="close" size={11} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {addingTaskTo === p.id ? (
                    <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <input
                        ref={taskInputRef}
                        className="q-input q-input--sm"
                        placeholder="Task name"
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") submitTask(p.id); if (e.key === "Escape") { setAddingTaskTo(null); setNewTaskName(""); } }}
                        style={{ flex: 1, minWidth: 160 }}
                      />
                      <div style={{ display: "flex", gap: 4 }}>
                        {Object.keys(PRIORITIES).map(k => (
                          <ChipChoice key={k} active={newTaskPrio === k} color={PRIORITIES[k].dot} onClick={() => setNewTaskPrio(k)}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: PRIORITIES[k].dot }} /> {PRIORITIES[k].label}
                          </ChipChoice>
                        ))}
                      </div>
                      <button className="q-btn q-btn--primary q-btn--sm" onClick={() => submitTask(p.id)} disabled={!newTaskName.trim()}>Add</button>
                      <button className="q-btn q-btn--ghost q-btn--sm" onClick={() => { setAddingTaskTo(null); setNewTaskName(""); }}>Cancel</button>
                    </div>
                  ) : aiAddingTo === p.id ? (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      <textarea
                        ref={aiInputRef}
                        className="q-textarea"
                        placeholder="Describe the tasks to add — e.g. 'add API hookup and login screen, plus a polish pass at the end'"
                        value={aiQuery}
                        disabled={aiLoading}
                        onChange={(e) => setAiQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submitAiExtend(p); }
                          else if (e.key === "Escape" && !aiLoading) { setAiAddingTo(null); setAiQuery(""); }
                        }}
                        style={{ height: 56, fontSize: 13 }}
                      />
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button
                          className="q-btn q-btn--primary q-btn--sm"
                          onClick={() => submitAiExtend(p)}
                          disabled={!aiQuery.trim() || aiLoading}
                        >
                          {aiLoading ? "Generating…" : "Generate tasks"}
                        </button>
                        <button
                          className="q-btn q-btn--ghost q-btn--sm"
                          onClick={() => { setAiAddingTo(null); setAiQuery(""); }}
                          disabled={aiLoading}
                        >Cancel</button>
                        <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: "auto" }}>
                          The AI sees the project's existing {children.length} task{children.length === 1 ? "" : "s"} for context.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                      <button className="q-btn q-btn--ghost q-btn--sm" onClick={() => { setAddingTaskTo(p.id); setNewTaskName(""); }}>
                        <Icon name="plus" size={11} /> Add task
                      </button>
                      <button className="q-btn q-btn--ghost q-btn--sm" onClick={() => { setAiAddingTo(p.id); setAiQuery(""); }} title="Ask the AI to generate tasks that fit this project">
                        <Icon name="bolt" size={11} /> AI add tasks
                      </button>
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }} title="Project color">
                      {PROJECT_PALETTE.map(c => (
                        <button
                          key={c}
                          onClick={() => updateProjectColor(p.id, c)}
                          aria-label={"Set color " + c}
                          style={{
                            width: 16, height: 16, borderRadius: "50%",
                            background: c,
                            border: projColor === c
                              ? "2px solid var(--text)"
                              : "1px solid var(--border)",
                            cursor: "pointer", padding: 0,
                            transition: "transform var(--t-fast)",
                            transform: projColor === c ? "scale(1.1)" : "none",
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ flex: 1 }} />
                    <button className="q-btn q-btn--ghost q-btn--sm" onClick={() => startRename(p)}>Rename</button>
                    <button className="q-btn q-btn--ghost q-btn--sm" onClick={() => deleteProject(p.id)} style={{ color: "var(--danger)" }}>Delete</button>
                    {isReady && (
                      <button className="q-btn q-btn--success" onClick={() => shipProject(p.id)}>
                        <Icon name="ship" size={13} /> Ship it
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {shipped.length > 0 && (
        <div style={{ marginTop: 32, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
          <button
            className="q-btn q-btn--ghost q-btn--sm"
            style={{ padding: "4px 0", marginBottom: showShipped ? 12 : 0 }}
            onClick={() => setShowShipped(!showShipped)}
          >
            <span style={{ transform: showShipped ? "rotate(180deg)" : "none", transition: "transform var(--t-fast)", display: "inline-flex" }}>
              <Icon name="chevron" size={12} />
            </span>
            <span className="q-eyebrow" style={{ marginLeft: 4 }}>Shipped</span>
            <Chip kind="success" style={{ marginLeft: 6 }}>{shipped.length}</Chip>
          </button>
          {showShipped && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {shipped.map(p => {
                const typeLbl = PROJECT_TYPES.find(t => t.id === p.type)?.label || "Other";
                return (
                  <div key={p.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px",
                    background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: "var(--r-md)",
                  }}>
                    <Icon name="check" size={13} />
                    <span style={{
                      fontSize: 13, color: "var(--text-muted)", flex: 1,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{p.title}</span>
                    <Chip>{typeLbl}</Chip>
                    <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                      {fmtDate(p.shippedAt || p.completedAt)}
                    </span>
                    <button className="q-icon-btn" onClick={() => unshipProject(p.id)} title="Move back to active" aria-label="Unship">
                      <Icon name="chevronR" size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───── PLANNER VIEW ───── */

function PlannerView({ tasks, tasksById, projects, projectsMap, weekPlan, setWeekPlan, completeTask, uncompleteTask, completeDailyOn, uncompleteDailyOn, toggleChunkDone, pinTaskToDate, updateTask, deleteTask, toggleSub, splitTask, notify, dayLocks, toggleDayLock, customTags = [], addCustomTag = null, dayStartHour = 0 }) {
  const [loading, setLoading] = useState(false);
  const [loadMode, setLoadMode] = useState(null); // "fresh" | "append" | "optimize"
  const [caps, setCaps] = useState(DEFAULT_CAPS);
  const [editingCap, setEditingCap] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [draggedFrom, setDraggedFrom] = useState(null);
  const [replanText, setReplanText] = useState("");
  const [replanLoading, setReplanLoading] = useState(false);
  const [dragOver, setDragOver] = useState(null);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  // Holds the pre-replan snapshot so the user can revert if the AI made a
  // mess. Cleared on dismiss or after the next non-undo plan change.
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  // Schedule-with-instructions form state. When open, the user can give
  // free-text guidance to the append run ("spread over 2 weeks", etc.).
  const [scheduleFormOpen, setScheduleFormOpen] = useState(false);
  const [scheduleInstruction, setScheduleInstruction] = useState("");
  // Currently-edited task — opens TaskForm in a modal-ish card.
  const [editing, setEditing] = useState(null);
  const handleUpdate = (d) => updateTask
    ? updateTask(editing.id, d).then(() => setEditing(null))
    : setEditing(null);

  useEffect(() => { loadKV(KEYS.caps, DEFAULT_CAPS).then(c => setCaps({ ...DEFAULT_CAPS, ...c })); }, []);

  const tName = todayName();
  const todayMonday = useMemo(() => mondayOf(new Date()), []);
  const weekOffset = Math.round((weekStart - todayMonday) / 86400000 / 7);
  const canPrev = weekOffset > -52;
  const canNext = weekOffset <  52;

  const allPending     = tasks.filter(t => !t.completed);
  // All daily tasks (completed-today included so they stay visible in the
  // grid; processRecurring re-opens them on the next calendar day).
  const dailyAll       = tasks.filter(t => t.recurring === "daily");
  const dailyPending   = dailyAll;  // alias
  const nonDailyPending = allPending.filter(t => t.recurring !== "daily");
  const dailyHours = dailyAll.reduce((s,t) => s + (taskHours(t)), 0);
  const totalH = nonDailyPending.reduce((s,t) => s + (taskHours(t)), 0);

  const scheduledIds = new Set((weekPlan || []).flatMap(e => (e.items || []).map(i => i.taskId)));
  const unscheduledCount = nonDailyPending.filter(t => !scheduledIds.has(t.id)).length;
  const hasPlan = Array.isArray(weekPlan) && weekPlan.length > 0;

  const updateCap = (day, val) => {
    const raw = parseFloat(val);
    const v = isNaN(raw) ? 0 : Math.max(0, Math.min(10, raw));
    const next = { ...caps, [day]: v };
    setCaps(next); saveKV(KEYS.caps, next);
  };

  const lockedDateSet = useMemo(
    () => new Set(Object.keys(dayLocks || {}).filter(k => dayLocks[k])),
    [dayLocks]
  );

  const runPlan = (mode, instruction = "") => {
    setLoading(true); setLoadMode(mode);
    // Snapshot before any plan-modifying call so we can revert if it's bad.
    const snapshot = weekPlan ? JSON.parse(JSON.stringify(weekPlan)) : [];
    const aiOpts = { mode, existingPlan: weekPlan || [], lockedDates: lockedDateSet, projects };
    if (instruction && instruction.trim()) aiOpts.instruction = instruction.trim();
    aiPlanWeek(tasks, caps, aiOpts).then(p => {
      if (p != null) {
        setWeekPlan(p); saveKV(KEYS.weekplan, p);
        if (mode === "optimize" || (instruction && instruction.trim())) {
          setUndoSnapshot(snapshot);
        }
      }
      setLoading(false); setLoadMode(null);
    });
  };

  const runReplan = () => {
    const instruction = replanText.trim();
    if (!instruction || replanLoading) return;
    setReplanLoading(true);
    const snapshot = weekPlan ? JSON.parse(JSON.stringify(weekPlan)) : [];
    aiPlanWeek(tasks, caps, { mode: "replan", existingPlan: weekPlan || [], instruction, lockedDates: lockedDateSet, projects }).then(p => {
      setReplanLoading(false);
      if (p == null) {
        if (notify) notify("Couldn't apply that — try rephrasing");
        return;
      }
      setWeekPlan(p);
      saveKV(KEYS.weekplan, p);
      setUndoSnapshot(snapshot);
      setReplanText("");
      if (notify) notify("Plan updated");
    }).catch(e => {
      console.error("Replan error:", e);
      setReplanLoading(false);
      if (notify) notify("Replan failed — check the console");
    });
  };

  const undoReplan = () => {
    if (!undoSnapshot) return;
    setWeekPlan(undoSnapshot);
    saveKV(KEYS.weekplan, undoSnapshot);
    setUndoSnapshot(null);
    if (notify) notify("Plan restored");
  };

  // Move a specific item-chunk from sourceIso to targetIso. If sourceIso is
  // null, behaves like the legacy moveTask (removes the taskId from every
  // day and places it on the target). When sourceIso is provided (drag from
  // a specific day), only that one chunk moves — sibling splits stay put.
  const moveTask = (taskId, targetIso, sourceIso = null) => {
    const current = Array.isArray(weekPlan) ? weekPlan : [];
    let movedItem = null;
    const stripped = current.map(entry => {
      const matchesSource = sourceIso == null ? true : entry.date === sourceIso;
      if (!matchesSource) return entry;
      const before = entry.items || [];
      const out = [];
      for (const it of before) {
        if (it.taskId === taskId && !movedItem) movedItem = it;
        else out.push(it);
      }
      return { ...entry, items: out };
    }).filter(entry => (entry.items || []).length > 0 || entry.date === targetIso);

    const item = movedItem || { taskId };
    let found = false;
    const updated = stripped.map(entry => {
      if (entry.date === targetIso) {
        found = true;
        const has = (entry.items || []).some(x => x.taskId === item.taskId);
        if (!has) return { ...entry, items: [...(entry.items || []), item] };
      }
      return entry;
    });
    if (!found) updated.push({ date: targetIso, items: [item] });
    updated.sort((a, b) => a.date.localeCompare(b.date));
    setWeekPlan(updated); saveKV(KEYS.weekplan, updated);
  };

  // 4 weeks rolling: [weekStart, +1, +2, +3] x 7 days = 28 day cells.
  const weeks = useMemo(() => {
    const out = [];
    for (let w = 0; w < 4; w++) {
      const wkStart = addDays(weekStart, w * 7);
      const days = [];
      for (let i = 0; i < 7; i++) days.push(addDays(wkStart, i));
      out.push({ start: wkStart, days });
    }
    return out;
  }, [weekStart]);

  // Split lookup: taskId -> [{date, item}, ...] sorted by date.
  const splitMap = useMemo(() => {
    const map = new Map();
    for (const entry of (weekPlan || [])) {
      for (const item of (entry.items || [])) {
        if (!map.has(item.taskId)) map.set(item.taskId, []);
        map.get(item.taskId).push({ date: entry.date, item });
      }
    }
    for (const arr of map.values()) arr.sort((a, b) => a.date.localeCompare(b.date));
    return map;
  }, [weekPlan]);

  const todayIso = effectiveTodayIso(dayStartHour);

  return (
    <div className="q-view-pad" style={{ padding: VIEW_PAD, maxWidth: 1080, margin: "0 auto" }}>
      {editing && (
        <div style={{ marginBottom: 18 }}>
          <TaskForm
            initial={editing}
            isEdit
            initialScheduledDate={getTaskScheduledDate(editing.id, weekPlan)}
            onSave={handleUpdate}
            onCancel={() => setEditing(null)}
            customTags={customTags}
            onAddCustomTag={addCustomTag}
            lockedFields={getTaskChunks(editing.id, weekPlan).length > 1 ? ["hours", "xp", "scheduleDate"] : null}
            projects={projects}
          />
        </div>
      )}
      <MissedWork
        tasks={tasks} weekPlan={weekPlan} setWeekPlan={setWeekPlan}
        projectsMap={projectsMap} toggleChunkDone={toggleChunkDone}
        pinTaskToDate={pinTaskToDate} notify={notify}
        dayStartHour={dayStartHour}
      />
      <PageHeader
        eyebrow="AI scheduler"
        title="Plan"
        sub={`${nonDailyPending.length} pending · ~${totalH.toFixed(1)}h work${unscheduledCount > 0 ? ` · ${unscheduledCount} unscheduled` : ""}${dailyPending.length ? ` · ${dailyPending.length} daily (${dailyHours.toFixed(1)}h/day)` : ""}`}
        right={
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {!hasPlan && (
              <button className="q-btn q-btn--primary" disabled={loading || allPending.length === 0} onClick={() => runPlan("fresh")}>
                {loading ? "Planning…" : "Generate plan"}
              </button>
            )}
            {hasPlan && unscheduledCount > 0 && (
              <div style={{ display: "inline-flex", alignItems: "stretch", borderRadius: "var(--r-md)", overflow: "hidden", boxShadow: "0 0 0 1px var(--accent)" }}>
                <button
                  className="q-btn q-btn--primary"
                  disabled={loading}
                  onClick={() => runPlan("append")}
                  title="Schedule unscheduled tasks earliest-first"
                  style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0, boxShadow: "none" }}
                >
                  {loading && loadMode === "append" ? "Scheduling…" : `Schedule ${unscheduledCount} pending`}
                </button>
                <button
                  className="q-btn q-btn--primary"
                  disabled={loading}
                  onClick={() => setScheduleFormOpen(v => !v)}
                  title="Schedule with custom instructions"
                  aria-label="Schedule with instructions"
                  aria-expanded={scheduleFormOpen}
                  style={{
                    borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
                    borderLeft: "1px solid rgba(0,0,0,0.2)",
                    padding: "0 8px", boxShadow: "none",
                  }}
                >
                  <span style={{
                    display: "inline-block",
                    transform: scheduleFormOpen ? "rotate(180deg)" : "none",
                    transition: "transform var(--t-fast)",
                  }}>
                    <Icon name="chevron" size={12} />
                  </span>
                </button>
              </div>
            )}
            {hasPlan && (
              <button className="q-btn q-btn--outline" disabled={loading} onClick={() => runPlan("optimize")} title="Replan everything from scratch — may move existing tasks">
                {loading && loadMode === "optimize" ? "Optimizing…" : "Optimize all"}
              </button>
            )}
          </div>
        }
      />

      {scheduleFormOpen && hasPlan && unscheduledCount > 0 && (
        <div className="q-card q-fade-in" style={{ padding: 14, marginBottom: 18, borderColor: "var(--accent)" }}>
          <Eyebrow>Schedule with instructions</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <textarea
              autoFocus
              className="q-textarea"
              value={scheduleInstruction}
              disabled={loading}
              onChange={(e) => setScheduleInstruction(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  runPlan("append", scheduleInstruction);
                  setScheduleFormOpen(false);
                  setScheduleInstruction("");
                } else if (e.key === "Escape") {
                  setScheduleFormOpen(false);
                }
              }}
              placeholder="e.g. spread over the next 2 weeks · alternate IGP tasks with other work · finish by Friday"
              style={{ height: 60, fontSize: 13 }}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                className="q-btn q-btn--primary q-btn--sm"
                disabled={loading}
                onClick={() => {
                  runPlan("append", scheduleInstruction);
                  setScheduleFormOpen(false);
                  setScheduleInstruction("");
                }}
              >
                {loading && loadMode === "append"
                  ? "Scheduling…"
                  : scheduleInstruction.trim()
                    ? `Schedule with this instruction`
                    : `Schedule ${unscheduledCount} pending`}
              </button>
              <button
                className="q-btn q-btn--ghost q-btn--sm"
                onClick={() => { setScheduleFormOpen(false); setScheduleInstruction(""); }}
                disabled={loading}
              >Cancel</button>
              <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: "auto", fontFamily: "var(--font-mono)" }}>
                Empty = default (earliest first). ⌘↵ to submit.
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="q-card" style={{ padding: 14, marginBottom: 18 }}>
        <Eyebrow>Daily capacity — click to edit. Set Sat / Sun to schedule weekends.</Eyebrow>
        <div className="q-planner-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 10 }}>
          {WEEK_ALL.map(day => {
            const isToday = day === tName;
            const val = caps[day] != null ? caps[day] : (day === "Saturday" || day === "Sunday" ? 0 : 4);
            const isEditing = editingCap === day;
            const isOff = val === 0;
            const barTone = isOff ? "var(--border-strong)" : val <= 2 ? "var(--danger)" : val <= 4 ? "var(--warning)" : "var(--success)";
            return (
              <div key={day} style={{ textAlign: "center", opacity: isOff ? 0.6 : 1 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 600, color: isToday ? "var(--accent)" : "var(--text-muted)" }}>{day.slice(0, 3)}</div>
                {isEditing ? (
                  <input
                    type="number" min="0" max="10" step="0.5" defaultValue={val} autoFocus
                    onBlur={(e) => { updateCap(day, e.target.value); setEditingCap(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { updateCap(day, e.target.value); setEditingCap(null); } }}
                    className="q-input q-input--sm"
                    style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 500 }}
                  />
                ) : (
                  <button
                    onClick={() => setEditingCap(day)}
                    className="q-btn q-btn--outline q-btn--sm"
                    style={{ width: "100%", justifyContent: "center", fontFamily: "var(--font-mono)", color: isOff ? "var(--text-faint)" : "var(--text)" }}
                  >{isOff ? "off" : `${val}h`}</button>
                )}
                <div style={{ marginTop: 6 }}><ProgressBar pct={isOff ? 0 : (val / 8) * 100} tone={barTone} height={3} /></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Week navigator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* Jump back 4 weeks — page-scrolls past the 4 weeks currently visible. */}
          <button
            className="q-icon-btn"
            disabled={!canPrev}
            onClick={() => canPrev && setWeekStart(addDays(weekStart, -28))}
            aria-label="Previous 4 weeks"
            title="Back 4 weeks"
            style={{ padding: 6, opacity: canPrev ? 1 : 0.3, display: "inline-flex", alignItems: "center", gap: -4 }}
          >
            <Icon name="chevron" size={12} />
            <span style={{ marginLeft: -8, display: "inline-flex" }}><Icon name="chevron" size={12} /></span>
          </button>
          <button
            className="q-icon-btn"
            disabled={!canPrev}
            onClick={() => canPrev && setWeekStart(addDays(weekStart, -7))}
            aria-label="Previous week"
            title="Back 1 week"
            style={{ padding: 6, opacity: canPrev ? 1 : 0.3 }}
          >
            <Icon name="chevron" size={14} />
          </button>
          <button
            className="q-btn q-btn--ghost q-btn--sm"
            onClick={() => setWeekStart(todayMonday)}
            disabled={weekOffset === 0}
          >
            This week
          </button>
          <button
            className="q-icon-btn"
            disabled={!canNext}
            onClick={() => canNext && setWeekStart(addDays(weekStart, 7))}
            aria-label="Next week"
            title="Forward 1 week"
            style={{ padding: 6, opacity: canNext ? 1 : 0.3 }}
          >
            <Icon name="chevronR" size={14} />
          </button>
          {/* Jump forward 4 weeks. */}
          <button
            className="q-icon-btn"
            disabled={!canNext}
            onClick={() => canNext && setWeekStart(addDays(weekStart, 28))}
            aria-label="Next 4 weeks"
            title="Forward 4 weeks"
            style={{ padding: 6, opacity: canNext ? 1 : 0.3, display: "inline-flex", alignItems: "center" }}
          >
            <Icon name="chevronR" size={12} />
            <span style={{ marginLeft: -8, display: "inline-flex" }}><Icon name="chevronR" size={12} /></span>
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.005em" }}>
            {fmtWeekLabel(weekStart)}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
            {weekOffset === 0 ? "current" : weekOffset > 0 ? `+${weekOffset}w` : `${weekOffset}w`}
          </span>
        </div>
      </div>

      {!hasPlan && weekOffset === 0 ? (
        <EmptyState dashed>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>No plan yet</div>
          <div>Click <strong>Generate plan</strong> to auto-schedule, or drag tasks onto specific days. Navigate forward to plan further into the year.</div>
        </EmptyState>
      ) : (
        <div>
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="q-planner-week">
              {week.days.map((dateObj) => {
                const iso = isoDate(dateObj);
                const wd = weekdayName(dateObj);
                const data = (weekPlan || []).find(d => d.date === iso) || { items: [] };
                const items = data.items || [];
                const isToday = iso === todayIso;
                const isPast = iso < todayIso;
                const cap = caps[wd] != null ? caps[wd] : 4;
                const isOff = cap === 0;

                const dayScheduledH = items.reduce((s, it) => {
                  const t = tasksById.get(it.taskId);
                  if (!t || t.recurring === "daily") return s;
                  return s + (it.hours != null ? it.hours : (taskHours(t)));
                }, 0);
                const dayH = dayScheduledH + dailyHours;
                const loadPct = isOff ? 0 : (cap > 0 ? Math.min(Math.round((dayH / cap) * 100), 100) : 0);
                const loadColor = loadPct > 90 ? "var(--danger)" : loadPct > 65 ? "var(--warning)" : "var(--success)";
                const dayXP = items.reduce((s, it) => {
                  const t = tasksById.get(it.taskId);
                  if (!t) return s;
                  // Per-chunk XP share so split tasks don't inflate the
                  // total — same math as toggleChunkDone.
                  const allChunks = (weekPlan || []).flatMap(e => (e.items || []).filter(i => i.taskId === it.taskId));
                  const totalH = allChunks.reduce((sm, x) => sm + (x.hours != null ? x.hours : taskHours(t)), 0) || taskHours(t);
                  const myH = it.hours != null ? it.hours : taskHours(t);
                  return s + (allChunks.length > 1
                    ? Math.max(1, Math.round((t.xp || 0) * myH / totalH))
                    : (t.xp || 0));
                }, 0) + dailyPending.reduce((s, t) => s + (t.xp || 0), 0);
                const isDragOver = dragOver === iso;

                const isLocked = !!(dayLocks && dayLocks[iso]);

                return (
                  <div key={iso} className={"q-planner-day" + (isLocked ? " q-planner-day--locked" : "")}
                    onDragOver={(e) => {
                      if (isLocked) return;
                      e.preventDefault(); setDragOver(iso);
                    }}
                    onDragLeave={() => { if (dragOver === iso) setDragOver(null); }}
                    onDrop={(e) => {
                      if (isLocked) {
                        if (notify) notify("That day is locked");
                        setDraggedId(null); setDraggedFrom(null); setDragOver(null);
                        return;
                      }
                      e.preventDefault();
                      if (draggedId) moveTask(draggedId, iso, draggedFrom);
                      setDraggedId(null); setDraggedFrom(null); setDragOver(null);
                    }}
                    style={{
                      borderColor: isDragOver ? "var(--accent)" : isToday && !isLocked ? "var(--accent)" : "var(--border)",
                      background: isDragOver ? "var(--accent-soft)" : isLocked ? "var(--bg)" : "var(--bg-elev)",
                      opacity: isOff && items.length === 0 && dailyPending.length === 0
                        ? 0.45
                        : (isPast && items.length === 0 && dailyPending.length === 0 ? 0.5 : 1),
                    }}
                  >
                    <div className="q-planner-day-head">
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: isToday ? "var(--accent)" : "var(--text)" }}>{wd.slice(0, 3)}</span>
                        <span style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>{dateObj.getDate()}</span>
                        {isOff && <span style={{ fontSize: 9, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>off</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {!isOff && dayH > 0 && (
                          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 500, color: loadColor }}>
                            {dayH.toFixed(1)}/{cap}h
                          </span>
                        )}
                        <button
                          className={"q-planner-lock" + (isLocked ? " is-locked" : "")}
                          onClick={(e) => { e.stopPropagation(); toggleDayLock(iso); }}
                          title={isLocked ? "Locked — click to unlock" : "Lock day (planner will skip it)"}
                          aria-label={isLocked ? "Unlock day" : "Lock day"}
                          aria-pressed={isLocked}
                        >
                          <Icon name={isLocked ? "lock" : "unlock"} size={11} />
                        </button>
                      </div>
                    </div>
                    {!isOff && dayH > 0 && <div style={{ margin: "0 0 8px" }}><ProgressBar pct={loadPct} tone={loadColor} height={3} /></div>}
                    {dailyPending.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8, paddingBottom: 8, borderBottom: "1px dashed var(--border)" }}>
                        {dailyPending.map((t, i) => {
                          // Per-day state from the dailyCompletions history.
                          // Past + today are toggleable; future days only
                          // show the "this happens every day" indicator
                          // since marking a day done in the future doesn't
                          // make sense.
                          const isDoneOnDate = isDailyCompletedOn(t, iso);
                          const allowToggle = iso <= todayIso && completeDailyOn && uncompleteDailyOn;
                          const proj = t.projectId && projectsMap ? projectsMap[t.projectId] : null;
                          return (
                            <div key={"d-"+i}
                              className="q-planner-item q-planner-item--daily"
                              onClick={() => setEditing(t)}
                              title="Click to edit"
                              style={{
                                borderLeft: "2px solid " + (proj?.color || DIFFICULTY[t.difficulty]?.tone || "var(--info)"),
                                color: isDoneOnDate ? "var(--text-faint)" : "var(--text-muted)",
                                textDecoration: isDoneOnDate ? "line-through" : "none",
                                cursor: "pointer",
                              }}>
                              {allowToggle ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isDoneOnDate) uncompleteDailyOn(t.id, iso);
                                    else completeDailyOn(t.id, iso);
                                  }}
                                  title={isDoneOnDate
                                    ? (isToday ? "Mark today as not done" : "Remove from this day")
                                    : (isToday ? "Complete daily for today" : "Log as done for this day")}
                                  aria-label={isDoneOnDate ? "Reopen daily task on this day" : "Complete daily task on this day"}
                                  style={{
                                    width: 13, height: 13, borderRadius: "50%",
                                    border: "1.5px solid " + (isDoneOnDate ? "var(--success)" : "var(--border-strong)"),
                                    background: isDoneOnDate ? "var(--success)" : "transparent",
                                    cursor: "pointer", padding: 0, flexShrink: 0,
                                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                                    transition: "border-color var(--t-fast), background var(--t-fast)",
                                  }}
                                >
                                  {isDoneOnDate && (
                                    <svg width="7" height="7" viewBox="0 0 12 12" aria-hidden>
                                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                    </svg>
                                  )}
                                </button>
                              ) : (
                                <Icon name="recur" size={9} />
                              )}
                              <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, minHeight: items.length === 0 ? 24 : 0 }}>
                      {items.length === 0 ? (
                        <div style={{ fontSize: 10, color: "var(--text-faint)", fontStyle: "italic", paddingTop: 2 }}>
                          {dailyPending.length > 0 ? "" : (isOff ? "" : "Free")}
                        </div>
                      ) : items.map((it) => {
                        const t = tasksById.get(it.taskId);
                        if (!t) return null;
                        const splits = splitMap.get(t.id) || [];
                        const isSplit = splits.length > 1;
                        const splitIdx = splits.findIndex(x => x.date === iso);
                        const itemHours = it.hours != null ? it.hours : taskHours(t);
                        const itemNote = it.note;
                        const chunkDone = !!(it.done || t.completed);
                        const project = t.projectId && projectsMap ? projectsMap[t.projectId] : null;
                        // Faint project tint behind the card so you can scan
                        // which projects are in play at a glance. 8-digit hex
                        // alpha (~10% opacity) keeps text legibility intact.
                        const tintHex = project?.color ? `${project.color}1A` : null;
                        const baseBg = chunkDone ? "var(--bg-soft)" : "var(--bg-elev)";
                        const itemBg = tintHex && !chunkDone
                          ? `linear-gradient(${tintHex}, ${tintHex}), ${baseBg}`
                          : baseBg;
                        return (
                          <div key={it.taskId}
                            className="q-planner-item"
                            draggable={!chunkDone}
                            onDragStart={(e) => { setDraggedId(t.id); setDraggedFrom(iso); e.dataTransfer.effectAllowed = "move"; }}
                            onDragEnd={() => { setDraggedId(null); setDraggedFrom(null); setDragOver(null); }}
                            onClick={(e) => {
                              // The complete button already stops propagation.
                              // Drag suppresses click at the browser level, so
                              // this only fires on real clicks.
                              setEditing(t);
                            }}
                            title="Click to edit, drag to move"
                            style={{
                              background: itemBg,
                              border: "1px solid var(--border)",
                              borderLeft: "2px solid " + (chunkDone ? "var(--border)" : (project?.color || DIFFICULTY[t.difficulty]?.tone || "var(--info)")),
                              color: chunkDone ? "var(--text-faint)" : "var(--text)",
                              opacity: chunkDone ? 0.6 : (draggedId === t.id && draggedFrom === iso ? 0.35 : 1),
                              cursor: chunkDone ? "pointer" : "grab",
                            }}
                          >
                            <div className="q-planner-item-head">
                              <CompleteButton
                                done={chunkDone}
                                tone={DIFFICULTY[t.difficulty]?.tone}
                                onComplete={() => toggleChunkDone(iso, t.id, true)}
                                onReopen={() => toggleChunkDone(iso, t.id, false)}
                              />
                              <span className="q-planner-item-title" style={{
                                textDecoration: chunkDone ? "line-through" : "none",
                              }}>{t.title}</span>
                              {isSplit && (
                                <span className="q-planner-item-part">{splitIdx + 1}/{splits.length}</span>
                              )}
                            </div>
                            {project && (
                              <div className="q-planner-item-project" title={project.title} style={{
                                fontSize: 10,
                                color: chunkDone ? "var(--text-faint)" : (project.color || "var(--text-faint)"),
                                fontFamily: "var(--font-mono)",
                                marginTop: 2,
                                marginLeft: 19,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                              }}>
                                <span style={{
                                  width: 5, height: 5, borderRadius: "50%",
                                  background: project.color || "var(--text-faint)",
                                  flexShrink: 0, opacity: chunkDone ? 0.4 : 1,
                                }} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{project.title}</span>
                              </div>
                            )}
                            {isSplit && itemNote && (
                              <div className="q-planner-item-note">{itemNote}</div>
                            )}
                            <div className="q-planner-item-meta">
                              {(() => {
                                if (!isSplit) return `${t.xp} XP · ${itemHours}h`;
                                const totalH = splits.reduce((s, x) => s + (x.item.hours != null ? x.item.hours : taskHours(t)), 0) || taskHours(t);
                                const chunkXp = Math.max(1, Math.round((t.xp || 0) * itemHours / totalH));
                                return `${chunkXp} XP · ${itemHours}h (chunk)`;
                              })()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {dayXP > 0 && <div style={{ marginTop: 8, fontSize: 9, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>{dayXP} XP</div>}
                  </div>
                );
              })}
            </div>
          ))}

          {hasPlan && (
            <>
              <div className="q-replan-bar q-fade-in">
                <span className="q-replan-prefix">
                  <Icon name="bolt" size={12} /> Ask
                </span>
                <input
                  value={replanText}
                  disabled={replanLoading}
                  onChange={(e) => setReplanText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); runReplan(); }
                    else if (e.key === "Escape") setReplanText("");
                  }}
                  placeholder={replanLoading
                    ? "Rearranging…"
                    : "Spread Acme project over 3 months, push audit to next week…"}
                  aria-label="Replan instruction"
                />
                <button
                  className="q-btn q-btn--primary q-btn--sm"
                  disabled={!replanText.trim() || replanLoading}
                  onClick={runReplan}
                >
                  {replanLoading ? "Replanning…" : "Replan"}
                </button>
              </div>
              {!replanText && !replanLoading && (
                <div style={{
                  display: "flex", gap: 5, flexWrap: "wrap",
                  marginTop: 6, paddingLeft: 4,
                  fontSize: 10, color: "var(--text-faint)",
                }}>
                  <span style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 2 }}>Try</span>
                  {[
                    "Spread the IGP tasks over next 2 weeks",
                    "Push everything past Friday",
                    "Move client work to next month",
                    "Move design tasks earlier",
                  ].map(ex => (
                    <button
                      key={ex}
                      onClick={() => setReplanText(ex)}
                      style={{
                        fontSize: 10, fontFamily: "var(--font-mono)",
                        padding: "2px 6px", borderRadius: 3,
                        background: "transparent",
                        border: "1px solid var(--border)",
                        color: "var(--text-faint)",
                        cursor: "pointer",
                      }}
                      title={`Use this as the replan instruction`}
                    >{ex}</button>
                  ))}
                </div>
              )}
            </>
          )}

          {undoSnapshot && (
            <div className="q-fade-in" style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 14px", marginTop: 8,
              background: "var(--bg-elev)",
              border: "1px dashed var(--border-strong)",
              borderRadius: "var(--r-md)",
              fontSize: 12, color: "var(--text-muted)",
            }}>
              <Icon name="bolt" size={12} />
              <span style={{ flex: 1 }}>Plan changed — not what you wanted?</span>
              <button className="q-btn q-btn--ghost q-btn--sm" onClick={undoReplan}>
                Undo
              </button>
              <button
                className="q-icon-btn"
                onClick={() => setUndoSnapshot(null)}
                aria-label="Dismiss undo"
                title="Dismiss"
              ><Icon name="close" size={11} /></button>
            </div>
          )}

          <div style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "center", marginTop: 14 }}>
            Hover a day to expand it · Drag scheduled tasks between days · Splits move chunk-by-chunk
          </div>
        </div>
      )}
    </div>
  );
}

/* ───── HABITS VIEW ───── */

function HabitsView({ dayStartHour = 0 }) {
  const [log, setLog] = useState({});
  const [mobileInput, setMobileInput] = useState("");
  const [editingCounter, setEditingCounter] = useState(null);
  const [counterDraft, setCounterDraft] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => { loadKV(KEYS.screen, {}).then(d => { setLog(d); setReady(true); }); }, []);

  const today = effectiveTodayIso(dayStartHour);
  const entry = log[today] || { xOpens: 0, ytOpens: 0, mobileHours: null };
  const patch = (obj) => {
    const next = { ...log, [today]: { ...entry, ...obj } };
    setLog(next); saveKV(KEYS.screen, next);
  };

  const days7 = [];
  for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - 6 + i); days7.push(d.toISOString().slice(0,10)); }

  const maxOpens = Math.max(1, days7.reduce((m,k) => Math.max(m, (log[k] ? (log[k].xOpens||0)+(log[k].ytOpens||0) : 0)), 0));
  const maxMobile = Math.max(1, days7.reduce((m,k) => Math.max(m, log[k] ? (log[k].mobileHours||0) : 0), 0));
  const totalX7 = days7.reduce((s,k) => s + (log[k] ? (log[k].xOpens||0) : 0), 0);
  const totalYT7 = days7.reduce((s,k) => s + (log[k] ? (log[k].ytOpens||0) : 0), 0);
  const mVals = days7.filter(k => log[k] && log[k].mobileHours != null).map(k => log[k].mobileHours);
  const avgMobile = mVals.length ? (mVals.reduce((s,v) => s+v, 0) / mVals.length).toFixed(1) : "—";

  if (!ready) return <div style={{ padding: VIEW_PAD, color: "var(--text-faint)", fontSize: 13 }}>Loading…</div>;

  return (
    <div className="q-view-pad" style={{ padding: VIEW_PAD, maxWidth: 720, margin: "0 auto" }}>
      <PageHeader eyebrow="Awareness" title="Screen log" sub="Manual log. Awareness is the point." />

      <div className="q-card" style={{ padding: 18, marginBottom: 16 }}>
        <Eyebrow>Today</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          {[
            { label: "X / Twitter opens", key: "xOpens" },
            { label: "YouTube opens",     key: "ytOpens" },
          ].map(item => {
            const count = entry[item.key] || 0;
            const isEditing = editingCounter === item.key;
            const commit = () => {
              const n = Math.max(0, Math.min(999, parseInt(counterDraft, 10) || 0));
              patch({ [item.key]: n });
              setEditingCounter(null); setCounterDraft("");
            };
            return (
              <div key={item.key} style={{ background: "var(--bg-soft)", borderRadius: "var(--r-md)", padding: "16px 18px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 8 }}>{item.label}</div>
                {isEditing ? (
                  <input
                    type="number" min="0" max="999" autoFocus
                    value={counterDraft}
                    onChange={(e) => setCounterDraft(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commit();
                      else if (e.key === "Escape") { setEditingCounter(null); setCounterDraft(""); }
                    }}
                    className="q-input"
                    style={{
                      fontSize: 32, fontWeight: 600, fontFamily: "var(--font-mono)",
                      textAlign: "center", padding: "0 8px",
                      lineHeight: 1, height: 40, marginBottom: 14,
                    }}
                  />
                ) : (
                  <button
                    onClick={() => { setCounterDraft(String(count)); setEditingCounter(item.key); }}
                    title="Click to set"
                    style={{
                      display: "block", width: "100%", margin: "0 0 14px",
                      background: "transparent", border: "none", padding: 0,
                      fontSize: 32, fontWeight: 600, fontFamily: "var(--font-mono)",
                      color: "var(--text)", lineHeight: 1, cursor: "pointer",
                    }}
                  >{count}</button>
                )}
                <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                  <button className="q-btn q-btn--primary q-btn--sm" onClick={() => { patch({ [item.key]: count + 1 }); }}>+1</button>
                  {count > 0 && <button className="q-btn q-btn--outline q-btn--sm" onClick={() => { patch({ [item.key]: Math.max(0, count - 1) }); }}>−</button>}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ background: "var(--bg-soft)", borderRadius: "var(--r-md)", padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Mobile screen time (hours)</div>
            {entry.mobileHours != null && <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--accent)" }}>{entry.mobileHours}h logged</span>}
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <input
              type="number" min="0" max="24" step="0.5" placeholder="e.g. 2.5"
              value={mobileInput}
              onChange={(e) => setMobileInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && mobileInput) { patch({ mobileHours: parseFloat(mobileInput) || 0 }); setMobileInput(""); } }}
              className="q-input q-input--sm"
              style={{ flex: 1, fontFamily: "var(--font-mono)" }}
            />
            <button
              className={mobileInput ? "q-btn q-btn--primary q-btn--sm" : "q-btn q-btn--outline q-btn--sm"}
              disabled={!mobileInput}
              onClick={() => { if (mobileInput) { patch({ mobileHours: parseFloat(mobileInput) || 0 }); setMobileInput(""); } }}
            >Log</button>
            {entry.mobileHours != null && <button className="q-btn q-btn--ghost q-btn--sm" onClick={() => patch({ mobileHours: null })}>Clear</button>}
          </div>
        </div>
      </div>

      <div className="q-card" style={{ padding: 18 }}>
        <Eyebrow>7-day summary</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 20 }}>
          {[
            { l: "X opens",    v: totalX7,           tone: "var(--text)" },
            { l: "YT opens",   v: totalYT7,          tone: "var(--text)" },
            { l: "Avg mobile", v: avgMobile + "h",   tone: "var(--accent)" },
          ].map(s => (
            <div key={s.l} style={{ background: "var(--bg-soft)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 4 }}>{s.l}</div>
              <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "var(--font-mono)", color: s.tone }}>{s.v}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 8 }}>Social opens</div>
        <div style={{ display: "flex", gap: 5, alignItems: "flex-end", height: 80 }}>
          {days7.map(k => {
            const e2 = log[k] || { xOpens: 0, ytOpens: 0 };
            const xO = e2.xOpens || 0, ytO = e2.ytOpens || 0, tot = xO + ytO;
            const barH = tot > 0 ? Math.max(6, Math.round((tot / maxOpens) * 64)) : 0;
            const xH = tot > 0 ? Math.round((xO / tot) * barH) : 0;
            const ytH = barH - xH;
            const isT = k === today;
            const lbl = new Date(k + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1);
            return (
              <div key={k} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ fontSize: 9, color: isT ? "var(--text)" : "var(--text-faint)", fontFamily: "var(--font-mono)", minHeight: 14, display: "flex", alignItems: "flex-end" }}>{tot > 0 ? tot : ""}</div>
                <div style={{ width: "100%", height: 56, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  {barH > 0 ? (
                    <div style={{ width: "100%", height: barH, borderRadius: "3px 3px 0 0", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                      {xH > 0 && <div style={{ height: xH, background: "var(--info)" }} />}
                      {ytH > 0 && <div style={{ height: ytH, background: "var(--danger)" }} />}
                    </div>
                  ) : (
                    <div style={{ width: "100%", height: 3, background: "var(--border)", borderRadius: 2 }} />
                  )}
                </div>
                <div style={{ fontSize: 10, fontWeight: isT ? 600 : 400, color: isT ? "var(--text)" : "var(--text-faint)" }}>{lbl}</div>
              </div>
            );
          })}
        </div>
        {days7.some(k => log[k] && log[k].mobileHours != null) && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 8 }}>Mobile hours</div>
            <div style={{ display: "flex", gap: 5, alignItems: "flex-end", height: 52 }}>
              {days7.map(k => {
                const val = log[k] ? log[k].mobileHours : null;
                const barH = val != null ? Math.max(4, Math.round((val / maxMobile) * 40)) : 0;
                const isT = k === today;
                const col = val == null ? "var(--border)" : val <= 2 ? "var(--success)" : val <= 4 ? "var(--warning)" : "var(--danger)";
                return (
                  <div key={k} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", minHeight: 12, display: "flex", alignItems: "flex-end", color: isT ? "var(--text)" : "var(--text-faint)" }}>{val != null ? val : ""}</div>
                    <div style={{ width: "100%", height: 36, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                      <div style={{ width: "100%", height: barH > 0 ? barH : 3, background: col, borderRadius: "3px 3px 0 0" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: "var(--text-faint)", lineHeight: 1.6 }}>
        The goal isn't zero. It's awareness. Log honestly, see the pattern, decide what to change.
      </div>
    </div>
  );
}

/* ───── TROPHIES VIEW ───── */

function TrophiesView({ unlocked, profile }) {
  // Map each numeric-threshold achievement to a (current, target) pair so
  // locked cards can show "8 / 20" instead of just the abstract goal.
  // Streak/XP-day/streak7 use today's profile snapshot. Achievements that
  // don't lend themselves to a count (epic, decompose, speed, clean_day,
  // framer3, project) just show nothing — that's fine.
  const progressFor = (id) => {
    if (!profile) return null;
    switch (id) {
      case "first":   return { cur: profile.completedCount || 0, target: 1 };
      case "five":    return { cur: profile.completedCount || 0, target: 5 };
      case "twenty":  return { cur: profile.completedCount || 0, target: 20 };
      case "streak3": return { cur: profile.streak || 0, target: 3 };
      case "streak7": return { cur: profile.streak || 0, target: 7 };
      case "day100":  return { cur: profile.todayXP || 0, target: 100 };
      case "xp500":   return { cur: profile.totalXP || 0, target: 500 };
      case "xp1000":  return { cur: profile.totalXP || 0, target: 1000 };
      default:        return null;
    }
  };
  return (
    <div className="q-view-pad" style={{ padding: VIEW_PAD, maxWidth: 880, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Progress"
        title="Trophies"
        sub={`${unlocked.length} of ${ACHIEVEMENTS.length} unlocked`}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
        {ACHIEVEMENTS.map(a => {
          const done = unlocked.indexOf(a.id) >= 0;
          const prog = !done ? progressFor(a.id) : null;
          const pct = prog ? Math.min(100, Math.round((prog.cur / prog.target) * 100)) : 0;
          return (
            <div key={a.id} className="q-card" style={{
              padding: 16,
              opacity: done ? 1 : 0.55,
              borderColor: done ? "var(--success)" : "var(--border)",
              background: done ? "var(--success-soft)" : "var(--bg-elev)",
              transition: "all var(--t-med)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <Icon name="trophy" size={16} />
                {done && <Chip kind="success">unlocked</Chip>}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4, color: "var(--text)" }}>{a.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{a.desc}</div>
              {prog && !done && (
                <div style={{ marginTop: 10 }}>
                  <ProgressBar pct={pct} tone="var(--accent)" height={3} />
                  <div style={{
                    marginTop: 4, fontSize: 10, fontFamily: "var(--font-mono)",
                    color: "var(--text-faint)", textAlign: "right",
                  }}>{prog.cur} / {prog.target}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShortcutHelp({ onClose }) {
  const rows = [
    ["N", "New task"],
    ["1 – 6", "Switch view"],
    ["Esc", "Close form / dismiss"],
    ["⌘ ↵", "Submit form"],
    ["?", "Toggle this help"],
  ];
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(28,27,23,0.32)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001,
    }}>
      <div onClick={(e) => e.stopPropagation()} className="q-fade-in" style={{
        background: "var(--bg-elev)", border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-lg)", padding: 24, minWidth: 320,
        boxShadow: "0 12px 40px rgba(28,27,23,0.16)",
      }}>
        <div className="q-eyebrow" style={{ marginBottom: 14 }}>Keyboard</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
              <span style={{ fontSize: 13, color: "var(--text)" }}>{v}</span>
              <span className="q-kbd">{k}</span>
            </div>
          ))}
        </div>
        <button className="q-btn q-btn--outline q-btn--sm" style={{ marginTop: 18, width: "100%" }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

/* ───── WEEKLY PULSE ───── */

function WeeklyPulse({ tasks, weekPlan, onDismiss, dayStartHour = 0 }) {
  const stats = useMemo(() => {
    // Anchor on effective today so the day-rollover hour shifts the week
    // window — a 4am rollover means Mon 03:00 still counts toward Sunday.
    const thisMonday = mondayOf(effectiveToday(dayStartHour));
    const lastWeekStart = addDays(thisMonday, -7);
    const lastWeekEndStr = thisMonday.toDateString();
    const lastWeekDayStrs = new Set();
    for (let i = 0; i < 7; i++) {
      lastWeekDayStrs.add(addDays(lastWeekStart, i).toDateString());
    }
    const activity = buildActivityByDay(tasks, weekPlan, dayStartHour);
    const taskById = new Map(tasks.map(t => [t.id, t]));
    const days = [
      { label: "Mon" }, { label: "Tue" }, { label: "Wed" },
      { label: "Thu" }, { label: "Fri" }, { label: "Sat" }, { label: "Sun" },
    ].map(d => ({ ...d, count: 0, xp: 0 }));
    let total = 0;
    let xpTotal = 0;
    for (const dayStr of lastWeekDayStrs) {
      if (dayStr === lastWeekEndStr) continue;
      const ids = activity.get(dayStr);
      if (!ids || !ids.size) continue;
      const dDate = new Date(dayStr);
      const wd = dDate.getDay();
      const idx = wd === 0 ? 6 : wd - 1;
      for (const id of ids) {
        const xp = taskById.get(id)?.xp || 0;
        days[idx].count += 1;
        days[idx].xp += xp;
        total += 1;
        xpTotal += xp;
      }
    }
    const best = days.reduce((b, d) => d.count > b.count ? d : b, days[0]);
    return { total, xp: xpTotal, days, best };
  }, [tasks, weekPlan, dayStartHour]);

  if (stats.total === 0) return null;
  const maxCount = Math.max(1, ...stats.days.map(d => d.count));

  return (
    <div className="q-pulse-card q-fade-in" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div className="q-eyebrow" style={{ marginBottom: 4 }}>Last week</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>
            {stats.total} shipped · {stats.xp} XP
          </div>
        </div>
        <button className="q-icon-btn" onClick={onDismiss} aria-label="Dismiss weekly pulse"><Icon name="close" size={12} /></button>
      </div>

      <div style={{ display: "flex", gap: 5, alignItems: "flex-end", height: 48 }}>
        {stats.days.slice(0, 7).map((d, i) => {
          const h = d.count > 0 ? Math.max(4, Math.round((d.count / maxCount) * 36)) : 2;
          const isBest = d === stats.best && d.count > 0;
          return (
            <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: "100%", height: 36, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <div style={{
                  width: "100%", height: h,
                  background: isBest ? "var(--accent)" : (d.count > 0 ? "var(--border-strong)" : "var(--border)"),
                  borderRadius: "2px 2px 0 0",
                  transition: "background var(--t-fast)",
                }} />
              </div>
              <span style={{
                fontSize: 9, fontFamily: "var(--font-mono)",
                color: isBest ? "var(--accent-strong)" : "var(--text-faint)",
              }}>{d.label}</span>
            </div>
          );
        })}
      </div>

      {stats.best.count > 1 && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12, lineHeight: 1.5 }}>
          Best day was <span style={{ color: "var(--text)", fontWeight: 500 }}>{stats.best.label}</span> — {stats.best.count} shipped, {stats.best.xp} XP.
        </div>
      )}
    </div>
  );
}

/* ───── END-OF-DAY RITUAL ───── */

function EndOfDayDialog({ tasks, weekPlan, profile, onClose, onCloseDay, dayStartHour = 0 }) {
  const [screen, setScreen] = useState({ xOpens: 0, ytOpens: 0, mobileHours: null });
  const [mobile, setMobile] = useState("");
  const [rollForward, setRollForward] = useState(true);
  useEffect(() => {
    loadKV(KEYS.screen, {}).then(d => {
      setScreen(d[effectiveTodayIso(dayStartHour)] || { xOpens: 0, ytOpens: 0, mobileHours: null });
    });
  }, [dayStartHour]);

  const todayStr = effectiveTodayDateStr(dayStartHour);
  const todayIso = effectiveTodayIso(dayStartHour);
  // Include both fully-completed tasks AND tasks with a chunk done today so
  // the end-of-day recap reflects real activity (not just fully shipped ones).
  const activityToday = buildActivityByDay(tasks, weekPlan, dayStartHour).get(todayStr) || new Set();
  const completedToday = tasks.filter(t => activityToday.has(t.id));
  const xpToday = completedToday.reduce((s, t) => s + (t.xp || 0), 0);
  const todayEntry = (weekPlan || []).find(e => e.date === todayIso);
  const scheduledTomorrow = (todayEntry?.items || [])
    .map(it => tasks.find(t => t.id === it.taskId))
    .filter(t => t && !t.completed);

  const logScreen = () => {
    if (!mobile) return;
    const hrs = parseFloat(mobile) || 0;
    loadKV(KEYS.screen, {}).then(d => {
      const next = { ...d, [effectiveTodayIso(dayStartHour)]: { ...screen, mobileHours: hrs } };
      saveKV(KEYS.screen, next);
      setScreen({ ...screen, mobileHours: hrs });
      setMobile("");
    });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(8,8,12,0.72)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 10004, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="q-card q-fade-in"
        style={{ width: "100%", maxWidth: 440, padding: 24 }}
      >
        <div className="q-eyebrow" style={{ marginBottom: 4 }}>End of day</div>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", marginBottom: 16 }}>
          {completedToday.length > 0 ? "That's a wrap." : "Closing out."}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
          <div style={{ background: "var(--bg-soft)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
            <div className="q-stat-label" style={{ marginBottom: 6 }}>Completed</div>
            <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
              {completedToday.length}
            </div>
          </div>
          <div style={{ background: "var(--bg-soft)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
            <div className="q-stat-label" style={{ marginBottom: 6 }}>XP earned</div>
            <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--accent-strong)" }}>
              {xpToday}
            </div>
          </div>
        </div>

        {completedToday.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div className="q-eyebrow" style={{ marginBottom: 8 }}>Shipped today</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }} className="q-scroll">
              {completedToday.map(t => (
                <div key={t.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 8px", borderRadius: "var(--r-sm)",
                  background: "var(--bg-soft)", fontSize: 12.5,
                }}>
                  <Icon name="check" size={11} />
                  <span style={{ flex: 1, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                  <span style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>+{t.xp}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {scheduledTomorrow.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div className="q-eyebrow">
                Unfinished today · {scheduledTomorrow.length}
              </div>
              <label style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 11.5, color: "var(--text-muted)", cursor: "pointer",
              }}>
                <input
                  type="checkbox"
                  checked={rollForward}
                  onChange={(e) => setRollForward(e.target.checked)}
                  style={{ accentColor: "var(--accent)" }}
                />
                Roll to next working day
              </label>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 110, overflowY: "auto" }} className="q-scroll">
              {scheduledTomorrow.map(t => (
                <div key={t.id} style={{
                  fontSize: 12.5, color: "var(--text-muted)",
                  padding: "4px 8px", borderRadius: "var(--r-sm)",
                  border: "1px dashed var(--border)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{t.title}</div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <div className="q-eyebrow" style={{ marginBottom: 8 }}>Screen time</div>
          {screen.mobileHours != null ? (
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              {screen.mobileHours}h mobile logged · {screen.xOpens || 0} X opens · {screen.ytOpens || 0} YT opens
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="number" min="0" max="24" step="0.5"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && mobile) logScreen(); }}
                placeholder="Mobile hours (optional)"
                className="q-input q-input--sm"
                style={{ flex: 1, fontFamily: "var(--font-mono)" }}
              />
              <button
                className={mobile ? "q-btn q-btn--outline q-btn--sm" : "q-btn q-btn--ghost q-btn--sm"}
                disabled={!mobile} onClick={logScreen}
              >Log</button>
            </div>
          )}
        </div>

        <button
          className="q-btn q-btn--primary"
          style={{ width: "100%" }}
          onClick={() => onCloseDay({ rollForward: rollForward && scheduledTomorrow.length > 0 })}
        >
          <Icon name="moon" size={13} /> Close the day
        </button>
        <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 10, textAlign: "center" }}>
          That's enough for today.
        </div>
      </div>
    </div>
  );
}

/* ───── FOCUS TUNNEL ───── */

function FocusTunnel({ task, nextTask, projectName, onComplete, onExit, onSkip, onSaveTime, dayStartHour = 0 }) {
  const initialMs = effectiveFocusMs(task, dayStartHour);
  const [running, setRunning] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(initialMs);
  const startedAtRef = useRef(null);
  const baseRef = useRef(initialMs);
  const taskIdRef = useRef(task?.id);

  // Re-seed ONLY when the focused task itself changes (advance / skip).
  // Depending on task.focusMs would re-fire on every save we make (since
  // the saved value flows back into the task prop), which would reset
  // baseRef while startedAt stays put — the timer would compound itself
  // and the running flag would flip back to true on every save (breaking
  // pause). The actual focusMs delta is tracked locally in baseRef; we
  // don't need to react to writes we just made ourselves.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const seed = effectiveFocusMs(task, dayStartHour);
    baseRef.current = seed;
    setElapsedMs(seed);
    setRunning(true);
    taskIdRef.current = task?.id;
  }, [task?.id]);

  useEffect(() => {
    if (!running || !task) return;
    startedAtRef.current = Date.now();
    const tickId = setInterval(() => {
      setElapsedMs(baseRef.current + (Date.now() - startedAtRef.current));
    }, 250);
    // Persist every 5s while running so a tab close doesn't lose progress.
    const saveId = setInterval(() => {
      const cur = baseRef.current + (Date.now() - startedAtRef.current);
      if (onSaveTime && taskIdRef.current === task.id) onSaveTime(task.id, cur);
    }, 5000);
    return () => {
      clearInterval(tickId);
      clearInterval(saveId);
      const cur = baseRef.current + (Date.now() - startedAtRef.current);
      baseRef.current = cur;
      if (onSaveTime && taskIdRef.current === task.id) onSaveTime(task.id, cur);
    };
  }, [running, task?.id, onSaveTime]);

  useEffect(() => {
    const h = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "Escape") { e.preventDefault(); onExit(); }
      else if (e.key === " ") { e.preventDefault(); setRunning(r => !r); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onExit]);

  const handleReset = () => {
    baseRef.current = 0;
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    if (onSaveTime && task) onSaveTime(task.id, 0);
  };

  if (!task) return null;
  const sec = Math.floor(elapsedMs / 1000);
  const p2 = (n) => String(n).padStart(2, "0");
  const hh = Math.floor(sec / 3600);
  const mm = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  const timeStr = hh > 0 ? `${hh}:${p2(mm)}:${p2(ss)}` : `${p2(mm)}:${p2(ss)}`;
  const target = taskHours(task);

  return (
    <div className="q-focus-overlay" role="dialog" aria-label="Focus mode">
      <div className="q-focus-bar">
        <button className="q-btn q-btn--ghost" onClick={onExit}>
          <Icon name="close" size={14} /> Exit focus <span className="q-kbd" style={{ marginLeft: 4 }}>Esc</span>
        </button>
        {onSkip && nextTask && (
          <button className="q-btn q-btn--ghost q-btn--sm" onClick={onSkip}>
            Skip <Icon name="chevronR" size={12} />
          </button>
        )}
      </div>
      <div className="q-focus-body">
        <div className="q-focus-meta">
          <span className="q-focus-dot" />
          {projectName && <><span>{projectName}</span><span style={{ color: "var(--text-faint)" }}>·</span></>}
          <span className="q-eyebrow">{(task.difficulty || "medium")} · ~{target}h</span>
        </div>
        <h1 className="q-focus-title">{task.title}</h1>
        <div className="q-focus-timer">{timeStr}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 4, alignItems: "center" }}>
          <button className="q-btn q-btn--outline" onClick={() => setRunning(r => !r)} style={{ minWidth: 130 }}>
            {running ? "Pause" : "Resume"} <span className="q-kbd" style={{ marginLeft: 4 }}>Space</span>
          </button>
          <button
            className="q-btn q-btn--ghost"
            onClick={handleReset}
            title="Reset timer to 00:00"
            disabled={elapsedMs === 0}
          >
            <Icon name="reset" size={13} /> Reset
          </button>
          <button className="q-btn q-btn--success" onClick={onComplete}>
            <Icon name="check" size={13} /> Mark complete
          </button>
        </div>
      </div>
      {nextTask && (
        <div className="q-focus-next q-fade-in">
          <div className="q-eyebrow" style={{ marginBottom: 4 }}>Up Next</div>
          <div style={{ fontSize: 13, color: "var(--text)" }}>{nextTask.title}</div>
        </div>
      )}
    </div>
  );
}

/* ───── ROOT APP ───── */

// Small error boundary so a render-time crash inside any one view doesn't
// take out the whole tree (and silently throw away the user's session via
// unmount). Renders a recovery card with the error message and a reload
// affordance. Doesn't try to be clever — the only safe action after a
// component-level crash is to reload from storage, which is already what
// localStorage is for.
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // Surface the stack to the console for debugging without blowing up
    // any toast or notify system that might also be broken.
    console.error("[AppErrorBoundary]", error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      const msg = String(this.state.error?.message || this.state.error || "Unknown error");
      return (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24, background: "var(--bg)", color: "var(--text)",
          fontFamily: "var(--font-sans)",
        }}>
          <div style={{
            maxWidth: 520,
            background: "var(--bg-elev)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--r-md)",
            padding: "20px 22px",
          }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: "var(--danger)",
              textTransform: "uppercase", letterSpacing: "0.1em",
              marginBottom: 8,
            }}>Quest hit a snag</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>
              Something inside the app threw an error.
            </div>
            <div style={{
              fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)",
              background: "var(--bg-soft)", padding: "8px 10px",
              borderRadius: "var(--r-sm)", border: "1px solid var(--border)",
              marginBottom: 14, wordBreak: "break-word",
            }}>{msg}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
              Your data is still saved — nothing was lost. Reloading should
              put you back where you were. If the error keeps happening,
              the console has more detail.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="q-btn q-btn--primary"
                onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              >Reload</button>
              <button
                className="q-btn q-btn--ghost"
                onClick={() => this.setState({ error: null })}
              >Try again</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppWithBoundary() {
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}

function App() {
  const [view,     setView]     = useState("today");
  const [tasks,    setTasks]    = useState([]);
  const [projects, setProjects] = useState([]);
  const [profile,  setProfile]  = useState({ totalXP: 0, todayXP: 0, streak: 0, lastDate: "", completedCount: 0 });
  const [unlocked, setUnlocked] = useState([]);
  const [weekPlan, setWeekPlan] = useState(null);
  const [toast,    setToast]    = useState(null);
  const [confetti, setConfetti] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [openNewTask, setOpenNewTask] = useState(false);
  const [levelUp,  setLevelUp]  = useState(null);
  const [focusTaskId, setFocusTaskId] = useState(null);
  const [energy, setEnergy] = useState("normal");  // "low" | "normal" | "high"
  const [endOfDayOpen, setEndOfDayOpen] = useState(false);
  const [weeklyDismissed, setWeeklyDismissed] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [dayClosed, setDayClosed] = useState(null); // { date, closedAt }
  const [dayLocks, setDayLocks] = useState({}); // { "YYYY-MM-DD": true }
  const [dayStartHour, setDayStartHour] = useState(0); // 0-23, when the "day" rolls over
  const [customTags, setCustomTags] = useState([]);
  // Fresh-install signal — surfaced as an inline CTA on Today's empty
  // state. Doesn't persist; clears as soon as the user captures or enters
  // preview from the banner.
  const [firstLaunch, setFirstLaunch] = useState(false);
  const [ready,    setReady]    = useState(false);
  const planClearedRef = useRef(false);
  const prevLvlRef     = useRef(null);
  const levelUpTimerRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    (async () => {
      await runMigrations();
      // Load the day-rollover hour first so every downstream "today"
      // computation respects it.
      const rawHour = await loadKV("quest_day_start_hour", 0);
      const dsh = typeof rawHour === "number" && rawHour >= 0 && rawHour <= 23 ? rawHour : 0;
      setDayStartHour(dsh);

      const [t, p, a, w, pr, ct] = await Promise.all([
        loadKV(KEYS.tasks, []),
        loadKV(KEYS.profile, { totalXP: 0, todayXP: 0, streak: 0, lastDate: "", completedCount: 0 }),
        loadKV(KEYS.achievements, []),
        loadKV(KEYS.weekplan, null),
        loadKV(KEYS.projects, []),
        loadKV(KEYS.customTags, []),
      ]);
      setCustomTags(Array.isArray(ct) ? ct : []);
      const todayStr = effectiveTodayDateStr(dsh);
      const yesterStr = effectiveDateStrOf(Date.now() - 86400000, dsh);
      let streak = p.streak || 0;
      let todayXP = p.todayXP || 0;
      if (p.lastDate !== todayStr) {
        todayXP = 0;
        if (p.lastDate !== yesterStr) streak = 0;
      }
      const processed = processRecurring(t, dsh);
      // Persist if processRecurring actually changed anything — e.g. cleared
      // stale focus state — so storage doesn't repeatedly hand us yesterday's
      // values on every load.
      if (processed !== t && processed.some((x, i) => x !== t[i])) {
        saveKV(KEYS.tasks, processed);
      }
      setTasks(processed);
      setProjects(pr || []);
      setProfile({ ...p, todayXP, streak });
      setUnlocked(a);
      setWeekPlan(w);

      // Weekly pulse dismissal: stored as the weekId of the last dismissal.
      const dismissedAt = await loadKV("quest_pulse_dismissed", null);
      const currentWeekId = isoDate(mondayOf(new Date()));
      setWeeklyDismissed(dismissedAt === currentWeekId);

      // Preview mode: if a snapshot exists, we're in demo mode.
      const snap = await loadKV(PREVIEW_KEY, null);
      let inPreview = !!snap;
      setPreviewMode(inPreview);

      // First-launch detection: no tasks, no projects, no XP, no existing
      // preview. If true, mark this session as "fresh first launch" so the
      // empty state can offer to load seed data. Don't auto-enter preview
      // (that would be surprising) — surface an explicit CTA in the
      // existing Today empty state instead. This flag clears the first
      // time the user does anything substantive.
      const isFreshLaunch = !inPreview
        && (Array.isArray(processed) ? processed.length === 0 : true)
        && (Array.isArray(pr) ? pr.length === 0 : true)
        && (!p || (p.totalXP || 0) === 0)
        && (!w || (Array.isArray(w) ? w.length === 0 : true));
      setFirstLaunch(isFreshLaunch);

      // Day-closed marker
      const closed = await loadKV("quest_day_closed", null);
      if (closed && closed.date === effectiveTodayIso(dsh)) setDayClosed(closed);
      else setDayClosed(null);

      // Day locks
      const locks = await loadKV(LOCKS_KEY, {});
      setDayLocks(locks && typeof locks === "object" ? locks : {});

      setReady(true);
      const changed = processed.some((x, i) => t[i] && x.completed !== t[i].completed);
      if (changed) saveKV(KEYS.tasks, processed);
    })();
  }, []);

  const notify = useCallback((msg, xp) => {
    setToast({ msg, xp: xp == null ? null : xp });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2400);
  }, []);

  // Day cleared: fire only on a rising-edge transition during the session.
  // On first ready, we initialize the ref to the current state so opening the
  // app with everything already done doesn't trigger the moment.
  const planClearedInitRef = useRef(false);
  useEffect(() => {
    if (!ready) return;
    const todayIso = effectiveTodayIso(dayStartHour);
    const todayEntry = (weekPlan || []).find(e => e.date === todayIso);
    const dailyTasks = tasks.filter(t => t.recurring === "daily");
    const scheduledIds = todayEntry?.taskIds || [];
    const planSet = dailyTasks.concat(
      scheduledIds.map(id => tasks.find(t => t.id === id)).filter(Boolean)
    );
    const hasPlan = planSet.length > 0;
    const allDone = hasPlan && planSet.every(t => t.completed);
    if (!planClearedInitRef.current) {
      planClearedInitRef.current = true;
      planClearedRef.current = allDone;
      return;
    }
    if (!hasPlan) { planClearedRef.current = false; return; }
    if (allDone && !planClearedRef.current) {
      planClearedRef.current = true;
      notify("Day cleared. Solid day.");
    } else if (!allDone) {
      planClearedRef.current = false;
    }
  }, [tasks, weekPlan, ready, notify, dayStartHour]);

  // Level up: detect rising-edge crossings on the level number.
  useEffect(() => {
    if (!ready) return;
    const lvl = getLevelInfo(profile.totalXP).lvl;
    if (prevLvlRef.current == null) { prevLvlRef.current = lvl; return; }
    if (lvl > prevLvlRef.current) {
      const title = LEVEL_NAMES[Math.min(lvl, LEVEL_NAMES.length) - 1] || `Level ${lvl}`;
      setLevelUp({ lvl, title });
      if (levelUpTimerRef.current) clearTimeout(levelUpTimerRef.current);
      levelUpTimerRef.current = setTimeout(() => setLevelUp(null), 2800);
      setConfetti(true);
    }
    prevLvlRef.current = lvl;
  }, [profile.totalXP, ready]);

  const checkAchievements = useCallback((p, t, cur, pr) => {
    const projectsArg = Array.isArray(pr) ? pr : projects;
    const wk = Date.now() - 7 * 86400000;
    loadKV(KEYS.screen, {}).then(sl => {
      const te = sl[effectiveTodayIso(dayStartHour)] || {};
      const checks = {
        first:     p.completedCount >= 1,
        five:      p.completedCount >= 5,
        twenty:    p.completedCount >= 20,
        streak3:   p.streak >= 3,
        streak7:   p.streak >= 7,
        day100:    p.todayXP >= 100,
        xp500:     p.totalXP >= 500,
        xp1000:    p.totalXP >= 1000,
        epic:      t.some(x => x.completed && x.difficulty === "epic"),
        decompose: t.some(x => x.completed && (x.subtasks || []).filter(s => s.done).length >= 3),
        framer3:   t.filter(x => x.completed && x.completedAt > wk && (x.tags || []).indexOf("framer") >= 0).length >= 3,
        speed:     t.some(x => x.completed && x.completedAt && x.createdAt && (x.completedAt - x.createdAt) < 1800000),
        clean_day: (te.xOpens || 0) === 0 && (te.ytOpens || 0) === 0 && te.mobileHours != null && te.mobileHours <= 1,
        project:   projectsArg.some(pr2 => pr2.completedAt),
      };
      const newOnes = Object.keys(checks).filter(id => checks[id] && cur.indexOf(id) < 0);
      if (newOnes.length) {
        const next = cur.concat(newOnes);
        setUnlocked(next);
        saveKV(KEYS.achievements, next);
        const def = ACHIEVEMENTS.find(a => a.id === newOnes[0]);
        if (def) notify("Trophy: " + def.title);
      }
    });
  }, [projects, notify, dayStartHour]);

  // Daily task completion on a specific date (today OR a past day). The
  // history-aware path: appends to task.dailyCompletions, recomputes
  // task.completed from "is today in the history", credits XP. If the date
  // being marked is today, also bumps todayXP / streak / lastDate; if it's
  // a past date the totalXP grows but today's session stats don't, since
  // those are about *today*.
  const completeDailyOn = useCallback((taskId, dateIso) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.recurring !== "daily" || !dateIso) return;
    const history = Array.isArray(task.dailyCompletions) ? task.dailyCompletions : [];
    if (history.includes(dateIso)) return;  // already counted that day
    const newHistory = [...history, dateIso].sort();
    const todayIso = effectiveTodayIso(dayStartHour);
    const todayStr = effectiveTodayDateStr(dayStartHour);
    const yesterStr = effectiveDateStrOf(Date.now() - 86400000, dayStartHour);
    const isToday = dateIso === todayIso;
    const upd = tasks.map(t => t.id === taskId
      ? {
          ...t,
          dailyCompletions: newHistory,
          completed: newHistory.includes(todayIso),
          completedAt: isToday ? Date.now() : t.completedAt,
        }
      : t);
    const np = {
      ...profile,
      totalXP: profile.totalXP + task.xp,
      todayXP: isToday
        ? (profile.lastDate === todayStr ? profile.todayXP : 0) + task.xp
        : profile.todayXP,
      streak: isToday
        ? (profile.lastDate === todayStr ? profile.streak
           : profile.lastDate === yesterStr ? profile.streak + 1 : 1)
        : profile.streak,
      lastDate: isToday ? todayStr : profile.lastDate,
      completedCount: profile.completedCount + 1,
    };
    setTasks(upd); setProfile(np);
    saveKV(KEYS.tasks, upd); saveKV(KEYS.profile, np);
    const dateLabel = parseIsoDate(dateIso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    notify(isToday ? "Task complete" : `Logged for ${dateLabel}`, task.xp);
    checkAchievements(np, upd, unlocked);
  }, [tasks, profile, unlocked, notify, checkAchievements, dayStartHour]);

  // Inverse: remove a specific date from a daily task's history. Today's
  // session counters back off accordingly only if today is the date being
  // removed.
  const uncompleteDailyOn = useCallback((taskId, dateIso) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.recurring !== "daily" || !dateIso) return;
    const history = Array.isArray(task.dailyCompletions) ? task.dailyCompletions : [];
    if (!history.includes(dateIso)) return;
    const newHistory = history.filter(d => d !== dateIso);
    const todayIso = effectiveTodayIso(dayStartHour);
    const isToday = dateIso === todayIso;
    const upd = tasks.map(t => t.id === taskId
      ? {
          ...t,
          dailyCompletions: newHistory,
          completed: newHistory.includes(todayIso),
          completedAt: isToday ? null : t.completedAt,
        }
      : t);
    const np = {
      ...profile,
      totalXP: Math.max(0, profile.totalXP - task.xp),
      todayXP: isToday ? Math.max(0, profile.todayXP - task.xp) : profile.todayXP,
      completedCount: Math.max(0, profile.completedCount - 1),
    };
    setTasks(upd); setProfile(np);
    saveKV(KEYS.tasks, upd); saveKV(KEYS.profile, np);
    const dateLabel = parseIsoDate(dateIso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    notify(isToday ? "Task reopened" : `Removed from ${dateLabel}`, -task.xp);
  }, [tasks, profile, notify, dayStartHour]);

  const completeTask = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    if (!task || task.completed) return;
    // Daily tasks route through the history-aware path so today's
    // completion is recorded in dailyCompletions and survives rollover.
    if (task.recurring === "daily") {
      completeDailyOn(id, effectiveTodayIso(dayStartHour));
      return;
    }
    const todayStr  = effectiveTodayDateStr(dayStartHour);
    const yesterStr = effectiveDateStrOf(Date.now() - 86400000, dayStartHour);
    const upd = tasks.map(t => t.id === id ? { ...t, completed: true, completedAt: Date.now() } : t);
    const np = {
      ...profile,
      totalXP: profile.totalXP + task.xp,
      todayXP: (profile.lastDate === todayStr ? profile.todayXP : 0) + task.xp,
      streak: profile.lastDate === todayStr ? profile.streak
              : profile.lastDate === yesterStr ? profile.streak + 1 : 1,
      lastDate: todayStr,
      completedCount: profile.completedCount + 1,
    };
    setTasks(upd); setProfile(np);
    saveKV(KEYS.tasks, upd); saveKV(KEYS.profile, np);
    notify("Task complete", task.xp);
    checkAchievements(np, upd, unlocked);

    if (task.projectId) {
      const proj = projects.find(p => p.id === task.projectId);
      if (proj && !proj.completedAt) {
        const allDone = (proj.childTaskIds || []).every(cid => {
          if (cid === id) return true;
          const child = upd.find(t => t.id === cid);
          return child ? child.completed : true;
        });
        if (allDone && (proj.childTaskIds || []).length > 0) {
          notify("Ready to ship: " + proj.title);
        }
      }
    }
  }, [tasks, profile, unlocked, projects, notify, checkAchievements, dayStartHour, completeDailyOn]);

  const uncompleteTask = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    if (!task || !task.completed) return;
    // Daily tasks route through the history-aware path so removing today's
    // completion just pops today from dailyCompletions; past days are
    // unaffected.
    if (task.recurring === "daily") {
      uncompleteDailyOn(id, effectiveTodayIso(dayStartHour));
      return;
    }
    const todayStr = effectiveTodayDateStr(dayStartHour);
    const wasToday = task.completedAt && effectiveDateStrOf(task.completedAt, dayStartHour) === todayStr;
    const upd = tasks.map(t => t.id === id ? { ...t, completed: false, completedAt: null } : t);
    const np = {
      ...profile,
      totalXP: Math.max(0, profile.totalXP - task.xp),
      todayXP: wasToday ? Math.max(0, profile.todayXP - task.xp) : profile.todayXP,
      completedCount: Math.max(0, profile.completedCount - 1),
    };
    setTasks(upd); setProfile(np);
    saveKV(KEYS.tasks, upd); saveKV(KEYS.profile, np);
    notify("Task reopened", -task.xp);

    if (task.projectId) {
      const proj = projects.find(p => p.id === task.projectId);
      if (proj && proj.completedAt) {
        const updP = projects.map(p => p.id === task.projectId ? { ...p, completedAt: null, shippedAt: null } : p);
        setProjects(updP); saveKV(KEYS.projects, updP);
      }
    }
  }, [tasks, profile, projects, notify, dayStartHour, uncompleteDailyOn]);

  // Persist a user-added tag so future tag pickers (and the queue filter)
  // remember it. Built-in tags are skipped — they're already in the union.
  const addCustomTag = useCallback((tag) => {
    if (!tag || TASK_TAGS_BUILTIN.includes(tag)) return;
    setCustomTags(prev => {
      if (prev.includes(tag)) return prev;
      const next = [...prev, tag];
      saveKV(KEYS.customTags, next);
      return next;
    });
  }, []);

  // Pin a task to a specific date in the weekPlan. Replaces any existing
  // undone scheduling for the task (preserves done chunks). Passing null
  // for date unschedules the task entirely (undone chunks only).
  const pinTaskToDate = useCallback((taskId, date) => {
    setWeekPlan(prev => {
      const planSrc = Array.isArray(prev) ? prev : [];
      const byDate = new Map();
      for (const e of planSrc) {
        byDate.set(e.date, { date: e.date, items: (e.items || []).map(it => ({ ...it })) });
      }
      // Remove all undone chunks of this task across all days.
      for (const entry of byDate.values()) {
        entry.items = entry.items.filter(it => !(it.taskId === taskId && !it.done));
      }
      // Add a single new chunk at the target date (if provided).
      if (date) {
        if (!byDate.has(date)) byDate.set(date, { date, items: [] });
        byDate.get(date).items.push({ taskId, done: false });
      }
      const next = Array.from(byDate.values())
        .filter(e => e.items.length)
        .sort((a, b) => a.date.localeCompare(b.date));
      saveKV(KEYS.weekplan, next);
      return next;
    });
  }, []);

  // Move a single chunk from one date to another, preserving its hours /
  // note / done / doneAt state. If the new date already has a chunk for
  // the same task, we leave the move as a no-op so we don't merge two
  // distinct chunks (which would lose the duplicate's data).
  const moveChunkDate = useCallback((taskId, fromDate, toDate) => {
    if (!fromDate || !toDate || fromDate === toDate) return;
    setWeekPlan(prev => {
      const planSrc = Array.isArray(prev) ? prev : [];
      let movedItem = null;
      const stripped = planSrc.map(entry => {
        if (entry.date !== fromDate) return entry;
        const out = [];
        for (const it of (entry.items || [])) {
          if (it.taskId === taskId && !movedItem) movedItem = it;
          else out.push(it);
        }
        return { ...entry, items: out };
      });
      if (!movedItem) return prev;
      // Already a chunk at toDate for this task? Refuse to merge — the
      // user can delete the duplicate explicitly if they want.
      const collision = stripped.find(e => e.date === toDate && (e.items || []).some(i => i.taskId === taskId));
      if (collision) return prev;
      const byDate = new Map();
      for (const e of stripped) {
        byDate.set(e.date, { date: e.date, items: [...(e.items || [])] });
      }
      if (!byDate.has(toDate)) byDate.set(toDate, { date: toDate, items: [] });
      byDate.get(toDate).items.push({ ...movedItem });
      const next = Array.from(byDate.values())
        .filter(e => e.items.length)
        .sort((a, b) => a.date.localeCompare(b.date));
      saveKV(KEYS.weekplan, next);
      return next;
    });
  }, []);

  // Patch a single chunk (taskId at the given date) in-place. Used by the
  // inline chunk editor in Queue to update hours / note / done. Patch is a
  // shallow override of fields; passing null/undefined for a key removes
  // that field (so callers can clear an empty note).
  const updateChunk = useCallback((taskId, date, patch) => {
    setWeekPlan(prev => {
      const planSrc = Array.isArray(prev) ? prev : [];
      const next = planSrc.map(e => {
        if (e.date !== date) return e;
        return {
          ...e,
          items: (e.items || []).map(it => {
            if (it.taskId !== taskId) return it;
            const merged = { ...it };
            for (const [k, v] of Object.entries(patch)) {
              if (v == null || v === "") delete merged[k];
              else merged[k] = v;
            }
            return merged;
          }),
        };
      });
      saveKV(KEYS.weekplan, next);
      return next;
    });
  }, []);

  const addTask = useCallback((data) => {
    // Pre-scored path: caller already has hours+xp+difficulty (e.g. screenshot
    // import, aiExtendProject). Use them directly and skip the aiScore round
    // trip. manualScore in the same shape as updateTask's signal.
    const preScored = data.manualScore && typeof data.xp === "number" && typeof data.hours === "number" && data.difficulty;
    const optimistic = {
      id: uid(),
      title: data.title.trim(),
      desc: data.desc || "", notes: data.notes || "",
      tags: data.tags || [],
      subtasks: (data.subtasks || []).map((s, i) => ({ id: uid() + i, title: s, done: false })),
      xp: preScored ? data.xp : 20,
      difficulty: preScored ? data.difficulty : "medium",
      hours: preScored ? data.hours : 1.5,
      reason: data.reason || (preScored ? "imported" : "scoring…"),
      recurring: data.recurring || "none",
      priority: data.priority || "medium",
      projectId: data.projectId || null,
      deadlineAt: typeof data.deadlineAt === "number" ? data.deadlineAt : null,
      completed: data.completed === true,
      completedAt: data.completed === true ? Date.now() : null,
      // History of ISO date strings on which a daily task was completed.
      // Seeded on creation so daily tasks always have the field present —
      // makes downstream reads safer than relying on a defensive default.
      dailyCompletions: (data.recurring || "none") === "daily" ? [] : undefined,
      createdAt: Date.now(),
    };
    setTasks(prev => {
      const next = [optimistic, ...prev];
      saveKV(KEYS.tasks, next);
      return next;
    });
    // If imported with a projectId, also append to the project's childTaskIds.
    if (optimistic.projectId) {
      setProjects(prev => {
        const next = prev.map(p => p.id === optimistic.projectId
          ? { ...p, childTaskIds: [...(p.childTaskIds || []), optimistic.id] }
          : p);
        saveKV(KEYS.projects, next);
        return next;
      });
    }
    // Manual schedule pin from TaskForm — only applies to non-recurring tasks.
    if (data.scheduleDate && optimistic.recurring === "none") {
      pinTaskToDate(optimistic.id, data.scheduleDate);
    }
    notify("Task added");

    if (preScored) return Promise.resolve(optimistic);
    aiScore(data.title, data.desc, data.subtasks, data.tags, data.notes).then(sc => {
      setTasks(prev => {
        const next = prev.map(t => t.id === optimistic.id
          ? {
              ...t,
              xp: sc.xp || 20,
              difficulty: sc.difficulty || "medium",
              hours: typeof sc.hours === "number" && sc.hours > 0 ? sc.hours : (DIFFICULTY[sc.difficulty || "medium"]?.hours || 1.5),
              reason: sc.reason || "auto",
            }
          : t);
        saveKV(KEYS.tasks, next);
        return next;
      });
    });
    return Promise.resolve(optimistic);
  }, [notify, pinTaskToDate]);

  const updateTask = useCallback((id, data) => {
    const existing = tasks.find(t => t.id === id);
    if (!existing) return Promise.resolve();
    const placeholderSubs = (data.subtasks || []).map((s, i) => {
      const old = (existing.subtasks || []).find(x => x.title === s);
      return { id: uid() + i, title: s, done: old ? old.done : false };
    });
    setTasks(prev => {
      const next = prev.map(t => t.id === id ? { ...existing, ...data, subtasks: placeholderSubs } : t);
      saveKV(KEYS.tasks, next);
      return next;
    });
    // Manual schedule changes from TaskForm.
    if (data.scheduleDateChanged) {
      pinTaskToDate(id, data.scheduleDate || null);
    }
    // Project membership change — keep both sides of the link consistent:
    // remove from the old project's childTaskIds, add to the new one's.
    if (data.projectIdChanged) {
      const oldProjectId = existing.projectId || null;
      const newProjectId = data.projectId || null;
      if (oldProjectId !== newProjectId) {
        setProjects(prev => {
          const next = prev.map(p => {
            const has = (p.childTaskIds || []).includes(id);
            if (p.id === oldProjectId && has) {
              return { ...p, childTaskIds: (p.childTaskIds || []).filter(x => x !== id) };
            }
            if (p.id === newProjectId && !has) {
              return { ...p, childTaskIds: [...(p.childTaskIds || []), id] };
            }
            return p;
          });
          saveKV(KEYS.projects, next);
          return next;
        });
      }
    }
    // If the user manually overrode hours/XP in the editor, skip the AI
    // rescore — we already saved their values above and they'd be clobbered.
    if (data.manualScore) return Promise.resolve();
    return aiScore(data.title, data.desc, data.subtasks, data.tags, data.notes).then(sc => {
      setTasks(prev => {
        const next = prev.map(t => t.id === id
          ? {
              ...t,
              xp: sc.xp || existing.xp,
              difficulty: sc.difficulty || existing.difficulty,
              hours: typeof sc.hours === "number" && sc.hours > 0 ? sc.hours : existing.hours,
              reason: sc.reason || existing.reason,
            }
          : t);
        saveKV(KEYS.tasks, next);
        return next;
      });
    });
  }, [tasks, pinTaskToDate]);

  const deleteTask = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    if (!window.confirm(`Delete "${task.title}"? This can't be undone.`)) return;
    const upd = tasks.filter(t => t.id !== id);
    setTasks(upd); saveKV(KEYS.tasks, upd);
    if (task.projectId) {
      const updP = projects.map(p => p.id !== task.projectId ? p : { ...p, childTaskIds: (p.childTaskIds || []).filter(x => x !== id) });
      setProjects(updP); saveKV(KEYS.projects, updP);
    }
  }, [tasks, projects]);

  const updateTaskFocusTime = useCallback((id, ms) => {
    setTasks(prev => {
      const today = effectiveTodayIso(dayStartHour);
      const next = prev.map(t => t.id === id
        ? { ...t, focusMs: Math.max(0, Math.round(ms)), focusDate: today }
        : t);
      saveKV(KEYS.tasks, next);
      return next;
    });
  }, [dayStartHour]);

  const toggleSub = useCallback((tid, sid) => {
    const upd = tasks.map(t => t.id !== tid ? t : {
      ...t, subtasks: t.subtasks.map(s => s.id === sid ? { ...s, done: !s.done } : s),
    });
    setTasks(upd); saveKV(KEYS.tasks, upd);
  }, [tasks]);

  // Per-chunk completion. For non-split tasks (one chunk in the plan), the
  // chunk's done state and the task's completed state stay in lock-step. For
  // split tasks, flipping a chunk only updates that chunk; the parent task
  // auto-completes once every chunk is done. Uses the functional setter so
  // rapid sequential toggles read the latest weekPlan instead of stale
  // closure state.
  // XP fires once per task (when allDone transitions true). For intermediate
  // chunk transitions we surface a quiet "Chunk done · 2/3" toast so you get
  // acknowledgement even though the parent task isn't done yet.
  const toggleChunkDone = useCallback((date, taskId, newDone) => {
    // Compute the next plan synchronously from current state. We can't read
    // it out of a functional setWeekPlan(prev => ...) updater because React
    // 18 defers the updater until batch processing.
    const prev = weekPlan || [];
    const nowTs = Date.now();
    const upd = prev.map(e => {
      if (e.date !== date) return e;
      return {
        ...e,
        items: (e.items || []).map(it =>
          it.taskId === taskId
            ? { ...it, done: newDone, doneAt: newDone ? nowTs : null }
            : it
        ),
      };
    });
    setWeekPlan(upd);
    saveKV(KEYS.weekplan, upd);

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const allItems = upd.flatMap(e => (e.items || []).filter(i => i.taskId === taskId));
    const allDone = allItems.length > 0 && allItems.every(i => i.done);
    const someDone = allItems.some(i => i.done);
    const doneCount = allItems.filter(i => i.done).length;
    const total = allItems.length;

    // Per-chunk XP: each chunk pays its share of total XP, weighted by its
    // estimated hours. So a 60 XP task split across 3 equal-hour chunks gives
    // 20 XP per chunk. The final chunk also flips the task to "completed" —
    // but it does NOT pay extra XP, because the sum of chunk shares equals
    // the total task XP.
    const dayEntry = upd.find(e => e.date === date);
    const thisItem = dayEntry?.items.find(i => i.taskId === taskId);
    const thisItemHours = thisItem && thisItem.hours != null ? thisItem.hours : taskHours(task);
    const totalChunkHours = allItems.reduce(
      (s, it) => s + (it.hours != null ? it.hours : taskHours(task)),
      0,
    ) || taskHours(task);
    let chunkXp = total > 1
      ? Math.max(1, Math.round(task.xp * thisItemHours / totalChunkHours))
      : task.xp;

    // Distribution rounding: when the last chunk completes the task, top up
    // its share so the user has been credited exactly task.xp total.
    if (allDone && total > 1) {
      const otherShare = allItems
        .filter(it => it !== thisItem && it.done)
        .reduce((s, it) => {
          const h = it.hours != null ? it.hours : taskHours(task);
          return s + Math.max(1, Math.round(task.xp * h / totalChunkHours));
        }, 0);
      const topUp = Math.max(0, task.xp - otherShare);
      // Use whichever is larger so we don't underpay the final chunk.
      chunkXp = newDone ? Math.max(chunkXp, topUp) : chunkXp;
    }

    const wasCompleted = !!task.completed;
    const willBeCompleted = allDone;
    const xpDelta = newDone ? chunkXp : -chunkXp;

    // Profile update — XP, streak, and last-active date track the date the
    // chunk was completed on (the rollover-hour-aware "today" if applicable).
    const isToday = date === effectiveTodayIso(dayStartHour);
    const todayStr = effectiveTodayDateStr(dayStartHour);
    const yesterStr = effectiveDateStrOf(Date.now() - 86400000, dayStartHour);
    const todayXpBase = (profile.lastDate === todayStr ? profile.todayXP : 0);
    let np = { ...profile };
    np.totalXP = Math.max(0, profile.totalXP + xpDelta);
    if (isToday && newDone) {
      np.todayXP = Math.max(0, todayXpBase + xpDelta);
      np.streak = profile.lastDate === todayStr ? profile.streak
                : profile.lastDate === yesterStr ? profile.streak + 1
                : 1;
      np.lastDate = todayStr;
    } else if (isToday && !newDone) {
      np.todayXP = Math.max(0, profile.todayXP + xpDelta);
    }

    // Task completion transitions update tasks[] and completedCount.
    let updT = tasks;
    let countDelta = 0;
    if (willBeCompleted && !wasCompleted) {
      countDelta = 1;
      updT = tasks.map(t => t.id === taskId ? { ...t, completed: true, completedAt: Date.now() } : t);
    } else if (!willBeCompleted && wasCompleted) {
      countDelta = -1;
      updT = tasks.map(t => t.id === taskId ? { ...t, completed: false, completedAt: null } : t);
    }
    np.completedCount = Math.max(0, profile.completedCount + countDelta);

    setProfile(np); saveKV(KEYS.profile, np);
    if (updT !== tasks) { setTasks(updT); saveKV(KEYS.tasks, updT); }

    // Notify with the actual XP delta so the toast shows accurate values
    // even for partial chunks.
    if (willBeCompleted && !wasCompleted) {
      notify("Task complete", chunkXp);
    } else if (!willBeCompleted && wasCompleted) {
      notify("Task reopened", -chunkXp);
    } else if (newDone && total > 1) {
      notify(`Chunk done · ${doneCount}/${total}`, chunkXp);
    } else if (!newDone && total > 1 && someDone) {
      notify(`Chunk reopened · ${doneCount}/${total}`, -chunkXp);
    } else if (newDone) {
      notify("Task complete", chunkXp);
    } else {
      notify("Task reopened", -chunkXp);
    }

    // Achievements + project ready-to-ship — only on the transition into
    // completed, matching completeTask's prior behavior.
    if (willBeCompleted && !wasCompleted) {
      checkAchievements(np, updT, unlocked);
      if (task.projectId) {
        const proj = projects.find(p => p.id === task.projectId);
        if (proj && !proj.completedAt) {
          const allTaskDone = (proj.childTaskIds || []).every(cid => {
            if (cid === taskId) return true;
            const child = updT.find(t => t.id === cid);
            return child ? child.completed : true;
          });
          if (allTaskDone && (proj.childTaskIds || []).length > 0) {
            notify("Ready to ship: " + proj.title);
          }
        }
      }
    }
  }, [weekPlan, tasks, profile, unlocked, projects, notify, checkAchievements, dayStartHour]);

  const splitTask = useCallback((taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks || task.subtasks.length === 0) return;
    const projectId = "p-" + uid();
    const proj = {
      id: projectId, title: task.title, desc: task.desc || "", notes: task.notes || "",
      tags: task.tags || [], type: "other", color: pickProjectColor(),
      createdAt: Date.now(), completedAt: null, shippedAt: null, childTaskIds: [],
    };
    const tmpChildren = task.subtasks.map((sub, i) => ({
      id: "ct-" + uid() + i, title: sub.title, desc: "", notes: "", tags: task.tags || [],
      subtasks: [], xp: 15, difficulty: "medium", reason: "scoring…",
      recurring: "none", priority: task.priority || "medium",
      projectId, completed: false, createdAt: Date.now() + i,
    }));
    proj.childTaskIds = tmpChildren.map(c => c.id);
    const newProjects = [proj, ...projects];
    const newTasks = tasks.filter(t => t.id !== taskId).concat(tmpChildren);
    setProjects(newProjects); setTasks(newTasks);
    saveKV(KEYS.projects, newProjects); saveKV(KEYS.tasks, newTasks);
    notify("Split into " + tmpChildren.length + " tasks");

    Promise.all(tmpChildren.map(c => aiScore(c.title, task.desc || "", [], task.tags || [], "Part of: " + task.title)
      .then(sc => ({ id: c.id, sc })))).then(updates => {
      setTasks(prev => {
        const map = Object.fromEntries(updates.map(u => [u.id, u.sc]));
        const next = prev.map(t => map[t.id]
          ? {
              ...t,
              xp: map[t.id].xp || 15,
              difficulty: map[t.id].difficulty || "medium",
              hours: typeof map[t.id].hours === "number" && map[t.id].hours > 0
                ? map[t.id].hours
                : (DIFFICULTY[map[t.id].difficulty || "medium"]?.hours || 1.5),
              reason: map[t.id].reason || "auto",
            }
          : t);
        saveKV(KEYS.tasks, next);
        return next;
      });
    });
  }, [tasks, projects, notify]);

  const createProjectFromCapture = useCallback((data) => {
    const projectId = "p-" + uid();
    const proj = {
      id: projectId,
      title: (data.title || "Untitled project").trim(),
      desc: data.description || "",
      notes: "", tags: [], type: "other", color: pickProjectColor(),
      createdAt: Date.now(), completedAt: null, shippedAt: null,
      childTaskIds: [],
    };
    const tmpChildren = (data.tasks || []).map((t, i) => ({
      id: "ct-" + uid() + i,
      title: (t.title || "").trim() || "Untitled task",
      desc: t.description || "",
      notes: "", tags: [], subtasks: [],
      xp: 15, difficulty: "medium", reason: "scoring…",
      recurring: "none", priority: "medium",
      projectId, completed: false, createdAt: Date.now() + i,
    }));
    proj.childTaskIds = tmpChildren.map(c => c.id);
    const newProjects = [proj, ...projects];
    const newTasks = [...tmpChildren, ...tasks];
    setProjects(newProjects); setTasks(newTasks);
    saveKV(KEYS.projects, newProjects); saveKV(KEYS.tasks, newTasks);
    notify(tmpChildren.length > 0
      ? `Project created · ${tmpChildren.length} task${tmpChildren.length > 1 ? "s" : ""}`
      : "Project created");

    if (tmpChildren.length) {
      Promise.all(tmpChildren.map(c => aiScore(c.title, c.desc, [], [], "Part of: " + proj.title)
        .then(sc => ({ id: c.id, sc })))).then(updates => {
        setTasks(prev => {
          const map = Object.fromEntries(updates.map(u => [u.id, u.sc]));
          const next = prev.map(t => map[t.id]
            ? {
                ...t,
                xp: map[t.id].xp || 15,
                difficulty: map[t.id].difficulty || "medium",
                hours: typeof map[t.id].hours === "number" && map[t.id].hours > 0
                  ? map[t.id].hours
                  : (DIFFICULTY[map[t.id].difficulty || "medium"]?.hours || 1.5),
                reason: map[t.id].reason || "auto",
              }
            : t);
          saveKV(KEYS.tasks, next);
          return next;
        });
      });
    }
    return projectId;
  }, [tasks, projects, notify]);

  const addChildToProject = useCallback((projectId, data) => {
    // If the caller already has hours/xp/difficulty (e.g. from aiExtendProject
    // which scores at generation time), use them directly and skip the
    // follow-up aiScore call. Otherwise the optimistic insert uses placeholder
    // values and the score arrives async like before.
    const preScored = typeof data.xp === "number" && typeof data.hours === "number" && data.difficulty;
    const fallbackHours = DIFFICULTY[data.difficulty || "medium"]?.hours || 1.5;
    const child = {
      id: "ct-" + uid(),
      title: data.title.trim(),
      desc: data.description || data.desc || "",
      notes: "", tags: data.tags || [],
      subtasks: [],
      xp: preScored ? data.xp : 15,
      difficulty: data.difficulty || "medium",
      hours: preScored ? data.hours : fallbackHours,
      reason: data.reason || (preScored ? "ai-extended" : "scoring…"),
      recurring: "none",
      priority: data.priority || "medium",
      projectId, completed: false, createdAt: Date.now(),
    };
    const updT = tasks.concat([child]);
    const updP = projects.map(p => p.id === projectId ? { ...p, childTaskIds: (p.childTaskIds || []).concat([child.id]) } : p);
    setTasks(updT); setProjects(updP);
    saveKV(KEYS.tasks, updT); saveKV(KEYS.projects, updP);

    if (preScored) return Promise.resolve(child);
    aiScore(data.title, child.desc, [], [], "").then(sc => {
      setTasks(prev => {
        const next = prev.map(t => t.id === child.id
          ? {
              ...t,
              xp: sc.xp || 15,
              difficulty: sc.difficulty || "medium",
              hours: typeof sc.hours === "number" && sc.hours > 0 ? sc.hours : (DIFFICULTY[sc.difficulty || "medium"]?.hours || 1.5),
              reason: sc.reason || "auto",
            }
          : t);
        saveKV(KEYS.tasks, next);
        return next;
      });
    });
    return Promise.resolve(child);
  }, [tasks, projects]);

  const removeChildFromProject = useCallback((taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.projectId) return;
    const updT = tasks.map(t => t.id === taskId ? { ...t, projectId: null } : t);
    const updP = projects.map(p => p.id !== task.projectId ? p : { ...p, childTaskIds: (p.childTaskIds || []).filter(x => x !== taskId) });
    setTasks(updT); setProjects(updP);
    saveKV(KEYS.tasks, updT); saveKV(KEYS.projects, updP);
  }, [tasks, projects]);

  const createProject = useCallback(({ title, type }) => {
    const id = "p-" + uid();
    const proj = {
      id, title: title.trim(), desc: "", notes: "", tags: [],
      type: type || "other", color: pickProjectColor(),
      createdAt: Date.now(), completedAt: null, shippedAt: null, childTaskIds: [],
    };
    const next = [proj, ...projects];
    setProjects(next); saveKV(KEYS.projects, next);
    return id;
  }, [projects]);

  const renameProject = useCallback((id, title) => {
    const next = projects.map(p => p.id === id ? { ...p, title } : p);
    setProjects(next); saveKV(KEYS.projects, next);
  }, [projects]);

  // Patch a project's description / notes (or any subset of those). Pass
  // null to clear, undefined to leave alone.
  const updateProjectMeta = useCallback((id, patch) => {
    const next = projects.map(p => {
      if (p.id !== id) return p;
      const merged = { ...p };
      if (Object.prototype.hasOwnProperty.call(patch, "desc")) merged.desc = patch.desc || "";
      if (Object.prototype.hasOwnProperty.call(patch, "notes")) merged.notes = patch.notes || "";
      return merged;
    });
    setProjects(next); saveKV(KEYS.projects, next);
  }, [projects]);

  const updateProjectColor = useCallback((id, color) => {
    const next = projects.map(p => p.id === id ? { ...p, color } : p);
    setProjects(next); saveKV(KEYS.projects, next);
  }, [projects]);

  const shipProject = useCallback((id) => {
    const now = Date.now();
    const proj = projects.find(p => p.id === id);
    const next = projects.map(p => p.id === id ? { ...p, completedAt: now, shippedAt: now } : p);
    setProjects(next); saveKV(KEYS.projects, next);
    setConfetti(true);
    notify("Shipped: " + (proj?.title || "project"));
    checkAchievements(profile, tasks, unlocked, next);
  }, [projects, profile, tasks, unlocked, notify, checkAchievements]);

  const unshipProject = useCallback((id) => {
    const next = projects.map(p => p.id === id ? { ...p, completedAt: null, shippedAt: null } : p);
    setProjects(next); saveKV(KEYS.projects, next);
  }, [projects]);

  const deleteProject = useCallback((id) => {
    const proj = projects.find(p => p.id === id);
    if (!proj) return;
    const childCount = (proj.childTaskIds || []).length;
    const msg = childCount
      ? `Delete "${proj.title}" and its ${childCount} task${childCount > 1 ? "s" : ""}? This can't be undone.`
      : `Delete "${proj.title}"? This can't be undone.`;
    if (!window.confirm(msg)) return;
    const childIds = new Set(proj.childTaskIds || []);
    const updT = tasks.filter(t => !childIds.has(t.id));
    const updP = projects.filter(p => p.id !== id);
    setTasks(updT); setProjects(updP);
    saveKV(KEYS.tasks, updT); saveKV(KEYS.projects, updP);
    notify("Project deleted");
  }, [tasks, projects, notify]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      const inField = tag === "input" || tag === "textarea" || e.target.isContentEditable;
      if (e.key === "Escape") {
        if (showHelp) { setShowHelp(false); return; }
        if (openNewTask) { setOpenNewTask(false); return; }
      }
      if (inField) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) { e.preventDefault(); setShowHelp(h => !h); return; }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        // Prefer focusing the capture bar (Today / Queue views); fall back to
        // opening the full task form on views that don't render one.
        if (view === "today" || view === "queue") captureFocusBus.focus();
        else setOpenNewTask(true);
        return;
      }
      const navByKey = NAV_ITEMS.find(n => n.shortcut === e.key);
      if (navByKey) { e.preventDefault(); setView(navByKey.id); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showHelp, openNewTask]);

  const lvl = useMemo(() => getLevelInfo(profile.totalXP), [profile.totalXP]);
  const projectsMap = useMemo(() => {
    const m = {};
    projects.forEach(p => { m[p.id] = p; });
    return m;
  }, [projects]);
  const tasksById = useMemo(() => {
    const m = new Map();
    tasks.forEach(t => m.set(t.id, t));
    return m;
  }, [tasks]);

  // Focus tunnel state
  const focusTask = focusTaskId ? tasksById.get(focusTaskId) : null;
  const todayIso = effectiveTodayIso(dayStartHour);
  const todayEntry = (weekPlan || []).find(e => e.date === todayIso);
  const nextFocusId = useMemo(() => {
    if (!focusTaskId) return null;
    const schedIds = (todayEntry?.taskIds || [])
      .filter(id => id !== focusTaskId && !tasksById.get(id)?.completed);
    const dailyIds = tasks
      .filter(t => t.recurring === "daily" && !t.completed && t.id !== focusTaskId)
      .map(t => t.id);
    const queue = dailyIds.concat(schedIds);
    return queue[0] || null;
  }, [focusTaskId, todayEntry, tasksById, tasks]);
  const nextFocusTask = nextFocusId ? tasksById.get(nextFocusId) : null;
  const focusProjectName = focusTask?.projectId ? projectsMap[focusTask.projectId]?.title : null;
  const focusProjectColor = focusTask?.projectId ? projectsMap[focusTask.projectId]?.color : null;

  const startFocus = useCallback((id) => setFocusTaskId(id), []);
  const exitFocus  = useCallback(() => setFocusTaskId(null), []);
  const completeFocus = useCallback(() => {
    if (!focusTaskId) return;
    const advance = nextFocusId;
    completeTask(focusTaskId);
    setFocusTaskId(advance);
  }, [focusTaskId, nextFocusId, completeTask]);
  const skipFocus = useCallback(() => setFocusTaskId(nextFocusId), [nextFocusId]);

  const enterPreview = useCallback(async () => {
    if (previewMode) return;
    // Snapshot the user's current data.
    const snap = {
      tasks, projects, profile, unlocked, weekPlan,
      caps: await loadKV(KEYS.caps, DEFAULT_CAPS),
      screen: await loadKV(KEYS.screen, {}),
    };
    await saveKV(PREVIEW_KEY, snap);
    const demo = generateDemoData();
    setTasks(demo.tasks);
    setProjects(demo.projects);
    setProfile(demo.profile);
    setUnlocked(demo.achievements);
    setWeekPlan(demo.weekPlan);
    await Promise.all([
      saveKV(KEYS.tasks, demo.tasks),
      saveKV(KEYS.projects, demo.projects),
      saveKV(KEYS.profile, demo.profile),
      saveKV(KEYS.achievements, demo.achievements),
      saveKV(KEYS.weekplan, demo.weekPlan),
      saveKV(KEYS.caps, demo.caps),
      saveKV(KEYS.screen, demo.screen),
    ]);
    setPreviewMode(true);
    setWeeklyDismissed(false);
    setView("today");
    notify("Preview mode on");
  }, [previewMode, tasks, projects, profile, unlocked, weekPlan, notify]);

  const rollForwardToday = useCallback(async () => {
    const todayIso = effectiveTodayIso(dayStartHour);
    const todayEntry = (weekPlan || []).find(e => e.date === todayIso);
    if (!todayEntry) return 0;
    const unfinishedItems = (todayEntry.items || []).filter(it => {
      const t = tasks.find(x => x.id === it.taskId);
      return t && !t.completed;
    });
    if (!unfinishedItems.length) return 0;
    const caps = await loadKV(KEYS.caps, DEFAULT_CAPS);
    let dayOffset = 1;
    let targetIso = null;
    while (dayOffset < 21) {
      const d = addDays(parseIsoDate(todayIso), dayOffset);
      const wd = weekdayName(d);
      if ((caps[wd] || 0) > 0) { targetIso = isoDate(d); break; }
      dayOffset += 1;
    }
    if (!targetIso) return 0;
    const movingIds = new Set(unfinishedItems.map(it => it.taskId));
    const next = (weekPlan || []).map(e => {
      if (e.date === todayIso) return { ...e, items: (e.items || []).filter(it => !movingIds.has(it.taskId)) };
      return e;
    }).filter(e => (e.items || []).length);
    const targetEntry = next.find(e => e.date === targetIso);
    if (targetEntry) {
      const existing = new Set((targetEntry.items || []).map(it => it.taskId));
      const merged = [...(targetEntry.items || []), ...unfinishedItems.filter(it => !existing.has(it.taskId))];
      const idx = next.indexOf(targetEntry);
      next[idx] = { ...targetEntry, items: merged };
    } else {
      next.push({ date: targetIso, items: unfinishedItems });
    }
    next.sort((a, b) => a.date.localeCompare(b.date));
    setWeekPlan(next);
    await saveKV(KEYS.weekplan, next);
    return unfinishedItems.length;
  }, [tasks, weekPlan, dayStartHour]);

  const closeDay = useCallback(async ({ rollForward }) => {
    let moved = 0;
    if (rollForward) moved = await rollForwardToday();
    const closed = { date: effectiveTodayIso(dayStartHour), closedAt: Date.now() };
    setDayClosed(closed);
    await saveKV("quest_day_closed", closed);
    setEndOfDayOpen(false);
    if (moved > 0) notify(`Day closed · ${moved} task${moved > 1 ? "s" : ""} rolled forward`);
    else notify("Day closed");
  }, [rollForwardToday, notify, dayStartHour]);

  const updateDayStartHour = useCallback((raw) => {
    const n = parseInt(raw, 10);
    const safe = isNaN(n) ? 0 : Math.max(0, Math.min(23, n));
    setDayStartHour(safe);
    saveKV("quest_day_start_hour", safe);
  }, []);

  const toggleDayLock = useCallback((iso) => {
    setDayLocks(prev => {
      const next = { ...prev };
      if (next[iso]) delete next[iso];
      else next[iso] = true;
      saveKV(LOCKS_KEY, next);
      return next;
    });
  }, []);

  const reopenDay = useCallback(async () => {
    setDayClosed(null);
    await saveKV("quest_day_closed", null);
    notify("Day reopened");
  }, [notify]);

  // Export everything into a single JSON download. Keyed by KEYS.* so it
  // round-trips through importData cleanly. Schema version included so we
  // can refuse to import older or newer dumps that we don't understand.
  const exportData = useCallback(async () => {
    if (previewMode) {
      notify("Exit preview first");
      return;
    }
    try {
      const [t, p, pr, a, w, c, s, dl, dc, ds, ct] = await Promise.all([
        loadKV(KEYS.tasks, []),
        loadKV(KEYS.profile, { totalXP: 0, todayXP: 0, streak: 0, lastDate: "", completedCount: 0 }),
        loadKV(KEYS.projects, []),
        loadKV(KEYS.achievements, []),
        loadKV(KEYS.weekplan, null),
        loadKV(KEYS.caps, DEFAULT_CAPS),
        loadKV(KEYS.screen, {}),
        loadKV(LOCKS_KEY, {}),
        loadKV("quest_day_closed", null),
        loadKV("quest_day_start_hour", 0),
        loadKV(KEYS.customTags, []),
      ]);
      const payload = {
        app: "quest",
        format: 1,
        schema: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        data: {
          tasks: t, profile: p, projects: pr, achievements: a, weekplan: w,
          caps: c, screen: s, locks: dl, dayClosed: dc,
          dayStartHour: ds, customTags: ct,
        },
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a2 = document.createElement("a");
      a2.href = url;
      a2.download = `quest-backup-${isoDate(new Date())}.json`;
      document.body.appendChild(a2);
      a2.click();
      a2.remove();
      URL.revokeObjectURL(url);
      notify("Backup downloaded");
    } catch (e) {
      console.error("Export failed:", e);
      notify("Export failed — check the console");
    }
  }, [previewMode, notify]);

  // Import from a JSON backup. Refuses if app/format don't match, refuses
  // if the schema is newer than ours (we don't know how to read it). On a
  // valid file, asks the user whether to REPLACE everything or MERGE.
  // Replace fully overwrites the current data. Merge keeps the larger of
  // each list (deduped by id), keeps the maximum totalXP/streak, and
  // unions the achievement set — opinionated but safer than silent loss.
  const importData = useCallback(() => {
    if (previewMode) {
      notify("Exit preview first");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async (ev) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        if (payload?.app !== "quest" || payload?.format !== 1) {
          alert("That doesn't look like a Quest backup. Aborting.");
          return;
        }
        if (typeof payload.schema === "number" && payload.schema > SCHEMA_VERSION) {
          alert(`That backup was made by a newer version of Quest (schema v${payload.schema}, this app is v${SCHEMA_VERSION}). Update first, then re-import.`);
          return;
        }
        const mode = window.prompt(
          'Type "replace" to overwrite current data with the backup, or "merge" to combine them.\n\nReplace = current data is replaced entirely.\nMerge = both sets are kept, deduplicated by id.',
          "merge",
        );
        const m = (mode || "").trim().toLowerCase();
        if (m !== "replace" && m !== "merge") {
          notify("Import canceled");
          return;
        }
        const d = payload.data || {};
        if (m === "replace") {
          await Promise.all([
            saveKV(KEYS.tasks, Array.isArray(d.tasks) ? d.tasks : []),
            saveKV(KEYS.profile, d.profile || { totalXP: 0, todayXP: 0, streak: 0, lastDate: "", completedCount: 0 }),
            saveKV(KEYS.projects, Array.isArray(d.projects) ? d.projects : []),
            saveKV(KEYS.achievements, Array.isArray(d.achievements) ? d.achievements : []),
            saveKV(KEYS.weekplan, d.weekplan || null),
            saveKV(KEYS.caps, d.caps || DEFAULT_CAPS),
            saveKV(KEYS.screen, d.screen || {}),
            saveKV(LOCKS_KEY, d.locks || {}),
            saveKV("quest_day_closed", d.dayClosed || null),
            saveKV("quest_day_start_hour", typeof d.dayStartHour === "number" ? d.dayStartHour : 0),
            saveKV(KEYS.customTags, Array.isArray(d.customTags) ? d.customTags : []),
          ]);
        } else {
          // Merge — dedupe lists by id, keep maximum counters.
          const mergeById = (a, b) => {
            const byId = new Map();
            for (const x of (a || [])) if (x?.id) byId.set(x.id, x);
            for (const x of (b || [])) if (x?.id && !byId.has(x.id)) byId.set(x.id, x);
            return Array.from(byId.values());
          };
          const [curT, curPr, curP, curA, curW, curC, curS, curDL, curCT] = await Promise.all([
            loadKV(KEYS.tasks, []),
            loadKV(KEYS.projects, []),
            loadKV(KEYS.profile, { totalXP: 0, todayXP: 0, streak: 0, lastDate: "", completedCount: 0 }),
            loadKV(KEYS.achievements, []),
            loadKV(KEYS.weekplan, null),
            loadKV(KEYS.caps, DEFAULT_CAPS),
            loadKV(KEYS.screen, {}),
            loadKV(LOCKS_KEY, {}),
            loadKV(KEYS.customTags, []),
          ]);
          const mergedTasks = mergeById(curT, d.tasks);
          const mergedProjects = mergeById(curPr, d.projects);
          const mergedAch = Array.from(new Set([...(curA || []), ...(d.achievements || [])]));
          const mergedCustomTags = Array.from(new Set([...(curCT || []), ...(d.customTags || [])]));
          // weekplan: union by date — for each date keep all items from both
          // sides deduped by taskId.
          const wpByDate = new Map();
          for (const e of (curW || [])) wpByDate.set(e.date, { date: e.date, items: [...(e.items || [])] });
          for (const e of (d.weekplan || [])) {
            const cur = wpByDate.get(e.date) || { date: e.date, items: [] };
            const have = new Set(cur.items.map(i => i.taskId));
            for (const it of (e.items || [])) {
              if (!have.has(it.taskId)) cur.items.push(it);
            }
            wpByDate.set(e.date, cur);
          }
          const mergedWP = Array.from(wpByDate.values()).filter(e => e.items.length).sort((a, b) => a.date.localeCompare(b.date));
          // Profile: keep the better of each counter, preserve current
          // streak (since merging two timelines doesn't make streak meaningful).
          const mergedProfile = {
            ...curP,
            totalXP: Math.max(curP.totalXP || 0, d.profile?.totalXP || 0),
            completedCount: Math.max(curP.completedCount || 0, d.profile?.completedCount || 0),
          };
          // Screen log: shallow-merge per day, the existing entry wins on
          // collision (the imported one is presumed older / archived).
          const mergedScreen = { ...(d.screen || {}), ...(curS || {}) };
          const mergedLocks = { ...(d.locks || {}), ...(curDL || {}) };
          const mergedCaps = { ...DEFAULT_CAPS, ...(d.caps || {}), ...(curC || {}) };
          await Promise.all([
            saveKV(KEYS.tasks, mergedTasks),
            saveKV(KEYS.projects, mergedProjects),
            saveKV(KEYS.profile, mergedProfile),
            saveKV(KEYS.achievements, mergedAch),
            saveKV(KEYS.weekplan, mergedWP),
            saveKV(KEYS.caps, mergedCaps),
            saveKV(KEYS.screen, mergedScreen),
            saveKV(LOCKS_KEY, mergedLocks),
            saveKV(KEYS.customTags, mergedCustomTags),
          ]);
        }
        notify("Import complete — reloading…");
        setTimeout(() => window.location.reload(), 600);
      } catch (e) {
        console.error("Import failed:", e);
        alert(`Import failed: ${e?.message || e}`);
      }
    };
    input.click();
  }, [previewMode, notify]);

  const exitPreview = useCallback(async () => {
    const snap = await loadKV(PREVIEW_KEY, null);
    if (!snap) { setPreviewMode(false); return; }
    setTasks(snap.tasks || []);
    setProjects(snap.projects || []);
    setProfile(snap.profile || { totalXP: 0, todayXP: 0, streak: 0, lastDate: "", completedCount: 0 });
    setUnlocked(snap.unlocked || []);
    setWeekPlan(snap.weekPlan || null);
    await Promise.all([
      saveKV(KEYS.tasks, snap.tasks || []),
      saveKV(KEYS.projects, snap.projects || []),
      saveKV(KEYS.profile, snap.profile || { totalXP: 0, todayXP: 0, streak: 0, lastDate: "", completedCount: 0 }),
      saveKV(KEYS.achievements, snap.unlocked || []),
      saveKV(KEYS.weekplan, snap.weekPlan || null),
      saveKV(KEYS.caps, snap.caps || DEFAULT_CAPS),
      saveKV(KEYS.screen, snap.screen || {}),
      saveKV(PREVIEW_KEY, null),
    ]);
    setPreviewMode(false);
    notify("Your data is back");
  }, [notify]);

  const shared = {
    tasks, projects, projectsMap, tasksById, profile, lvl, unlocked,
    weekPlan, setWeekPlan, notify,
    completeTask, uncompleteTask, completeDailyOn, uncompleteDailyOn, addTask, updateTask, deleteTask,
    toggleSub, splitTask, toggleChunkDone, pinTaskToDate, updateChunk, moveChunkDate,
    customTags, addCustomTag,
    addChildToProject, removeChildFromProject,
    createProject, renameProject, updateProjectMeta, updateProjectColor, shipProject, unshipProject, deleteProject,
    createProjectFromCapture,
    setView,
    openNewTask, setOpenNewTask,
    startFocus, energy, setEnergy,
    endOfDayOpen, setEndOfDayOpen,
    weeklyDismissed, setWeeklyDismissed,
    previewMode, firstLaunch, enterPreview, dismissFirstLaunch: () => setFirstLaunch(false),
    dayClosed, reopenDay,
    dayLocks, toggleDayLock,
    dayStartHour, updateDayStartHour,
  };

  return (
    <>
      {!ready ? (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-faint)", fontFamily: "var(--font-mono)", fontSize: 13, background: "var(--bg)",
        }}>
          Loading…
        </div>
      ) : (
        <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
          <Sidebar
            view={view}
            setView={setView}
            lvl={lvl}
            profile={profile}
            onOpenHelp={() => setShowHelp(true)}
            previewMode={previewMode}
            onEnterPreview={enterPreview}
            onExitPreview={exitPreview}
            dayStartHour={dayStartHour}
            onChangeDayStartHour={updateDayStartHour}
            onExportData={exportData}
            onImportData={importData}
          />
          <main className="q-scroll" style={{ flex: 1, overflowY: "auto", maxHeight: "100vh" }}>
            {previewMode && (
              <div className="q-preview-banner">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name="bolt" size={12} /> Preview mode — exploring seed data
                </span>
                <button className="q-btn q-btn--outline q-btn--xs" onClick={exitPreview}>
                  Exit preview
                </button>
              </div>
            )}
            {view === "today"    && <TodayView    {...shared} />}
            {view === "queue"    && <QueueView    {...shared} />}
            {view === "pipeline" && <PipelineView {...shared} />}
            {view === "planner"  && <PlannerView  {...shared} />}
            {view === "habits"   && <HabitsView   dayStartHour={dayStartHour} />}
            {view === "trophies" && <TrophiesView unlocked={unlocked} profile={profile} />}
          </main>
          {toast && <Toast msg={toast.msg} xp={toast.xp} />}
          {confetti && <ShipConfetti onDone={() => setConfetti(false)} />}
          {levelUp && (
            <div className="q-level-up" role="status" aria-live="polite">
              <span className="q-level-up-glyph">{levelUp.lvl}</span>
              <span>Level up — <strong style={{ fontWeight: 600 }}>{levelUp.title}</strong></span>
            </div>
          )}
          {showHelp && <ShortcutHelp onClose={() => setShowHelp(false)} />}
          {endOfDayOpen && (
            <EndOfDayDialog
              tasks={tasks}
              weekPlan={weekPlan}
              profile={profile}
              onClose={() => setEndOfDayOpen(false)}
              onCloseDay={closeDay}
              dayStartHour={dayStartHour}
            />
          )}
          {focusTask && (
            <FocusTunnel
              task={focusTask}
              nextTask={nextFocusTask}
              projectName={focusProjectName}
              projectColor={focusProjectColor}
              onComplete={completeFocus}
              onExit={exitFocus}
              onSkip={nextFocusTask ? skipFocus : null}
              onSaveTime={updateTaskFocusTime}
              dayStartHour={dayStartHour}
            />
          )}
        </div>
      )}
    </>
  );
}
