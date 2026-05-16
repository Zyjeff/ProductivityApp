import { useState, useEffect, useCallback, useRef, useMemo } from "react";

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

const TASK_TAGS = ["framer","client","admin","creative","music","personal"];

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
};
const SCHEMA_VERSION = 3;

const NAV_ITEMS = [
  { id: "today",    label: "Today",    glyph: "T", shortcut: "1" },
  { id: "queue",    label: "Queue",    glyph: "Q", shortcut: "2" },
  { id: "pipeline", label: "Pipeline", glyph: "P", shortcut: "3" },
  { id: "planner",  label: "Planner",  glyph: "L", shortcut: "4" },
  { id: "habits",   label: "Habits",   glyph: "H", shortcut: "5" },
  { id: "trophies", label: "Trophies", glyph: "*", shortcut: "6" },
];

const PREVIEW_KEY = "quest_preview_snapshot";

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
  "BASE: admin/email=5-15, simple fix=15-30, component/feature=30-60, " +
  "complex build=60-85, major deliverable=85-100.\n" +
  "SUBTASKS: 0=no change, 1-2=+3-8, 3-4=+10-18, 5+=+20-30.\n" +
  "DESCRIPTION: one-liner=no change, paragraph=+5-12, extensive=+10-20.\n" +
  "DIFFICULTY: easy=simple+no subtasks, medium=some complexity or 1-3 subtasks, " +
  "hard=complex or 4+ subtasks, epic=major or 6+ subtasks.\n\n" +
  "Output schema: {\"xp\":<int 5-100>,\"difficulty\":\"easy|medium|hard|epic\"," +
  "\"reason\":\"<10 words>\"}. No markdown, no commentary.";

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

const AI_PLAN_RULES =
  "You are a scheduler for Jeffrey (freelance UI/UX dev, Netherlands). " +
  "Given a list of unscheduled tasks and a set of workdays with their " +
  "remaining capacity (hours), assign tasks to specific dates.\n\n" +
  "RULES:\n" +
  "1. Never exceed a day's REMAINING capacity. Overflow pushes to the next " +
  "available day.\n" +
  "2. Fill earlier days before later ones. Don't artificially spread out work " +
  "across many days when it could finish sooner.\n" +
  "3. Priority order: urgent > high > medium > low.\n" +
  "4. Pair hard/focus work with mornings; light/admin work with afternoons.\n" +
  "5. Daily recurring tasks are NOT in the task list — they're already " +
  "subtracted from each day's capacity. Do not schedule them.\n" +
  "6. Tasks already on the calendar (when listed) stay put unless you are " +
  "explicitly asked to optimize.\n\n" +
  "Output schema: a JSON array of new assignments, each {\"date\":\"YYYY-MM-DD\"," +
  "\"tasks\":[\"exact task title\"]}. Include only dates that receive at least " +
  "one task. No markdown, no commentary.";

const AI_CAPTURE_RULES =
  "You turn freeform descriptions into structured tasks for a productivity " +
  "app. Be concrete, action-oriented, and concise. Sentence case. No trailing " +
  "periods on titles.\n\n" +
  "Three output schemas keyed by MODE.\n\n" +
  "MODE: TASK — single action item.\n" +
  "{\"title\":\"<5-10 word title>\",\"description\":\"<one-sentence summary or empty if input is already concise>\"}\n\n" +
  "MODE: SUBTASKS — a task with concrete steps.\n" +
  "{\"title\":\"<5-10 word title>\",\"description\":\"<optional one-sentence summary>\"," +
  "\"subtasks\":[\"<~5 word action step>\",...3-6 items, each starting with a verb...]}\n\n" +
  "MODE: PROJECT — a multi-task initiative.\n" +
  "{\"title\":\"<2-5 word project name, noun phrase>\",\"description\":\"<brief goal>\"," +
  "\"tasks\":[{\"title\":\"<~5-8 word action task>\",\"description\":\"\"}, ...3-7 items...]}\n\n" +
  "Rules:\n" +
  "- If the user already provided a good title, keep it but tidy it.\n" +
  "- Don't pad with filler. Specific > generic.\n" +
  "- For PROJECT mode, the tasks should cover the project end-to-end and be " +
  "sized to ~0.5-3h each.\n\n" +
  "Return ONLY valid JSON matching the requested mode's schema. No markdown, " +
  "no commentary, no code fences.";

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

