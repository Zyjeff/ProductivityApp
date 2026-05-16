import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ───────────────────────────────────────────────────────────────────
   Quest — personal OS for shipping
   merged from quest + ship-list, redesigned end-to-end
   ─────────────────────────────────────────────────────────────────── */

const TOKENS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

:root {
  --bg: #faf7f2;
  --bg-elev: #ffffff;
  --bg-soft: #f3ede1;
  --bg-muted: #ece5d2;
  --border: #e4dcca;
  --border-strong: #d4cab2;
  --text: #1c1b17;
  --text-muted: #67635a;
  --text-faint: #9c9685;
  --accent: #c45a28;
  --accent-strong: #a64619;
  --accent-soft: #fbece1;
  --success: #2c7a4e;
  --success-soft: #e1f1e8;
  --danger: #b53b32;
  --danger-soft: #f7e1dd;
  --warning: #a86a18;
  --warning-soft: #f6ead7;
  --info: #2766a8;
  --info-soft: #e2ecf6;
  --r-sm: 4px; --r-md: 6px; --r-lg: 8px;
  --t-fast: 110ms cubic-bezier(.2,.8,.2,1);
  --t-med: 170ms cubic-bezier(.2,.8,.2,1);
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', monospace;
}
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg); color: var(--text);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  font-feature-settings: 'cv11','ss01';
}
::placeholder { color: var(--text-faint); }
::selection { background: var(--accent-soft); color: var(--text); }

.q-input, .q-textarea {
  width: 100%; background: var(--bg-elev); color: var(--text);
  border: 1px solid var(--border); border-radius: var(--r-md);
  padding: 8px 10px; font: 14px var(--font-sans);
  transition: border-color var(--t-fast), background var(--t-fast), box-shadow var(--t-fast);
}
.q-input:hover, .q-textarea:hover { border-color: var(--border-strong); }
.q-input:focus, .q-textarea:focus {
  outline: none; border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.q-textarea { resize: none; line-height: 1.5; font-size: 13px; }
.q-input--sm { padding: 6px 9px; font-size: 13px; }

.q-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border: 1px solid transparent; border-radius: var(--r-md);
  padding: 7px 12px; font: 500 13px var(--font-sans);
  cursor: pointer; background: transparent; color: var(--text);
  transition: background var(--t-fast), border-color var(--t-fast), color var(--t-fast);
  user-select: none; white-space: nowrap;
}
.q-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--accent-soft); border-color: var(--accent); }
.q-btn[disabled] { opacity: 0.4; cursor: not-allowed; }
.q-btn--primary { background: var(--text); color: var(--bg); }
.q-btn--primary:hover:not([disabled]) { background: #000; }
.q-btn--accent { background: var(--accent); color: #fff; }
.q-btn--accent:hover:not([disabled]) { background: var(--accent-strong); }
.q-btn--ghost { color: var(--text-muted); }
.q-btn--ghost:hover:not([disabled]) { background: var(--bg-soft); color: var(--text); }
.q-btn--outline { border-color: var(--border); color: var(--text); background: var(--bg-elev); }
.q-btn--outline:hover:not([disabled]) { border-color: var(--border-strong); background: var(--bg-soft); }
.q-btn--success { background: var(--success); color: #fff; }
.q-btn--success:hover:not([disabled]) { background: #1f5c3a; }
.q-btn--sm { padding: 4px 9px; font-size: 12px; }
.q-btn--xs { padding: 3px 7px; font-size: 11px; }

.q-icon-btn {
  background: transparent; border: none; cursor: pointer;
  color: var(--text-faint); padding: 4px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--r-sm);
  transition: color var(--t-fast), background var(--t-fast);
}
.q-icon-btn:hover { color: var(--text); background: var(--bg-soft); }
.q-icon-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--accent-soft); }

.q-card {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
}

.q-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 7px; font: 500 10px var(--font-sans);
  border-radius: 4px; border: 1px solid var(--border);
  color: var(--text-muted); background: var(--bg-soft);
  letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap;
}
.q-chip--success { color: var(--success); background: var(--success-soft); border-color: transparent; }
.q-chip--danger  { color: var(--danger);  background: var(--danger-soft);  border-color: transparent; }
.q-chip--warning { color: var(--warning); background: var(--warning-soft); border-color: transparent; }
.q-chip--info    { color: var(--info);    background: var(--info-soft);    border-color: transparent; }
.q-chip--accent  { color: var(--accent);  background: var(--accent-soft);  border-color: transparent; }

