# FEATURE_PARITY.md — the contract every theme must satisfy

Werf is one functional core with swappable presentation. **A theme may
change how anything looks, moves, or is laid out. It may never change
what the app can do.** This file is the inventory of what the app can
do. Every theme ships 100% of it; the verification walk checks each
item in each theme.

Legend: `[H]` = verified in Harbormaster (theme 1) · `[T]` = verified in
theme 2. Items marked ★ had no design in the reference implementation
and were designed from scratch for theme 2 (list at the bottom).

## G — Global shell

- **G1** Three primary views — Today, Plan, Dock — plus the Logbook
  panel, reachable by visible navigation controls (keys `1 2 3 4`).
- **G2** Persistent display of level number, level title, progress to
  next level, lifetime XP, XP-to-next, and current streak (when > 0).
- **G3** AI status lamp with four states — unknown / ok / busy / off —
  including the "off" explanation detail on hover.
- **G4** Toast/notification surface: message, signed XP delta when
  present, **Undo** button when the action is undoable (6 s window;
  plain toasts 2.6 s).
- **G5** Undo works from the toast button AND from the `U` key
  (last undoable action; entries expire after 8 s).
- **G6** Level-up celebration: transient banner with new level + title,
  plus confetti burst.
- **G7** Confetti also fires on project launch.
- **G8** Preview-mode banner while sample data is loaded, with an
  always-visible **Exit preview** action that restores real data.
- **G9** Cross-tab change banner when another tab writes werf_* keys:
  offers Reload and Dismiss.
- **G10** Keyboard-help overlay listing all shortcuts (toggle `?`,
  close via Esc / button / backdrop).
- **G11** Render-crash error boundary: recovery card with the error
  message and a Reload button (data stays in localStorage).

## K — Keyboard command layer

- **K1** `Ctrl/⌘+K` toggles the command palette from anywhere,
  including inside inputs.
- **K2** Esc cascade order: palette → review → help → task form →
  end-of-day → stats panel → clear cursor. One layer per press.
- **K3** Shortcuts are suppressed while typing in
  input/textarea/select/contentEditable, and while palette, form,
  focus tunnel, or end-of-day are open. Modifier combos pass through.
- **K4** `1 / 2 / 3` switch view; `4` toggles the Logbook panel.
- **K5** `n` focuses the capture bar; on views without one (Plan) it
  opens the full task form instead — never a dead key. `Shift+N`
  always opens the full form.
- **K6** `u` undo · `w` weekly review · `b` morning brief toggle
  (jumps to Today first if elsewhere) · `?` help.
- **K7** `j / k` (and arrow keys) move the row cursor through the
  active view's registered list (Today: adrift rows then lineup;
  Library: the filtered list). Cursor clamps when the list shrinks;
  hovering a row also sets the cursor; Esc clears it.
- **K8** At the cursor: `x` / `Enter` complete or reopen (chunk-aware),
  `e` edit, `f` focus tunnel, `t` schedule today,
  `Delete`/`Backspace` delete (undoable).
- **K9** `f` with NO cursor drops focus into the first pending lineup
  row (the NOW task).
- **K10** `[ / ]` reorder the lineup row up/down (Today only), cursor
  follows the row, order persists (meta.lineupOrder).

## C — Capture

- **C1** Capture bar on Today (auto-schedules for today) and Dock (no
  auto-schedule) with three modes: Task / Steps / Project (mode menu,
  persists for the session).
- **C2** Enter saves instantly and locally; AI enrichment runs after
  and never blocks. Escape clears and blurs.
- **C3** Quick-add grammar, parsed live with a chip preview:
  `!urgent/!h/!l` priority · `#tag` · `@project` (fuzzy, active
  projects) · `2h / 30m / ~1.5h` estimate · `today / tomorrow / fri /
  jul 20 / 20-07 / 2026-07-20` schedule · `due <date>` / `by <date>`
  deadline · `daily / weekly / every day / every week` recurrence.
  Unrecognized tokens stay in the title — nothing typed is lost.
