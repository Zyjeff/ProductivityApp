# APOGEE — design spec (single source of truth for all build agents)

Werf theme. Fiction: **the ground-segment CRT console of a one-person orbital
launch complex.** You are ground control for your own work. Digital, modern,
experimental. Reference DNA: ORBITAL SYSTEMS poster (pure-black CRT dot-matrix
red/white, scanlines, registration marks, edge status strips), BYNARIO
(terminal scan cards, spaced mono microlabels, huge grotesk on near-black),
"From Complexity To Clarity" poster (dithered halftone red→white→cyan→blue
ramp), OFF/GRID (celebration magenta — confetti/level-up ONLY).

Registry: `{ id: "apogee", name: "Apogee", tagline: "Ground control — the pad
never sleeps.", App, css }`.

## 0. Hard rules (from the werf-theme skill — non-negotiable)

- NEVER edit `src/core/` or other themes. Theme files live in
  `src/themes/apogee/` only (+ one import & array entry in
  `src/themes/registry.js`).
- No new npm dependencies. react + react-dom only. Canvas/SVG/CSS hand-rolled.
- No `localStorage` access in theme code (grep must return zero). No XP
  arithmetic beyond display. Derive, never store.
- Display real key bindings from `core/keys.js` (`SHORTCUT_ROWS`, `MOD`);
  never rebind. `N` focuses capture, `Shift+N` full form, `U` undo, etc.
- Every `ui` flag gets a rendered surface (see §6) or keys silently die.
- Read `.claude/skills/werf-theme/references/core-contract.md` before wiring
  anything; `references/parity-walkthrough.md` for the per-view traps.
- Class prefix: **`ap-`** on every class. Keep the token NAMES from the other
  themes (`--ground/--rail/--plate/--plate-hi/--well/--ink`, `--fg/--fg-dim/
  --fg-faint`, `--amber(+hot/deep/ground)`, `--port`, `--starboard`,
  `--channel`, `--warn` + `-ground` tints, `--t-display/--t-body/--t-mono`,
  `--fast/--med`) — values are ours, names are shared vocabulary.

## 1. Visual identity

Tokens (`:root` of tokens.css):

```
--ground:#050607  --rail:#0a0d10  --plate:#0d1114  --plate-hi:#12171c
--well:#030405    --ink:#000000
--line:rgba(255,255,255,.08)  --line-strong:rgba(255,255,255,.18)
--fg:#e8ecee  --fg-dim:#8b969c  --fg-faint:#525c62
--signal:#ff2b1a      /* brand phosphor red — the theme's voice */
--signal-hot:#ff5c3d  --signal-ground:rgba(255,43,26,.12)
--amber:#ffb000 --amber-hot:#ffc63d --amber-deep:#b87d00
--amber-ground:rgba(255,176,0,.12)
--port:#ff5470      --port-ground:rgba(255,84,112,.14)   /* negative */
--starboard:#33ff99 --starboard-ground:rgba(51,255,153,.12) /* ok */
--channel:#4fd8eb   --channel-ground:rgba(79,216,235,.12)   /* info */
--warn:#ffb000      --warn-ground:rgba(255,176,0,.12)
--flare:#ff2e9a     /* celebration magenta: confetti + level-up ONLY */
--t-display:'Doto',sans-serif        /* dot-matrix: readouts, countdown, headers */
--t-body:'Space Grotesk',sans-serif  /* UI body */
--t-mono:'IBM Plex Mono',monospace   /* labels, data, terminal */
--fast:120ms  --med:240ms
```

Font import (FIRST line of tokens.css):
`@import url('https://fonts.googleapis.com/css2?family=Doto:wght@400..900&family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');`

- **Sharp 0px corners everywhere.** No glass, no blur, no border-radius, no
  soft shadows. Flat black panels, 1px hairlines, bracket-corner registration
  marks (CSS ::before/::after on `.ap-panel--reg`).
- Phosphor glow = static `text-shadow: 0 0 8px var(--signal-ground)` on Doto
  readouts only. Scanline overlay = static repeating-linear-gradient ≤4%
  opacity on chrome/hero surfaces only — NEVER under body copy.