.q-eyebrow {
  font: 500 10px var(--font-mono);
  color: var(--text-faint);
  letter-spacing: 0.18em; text-transform: uppercase;
}

.q-nav-btn {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 10px; font: 500 13px var(--font-sans);
  border: 1px solid transparent; border-radius: var(--r-md);
  background: transparent; color: var(--text-muted);
  cursor: pointer; width: 100%; text-align: left;
  transition: color var(--t-fast), background var(--t-fast);
}
.q-nav-btn:hover { color: var(--text); background: var(--bg-soft); }
.q-nav-btn--active { color: var(--text); background: var(--bg-soft); }
.q-nav-btn--active .q-nav-glyph { color: var(--accent); }

.q-nav-glyph {
  width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center;
  color: var(--text-faint); flex-shrink: 0;
}

.q-link {
  color: var(--accent); cursor: pointer; background: none;
  border: none; padding: 0; font: 500 12px var(--font-sans);
}
.q-link:hover { color: var(--accent-strong); }

.q-kbd {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 5px;
  background: var(--bg); border: 1px solid var(--border);
  border-bottom-width: 1.5px; border-radius: 3px;
  font: 500 10px var(--font-mono); color: var(--text-muted);
}

.q-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  transition: border-color var(--t-fast), background var(--t-fast);
}
.q-row:hover { border-color: var(--border-strong); }
.q-row--done { opacity: 0.55; }
.q-row--ready { border-color: var(--success); background: var(--success-soft); }

.q-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
.q-scroll::-webkit-scrollbar-track { background: transparent; }
.q-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 5px; border: 2px solid transparent; background-clip: padding-box; }
.q-scroll::-webkit-scrollbar-thumb:hover { background: var(--border-strong); background-clip: padding-box; border: 2px solid transparent; }

@keyframes q-fadein { from { opacity:0; transform: translateY(-4px); } to { opacity:1; transform: translateY(0); } }
@keyframes q-confetti {
  0%   { opacity: 1; transform: translate(0,0) rotate(0deg) scale(1); }
  100% { opacity: 0; transform: translate(var(--dx), calc(var(--dy) + 140px)) rotate(var(--rot)) scale(0.4); }
}
@keyframes q-shimmer { 0% { background-position: -120px 0; } 100% { background-position: 120px 0; } }

.q-fade-in { animation: q-fadein 180ms cubic-bezier(.2,.8,.2,1) both; }

.q-shimmer {
  background: linear-gradient(90deg, var(--bg-soft) 0%, var(--bg-muted) 50%, var(--bg-soft) 100%);
  background-size: 200px 100%;
  animation: q-shimmer 1.2s linear infinite;
  border-radius: 3px; display: inline-block;
}

.q-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 50%;
  border: 1.5px solid var(--border-strong);
  background: var(--bg-elev); cursor: pointer; flex-shrink: 0;
  transition: border-color var(--t-fast), background var(--t-fast);
  padding: 0;
}
.q-check:hover { border-color: var(--text-muted); }
.q-check--done {
  background: var(--success); border-color: var(--success);
}

.q-check-sq {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; border-radius: 3px;
  border: 1.5px solid var(--border-strong); background: transparent;
  cursor: pointer; flex-shrink: 0; padding: 0;
  transition: border-color var(--t-fast), background var(--t-fast);
}
.q-check-sq:hover { border-color: var(--text-muted); }
.q-check-sq--done { background: var(--accent); border-color: var(--accent); }