- **C4** Steps mode: AI adds concrete subtasks to the captured task.
- **C5** Project mode: AI drafts the project + child tasks; on AI
  failure a bare project is still created from the raw text.
- **C6** Grammar-used captures skip the AI title rewrite (only score);
  grammar + explicit hours skip AI entirely.
- **C7** A button on the capture bar opens the full task form.

## T — Today

- **T1** Time-of-day greeting (plus all-done and empty variants) and
  the yard counts: pending in yard · lined up · ready to launch.
- **T2** Stat instruments: today's XP with 7-day trend/sparkline data,
  streak with this week's per-day activity, done-today with 14-day
  trend and pending-difficulty breakdown, lineup done/total with XP
  on the slate.
- **T3** Morning brief: deterministic facts always render (yesterday's
  count/XP/focus, adrift count, today's load vs capacity with
  overload/day-off states, deadlines within 3 days), AI prose when
  available, honest "AI off" line with Retry otherwise.
- **T4** Brief actions: collapse/expand (persisted per day, `B`),
  regenerate, **apply suggested run order** to the lineup.
- **T5** The NOW spotlight: the first pending lineup row, showing its
  project, chunk note, estimate, and focus-time-so-far, with
  one-click Complete and Focus actions. Shows the next-up row beneath.
- **T6** Day-cleared state when every lineup row is done: celebratory
  plate with a Close-the-day action; "Day cleared. Solid day." toast
  fires once per day when the last row lands.
- **T7** Adrift (missed) work triage: every undone past-dated chunk
  listed with days-adrift, project, hours; per-row actions
  **Today** (reschedule), **Done** (complete at that date),
  **Dismiss** (remove from plan, undoable).
- **T8** Lineup list: every recurring task due now + today's scheduled
  chunks, energy-sorted with the user's saved run order taking
  precedence; per-row complete/reopen, expand (description, notes,
  subtasks, chunk editor for splits), focus, edit, delete.
- **T9** Lineup reorder by mouse drag AND `[ / ]` — both persist.
- **T10** Energy toggle (Easy / Auto / Hard) re-sorts new arrivals.
- **T11** Review-due nudge on Mon/Tue when last week had activity and
  no retro: opens the review; dismissible per week.
- **T12** Day-closed banner with Reopen; "Close day →" link appears
  once something was done today.
- **T13** Empty states: totally empty yard offers **Preview with
  sample data**; nothing-lined-up shows the next planned day and a
  jump to Plan.
- **T14** Ready-to-launch list (projects at 100%) with a jump to Dock.
- **T15** Next-up preview of the next planned day's items (with chunk
  notes) and a jump to Plan.
- **T16** Screen log quick-entry: X opens and YT opens counters
  (+1 / −1), mobile-hours log/clear, link to the 7-day history.

## P — Plan

- **P1** Header data: pending count, total estimated hours,
  unscheduled count, recurring hours-per-day reserve.
- **P2** Weekly capacity editor: per-weekday hours 0–10 (0 = off),
  inline edit with Enter/blur commit, load meter, today highlighted.
- **P3** Rolling agenda from today (28 days, extendable +4 weeks):
  every day with capacity or items; cap-0 empty days are skipped.
- **P4** Per-day: scheduled + recurring load vs capacity with meter
  and OVERLOADED flag; lock/unlock toggle — the AI planner never
  touches locked days, and drops onto them are blocked with a toast.
- **P5** Chunk cards: complete/reopen in place, click-to-edit the
  task, split badge (i/n), unschedule (undoable), project color,
  chunk note, hours.
- **P6** Drag a chunk card to another day to move it (keeps hours,
  note, done state; collision-safe; blocked on locked days).
- **P7** AI scheduling: **Schedule N pending** (append to existing
  plan or fresh), optional custom instruction panel (⌘/Ctrl+Enter),
  **Rebuild** (re-plan everything, undoable via toast).
