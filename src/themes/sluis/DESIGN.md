# SLUIS — build plan & theme spec

> Internal build document for the `sluis` theme. Not shipped copy.

## The fiction

A **sluis** is a Dutch lock chamber. The user is the lock keeper. Work is
water traffic:

- Tasks are **vessels** waiting in the chamber (**de kolk** = Today).
- Completing a task **locks it through** — *schutten*. The vessel exits,
  leaving a ripple and a wake.
- Today's XP **raises the water level** in the chamber. When the slate is
  clear the chamber is empty and the **gates open**.
- Energy is **tide**: Eb / Getij / Vloed (low / normal / high).
- Plan is **het kanaal** — the canal ahead, drawn as a stepped profile of
  pounds; lock gates sit between days.
- Dock is **de haven** — the basin where ships (projects) are built,
  berthed, and launched (*te water laten*).
- Logbook is **het peilhuis** — the gauge house: a bottom sheet of
  instruments.
- Focus is **de kolk vult** — the chamber filling in real time toward the
  estimate line; gates open when you reach it.
- Missed work is **drijfwerk** (driftage). Preview mode is **oefenwater**.
  Weekly review is **weekschouw**. Close day is **nachtsluiting**.

## Structural departures (no existing theme does these)

1. **Navigation is a fixed bottom dock bar ("de wal")** with the peil
   (level) gauge embedded. No top mast, no left rail (Drydock, Nightwatch
   and Loft all use top/left chrome).
2. **A global Waterline**: a 3px progress edge at the very top of the app,
   fill = today XP ÷ XP of today's full lineup. New chrome, zero new state.
3. **Bottom-sheet overlays**: Logbook and command palette rise from the
   bottom edge (matching the wal). Nobody used bottom sheets.
4. **Task form is a right drawer** ("the inscription desk") — nobody used
   a drawer for the form.
5. **Plan is a selection-based canal profile**: a stepped pounds strip +
   ONE detail tray for the selected day (all other themes render every
   day as a full column/rail simultaneously).
6. **Today = a chamber cross-section** with floating vessel silhouettes at
   the live waterline (the one animated canvas).
7. **Dock = a top-down harbor basin map** with projects as moored vessels
   at seeded positions + a register table (others: grids/lists only).
8. **Focus = a real-time filling chamber**; the gates open when elapsed ≥
   estimate. Data-driven repaint on the 250 ms tick (no rAF loop).
9. **Light "concrete & water" visual system**: soft radii, soft shadows,
   off-white grounds, one deep-teal water accent — a clean modern break
   from the dark 1-bit dither language of the other three themes.
10. **Microinteraction set** (all CSS/transition-driven, reduced-motion
    safe): bobbing vessels, *schut* ripple rings on completion, rows
    sinking when done, gates parting on day-cleared/level-up, dashed wake
    streaks while dragging, sail-in entrance for freshly captured rows,
    buoy toast bobbing above the wal, tide-switch sliding pill.

## Copy table (flavor on labels, capabilities unchanged)

| capability | sluis label |
|---|---|
| Complete | **Schut door** (button: "Schut") · reopen: "Terug in de kolk" |
| Delete | "Uit de vaart" |
| Undo | "Vaar terug" |
| Capture placeholder | "Meld een vaartuig aan… (!urgent #tag @schip 2h fri)" |
| Capture modes | Vaartuig (task) / Lading (steps) / Schip (project) |
| Views | Kolk (today) · Kanaal (plan) · Haven (dock) · Peilhuis (logbook) |
| Energy | Eb / Getij / Vloed |
| Morning brief | "Sluisbericht" |
| Adrift | "Drijfwerk" |
| Day cleared | "Kolk leeg — de deuren gaan open" |
| Close day | "Nachtsluiting" |
| Weekly review | "Weekschouw" |
| Preview mode | "Oefenwater" |
| Promote to project | "Bouw om tot schip" |
| Launch | "Te water laten" · ship log: "Vaartregister" |
| Ready to launch | "Klaar voor tewaterlating" |
| Empty yard | "stil water — geen vaartuig aangemeld" |
| Theme picker section | "Wissel van werf" |

Level names, trophy titles, difficulty names, PRIORITIES, and keyboard
hints are app identity — render core values verbatim, never rename.

## Token vocabulary (tokens.css — names are law, values are Sluis's)

