# Kaze — FLAG report

Zero edits to `src/core/`. The diff is one import + one array entry in
`src/themes/registry.js`, plus `src/themes/kaze/`.

## Resolution of the plan's CONFIRM items

**1. Adrift semantics — EXISTS, built.**
`getMissedWork(tasks, plan, dayStartHour, now)` returns every undone
past-dated plan chunk as `{date, taskId, item, task}`, sorted by date.
It deliberately **excludes recurring tasks** — a missed daily ritual
never becomes Weathered. Kaze renders these as a storm-greyed stretch of
road above today's, with the contract's three actions (Carry / Done /
let-it-go, the last undoable).

**2. Life-area lists ("provinces") — EXISTS, built.**
The core has two real category mechanisms: `PROJECT_TYPES` on projects
and `tags` on tasks (`TAGS_BUILTIN` + `customTags`). The Satchel groups
scrolls into provinces by project type, and the library filters by tag
chips and project. Nothing presentational-only was needed.

**3. Postpone-equivalent — EXISTS, built.**
Four real actions cover it: `moveChunkDate(id, from, to)` (carry a
weathered item into today — what the Carry button does),
`pinTaskToDate(id, iso)` (reschedule), `pinTaskToDate(id, null)`
(unschedule back to the Satchel), and `dismissChunk(id, iso)` (drop from
the plan, undoable).

## Corrections to the plan

**4. Recurring tasks are NOT a core gap — the plan was wrong, and Kaze
builds them.**
The core has full recurrence: `recurring: "none" | "daily" | "weekly"`
with a `history[]` of ISO dates, `isRecurringDoneNow()`, quick-add
grammar for `daily` / `weekly` / `every day` / `every week`, a Repeats
field on the form, and `todayLineup()` placing recurring-due-now rows
first. Kaze ships the Ritual chooser and renders ritual rows on the
road. This was verified in the running app — the sample data's "Morning
planning · daily" row completes and re-arms correctly.

**5. Departures list re-derived.** The plan assumed two themes; seven
exist. Two of its seven departures were void (torii top-frame nav —
top nav and frame-edge nav are both already taken; sectioned Today —
mandated by `registerActiveList`, so every theme has it) and one was
conditional (Mould Loft already uses "stations"). Replacements and the
full reasoning are in `DESIGN.md`.

## Genuine core feature requests — NOT built

**A. Due times (hour-level deadlines).**
`deadlineAt` is a timestamp but the core normalises every deadline to
noon: `parseQuickAdd` does `dd.setHours(12, 0, 0, 0)`, and the task form
writes `new Date(y, m - 1, d, 12)`. There is therefore no time-of-day on
a deadline and no data behind a TickTick-style "1 Hr Left" countdown.

Building it would need core changes — a time component on `deadlineAt`,
grammar for `due 5pm` / `by 17:00`, and a form control. That is a
feature request, not a theme.

*What Kaze does instead, honestly:* the deadline seal shows real
day-level urgency (`DUE TODAY`, `DUE TMRW`, `DUE FRI`, `3D PAST`), and
the incense stick in Meditation represents **focus-session time only**,
burning against the task's real estimate from the live session timer —
never a fabricated due-time countdown.

**B. Nothing else.** Every other item in the plan mapped onto existing
core capability.
