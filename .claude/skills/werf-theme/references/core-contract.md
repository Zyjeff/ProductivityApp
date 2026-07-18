# The core contract — everything a theme consumes

A theme imports ONLY from `src/core/` and its own folder. This file is the
complete surface. Paths below are relative to a file in
`src/themes/<id>/` (one more `../` from `views/`).

## Table of contents

1. State shape and subscription
2. The `ui` slice — every field and who owns it
3. Store actions, with semantics that matter
4. The keyboard layer — bindings, and the two hooks a theme MUST call
5. Domain: derivations and constants
6. AI + enrichment — calls and the honest-degradation requirement
7. Theme selection API
8. Data-shape reference (task, project, plan, sessions…)

---

## 1. State shape and subscription

```js
import { useStore, getState, sel, todayLineup } from "../../core/store.js";
```

- `useStore(selector)` — React subscription. The snapshot is cached on
  state identity and compared shallowly, so selectors may return fresh
  objects `{a, b}` without looping, but avoid returning fresh arrays via
  `.map()` in a selector (shallow-equal fails every emit → re-render per
  store change). Select raw slices and `useMemo` derived arrays instead.
- `getState()` — imperative read for event handlers.
- `sel` — prebuilt selectors: `dayStartHour`, `todayIso`, `tasksById`,
  `projectsById`, `totalXP`, `todayXP`, `streak`, `level` (→
  `{lvl, title, pct, xpToNext}`), `missed`.
- `todayLineup(state)` — today's ordered rows:
  `{ task, chunk?, doneHere, chunkLabel?, chunkNote?, recurringRow? }[]`.
  Recurring tasks due now come first, then today's scheduled chunks,
  energy-sorted, then the user's persisted run order overrides placement.
  Use this — never rebuild lineup logic in a theme.

Top-level slices: `tasks`, `projects`, `plan`, `caps`, `screen`, `locks`,
`achievements`, `customTags`, `sessions`, `briefs`, `reviews`, `meta`,
`ui`. All except `ui` persist to localStorage (`werf_*`, debounced,
flushed on beforeunload).

`meta` fields a theme reads: `dayStartHour` (0–23 rollover),
`xpBaseline` (migrated lifetime XP remainder), `dayClosed`
(`{date, closedAt}|null`), `lineupOrder` (`{iso: [taskId…]}`),
`dayClearedShown`, `migratedFrom` (provenance or null).

## 2. The `ui` slice

Every field, its meaning, and the surfaces your App must render:

| field | meaning | your obligation |
|---|---|---|
| `view` | `"today" \| "plan" \| "dock"` | render the three views; nav buttons set it (clear `cursor` too) |
| `statsOpen` | Logbook visible | render a Logbook surface (panel, page — your choice) |
| `paletteOpen` | ⌘K palette | render a palette with commands + task search + `>` quick add |
| `helpOpen` | shortcut help | render the SHORTCUT_ROWS sheet |
| `formOpen` + `editingTaskId` | task form (new when id null) | render the full form modal |
| `focusTaskId` | focus tunnel target | render the tunnel |
| `reviewWeek` | weekly review (Monday ISO) | render the review overlay |
| `endOfDayOpen` | close-day dialog | render it |
| `launchNoteFor` | ship-log entry dialog (project id) | render it |
| `captureMode` | `"task" \| "subtasks" \| "project"` | capture bar mode control |
| `energy` | `"low" \| "normal" \| "high"` | energy toggle on Today |
| `cursor` | `{index} \| null` keyboard cursor | highlight the row at index in the registered list; hover may set it |
| `toast` | `{msg, xp?, undoId?, at}` | ticker with signed XP and an Undo button when `undoId` |
| `confetti` | increment counter | fire a confetti burst when it grows |
| `levelUp` | `{lvl, title} \| null` (auto-clears ~2.8s) | celebratory banner |
| `previewMode` | sample data loaded | persistent banner + always-visible Exit |
| `externalChange` | another tab wrote werf_* | banner: Reload / Dismiss |
| `aiStatus` + `aiDetail` | `unknown\|ok\|busy\|off` | status lamp with honest tooltip |
| `dockFilter` | `{tab, status, project, tag, sort, q}` | Dock tabs + Library filters read/write this |

The Esc cascade in core closes these one per press in this order:
palette → review → help → form → end-of-day → stats → clear cursor. If
you render a surface for a flag, Esc already works; if you forget a
surface, the flag silently traps a keypress.

## 3. Store actions

All from `core/store.js` unless noted.

**Completion — the one mutation.**
`setCompletion(taskId, { done, chunkDate?, dateIso? })`
- recurring task → toggles that day's history entry (`dateIso` defaults
  to effective-today);
- `chunkDate` given → toggles that chunk; the task auto-completes when
  all chunks are done and auto-reopens otherwise;