Grounds: `--ground #e8edec` · `--rail #dde4e2` · `--plate #ffffff` ·
`--plate-hi #f6f9f8` · `--well #edf2f0` · `--ink #10222b`
Lines: `--line rgba(16,34,43,.10)` · `--line-strong rgba(16,34,43,.22)`
Text: `--fg #10222b` · `--fg-dim #4b626d` · `--fg-faint #8ba1ab`
Water: `--water #0b7d9e` · `--water-bright #21b3d4` · `--water-deep #095b70`
· `--water-ground #d9edf2`
Signal: `--amber #f0a13e` · `--amber-hot #d97f0e` · `--amber-deep #9a5c0b`
· `--amber-ground #fbecd6`
Lamps: `--port #d9564a` · `--starboard #2fa36b` · `--channel #3b82c4` ·
`--warn #e5b23f` (+ `-ground` tints)
Type: `--t-display` Bricolage Grotesque · `--t-body` Inter · `--t-mono`
JetBrains Mono
Motion: `--fast 140ms` · `--med 260ms`
Radii: `--r-sm 8px` · `--r-md 12px` · `--r-lg 18px`
Shadows: `--sh-1`, `--sh-2` (soft, low, cool)

## Class vocabulary (prefix `s-`)

Shell: `.s-shell` · `.s-waterline` (+`--fill`) · `.s-stage` · `.s-wal` ·
`.s-wal-nav` · `.s-wal-slot`(+`--active`) · `.s-wal-peil` · `.s-peil-staff`
(+`-fill`) · `.s-brand`
Type: `.s-display` · `.s-num` · `.s-stencil` (mono micro label) ·
`.s-stencil-row`
Controls: `.s-btn`(`--water` default, `--ghost`, `--amber`, `--sm`) ·
`.s-icon-btn` · `.s-kbd` · `.s-chip`(`--pick`,`--on`) · `.s-tide`
(+`-pill`) · `.s-field` (input/textarea/select) · `.s-switch`
Feedback: `.s-lamp`(`--ok/--busy/--off/--unknown`) · `.s-buoy` (toast) ·
`.s-ripple` · `.s-meter`(+`-fill`) · `.s-splash` (confetti particle)
Rows: `.s-vessel`(+`--cursor`,`--done`,`--sinking`,`--adrift`) ·
`.s-vessel-hull` (complete button) · `.s-vessel-wake` · `.s-vessel-body` ·
`.s-vessel-actions` · `.s-vessel-expand`
Chamber: `.s-kolk` · `.s-kolk-canvas` · `.s-kolk-hud`(+`-cell`) ·
`.s-gate`(`--l/--r`,`--open`)
Overlays: `.s-backdrop` · `.s-sheet` (bottom sheet: `s-sheet--wide`) ·
`.s-sheet-grip` · `.s-drawer` (right drawer form) · `.s-console`
(centered dialog: review, endofday, launch note)
Today: `.s-now` (NOW spotlight plate) · `.s-brief` · `.s-drift` (adrift
rows) · `.s-rail-card`
Plan: `.s-canal` · `.s-pound`(`--today`,`--locked`,`--sel`,`--over`,
`--off`) (+`-water`,`-gate`,`-label`,`-cap`) · `.s-tray` · `.s-chunk`
Dock: `.s-basin` · `.s-basin-ship`(`--sel`) · `.s-berth` · `.s-register`
· `.s-reg-row`
Peilhuis/logbook: `.s-gaugewall` · `.s-gauge-tile` · `.s-trophy`(`--earned`)
Focus: `.s-tunnel` · `.s-tunnel-kolk` · `.s-tunnel-timer`

## Component API (components.jsx — the only shared import besides core)

```js
export { IS_MAC, MOD };
Icon({ name, size })           // NW set + "gate","wave","droplet","up","down","drag","send"
Kbd({ children })
Lamp({ status, detail })       // AI lamp, honest tooltip
Confetti({ onDone })           // splash: water droplets + amber chips
Meter({ pct, tone, height })
Chip({ children, tone }) / ChipPick({ active, color, onClick, title })
CompleteButton({ done, onComplete, onReopen, size, label }) // .s-vessel-hull
GateLeaf({ side, open })       // one animated gate leaf (SVG)
GateMark({ open, size })       // small two-leaf glyph for wal/level-up
PeilStaff({ pct, height })     // vertical gauge staff (wal + logbook)
Waterline({ pct })             // global top edge bar
TideSwitch({ value, onChange })// Eb/Getij/Vloed sliding pill
Eyebrow({ children, right, lit })
EmptyState({ children, caption })
WakeFoot({ caption })          // decorative water foot (cached tex)
KolkCanvas({ fillPct, vessels, tone, height, animate }) // THE canvas
  // vessels: [{x (0..1), w(px), done}] — hull silhouettes at waterline
  // animate=true: stepped ~9fps ripple, sync first paint, pauses on
  // document.hidden and REDUCED_MOTION. animate=false: paint on prop change.
```

