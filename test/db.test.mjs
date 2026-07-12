import { test } from "node:test";
import assert from "node:assert/strict";
import { migrate, loadState, parseImport, mergeStates, KEYS } from "../src/db.js";
import * as D from "../src/domain.js";

function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

const day = 86400000;
const now = Date.now();
const todayIso = D.isoDate(new Date());

test("migrates quest_* v8 data: tasks, projects, plan, baseline", () => {
  const questTasks = [
    { id: "t1", title: "Ship hero", xp: 70, difficulty: "hard", hours: 6, recurring: "none", priority: "high", completed: false, createdAt: now - 5 * day },
    { id: "t2", title: "Old win", xp: 30, difficulty: "medium", recurring: "none", priority: "medium", completed: true, completedAt: now - 2 * day, createdAt: now - 6 * day },
    { id: "td", title: "Standup", xp: 10, difficulty: "easy", recurring: "daily", dailyCompletions: [D.isoDate(D.addDays(new Date(), -1))], completed: false, createdAt: now - 30 * day },
  ];
  const questProjects = [
    { id: "p1", title: "Site", type: "client", childTaskIds: ["t1"], createdAt: now - 9 * day, completedAt: null },
  ];
  const questPlan = [
    { date: todayIso, items: [{ taskId: "t1", hours: 2, note: "part one", done: false }] },
  ];
  const storage = fakeStorage({
    quest_schema_v: 8,
    quest_tasks: questTasks,
    quest_projects: questProjects,
    quest_weekplan: questPlan,
    quest_profile: { totalXP: 500, todayXP: 0, streak: 3, lastDate: "x", completedCount: 12 },
    quest_achievements: ["first", "five"],
    quest_caps: { Monday: 5, Tuesday: 4, Wednesday: 4, Thursday: 4, Friday: 3, Saturday: 0, Sunday: 0 },
    quest_custom_tags: ["igp"],
    quest_day_start_hour: 4,
  });

  const { migrated, meta } = migrate(storage);
  assert.equal(migrated, true);
  const st = loadState(storage);
  assert.equal(st.tasks.length, 3);
  assert.equal(st.projects.length, 1);
  assert.equal(st.plan.length, 1);
  assert.equal(st.meta.dayStartHour, 4);
  assert.deepEqual(st.achievements, ["first", "five"]);
  assert.deepEqual(st.customTags, ["igp"]);
  // daily history carried over
  const daily = st.tasks.find((t) => t.id === "td");
  assert.equal(daily.history.length, 1);
  // baseline: legacy 500, derived = 30 (t2) + 10 (daily 1 day) = 40 → 460
  const derived = D.totalXP(st.tasks, st.plan, 0, 4);
  assert.equal(meta.xpBaseline, 500 - derived);
  assert.equal(D.totalXP(st.tasks, st.plan, meta.xpBaseline, 4), 500);
});

test("migrates legacy weekplan title shape (quest v2-)", () => {
  const storage = fakeStorage({
    quest_tasks: [{ id: "t1", title: "Alpha", xp: 20, recurring: "none", completed: false, createdAt: now }],
    quest_weekplan: [{ date: todayIso, tasks: ["Alpha", "Ghost title"] }],
    quest_profile: { totalXP: 0 },
  });
  migrate(storage);
  const st = loadState(storage);
  assert.equal(st.plan.length, 1);
  assert.equal(st.plan[0].items.length, 1);
  assert.equal(st.plan[0].items[0].taskId, "t1");
});

