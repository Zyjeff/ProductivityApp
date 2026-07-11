// enrich.js — async AI enrichment. Capture and manual adds are ALWAYS
// instant and local; these functions run afterwards and refine the task
// if the AI is reachable. On failure the task simply keeps its honest
// deterministic values — and the first failure per session says so once.

import { aiScore, aiParseCapture, aiFailureMessage, AiError } from "./ai.js";
import { applyEnrichment, getState, notify, addTask, createProject } from "./store.js";
import { deterministicScore } from "./domain.js";

let warnedThisSession = false;
function warnOnce(kind) {
  if (warnedThisSession || kind === AiError.PARSE) return;
  warnedThisSession = true;
  notify(aiFailureMessage(kind));
}

// Full enrichment for quick-captured tasks: tidy title + detect
// recurrence (capture parser), then score. Any failure → task stays
// with its raw title and deterministic score, aiPending cleared.
export async function enrichCapturedTask(taskId, rawText, mode) {
  try {
    const parsed = await aiParseCapture(rawText, mode);
    const patch = {};
    if (parsed.title && typeof parsed.title === "string") patch.title = parsed.title.trim().slice(0, 140);
    if (typeof parsed.description === "string" && parsed.description) patch.desc = parsed.description.trim().slice(0, 300);
    if (["daily", "weekly"].includes(parsed.recurring)) {
      patch.recurring = parsed.recurring;
      patch.history = [];
    }
    if (mode === "subtasks" && Array.isArray(parsed.subtasks)) {
      patch.subtasks = parsed.subtasks.slice(0, 8).map((st, i) => ({ id: String(Date.now() + i), title: String(st), done: false }));
    }
    applyEnrichment(taskId, patch);
  } catch (e) {
    warnOnce(e.kind);
    applyEnrichment(taskId, {}); // clears aiPending; raw title stands
    return;
  }
  // Second pass: score against the (possibly tidied) task.
  await scoreTask(taskId);
}

export async function scoreTask(taskId) {
  const t = getState().tasks.find((x) => x.id === taskId);
  if (!t) return;
  try {
    const sc = await aiScore({ title: t.title, desc: t.desc, subtasks: t.subtasks, tags: t.tags, notes: t.notes });
    const det = deterministicScore(sc.difficulty, sc.hours);
    applyEnrichment(taskId, {
      xp: sc.xp || det.xp,
      difficulty: sc.difficulty,
      hours: sc.hours || det.hours,
    });
  } catch (e) {
    warnOnce(e.kind);
    applyEnrichment(taskId, {});
  }
}

// Manual form adds: user already picked difficulty/hours; the AI only
// refines if the user didn't touch the score fields (caller decides).
export async function enrichManualTask(taskId) {
  await scoreTask(taskId);
}

// Project capture: create the project + child tasks from a description.
// Falls back to a bare project with the raw text as its name.
export async function captureProject(rawText) {
  try {
    const parsed = await aiParseCapture(rawText, "project");
    const pid = createProject({ title: (parsed.title || rawText).trim().slice(0, 80), desc: parsed.description || "" });
    const children = Array.isArray(parsed.tasks) ? parsed.tasks.slice(0, 10) : [];
    for (const c of children) {
      if (!c?.title) continue;
      const t = addTask({ title: c.title, desc: c.description || "", projectId: pid });
      if (t) scoreTask(t.id);
    }
    notify(children.length ? `Project created · ${children.length} tasks` : "Project created");
    return pid;
  } catch (e) {
    warnOnce(e.kind);
    const pid = createProject({ title: rawText.trim().slice(0, 80) });
    notify("Project created (AI off — add tasks manually)");
    return pid;
  }
}