## Shell composition (app.jsx)

- `<div class="s-shell">` — column flex, min-height 100vh.
- `<Waterline pct={todayXP / lineupTotalXP}>` fixed top edge.
- `<main class="s-stage">` — the active view (max-width 1180, centered,
  bottom padding for the wal). Preview + cross-tab banners sit sticky at
  the top of the stage (amber / warn strips with Exit / Reload+Dismiss).
- `<nav class="s-wal">` fixed bottom: brand mark (gate glyph) · three
  view slots (Kolk/Kanaal/Haven, icons + `1/2/3` key chips) · peil
  cluster (PeilStaff + level number + title + XP-to-next + streak flame)
  · Peilhuis slot (`4`) · help `?` and palette `⌘K` kbd buttons · AI
  lamp. Nav clicks `setUI({ view, cursor: null, statsOpen: false })`.
- Overlays (all rendered from App): TaskFormDrawer, PeilhuisSheet,
  ReviewOverlay, Palette, EndOfDayDialog, FocusTunnel, help sheet,
  buoy toast (with Undo → `runUndo(toast.undoId)`), splash confetti
  (local `shown` counter vs `ui.confetti`), level-up gate-burst banner.
- The wal collapses to icons ≤900px; stage side-padding shrinks ≤640px.

## Per-view composition & wiring

Every view lifts its LOGIC from the Nightwatch counterpart (paths below)
— handlers, memos, effects, guards — and recomposes presentation per
this spec. Traps (from the parity walkthrough) apply everywhere:
`registerActiveList` re-registered on every list change; Today registers
adrift rows first then lineup (`globalIdx = missed.length + i`);
`chunkDate` = today iso for lineup chunks, own date for adrift;
`setCaptureFocus` mounted/unmounted by every capture input; never wrap
`setCompletion` in another toast; no theme-local key listeners except
inside self-contained overlays.

### views/today.jsx ← lift logic from nightwatch/views/today.jsx

Composition (top→bottom):
1. **Greeting row**: time-of-day greeting + date + yard counts
   (pending · lined up · ready to launch). Sluisbericht toggle chip.
