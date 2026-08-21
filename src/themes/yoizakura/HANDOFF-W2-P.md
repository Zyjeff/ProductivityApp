# HANDOFF — Yoizakura W2-P (Week / Sunday tea)

Wave owner replaced the Plan and Review stubs. Exports unchanged: `PlanView`, `ReviewOverlay`. CSS prefix `yzp-` only, concatenated by W1 `index.js`.

`npm test` → 25/25. `npm run build` → pass (existing chunk-size note only). Grep of owned files: no `localStorage`, no `requestAnimationFrame`, no `toDataURL`.

## What landed

**Week (`views/plan.jsx` + `css/plan.css`)** — DESIGN.md §5.2, parity P1–P9.

- Top rail: pending · est hours · unscheduled · recurring reserve (`daily = h`, `weekly = h/5`) · fallen-leaves notice → Today (P9).
- Lintel: 7 weekday headers, capacity 0–10 inline (Enter/blur commit, Esc cancel), quiet 3px load meter (this week’s that-column load), today carved amber.
- **Shoji wall = 2D lattice** (weeks × weekdays). 4 rows from `mondayOf(effectiveTodayIso(dayStartHour))`; **+4 weeks** appends rows. Do not regress this to a 1D day strip. Narrow viewports horizontal-scroll the grid (`min-width: 860px`).
- Each pane: date numeral, tanzaku slips (complete/reopen via `setCompletion` + `chunkDate` — no extra toast), click title → `setUI({ formOpen: true, editingTaskId })` writing desk, split `i/n`, list color tick, note, hours, `dismissChunk` unschedule (undoable). Foot load bar = (scheduled + recurring reserve) ÷ cap. OVERLOADED = red strain crack + flag. Lock = paper slides shut + “resting” stamp; AI gets `lockedDateSet`; drops onto locked panes toast **`That day is locked`**. Today = lantern-glow edge. Past days of week 1 = dimmed/inert. Cap-0 empty days stay visible as dim “resting” panes.
- Drag slip pane→pane = `moveChunkDate` (blocked on locked; same-day drop ignored).
- **The Gardener** (dusk band under the wall): Schedule N pending (append/fresh), instruction panel (`⌘/Ctrl+Enter`, `MOD` hint), Rebuild (`applyPlan` labeled “Plan rebuilt”), replan console. Failures via `aiFailureMessage(e.kind)` toast. `{empty:true}` → **“The Gardener couldn't map that.”** + example chips.

**Sunday tea (`views/review.jsx`)** — §5.6, R1–R4.

- Full-page `yz-overlay`; close = `closeReview()` (clears `reviewWeek`). Backdrop click on the dusk margin also closes.
- Tatami **pinwheel** (statement + surrounding mats), not a 4-column grid. Statement: `fmtWeekLabel` / `stats.label` + older/newer across `reviewableWeeks`.
- Mats: done/XP/focus/seals · per-day dithered ink bars + best day · estimate accuracy · fallen-now · sealed lists · hours-by-list meters · Attendant retro (generate-once `useEffect` keyed on `[week]`, Rewrite, away-line + Retry, stats always render).
- Empty week: **“a quiet week”** + jump older.

Logic lifted from `nightwatch/views/plan.jsx` and `review.jsx` (handlers, AI flows, recurring formula, retro cache). Composition does not follow Nightwatch.

## Additions I wanted but could not make

W2-P cannot touch W1 files. Integration may apply:

1. **`yz-sheet--week` (app.jsx / base.css)** — when `view === "plan"`, switch the center sheet from default washi to dusk so the kumiko lattice floats in the evening garden. Workaround: wood frame (`#4a382c`) + washi panes on the existing washi sheet.
2. **`yz-wood` token / utility** in `base.css` for kumiko brown — inlined in `plan.css`.
3. **Ink/week bars in `components.jsx` or `garden.jsx`** — Sunday-tea day bars are dithered `div`s in `plan.css` (no canvas, no rAF) so we didn’t need a shared chart component.
4. **`openWritingDesk(id)` on `PaneContext`** — DESIGN says `setUI({ formOpen, editingTaskId })`; that already flips the pane to the desk. A helper would only be sugar.
5. **`yzp-*` in the base `:focus-visible` list** — global `button, input, textarea` already covers most controls; extra `yzp-` rules live in `plan.css`.
6. **Lock control on past panes** — DESIGN marks week-1 past days inert, so the lock button is omitted there. If product wants “unlock a day that was locked before it passed,” that needs a W1/W3 policy call; I would not un-inert the whole pane just for that.