@media (max-width: 880px) {
  .q-sidebar { width: 64px !important; padding: 18px 0 !important; }
  .q-sidebar .q-nav-label, .q-sidebar .q-sidebar-foot, .q-sidebar .q-brand { display: none !important; }
  .q-sidebar .q-nav-btn { justify-content: center; padding: 9px 0 !important; }
}
`;

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
const DEFAULT_CAPS = { Monday:4, Tuesday:4, Wednesday:4, Thursday:4, Friday:3 };

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
const SCHEMA_VERSION = 1;

const NAV_ITEMS = [
  { id: "today",    label: "Today",    glyph: "T", shortcut: "1" },
  { id: "queue",    label: "Queue",    glyph: "Q", shortcut: "2" },
  { id: "pipeline", label: "Pipeline", glyph: "P", shortcut: "3" },
  { id: "planner",  label: "Planner",  glyph: "L", shortcut: "4" },
  { id: "habits",   label: "Habits",   glyph: "H", shortcut: "5" },
  { id: "trophies", label: "Trophies", glyph: "*", shortcut: "6" },
];

/* ───── STORAGE ───── */

async function loadKV(key, fallback) {
  try {
    const r = await window.storage.get(key);
    if (r && r.value) return JSON.parse(r.value);
  } catch {}
  return fallback;
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

  await saveKV(KEYS.schema, SCHEMA_VERSION);
}

/* ───── AI ───── */

async function aiScore(title, desc, subtasks, tags, notes) {
  const subCount = subtasks ? subtasks.length : 0;
  const subList  = subCount ? subtasks.join(", ") : "";
  const prompt =
    "XP scoring for a freelance UI/UX dev productivity app. Score this task carefully.\n\n" +
    `Task: "${title}"\n` +
    (desc  ? `Description: ${desc}\n` : "") +
    (notes ? `Notes: ${notes}\n` : "") +
    (subCount ? `Subtasks (${subCount}): ${subList}\n` : "") +
    (tags && tags.length ? `Tags: ${tags.join(", ")}\n` : "") +
    "\nScoring rules:\n" +
    "BASE: admin/email=5-15, simple fix=15-30, component/feature=30-60, complex build=60-85, major deliverable=85-100\n" +
    "SUBTASKS: 0=no change, 1-2=+3-8, 3-4=+10-18, 5+=+20-30.\n" +
    "DESCRIPTION: one-liner=no change, paragraph=+5-12, extensive=+10-20\n" +
    "DIFFICULTY: easy=simple+no subtasks, medium=some complexity or 1-3 subtasks, hard=complex or 4+ subtasks, epic=major or 6+ subtasks\n" +
    "\nReturn ONLY valid JSON no markdown: {\"xp\":<int 5-100>,\"difficulty\":\"easy|medium|hard|epic\",\"reason\":\"<10 words>\"}";
  try {
    const r = await fetch("/api/anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 120,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const d = await r.json();
    return JSON.parse(d.content[0].text.replace(/```\w*|```/g, "").trim());
  } catch {
    return { xp: 20, difficulty: "medium", reason: "auto" };
  }
}

async function aiPlanWeek(tasks, todayName, caps) {
  const allPending = tasks.filter(t => !t.completed);
  if (!allPending.length) return null;

  const dailyTasks = allPending.filter(t => t.recurring === "daily");
  const pending    = allPending.filter(t => t.recurring !== "daily");
  const dailyHours = dailyTasks.reduce((s,t) => s + (DIFFICULTY[t.difficulty]?.hours || 1.5), 0);

  if (!pending.length) return [];

  const fromIdx = Math.max(0, WEEKDAYS.indexOf(todayName));
  const currentWeekDays = WEEKDAYS.slice(fromIdx);
  const effectiveCap = (d) => Math.max(0, (caps[d] || 4) - dailyHours);
  const currentCapStr = currentWeekDays.map(d => `${d}=${effectiveCap(d).toFixed(1)}h`).join(", ");
  const nextCapStr    = WEEKDAYS.map(d => `${d}=${effectiveCap(d).toFixed(1)}h`).join(", ");
  const currentCapTotal = currentWeekDays.reduce((s,d) => s + effectiveCap(d), 0);
  const totalH = pending.reduce((s,t) => s + (DIFFICULTY[t.difficulty]?.hours || 1.5), 0);
  const sorted = pending.slice().sort((a,b) =>
    (PRIORITIES[a.priority||"medium"].order) - (PRIORITIES[b.priority||"medium"].order));
  const taskLines = sorted.map(t =>
    `"${t.title}" [${t.xp}XP,${t.difficulty},~${DIFFICULTY[t.difficulty]?.hours || 1.5}h,${t.priority||"medium"}${t.recurring && t.recurring!=="none" ? ",recur:"+t.recurring : ""}]`
  ).join("\n");
  const dailyNote = dailyTasks.length
    ? `\nNOTE: ${dailyTasks.length} daily recurring task(s) consume ${dailyHours.toFixed(1)}h every day. Caps above already account for this. Do NOT schedule these.\n`
    : "";

  const prompt =
    `Scheduler for Jeffrey (freelance UI/UX dev, Netherlands). Today is ${todayName}.\n\n` +
    `You have TWO WEEKS available.\n` +
    `CURRENT WEEK (from today): ${currentWeekDays.join(", ")} — total available ${currentCapTotal.toFixed(1)}h\n` +
    `  effective caps: ${currentCapStr}\n` +
    `NEXT WEEK (all 5 days): ${WEEKDAYS.join(", ")}\n` +
    `  effective caps: ${nextCapStr}\n` +
    dailyNote +
    `\nSCHEDULING RULES:\n` +
    `1. FILL CURRENT WEEK FIRST. Only use next week when current week is full.\n` +
    `2. Never exceed a day's cap. Push overflow to the next available day.\n` +
    `3. Urgent first, then high, medium, low.\n` +
    `4. Morning = focus/hard. Afternoon = admin/easy.\n` +
    `5. Don't artificially spread.\n` +
    `6. Pending non-daily work: ~${totalH.toFixed(1)}h across ${pending.length} tasks.\n\n` +
    `Tasks to schedule (excluding daily):\n${taskLines}\n\n` +
    `Return ONLY a JSON array, no markdown. Only include days with tasks. Each entry needs a 'week' field:\n` +
    `[{"week":"current","day":"Monday","tasks":["title1"]},{"week":"next","day":"Tuesday","tasks":["title2"]}]`;
  try {
    const r = await fetch("/api/anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const d = await r.json();
    const parsed = JSON.parse(d.content[0].text.replace(/```\w*|```/g, "").trim());
    return parsed.map(e => ({ week: "current", ...e }));
  } catch { return null; }
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

function progressOfProject(p, tasks) {
  const ids = p.childTaskIds || [];
  if (!ids.length) return 0;
  const children = ids.map(id => tasks.find(t => t.id === id)).filter(Boolean);
  if (!children.length) return 0;
  return Math.round((children.filter(c => c.completed).length / children.length) * 100);
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
  const [subs,      setSubs]      = useState(() => (initial?.subtasks || []).map(s => s.title));
  const [recurring, setRecurring] = useState(initial?.recurring || "none");
  const [priority,  setPriority]  = useState(initial?.priority  || "medium");
  const [stIn,      setStIn]      = useState("");
  const titleRef = useRef(null);

  useEffect(() => { if (autoFocus && titleRef.current) titleRef.current.focus(); }, [autoFocus]);

  const addSub = () => { if (!stIn.trim()) return; setSubs(p => p.concat([stIn.trim()])); setStIn(""); };
  const delSub = (i) => setSubs(p => p.filter((_, j) => j !== i));
  const toggleTag = (t) => setTags(p => p.indexOf(t) >= 0 ? p.filter(x => x !== t) : p.concat([t]));

  const canSubmit = title.trim().length > 0;
  const submit = () => {
    if (!canSubmit) return;
    onSave({ title, desc, notes, tags, subtasks: subs, recurring, priority });
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
              {subs.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 4px" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, border: "1.5px solid var(--border-strong)", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)", flex: 1 }}>{s}</span>
                  <button className="q-icon-btn" onClick={() => delSub(i)} aria-label="Remove subtask"><Icon name="close" size={11} /></button>
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
  onComplete, onUncomplete, onDelete, onEdit, onToggleSub, onSplit,
  compact, expanded, onToggleExpand,
}) {
  const done = task.completed;
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

function Sidebar({ view, setView, lvl, profile, onOpenHelp }) {
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
        <button className="q-btn q-btn--ghost q-btn--xs" style={{ marginTop: 10, padding: 0 }} onClick={onOpenHelp}>
          <Icon name="key" size={11} /> shortcuts
        </button>
      </div>
    </aside>
  );
}