- The ramp red→white→cyan→blue appears only as dithered texture fills
  (countdown board fade, burn plume, celebration moments).
- Legibility law: one statement per view; body on plates ≥7:1; 10px mono
  microlabels ≥3:1; every state color carries a label/icon too.
- Reduced motion: global kill-switch in tokens.css + every canvas checks it.
- Breakpoints: ≤1080px aux/mission columns stack; ≤900px the frame collapses
  (top edge stays as a compact strip, right-edge nav becomes a compact icon
  row inside the top strip; left/bottom edges hide).

## 2. THE STRUCTURAL IDIOM — the CRT frame + screens, no floating modals

**The shell is a framed CRT.** A 1px hairline frame inset ~10px from the
viewport, with corner registration brackets, and DATA EMBEDDED IN THE FRAME:

- **Top edge**: mono microtype cells interrupting the hairline —
  `WERF/APOGEE` wordmark · UTC clock `HH:MM:SS` (20s tick is fine, no seconds
  then: `HH:MM`) · `MET +hh:mm` (time since effective day start, dayStartHour-
  aware) · `ALT <km> km` + level title + lifetime XP (+ XP-to-next on title
  attr) · `L-STREAK <n>D` when streak>0 · `COMMS` AI lamp (unknown/ok/busy/off
  + honest detail tooltip; label text, not color alone).
- **Right edge**: the channel selector — vertical, rotated (writing-mode:
  vertical-rl) buttons `01 PAD · 02 TRAJECTORY · 03 HANGAR · 04 FLIGHT LOG`
  with key digits; active channel = solid `--signal` block with black text.
  Clicking sets view (and `cursor:null`); `04` toggles `statsOpen`.
- **Left edge**: the MET fill — a hairline vertical fill showing progress of
  the waking day (now − day start) / 24h, with hour ticks. Quiet, decorative,
  derived from the real clock + `dayStartHour`.
- **Bottom edge**: status microtype (`THE PAD NEVER SLEEPS` ·
  `CLOSED-LOOP WORK REGULATION` · key hints `? HELP · ⌘K UPLINK`) and the
  **TELEMETRY cell** — the toast lives HERE as a frame cell: mono message,
  signed XP delta, `ABORT (U)` button wired to `runUndo(toast.undoId)` when
  undoable. Not a floating toast.

**Every overlay is a full-screen re-tune, never a floating modal.** Palette,
task form, focus tunnel, review, end-of-day, launch-note, help, logbook,
screenshot-import preview: each replaces the stage inside the frame (frame
stays; its cells stay live). Esc = "return to channel" (core cascade already
handles order). Confirms (delete/import) may use inline confirm rows, not
window.confirm popups — but `exportData`/`importDataFromFile` confirmation
semantics follow the existing themes (copy their flow).

Departures this claims (verified against all 6 installed themes): right-edge
rotated nav (others: left mast ×3, bottom dock, top strip, top bar); data-
bearing frame chrome; toast-in-frame; logbook as dense tile wall (§5.4);
full-screen form (others: centered ×4, right drawer, left sheet); terminal
palette with bottom prompt (others: centered ×3, bottom sheet, top rail);
zero floating modals; Plan as horizontal downrange board (others vertical /
cell-grid+tray); Dock stacked-segment bays + patch filmstrip (others arc /
rotary / inked sheets / HP cards / basin map / node mosaic); the one animated
canvas lives in the FOCUS tunnel, not Today (all other hero canvases are on
Today).

## 3. Fiction / copy table (labels are costume; capabilities and key hints are real)

