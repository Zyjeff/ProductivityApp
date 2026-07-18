# Parity walkthrough — satisfying FEATURE_PARITY.md in practice

FEATURE_PARITY.md is the checklist; this file is the field guide: what
each section means when you're actually building, where both themes
implement it, the traps that have bitten before, and how to verify.

Notation: **DD** = `src/themes/drydock/`, **NW** = `src/themes/nightwatch/`.

## G — Global shell (build first)

Your `app.jsx` renders: nav (three views + Logbook trigger), the
level/streak readout, the AI lamp, and a surface for every overlay flag
(see core-contract §2 table). DD: `app.jsx` with the mast + slide-over
StatsPanel. NW: `app.jsx` with the mast + harbor strip + full-page
LogbookPage.

Traps:
- The toast needs the Undo button wired to `runUndo(toast.undoId)` —
  forgetting it kills half the undo surface (G4).
- Confetti: track a local "shown" counter and compare to `ui.confetti`
  (both themes copy the same 10-line pattern).
- The preview/cross-tab banners must not be dismissible-into-nowhere:
  preview always offers Exit, cross-tab offers Reload + Dismiss.
- Nav must clear the cursor (`setUI({ view, cursor: null })`) or stale
  indices point at rows that no longer exist (core clamps, but the
  highlight jumps).

## K — Keyboard

Almost everything is core; your job is the two hooks
(`registerActiveList`, `setCaptureFocus`) and rendering cursor state.

Traps:
- **Index offsets.** Today registers adrift rows THEN lineup rows in one
  list. When highlighting, adrift row i uses cursor index i; lineup row
  i uses `missed.length + i`. Both themes name this `globalIdx`.
- Re-register on every list change (`useEffect` keyed on the memoized
  rows) — core clamps the cursor when the list shrinks, but only if you
  re-register.
- `chunkDate` in registered rows must be the TODAY iso for lineup chunk
  rows and the item's own date for adrift rows — `x` completes through
  `setCompletion` with exactly that value.
- Don't add your own global key listeners except inside self-contained
  overlays (the focus tunnel adds Space/Esc locally — copy that pattern,
  including the input-tag guard).

## C — Capture

One component, used on Today (`scheduleToday`) and Dock (without). The
sacred sequence on Enter:

```js
const task = captureTask(v, { mode, scheduleToday, parsed });
if (task) enrichCapturedTask(task.id, grammarActive ? parsed.title : v,
  mode, { grammarUsed: grammarActive, hasHours: !!parsed?.hours });
```

Parse live with `parseQuickAdd` (task mode only) and show the chip
preview — users type trusting the grammar echo. Project mode calls
`captureProject(v)` instead. DD: `capture.jsx` (mode dropdown). NW:
`capture.jsx` (inline slab-types toggles). Both show the real `N` hint —
never invent bindings.

## T — Today (the hardest view; budget accordingly)

Composition is fully yours (DD: instrument bar + rail column; NW:
horizon + bridge + rail), but these must exist somewhere:

- Stats: today XP + trend, streak + week activity, done today,
  lineup progress. Derive exactly like both themes' `stats` memo
  (14-day windows, `trend()` on 7v7).
- Morning brief: facts always (from `morningBriefData`), prose when AI
  delivers, collapse/expand persisted via `patchBrief(iso, {dismissed})`
  (the `b` key flips it), regenerate = clear `attempted`+`text`, apply
  run order. The generation effect is two `useEffect`s — copy them; the
  guard conditions prevent regeneration loops.
- NOW spotlight: first pending lineup row; complete + focus actions;
  day-cleared state when none pending (with close-day action).
- Adrift triage: rows from `getMissedWork` with Today / Done / Dismiss.
- Lineup: rows via `todayLineup`-derived props; drag reorder AND `[ ]`
  both persist through `setLineupOrder`; energy toggle; expand with
  desc/notes/subtasks and the ChunksEditor for splits.
- Rail/aux: ready-to-launch (projects at 100%), next planned day
  preview, screen log quick entry (+1/− and mobile hours), review-due
  nudge, day-closed banner + Reopen, both empty states (truly-empty
  offers `enterPreview`).

Trap: drag state is plain component state (`dragIdx`/`dragOverIdx`);
on drop, splice the id array from the CURRENT lineup and call
`setLineupOrder(ids)` — don't try to reorder rows locally.

## P — Plan

Required wiring: capacity editor (0–10 clamp, Enter/blur commit),
rolling agenda from `effectiveTodayIso` (skip cap-0 empty days except
today; extendable horizon), per-day load = scheduled hours + recurring
reserve, lock toggle (and drops onto locked days blocked with a toast),
chunk cards (complete light, click-to-edit, drag between days via
`moveChunkDate`, split badge i/n, unschedule), AI schedule/instructions/
rebuild/replan with busy states and honest failures, adrift notice.