async function aiPlanWeek(tasks, caps, opts = {}) {
  const mode = opts.mode || "fresh";              // "fresh" | "append" | "optimize"
  const existingPlan = Array.isArray(opts.existingPlan) ? opts.existingPlan : [];
  const horizonDays = opts.horizon || 14;

  const allPending = tasks.filter(t => !t.completed);
  if (!allPending.length) return null;
  const dailyTasks = allPending.filter(t => t.recurring === "daily");
  const nonDailyPending = allPending.filter(t => t.recurring !== "daily");
  const dailyHours = dailyTasks.reduce((s, t) => s + (DIFFICULTY[t.difficulty]?.hours || 1.5), 0);
  if (!nonDailyPending.length) return existingPlan.length ? existingPlan : [];

  // Build the date horizon: next `horizonDays` working days starting today.
  // Working days = days with cap > 0. By default Sat/Sun are 0 so they're
  // skipped, but users can raise them to schedule on weekends.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dates = [];
  for (let i = 0; dates.length < horizonDays && i < horizonDays * 2 + 14; i++) {
    const d = addDays(today, i);
    const wd = weekdayName(d);
    if ((caps[wd] || 0) > 0) dates.push(d);
  }
  if (!dates.length) return existingPlan;

  // Storage shape: {date, taskIds: [id]}. Prompt + AI response use titles
  // (more readable for Claude); we translate at the boundary.
  const tasksById = new Map(tasks.map(t => [t.id, t]));
  const titleToId = new Map();
  for (const t of allPending) if (!titleToId.has(t.title)) titleToId.set(t.title, t.id);

  // Per-date scheduled hours from existingPlan (only used for append).
  const scheduledIds = new Set(existingPlan.flatMap(e => e.taskIds || []));
  const dateToScheduledHours = {};
  for (const e of existingPlan) {
    const hrs = (e.taskIds || []).reduce((s, id) => {
      const t = tasksById.get(id);
      return s + (t && t.recurring !== "daily" ? (DIFFICULTY[t.difficulty]?.hours || 1.5) : 0);
    }, 0);
    dateToScheduledHours[e.date] = hrs;
  }

  // Tasks the model needs to place.
  const tasksToPlan = mode === "optimize"
    ? nonDailyPending
    : nonDailyPending.filter(t => !scheduledIds.has(t.id));
  if (!tasksToPlan.length) return existingPlan;

  const sorted = tasksToPlan.slice().sort((a, b) =>
    PRIORITIES[a.priority || "medium"].order - PRIORITIES[b.priority || "medium"].order);

  const dayLines = dates.map(d => {
    const iso = isoDate(d);
    const wd = weekdayName(d);
    const cap = (caps[wd] || 4);
    const used = (mode === "optimize" ? 0 : (dateToScheduledHours[iso] || 0)) + dailyHours;
    const remaining = Math.max(0, cap - used);
    return `- ${iso} ${wd}: cap ${cap}h, remaining ${remaining.toFixed(1)}h`;
  }).join("\n");

  const taskLines = sorted.map(t =>
    `- "${t.title}" — ${t.xp}XP, ${t.difficulty}, ~${DIFFICULTY[t.difficulty]?.hours || 1.5}h, ${t.priority || "medium"}`
  ).join("\n");

  let existingBlock = "";
  if (mode !== "optimize" && existingPlan.length) {
    const lines = existingPlan
      .filter(e => (e.taskIds || []).length)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(e => {
        const titles = (e.taskIds || []).map(id => tasksById.get(id)?.title).filter(Boolean);
        return titles.length ? `- ${e.date}: ${titles.map(t => `"${t}"`).join(", ")}` : "";
      })
      .filter(Boolean)
      .join("\n");
    if (lines) existingBlock = `\nAlready scheduled (do not move):\n${lines}\n`;
  }

  const modeLine = mode === "optimize"
    ? "Mode: OPTIMIZE — replan all listed tasks from scratch."
    : mode === "append"
    ? "Mode: APPEND — only place the listed unscheduled tasks; respect already-scheduled days' remaining capacity."
    : "Mode: FRESH — no prior plan exists; place all listed tasks.";

  const totalH = tasksToPlan.reduce((s, t) => s + (DIFFICULTY[t.difficulty]?.hours || 1.5), 0);

  const dynamic =
    `Today: ${isoDate(today)} (${weekdayName(today)}).\n` +
    `${modeLine}\n` +
    `Daily recurring overhead: ${dailyHours.toFixed(1)}h/day (already subtracted from remaining).\n\n` +
    `Workdays available:\n${dayLines}\n${existingBlock}\n` +
    `Tasks to place (total ~${totalH.toFixed(1)}h, ${tasksToPlan.length} tasks):\n${taskLines}`;

  try {
    const r = await fetch("/api/anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: AI_PLAN_RULES, cache_control: { type: "ephemeral" } },
            { type: "text", text: dynamic },
          ],
        }],
      }),
    });
    const d = await r.json();
    const parsed = JSON.parse(d.content[0].text.replace(/```\w*|```/g, "").trim());
    // Convert returned titles back to IDs; drop unresolvable.
    const newEntries = parsed
      .filter(e => e && e.date && Array.isArray(e.tasks) && e.tasks.length)
      .map(e => ({
        date: e.date,
        taskIds: e.tasks.map(t => titleToId.get(t)).filter(Boolean),
      }))
      .filter(e => e.taskIds.length);

    if (mode === "optimize") return newEntries;

    // Append: merge new entries into existing, preserving order by date.
    const byDate = new Map();
    for (const e of existingPlan) byDate.set(e.date, [...(e.taskIds || [])]);
    for (const e of newEntries) {
      const list = byDate.get(e.date) || [];
      for (const id of e.taskIds) if (!list.includes(id)) list.push(id);
      byDate.set(e.date, list);
    }
    return Array.from(byDate.entries())
      .map(([date, taskIds]) => ({ date, taskIds }))
      .filter(e => e.taskIds.length)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return existingPlan.length ? existingPlan : null;
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

function processRecurring(tasks) {
  const today = new Date().toDateString();
  const now = Date.now();
  return tasks.map(t => {
    if (!t.recurring || t.recurring === "none" || !t.completed) return t;
    if (t.recurring === "daily" && new Date(t.completedAt || 0).toDateString() !== today)
      return { ...t, completed: false, completedAt: null };
    if (t.recurring === "weekly" && t.completedAt && (now - t.completedAt) >= 7 * 86400000)
      return { ...t, completed: false, completedAt: null };
    return t;
  });
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
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
    if (ids.length) weekPlan.push({ date: isoDate(d), taskIds: ids });
    cursor += count;
  }

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