| Surface | Copy |
|---|---|
| Views | PAD · TRAJECTORY · HANGAR · FLIGHT LOG |
| Capture bar | MANIFEST INTAKE; modes PAYLOAD / SEQUENCE / VEHICLE (real Task/Steps/Project semantics); placeholder "manifest a payload… (!urgent #tag @vehicle 2h fri)" |
| Add / delete / edit / focus | Manifest · Scrub · Service · Burn |
| Done state | NOMINAL stamp; complete button title "Confirm nominal" |
| Missed work | ORBITAL DECAY; actions Reboost (today) / Recovered (done) / Deorbit (dismiss) |
| NOW plate | ON THE PAD; next row IN QUEUE |
| Day cleared | LIFTOFF state + "Debrief & secure" |
| Close/reopen day | DEBRIEF & SECURE / RESUME MISSION |
| End of day screen | DEBRIEF — sign-off "MISSION COMPLETE — GROUND SECURED." |
| Weekly review | POST-FLIGHT REPORT |
| AI | GUIDANCE; off = "GUIDANCE OFFLINE — flying manual." + Retry |
| Undo | ABORT (with real U hint) |
| Preview mode | SIMULATION; banner "SIMULATION RUNNING — real telemetry snapshotted."; exit "End simulation" |
| Cross-tab | "Ground station conflict — another console wrote telemetry." Reload / Dismiss |
| Crash card | ANOMALY + stack + "Reset console" |
| Promote to project | Stack as vehicle |
| Project types/colors/levels/trophies/difficulty | REAL names from core constants, displayed as-is |
| Empty states | "PAD CLEAR — nothing manifested." / "static on the downlink" / truly-empty offers RUN SIMULATION (`enterPreview`) |

## 4. Signature visuals (one per view, all derived from real state)

1. **PAD — the countdown board.** Giant Doto readout `T-hh:mm`: sum of
   remaining estimated hours on today's pending lineup rows (chunk hours when
   split, `taskHours(t)` prorated else; rows without hours count 0 but show as
   `+n unest.` microline). All done & nonempty → `LIFTOFF` stamp (signal red,
   scanline sweep) + Debrief action. Empty slate → `T-00:00 · PAD CLEAR`.
   Updates on state change + 60s clock tick. NOT a rAF loop.
2. **TRAJECTORY — the downrange board.** Horizontal range ruler with tick
   marks + TODAY marker; day columns L→R.
3. **HANGAR — vehicle bays.** Vertical stacked-segment gauge per project
   (10–14 dither cells filling bottom-up = % complete) + seeded mission patch
   (`tex()` seeded by project id) + GO FOR LAUNCH stamp at 100%.
4. **FLIGHT LOG — the ALT statement.** Doto altitude readout: lifetime XP log-
   mapped across LEVEL_THRESHOLDS to 160–35,786 km (LEO→GEO), with the real
   level name/XP/to-next under it.
5. **BURN — the plume.** The theme's ONE animated canvas: low-res dithered
   engine plume under the MET timer, red→white→cyan ramp, ~9fps stepped,
   synchronous first frame, pauses on `document.hidden`, static under
   reduced-motion.
6. **UPLINK terminal** (palette): full-screen dim; prompt line anchored at the
   BOTTOM (`UPLINK> _` block caret), results list grows upward above it.

## 5. Screens (composition from scratch — do not copy other themes' outlines)

### 5.1 PAD (Today)
Two columns inside the stage: **left sticky MISSION column (~340px)** +
**right scrolling OPS ledger**. (Deliberate inversion: every other theme
rails right or stacks.)

- MISSION column (sticky): countdown board → ON THE PAD plate (first pending
  lineup row: title, vehicle/project, chunk note, estimate, focus-so-far,
  Complete + Burn buttons; IN QUEUE next row beneath; day-cleared LIFTOFF
  state here) → GO/NO-GO cell row (pending in yard / lined up / ready to
  launch, each a labeled cell) → instrument minis: today-XP 7d sparkline,
  streak week dots, done-today 14d + pending difficulty split, slate XP
  (done/total + XP left).