## Deviations from DESIGN.md / Nightwatch (with reasons)

1. **Cap-0 empty days are shown**, not skipped (FEATURE_PARITY P3 skip vs DESIGN §5.2 “lattice shows the true week”). Followed DESIGN.
2. **Horizon is 4 week-rows from this week’s Monday**, not “28 days starting at today.” A Wednesday start includes Mon–Tue as dim past panes. `+4 weeks` still appends 28 lattice days. Followed DESIGN §5.2 / P3’s extend control.
3. **Capacity Esc actually cancels.** Nightwatch unmounts the input on Esc, then `onBlur` commits. P2 requires cancel; a `skipCapCommit` ref swallows that blur.
4. **Locked drops always `preventDefault` on `dragOver`.** Nightwatch only did that for unlocked days, so `onDrop` (and the toast) often never fired. Verification must see **`That day is locked`**. Copy kept verbatim.
5. **Empty replan copy** is DESIGN’s “The Gardener couldn't map that.” Input is cleared so the example chips return (Nightwatch kept the failed text, which hid them).
6. **No Rail/Cards toggle** — Nightwatch extra, not a contract item. One tanzaku language, full P5/P6 in that single mode.
7. **Gardener is not `position: sticky`.** Sticky would cover the bottom week-row and eat drop targets. It is a normal band under the wall.
8. **Past panes are inert** (no drag, no drop, no lock, no complete). Fallen-leaf triage is Today (P9). Do not expect a drop-toast on Monday if today is later in the week.
9. **Lock blocks AI + drops-onto only.** Complete / edit / unschedule / drag-*out* still work on a locked future/today pane (same as Nightwatch; P5 does not disable them). Paper cover is `pointer-events: none`.
10. **Review older/newer use chevronL / chevronR** (not Nightwatch’s down + right). Aria labels stay “Older week” / “Newer week”.
11. **Effort-split “Loose tasks”** is the core `weeklyReviewData` label (not renamed to “No list”).

## Verification wave — drive these hard

**Drag / drop / lock (the trap):**

1. Open Week. Confirm a **7-column × 4-row** wall, not a vertical day list.
2. Drag a tanzaku onto another **unlocked future or today** pane → it moves; hours/note/done survive; `U` is not required (move is not undoable in core).
3. **Lock a future day or today** (not a dimmed past pane). Drag a slip onto that pane → toast **`That day is locked`**, plan unchanged. Unlock and drop again → move succeeds.
4. Try dropping onto a **week-1 past** pane: it should refuse silently (inert). That is not the lock toast.
5. Cap-0 Saturday/Sunday with no items: pane still present, labeled resting — not omitted.

**The rest of P/R:**

- Cap click → type `0` / `7` / `10.5` (clamp to 10) / garbage (→ 0). Enter and blur commit; Esc restores the previous value.
- Today’s lintel cell amber; today’s pane lantern-glow.
- Overfill a day (or drop extra hours onto a low cap) → red crack + OVERLOADED flag. Meters stay 3px, not full-width shouty gauges.
- Complete / reopen a slip in place (toast comes from core only). Click title → writing desk in the paper pane. Split badge `i/n`. Unschedule → Undo / `U`.
- Fallen-leaves rail → Today.
- Schedule N pending (busy lamp), optional instruction `Ctrl/⌘+Enter`, Rebuild → Undo. Replan a nonsense sentence → Gardener empty toast + example chips. Kill the API → `aiFailureMessage` toast, plan unchanged.
- `W` → Sunday tea pinwheel (statement mat larger, not a uniform card grid). Older/newer. Empty week copy **a quiet week**. Retro Rewrite; Attendant-away + Retry; tiles still there when AI is off. Close / Esc clears `reviewWeek`.