function TaskForm({ initial, onSave, onCancel, isEdit, autoFocus = true }) {
  const [title,     setTitle]     = useState(initial?.title || "");
  const [desc,      setDesc]      = useState(initial?.desc  || "");
  const [notes,     setNotes]     = useState(initial?.notes || "");
  const [tags,      setTags]      = useState(initial?.tags  || []);
  const [subs,      setSubs]      = useState(() => (initial?.subtasks || []).map(s => ({ k: s.id || uid(), title: s.title })));
  const [recurring, setRecurring] = useState(initial?.recurring || "none");
  const [priority,  setPriority]  = useState(initial?.priority  || "medium");
  const [stIn,      setStIn]      = useState("");
  const titleRef = useRef(null);

  useEffect(() => { if (autoFocus && titleRef.current) titleRef.current.focus(); }, [autoFocus]);

  const addSub = () => { if (!stIn.trim()) return; setSubs(p => p.concat([{ k: uid(), title: stIn.trim() }])); setStIn(""); };
  const delSub = (k) => setSubs(p => p.filter(s => s.k !== k));
  const toggleTag = (t) => setTags(p => p.indexOf(t) >= 0 ? p.filter(x => x !== t) : p.concat([t]));

  const canSubmit = title.trim().length > 0;
  const submit = () => {
    if (!canSubmit) return;
    onSave({ title, desc, notes, tags, subtasks: subs.map(s => s.title), recurring, priority });
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

        <div>
          <div className="q-eyebrow" style={{ marginBottom: 6 }}>Tags</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {TASK_TAGS.map(t => (
              <ChipChoice key={t} active={tags.indexOf(t) >= 0} onClick={() => toggleTag(t)}>{t}</ChipChoice>
            ))}
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
  task, projectName,
  onComplete, onUncomplete, onDelete, onEdit, onToggleSub, onSplit, onFocus,
  compact, expanded, onToggleExpand,
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
          {(task.tags?.length || projectName) && (
            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
              {projectName && <Chip kind="accent">{projectName}</Chip>}
              {(task.tags || []).map(tag => <Chip key={tag}>{tag}</Chip>)}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {sub.length > 0 && (
            <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
              {doneSub}/{sub.length}
            </span>
          )}
          <span title={`${diff.label} · ${diff.hours}h`} style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
            color: "var(--text-muted)",
          }}>
            <DifficultyPip d={task.difficulty} />
            {task.xp} XP
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
        </div>
      )}
    </div>
  );
}

/* ───── SIDEBAR ───── */

function Sidebar({ view, setView, lvl, profile, onOpenHelp, previewMode, onEnterPreview, onExitPreview }) {
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
      </div>
    </aside>
  );
}

/* ───── PAGE SHELL ───── */

const captureFocusBus = { focus: () => {} };

