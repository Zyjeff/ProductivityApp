// ai.js — status-aware AI client. The prompts are ported from the
// previous app (they earned their place); the transport is new:
//  - every call goes through call(), which tracks a visible status
//  - failures are typed so the UI can say what ACTUALLY failed
//  - nothing in the app ever blocks on these functions; capture and
//    planning degrade to deterministic behavior with an honest label.

import { setUI, getState } from "./store.js";
import { taskHours, isoDate, weekdayName, addDays, effectiveTodayIso, normalizeTitleKey, applyReplanOps, DIFFICULTY, PRIORITIES, WEEK_ALL } from "./domain.js";

const MODELS = {
  fast: "claude-haiku-4-5-20251001",   // short structured outputs
  smart: "claude-sonnet-4-6",          // planning + vision
};

export const AiError = {
  NO_KEY: "no-key",        // 503 from our proxy — key not configured
  NETWORK: "network",      // fetch failed / proxy missing (404) / timeout
  UPSTREAM: "upstream",    // Anthropic returned an error
  PARSE: "parse",          // model answered but output was unusable
};

let lastError = null;
export function aiLastError() { return lastError; }

function setStatus(status, detail = "") {
  const ui = getState()?.ui;
  if (ui && (ui.aiStatus !== status || ui.aiDetail !== detail)) setUI({ aiStatus: status, aiDetail: detail });
}

// Human strings for toasts — one place, so degradation stays honest.
export function aiFailureMessage(kind) {
  switch (kind) {
    case AiError.NO_KEY: return "AI is off — no API key configured (see README)";
    case AiError.NETWORK: return "AI unreachable — check your connection";
    case AiError.UPSTREAM: return "AI request failed upstream — try again shortly";
    case AiError.PARSE: return "AI answered in an unexpected format — nothing was changed";
    default: return "AI failed";
  }
}

async function call({ model, max_tokens, content, timeoutMs = 25000 }) {
  setStatus("busy");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let r;
    try {
      r = await fetch("/api/anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens, messages: [{ role: "user", content }] }),
        signal: ctrl.signal,
      });
    } catch (e) {
      lastError = AiError.NETWORK;
      setStatus("off", "unreachable");
      throw Object.assign(new Error("network"), { kind: AiError.NETWORK });
    }
    if (r.status === 503) {
      lastError = AiError.NO_KEY;
      setStatus("off", "no key");
      throw Object.assign(new Error("no key"), { kind: AiError.NO_KEY });
    }
    if (r.status === 404 || r.status === 405) {
      lastError = AiError.NETWORK;
      setStatus("off", "no proxy");
      throw Object.assign(new Error("proxy missing"), { kind: AiError.NETWORK });
    }
    if (!r.ok) {
      let body = "";
      try { body = await r.text(); } catch {}
      console.error(`ai: upstream ${r.status}`, body.slice(0, 500));
      lastError = AiError.UPSTREAM;
      setStatus("off", `error ${r.status}`);
      throw Object.assign(new Error("upstream " + r.status), { kind: AiError.UPSTREAM });
    }
    const d = await r.json();
    const text = d?.content?.[0]?.text ?? "";
    lastError = null;
    setStatus("ok");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(text) {
  const stripped = String(text || "").replace(/```\w*|```/g, "").trim();
  try { return JSON.parse(stripped); } catch {}
  // fall back: outermost array or object
  for (const [open, close] of [["[", "]"], ["{", "}"]]) {
    const a = stripped.indexOf(open);
    const b = stripped.lastIndexOf(close);
    if (a !== -1 && b > a) {
      try { return JSON.parse(stripped.slice(a, b + 1)); } catch {}
    }
  }
  return null;
}

function parseError() {
  lastError = AiError.PARSE;
  return Object.assign(new Error("parse"), { kind: AiError.PARSE });
}

/* ── prompts (ported) ──────────────────────────────────────── */

