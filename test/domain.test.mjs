import { test } from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/core/domain.js";

const day = 86400000;
const todayIso = D.isoDate(new Date());
const yesterdayIso = D.isoDate(D.addDays(new Date(), -1));
const twoAgoIso = D.isoDate(D.addDays(new Date(), -2));

function task(id, over = {}) {
  return {
    id, title: id, desc: "", notes: "", tags: [], subtasks: [],
    xp: 60, difficulty: "medium", hours: 6, recurring: "none",
    priority: "medium", projectId: null, deadlineAt: null,
    completed: false, completedAt: null, createdAt: Date.now() - 5 * day,
    ...over,
  };
}

test("chunk XP shares sum exactly to task.xp", () => {
  const t = task("a", { xp: 70, hours: 6 });
  const chunks = [
    { date: twoAgoIso, item: { taskId: "a", hours: 2 } },
    { date: yesterdayIso, item: { taskId: "a", hours: 2 } },
    { date: todayIso, item: { taskId: "a", hours: 2 } },
  ];
  const shares = D.chunkXpShares(t, chunks);
  assert.equal(shares.reduce((s, v) => s + v, 0), 70);
});

test("no double pay: completed split task derives exactly task.xp", () => {
  // The quest bug: chunk share paid + full completion paid = 133%.
  // Here the ledger derives: full completion of a split task = xp, once.
  const t = task("a", { xp: 70, completed: true, completedAt: Date.now() });
  const plan = [
    { date: twoAgoIso, items: [{ taskId: "a", hours: 2, done: true, doneAt: Date.now() - 2 * day }] },
    { date: yesterdayIso, items: [{ taskId: "a", hours: 2, done: true, doneAt: Date.now() - day }] },
    { date: todayIso, items: [{ taskId: "a", hours: 2, done: true, doneAt: Date.now() }] },
  ];
  assert.equal(D.totalXP([t], plan), 70);
});

test("partial chunks pay proportional share only", () => {
  const t = task("a", { xp: 70 });
  const plan = [
    { date: yesterdayIso, items: [{ taskId: "a", hours: 2, done: true, doneAt: Date.now() - day }] },
    { date: todayIso, items: [{ taskId: "a", hours: 4, done: false }] },
  ];
  const total = D.totalXP([t], plan);
  assert.ok(total > 0 && total < 70, `expected partial share, got ${total}`);
});

test("migration edge: task completed with undone chunks still sums to xp", () => {
  const t = task("a", { xp: 70, completed: true, completedAt: Date.now() });
  const plan = [
    { date: yesterdayIso, items: [{ taskId: "a", hours: 2, done: true, doneAt: Date.now() - day }] },
    { date: todayIso, items: [{ taskId: "a", hours: 4, done: false }] },
  ];
  assert.equal(D.totalXP([t], plan), 70);
});

test("recurring history pays per day and derives streak", () => {
  const t = task("d", { xp: 10, recurring: "daily", history: [twoAgoIso, yesterdayIso, todayIso] });
  assert.equal(D.totalXP([t], []), 30);
  assert.equal(D.streak([t], []), 3);
  assert.equal(D.todayXP([t], []), 10);
});

test("streak survives when today has no activity yet (ends yesterday)", () => {
  const t = task("d", { xp: 10, recurring: "daily", history: [twoAgoIso, yesterdayIso] });
  assert.equal(D.streak([t], []), 2);
});

test("weekly recurring done-now uses Monday week window", () => {
  const monday = D.isoDate(D.mondayOf(new Date()));
  const t = task("w", { recurring: "weekly", history: [monday] });
  assert.equal(D.isRecurringDoneNow(t, 0), true);
  const lastWeek = D.isoDate(D.addDays(D.mondayOf(new Date()), -3));
  const t2 = task("w2", { recurring: "weekly", history: [lastWeek] });
  assert.equal(D.isRecurringDoneNow(t2, 0), false);
});

test("setChunkDone reports allDone; setAllChunksDone syncs everything", () => {
  const plan = [
    { date: yesterdayIso, items: [{ taskId: "a", done: true, doneAt: 1 }] },
    { date: todayIso, items: [{ taskId: "a", done: false }] },
  ];
  const r = D.setChunkDone(plan, "a", todayIso, true);
  assert.equal(r.allDone, true);
  const cleared = D.setAllChunksDone(r.plan, "a", false);
  assert.ok(cleared.every((e) => e.items.every((i) => !i.done)));
});

test("day rollover: 1am with rollover=4 counts as yesterday", () => {
  const at1am = new Date(); at1am.setHours(1, 30, 0, 0);
  assert.equal(D.effectiveTodayIso(4, at1am), D.isoDate(D.addDays(at1am, -1)));
  assert.equal(D.effectiveTodayIso(0, at1am), D.isoDate(at1am));
});

test("missed work excludes done chunks, completed and recurring tasks", () => {
  const tasks = [
    task("a"), task("b", { completed: true, completedAt: Date.now() }),
    task("d", { recurring: "daily", history: [] }),
  ];
  const plan = [
    { date: twoAgoIso, items: [{ taskId: "a", done: false }, { taskId: "b", done: false }, { taskId: "d", done: false }] },
    { date: twoAgoIso === yesterdayIso ? twoAgoIso : yesterdayIso, items: [{ taskId: "a", done: true, doneAt: 1 }] },
  ];
  const missed = D.getMissedWork(tasks, plan, 0);
  assert.equal(missed.length, 1);
  assert.equal(missed[0].taskId, "a");
});