function Sparkline({ data, tone = "var(--accent)", width = 70, height = 26 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(1, ...data);
  const stepX = width / Math.max(1, data.length - 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - (v / max) * (height - 3) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePath = "M" + points.join("L");
  const areaPath = linePath + `L${width},${height}L0,${height}Z`;
  const sparkId = "spark-" + Math.random().toString(36).slice(2, 8);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="q-stat-spark" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={sparkId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.28" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${sparkId})`} />
      <path d={linePath} fill="none" stroke={tone} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function TrendBadge({ pct }) {
  if (pct == null) return null;
  const kind = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  const arrow = kind === "up" ? "↑" : kind === "down" ? "↓" : "·";
  return (
    <div className={"q-stat-trend q-stat-trend--" + kind}>
      <span style={{ fontFamily: "var(--font-mono)" }}>{arrow}</span>
      {Math.abs(pct)}% vs 7d avg
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
        onCreateTask({
          title: result.title || v.slice(0, 60),
          desc: result.description || "",
          notes: "",
          tags: [],
          subtasks: mode === "subtasks" && Array.isArray(result.subtasks) ? result.subtasks : [],
          recurring: "none",
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
  weekPlan, setWeekPlan, completeTask, uncompleteTask,
  addTask, updateTask, deleteTask, toggleSub, splitTask, setView,
  openNewTask, setOpenNewTask, createProjectFromCapture,
  startFocus, energy, setEnergy,
  endOfDayOpen, setEndOfDayOpen, weeklyDismissed, setWeeklyDismissed,
  previewMode,
}) {
  const [editing, setEditing] = useState(null);
  const [exp,     setExp]     = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [screenLog, setScreenLog] = useState({});

  useEffect(() => { loadKV(KEYS.screen, {}).then(setScreenLog); }, []);

  const tName = todayName();
  const today = todayKey();
  const entry = screenLog[today] || { xOpens: 0, ytOpens: 0, mobileHours: null };
  const patchScreen = (obj) => {
    const next = { ...screenLog, [today]: { ...entry, ...obj } };
    setScreenLog(next); saveKV(KEYS.screen, next);
  };

  const allPending = tasks.filter(t => !t.completed);
  const dailyPending = allPending.filter(t => t.recurring === "daily");
  const todayDateStr = new Date().toDateString();
  const todayDone = tasks.filter(t => t.completed && t.completedAt && new Date(t.completedAt).toDateString() === todayDateStr);

  const todayIso = isoDate(new Date());
  const todayPlanData = weekPlan
    ? (weekPlan.find(d => d.date === todayIso) || { taskIds: [] })
    : null;
  const todayScheduled = todayPlanData
    ? (todayPlanData.taskIds || []).map(id => tasksById.get(id)).filter(Boolean)
    : [];
  const todayPlanTasks = sortForEnergy(dailyPending.concat(todayScheduled), energy);
  const planXP = todayPlanTasks.reduce((s,t) => s + (t.xp || 0), 0);
  const planDone = todayPlanTasks.filter(t => t.completed).length;

  const generatePlan = () => {
    setPlanLoading(true);
    aiPlanWeek(tasks, DEFAULT_CAPS, { mode: weekPlan ? "append" : "fresh", existingPlan: weekPlan || [] }).then(p => {
      if (p) { setWeekPlan(p); saveKV(KEYS.weekplan, p); }
      setPlanLoading(false);
    });
  };

  const handleAdd = (data) => { addTask(data); setOpenNewTask(false); };
  const handleUpdate = (data) => updateTask(editing.id, data).then(() => setEditing(null));

  const activeProjects = projects.filter(p => !p.completedAt);
  const readyToShip = activeProjects.filter(p => progressOfProject(p, tasksById) === 100 && (p.childTaskIds || []).length > 0);

  const trendStats = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      days.push(d.toDateString());
    }
    const xpByDay = days.map(s => tasks
      .filter(t => t.completed && t.completedAt && new Date(t.completedAt).toDateString() === s)
      .reduce((sum, t) => sum + (t.xp || 0), 0));
    const doneByDay = days.map(s => tasks
      .filter(t => t.completed && t.completedAt && new Date(t.completedAt).toDateString() === s).length);
    const pctTrend = (today, hist) => {
      const avg = hist.reduce((a, b) => a + b, 0) / Math.max(1, hist.length);
      if (avg === 0) return null;
      return Math.round(((today - avg) / avg) * 100);
    };
    return {
      xpByDay,
      doneByDay,
      xpTrend:   pctTrend(xpByDay[6],   xpByDay.slice(0, 6)),
      doneTrend: pctTrend(doneByDay[6], doneByDay.slice(0, 6)),
    };
  }, [tasks]);

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

  const dow = new Date().getDay();
  const showWeeklyPulse = !weeklyDismissed && (previewMode || dow === 1 || dow === 2);
  const dismissWeekly = () => {
    const wid = isoDate(mondayOf(new Date()));
    saveKV("quest_pulse_dismissed", wid);
    setWeeklyDismissed(true);
  };

  return (
    <div className="q-view-pad" style={{ padding: VIEW_PAD, maxWidth: 1180, margin: "0 auto" }}>
      {showWeeklyPulse && <WeeklyPulse tasks={tasks} onDismiss={dismissWeekly} />}
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
          <div className="q-stat-label">Today's XP</div>
          <div className="q-stat-value">{profile.todayXP}</div>
          <TrendBadge pct={trendStats.xpTrend} />
          <Sparkline data={trendStats.xpByDay} tone="var(--accent)" />
        </div>
        <div className="q-stat">
          <div className="q-stat-label">Streak</div>
          <div className="q-stat-value" style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            {profile.streak}<span style={{ fontSize: 13, color: "var(--text-faint)", fontWeight: 500 }}>d</span>
          </div>
          {profile.streak > 0 && (
            <div className="q-stat-trend q-stat-trend--flat">
              <Icon name="flame" size={11} /> {profile.streak === 1 ? "first day" : "going"}
            </div>
          )}
        </div>
        <div className="q-stat">
          <div className="q-stat-label">Done today</div>
          <div className="q-stat-value">{todayDone.length}</div>
          <TrendBadge pct={trendStats.doneTrend} />
          <Sparkline data={trendStats.doneByDay} tone="var(--success)" />
        </div>
        <div className="q-stat">
          <div className="q-stat-label">Pending</div>
          <div className="q-stat-value">{allPending.length}</div>
          <div className="q-stat-trend q-stat-trend--flat">
            {readyToShip.length > 0 ? `${readyToShip.length} ready to ship` : "open queue"}
          </div>
        </div>
      </div>

      <div className="q-today-grid" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
        <div>
          {openNewTask && <div style={{ marginBottom: 12 }}><TaskForm onSave={handleAdd} onCancel={() => setOpenNewTask(false)} /></div>}
          {editing &&  <div style={{ marginBottom: 12 }}><TaskForm initial={editing} isEdit onSave={handleUpdate} onCancel={() => setEditing(null)} /></div>}

          <Eyebrow right={
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <EnergyToggle value={energy} onChange={setEnergy} />
              {todayDone.length > 0 && (
                <button className="q-link" onClick={() => setEndOfDayOpen(true)} title="Close the day">
                  Close day →
                </button>
              )}
              <button className="q-link" onClick={() => setView("queue")}>Full queue →</button>
            </div>
          }>
            Today's plan
          </Eyebrow>
          {todayPlanTasks.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {todayPlanTasks.map(t => (
                <TaskRow key={t.id} task={t}
                  onComplete={completeTask} onUncomplete={uncompleteTask}
                  onEdit={(task) => { setOpenNewTask(false); setEditing(task); }}
                  onDelete={deleteTask} onToggleSub={toggleSub} onSplit={splitTask} onFocus={startFocus}
                  projectName={t.projectId && projectsMap[t.projectId] ? projectsMap[t.projectId].title : null}
                  expanded={exp === t.id} onToggleExpand={() => setExp(exp === t.id ? null : t.id)}
                />
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                <span>{planDone}/{todayPlanTasks.length} done</span>
                <span>{planXP} XP planned</span>
              </div>
            </div>
          ) : (
            (() => {
              const upcoming = (weekPlan || [])
                .filter(e => e.date > todayIso && (e.taskIds || []).length > 0)
                .sort((a, b) => a.date.localeCompare(b.date))[0];
              const tWeekday = weekdayName(new Date());
              const isWeekendDay = tWeekday === "Saturday" || tWeekday === "Sunday";
              if (upcoming) {
                const upDate = parseIsoDate(upcoming.date);
                const dayLabel = upDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
                const n = upcoming.taskIds.length;
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
                    {allPending.length > 0 && (
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

          {activeProjects.length > 0 && (
            <div className="q-card" style={{ padding: 14 }}>
              <Eyebrow right={<button className="q-link" onClick={() => setView("pipeline")}>All →</button>}>
                Projects
              </Eyebrow>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activeProjects.slice(0, 5).map(p => {
                  const pct = progressOfProject(p, tasksById);
                  const total = (p.childTaskIds || []).length;
                  const done = (p.childTaskIds || []).map(id => tasksById.get(id)).filter(t => t && t.completed).length;
                  return (
                    <div key={p.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                        <span style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>{done}/{total}</span>
                      </div>
                      <ProgressBar pct={pct} tone={pct === 100 ? "var(--success)" : "var(--accent)"} height={3} />
                    </div>
                  );
                })}
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
    </div>
  );
}

/* ───── QUEUE VIEW ───── */

function QueueView({
  tasks, projects, projectsMap, tasksById, startFocus, energy,
  completeTask, uncompleteTask, addTask, updateTask,
  deleteTask, toggleSub, splitTask, createProjectFromCapture, setView,
  openNewTask, setOpenNewTask,
}) {
  const [filter, setFilter] = useState("pending");
  const [sortBy, setSortBy] = useState("priority");
  const [editing, setEditing] = useState(null);
  const [exp,     setExp]     = useState(null);
  const [projectFilter, setProjectFilter] = useState(null);

  const filtered = tasks
    .filter(t => {
      if (filter === "pending")   return !t.completed;
      if (filter === "recurring") return t.recurring && t.recurring !== "none";
      if (filter === "done")      return t.completed;
      return true;
    })
    .filter(t => !projectFilter || t.projectId === projectFilter);
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

  return (
    <div className="q-view-pad" style={{ padding: VIEW_PAD, maxWidth: 880, margin: "0 auto" }}>
      <PageHeader
        eyebrow="All tasks"
        title="Queue"
        sub={`${list.length} ${filter === "pending" ? "pending" : filter}${projectFilter && projectsMap[projectFilter] ? ` · filtered by ${projectsMap[projectFilter].title}` : ""}`}
        right={<QuickCapture
          onCreateTask={handleAdd}
          onCreateProject={(data) => { createProjectFromCapture(data); setView("pipeline"); }}
          onOpenManual={() => { setEditing(null); setOpenNewTask(true); }}
        />}
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
      </div>

      {openNewTask && <div style={{ marginBottom: 12 }}><TaskForm onSave={handleAdd} onCancel={() => setOpenNewTask(false)} /></div>}
      {editing  && <div style={{ marginBottom: 12 }}><TaskForm initial={editing} isEdit onSave={handleUpdate} onCancel={() => setEditing(null)} /></div>}

      {list.length === 0 ? (
        <EmptyState>Nothing here.</EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {list.map(t => (
            <TaskRow key={t.id} task={t}
              onComplete={completeTask} onUncomplete={uncompleteTask}
              onEdit={(task) => { setOpenNewTask(false); setEditing(task); }}
              onDelete={deleteTask} onToggleSub={toggleSub} onSplit={splitTask} onFocus={startFocus}
              projectName={t.projectId && projectsMap[t.projectId] ? projectsMap[t.projectId].title : null}
              expanded={exp === t.id} onToggleExpand={() => setExp(exp === t.id ? null : t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───── PIPELINE VIEW (ship-list lens) ───── */

function PipelineView({
  tasks, projects, projectsMap, tasksById,
  completeTask, uncompleteTask, addTask, addChildToProject,
  removeChildFromProject, deleteTask, createProject, renameProject,
  shipProject, unshipProject, deleteProject, setView,
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
  const nameInputRef = useRef(null);
  const taskInputRef = useRef(null);
  useEffect(() => { if (adding && nameInputRef.current) nameInputRef.current.focus(); }, [adding]);
  useEffect(() => { if (addingTaskTo && taskInputRef.current) taskInputRef.current.focus(); }, [addingTaskTo]);

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
          const tone = isReady ? "var(--success)" : "var(--accent)";
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
                  ) : (
                    <button className="q-btn q-btn--ghost q-btn--sm" style={{ marginTop: 8 }} onClick={() => { setAddingTaskTo(p.id); setNewTaskName(""); }}>
                      <Icon name="plus" size={11} /> Add task
                    </button>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                    <button className="q-btn q-btn--ghost q-btn--sm" onClick={() => startRename(p)}>Rename</button>
                    <button className="q-btn q-btn--ghost q-btn--sm" onClick={() => deleteProject(p.id)} style={{ color: "var(--danger)" }}>Delete</button>
                    <div style={{ flex: 1 }} />
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

function PlannerView({ tasks, tasksById, weekPlan, setWeekPlan, completeTask, uncompleteTask }) {
  const [loading, setLoading] = useState(false);
  const [loadMode, setLoadMode] = useState(null); // "fresh" | "append" | "optimize"
  const [caps, setCaps] = useState(DEFAULT_CAPS);
  const [editingCap, setEditingCap] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));

  useEffect(() => { loadKV(KEYS.caps, DEFAULT_CAPS).then(c => setCaps({ ...DEFAULT_CAPS, ...c })); }, []);

  const tName = todayName();
  const todayMonday = useMemo(() => mondayOf(new Date()), []);
  const weekOffset = Math.round((weekStart - todayMonday) / 86400000 / 7);
  const canPrev = weekOffset > -52;
  const canNext = weekOffset <  52;

  const allPending     = tasks.filter(t => !t.completed);
  const dailyPending   = allPending.filter(t => t.recurring === "daily");
  const nonDailyPending = allPending.filter(t => t.recurring !== "daily");
  const dailyHours = dailyPending.reduce((s,t) => s + (DIFFICULTY[t.difficulty]?.hours || 1.5), 0);
  const totalH = nonDailyPending.reduce((s,t) => s + (DIFFICULTY[t.difficulty]?.hours || 1.5), 0);

  const scheduledIds = new Set((weekPlan || []).flatMap(e => e.taskIds || []));
  const unscheduledCount = nonDailyPending.filter(t => !scheduledIds.has(t.id)).length;
  const hasPlan = Array.isArray(weekPlan) && weekPlan.length > 0;

  const updateCap = (day, val) => {
    const raw = parseFloat(val);
    const v = isNaN(raw) ? 0 : Math.max(0, Math.min(10, raw));
    const next = { ...caps, [day]: v };
    setCaps(next); saveKV(KEYS.caps, next);
  };

  const runPlan = (mode) => {
    setLoading(true); setLoadMode(mode);
    aiPlanWeek(tasks, caps, { mode, existingPlan: weekPlan || [] }).then(p => {
      if (p != null) { setWeekPlan(p); saveKV(KEYS.weekplan, p); }
      setLoading(false); setLoadMode(null);
    });
  };

  const moveTask = (taskId, targetIso) => {
    const current = Array.isArray(weekPlan) ? weekPlan : [];
    const stripped = current.map(entry => ({
      ...entry,
      taskIds: (entry.taskIds || []).filter(id => id !== taskId),
    })).filter(entry => entry.taskIds.length > 0 || entry.date === targetIso);
    let found = false;
    const updated = stripped.map(entry => {
      if (entry.date === targetIso) {
        found = true;
        if (!(entry.taskIds || []).includes(taskId)) return { ...entry, taskIds: [...(entry.taskIds || []), taskId] };
      }
      return entry;
    });
    if (!found) updated.push({ date: targetIso, taskIds: [taskId] });
    updated.sort((a, b) => a.date.localeCompare(b.date));
    setWeekPlan(updated); saveKV(KEYS.weekplan, updated);
  };

  const days = useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i++) out.push(addDays(weekStart, i));
    return out;
  }, [weekStart]);

  const todayIso = isoDate(new Date());

  return (
    <div className="q-view-pad" style={{ padding: VIEW_PAD, maxWidth: 1080, margin: "0 auto" }}>
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
              <button className="q-btn q-btn--primary" disabled={loading} onClick={() => runPlan("append")} title="Schedule unscheduled tasks after existing ones">
                {loading && loadMode === "append" ? "Scheduling…" : `Schedule ${unscheduledCount} pending`}
              </button>
            )}
            {hasPlan && (
              <button className="q-btn q-btn--outline" disabled={loading} onClick={() => runPlan("optimize")} title="Replan everything from scratch — may move existing tasks">
                {loading && loadMode === "optimize" ? "Optimizing…" : "Optimize all"}
              </button>
            )}
          </div>
        }
      />

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
          <button
            className="q-icon-btn"
            disabled={!canPrev}
            onClick={() => canPrev && setWeekStart(addDays(weekStart, -7))}
            aria-label="Previous week"
            style={{ padding: 6, opacity: canPrev ? 1 : 0.3 }}
          >
            <Icon name="chevron" size={14} />
            <span style={{ transform: "rotate(90deg)", display: "none" }} />
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
            style={{ padding: 6, opacity: canNext ? 1 : 0.3 }}
          >
            <Icon name="chevronR" size={14} />
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
          <div className="q-planner-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 10 }}>
            {days.map((dateObj) => {
              const iso = isoDate(dateObj);
              const wd = weekdayName(dateObj);
              const data = (weekPlan || []).find(d => d.date === iso) || { taskIds: [] };
              const isToday = iso === todayIso;
              const isPast = iso < todayIso;
              const scheduledTasks = (data.taskIds || []).map(id => tasksById.get(id)).filter(Boolean);
              const dayScheduledH = scheduledTasks.reduce((s, t) => s + (DIFFICULTY[t.difficulty]?.hours || 1.5), 0);
              const dayH = dayScheduledH + dailyHours;
              const cap = caps[wd] != null ? caps[wd] : 4;
              const isOff = cap === 0;
              const loadPct = isOff ? 0 : Math.min(Math.round((dayH / cap) * 100), 100);
              const loadColor = loadPct > 90 ? "var(--danger)" : loadPct > 65 ? "var(--warning)" : "var(--success)";
              const dayXP = scheduledTasks.reduce((s, t) => s + (t.xp || 0), 0) + dailyPending.reduce((s, t) => s + (t.xp || 0), 0);
              const isDragOver = dragOver === iso;
              return (
                <div key={iso}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(iso); }}
                  onDragLeave={() => { if (dragOver === iso) setDragOver(null); }}
                  onDrop={(e) => { e.preventDefault(); if (draggedId) moveTask(draggedId, iso); setDraggedId(null); setDragOver(null); }}
                  className="q-card"
                  style={{
                    padding: 12,
                    borderColor: isDragOver ? "var(--accent)" : isToday ? "var(--accent)" : "var(--border)",
                    background: isDragOver ? "var(--accent-soft)" : "var(--bg-elev)",
                    opacity: isOff && scheduledTasks.length === 0 && dailyPending.length === 0
                      ? 0.4
                      : (isPast && scheduledTasks.length === 0 && dailyPending.length === 0 ? 0.45 : 1),
                    transition: "border-color var(--t-fast), background var(--t-fast)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: isToday ? "var(--accent)" : "var(--text)" }}>{wd.slice(0, 3)}</span>
                      <span style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>{dateObj.getDate()}</span>
                      {isOff && <span style={{ fontSize: 9, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>off</span>}
                    </div>
                    {!isOff && dayH > 0 && (
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 500, color: loadColor }}>
                        {dayH.toFixed(1)}/{cap}h
                      </span>
                    )}
                  </div>
                  {dayH > 0 && <div style={{ marginBottom: 8 }}><ProgressBar pct={loadPct} tone={loadColor} height={3} /></div>}
                  {dailyPending.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8, paddingBottom: 8, borderBottom: "1px dashed var(--border)" }}>
                      {dailyPending.map((t, i) => {
                        const isDoneToday = t.completed && isToday;
                        return (
                          <div key={"d-"+i} style={{
                            fontSize: 11, padding: "3px 7px", borderRadius: "var(--r-sm)",
                            background: "var(--bg-soft)",
                            borderLeft: "2px solid " + (DIFFICULTY[t.difficulty]?.tone || "var(--info)"),
                            color: isDoneToday ? "var(--text-faint)" : "var(--text-muted)",
                            textDecoration: isDoneToday ? "line-through" : "none",
                            display: "flex", alignItems: "center", gap: 5,
                          }}>
                            <Icon name="recur" size={9} />
                            <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, minHeight: scheduledTasks.length === 0 ? 28 : 0 }}>
                    {scheduledTasks.length === 0 ? (
                      <div style={{ fontSize: 10, color: "var(--text-faint)", fontStyle: "italic", paddingTop: 2 }}>
                        {dailyPending.length > 0 ? "" : "Free"}
                      </div>
                    ) : scheduledTasks.map((t) => (
                      <div key={t.id}
                        draggable={!t.completed}
                        onDragStart={(e) => { setDraggedId(t.id); e.dataTransfer.effectAllowed = "move"; }}
                        onDragEnd={() => { setDraggedId(null); setDragOver(null); }}
                        style={{
                          fontSize: 11, padding: "5px 7px", borderRadius: "var(--r-sm)",
                          background: t.completed ? "var(--bg-soft)" : "var(--bg-elev)",
                          border: "1px solid var(--border)",
                          borderLeft: "2px solid " + (t.completed ? "var(--border)" : (DIFFICULTY[t.difficulty]?.tone || "var(--info)")),
                          color: t.completed ? "var(--text-faint)" : "var(--text)",
                          opacity: t.completed ? 0.6 : (draggedId === t.id ? 0.35 : 1),
                          cursor: t.completed ? "default" : "grab",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <CompleteButton
                            done={t.completed}
                            tone={DIFFICULTY[t.difficulty]?.tone}
                            onComplete={() => completeTask(t.id)}
                            onReopen={() => uncompleteTask(t.id)}
                          />
                          <span style={{
                            fontSize: 11, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            textDecoration: t.completed ? "line-through" : "none",
                          }}>{t.title}</span>
                        </div>
                        <div style={{ fontSize: 9, color: "var(--text-faint)", fontFamily: "var(--font-mono)", marginTop: 3, marginLeft: 24 }}>
                          {t.xp} XP · {DIFFICULTY[t.difficulty]?.hours || 1.5}h
                        </div>
                      </div>
                    ))}
                  </div>
                  {dayXP > 0 && <div style={{ marginTop: 8, fontSize: 9, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>{dayXP} XP</div>}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "center", marginTop: 10 }}>
            Drag scheduled tasks between days · Navigate weeks with ← →
          </div>
        </div>
      )}
    </div>
  );
}

/* ───── HABITS VIEW ───── */

function HabitsView() {
  const [log, setLog] = useState({});
  const [mobileInput, setMobileInput] = useState("");
  const [editingCounter, setEditingCounter] = useState(null);
  const [counterDraft, setCounterDraft] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => { loadKV(KEYS.screen, {}).then(d => { setLog(d); setReady(true); }); }, []);

  const today = todayKey();
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

function TrophiesView({ unlocked }) {
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

function WeeklyPulse({ tasks, onDismiss }) {
  const stats = useMemo(() => {
    const thisMonday = mondayOf(new Date());
    const lastWeekStart = addDays(thisMonday, -7);
    const lastWeekEnd   = thisMonday;
    const lw = tasks.filter(t => {
      if (!t.completed || !t.completedAt) return false;
      const d = new Date(t.completedAt);
      return d >= lastWeekStart && d < lastWeekEnd;
    });
    const days = [
      { label: "Mon" }, { label: "Tue" }, { label: "Wed" },
      { label: "Thu" }, { label: "Fri" }, { label: "Sat" }, { label: "Sun" },
    ].map(d => ({ ...d, count: 0, xp: 0 }));
    for (const t of lw) {
      const d = new Date(t.completedAt);
      const wd = d.getDay();
      const idx = wd === 0 ? 6 : wd - 1;
      days[idx].count += 1;
      days[idx].xp += (t.xp || 0);
    }
    const best = days.reduce((b, d) => d.count > b.count ? d : b, days[0]);
    return {
      total: lw.length,
      xp: lw.reduce((s, t) => s + (t.xp || 0), 0),
      days, best,
    };
  }, [tasks]);

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

function EndOfDayDialog({ tasks, weekPlan, profile, onClose }) {
  const [screen, setScreen] = useState({ xOpens: 0, ytOpens: 0, mobileHours: null });
  const [mobile, setMobile] = useState("");
  useEffect(() => {
    loadKV(KEYS.screen, {}).then(d => {
      setScreen(d[todayKey()] || { xOpens: 0, ytOpens: 0, mobileHours: null });
    });
  }, []);

  const todayStr = new Date().toDateString();
  const todayIso = isoDate(new Date());
  const completedToday = tasks.filter(t => t.completed && t.completedAt &&
    new Date(t.completedAt).toDateString() === todayStr);
  const xpToday = completedToday.reduce((s, t) => s + (t.xp || 0), 0);
  const todayEntry = (weekPlan || []).find(e => e.date === todayIso);
  const scheduledTomorrow = (todayEntry?.taskIds || [])
    .map(id => tasks.find(t => t.id === id))
    .filter(t => t && !t.completed);

  const logScreen = () => {
    if (!mobile) return;
    const hrs = parseFloat(mobile) || 0;
    loadKV(KEYS.screen, {}).then(d => {
      const next = { ...d, [todayKey()]: { ...screen, mobileHours: hrs } };
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
            <div className="q-eyebrow" style={{ marginBottom: 8 }}>
              Rolling to next available day · {scheduledTomorrow.length}
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

        <button className="q-btn q-btn--primary" style={{ width: "100%" }} onClick={onClose}>
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

function FocusTunnel({ task, nextTask, projectName, onComplete, onExit, onSkip }) {
  const [running, setRunning] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef(null);
  const baseRef = useRef(0);

  useEffect(() => {
    baseRef.current = 0;
    setElapsedMs(0);
    setRunning(true);
  }, [task?.id]);

  useEffect(() => {
    if (!running) return;
    startedAtRef.current = Date.now();
    const id = setInterval(() => {
      setElapsedMs(baseRef.current + (Date.now() - startedAtRef.current));
    }, 250);
    return () => {
      clearInterval(id);
      baseRef.current = baseRef.current + (Date.now() - startedAtRef.current);
    };
  }, [running]);

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

  if (!task) return null;
  const sec = Math.floor(elapsedMs / 1000);
  const p2 = (n) => String(n).padStart(2, "0");
  const hh = Math.floor(sec / 3600);
  const mm = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  const timeStr = hh > 0 ? `${hh}:${p2(mm)}:${p2(ss)}` : `${p2(mm)}:${p2(ss)}`;
  const target = DIFFICULTY[task.difficulty]?.hours || 1.5;

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
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button className="q-btn q-btn--outline" onClick={() => setRunning(r => !r)} style={{ minWidth: 130 }}>
            {running ? "Pause" : "Resume"} <span className="q-kbd" style={{ marginLeft: 4 }}>Space</span>
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

export default function App() {
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
  const [ready,    setReady]    = useState(false);
  const planClearedRef = useRef(false);
  const prevLvlRef     = useRef(null);
  const levelUpTimerRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    (async () => {
      await runMigrations();
      const [t, p, a, w, pr] = await Promise.all([
        loadKV(KEYS.tasks, []),
        loadKV(KEYS.profile, { totalXP: 0, todayXP: 0, streak: 0, lastDate: "", completedCount: 0 }),
        loadKV(KEYS.achievements, []),
        loadKV(KEYS.weekplan, null),
        loadKV(KEYS.projects, []),
      ]);
      const todayStr = new Date().toDateString();
      const yesterStr = new Date(Date.now() - 86400000).toDateString();
      let streak = p.streak || 0;
      let todayXP = p.todayXP || 0;
      if (p.lastDate !== todayStr) {
        todayXP = 0;
        if (p.lastDate !== yesterStr) streak = 0;
      }
      const processed = processRecurring(t);
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
      setPreviewMode(!!snap);

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
    const todayIso = isoDate(new Date());
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
  }, [tasks, weekPlan, ready, notify]);

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
      const te = sl[todayKey()] || {};
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
  }, [projects, notify]);

  const completeTask = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    if (!task || task.completed) return;
    const todayStr  = new Date().toDateString();
    const yesterStr = new Date(Date.now() - 86400000).toDateString();
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
  }, [tasks, profile, unlocked, projects, notify, checkAchievements]);

  const uncompleteTask = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    if (!task || !task.completed) return;
    const todayStr = new Date().toDateString();
    const wasToday = task.completedAt && new Date(task.completedAt).toDateString() === todayStr;
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
  }, [tasks, profile, projects, notify]);

  const addTask = useCallback((data) => {
    const optimistic = {
      id: uid(),
      title: data.title.trim(),
      desc: data.desc || "", notes: data.notes || "",
      tags: data.tags || [],
      subtasks: (data.subtasks || []).map((s, i) => ({ id: uid() + i, title: s, done: false })),
      xp: 20, difficulty: "medium", reason: "scoring…",
      recurring: data.recurring || "none",
      priority: data.priority || "medium",
      projectId: data.projectId || null,
      completed: false,
      createdAt: Date.now(),
    };
    setTasks(prev => {
      const next = [optimistic, ...prev];
      saveKV(KEYS.tasks, next);
      return next;
    });
    notify("Task added");

    aiScore(data.title, data.desc, data.subtasks, data.tags, data.notes).then(sc => {
      setTasks(prev => {
        const next = prev.map(t => t.id === optimistic.id
          ? { ...t, xp: sc.xp || 20, difficulty: sc.difficulty || "medium", reason: sc.reason || "auto" }
          : t);
        saveKV(KEYS.tasks, next);
        return next;
      });
    });
    return Promise.resolve(optimistic);
  }, [notify]);

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
    return aiScore(data.title, data.desc, data.subtasks, data.tags, data.notes).then(sc => {
      setTasks(prev => {
        const next = prev.map(t => t.id === id
          ? { ...t, xp: sc.xp || existing.xp, difficulty: sc.difficulty || existing.difficulty, reason: sc.reason || existing.reason }
          : t);
        saveKV(KEYS.tasks, next);
        return next;
      });
    });
  }, [tasks]);

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

  const toggleSub = useCallback((tid, sid) => {
    const upd = tasks.map(t => t.id !== tid ? t : {
      ...t, subtasks: t.subtasks.map(s => s.id === sid ? { ...s, done: !s.done } : s),
    });
    setTasks(upd); saveKV(KEYS.tasks, upd);
  }, [tasks]);

  const splitTask = useCallback((taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks || task.subtasks.length === 0) return;
    const projectId = "p-" + uid();
    const proj = {
      id: projectId, title: task.title, desc: task.desc || "", notes: task.notes || "",
      tags: task.tags || [], type: "other",
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
          ? { ...t, xp: map[t.id].xp || 15, difficulty: map[t.id].difficulty || "medium", reason: map[t.id].reason || "auto" }
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
      notes: "", tags: [], type: "other",
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
            ? { ...t, xp: map[t.id].xp || 15, difficulty: map[t.id].difficulty || "medium", reason: map[t.id].reason || "auto" }
            : t);
          saveKV(KEYS.tasks, next);
          return next;
        });
      });
    }
    return projectId;
  }, [tasks, projects, notify]);

  const addChildToProject = useCallback((projectId, data) => {
    const child = {
      id: "ct-" + uid(), title: data.title.trim(), desc: "", notes: "", tags: [],
      subtasks: [], xp: 15, difficulty: "medium", reason: "scoring…",
      recurring: "none", priority: data.priority || "medium",
      projectId, completed: false, createdAt: Date.now(),
    };
    const updT = tasks.concat([child]);
    const updP = projects.map(p => p.id === projectId ? { ...p, childTaskIds: (p.childTaskIds || []).concat([child.id]) } : p);
    setTasks(updT); setProjects(updP);
    saveKV(KEYS.tasks, updT); saveKV(KEYS.projects, updP);

    aiScore(data.title, "", [], [], "").then(sc => {
      setTasks(prev => {
        const next = prev.map(t => t.id === child.id
          ? { ...t, xp: sc.xp || 15, difficulty: sc.difficulty || "medium", reason: sc.reason || "auto" }
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
      type: type || "other",
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
  const todayIso = isoDate(new Date());
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
    weekPlan, setWeekPlan,
    completeTask, uncompleteTask, addTask, updateTask, deleteTask,
    toggleSub, splitTask, addChildToProject, removeChildFromProject,
    createProject, renameProject, shipProject, unshipProject, deleteProject,
    createProjectFromCapture,
    setView,
    openNewTask, setOpenNewTask,
    startFocus, energy, setEnergy,
    endOfDayOpen, setEndOfDayOpen,
    weeklyDismissed, setWeeklyDismissed,
    previewMode,
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
            {view === "habits"   && <HabitsView   />}
            {view === "trophies" && <TrophiesView unlocked={unlocked} />}
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
            />
          )}
          {focusTask && (
            <FocusTunnel
              task={focusTask}
              nextTask={nextFocusTask}
              projectName={focusProjectName}
              onComplete={completeFocus}
              onExit={exitFocus}
              onSkip={nextFocusTask ? skipFocus : null}
            />
          )}
        </div>
      )}
    </>
  );
}
