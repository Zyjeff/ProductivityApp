# ROADMAP — product phase, built in this order

Rules of engagement: one item at a time, finished completely (nav +
shortcut + identity + empty/error states + persistence/migration +
exercised live) before the next. Restorations first (parity is the
floor), then flagships ordered by dependency. Schema goes to **v2** with
additive slices (`werf_sessions`, `werf_briefs`, `werf_reviews`) and
optional new fields; existing data untouched.

## R1 — Small restorations batch *(one commit)*
Focus-time badge returns to task rows (reads today's focus, later the
session ledger). Project-type filter chips on Dock › Projects.
First-launch "Try with sample data" CTA on Today's empty state (wired
to preview mode). "Day cleared" moment: fires once per effective day
when the last lineup item completes — full lineup, not just dailies.
Empty states already exist for all; no schema.

## R2 — Promote to project *(restoration, improved)*
Where: edit form footer + palette command on the cursor task.
What: a task with ≥1 subtask becomes a project (type "other", its
color); subtasks become child tasks (deterministic-scored, AI refined
async); the original task is deleted; its plan chunks are dropped
(children are fresh work). Empty state: button disabled with hint when
no subtasks. Undoable.

## R3 — Screen-log detail in Logbook *(restoration, improved)*
Where: Logbook › Screen log section. What: 7-day X-vs-YT stacked bars,
mobile-hours bars color-graded, 7-day totals + averages — the old
Habits view's detail, in the panel where the summary strip already
lives. Empty state: "no screen data yet" line. No schema.

## F3 — Run order + NOW / NEXT stage *(execution flagship — built first among flagships because Brief and Review reference it)*
Where: Today. What: the lineup becomes an ordered queue the user owns —
drag to reorder and `[` / `]` move the cursor row up/down; order
persists per day (plan entry gains optional `order: string[]`). Above
the list, a stage: **NOW** (first pending item, large, Start/`f`
affordance, project + chunk note) and **NEXT** (second, small). Stage
collapses when the lineup is done ("Day cleared" moment) and hides when
empty. Shortcut: `[`/`]` reorder, existing `f` focuses NOW by default
when no cursor. Empty state: existing capture-first empty state.

## F6 — Natural-language quick add *(capture flagship)*
Where: capture bar (all surfaces) + palette "quick add" mode (`Ctrl+K`,
type `>` prefix or choose "Quick add"). What: deterministic local
grammar parsed as you type with a live preview chip row — `!urgent/!high/!low`,
`#tag`, `@project` (fuzzy), `~2h` or `2h`, dates (`today`, `tomorrow`,
`fri`, `jul 20`, `20-07`), `every day/week`, `due <date>`; remainder is
the title. Works fully offline (it's a parser, not a model); the AI
enrichment pass still refines titles/scores afterwards when reachable.
Empty/error: unparsed tokens just stay in the title — nothing is ever
lost. No schema.

## F4 — Session ledger + estimate calibration *(depth flagship)*
Where: focus tunnel writes; rows, Logbook, and the AI scorer read.
What: every tunnel run ≥60s logs `{taskId, dateIso, ms}` to
`werf_sessions` (schema v2) and accumulates `task.actualMs`. Task rows
show an actuals chip when actuals exist (`1.4h / 2h est`, amber when
over). Logbook gains a Calibration card: overall and per-difficulty
actual÷estimate factors over the last 60 days with sample counts, and
an honest empty state below n=3 ("not enough sessions to calibrate").
The AI score prompt gains one line of the user's calibration factors so
estimates learn from reality. Degraded path: everything works without
AI — calibration is pure arithmetic.

## F1 — Morning Brief *(AI flagship #1)*
Where: Today, above the stage, on the first open of each effective day;
`b` reopens; palette command too. What: a briefing card — deterministic
skeleton always (yesterday's ships + XP, adrift count, today's lineup
vs capacity with overload warning, deadlines within 3 days), and when
AI is reachable, a 2–3 sentence written brief with a suggested run
order (applying it = one click, writes F3's order). Cached per day in
`werf_briefs` (keeps 14); regenerate button. Degraded path: skeleton +
"AI is off" line, no prose. Dismiss = collapses to a one-line bar.

## F2 — Weekly Review *(AI flagship #2 — supersedes Weekly Pulse + past-planner nav)*
Where: Logbook › Review section + auto-prompt banner on Today on the
first open of a new ISO week (Mon/Tue) while last week is unreviewed;
palette command "Weekly review". What: full-screen overlay for a chosen
week — ships launched, tasks done, XP, focus hours (F4 data), estimate
accuracy, best day, adrift trend, per-project effort split — plus an
AI-written retro (3 short paragraphs: what happened, what pattern shows
in the numbers, one concrete suggestion) generated once and stored in
`werf_reviews`; past weeks browsable (that's the app's history now).
Degraded: stats always render; retro slot shows the honest AI-off line
with a retry. Empty state: weeks with no activity say so plainly.

## F5 — Ship Log *(motivation flagship)*
Where: Dock › the launched fleet becomes the Ship Log; entries created
at launch. What: launching freezes stats onto the project
(`launchStats`: tasks, XP, estimated vs actual hours, first→last
activity span) and opens a launch-note card — AI drafts 2–3 sentences
("what shipped, what it took") into an editable textarea; saving stores
`launchNote`. Fleet entries expand to show note + stats; unlaunching
keeps the note. Degraded: the note editor opens with a deterministic
stat line pre-filled instead of prose. Empty state: "No launches yet —
finish a project's last task and hit Launch."

## Explicitly deferred (labeled backlog in IDEAS.md)
Deadline radar · plan-tomorrow inside Close Day · inbox/triage · full
project notes drawer · ask-the-yard Q&A · streak stakes · journal line
· year heatmap.
