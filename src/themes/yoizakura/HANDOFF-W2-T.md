# HANDOFF — Yoizakura W2-T (Today · Night garden · Close the amado)

Wave T replaced the Today / Focus / End-of-day stubs. Exports unchanged: `TodayView`, `FocusTunnel`, `EndOfDayDialog`. `EnergyToggle` is also exported (Pace labels) in case integration wants it.

`npm test` 25/25. `npm run build` passed (bundle-size note only). Grep of owned files: no `localStorage`, no `toDataURL`, no new rAF (petal layer in `garden.jsx` remains the only loop).

## What shipped

**Today (`views/today.jsx` + `css/today.css`)** — one washi page, top→bottom:
1. Sheet header: time-of-day greeting + all-done/empty variants, long date from `effectiveTodayIso`, day-closed banner + **Open the house**, Sunday-tea nudge (Mon/Tue, dismissible) + `W`, **Close the amado →** once `doneToday > 0`.
2. `CaptureStrip scheduleToday`.
3. Morning letter: facts always, Attendant prose when on, honest away + **Retry**, collapse via `patchBrief({dismissed})` + `B`, regenerate clears `attempted+text+order`, **Apply suggested order**. Both brief `useEffect`s lifted verbatim from Nightwatch.
4. **In hand** plate (title / list / chunk note / estimate / focus-so-far, Complete + Focus, **Then:** next). Day-cleared: “The garden is tended. The evening is yours.” + Close the amado (T6).
5. **Fallen leaves**: days-fallen, list, hours; Today / Done / Let go (undoable). Header **Sweep all to today** = loop `moveChunkDate(taskId, iso, todayIso)`.
6. Today lineup: `TaskRow` + `onOpen={openTask}` (expansion is the paper pane, not in-row). Drag and `[ ]` both persist via `setLineupOrder`. **Pace**: Gentle / Auto / Push = `energy`.
7. Quiet foot instruments: today-XP 7d ink spark, streak week dots, done-today 14d + pending difficulty split (real names), slate done/total + XP left. Tiny canvases/dithered divs live in `today.jsx` and paint on data change.
8. Empty: truly-empty → **Borrow a furnished house** (`enterPreview`); nothing-lined-up → next planned day + **Week →**.

Keyboard: `registerActiveList("today", kbRows)` — fallen first (own iso as `chunkDate`) then lineup (today iso for chunks); cursor highlight with `missed.length` offset; re-register on every memo change; hover sets cursor.

Garden pane (T1 yard counts, T14 ready-to-seal, T15 next-up, T16 screen log) is **not** duplicated — already in `pane.jsx`.

**Night garden (`views/focus.jsx`)** — dusk clearing, task + list + difficulty + estimate, giant Shippori Mincho timer, `ShishiOdoshi` with `pct = elapsed ÷ estimate` (repaint on the 250ms tick, no rAF). Pause/Resume (Space), Reset, Skip + up-next stone, Complete (chunk-aware + auto-advance), Exit (Esc). Timer logic verbatim from Nightwatch.

**Close the amado (`views/endofday.jsx`)** — washi console between two visible shutter panels. Recap + XP, unfinished with **carry to the next open day**, mobile-hours when unlogged, Close → `closeDay({rollForward})` then shutters slide (instant under reduced-motion) and sign-off **THE HOUSE SLEEPS.** Overlay is held locally after `closeDay` so the ceremony can finish (`endOfDayOpen` is already false).

**`garden.jsx`** — only additive: optional `className` on `ShishiOdoshi` (default `""`). Existing props unchanged. Tree petal rAF untouched.

## Additions I wanted but could not make (integration wave)

Owned files only — these would live in W1 surfaces:

- A **size/scale token** for `.yz-shishi` in `css/base.css` (Night garden currently scales via `.yzt-shishi { transform: scale(1.66) }`).
- **Pace** as a shared `components.jsx` primitive (leading label + `yz-seg`). I inlined it in Today.
- Reusable **day-closed / Sunday-tea** banner variants on `.yz-banner` instead of `.yzt-banner`.
- A cream **washi statement** helper next to `statementBg` (gold/leaf). In-hand / tended plates use `statementBg` so the one statement moment has sumi edges; a washi-tinted recipe would sit better on the day sheet if W1 wants to add it.
- `Eyebrow` without the baked `margin-bottom: 12px` so section heads can share it in a flex row.
- Optional: include `.yzt-letter--folded`, `.yzt-hand-title`, `.yzt-then`, `.yzt-leaf`, `.yzt-stone` in the base `:is(...):focus-visible` list. Generic `button` already covers the real buttons; fallen-leaf rows are `div`s (same as Nightwatch `lrow`) — keyboard goes through `j/k`.

No core changes requested.

## Deviations from DESIGN.md (with reasons)

1. **T1 / T14 / T15 / T16 are not on the sheet.** HANDOFF-W1 + §5.1 put them on the garden pane. Duplicating would fight the three-pane house.
2. **T8 expand is the paper pane**, not an in-row accordion. Matches §5.10 / TaskRow API (`onOpen={openTask}`). ChunksEditor stays in the task sheet.
3. **T2 instruments sit at the foot**, not a Nightwatch-style header bridge. That’s the §5.1 composition (item 7 “quiet”).
4. **T10 labels** are Pace Gentle/Auto/Push (§3 copy table), not Easy/Auto/Hard. Energy ids remain `low|normal|high`.
5. **T7 “Dismiss”** is **Let go**; bulk sweep is a Berth-pattern loop of existing `moveChunkDate` (no new core op).
6. **Long date** uses `parseIsoDate(effectiveTodayIso(...))`, not `new Date()`, so overnight rollover doesn’t lie. Greeting *hour* still uses wall-clock (time of day, not day-bucketing).
7. **E4** captures mobile hours only when unlogged (parity text). X/YT counters stay on the garden screen-log slips.
8. **E5 ceremony** holds the overlay after `closeDay` so shutters + “THE HOUSE SLEEPS.” can play. Core toast / `dayClosed` still come from `closeDay` itself.
9. **Night garden Skip** is a top-bar control *and* the up-next stone is clickable — both are Skip. Layout is a dusk stage (timer | shishi), not Nightwatch’s header/horizon stack.

## Drive these hard (verification wave)

- **Keyboard list:** fallen rows first, then lineup. `j/k` highlight; `x` completes fallen *at that iso* and lineup chunks *at today iso*. Hover sets cursor. Re-register after sweep / complete / capture (list identity changes).
- **`[ ]` and drag** both persist `setLineupOrder` across reload.
- **`b`** collapse/expand letter (persisted). Regenerate, Apply suggested order, AI-off Retry. Facts always visible; no prose-loop.
- **In hand** Complete (chunk-aware, no extra toast) and Focus (`f` with no cursor still hits NOW via core). Then-row opens the pane. Day-cleared plate when every lineup row is done.
- **Sweep all to today** on several fallen leaves (including two chunks of the same task). Let go undoable with `U`.
- **Empty:** blank house → Borrow a furnished house; pending-but-unscheduled → next planned day + Week →.
- **Night garden:** elapsed seeds from today’s `focusMs`; 250ms tick; persist every 5s **and** on pause/unmount; session ≥60s on exit; Space / Esc with input-tag guard; Skip chains; Complete auto-advances then closes; shishi **tips at each quarter** (no rAF, no extra `toDataURL`).
- **Amado:** roll-forward off/on, mobile hours log, shutters visible then closed, reduced-motion instant, sign-off, Today shows closed banner + Open the house.
- **Contrast:** body copy is sumi on washi; statement plates are ink on gold/leaf with dither only at the edges; night garden is moonlit on dusk.
- **Theme soak:** switch away and back; Today/Focus/EOD must not write `localStorage` themselves.