test("migrates vsq_* when quest_* absent, and shiplist projects", () => {
  const storage = fakeStorage({
    vsq_tasks: [{ id: "v1", title: "Legacy vsq task", xp: 15, recurring: "none", completed: true, completedAt: now - 40 * day, createdAt: now - 50 * day }],
    vsq_profile: { totalXP: 15 },
    "shiplist-projects-v2": [
      { id: "s1", name: "Old ship", type: "Client", createdAt: now - 90 * day, shipped: true, shippedAt: now - 60 * day, tasks: [{ id: "a", name: "Build it", done: true }] },
    ],
  });
  migrate(storage);
  const st = loadState(storage);
  assert.equal(st.tasks.length, 2);
  assert.equal(st.projects.length, 1);
  assert.equal(st.projects[0].id, "p-mig-s1");
  assert.equal(st.projects[0].completedAt, now - 60 * day);
  const child = st.tasks.find((t) => t.id === "ct-mig-s1-a");
  assert.ok(child.completed);
});

test("migration is idempotent — second call is a no-op", () => {
  const storage = fakeStorage({
    quest_tasks: [{ id: "t1", title: "One", xp: 20, recurring: "none", completed: false, createdAt: now }],
    quest_profile: { totalXP: 100 },
  });
  migrate(storage);
  const first = storage.getItem(KEYS.tasks);
  const r2 = migrate(storage);
  assert.equal(r2.migrated, false);
  assert.equal(storage.getItem(KEYS.tasks), first);
});

test("fresh install migrates to empty state without legacy flag", () => {
  const storage = fakeStorage({});
  const { migrated, meta } = migrate(storage);
  assert.equal(migrated, false);
  assert.equal(meta.xpBaseline, 0);
  const st = loadState(storage);
  assert.deepEqual(st.tasks, []);
});

test("parseImport accepts quest format-1 backups", () => {
  const payload = {
    app: "quest", format: 1, schema: 8,
    data: {
      tasks: [{ id: "t1", title: "From backup", xp: 20, recurring: "none", completed: false, createdAt: now }],
      weekplan: [{ date: todayIso, items: [{ taskId: "t1", done: false }] }],
      profile: { totalXP: 20 },
    },
  };
  const inc = parseImport(payload);
  assert.equal(inc.tasks.length, 1);
  assert.equal(inc.plan.length, 1);
  assert.equal(inc.legacyProfile.totalXP, 20);
});

test("parseImport refuses newer werf schema and junk", () => {
  assert.throws(() => parseImport({ app: "werf", format: 2, schema: 99, data: {} }), /newer/);
  assert.throws(() => parseImport({ hello: "world" }), /Not a Werf/);
});

test("mergeStates dedupes by id and unions plan items", () => {
  const cur = {
    tasks: [{ id: "a", title: "A" }], projects: [], plan: [{ date: todayIso, items: [{ taskId: "a", done: false }] }],
    caps: { Monday: 4 }, screen: {}, locks: {}, achievements: ["first"], customTags: [],
  };
  const inc = {
    tasks: [{ id: "a", title: "A-dupe" }, { id: "b", title: "B" }], projects: [],
    plan: [{ date: todayIso, items: [{ taskId: "a", done: true }, { taskId: "b", done: false }] }],
    caps: {}, screen: {}, locks: {}, achievements: ["five"], customTags: ["x"],
  };
  const m = mergeStates(cur, inc);
  assert.equal(m.tasks.length, 2);
  assert.equal(m.tasks.find((t) => t.id === "a").title, "A", "current wins on collision");
  assert.equal(m.plan[0].items.length, 2);
  assert.deepEqual(m.achievements.sort(), ["first", "five"]);
});

test("werf v1 → v2 upgrade adds sessions/briefs/reviews without touching data", () => {
  const storage = fakeStorage({
    werf_meta: { schema: 1, xpBaseline: 500, dayStartHour: 4 },
    werf_tasks: [{ id: "t1", title: "Keep me", xp: 20, recurring: "none", completed: false, createdAt: now }],
  });
  const { meta } = migrate(storage);
  assert.equal(meta.schema, 2);
  assert.equal(meta.xpBaseline, 500);
  assert.equal(meta.dayStartHour, 4);
  const st = loadState(storage);
  assert.deepEqual(st.sessions, []);
  assert.deepEqual(st.briefs, {});
  assert.deepEqual(st.reviews, {});
  assert.equal(st.tasks.length, 1, "existing tasks untouched");
});