const SCORE_RULES =
  "You are scoring tasks for a freelance UI/UX dev productivity app. " +
  "Apply the rules below carefully and return only JSON.\n\n" +
  "BASE XP: admin/email=5-15, simple fix=15-30, component/feature=30-60, " +
  "complex build=60-85, major deliverable=85-100.\n" +
  "SUBTASKS: 0=no change, 1-2=+3-8, 3-4=+10-18, 5+=+20-30.\n" +
  "DESCRIPTION: one-liner=no change, paragraph=+5-12, extensive=+10-20.\n" +
  "DIFFICULTY: easy=simple+no subtasks, medium=some complexity or 1-3 subtasks, " +
  "hard=complex or 4+ subtasks, epic=major or 6+ subtasks.\n" +
  "HOURS: realistic focused-work hours to ship this task end-to-end. Round to " +
  "0.25 or 0.5 increments. Typical: easy 0.25-1, medium 1-2.5, hard 2.5-5, " +
  "epic 5-10. Larger work can exceed a single day — the planner splits later.\n\n" +
  'Output schema: {"xp":<int 5-100>,"difficulty":"easy|medium|hard|epic",' +
  '"hours":<float 0.25-12>,"reason":"<10 words>"}. No markdown, no commentary.';

const CAPTURE_RULES =
  "You turn freeform descriptions into structured tasks for a productivity " +
  "app. Be concrete, action-oriented, concise. Sentence case. No trailing " +
  "periods on titles.\n\n" +
  "Three output schemas keyed by MODE.\n\n" +
  'MODE: TASK — single action item.\n' +
  '{"title":"<5-10 word title>","description":"<one-sentence summary or empty if input is already concise>",' +
  '"recurring":"none|daily|weekly"}\n\n' +
  'MODE: SUBTASKS — a task with concrete steps.\n' +
  '{"title":"<5-10 word title>","description":"<optional one-sentence summary>",' +
  '"recurring":"none|daily|weekly",' +
  '"subtasks":["<~5 word action step>",...3-6 items, each starting with a verb...]}\n\n' +
  'MODE: PROJECT — a multi-task initiative.\n' +
  '{"title":"<2-5 word project name, noun phrase>","description":"<brief goal>",' +
  '"tasks":[{"title":"<~5-8 word action task>","description":""}, ...3-7 items...]}\n\n' +
  "Rules:\n" +
  "- If the user already provided a good title, keep it but tidy it.\n" +
  "- Don't pad with filler. Specific > generic.\n" +
  "- For PROJECT mode, tasks cover the project end-to-end, ~0.5-3h each.\n" +
  "- Detect recurrence: daily phrases → \"daily\"; weekly phrases → \"weekly\"; " +
  "otherwise \"none\". Only set non-none when clearly indicated. When set, the " +
  "title must NOT include the cadence word.\n\n" +
  "Return ONLY valid JSON for the requested mode. No markdown, no commentary.";

const PLAN_RULES =
  "OUTPUT FORMAT — STRICT. Your entire response is a single JSON array. " +
  "No prose, no code fences. Starts with `[`, ends with `]`.\n\n" +
  "You are a scheduler for a freelance UI/UX dev (Netherlands). Given " +
  "unscheduled tasks and workdays with remaining capacity (hours), assign " +
  "tasks to dates.\n\n" +
  "RULES:\n" +
  "1. Never exceed a day's REMAINING capacity.\n" +
  "2. SPLIT BIG TASKS across consecutive days when they exceed a single " +
  "day's remaining capacity; per chunk give hours and a one-line note of " +
  "what happens that day. Chunks sum to the task's estimate.\n" +
  "3. Default: fill earlier days first. EXCEPTION: if the user's request " +
  "specifies a timeline (\"spread over 3 months\", \"by end of October\"), " +
  "honor it as a top-priority constraint.\n" +
  "4. Priority order: urgent > high > medium > low.\n" +
  "5. Hard/focus work earlier in the day-sequence; light admin later.\n" +
  "6. Recurring tasks are NOT in the list — already subtracted from capacity.\n" +
  "7. Already-scheduled tasks (when listed) stay put unless asked to optimize.\n" +
  "8. You may use any date in the workdays list.\n" +
  "9. DEADLINES are immovable upper bounds: all scheduling for a task with " +
  "`deadline:` MUST land on or before that date, displacing lower-priority " +
  "work if needed. If it literally cannot fit, schedule as close as possible.\n\n" +
  'Output: JSON array of {"date":"YYYY-MM-DD","items":[...]} where each item ' +
  'is {"title":"exact task title"} or {"title":"exact task title","hours":<num>,' +
  '"note":"<10-15 word slice>"} for a chunk. Only dates that receive items.';