/* ───── PAGE SHELL ───── */

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
  tasks, projects, projectsMap, profile, lvl, unlocked,
  weekPlan, setWeekPlan, completeTask, uncompleteTask,
  addTask, updateTask, deleteTask, toggleSub, splitTask, setView,
  openNewTask, setOpenNewTask,
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
  const todayDone = tasks.filter(t => t.completed && t.completedAt > Date.now() - 86400000);

  const todayPlanData = weekPlan
    ? (weekPlan.find(d => d.day === tName && (d.week || "current") === "current") || { tasks: [] })
    : null;
  const todayScheduled = todayPlanData
    ? todayPlanData.tasks.map(title => tasks.find(t => t.title === title)).filter(Boolean)
    : [];
  const todayPlanTasks = dailyPending.concat(todayScheduled);
  const planXP = todayPlanTasks.reduce((s,t) => s + (t.xp || 0), 0);
  const planDone = todayPlanTasks.filter(t => t.completed).length;

  const generatePlan = () => {
    setPlanLoading(true);
    aiPlanWeek(tasks, tName, DEFAULT_CAPS).then(p => {
      if (p) { setWeekPlan(p); saveKV(KEYS.weekplan, p); }
      setPlanLoading(false);
    });
  };

  const handleAdd = (data) => { addTask(data); setOpenNewTask(false); };
  const handleUpdate = (data) => updateTask(editing.id, data).then(() => setEditing(null));

  const activeProjects = projects.filter(p => !p.completedAt);
  const readyToShip = activeProjects.filter(p => progressOfProject(p, tasks) === 100 && (p.childTaskIds || []).length > 0);

  return (
    <div style={{ padding: VIEW_PAD, maxWidth: 1180, margin: "0 auto" }}>
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        title={`Let's ship, ${(profile.name || "friend").split(" ")[0] || "Jeffrey"}.`}
        sub={
          allPending.length === 0
            ? "Queue empty. Take the win."
            : readyToShip.length
              ? `${allPending.length} pending · ${readyToShip.length} project${readyToShip.length>1?"s":""} ready to ship`
              : `${allPending.length} pending · ${todayPlanTasks.length} on today's plan`
        }
        right={
          <button className="q-btn q-btn--primary" onClick={() => { setEditing(null); setOpenNewTask(true); }}>
            <Icon name="plus" size={13} /> New task <span className="q-kbd" style={{ marginLeft: 4 }}>N</span>
          </button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { l: "Today's XP", v: profile.todayXP, tone: "var(--accent)", mono: true },
          { l: "Streak",     v: `${profile.streak}d`, tone: "var(--text)", mono: true },
          { l: "Done today", v: todayDone.length, tone: "var(--text)", mono: true },
          { l: "Pending",    v: allPending.length, tone: "var(--text)", mono: true },
        ].map(s => (
          <div key={s.l} className="q-card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 6 }}>{s.l}</div>
            <div style={{ fontSize: 22, fontWeight: 600, fontFamily: s.mono ? "var(--font-mono)" : "var(--font-sans)", color: s.tone }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
        <div>
          {openNewTask && <div style={{ marginBottom: 12 }}><TaskForm onSave={handleAdd} onCancel={() => setOpenNewTask(false)} /></div>}
          {editing &&  <div style={{ marginBottom: 12 }}><TaskForm initial={editing} isEdit onSave={handleUpdate} onCancel={() => setEditing(null)} /></div>}

          <Eyebrow right={<button className="q-link" onClick={() => setView("queue")}>Full queue →</button>}>
            Today's plan
          </Eyebrow>
          {todayPlanTasks.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {todayPlanTasks.map(t => (
                <TaskRow key={t.id} task={t}
                  onComplete={completeTask} onUncomplete={uncompleteTask}
                  onEdit={(task) => { setOpenNewTask(false); setEditing(task); }}
                  onDelete={deleteTask} onToggleSub={toggleSub} onSplit={splitTask}
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
            <EmptyState dashed>
              <div style={{ marginBottom: 12 }}>
                {weekPlan ? "Nothing scheduled for today." : "No plan yet. Let the planner sort the next two weeks."}
              </div>
              <button className="q-btn q-btn--outline q-btn--sm" disabled={planLoading || allPending.length === 0} onClick={generatePlan}>
                {planLoading ? "Planning…" : weekPlan ? "Regenerate plan" : "Generate plan"}
              </button>
            </EmptyState>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                  const pct = progressOfProject(p, tasks);
                  const total = (p.childTaskIds || []).length;
                  const done = (p.childTaskIds || []).map(id => tasks.find(t => t.id === id)).filter(t => t && t.completed).length;
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
  tasks, projects, projectsMap,
  completeTask, uncompleteTask, addTask, updateTask,
  deleteTask, toggleSub, splitTask,
  openNewTask, setOpenNewTask,
}) {
  const [filter, setFilter] = useState("pending");
  const [sortBy, setSortBy] = useState("priority");
  const [editing, setEditing] = useState(null);
  const [exp,     setExp]     = useState(null);
  const [projectFilter, setProjectFilter] = useState(null);

  const list = tasks
    .filter(t => {
      if (filter === "pending")   return !t.completed;
      if (filter === "recurring") return t.recurring && t.recurring !== "none";
      if (filter === "done")      return t.completed;
      return true;
    })
    .filter(t => !projectFilter || t.projectId === projectFilter)
    .sort((a, b) => {
      if (filter !== "pending") return (b.completedAt || 0) - (a.completedAt || 0);
      if (sortBy === "priority") return (PRIORITIES[a.priority||"medium"].order) - (PRIORITIES[b.priority||"medium"].order);
      if (sortBy === "xp")       return (b.xp || 0) - (a.xp || 0);
      if (sortBy === "created")  return (b.createdAt || 0) - (a.createdAt || 0);
      return 0;
    });

  const handleAdd = (d) => { addTask(d); setOpenNewTask(false); };
  const handleUpdate = (d) => updateTask(editing.id, d).then(() => setEditing(null));

  return (
    <div style={{ padding: VIEW_PAD, maxWidth: 880, margin: "0 auto" }}>
      <PageHeader
        eyebrow="All tasks"
        title="Queue"
        sub={`${list.length} ${filter === "pending" ? "pending" : filter}${projectFilter && projectsMap[projectFilter] ? ` · filtered by ${projectsMap[projectFilter].title}` : ""}`}
        right={
          <button className="q-btn q-btn--primary" onClick={() => { setEditing(null); setOpenNewTask(true); }}>
            <Icon name="plus" size={13} /> New task <span className="q-kbd" style={{ marginLeft: 4 }}>N</span>
          </button>
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
              {[["priority","priority"],["xp","XP"],["created","newest"]].map(([id, lbl]) => (
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
              onDelete={deleteTask} onToggleSub={toggleSub} onSplit={splitTask}
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
  tasks, projects, projectsMap,
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
    .sort((a, b) => progressOfProject(b, tasks) - progressOfProject(a, tasks));

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

  const readyCount = active.filter(p => progressOfProject(p, tasks) === 100 && (p.childTaskIds || []).length > 0).length;

  return (
    <div style={{ padding: VIEW_PAD, maxWidth: 720, margin: "0 auto" }}>
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
          const pct = progressOfProject(p, tasks);
          const children = (p.childTaskIds || []).map(id => tasks.find(t => t.id === id)).filter(Boolean);
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

function PlannerView({ tasks, weekPlan, setWeekPlan, completeTask, uncompleteTask }) {
  const [loading, setLoading] = useState(false);
  const [caps, setCaps] = useState(DEFAULT_CAPS);
  const [editingCap, setEditingCap] = useState(null);
  const [draggedTitle, setDraggedTitle] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  useEffect(() => { loadKV(KEYS.caps, DEFAULT_CAPS).then(c => setCaps({ ...DEFAULT_CAPS, ...c })); }, []);

  const tName = todayName();
  const allPending = tasks.filter(t => !t.completed);
  const dailyPending = allPending.filter(t => t.recurring === "daily");
  const nonDailyPending = allPending.filter(t => t.recurring !== "daily");
  const dailyHours = dailyPending.reduce((s,t) => s + (DIFFICULTY[t.difficulty]?.hours || 1.5), 0);
  const totalH = nonDailyPending.reduce((s,t) => s + (DIFFICULTY[t.difficulty]?.hours || 1.5), 0);
  const weekCap = WEEKDAYS.reduce((s,d) => s + (caps[d] || 4), 0);
  const totalCap = weekCap * 2;
  const todayIdx = WEEKDAYS.indexOf(tName);
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today); monday.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow));

  const updateCap = (day, val) => {
    const v = Math.max(0.5, Math.min(10, parseFloat(val) || 1));
    const next = { ...caps, [day]: v };
    setCaps(next); saveKV(KEYS.caps, next);
  };

  const generate = () => {
    setLoading(true);
    aiPlanWeek(tasks, tName, caps).then(p => {
      if (p != null) { setWeekPlan(p); saveKV(KEYS.weekplan, p); }
      setLoading(false);
    });
  };

  const moveTask = (taskTitle, targetWeek, targetDay) => {
    if (!weekPlan) return;
    let stripped = weekPlan.map(entry => ({
      ...entry,
      tasks: entry.tasks.filter(t => t !== taskTitle),
    })).filter(entry => entry.tasks.length > 0 || (entry.week === targetWeek && entry.day === targetDay));
    let found = false;
    let updated = stripped.map(entry => {
      if (entry.week === targetWeek && entry.day === targetDay) {
        found = true;
        if (entry.tasks.indexOf(taskTitle) < 0) return { ...entry, tasks: entry.tasks.concat([taskTitle]) };
      }
      return entry;
    });
    if (!found) updated.push({ week: targetWeek, day: targetDay, tasks: [taskTitle] });
    setWeekPlan(updated); saveKV(KEYS.weekplan, updated);
  };

  const renderWeek = (weekKey, weekOffset, label) => (
    <div style={{ marginBottom: 20 }}>
      <div className="q-eyebrow" style={{ marginBottom: 10 }}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 }}>
        {WEEKDAYS.map((day, di) => {
          const data = weekPlan ? (weekPlan.find(d => d.day === day && (d.week || "current") === weekKey) || { tasks: [] }) : { tasks: [] };
          const isToday = weekKey === "current" && tName === day;
          const isPast = weekKey === "current" && todayIdx >= 0 && di < todayIdx;
          const dateObj = new Date(monday.getTime() + (weekOffset * 7 + di) * 86400000);
          const scheduledTasks = data.tasks.map(title => tasks.find(t => t.title === title)).filter(Boolean);
          const dayScheduledH = scheduledTasks.reduce((s,t) => s + (DIFFICULTY[t.difficulty]?.hours || 1.5), 0);
          const dayH = dayScheduledH + dailyHours;
          const cap = caps[day] || 4;
          const loadPct = Math.min(Math.round((dayH / cap) * 100), 100);
          const loadColor = loadPct > 90 ? "var(--danger)" : loadPct > 65 ? "var(--warning)" : "var(--success)";
          const dayXP = scheduledTasks.reduce((s,t) => s + (t.xp || 0), 0) + dailyPending.reduce((s,t) => s + (t.xp || 0), 0);
          const slotKey = weekKey + "-" + day;
          const isDragOver = dragOver === slotKey;
          return (
            <div key={day}
              onDragOver={(e) => { e.preventDefault(); setDragOver(slotKey); }}
              onDragLeave={() => { if (dragOver === slotKey) setDragOver(null); }}
              onDrop={(e) => { e.preventDefault(); if (draggedTitle) moveTask(draggedTitle, weekKey, day); setDraggedTitle(null); setDragOver(null); }}
              className="q-card"
              style={{
                padding: 12,
                borderColor: isDragOver ? "var(--accent)" : isToday ? "var(--accent)" : "var(--border)",
                background: isDragOver ? "var(--accent-soft)" : "var(--bg-elev)",
                opacity: isPast && scheduledTasks.length === 0 && dailyPending.length === 0 ? 0.45 : 1,
                transition: "border-color var(--t-fast), background var(--t-fast)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: isToday ? "var(--accent)" : "var(--text)" }}>{day.slice(0, 3)}</span>
                  <span style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>{dateObj.getDate()}</span>
                </div>
                {dayH > 0 && (
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
                ) : scheduledTasks.map((t, i) => (
                  <div key={i}
                    draggable={!t.completed}
                    onDragStart={(e) => { setDraggedTitle(t.title); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { setDraggedTitle(null); setDragOver(null); }}
                    style={{
                      fontSize: 11, padding: "5px 7px", borderRadius: "var(--r-sm)",
                      background: t.completed ? "var(--bg-soft)" : "var(--bg-elev)",
                      border: "1px solid var(--border)",
                      borderLeft: "2px solid " + (t.completed ? "var(--border)" : (DIFFICULTY[t.difficulty]?.tone || "var(--info)")),
                      color: t.completed ? "var(--text-faint)" : "var(--text)",
                      opacity: t.completed ? 0.6 : (draggedTitle === t.title ? 0.35 : 1),
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
    </div>
  );

  return (
    <div style={{ padding: VIEW_PAD, maxWidth: 1080, margin: "0 auto" }}>
      <PageHeader
        eyebrow="AI scheduler"
        title="Two-week plan"
        sub={`${nonDailyPending.length} tasks · ~${totalH.toFixed(1)}h work · ${totalCap}h capacity${dailyPending.length ? ` · ${dailyPending.length} daily (${dailyHours.toFixed(1)}h/day)` : ""}`}
        right={
          <button className="q-btn q-btn--primary" disabled={loading || allPending.length === 0} onClick={generate}>
            {loading ? "Planning…" : weekPlan ? "Regenerate" : "Generate plan"}
          </button>
        }
      />

      <div className="q-card" style={{ padding: 14, marginBottom: 18 }}>
        <Eyebrow>Daily capacity — click to edit (applies to both weeks)</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 }}>
          {WEEKDAYS.map(day => {
            const isToday = day === tName;
            const val = caps[day] || 4;
            const isEditing = editingCap === day;
            const barTone = val <= 2 ? "var(--danger)" : val <= 4 ? "var(--warning)" : "var(--success)";
            return (
              <div key={day} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 600, color: isToday ? "var(--accent)" : "var(--text-muted)" }}>{day.slice(0, 3)}</div>
                {isEditing ? (
                  <input
                    type="number" min="0.5" max="10" step="0.5" defaultValue={val} autoFocus
                    onBlur={(e) => { updateCap(day, e.target.value); setEditingCap(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { updateCap(day, e.target.value); setEditingCap(null); } }}
                    className="q-input q-input--sm"
                    style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 500 }}
                  />
                ) : (
                  <button
                    onClick={() => setEditingCap(day)}
                    className="q-btn q-btn--outline q-btn--sm"
                    style={{ width: "100%", justifyContent: "center", fontFamily: "var(--font-mono)" }}
                  >{val}h</button>
                )}
                <div style={{ marginTop: 6 }}><ProgressBar pct={(val / 8) * 100} tone={barTone} height={3} /></div>
              </div>
            );
          })}
        </div>
      </div>

      {!weekPlan ? (
        <EmptyState dashed>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>No plan yet</div>
          <div>Fills current week first, overflows to next week. Urgent first. Drag tasks between days to rearrange.</div>
        </EmptyState>
      ) : (
        <div>
          {renderWeek("current", 0, "This week")}
          {renderWeek("next", 1, "Next week")}
          <div style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "center", marginTop: 8 }}>
            Drag scheduled tasks between days · Daily tasks appear on every day and aren't draggable
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
    <div style={{ padding: VIEW_PAD, maxWidth: 720, margin: "0 auto" }}>
      <PageHeader eyebrow="Awareness" title="Screen log" sub="Manual log. Awareness is the point." />

      <div className="q-card" style={{ padding: 18, marginBottom: 16 }}>
        <Eyebrow>Today</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          {[
            { label: "X / Twitter opens", key: "xOpens" },
            { label: "YouTube opens",     key: "ytOpens" },
          ].map(item => {
            const count = entry[item.key] || 0;
            return (
              <div key={item.key} style={{ background: "var(--bg-soft)", borderRadius: "var(--r-md)", padding: "16px 18px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 8 }}>{item.label}</div>
                <div style={{ fontSize: 32, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text)", marginBottom: 14, lineHeight: 1 }}>{count}</div>
                <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                  <button className="q-btn q-btn--primary q-btn--sm" onClick={() => { const o = {}; o[item.key] = count + 1; patch(o); }}>+1</button>
                  {count > 0 && <button className="q-btn q-btn--outline q-btn--sm" onClick={() => { const o = {}; o[item.key] = Math.max(0, count - 1); patch(o); }}>−</button>}
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
    <div style={{ padding: VIEW_PAD, maxWidth: 880, margin: "0 auto" }}>
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
  const [ready,    setReady]    = useState(false);
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

  const checkAchievements = useCallback((p, t, cur) => {
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
        project:   projects.some(pr => pr.completedAt),
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
    const upd = tasks.filter(t => t.id !== id);
    setTasks(upd); saveKV(KEYS.tasks, upd);
    if (task && task.projectId) {
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
    checkAchievements(profile, tasks, unlocked);
  }, [projects, profile, tasks, unlocked, notify, checkAchievements]);

  const unshipProject = useCallback((id) => {
    const next = projects.map(p => p.id === id ? { ...p, completedAt: null, shippedAt: null } : p);
    setProjects(next); saveKV(KEYS.projects, next);
  }, [projects]);

  const deleteProject = useCallback((id) => {
    const proj = projects.find(p => p.id === id);
    if (!proj) return;
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
      if (e.key === "n" || e.key === "N") { e.preventDefault(); setOpenNewTask(true); return; }
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

  const shared = {
    tasks, projects, projectsMap, profile, lvl, unlocked,
    weekPlan, setWeekPlan,
    completeTask, uncompleteTask, addTask, updateTask, deleteTask,
    toggleSub, splitTask, addChildToProject, removeChildFromProject,
    createProject, renameProject, shipProject, unshipProject, deleteProject,
    setView,
    openNewTask, setOpenNewTask,
  };

  return (
    <>
      <style>{TOKENS}</style>
      {!ready ? (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-faint)", fontFamily: "var(--font-mono)", fontSize: 13, background: "var(--bg)",
        }}>
          Loading…
        </div>
      ) : (
        <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
          <Sidebar view={view} setView={setView} lvl={lvl} profile={profile} onOpenHelp={() => setShowHelp(true)} />
          <main className="q-scroll" style={{ flex: 1, overflowY: "auto", maxHeight: "100vh" }}>
            {view === "today"    && <TodayView    {...shared} />}
            {view === "queue"    && <QueueView    {...shared} />}
            {view === "pipeline" && <PipelineView {...shared} />}
            {view === "planner"  && <PlannerView  {...shared} />}
            {view === "habits"   && <HabitsView   />}
            {view === "trophies" && <TrophiesView unlocked={unlocked} />}
          </main>
          {toast && <Toast msg={toast.msg} xp={toast.xp} />}
          {confetti && <ShipConfetti onDone={() => setConfetti(false)} />}
          {showHelp && <ShortcutHelp onClose={() => setShowHelp(false)} />}
        </div>
      )}
    </>
  );
}