- OPS ledger (scroll): greeting line (time-of-day variants + all-done/empty)
  → MANIFEST INTAKE capture bar → day-closed banner + RESUME MISSION when
  closed; review-due nudge (Mon/Tue, dismissible per week) → MISSION BRIEF
  (deterministic facts ALWAYS: yesterday count/XP/focus, decay count, load vs
  capacity with overload/day-off, deadlines ≤3d; GUIDANCE prose when on;
  honest off-line + Retry; collapse persisted via `patchBrief(iso,
  {dismissed})`, `b` key; Regenerate = clear attempted+text; **Apply
  suggested run order**) → ORBITAL DECAY hazard band (rows from
  `getMissedWork`: days-adrift, project, hours; Reboost/Recovered/Deorbit)
  → LAUNCH SEQUENCE (lineup ledger: Doto sequence numerals, per-row +XP,
  complete/reopen, expand well with desc/notes/subtasks/ChunksEditor, Burn,
  Service, Scrub; drag reorder AND `[ ]` both through `setLineupOrder`;
  energy throttle Easy/Auto/Hard) → aux strip: ready-to-launch vehicles →
  jump to HANGAR; next window preview (next planned day + chunk notes) →
  jump to TRAJECTORY; DOWNLINK USAGE (X opens / YT opens +1/−1, mobile
  hours log/clear, link to 7-day history in FLIGHT LOG); empty states per §3.

Keyboard: `registerActiveList("today", kbRows)` where kbRows = decay rows
first (own iso as chunkDate) then lineup rows (today iso for chunks);
highlight uses `globalIdx` with `missed.length` offset. Re-register on every
memoized list change. Hover sets cursor.

### 5.2 TRAJECTORY (Plan)
- Header row: pending count · est hours · unscheduled · recurring reserve
  (daily=h/day, weekly=h/5 — copy the formula) · adrift notice → PAD triage.
- **THROTTLE row**: 7 weekday capacity cells (0–10, 0=off; inline edit,
  Enter/blur commit; today highlighted; load meter per cell).
- **The downrange board**: horizontally scrolling day columns from
  `effectiveTodayIso` (28 days, `+4 WEEKS` appends; cap-0 empty days
  skipped except today) under the range ruler. Each column: date + weekday,
  fuel bar (scheduled+recurring vs capacity, OVERLOADED flag), HOLD stamp
  toggle (`toggleDayLock`; AI never touches held days; drops onto held
  columns blocked + toast), chunk cards (complete/reopen, click-to-edit,
  split badge i/n, project color tick, note, hours, unschedule via
  `dismissChunk` — undoable), drag card column→column via `moveChunkDate`.
  Column drag-over highlight; wheel scrolls horizontally; snap per column.
- **GUIDANCE console** (below board): Schedule N pending (append/fresh),
  instruction uplink textarea (⌘/Ctrl+Enter), RECOMPUTE TRAJECTORY (rebuild,
  undoable via labeled `applyPlan`), replan command line (natural language →
  ops; `{empty:true}` → honest "GUIDANCE could not map that." + examples),
  busy lamp states, failures via `aiFailureMessage` toast. Copy failure
  handling shape from an existing theme's plan view verbatim.

### 5.3 HANGAR (Dock)
- Tabs BAYS / STORES (persist in `dockFilter.tab`).
- BAYS: type filter chips (All + PROJECT_TYPES); NEW BAY create (name+type,
  Enter/Esc); grid of vehicle bays (§4.3): patch, title, type, task counts,
  stacked-segment gauge, GO FOR LAUNCH stamp + LAUNCH at 100% (≥1 task).
  Expanded bay: editable description (blur/⌘Enter, Esc), child ledger
  (complete/reopen, click-to-edit, XP, detach), add-child input that stays
  open, GUIDANCE add-tasks (⌘Enter), 10 color swatches, inline rename,
  Scrub bay (cascades, undoable). Launch → `shipProject` → **LAUNCH NOTE
  screen** (AI draft, deterministic prefill fallback, editable, Log it /
  Skip). D10 ready prompt comes from core.
- **PAST MISSIONS filmstrip**: horizontal band of launched vehicles as
  mission patches + dates; expand → frozen launchStats (tasks, XP, est vs
  focused, span days) + note + Write/Edit entry + UNLAUNCH.