const REPLAN_RULES =
  "OUTPUT FORMAT — STRICT. Your entire response is a single JSON array of " +
  "edit operations. No prose, no fences. Starts with `[`, ends with `]`. " +
  "If the request is impossible to interpret, return `[]`.\n\n" +
  "You are EDITING an existing schedule. Tasks NOT mentioned in your output " +
  "stay EXACTLY where they are. Be SURGICAL.\n\n" +
  "OPERATIONS:\n" +
  '  {"op":"move","task":"<exact title>","to":"YYYY-MM-DD"}\n' +
  '  {"op":"split","task":"<exact title>","chunks":[{"date":"YYYY-MM-DD","hours":N,"note":"<10-15 words>"},...]}\n' +
  '  {"op":"schedule","task":"<exact title>","to":"YYYY-MM-DD"}\n' +
  '  {"op":"unschedule","task":"<exact title>"}\n\n' +
  "CONSTRAINTS:\n" +
  "1. NEVER touch tasks the user didn't reference (by name or project). " +
  "When unsure, omit.\n" +
  "2. Done chunks (marked DONE) are immutable; split chunks cover only the " +
  "undone remainder.\n" +
  "3. Locked days are unavailable.\n" +
  "4. Respect capacity unless the user explicitly overrides.\n" +
  "5. The user may reference tasks by project — the [bracketed] tag on each " +
  "line is your guide.\n\n" +
  "Only the JSON array.";

const EXTEND_RULES =
  "OUTPUT FORMAT — STRICT. Single JSON array, no prose, no fences.\n\n" +
  "You are adding new tasks to an existing project. Fit the project's scope, " +
  "satisfy the user's request, do NOT duplicate existing tasks. Score each " +
  "task so it integrates cleanly.\n\n" +
  'Schema per task: {"title":"<5-10 word action title>","description":"<one line or empty>",' +
  '"hours":<float 0.25-12>,"xp":<int 5-100>,"difficulty":"easy|medium|hard|epic",' +
  '"priority":"urgent|high|medium|low","reason":"<10 words>"}\n\n' +
  "SIZING: hours — easy 0.25-1, medium 1-2.5, hard 2.5-5, epic 5-10. " +
  "XP — admin 5-15, simple 15-30, feature 30-60, complex 60-85, major 85-100.\n" +
  "Match the existing tasks' granularity. Verbs first. Default 1-5 tasks. " +
  "Only the JSON array.";

const VISION_RULES =
  "OUTPUT FORMAT — STRICT. Single JSON array, no fences.\n\n" +
  "You are reading a screenshot from a task tool (Trello, Asana, Linear, " +
  "Notion, paper, anything) and extracting actionable tasks. Section " +
  "headers, dates, usernames, column labels are NOT tasks.\n\n" +
  'Per-task schema: {"title":"<5-12 word action title, sentence case>",' +
  '"description":"<one-line context if visible, else empty>",' +
  '"difficulty":"easy|medium|hard|epic","hours":<float 0.25-12>,"xp":<int 5-100>,' +
  '"priority":"urgent|high|medium|low","projectHint":"<board/column if obvious, else empty>",' +
  '"completed":<true|false>}\n\n' +
  "completed=true ONLY if visually marked done. Don't invent tasks. " +
  "Order top-to-bottom, left-to-right. If nothing task-like, return `[]`.";

/* ── task sanitizers ───────────────────────────────────────── */

function sanitizeScoredTask(t) {
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
    reason: typeof t.reason === "string" ? t.reason.trim().slice(0, 80) : "",
    completed: t.completed === true,
    projectHint: typeof t.projectHint === "string" ? t.projectHint.trim().slice(0, 80) : "",
  };
}

/* ── public API ────────────────────────────────────────────── */