- **P8** AI replan console: natural-language instruction → move /
  schedule / unschedule / split operations applied to the plan
  (undoable), honest "couldn't map that" when nothing applied,
  example prompts offered.
- **P9** Adrift notice with jump to Today's triage.

## D — Dock (Projects + Library)

- **D1** Tab switch Projects / Library (state persists in session).
- **D2** Project type filter (All + Template / Component / Client /
  Side Project / Other).
- **D3** Create project: name + type, keyboard-first (Enter creates,
  Esc cancels), opens it ready for its first task.
- **D4** Project card: percent-complete gauge, task counts,
  ready-to-launch state at 100%, expandable.
- **D5** Expanded project: editable description (blur/⌘Enter commit,
  Esc cancel), child-task ledger (complete/reopen, click-to-edit,
  XP, detach from project), color picker (10 swatches), inline
  rename, delete (cascades children, undoable).
- **D6** Add child task by hand (Enter adds, input stays for the
  next) and **AI add tasks** from a description (⌘/Ctrl+Enter).
- **D7** Launch: available at 100% with ≥1 task; freezes launch stats
  (tasks, XP, est vs focused hours, build-span days), confetti, and
  opens the ship-log entry dialog.
- **D8** Ship-log entry dialog: AI-drafted note with deterministic
  prefill fallback, freely editable, Log it / Skip.
- **D9** Ship log (launched fleet): entries expand to show frozen
  stats + note; Write/Edit entry; **Unlaunch** returns the project
  to the yard. Reopening a child task also un-ships its project.
- **D10** Completing the last child of a project raises a
  "Ready to launch" prompt toast.
- **D11** Library filters: status pending / recurring / done / all;
  sort priority / energy / XP / newest / oldest (pending only);
  text search; project dropdown; tag chips (used tags).
- **D12** Library rows: full TaskRow with split badge or scheduled
  date, keyboard cursor support, expand with chunk editor.
- **D13** Screenshot import: pick an image → AI extracts tasks →
  preview with per-item include toggles, optional group-as-project
  with name → import N (deterministic scores if AI gave none).

## F — Task form (modal)

- **F1** Create (Shift+N, palette, capture-bar button) and Edit (E,
  row buttons, click title in project/plan) share one form.
- **F2** Fields: title (Enter submits), description, notes, priority
  (4), repeats Once/Daily/Weekly, difficulty (4), hours + XP,
  schedule date (with Today / Tomorrow / Clear; hidden for recurring
  and split tasks), deadline (with Clear), project, tags (built-in +
  custom + new-tag input), subtasks (add/remove).
- **F3** Deterministic score follows difficulty/hours until the user
  touches XP; touched score disables the async AI refinement.
- **F4** Uncommitted text in the subtask/tag inputs is committed on
  submit, never dropped.
- **F5** ⌘/Ctrl+Enter submits from anywhere in the form; Esc cancels.
- **F6** Editing: changing the schedule date re-pins the plan;
  changing the project moves membership both ways.
- **F7** **Promote to project**: task with subtasks becomes a project
  whose children are the subtasks (scored async), original task and
  its undone chunks removed, fully undoable; jumps to the Dock.
  Also available from the palette on the cursor row.

## X — Focus tunnel

- **X1** Entry points: `f` at cursor, `f` with no cursor (NOW task),
  row focus buttons, NOW plate button.
- **X2** Timer resumes from today's accumulated focus time; Space
  pause/resume; Reset; Esc exits.
- **X3** Skip advances to the next pending lineup task; the up-next
  task is previewed.
- **X4** Mark complete: chunk-aware completion + auto-advance to the
  next pending task (tunnel closes when none left).
- **X5** Focus time persists every 5 s; sessions ≥ 1 minute land in
  the session ledger on exit (fuels calibration + review).
- **X6** Task context shown: project, difficulty, estimate.