- STORES: terminal query row (status pending/recurring/done/all · sort
  (pending only) · text search · vehicle dropdown · used-tag chips);
  full task rows with cursor (`registerActiveList("library", …)`), expand +
  chunk editor; ASSIGN BAY one-click on unassigned rows (updateTask with
  projectIdChanged); **screenshot import**: file pick → busy →
  `aiImportFromScreenshot` → full-screen preview (per-item include toggles,
  group-as-vehicle + name, IMPORT N, deterministic scores fallback).

### 5.4 FLIGHT LOG (Logbook, `statsOpen`) — GROUND STATION tile wall
Full-screen re-tune: a dense grid of labeled tiles, everything visible, no
section rail. Tiles: ALT statement (§4.4) + level meter · L-STREAK /
COMPLETED / LAUNCHED counts · POST-FLIGHT REPORTS (open review; list weeks) ·
GUIDANCE CALIBRATION (60d overall + per-difficulty factors with n, focused
total, honest "<3 tasks — not enough telemetry") · MISSION PATCHES (all 16
trophies, real names, unlock state + derived progress meters) · DOWNLINK
WEATHER (7-day X/YT stacked bars + mobile-hours bars + averages) · MISSION
DAY EPOCH (presets Standard 0 / Late 22 / Overnight 4 + free 0–23 input,
affects everything live) · TELEMETRY VAULT (Export JSON · Import merge/
replace with confirms · RUN/END SIMULATION · auto-backup status via
`listBackups()` · migration provenance) · CONSOLE SKIN (theme picker:
`THEMES` map, `useThemeId`/`setThemeId`, current marked).

### 5.5 BURN (focus tunnel)
Full-screen: task title + vehicle + difficulty + estimate; giant Doto MET
timer (elapsed = today's focusMs + run; tick 250ms; persist every 5s AND on
pause/unmount; `logSession` delta ≥1min on exit); controls HOLD/RESUME
(Space), RESET, SKIP → next pending (up-next previewed), CONFIRM NOMINAL
(chunk-aware complete + auto-advance; closes when none left), EXIT (Esc).
Local key listener with input-tag guard copied from an existing theme.
Plume canvas at the foot (§4.5).

### 5.6 UPLINK (palette)
Full-screen dim (still inside frame); results list grows UPWARD above the
bottom prompt; `buildCommands()` inside the memo (live cursor-row commands),
task-title search (open in editor), `> text` quick add: `parseQuickAdd` chips
inline + the sacred capture→`enrichCapturedTask` sequence + schedules when
date token present; arrow nav (list is bottom-up: ArrowUp moves away from
prompt), hover sync, Enter runs, `keepOpen` respected; hint row seeds `"> "`.

### 5.7 DEBRIEF (end of day)
Full-screen: recap (completed list + XP earned) · unfinished list with "ROLL
TO NEXT WINDOW" toggle (first capacity day ≤21) · mobile-hours capture when
unlogged · CLOSE → `closeDay({rollForward})`, toast reports rolled count ·
sign-off line. PAD shows closed banner + RESUME MISSION after.

### 5.8 POST-FLIGHT REPORT (weekly review)
Full-screen: signal-red week banner (`fmtWeekLabel`), older/newer across
`reviewableWeeks`; tiles (done, XP, focus, launches) · per-day dithered bars
+ best day · estimate accuracy · adrift-now · launched list · effort split by
vehicle (hours meters) · GUIDANCE retro (cached forever; Rewrite; honest off
+ Retry; stats always render) · empty-week state with jump older.

### 5.9 PAYLOAD SPEC (task form — create & edit)
Full-screen two-column checklist. LIFT THE LOGIC VERBATIM from
`src/themes/nightwatch/taskform.jsx` (state rules only, not its layout):
title (Enter submits) · desc · notes · priority (4) · repeats Once/Daily/
Weekly · difficulty (4) · hours + XP (deterministic score follows
difficulty/hours until XP touched → touched disables AI refinement; split
tasks lock estimate) · schedule date (+Today/Tomorrow/Clear; hidden for
recurring/split) · deadline (+Clear) · vehicle (project) · tags (built-in +
custom + new-tag input) · subtasks add/remove · uncommitted subtask/tag text
committed on submit · edit sets `scheduleDateChanged`/`projectIdChanged` ·
STACK AS VEHICLE promote (eligible when subtasks; jumps to HANGAR) ·
⌘/Ctrl+Enter submits anywhere; Esc cancels.