- neither → completes the task AND all its chunks.
It emits the toast itself (with XP delta + undo), fires the day-cleared
moment, checks achievements, raises "Ready to launch", and un-ships a
project when you reopen its child. Never wrap it with your own toast.

**Tasks.** `captureTask(rawTitle, {mode, scheduleToday, parsed})` →
instant local task (grammar-parsed fields applied), returns the task —
follow with `enrichCapturedTask` (see §6). `addTask(data)` (full form;
returns task or null), `updateTask(id, patch)` — set
`scheduleDateChanged`/`projectIdChanged: true` alongside
`scheduleDate`/`projectId` to re-pin the plan / move project membership.
`deleteTask(id)` (undoable), `toggleSubtask(taskId, subId)`,
`promoteToProject(taskId)` (needs subtasks; returns
`{projectId, childIds}` — score the children; undoable),
`applyEnrichment(taskId, patch)` (AI plumbing; rarely called directly).

**Plan.** `pinTaskToDate(taskId, iso|null)` (replaces undone chunks),
`moveChunkDate(taskId, from, to)` (keeps hours/note/done;
collision-safe), `updateChunk(taskId, iso, {hours?, note?})`,
`dismissChunk(taskId, iso)` (undoable), `applyPlan(nextPlan,
{snapshotLabel})` (undoable when labeled — used after AI planning),
`toggleDayLock(iso)`, `setCaps(caps)`.

**Projects.** `createProject({title, type, desc})` → id,
`updateProject(id, patch)`, `deleteProject(id)` (cascades children,
undoable), `shipProject(id)` (freezes `launchStats`, confetti, opens the
launch-note dialog via `launchNoteFor`), `saveLaunchNote(id, note)`,
`unshipProject(id)`, `addChildToProject(id, data)`,
`detachFromProject(taskId)`.

**Lineup order.** `setLineupOrder(ids)` (persists today's full order;
old days pruned), `moveLineupRow(taskId, ±1)` → bool (the `[ ]` keys).