## L — Palette (⌘/Ctrl+K)

- **L1** Fuzzy command list (all global commands incl. close day,
  rollover pointer, brief, review, stats, undo, help, capture, new
  task) with their key hints.
- **L2** Task search: matching tasks open in the editor.
- **L3** Quick add: `> <text>` uses the full capture grammar, shows
  parsed chips inline, schedules when a date token is present.
- **L4** Cursor-row commands when a row is under the cursor:
  complete/reopen, edit, focus, schedule today, schedule tomorrow,
  delete, promote-to-project (when eligible).
- **L5** Arrow navigation + Enter to run; hint row seeds `> `.

## S — Logbook panel

- **S1** Level statement: level, title, lifetime XP, XP-to-next,
  progress meter.
- **S2** Streak / Completed / Launched summary tiles.
- **S3** Open the weekly review from the panel.
- **S4** Estimate calibration (60 days): overall actual÷estimate
  factor + per-difficulty factors with n, total focused time,
  honest "not enough data" state below 3 tasks.
- **S5** All 16 trophies with unlock state and derived progress bars
  toward the countable ones.
- **S6** Screen-log 7-day detail: X/YT totals, average mobile hours,
  stacked opens chart data, mobile-hours bars.
- **S7** Day-rollover setting: presets Standard (0) / Late (22) /
  Overnight (4) + free hour input 0–23; affects every "today"
  computation live.
- **S8** Data tools: export JSON backup; import Werf or Quest backup
  with merge / replace choice (confirmations); enter/exit preview
  mode; auto-backup status line; migration provenance line.

## E — End of day

- **E1** Entry points: palette command, Today's "Close day →" link,
  the day-cleared plate.
- **E2** Recap: completed count + list, XP earned.
- **E3** Unfinished list with **roll to next working day** toggle
  (first day within 21 with capacity > 0).
- **E4** Screen-time capture (mobile hours) if not yet logged.
- **E5** Close the day → records meta.dayClosed, toast reports how
  many rolled; Today shows the closed banner with **Reopen**.

## R — Weekly review

- **R1** `W` opens last week; browse older/newer across every week
  with activity.
- **R2** Week stats: done, XP, focused time, launches; per-day
  activity with best day; estimate accuracy for the week; adrift-now
  count; launched list; effort split by project (hours).
- **R3** AI retro: generated once per week and cached forever;
  Rewrite button; honest AI-off state with Retry; stats always
  render regardless.
- **R4** Empty week state with a jump to older weeks.

## A — AI subsystem (cross-cutting)

- **A1** All AI calls go through the serverless proxy
  (`/api/anthropic`); the key lives server-side only.
- **A2** Typed failures — no-key / network / upstream / parse — with
  distinct honest messages; first failure per session toasts once;
  the status lamp reflects ok/busy/off.
- **A3** Every AI feature has a deterministic fallback and the app is
  fully usable with AI off: scoring falls back to the deterministic
  curve, capture keeps the raw title, project capture makes a bare
  project, brief shows facts, review shows stats, launch note
  prefills deterministically, planner/replan simply report failure.

## M — XP, streak, gamification (derived, never stored)

- **M1** XP ledger derives from completion history: recurring tasks
  pay per history day; split tasks pay per chunk proportional to
  hours (shares sum exactly to task XP); single completions pay at
  completedAt; migration remainders pay at completion date.
- **M2** Lifetime XP = baseline (migrated) + ledger; today XP, per-day
  XP, activity, streak (yesterday keeps it alive until today's first
  completion) all derive from the same events.
- **M3** 11 levels with names and thresholds; level-up detection with
  celebration; XP-to-next everywhere it's shown.
- **M4** 16 achievements checked after every completion/launch, with
  a trophy toast on fresh unlocks; progress derivable for countable
  ones.
- **M5** Deterministic score curve: XP scales with hours^0.7 off the
  difficulty base, clamped 5–100.