// Score a task. Throws typed errors; callers decide the honest fallback.
// `calibrationLine` (F4) feeds the user's real actual/estimate ratios in.
export async function aiScore({ title, desc, subtasks, tags, notes, calibrationLine = "" }) {
  const subs = subtasks || [];
  const dynamic =
    `Task: "${title}"\n` +
    (desc ? `Description: ${desc}\n` : "") +
    (notes ? `Notes: ${notes}\n` : "") +
    (subs.length ? `Subtasks (${subs.length}): ${subs.map((s) => s.title || s).join(", ")}\n` : "") +
    (tags?.length ? `Tags: ${tags.join(", ")}\n` : "") +
    (calibrationLine ? calibrationLine + "\n" : "");
  const text = await call({
    model: MODELS.fast, max_tokens: 120,
    content: [
      { type: "text", text: SCORE_RULES, cache_control: { type: "ephemeral" } },
      { type: "text", text: dynamic },
    ],
  });
  const j = extractJson(text);
  if (!j || typeof j !== "object") throw parseError();
  return {
    xp: Math.min(100, Math.max(5, Math.round(j.xp || 20))),
    difficulty: ["easy", "medium", "hard", "epic"].includes(j.difficulty) ? j.difficulty : "medium",
    hours: typeof j.hours === "number" && j.hours > 0 ? Math.min(12, Math.max(0.25, Math.round(j.hours * 4) / 4)) : null,
    reason: typeof j.reason === "string" ? j.reason.slice(0, 80) : "",
  };
}

// Parse a capture. Throws typed errors.
export async function aiParseCapture(description, mode) {
  const text = await call({
    model: MODELS.fast, max_tokens: 600,
    content: [
      { type: "text", text: CAPTURE_RULES, cache_control: { type: "ephemeral" } },
      { type: "text", text: `MODE: ${mode.toUpperCase()}\nInput: ${description.trim()}` },
    ],
  });
  const j = extractJson(text);
  if (!j || typeof j !== "object") throw parseError();
  return j;
}

export async function aiExtendProject(project, existingTasks, query) {
  const existingLines = (existingTasks || [])
    .map((t) => `- "${t.title}" ~${taskHours(t)}h, ${t.xp}XP, ${t.difficulty}`)
    .join("\n");
  const dynamic =
    `PROJECT: "${project.title}"\n` +
    (project.desc ? `Description: ${project.desc}\n` : "") +
    `\nEXISTING TASKS (${existingTasks?.length || 0} — don't duplicate, match sizing):\n` +
    (existingLines || "(none yet)") +
    `\n\nUSER REQUEST: ${query.trim()}\n`;
  const text = await call({
    model: MODELS.fast, max_tokens: 1500,
    content: [
      { type: "text", text: EXTEND_RULES, cache_control: { type: "ephemeral" } },
      { type: "text", text: dynamic },
    ],
  });
  const arr = extractJson(text);
  if (!Array.isArray(arr)) throw parseError();
  return arr.map(sanitizeScoredTask).filter(Boolean);
}