### 5.10 Capture bar (`capture.jsx`)
On PAD (scheduleToday) and HANGAR STORES-adjacent position (no schedule).
Inline mode chips PAYLOAD/SEQUENCE/VEHICLE (session-persisted via
`ui.captureMode`), block caret aesthetic, live `parseQuickAdd` chip echo
(task mode), real `N` hint, full-form button. The sacred sequence:
`captureTask` → `enrichCapturedTask(task.id, grammarActive ? parsed.title :
raw, mode, {grammarUsed, hasHours})`; VEHICLE mode → `captureProject(v)`.
Register `setCaptureFocus(() => input.focus())` with cleanup.

## 6. ui-flag → surface checklist (App must render ALL)

view/today·plan·dock → PAD/TRAJECTORY/HANGAR · statsOpen → GROUND STATION ·
paletteOpen → UPLINK · helpOpen → STANDING ORDERS screen (SHORTCUT_ROWS +
MOD) · formOpen+editingTaskId → PAYLOAD SPEC · focusTaskId → BURN ·
reviewWeek → POST-FLIGHT · endOfDayOpen → DEBRIEF · launchNoteFor → LAUNCH
NOTE · toast → TELEMETRY frame cell (+ABORT) · confetti → burst (local
shown-counter pattern; magenta/red/cyan particles) · levelUp → RANK UP
statement (auto-clears) · previewMode → SIMULATION banner + End simulation ·
externalChange → conflict banner Reload/Dismiss · aiStatus/aiDetail → COMMS
lamp · cursor → row highlight + Esc clears · energy → throttle toggle ·
captureMode → intake chips · dockFilter → HANGAR tabs/filters · error
boundary → ANOMALY card.

## 7. File map (all under src/themes/apogee/)

```
index.js       { id, name, tagline, App, css } (css from ./tokens.css?inline)
tokens.css     the whole system (~800 lines): tokens, frame, panels, ledger,
               wells, meters, stamps, terminal, board, bays, tiles, screens,
               focus-visible, reduced-motion, scrollbars, breakpoints
texture.js     engine copy (from nightwatch) + apogee recipes: rampTex
               (red→white→cyan fs dither), edgeTex, patchTex(seed) mission
               patches, boardFade, segFill
components.jsx Icon set, Kbd, Lamp(COMMS), Stamp, Cell, Meter, Confetti,
               DotNumeral (Doto readout wrapper), RegPanel, EmptyState
charts.jsx     Spark (canvas, paint-on-data-change), SegColumn (stacked-
               segment gauge), WeekDots, StackBars, HourBars — dumb props
chrome.jsx     TheFrame (4 edges: telemetry cells, channel nav, MET fill,
               status+TELEMETRY cell), RankUp, banners
capture.jsx    MANIFEST INTAKE
taskrow.jsx    sequence ledger row + expand well + ChunksEditor
taskform.jsx   PAYLOAD SPEC screen
app.jsx        shell: frame + stage + every §6 surface + ErrorBoundary
views/today.jsx plan.jsx dock.jsx logbook.jsx palette.jsx focus.jsx
      endofday.jsx review.jsx
```

## 8. Performance & verification budgets

- `tex()` cached by options key; never per frame. rAF grep must list ONLY the
  plume canvas (+ chart entrance if used — prefer none). `toDataURL` only in
  texture.js.
- Charts paint synchronously on data change (effect body), keyed on
  `JSON.stringify(data)`.
- Selectors: raw slices via `useStore`, arrays derived in `useMemo` (no
  `.map()` in selectors).
- Countdown/clock cells tick via one 20–60s interval in chrome, not rAF.
- `npm test` (25) and `npm run build` must pass. Verification drives per
  `.claude/skills/werf-theme/references/parity-walkthrough.md` §8.