Traps:
- Recurring reserve: `daily` counts full hours per day, `weekly` counts
  hours/5 — copy the `recurringHours` formula.
- The replan result can be `{empty: true}` — say "nothing was changed"
  honestly instead of pretending success.
- Layout variants are welcome (NW has Rail/Cards modes) but every mode
  must carry the full per-chunk functionality — a pretty read-only mode
  is a parity violation.

## D — Dock

Two halves behind `dockFilter.tab`:

Projects: type filter, create (keyboard-first), per-project percent
gauge, expand → editable description, child ledger (complete / edit /
XP / detach), add-task input that stays open for the next, AI add-tasks,
color swatches (all 10), inline rename, delete (undoable), Launch at
100% → `shipProject` freezes stats and opens the note dialog
(AI draft with the deterministic prefill fallback → Log it / Skip),
ship log with expandable entries + Write/Edit entry + Unlaunch.

Library: status filters, sorts (pending only), text search, project
dropdown, used-tag chips, screenshot import (file → `aiImportFromScreenshot`
→ preview with per-item toggles + optional group-as-project → commit),
full TaskRows with cursor + registerActiveList("library", …).

NW addition worth keeping in new themes: the one-click "Berth" assign on
unassigned rows — it's just `updateTask(id, {projectId, projectIdChanged:
true})` with a picker, no new core behavior.

## F — Task form

Copy either theme's `taskform.jsx` logic wholesale and reskin — it
encodes several non-obvious rules: deterministic score follows
difficulty/hours until XP is touched (then AI refinement is skipped on
create); uncommitted subtask/tag input text is committed on submit;
schedule/project changes on edit set the `*Changed` flags; split tasks
lock the estimate fields; promote-to-project commits pending steps
first, scores children, and jumps to Dock. ⌘/Ctrl+Enter submits from
any field; title Enter submits.

## X — Focus tunnel

Copy the timer logic verbatim (both themes are identical here): elapsed
seeds from today's `focusMs`, ticks at 250ms, persists every 5s AND on
pause/unmount, logs the session delta once on unmount, Space toggles,
complete advances to `nextFocusId` (chunk-aware completion). The visual
shell is entirely yours.

## L — Palette

`buildCommands()` + task-title search + the `>` quick-add branch
(reusing `parseQuickAdd` and the same capture/enrich sequence). Arrow
navigation with hover sync; Enter runs; items with `keepOpen` don't
close. The hint row that seeds `"> "` is small but teaches the feature —
keep an equivalent.

## S — Logbook (settings home)

Whatever the shape (DD slide-over, NW full page), it carries: level
statement, streak/completed/launched, review entry point, calibration
(with the honest <3-tasks state), all 16 trophies with derived progress,
screen-log 7-day detail (totals + per-day data + mobile), day-rollover
presets AND free 0–23 input, data tools (export, import merge/replace
with confirms, preview enter/exit, backup line, migration line), and the
theme picker.

## E / R — End of day, Review

E: recap (completed list + XP), unfinished list with roll-forward
toggle, optional mobile-hours capture, `closeDay` → Today shows the
closed banner with Reopen. R: week banner, tiles, per-day chart, best
day, accuracy, launched, effort split, cached AI retro with Rewrite and
the AI-off + Retry state, older/newer browsing across
`reviewableWeeks`, empty-week state.

## A / M / DATA

Nothing to build — but everything you surface must come from core calls
so these stay true. The quick self-audit: grep your theme for
`localStorage` (should appear zero times) and for arithmetic on XP
(should be zero — display only).

---

## Verification drives (step 8)

Do these in the RUNNING app, in your theme:

1. **Keyboard sweep** — `1 2 3 4`, `?`, `⌘K`, Esc through every layer,
   `j/k → x → u`, `[ ]` then reload and confirm order survived, `e`,
   `f` with and without cursor, `n`, `Shift+N`, `b b`, `w`, `t`, Del+u.
2. **Capture grammar** — type
   `Fix rig !urgent #client @<project> 2h fri` and confirm every chip,
   then Enter and check the task's fields in the row.
3. **Project lifecycle** — create → add child → complete child → READY →
   launch → edit note → log → expand ship log → unlaunch → delete →
   undo.
4. **Plan** — edit a cap, lock a day, drop a chunk on the locked day
   (toast), move a chunk, complete a chunk, unschedule (undo), extend
   horizon, run one AI action and observe busy → honest outcome.
5. **Day cycle** — close day with roll-forward on unfinished work,
   confirm the tow landed on the next capacity day, Reopen.
6. **Data** — enter preview (banner + demo data), exit (byte-identical
   restore), export downloads.
7. **Theme soak** — switch to every installed theme and back 3×; data
   in localStorage byte-identical; `document.querySelectorAll("style")`
   relevant count stays 1.
8. `npm test` (25) and `npm run build` clean.

Then walk FEATURE_PARITY.md top to bottom and tick every item against
what you just drove. Report per item, never "everything works".
