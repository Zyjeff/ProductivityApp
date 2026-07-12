# PARITY — original Quest vs Werf (rebuild), decided line by line

Method: feature inventory from the full quest-original read (AUDIT.md
Part A) checked against the running Werf. Parity is the floor, not the
target. Verdicts: **KEPT** (exists, equal or better) · **RESTORE** ·
**RESTORE IMPROVED** · **SUPERSEDED** (replaced by a roadmap feature
that covers it strictly better) · **KILL** (with reason).

## Kept (equal or better) — no action
| Original capability | Werf status |
|---|---|
| Quick capture, 3 modes (task/steps/project) | KEPT — instant-local + async AI |
| Full task form (subtasks, tags+custom, priority, recurrence, schedule pin, deadline, manual score) | KEPT — + difficulty picker, uncommitted text no longer dropped |
| AI scoring / capture parse / plan / append-with-instruction / optimize / surgical replan + undo | KEPT — honest failures, status dot |
| Screenshot import (vision) with review/select/group-as-project | KEPT — Dock › Library |
| AI extend project | KEPT |
| Chunk editor (per-chunk date/hours/note/done) | KEPT |
| Missed-work triage (Today/Done/Dismiss) | KEPT — "Adrift" strip |
| Capacity per weekday, day locks, rollover hour (+presets) | KEPT |
| Today stat cards w/ trends, sparkline, week bars | KEPT |
| Ready-to-ship rail | KEPT — "Ready to launch" |
| End-of-day ritual + roll-forward + closed banner + reopen | KEPT |
| Focus tunnel (timer/pause/reset/skip/complete) | KEPT — chaining actually works now |
| Trophies with progress | KEPT — Logbook, +2 new |
| Export/import (replace/merge) | KEPT — + auto-backup ring, + accepts Quest backups |
| Preview/demo mode with snapshot safety | KEPT — Logbook |
| Level-up moment + ship confetti | KEPT |
| Replan example "Try" chips | KEPT |
| PWA manifest / theme-color | KEPT |

## Dropped in the rebuild — decisions
| Original capability | Verdict | Action |
|---|---|---|
| "Split into N tasks" (task+subtasks → project) | **RESTORE IMPROVED** | "Promote to project" in the edit form + palette command; subtasks become scored child tasks |
| Habits view detail: X-vs-YT stacked 7-day chart, mobile-hours chart, 7-day averages | **RESTORE IMPROVED** | Full screen-log section in Logbook (split chart, mobile bars, averages) — data was always kept |
| Focus-time badge on task rows ("time focused today") | **RESTORE IMPROVED** | Returns on rows, fed by the new session ledger (F4), so it becomes lifetime-actuals, not just today |
| "Day cleared. Solid day." moment | **RESTORE IMPROVED** | Fires once per day when the whole lineup (not just dailies — the original's bug) completes |
| Project type filter chips (Pipeline) | **RESTORE** | Chip row on Dock › Projects |
| First-launch "Try with sample data" CTA on empty Today | **RESTORE** | Empty-state button wired to the existing preview mode |
| Weekly Pulse card (last-week recap, Mon/Tue) | **SUPERSEDED** | Weekly Review flagship (F2) — recap + history + AI retro is a strict superset |
| Planner navigation into past weeks (−52w grid) | **SUPERSEDED** | Weekly Review history + Library "done" filter cover the two real uses (recall + recap); a backwards 28-cell grid earned no daily use |
| Queue "per chunk" list mode | **KILL** | Chunks are editable inline on any row and visible per-day on Plan; a third list projection of the same data was navigation tax |
| Per-day XP footer in planner cells | **KILL** | It was inflated by repeating dailies into all 28 cells; hours + load bar communicate the day honestly |
| Projects mini-card on Today | **KILL** | Dock is one keystroke away; Today stays an execution surface (Ready-to-launch rail already surfaces the actionable case) |
| Six-view navigation itself | **KILL** (re-affirmed) | The 3-surface IA is the rebuild's core product bet; nothing found this session argues against it |