- **M6** Energy sort modes (priority-first / easy-first / hard-first)
  and the user run-order override that outranks them.

## DATA — persistence & migration (theme-independent, must not break)

- **DATA1** localStorage `werf_*` schema v2; debounced per-slice
  writes; flush on beforeunload.
- **DATA2** One-time migration from quest_* (v1–v8), vsq_*, and
  shiplist keys with XP-baseline preservation; legacy keys untouched.
- **DATA3** Rotating 7-slot daily auto-backup.
- **DATA4** Export / import (merge or replace), accepting Werf and
  Quest backup formats; newer-schema imports rejected readably.
- **DATA5** Preview mode: snapshot real data → demo yard → exact
  restore on exit; export/import blocked while previewing.
- **DATA6** Day-rollover hour shifts the effective date of every
  derivation (XP day, streak, lineup, brief, review) consistently.

---

## Appendix A — reference implementation study (reference/app)

The ZIP is a static multi-page demo ("1-Bit Harbor, Second Tide"):
same material DNA, redesigned shell and dashboards, all data faked in
page scripts. Its code is design reference only — nothing was copied
into the core.

### UI additions adopted into theme 2 (derived from real app data)

1. **Harbor strip** — sticky top status bar: port name + current view,
   a per-view stat cell, local-time clock, ship's watch name, and
   ship's bells (1–8, advancing every 30 min of the 4-hour watch).
   Watch/bells/clock derive from the real clock; the stat cells derive
   from real state (pending counts, week capacity, berths, lifetime XP).
2. **Draught gauge** — the level rendered as a vertical depth meter in
   the mast with a "draught in metres" readout derived from level pct.
3. **Ghost numeral** — giant dither-filled background numeral per view
   (day number / ISO week / berth count / level).
4. **The horizon** — an animated 1-bit seascape canvas (stars, moon,
   two wave layers, moon reflection) stepped at ~9 fps, with an
   instrument HUD; honors prefers-reduced-motion and hidden tabs.
5. **Bridge Focus gauge** — focus hours today on the instrument bar
   (derived from the session ledger + live focus time).
6. **Lineup ledger styling** — row index numerals and a per-row +XP
   readout; "XP left on the slate" phrasing for the lined-up gauge.
7. **Plan: Rail/Cards view toggle** — day items as vertical ledger
   rows or as the flowing card grid; tide-rail tick ruler; per-day
   percent-of-capacity readout; DAY OFF / "nothing moored" /
   "REST — the yard is closed" band copy; week stencil + week-level
   placement stats in the header.
8. **Dock: rotary berth gauges** — percent-complete as a ring of
   square cells (canvas) instead of an arc; HULL COMPLETE stamp;
   berth note line as a stamp; **Board** affordance to open a berth.
9. **Dock: manifest rail** — the ship log as a dated manifest with
   frozen XP readouts in the right rail; "seven ships gone out" foot.
10. **Dock: Berth action** on unassigned library rows — one-click
    assign-to-project (a new affordance over the existing
    task→project membership operation; no new core behavior).
11. **Logbook as a full page layout** (in theme 2's presentation):
    level stack with NEXT RANK line (derived from the real
    LEVEL_NAMES/THRESHOLDS tables), 30-day averages panel (XP/day,
    focus hours/day, slate-cleared %, adrift rate — all derived),
    screen weather (14-day combined X+YT opens, heavy days marked),
    trophies with EARNED tapes and % meters, reviews list with Open,
    day-rollover stepper.
12. **Chrome details** — mast coordinates line, block-caret capture
    slab with inline type toggles, palette "Issue a command…" prompt
    with ▸ markers, weather cell (decorative), footers.

### Reference behaviors NOT adopted (would change core behavior — flagged)

- The demo focuses capture with `C` and hints "C FOCUS". Werf's
  capture key is `N` (with `n`/`Shift+N` semantics); rebinding is a
  functional change, so theme 2 keeps `N` and its hints show the
  real bindings.
- The demo's "Sub" capture type attaches a subtask to the current
  ON-DECK task. Werf's "Steps" mode (AI subtask breakdown of a new
  task) is the real capability; theme 2 keeps the real semantics.