2. **De Kolk** (signature): `KolkCanvas` height ~150, `fillPct` =
   todayXP ÷ max(1, lineupTotalXP), `vessels` = pending lineup rows
   (x seeded from task id hash, w from hours), `animate`. Gates
   absolutely overlaid left/right, `--open` when day cleared. HUD grid
   below: PEIL (today XP, ±trend spark data), STROOM (7v7 trend arrow),
   VAART (streak + week dots), DRIJFWERK (adrift count), FOCUS (focus
   hours today — from sessions, NW's bridge gauge derivation).
3. **Sluisbericht** (brief card): facts always; prose when AI; Retry
   when off; collapse persisted via patchBrief dismissed (`b`);
   regenerate clears attempted+text; apply run order button. Copy the
   two generation useEffects verbatim.
4. **Nu aan de kolk** (NOW spotlight): first pending lineup row —
   project, chunk note, estimate, focus-so-far, Schut + Focus buttons;
   next-up row beneath; day-cleared state with gates-open plate +
   Nachtsluiting action.
5. **Drijfwerk** (adrift triage): rows with days-adrift, Today / Done /
   Dismiss buttons.
6. **Lineup**: vessel rows (taskrow.jsx) — bob animation (staggered
   `--bob-delay`), drag reorder + `[ ]`, energy TideSwitch, expand with
   desc/notes/subtasks/chunk editor. Sail-in entrance for new rows.
7. **Side/aux column** (collapses ≤1080px): ready-to-launch list, next
   planned day preview, screen-signal log (+1/−1 X/YT, mobile hours,
   link to peilhuis), review-due nudge, day-closed banner + Reopen,
   Close-day link once something done, both empty states (truly-empty →
   `enterPreview`; nothing-lined-up → next planned day + jump to Kanaal).
8. Capture bar (capture.jsx, `scheduleToday`) pinned directly under the
   Kolk — "meld een vaartuig aan".

### views/plan.jsx ← lift logic from nightwatch/views/plan.jsx

Composition:
1. Header: pending count · total est hours · unscheduled count ·
   recurring reserve. Week capacity editor strip (0–10 inputs,
   Enter/blur commit, today amber) — the "sluisschalen" row.
2. **Het Kanaal** (signature): horizontal strip of ~10 visible pounds
   (scrollable), from effective today, skipping cap-0 empty days except
   today (same agenda rule); "+4 weken" extends. Each `.s-pound`:
   water fill height = load ÷ capacity (load = scheduled + recurring
   reserve: daily = full hours, weekly = hours/5), OVER → fill 100% +
   `--over` red rim; gate leaf between pounds, closed when day locked;
   today = amber rim; click selects (`.s-pound--sel`). Locked drop onto
   a pound → core toast already; blocked drop shows the same honest
   toast. Drag chunk cards from the tray onto a pound (`moveChunkDate`).
3. **De bak** (detail tray): the selected day's full functionality —
   date heading, load meter, lock toggle, capacity inline edit, chunk
   cards (complete light, click-to-edit, split badge i/n, note, hours,
   unschedule undoable, drag out to pounds), empty copy
   ("rustig water" / "RUST — de sluis is dicht").
4. AI row: "Sluismeester" — Schedule N pending (append/fresh),
   instruction panel (⌘/Ctrl+Enter), Rebuild (undoable), Replan console
   with examples, busy states + honest failure/empty toasts. Lift the
   whole block verbatim, restyle as `.s-console`-ish inline panel.
5. Drijfwerk notice with jump to Kolk triage.

### views/dock.jsx ← lift logic from nightwatch/views/dock.jsx

Composition: two tabs (`.s-chip--pick`) — **Schepen** (projects) /
**Register** (library) — plus capture bar (no scheduleToday).
- Schepen: **De Haven** basin (signature): an SVG/canvas top-down basin —
  quay edges, each un-launched project a moored vessel: position seeded
  by project id (hash → x/y lanes), hull length by child count, a
  progress arc at the bow = progressOfProject pct, ready = amber glow +
  "KLAAR VOOR T Water" stamp. Click selects → the berth panel below
  (`.s-berth`): type filter chips, create row (name+type, Enter),
  expanded project: editable desc, child ledger (complete/edit/XP/
  detach), add-child input (stays open), AI add-tasks, 10 color
  swatches, inline rename, delete (undoable), Launch at 100% →
  shipProject + launch-note dialog (AI draft, deterministic prefill,
  Log it / Skip). **Vaartregister** (ship log): launched entries expand
  (frozen stats + note), Write/Edit entry, Unlaunch.
- Register: status filters, sorts (pending only), search, project
  dropdown, used-tag chips, screenshot import (file → AI → preview with
  per-item toggles + optional group-as-project → import N), full vessel
  rows with cursor + `registerActiveList("library", …)`, one-click
  **Aanleggen** (berth) picker on unassigned rows
  (`updateTask(id, {projectId, projectIdChanged: true})`).

### views/logbook.jsx (Peilhuis) ← nightwatch/views/logbook.jsx

**Bottom sheet** (`s-sheet s-sheet--wide`, rises from the wal, ~82vh,
scrollable). Gauge wall: level statement (staff gauge, level, title,
lifetime XP, xp-to-next, NEXT RANK line from LEVEL_NAMES/THRESHOLDS),
streak/completed/launched tiles, 30-day averages (XP/day, focus/day,
slate-cleared %, adrift rate), weekschouw entry + reviews list with
Open, calibration (overall + per-difficulty, honest <3 state), screen
weather (14-day X+YT combined + mobile bars + 7-day totals), all 16
trophies with derived progress, day-rollover presets (0/22/4) + free
0–23 input, data tools (export, import merge/replace confirms, preview
enter/exit, backup line, migration line), theme picker ("Wissel van
werf", THEMES from ../registry.js, useThemeId/setThemeId).

### taskform.jsx (the inscription desk) ← nightwatch/taskform.jsx

**Right drawer** (`.s-drawer`, ~460px, slides in, backdrop). Lift the
entire LOGIC verbatim (score-follows-difficulty until XP touched;
commit pending subtask/tag text on submit; *Changed flags; split-task
estimate lock; promote-to-project with pending steps; ⌘/Ctrl+Enter
submit; title Enter submits; Esc cancels). Fields: title, desc, notes,
priority chips, repeats Once/Daily/Weekly, difficulty chips, hours+XP,
schedule date (Today/Tomorrow/Clear; hidden for recurring/split),
deadline + Clear, project select, tags (built-in+custom+new), subtasks.
"Bouw om tot schip" promote block when eligible.

### capture.jsx ← nightwatch/capture.jsx

A floating "lock entrance" bar: the input is the channel mouth —
`.s-capture` rounded pill with a gate glyph, inline mode toggles
(Vaartuig/Lading/Schip as `.s-chip--pick`), grammar chip preview strip,
real `N` hint, full-form button (`.s-icon-btn` "plus"). The sacred
sequence on Enter:
```js
const task = captureTask(v, { mode, scheduleToday, parsed });
if (task) enrichCapturedTask(task.id, grammarActive ? parsed.title : v,
  mode, { grammarUsed: grammarActive, hasHours: !!parsed?.hours });
```
Project mode → `captureProject(v)`. Steps mode → AI subtasks. Escape
clears+blurs. `setCaptureFocus` on mount / null on unmount.

### taskrow.jsx ← nightwatch/taskrow.jsx

`.s-vessel`: rounded white card, hull button (CompleteButton) at left,
index numeral, title, meta chips (project color dot, priority dot,
difficulty pips, hours, split badge i/n, +XP right), actions on hover
(focus/edit/delete), cursor ring (`.s-vessel--cursor`), bob animation
(var `--bob-delay`), expand well (desc, notes, subtasks toggle, chunk
editor). Microinteractions: on complete → `.s-vessel--sinking` for ~450
ms (fire `.s-ripple` rings) then `.s-vessel--done` (sunk: translateY
3px, opacity .5, title struck); reopen reverses. Dragging →
`.s-vessel-wake` dashed trail visible. Adrift variant
`.s-vessel--adrift` (amber rim).

### views/palette.jsx ← nightwatch/views/palette.jsx

**Bottom sheet** ("Sein"): prompt "Geef een sein…" input, `buildCommands()`
fuzzy list with key hints, task search → editor, `> ` quick-add branch
(parseQuickAdd chips inline, capture+enrich sequence, schedules when a
date token present), cursor-row commands, arrow nav + hover sync, Enter
runs, keepOpen stays, hint row seeds `"> "`.

### views/focus.jsx ← nightwatch/views/focus.jsx

**De Kolk vult**: full-screen tunnel. Timer logic VERBATIM (elapsed
seeds from today focusMs, 250 ms tick, persist every 5 s + on
pause/unmount, session delta ≥60 s logged once on unmount, Space
toggles, input-tag guard, Esc exits, Reset). Visual: a large KolkCanvas
(`animate:false`, repaint on tick), fillPct = elapsed ÷ max(estimate,
elapsed-floor), gates open when estimate && elapsed ≥ estimate
("klaar om door te schutten"). Header: task title, project, difficulty,
estimate. Controls: pause/resume, reset, skip (advances, up-next
preview), Schut door (chunk-aware complete + auto-advance, closes when
none left). Up-next plate.

### views/endofday.jsx ← nightwatch/views/endofday.jsx

**Nachtsluiting** console: recap (completed list + XP), unfinished with
"sleep naar de eerstvolgende vaardag" roll-forward toggle, mobile-hours
capture if not logged, Close → closeDay({rollForward}) → banner +
Reopen on Kolk. Sign-off line: "DE DEUREN ZIJN DICHT."

### views/review.jsx ← nightwatch/views/review.jsx

**Weekschouw** console: week banner, tiles (done/XP/focus/launches),
seven-pound mini cross-section (per-day activity, best day marked),
accuracy, adrift-now, launched list, effort split by project, cached AI
retro (Rewrite, honest AI-off + Retry), older/newer browsing across
reviewableWeeks, empty-week state with jump to older.

## Verification gate (after build)

`npm test` (25) · `npm run build` clean · greps: no `localStorage` in
theme, `requestAnimationFrame` only in KolkCanvas + chart entrances,
`toDataURL` only in texture.js · keyboard sweep `1 2 3 4 ? ⌘K Esc j/k x
u [ ] e f t Del n Shift+N b b w` · capture grammar chips · project
lifecycle · plan lock/drop toast · preview enter/exit byte-identical ·
theme soak ×3, exactly one `<style>` mounted.