export async function aiImportFromScreenshot(imageBase64, mediaType) {
  const text = await call({
    model: MODELS.smart, max_tokens: 4000, timeoutMs: 45000,
    content: [
      { type: "text", text: VISION_RULES, cache_control: { type: "ephemeral" } },
      { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
      { type: "text", text: "Extract the tasks visible in this screenshot." },
    ],
  });
  const arr = extractJson(text);
  if (!Array.isArray(arr)) throw parseError();
  return arr.map(sanitizeScoredTask).filter(Boolean);
}

/* ── planning ──────────────────────────────────────────────── */

function buildResolver(tasks) {
  const pending = tasks.filter((t) => !t.completed);
  const titleToId = new Map();
  const normToId = new Map();
  for (const t of pending) {
    if (!titleToId.has(t.title)) titleToId.set(t.title, t.id);
    const key = normalizeTitleKey(t.title);
    if (key && !normToId.has(key)) normToId.set(key, t.id);
  }
  return (title) => titleToId.get(title) || normToId.get(normalizeTitleKey(title)) || null;
}

function projectTitleOf(t, projectsById) {
  if (!t?.projectId) return null;
  return projectsById.get(t.projectId)?.title || null;
}

// Schedule unscheduled tasks (append) or replan everything (optimize) or
// fresh-plan. Returns the next plan array. Throws typed errors.
export async function aiPlan(tasks, caps, opts = {}) {
  const mode = opts.mode || "fresh"; // fresh | append | optimize
  const existingPlan = Array.isArray(opts.existingPlan) ? opts.existingPlan : [];
  const lockedDates = opts.lockedDates instanceof Set ? opts.lockedDates : new Set(opts.lockedDates || []);
  const projectsById = new Map((opts.projects || []).map((p) => [p.id, p]));
  const dayStartHour = opts.dayStartHour || 0;

  const allPending = tasks.filter((t) => !t.completed);
  const recurring = allPending.filter((t) => t.recurring === "daily" || t.recurring === "weekly");
  const nonRecurring = allPending.filter((t) => t.recurring === "none");
  // Daily overhead: daily tasks fully, weekly spread over 5 workdays.
  const dailyHours = recurring.reduce((s, t) => s + (t.recurring === "daily" ? taskHours(t) : taskHours(t) / 5), 0);
  if (!nonRecurring.length) return existingPlan;

  // Freeze tasks with done chunks / completed tasks / locked-day items.
  const frozenTaskIds = new Set();
  const completedIds = new Set(tasks.filter((t) => t.completed).map((t) => t.id));
  for (const e of existingPlan) {
    for (const it of e.items || []) {
      if (it.done || completedIds.has(it.taskId)) frozenTaskIds.add(it.taskId);
      if (lockedDates.has(e.date)) frozenTaskIds.add(it.taskId);
    }
  }
  const frozenByDate = new Map();
  for (const e of existingPlan) {
    for (const it of e.items || []) {
      if (frozenTaskIds.has(it.taskId)) {
        if (!frozenByDate.has(e.date)) frozenByDate.set(e.date, []);
        frozenByDate.get(e.date).push({ ...it });
      }
    }
  }

  const scheduledIds = new Set(existingPlan.flatMap((e) => (e.items || []).map((i) => i.taskId)));
  const baseToPlan = mode === "optimize" ? nonRecurring : nonRecurring.filter((t) => !scheduledIds.has(t.id));
  const tasksToPlan = baseToPlan.filter((t) => !frozenTaskIds.has(t.id));
  if (!tasksToPlan.length) return existingPlan;

  // Horizon sized to workload.
  const workingCaps = WEEK_ALL.map((w) => caps[w] || 0).filter((c) => c > 0);
  const avgCap = workingCaps.length ? workingCaps.reduce((s, c) => s + c, 0) / workingCaps.length : 4;
  const effCap = Math.max(0.5, avgCap - dailyHours);
  const totalH = tasksToPlan.reduce((s, t) => s + taskHours(t), 0);
  const horizon = Math.min(120, Math.max(60, Math.ceil(totalH / effCap) + 14));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dates = [];
  for (let i = 0; dates.length < horizon && i < horizon * 3 + 14; i++) {
    const d = addDays(today, i);
    const iso = isoDate(d);
    if ((caps[weekdayName(d)] || 0) > 0 && !lockedDates.has(iso)) dates.push(d);
  }
  if (!dates.length) return existingPlan;

  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  const dateToScheduledHours = {};
  for (const e of existingPlan) {
    dateToScheduledHours[e.date] = (e.items || []).reduce((s, it) => {
      const t = tasksById.get(it.taskId);
      if (!t || t.recurring !== "none") return s;
      return s + (it.hours != null ? it.hours : taskHours(t));
    }, 0);
  }

  const ignoreExisting = mode === "optimize";
  const dayLines = dates.map((d) => {
    const iso = isoDate(d);
    const cap = caps[weekdayName(d)] || 4;
    const used = (ignoreExisting ? 0 : dateToScheduledHours[iso] || 0) + dailyHours;
    return `- ${iso} ${weekdayName(d)}: cap ${cap}h, remaining ${Math.max(0, cap - used).toFixed(1)}h`;
  }).join("\n");

  const sorted = tasksToPlan.slice().sort((a, b) =>
    PRIORITIES[a.priority || "medium"].order - PRIORITIES[b.priority || "medium"].order);
  const taskLines = sorted.map((t) => {
    const proj = projectTitleOf(t, projectsById);
    return `- "${t.title}" — ${t.xp}XP, ${t.difficulty}, ~${taskHours(t)}h, ${t.priority || "medium"}` +
      (proj ? `, project: "${proj}"` : "") +
      (t.deadlineAt ? `, deadline: ${isoDate(new Date(t.deadlineAt))}` : "");
  }).join("\n");

  let existingBlock = "";
  if (mode === "append" && existingPlan.length) {
    const lines = existingPlan
      .filter((e) => (e.items || []).length)
      .map((e) => {
        const parts = (e.items || []).map((it) => {
          const t = tasksById.get(it.taskId);
          if (!t) return null;
          const proj = projectTitleOf(t, projectsById);
          return `"${t.title}"${proj ? ` [${proj}]` : ""}${it.hours != null && it.note ? ` (${it.hours}h: ${it.note})` : ""}`;
        }).filter(Boolean);
        return parts.length ? `- ${e.date}: ${parts.join(", ")}` : "";
      }).filter(Boolean).join("\n");
    if (lines) existingBlock = `\nAlready scheduled (do not move):\n${lines}\n`;
  }

  const instr = (opts.instruction || "").trim();
  const modeLine = mode === "optimize"
    ? "Mode: OPTIMIZE — replan all listed tasks from scratch."
    : mode === "append"
      ? `Mode: APPEND — place only the listed unscheduled tasks; respect remaining capacity.${instr ? " Honor the user request below as a top-priority constraint." : ""}`
      : "Mode: FRESH — no prior plan; place all listed tasks.";

  const dynamic =
    `Today: ${isoDate(today)} (${weekdayName(today)}).\n${modeLine}\n` +
    `Recurring overhead: ${dailyHours.toFixed(1)}h/day (already subtracted).\n\n` +
    `Workdays available:\n${dayLines}\n${existingBlock}` +
    (instr ? `\nUser request: ${JSON.stringify(instr)}\n` : "") +
    `\nTasks to place (total ~${totalH.toFixed(1)}h, ${tasksToPlan.length} tasks):\n${taskLines}`;

  const text = await call({
    model: MODELS.smart, max_tokens: 6000, timeoutMs: 60000,
    content: [
      { type: "text", text: PLAN_RULES, cache_control: { type: "ephemeral" } },
      { type: "text", text: dynamic },
    ],
  });
  const parsed = extractJson(text);
  if (!Array.isArray(parsed)) throw parseError();

  const resolve = buildResolver(tasks);
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  const newEntries = parsed.map((e) => {
    if (!e?.date || !isoRe.test(e.date)) return null;
    const rawItems = Array.isArray(e.items) ? e.items : Array.isArray(e.tasks) ? e.tasks.map((x) => typeof x === "string" ? { title: x } : x) : [];
    const items = rawItems.map((it) => {
      const id = it?.title ? resolve(it.title) : null;
      if (!id) return null;
      const out = { taskId: id, done: false };
      if (typeof it.hours === "number" && it.hours > 0) out.hours = Math.round(it.hours * 10) / 10;
      if (typeof it.note === "string" && it.note.trim()) out.note = it.note.trim().slice(0, 80);
      return out;
    }).filter(Boolean);
    return items.length ? { date: e.date, items } : null;
  }).filter(Boolean);

  // merge frozen entries back
  const byDate = new Map();
  if (mode === "append") {
    for (const e of existingPlan) byDate.set(e.date, [...(e.items || [])]);
  }
  for (const e of newEntries) {
    const list = byDate.get(e.date) || [];
    for (const it of e.items) if (!list.some((x) => x.taskId === it.taskId)) list.push(it);
    byDate.set(e.date, list);
  }
  if (mode !== "append") {
    for (const [date, items] of frozenByDate) {
      const list = byDate.get(date) || [];
      for (const it of items) if (!list.some((x) => x.taskId === it.taskId)) list.push(it);
      byDate.set(date, list);
    }
  }
  return Array.from(byDate.entries())
    .map(([date, items]) => ({ date, items }))
    .filter((e) => e.items.length)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Surgical replan. Returns { plan, applied, skipped }. Throws typed errors.
export async function aiReplan(tasks, caps, opts) {
  const existingPlan = Array.isArray(opts.existingPlan) ? opts.existingPlan : [];
  const instruction = (opts.instruction || "").trim();
  if (!instruction) return null;
  const lockedDates = opts.lockedDates instanceof Set ? opts.lockedDates : new Set(opts.lockedDates || []);
  const projectsById = new Map((opts.projects || []).map((p) => [p.id, p]));

  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  const allPending = tasks.filter((t) => !t.completed);
  const dailyHours = allPending
    .filter((t) => t.recurring === "daily")
    .reduce((s, t) => s + taskHours(t), 0);

  const planLines = existingPlan
    .filter((e) => (e.items || []).length)
    .flatMap((e) => (e.items || []).map((it) => {
      const t = tasksById.get(it.taskId);
      if (!t) return null;
      const proj = projectTitleOf(t, projectsById);
      return `- ${e.date}: "${t.title}"${proj ? ` [${proj}]` : ""}` +
        (t.deadlineAt ? ` (due ${isoDate(new Date(t.deadlineAt))})` : "") +
        (it.done ? " DONE" : "") +
        (it.hours != null ? ` (${it.hours}h${it.note ? `: ${it.note}` : ""})` : "") +
        (lockedDates.has(e.date) ? " LOCKED-DAY" : "");
    }).filter(Boolean))
    .join("\n");

  const scheduledIds = new Set(existingPlan.flatMap((e) => (e.items || []).map((i) => i.taskId)));
  const unscheduledLines = allPending
    .filter((t) => !scheduledIds.has(t.id) && t.recurring === "none")
    .map((t) => {
      const proj = projectTitleOf(t, projectsById);
      return `- "${t.title}"${proj ? ` [${proj}]` : ""}${t.deadlineAt ? ` (due ${isoDate(new Date(t.deadlineAt))})` : ""} ~${taskHours(t)}h, ${t.priority || "medium"}`;
    }).join("\n");

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dayLines = [];
  for (let i = 0; dayLines.length < 90 && i < 240; i++) {
    const d = addDays(today, i);
    const iso = isoDate(d);
    const cap = caps[weekdayName(d)] || 0;
    if (cap === 0 || lockedDates.has(iso)) continue;
    const existingHrs = (existingPlan.find((e) => e.date === iso)?.items || [])
      .reduce((s, it) => {
        const t = tasksById.get(it.taskId);
        if (!t || t.recurring !== "none") return s;
        return s + (it.hours != null ? it.hours : taskHours(t));
      }, 0);
    dayLines.push(`- ${iso} ${weekdayName(d)}: ${cap}h cap, ${Math.max(0, cap - existingHrs - dailyHours).toFixed(1)}h free`);
  }

  const dynamic =
    `Today: ${isoDate(today)} (${weekdayName(today)}).\n\n` +
    `User request: ${JSON.stringify(instruction)}\n\n` +
    (planLines ? `Current plan:\n${planLines}\n\n` : "Current plan: (empty)\n\n") +
    (unscheduledLines ? `Unscheduled pending tasks:\n${unscheduledLines}\n\n` : "") +
    `Workdays available (next 90 working days):\n${dayLines.join("\n")}\n`;

  const text = await call({
    model: MODELS.smart, max_tokens: 3000, timeoutMs: 60000,
    content: [
      { type: "text", text: REPLAN_RULES, cache_control: { type: "ephemeral" } },
      { type: "text", text: dynamic },
    ],
  });
  const ops = extractJson(text);
  if (!Array.isArray(ops)) throw parseError();
  if (!ops.length) return { plan: null, applied: [], skipped: [], empty: true };

  const resolve = buildResolver(tasks);
  const result = applyReplanOps(existingPlan, ops, resolve, lockedDates);
  return { plan: result.next, applied: result.applied, skipped: result.skipped };
}