**Brief / review.** `ensureMorningBrief()`, `patchBrief(iso, patch)`
(`dismissed` drives collapse; clearing `attempted`+`text` triggers
regeneration via the view's effect), `applyBriefOrder(titles)`,
`openReview(weekIso?)` (default last week), `closeReview()`,
`patchReview(weekIso, patch)`, `reviewPromptDue(state)` → weekIso|null
(Mon/Tue nudge).

**Day + misc.** `closeDay({rollForward})` (tows unfinished to the next
capacity day within 21), `reopenDay()`, `setDayStartHour(raw)` (clamps
0–23), `patchScreenToday(patch)` (xOpens/ytOpens/mobileHours),
`addCustomTag(tag)`, `saveFocusTime(taskId, ms)` (cumulative today),
`logSession(taskId, ms)` (ledger entry; <60s ignored).

**Data.** `exportData()` (downloads JSON; blocked in preview),
`importDataFromFile(file, "merge"|"replace")` → Promise,
`enterPreview()` / `exitPreview()` (snapshot ↔ exact restore).

**Toasts/undo.** `notify(msg, xp?, undoFn?)` — with `undoFn` the toast
shows Undo for ~6s and `U` triggers it; `runUndo(undoId)` for the toast
button; `undoLast()` for the key. Prefer piggybacking on actions that
already notify.

## 4. The keyboard layer

Installed once by `main.jsx`. Bindings (from `core/keys.js`, displayed
via `SHORTCUT_ROWS`): `⌘/Ctrl+K` palette (works inside fields) · Esc
cascade · `1/2/3` views · `4` logbook toggle · `n` capture focus ·
`Shift+N` form · `u` undo · `w` review · `b` brief toggle (jumps to
Today) · `?` help · `j/k`/arrows cursor · `x`/Enter complete · `e` edit ·
`f` focus (no cursor → first pending NOW task) · `t` schedule today ·
`[ ]` lineup reorder (Today only) · Del/Backspace delete. Suppressed
while typing and while palette/form/tunnel/eod are open.

The two calls a theme must make or keys silently die:

```js
import { registerActiveList, setCaptureFocus } from "../../core/keys.js";

// In every view with actionable rows — re-register when the list changes:
useEffect(() => { registerActiveList("today", kbRows); }, [kbRows]);
// kbRows: [{ taskId, chunkDate: isoOrNull, done }] in on-screen order.
// Today = adrift rows first, then lineup (cursor index spans BOTH — when
// highlighting, offset lineup indices by missed.length).

// In the capture bar:
useEffect(() => {
  setCaptureFocus(() => inputRef.current?.focus());
  return () => setCaptureFocus(null);   // fallback opens the full form
}, []);
```

`buildCommands()` returns the palette command list (includes cursor-row
commands when a row is under the cursor) — call it inside the palette's
memo so it reflects the live cursor.

## 5. Domain — derive, never store

`import * as D from "../../core/domain.js"`. The ones themes actually
use:

- Dates: `effectiveTodayIso(hour)`, `effectiveToday(hour)`, `isoDate`,
  `parseIsoDate`, `addDays`, `mondayOf`, `weekdayName`, `fmtDate`,
  `fmtIsoShort`, `fmtWeekLabel`, `fmtMs`. Everything "today" respects
  the rollover hour — never use `new Date()` date math directly for
  day bucketing.
- Ledger: `xpEvents(tasks, plan, hour)`, `xpByDay`, `activityByDay`,
  `totalXP(tasks, plan, baseline, hour)`, `todayXP`, `streak`,
  `completedCount`, `levelInfo(xp)`.
- Sessions: `focusMsByDay(sessions)`, `actualsByTask(sessions)`,
  `calibration(tasks, sessions)` (+`calibrationPromptLine`).
- Composites: `morningBriefData(...)`, `weeklyReviewData(...)`,
  `reviewableWeeks(...)`, `getMissedWork(...)` (adrift),
  `getTaskChunks(taskId, plan)` (sorted, 1-indexed),
  `getTaskScheduledDate`, `taskHours(t)`, `sortForEnergy(arr, energy)`,
  `progressOfProject(p, tasksById)`, `parseQuickAdd(input, {projects})`
  (the capture grammar — returns `{title, chips[], priority, tags,
  projectId, hours, scheduleDate, deadlineAt, recurring}`),
  `checkAchievements`, `achievementProgress(id, ctx)`.
- Constants: `DIFFICULTY` (+`_ORDER`), `PRIORITIES`, `LEVEL_THRESHOLDS`,
  `LEVEL_NAMES`, `PROJECT_TYPES`, `PROJECT_PALETTE`, `TAGS_BUILTIN`
  (+`allKnownTags(custom)`), `WEEK_ALL`, `DEFAULT_CAPS`, `ACHIEVEMENTS`.
  Display these as-is — level names, trophy titles, and difficulty tones
  are app identity, not theme flavor.

`import { listBackups } from "../../core/db.js"` for the backup status
line.

## 6. AI + enrichment

From `core/enrich.js`: `enrichCapturedTask(taskId, rawText, mode,
{grammarUsed, hasHours})` (call right after `captureTask`; grammar skips
the AI rewrite, grammar+hours skips AI entirely), `scoreTask(taskId)`,
`enrichManualTask(taskId)` (only when the user didn't touch XP),
`captureProject(rawText)` (falls back to a bare project),
`generateBriefProse(iso, data)`, `generateReviewRetro(weekIso, stats)`.

From `core/ai.js` (views call these directly): `aiPlan(tasks, caps,
{mode: "fresh"|"append"|"optimize", existingPlan, lockedDates, projects,
instruction, dayStartHour})`, `aiReplan(...)` → `{plan, applied,
skipped, empty}`, `aiExtendProject(project, children, query)`,
`aiImportFromScreenshot(base64, mediaType)`, `aiLaunchNote(project,
stats)`, `aiFailureMessage(errorKind)`.

The degradation requirement: every AI touchpoint renders an honest state
for `busy` and for failure (`aiFailureMessage(e.kind)` in a toast), and
the deterministic path always works — capture keeps the raw title, score
stays deterministic, brief shows facts, review shows stats, launch note
prefills a deterministic draft, planner failures change nothing. Copy
the failure-handling shape from either theme's plan/dock views verbatim.

## 7. Theme selection

```js
import { useThemeId, setThemeId } from "../../core/theme.js";
import { THEMES } from "../registry.js";   // presentation-side, fine to import
```
Render a picker in your settings surface. `setThemeId` persists and
re-renders; validation/fallback happens in `main.jsx`.

## 8. Data shapes (read-only reference)

```
task:    { id, title, desc, notes, tags[], subtasks[{id,title,done}],
           xp, difficulty, hours|null, recurring:"none"|"daily"|"weekly",
           history[iso]?, priority, projectId|null, deadlineAt|null,
           completed, completedAt|null, createdAt, focusMs, focusDate,
           aiPending, justEnriched? }
project: { id, title, desc, notes, type, color, createdAt,
           completedAt|null, shippedAt|null, childTaskIds[],
           launchStats?{tasks,doneTasks,xp,estHours,actualMs,spanDays,
           launchedAt}, launchNote? }
plan:    [{ date: iso, items: [{ taskId, done, doneAt?, hours?, note? }] }]
sessions:[{ id, taskId, dateIso, ms, at }]
screen:  { [iso]: { xOpens, ytOpens, mobileHours|null } }
briefs:  { [iso]: { text, order, ai, attempted, dismissed, generatedAt } }
reviews: { [weekIso]: { text?, ai?, attempted?, promptDismissed?, createdAt? } }
caps:    { Monday: h, …, Sunday: h }   locks: { [iso]: true }
```

Treat all of it as immutable — mutations go through §3 only.