test("applyReplanOps: surgical — untouched tasks stay, locked dates refused", () => {
  const plan = [
    { date: todayIso, items: [{ taskId: "a", done: false }, { taskId: "b", done: false }] },
  ];
  const resolve = (title) => ({ A: "a", B: "b" }[title] || null);
  const target = D.isoDate(D.addDays(new Date(), 3));
  const locked = D.isoDate(D.addDays(new Date(), 4));
  const { next, applied, skipped } = D.applyReplanOps(plan, [
    { op: "move", task: "A", to: target },
    { op: "move", task: "B", to: locked },
  ], resolve, new Set([locked]));
  assert.equal(applied.length, 1);
  assert.equal(skipped.length, 1);
  const bStays = next.find((e) => e.date === todayIso)?.items.some((i) => i.taskId === "b");
  assert.ok(bStays, "unmoved task must stay in place");
  assert.ok(next.find((e) => e.date === target)?.items.some((i) => i.taskId === "a"));
});

test("pinTask preserves done chunks and moveChunk refuses collisions", () => {
  const plan = [
    { date: yesterdayIso, items: [{ taskId: "a", done: true, doneAt: 1, hours: 2 }] },
    { date: todayIso, items: [{ taskId: "a", done: false, hours: 4 }] },
  ];
  const pinned = D.pinTask(plan, "a", D.isoDate(D.addDays(new Date(), 2)));
  assert.ok(pinned.find((e) => e.date === yesterdayIso)?.items.some((i) => i.done), "done chunk preserved");
  const moved = D.moveChunk(plan, "a", todayIso, yesterdayIso);
  assert.deepEqual(moved, plan, "collision move must be a no-op");
});

test("deterministic score scales with hours and clamps", () => {
  const base = D.deterministicScore("medium");
  const big = D.deterministicScore("medium", 6);
  assert.ok(big.xp > base.xp);
  assert.ok(big.xp <= 100 && base.xp >= 5);
});

test("quick-add grammar: priority, tag, project, hours, weekday, deadline, recurrence", () => {
  const projects = [{ id: "p1", title: "IGP Client Site", completedAt: null }, { id: "p2", title: "Old", completedAt: 1 }];
  const now = new Date(2026, 6, 12); // Sunday
  const p = D.parseQuickAdd("send invoice @igp fri 1h !high #admin", { projects, now });
  assert.equal(p.title, "send invoice");
  assert.equal(p.priority, "high");
  assert.deepEqual(p.tags, ["admin"]);
  assert.equal(p.projectId, "p1");
  assert.equal(p.hours, 1);
  assert.equal(p.scheduleDate, "2026-07-17"); // next Friday
  assert.equal(p.chips.length, 5);

  const d = D.parseQuickAdd("tax prep due 20-07 ~2.5h", { projects: [], now });
  assert.equal(d.title, "tax prep");
  assert.equal(d.hours, 2.5);
  assert.equal(new Date(d.deadlineAt).getDate(), 20);
  assert.equal(new Date(d.deadlineAt).getMonth(), 6);
  assert.equal(d.scheduleDate, null, "due date must not also schedule");

  const r = D.parseQuickAdd("standup every day 15m", { projects: [], now });
  assert.equal(r.recurring, "daily");
  assert.equal(r.hours, 0.25);
  assert.equal(r.title, "standup");

  const m = D.parseQuickAdd("review jul 20 designs", { projects: [], now });
  assert.equal(m.scheduleDate, "2026-07-20");
  assert.equal(m.title, "review designs");
});

test("quick-add grammar loses nothing: unmatched tokens stay in the title", () => {
  const p = D.parseQuickAdd("email friday's notes to @nosuchproject", { projects: [], now: new Date(2026, 6, 12) });
  assert.equal(p.title, "email friday's notes to @nosuchproject");
  assert.equal(p.chips.length, 0);
});

test("calibration derives weighted actual/estimate factors from sessions", () => {
  const now = Date.now();
  const tasks = [
    task("a", { hours: 2, difficulty: "hard", completed: true, completedAt: now - day }),
    task("b", { hours: 1, difficulty: "easy", completed: true, completedAt: now - 2 * day }),
    task("c", { hours: 2, difficulty: "hard", completed: true, completedAt: now - 3 * day }),
    task("skip-pending", { hours: 4, completed: false }),
    task("skip-old", { hours: 4, completed: true, completedAt: now - 90 * day }),
  ];
  const sessions = [
    { id: "s1", taskId: "a", dateIso: todayIso, ms: 3 * 3600000 },   // 3h vs 2h
    { id: "s2", taskId: "b", dateIso: todayIso, ms: 1 * 3600000 },   // 1h vs 1h
    { id: "s3", taskId: "c", dateIso: todayIso, ms: 3 * 3600000 },   // 3h vs 2h
    { id: "s4", taskId: "skip-pending", dateIso: todayIso, ms: 3600000 },
    { id: "s5", taskId: "skip-old", dateIso: todayIso, ms: 3600000 },
  ];
  const cal = D.calibration(tasks, sessions, { now });
  assert.equal(cal.overall.n, 3);
  assert.equal(cal.overall.factor, 1.4);          // (3+1+3)/(2+1+2)
  assert.equal(cal.byDifficulty.hard.factor, 1.5); // 6/4
  assert.ok(D.calibrationPromptLine(cal).includes("1.4x overall"));
  const sparse = D.calibration(tasks.slice(0, 1), sessions.slice(0, 1), { now });
  assert.equal(D.calibrationPromptLine(sparse), "", "n<3 must not emit a prompt line");
});