- The demo's rollover stepper clamps to 0–8 and its trophies/ranks
  ("WHARFMASTER", "DOCKMASTER", 0–8h only) are fake data. Theme 2
  uses the real 0–23 range, real presets, real trophies, real
  LEVEL_NAMES.
- The demo is multi-page (full reload per view). Werf stays a SPA;
  theme 2 renders views client-side like the rest of the app.

### Functional gaps in the reference (theme 2 designs these itself)

No task form/editing of any kind; no focus tunnel; no end-of-day
dialog; no weekly review; no undo (ticker has no Undo, no `U`); no
keyboard help; no drag-and-drop (lineup or plan); no `[ ]` reorder,
`e/f/t/Del` cursor actions, or Esc cascade; no capture grammar chips,
AI enrichment states, or full-form button; no plan day locks, AI
instruction panel, replan ops, chunk complete/move/unschedule, or
horizon extension; no project create/edit/delete/rename/color/detach/
add-task/AI-extend/launch-note/unlaunch; no library filters, search,
sort, or screenshot import; no data export/import, preview mode,
calibration by difficulty, or migration/backup surfaces; no cross-tab
banner, error boundary, confetti, or level-up banner. **Every one of
these ships in theme 2, restyled into its visual language** — the ★
list below records the ones that needed original design work.

## Appendix B — theme-2 items designed without a reference design ★

The reference had no UI for any of the following; each was designed
from scratch in Nightwatch's visual language (nothing functional was
dropped):

- **Task form (F1–F7)** — the "Refit task" console: clipped-corner
  chassis, stamp-pick choosers for priority/repeats/difficulty/tags,
  well fields, "Give it a berth" promote action.
- **Focus tunnel (X1–X6)** — the night tunnel: watch header
  ("On watch/Paused"), lamplight timer, up-next plate, and a calm
  horizon strip at the foot of the screen.
- **End of day (E1–E5)** — the "End of watch" console with
  "tow to next working day" and "EIGHT BELLS." sign-off.
- **Weekly review (R1–R4)** — console with the amber week banner,
  well tiles, dithered week bars, effort-split meters, cached retro.
- **Command palette (L1–L5)** — the reference chassis made real:
  command search, task search, `>` quick add with grammar chips,
  cursor-row commands, arrow navigation.
- **Undo surface (G4–G5)** — ticker gains the Undo bezel + `U` key hint.
- **Keyboard help (G10)** — the "Standing orders" console.
- **Preview / cross-tab banners, level-up statement, confetti
  (G6–G9)** — restyled under the harbor strip.
- **Adrift triage actions (T7)** — Today/Done/Dismiss bezels on
  hazard-striped rows.
- **Lineup interactions (T8–T10, K7–K10)** — drag reorder, expandable
  rows with steps/notes/chunk editor, cursor brackets, energy toggle.
- **Plan operations (P2, P4–P8)** — inline capacity editing, day
  locks, chunk complete/move/unschedule in BOTH Rail and Cards modes,
  AI instruction panel, replan console with examples, +4 weeks.
- **Dock operations (D2–D10, D13)** — type filters, create/board/
  rename/recolor/scuttle, add-task + AI-add, launch-note dialog,
  unlaunch, screenshot import with preview.
- **Logbook capabilities (S3–S8)** — real calibration by difficulty,
  full trophies with derived progress, reviews list wired to the real
  review overlay, rollover presets + full 0–23 input (the reference
  stepper clamped to 0–8), export/import/preview data tools,
  migration + backup provenance lines, theme picker.

UI-only additions adopted FROM the reference are listed in Appendix A;
both sets live entirely inside `src/themes/nightwatch/`.
