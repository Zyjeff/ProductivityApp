# YOIZAKURA (宵桜) — design spec (single source of truth for all build agents)

Werf theme. Fiction: **a Japanese house at dusk, its veranda (engawa) open to a
blossom garden.** This is a PERSONAL theme built for a real user replacing
TickTick: their life runs on lists (Shopping, Chores, Home Upgrades…), tags,
and quick access to task descriptions. The register is quiet domestic order:
paper, wood, ink, lantern light, and a sakura tree that grows with real work.

Reference DNA: evening cherry blossoms over lantern-lit tracks (dusk indigo +
warm gold + blossom pink), Spirit Blossom palette (violet night + spirit teal),
washi paper, kumiko lattice, hanko seals, tansu chests.

Registry: `{ id: "yoizakura", name: "Yoizakura", tagline: "Evening blossoms —
the house in order, the garden in bloom.", App, css }`.

## 0. Hard rules (from the werf-theme skill — non-negotiable)

- NEVER edit `src/core/` or any other theme. Theme files live in
  `src/themes/yoizakura/` only (+ one import & one array entry in
  `src/themes/registry.js`).
- No new npm dependencies. react + react-dom only. Canvas/SVG/CSS hand-rolled.
- No `localStorage` access in theme code (grep must return zero). No XP
  arithmetic beyond display. Derive, never store.
- Display real key bindings from `core/keys.js` (`SHORTCUT_ROWS`, `MOD`);
  never rebind. `N` focuses capture, `Shift+N` full form, `U` undo, `1/2/3/4`
  views/records.
- Every `ui` flag gets a rendered surface (§7) or keys silently die.
- Read `.claude/skills/werf-theme/references/core-contract.md` before wiring
  anything; `references/parity-walkthrough.md` for the per-view traps.
- Class prefix `yz-` (base/shell), `yzt-` (today+focus+endofday), `yzp-`
  (plan+review), `yzd-` (dock+logbook+palette+form). Keep the shared token
  NAMES (`--ground/--rail/--plate/--plate-hi/--well/--ink`,
  `--fg/--fg-dim/--fg-faint`, `--amber(+hot/deep/ground)`, `--port`,
  `--starboard`, `--channel`, `--warn` + `-ground` tints,
  `--t-display/--t-body/--t-mono`, `--fast/--med`) — values ours, names law.
- Never wrap `setCompletion` in your own toast. Capture uses the sacred
  sequence (§6.9). Timer logic in the tunnel is lifted VERBATIM (§6.6).
- LOGIC lifts from `src/themes/nightwatch/` counterparts (handlers, memos,
  effects, guards — they encode hard-won correctness). COMPOSITION never
  copies: if a view's DOM outline matches another theme, it's a defect.

## 1. Visual identity — "lantern-lit paper in a dusk garden"

Two-polarity material system (the theme's visual thesis, no other theme has
it): the SHELL is dusk (deep indigo-violet night, moonlit text); the CONTENT
is washi (warm cream paper sheets, sumi ink text) that reads as lantern-lit
paper floating in the evening garden.

Tokens (`:root` of css/base.css):

```
/* dusk shell */
--ground:#171225   --rail:#1e1830   --plate:#251e3a  --plate-hi:#2c2547
--well:#120e1d     --ink:#0c0917
--line:rgba(237,230,255,.09)  --line-strong:rgba(237,230,255,.2)
--fg:#efe9dd  --fg-dim:#a99fc0  --fg-faint:#6f6590        /* moonlit text */
/* washi paper (the special material — sheets, panes, slips) */
--washi:#f4ecdc  --washi-hi:#faf5e9  --washi-dim:#e9dfc9
--sumi:#2a2433   --sumi-dim:#5c5468  --sumi-faint:#888090  /* ink on paper */
--washi-line:rgba(42,36,51,.14)
/* signals */
--sakura:#e88bb0  --sakura-hot:#f2a9c6  --sakura-deep:#b05a80
--sakura-ground:rgba(232,139,176,.14)
--amber:#dfa14e  --amber-hot:#f0bc74  --amber-deep:#a06c25   /* lantern gold */
--amber-ground:rgba(223,161,78,.14)
--port:#d96a5a      --port-ground:rgba(217,106,90,.14)       /* negative */
--starboard:#8fb573 --starboard-ground:rgba(143,181,115,.14) /* ok / leaf */
--channel:#63c3cf   --channel-ground:rgba(99,195,207,.14)    /* spirit teal */
--warn:#dfa14e      --warn-ground:rgba(223,161,78,.14)
--t-display:'Shippori Mincho B1',serif   /* brush-serif: headers, numerals */
--t-body:'Zen Kaku Gothic New',sans-serif/* clean JP-modern UI body */
--t-mono:'JetBrains Mono',monospace      /* data, key hints, grammar chips */
--fast:130ms  --med:260ms
--r-sm:3px  --r-md:6px      /* paper corners: barely rounded, never pills */
```

**Polish round 1 (type & voice).** Hierarchy is now native, not console:
section titles (`.yz-sec`) are Shippori Mincho sentence case with a 6px hanko-red
square; secondary labels (`.yz-label`) are Zen Kaku, sentence case, never
ALL-CAPS mono. JetBrains Mono is reserved for numerals, `Kbd` chips, and
capture grammar syntax (`.yz-stamp--syntax`). Chips/stamps are sentence case
with a 1px washi-line. Capture modes are stamp toggles (Task / Steps / List).
`--sumi-faint` darkened one step (`#8f8798` → `#888090`) so small labels on washi
clear the 3:1 floor; all other tokens unchanged.

Font import (FIRST line of css/base.css):
`@import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@400;500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=JetBrains+Mono:wght@400;500;600&display=swap');`

Material rules:
- Washi sheets carry a faint paper grain (`tex` noise, density ≤0.08, cream
  on cream) and a deckled top edge (1px torn-edge SVG mask or a subtle
  `--washi-dim` gradient band). Body ink on washi ≥ 7:1 (sumi on washi is
  ~11:1). Moonlit text on dusk plates ≥ 7:1. 10px labels ≥ 3:1.
- Dusk chrome may carry a faint seigaiha (wave-circle) or asanoha data-URI
  SVG pattern at ≤4% opacity — never under body copy.
- Statement moments use sumi-ink edge fades (fs dither creeping from one
  edge, depth 10–16) — the brush-wash look, tuned like `statementBg`.
- Every state color also carries a label/icon (grayscale-legible).
- Reduced motion: global kill-switch + every canvas checks it.
- Focus-visible: 2px `--sakura` outline offset 2px on every interactive class.
- Breakpoints: ≤1080px the paper pane overlays the sheet (slides over,
  backdrop); ≤900px the index collapses to a 56px icon spine with flyout;
  ≤640px single column, index becomes a top drawer.

## 2. THE STRUCTURAL IDIOM — the house: index · sheet · paper pane

**The shell is a three-pane house.** No floating modals for the daily flow.

```
┌─────────┬──────────────────────────┬───────────────┐
│  INDEX  │        THE SHEET         │  PAPER PANE   │
│ (rooms, │  (the active view's      │ (garden at    │
│  lists, │   main washi surface)    │  rest; a task │
│  tags)  │                          │  sheet when   │
│         │                          │  one is open) │
└─────────┴──────────────────────────┴───────────────┘
```

1. **The INDEX (left, 264px) is user data, not view buttons.** Sections:
   - House mark (YOIZAKURA + date line).
   - Smart lists with LIVE counts: **Today** (key 1; pending lineup + fallen
     leaves), **Week** (key 2 → Plan; pending chunks this week), **Inbox**
     (pending, no list → All tasks preset "No list"), **All tasks** (key 3 →
     Lists/library).
   - **Lists** — every un-sealed project: ink color dot, name, pending count;
     click → Lists view with that drawer open. "+ New list" row (D3 create).
   - **Tags** — every used tag with pending count; click → All tasks with the
     tag chip active. (This is the TickTick muscle memory the theme serves.)
   - **Sealed lists** (collapsed) → Lists view, House chronicle section.
   - Foot — **the garden plaque** (G2, always visible): level number + REAL
     level name, lifetime XP, XP-to-next, ink progress meter, streak
     "{n} days tended" when >0; the Attendant AI lamp (G3, honest detail on
     hover); Records button (key 4), help `?`, palette `⌘K` hints.
2. **The PAPER PANE (right, 380px) is a place, not a popup.** Its resting
   state is **the garden** (§4.1). Opening a task (row click / expand
   affordance) slides a **task sheet** over the garden — title, list, tags,
   the DESCRIPTION in full, notes, subtasks, chunk editor, meta, actions.
   Editing (`e`, edit buttons) opens the **writing desk** (full form) in the
   SAME pane slot. Row expansion, task detail, and the form are all THIS
   place. (Solves the "description is too hidden" complaint structurally.)
3. **The SHEET (center) is the active view.** Today = the day sheet; Week =
   the shoji wall (full width, pane appears when needed); Lists = the tansu.

Departures claimed (verified against ALL EIGHT installed themes):
- **Data-index navigation.** Three themes have left rails — all slim icon
  masts. No theme's nav is the user's own lists/tags/counts. Here nav = the
  contents of your life; the three core views are rooms it walks into.
- **The persistent paper pane / detail-as-a-place.** Every other theme
  expands rows in place (accordion wells) or opens modals. Nobody has a
  standing detail surface; nobody renders the task form INTO the layout
  (others: centered ×4, right drawer overlay, left sheet, full-screen).
- **Two-polarity material system** (dusk shell + lit washi content). All
  eight are single-polarity.
- **Plan as a 2D week lattice** (weeks × weekdays shoji wall). Others are 1D
  strips, ladders, boards, day-sheet stacks, or profile+tray.
- **Lists as a tansu** (drawer chest) with brush-drawn ensō progress.
  Others: plates+arcs, rotary gauges, inked sheets, basin map, HP cards,
  node mosaic, segment bays, scrolls-on-cloth.
- **Records as a kakejiku** — a vertical hanging scroll unrolling DOWNWARD in
  a tokonoma alcove composition (kaze's journal claimed horizontal; the rest
  are pages/sheets/panels/tile walls).
- **Palette anchored to the index** — the left column awakened into a command
  panel (others: centered ×3+, bottom sheet, top rail, bottom-prompt
  terminal).
- **The growing tree** — a procedural sakura whose SHAPE grows with real
  lifetime progress (§4.1). No theme has a persistent organism that
  accumulates. (Kaze's petals ride a nav ribbon; this is a tree in a garden,
  and our nav carries no visual data.)
- **Origami confetti** (folded paper burst — kaze owns petal-burst).
- Focus = shishi-odoshi water timer (others: phosphor, horizon, incense,
  filling chamber, plume). End of day = closing the amado shutters. Review =
  a tatami-mat spread.

## 3. Fiction / copy table (labels are costume; capabilities and key hints are real)

| Surface | Copy |
|---|---|
| Views | Today · Week · Lists · Records (nav is functional English — the fiction lives in the material, headers and empty states, NOT in renamed nav; the theme's user is a TickTick migrant) |
| Capture bar | placeholder "Add a task… (!urgent #tag @list 2h fri)"; modes Task / Steps / List (real Task/Steps/Project semantics) |
| Add / delete / edit / focus | Add · Sweep away · Edit · Focus |
| Missed work (T7) | **Fallen leaves** — actions Today / Done / Let go (dismiss); header offers **Sweep all to today** (§5.1) |
| NOW plate | **In hand** — next row "Then" |
| Day cleared | "The garden is tended. The evening is yours." + Close the day |
| Close/reopen day | **Close the amado** / Open the house |
| End-of-day sign-off | "THE HOUSE SLEEPS." |
| Weekly review | **Sunday tea** |
| Logbook | **Records** (the alcove) |
| Focus tunnel | **Night garden** |
| Energy toggle | Pace: Gentle / Auto / Push |
| AI | **the Attendant**; off = "The Attendant is away — the house runs itself." + Retry |
| Undo | Undo (real `U` hint) |
| Preview mode | "A borrowed house — sample life is loaded." exit: "Return home" |
| Cross-tab | "Another window rearranged the house." Reload / Dismiss |
| Crash card | "A paper screen tore." + Reload |
| Promote to project | **Give it its own drawer** |
| Project→list language | Lists everywhere; launch = **Seal the list** (red hanko), ship log = **House chronicle**, unship = **Break the seal**, launch note = the chronicle entry |
| Empty today | "The sheet is blank. The garden waits." (truly-empty offers **Borrow a furnished house** → `enterPreview`) |
| Empty list ledger | "Nothing in this drawer." |
| Level names / trophies / difficulty / PROJECT_TYPES / priorities | REAL core constants, displayed verbatim (trophies hang as omamori charms but keep real names) |
| Garden pane (T1) | **The house:** n waiting · n lined up — never "yard" / "berth" / "slate" |
| Today foot | **Lined up** (done/total + XP left) — never "on the slate" |
| Morning letter | Prose lines from the same facts ("Yesterday: 3 done, 70 XP…") — never boxed mono chips |

**Polish round 1 (copy).** Lift leaks (yard / slate / ALL-CAPS instrument chips) were
replaced with house/garden voice. Nav labels, trophy names, and key hints stay
verbatim. Sentence case is the default; mono is data only.

## 4. Signature visuals (one per view, ALL derived from real state, none stored)

1. **THE TREE (garden pane, resting state).** A procedural sakura on canvas
   (~380×440), deterministic (fixed seed; recursive branching):
   - Growth stage (trunk girth, branch depth 2→7, canopy spread) ←
     `sel.level.lvl` (1–11) with fractional progress from `level.pct`.
   - Open blossoms ← count of TODAY's completions (`D.activityByDay` /
     today's `xpEvents`), placed at deterministic branch tips.
   - Buds ← today's remaining pending lineup rows.
   - Ground petals ← this week's completion count (accumulating scatter).
   - Bloom density multiplier ← streak (0 = sparse green, 7+ = full bloom).
   - **Falling petals are the theme's ONE animated canvas layer**: ~9fps
     stepped, only when streak > 0, one synchronous first frame, stops under
     `document.hidden`, static scatter under reduced-motion. The tree body
     repaints only on data change (offscreen-cached).
   - Beneath: plaque line "{level name} · {streak} days tended" (real names).
2. **THE LANTERN (garden pane).** A paper lantern whose glow (box-shadow +
   fill opacity) = todayXP ÷ XP-on-the-slate; full warm bloom at day-cleared.
   The garden pane also carries the yard counts (T1), ready-to-seal lists
   (T14), next-up day preview (T15), screen log quick-entry (T16) as small
   washi slips under the tree.
3. **THE SHOJI WALL (Week).** The 2D lattice itself (§5.2): ink saturation
   per pane = load÷capacity, lock = the pane's shoji slides shut, today =
   lantern-glow pane. OVERLOADED = a red strain crack along the pane edge.
4. **THE ENSŌ (Lists).** Per-list progress as a brush-drawn ensō circle
   (canvas, brush-textured stroke, gap at the top) that closes as
   `progressOfProject` → 100%; a complete ensō + "READY TO SEAL" glow at
   100%; sealed drawers carry the red hanko stamp.
5. **THE SHISHI-ODOSHI (Night garden).** Bamboo arm fills with
   elapsed ÷ estimate; at each quarter it TIPS (rotate transition + ripple
   ring in the tsukubai basin + a soft "kon" flash). Repaint on the 250ms
   timer tick — data-driven, NOT a rAF loop.
6. **THE KAKEJIKU (Records).** The scroll unrolls downward on open (height
   transition, instant under reduced-motion), level statement as calligraphy.

## 5. Screens (composition from scratch — never copy another theme's outline)

### 5.1 TODAY (the day sheet) — logic lift: `nightwatch/views/today.jsx`
Center sheet, one washi page, top→bottom:
1. Sheet header: time-of-day greeting (+ all-done/empty variants), long date.
   Day-closed banner ("The amado are closed." + Open the house) when closed;
   review-due nudge (Mon/Tue, dismissible per week); "Close the amado →" link
   once something was done today.
2. Capture strip (§6.9) with `scheduleToday`.
3. **The morning letter** (brief, T3–T4): a folded washi note; collapsed =
   one facts line, unfold = deterministic facts ALWAYS (yesterday count/XP/
   focus, fallen-leaves count, load vs capacity with overload/day-off,
   deadlines ≤3d), Attendant prose when on, honest away-line + Retry when
   off; collapse persisted via `patchBrief(iso,{dismissed})` (`b` key);
   Regenerate clears attempted+text; **Apply suggested order**.
4. **In hand** (T5): first pending lineup row on a raised washi plate —
   title, list dot, chunk note, estimate, focus-so-far, Complete + Focus;
   "Then:" next row. Day-cleared: the tended-garden plate (T6) + Close the
   day action.
5. **Fallen leaves** (T7): amber-edged section; rows show days-fallen, list,
   hours; per-row Today / Done / Let go (undoable). Header button **Sweep all
   to today** = loop `moveChunkDate(taskId, iso, todayIso)` per row (an
   affordance over existing ops — the Berth pattern; no new core behavior).
6. **Today section** (T8–T10): lineup rows (§6.10) — blossom-bud complete,
   drag reorder AND `[ ]` (both persist via `setLineupOrder`), Pace toggle
   (energy), row click opens the task sheet in the pane.
7. Foot instruments (T2, quiet): today-XP 7d ink spark · streak week dots ·
   done-today 14d + pending difficulty split · slate done/total + XP left.
8. Empty states (T13): truly-empty → "Borrow a furnished house"
   (`enterPreview`); nothing-lined-up → next planned day + jump to Week.
Right pane: garden at rest (§4.1–4.2); task sheet when a row is opened.
Keyboard: `registerActiveList("today", kbRows)` — fallen-leaves rows FIRST
(own iso as chunkDate), then lineup (today iso for chunks); highlight uses
`globalIdx` with `missed.length` offset; re-register on every memo change;
hover sets cursor.

### 5.2 WEEK (the shoji wall) — logic lift: `nightwatch/views/plan.jsx`
Full-width lattice (paper pane appears only when a task sheet/form opens).
1. Top rail (P1): pending count · est hours · unscheduled · recurring
   reserve (daily = h/day, weekly = h/5 — copy the formula) · fallen-leaves
   notice → Today triage (P9).
2. **The lintel row** (P2): 7 weekday headers carved with capacity hours —
   inline edit 0–10 (Enter/blur commit), small load meter, today amber.
3. **The wall**: rows = weeks (4 from the effective-today week; "+4 weeks"
   adds rows), columns = weekdays. Each day = a shoji pane:
   - washi pane with date numeral; chunk slips (tanzaku): complete/reopen in
     place, click-to-edit (opens the writing desk), split badge i/n, list
     color tick, note, hours, unschedule (undoable `dismissChunk`) (P5).
   - ink load bar at the pane foot = (scheduled + recurring) ÷ capacity;
     OVERLOADED = red strain crack + flag (P4).
   - lock toggle = the shoji slides shut: frame + translucent paper covers
     the pane, small "resting" stamp; AI never touches it; drops blocked
     with the honest toast (P4).
   - today = lantern glow edge; past days of week 1 render dimmed/inert;
     cap-0 days with no items render as dim "resting" panes (nothing is
     hidden — the lattice shows the true week).
   - drag a slip pane→pane = `moveChunkDate` (keeps hours/note/done,
     collision-safe, blocked on locked) (P6).
4. **The Gardener** (bottom band, P7–P8): Schedule N pending (append/fresh),
   instruction panel (⌘/Ctrl+Enter), Rebuild (undoable labeled `applyPlan`),
   replan console — natural language → ops, `{empty:true}` → honest
   "The Gardener couldn't map that." + example prompts; busy lamp states;
   failures via `aiFailureMessage` toast. Copy the failure-handling shape
   verbatim from nightwatch.

### 5.3 LISTS (the tansu) — logic lift: `nightwatch/views/dock.jsx`
Tabs (dockFilter.tab): **Lists** / **All tasks**. Capture strip (no
auto-schedule) above both.
- LISTS tab, no drawer open → **the chest**: type filter chips (All +
  real PROJECT_TYPES) (D2); "+ New drawer" create row (name + type, Enter
  creates, Esc cancels, opens ready for first task) (D3); the drawer grid —
  each drawer front: wood-grain washi label, ink color dot, list name,
  pending/total counts, ensō (§4.4), READY TO SEAL glow at 100%, red hanko
  when sealed (D4). Below: **House chronicle** (D9) — sealed entries expand
  to frozen stats (tasks, XP, est vs focused hours, span days) + note;
  Write/Edit entry; **Break the seal** (unship).
- Drawer open (click, or index list click) → **the open drawer** fills the
  sheet: back-to-chest link, inline rename, 10 color swatches, editable
  description (blur/⌘Enter commit, Esc cancel), child ledger (complete/
  reopen, click-to-edit, XP, detach = "take out of the drawer"), add-child
  input that STAYS open (Enter adds next), Attendant add-tasks
  (⌘/Ctrl+Enter) (D5–D6), Sweep away drawer (cascades, undoable), **Seal the
  list** at 100% with ≥1 task → `shipProject` → chronicle-entry dialog
  (launchNoteFor): Attendant draft, deterministic prefill fallback, editable,
  Log it / Skip (D7–D8). D10 ready-prompt toast comes from core.
- ALL TASKS tab (D11–D13): filter slips — status pending/recurring/done/all ·
  sort (pending only) · search · list dropdown (incl. "No list" for the
  Inbox preset) · used-tag chips (the index Tags land here); full task rows
  with cursor (`registerActiveList("library", …)`) and the paper-pane task
  sheet on click; **Put in a drawer** one-click list-assign on unlisted rows
  (`updateTask(id,{projectId,projectIdChanged:true})`); **Import from a
  photo** (D13): file pick → busy → `aiImportFromScreenshot` → preview with
  per-item include toggles + optional group-as-list + name → Import N
  (deterministic scores fallback).

### 5.4 RECORDS (statsOpen) — the kakejiku — logic lift: `nightwatch/views/logbook.jsx`
Full-surface tokonoma: dusk backdrop, one vertical scroll (max-w ~760px)
hanging from a wooden rod, unrolling downward on open. Sections down the
scroll: level calligraphy (S1: level numeral in Shippori Mincho, REAL level
name, lifetime XP, to-next, ink meter, NEXT line from LEVEL_NAMES/
THRESHOLDS) · tiles streak/completed/sealed (S2) · Sunday tea entry + every
reviewable week with Open (S3) · **The craftsman's eye** (S4: 60-day
calibration, overall + per-difficulty factors with n, focused total, honest
"<3 tasks — not enough yet") · **Omamori rack** (S5: all 16 trophies, real
names, unlock state, derived progress meters) · **The window** (S6: 7-day
screen weather — X/YT stacked bars, mobile-hours bars, averages) · **House
clock** (S7: rollover presets Standard 0 / Late 22 / Overnight 4 + free 0–23
input) · **The kiri box** (S8: export JSON · import merge/replace with
confirms · borrow/return the furnished house (preview) · auto-backup line
via `listBackups()` · migration provenance) · **Refurnish the house** (theme
picker: THEMES from `../registry.js`, `useThemeId`/`setThemeId`, current
marked).

### 5.5 NIGHT GARDEN (focusTaskId) — logic lift: `nightwatch/views/focus.jsx`
Full-screen dusk. Task title + list + difficulty + estimate (X6). Giant
Shippori Mincho timer. The shishi-odoshi (§4.5) beside it. Controls: Pause/
Resume (Space), Reset, Skip (advances to next pending; up-next stone shows
it), Complete (chunk-aware + auto-advance; closes when none left), Exit
(Esc). TIMER LOGIC VERBATIM: elapsed seeds from today's focusMs, 250ms tick,
persist every 5s AND on pause/unmount, `logSession` delta ≥60s once on
unmount, input-tag guard on the local key listener.

### 5.6 SUNDAY TEA (reviewWeek) — logic lift: `nightwatch/views/review.jsx`
Full-page spread: panels laid as tatami mats (the traditional pinwheel
arrangement — one statement mat + surrounding mats, NOT a uniform grid).
Statement mat: week banner (`fmtWeekLabel`) + older/newer across
`reviewableWeeks` (R1). Mats: done/XP/focus/seals tiles · per-day ink bars +
best day · estimate accuracy · fallen-now count · sealed lists · effort
split by list (hours meters) (R2) · the Attendant's retro (cached forever;
Rewrite; honest away-state + Retry; stats always render) (R3). Empty week →
"a quiet week" + jump older (R4).

### 5.7 CLOSE THE AMADO (endOfDayOpen) — logic lift: `nightwatch/views/endofday.jsx`
Centered washi console between two visible shutter panels. Recap (completed
list + XP earned) (E2) · unfinished with "carry to the next open day" toggle
(first capacity day ≤21) (E3) · mobile-hours capture when unlogged (E4) ·
Close the amado → `closeDay({rollForward})`, toast reports carried count,
shutters visibly slide shut (reduced-motion: instant), sign-off "THE HOUSE
SLEEPS." (E5). Entry points E1 come from core/palette/Today links.

### 5.8 THE CALLER (paletteOpen) — logic lift: `nightwatch/views/palette.jsx`
The index awakened: a full-height panel over the LEFT column (width ~360px,
dusk wood, backdrop over the rest). Input at top ("Speak…"), results below:
`buildCommands()` INSIDE the memo (live cursor-row commands: complete/
reopen, edit, focus, today, tomorrow, sweep away, give-it-a-drawer when
eligible) (L1, L4) · task-title search → opens the writing desk (L2) ·
`> text` quick add: `parseQuickAdd` chips inline + sacred capture sequence +
schedules when a date token present (L3) · arrow nav + hover sync + Enter
runs + `keepOpen` respected; hint row seeds `"> "` (L5).

### 5.9 THE WRITING DESK (formOpen) — LOGIC VERBATIM from `nightwatch/taskform.jsx`
Renders IN the paper-pane slot (the pane flips to its writing side; Week
view gains the pane column while open; ≤1080px it slides over with a
backdrop). All form rules verbatim: title (Enter submits) · description ·
notes · priority (4) · repeats Once/Daily/Weekly · difficulty (4) · hours +
XP (deterministic score follows difficulty/hours until XP touched → touched
disables AI refinement; split tasks lock estimate) · schedule date
(+Today/Tomorrow/Clear; hidden for recurring/split) · deadline (+Clear) ·
list select · tags (built-in + custom + new-tag input) · subtasks add/remove
· uncommitted subtask/tag text committed on submit · edit sets
`scheduleDateChanged`/`projectIdChanged` · **Give it its own drawer**
promote block (eligible with subtasks; jumps to Lists) (F7) ·
⌘/Ctrl+Enter submits anywhere; Esc cancels (F1–F7).

### 5.10 THE TASK SHEET (paper pane detail — pane.jsx, theme-original)
The quick-access surface the user asked for (not a parity item — an
affordance over existing ops, Berth-pattern):
- Title (inline rename on blur via `updateTask`), list dot + name, tag chips.
- **Description**: full text, click-to-edit textarea inline (blur/⌘Enter
  commit via `updateTask` — same op the form uses). Notes below, same
  treatment. Plain text; rich text is a core feature request (see FLAGS.md).
- Subtasks: toggle (`toggleSubtask`), add input (`updateTask` subtasks).
- Chunk editor when split (same component the rows use).
- Meta slip: priority · difficulty · hours · XP · schedule · deadline ·
  recurrence (read-only; "Edit" opens the writing desk).
- Actions: Complete/Reopen · Focus · Today · Edit · Sweep away. Close (×)
  returns the garden. Opening: row click anywhere, or `e`-adjacent expand
  affordance on rows. The row EXPAND capability (T8/D12) is satisfied here —
  expansion is a place.

### 5.11 Capture strip (capture.jsx) — logic lift: `nightwatch/capture.jsx`
A washi entry strip: brush-dot caret, placeholder per §3, inline mode stamps
Task/Steps/List (session-persisted `ui.captureMode`), live `parseQuickAdd`
chip echo (task mode), real `N` key hint, full-form brush button (C7).
Sacred sequence on Enter:
```js
const task = captureTask(v, { mode, scheduleToday, parsed });
if (task) enrichCapturedTask(task.id, grammarActive ? parsed.title : v,
  mode, { grammarUsed: grammarActive, hasHours: !!parsed?.hours });
```
List mode → `captureProject(v)` (bare list on AI failure — C5). Steps mode →
AI subtasks (C4). Escape clears + blurs (C2). `setCaptureFocus(() =>
input.focus())` on mount, `setCaptureFocus(null)` on unmount (K5).

### 5.12 Task row (taskrow.jsx)
`.yz-row` on washi: blossom-bud complete button (bud → open blossom on done,
petal-settle micro-transition), title, meta chips (list dot, priority mark,
difficulty pips, hours, split i/n or scheduled date, +XP right), hover
actions (Focus/Edit/Sweep), cursor = a vertical ink brush stroke along the
left edge (`.yz-row--cursor`), done = struck title + settled petal, drag =
paper-lift shadow; fallen-leaves variant with amber edge. Click opens the
task sheet (5.10). Subtle row entrance for freshly captured rows.

## 6. Wiring traps (from the parity walkthrough — apply everywhere)

- `registerActiveList` re-registered on EVERY visible-list change; Today =
  fallen rows first then lineup with the `missed.length` cursor offset;
  `chunkDate` = today iso for lineup chunks, the row's own iso for fallen.
- `setCaptureFocus` mounted/unmounted by every capture input.
- Never wrap `setCompletion` in another toast; it toasts itself.
- Brief generation: copy nightwatch's two `useEffect`s verbatim.
- Palette `buildCommands()` inside the memo, not module scope.
- Toast Undo → `runUndo(toast.undoId)`; confetti = local shown-counter vs
  `ui.confetti`; level-up auto-clears (~2.8s) — render, don't re-arm.
- No theme-local key listeners except inside self-contained overlays (focus
  tunnel pattern, input-tag guard copied).
- Selectors: raw slices via `useStore`, arrays derived in `useMemo`.
- All "today" math through `effectiveTodayIso(dayStartHour)` — never raw
  `new Date()` day bucketing.

## 7. ui-flag → surface checklist (App must render ALL)

view today/plan/dock → Today/Week/Lists · statsOpen → Records kakejiku ·
paletteOpen → the Caller · helpOpen → House rules sheet (SHORTCUT_ROWS +
MOD) · formOpen+editingTaskId → Writing desk · focusTaskId → Night garden ·
reviewWeek → Sunday tea · endOfDayOpen → Close the amado · launchNoteFor →
Chronicle entry dialog · toast → washi slip bottom-center (+signed XP,
+Undo) · confetti → origami burst (sakura/gold/teal folded squares; local
shown counter) · levelUp → hanko stamp banner "{real level name}" ·
previewMode → borrowed-house banner + Return home (always visible) ·
externalChange → rearranged-house banner Reload/Dismiss · aiStatus/aiDetail
→ Attendant lamp · cursor → ink stroke highlight + hover sets it ·
energy → Pace toggle · captureMode → mode stamps · dockFilter → Lists
tabs/filters/index presets · error boundary → torn-screen card (G11).

## 8. File map + BUILD OWNERSHIP (all under src/themes/yoizakura/)

CSS is split per ownership to allow parallel builds; `index.js` concatenates:

```js
import base from "./css/base.css?inline";
import today from "./css/today.css?inline";
import plan from "./css/plan.css?inline";
import dock from "./css/dock.css?inline";
export default { id, name, tagline, App, css: [base, today, plan, dock].join("\n") };
```

| File | Owner | Contents |
|---|---|---|
| index.js | W1 | definition + css concat |
| css/base.css | W1 ONLY | fonts, tokens, shell, index, pane, rows, capture, buttons/chips/fields/meters, toasts/banners/confetti/level-up, help, scrollbars, focus-visible, reduced-motion, breakpoints |
| css/today.css | W2-T ONLY | `yzt-` day sheet, garden extras, night garden, amado |
| css/plan.css | W2-P ONLY | `yzp-` shoji wall, gardener, tatami review |
| css/dock.css | W2-D ONLY | `yzd-` tansu, chronicle, records scroll, caller, writing desk |
| texture.js | W1 | engine copy (from nightwatch) + recipes: washiGrain, sumiEdge (brush fade), duskFade, hankoTex, woodGrain |
| components.jsx | W1 | Icon set, Kbd, Lamp(Attendant), Chip/TagChip, Meter (ink), Stamp/Hanko, BudButton (complete), Eyebrow, EmptyState, Confetti (origami), Field |
| garden.jsx | W1 (T may extend) | Tree canvas (+petal layer), Lantern, Enso, ShishiOdoshi |
| pane.jsx | W1 | PaperPane frame + GardenPane (resting) + TaskSheet (5.10) |
| capture.jsx | W1 | 5.11 |
| taskrow.jsx | W1 | 5.12 + ChunksEditor |
| app.jsx | W1 | three-pane shell, index, every §7 surface, ErrorBoundary; imports views |
| views/today.jsx focus.jsx endofday.jsx | W2-T | 5.1, 5.5, 5.7 |
| views/plan.jsx review.jsx | W2-P | 5.2, 5.6 |
| views/dock.jsx logbook.jsx palette.jsx + taskform.jsx | W2-D | 5.3, 5.4, 5.8, 5.9 |
| registry.js (repo) | W1 ONLY | one import + one entry |
| HANDOFF-<wave>.md | each W2 agent | needed base-css/component additions for integration (DO NOT edit W1 files in wave 2 except your own view css) |
| FLAGS.md | W3 | core feature requests flagged, not built (rich-text desc, etc.) |

W1 creates working STUBS for all W2 files (correct export names, minimal
washi placeholder) so the app boots after wave 1. W2 agents replace their
own files entirely and touch NOTHING owned by another agent.

## 9. Performance & verification budgets

- `tex()` cached by options key; NEVER per frame. rAF grep must list ONLY
  the petal layer (+ optional chart entrances). `toDataURL` only in
  texture.js. Tree body cached offscreen, repainted on data change.
- Charts paint synchronously on data change in the effect body, keyed on
  `JSON.stringify(data)`.
- The shishi-odoshi and lantern repaint on ticks/data — no rAF loops.
- `npm test` (all core tests) and `npm run build` must pass warning-free
  (bundle-size note excepted).
- Contrast probes: sumi-on-washi ≥7:1 body, moonlit-on-dusk ≥7:1 body,
  10px labels ≥3:1 — measure with the toolkit's computed-style probe, both
  polarities.
- Verification drives per `references/parity-walkthrough.md` §8: full
  keyboard sweep (`1 2 3 4 ? ⌘K Esc j/k x u [ ] e f t Del n Shift+N b w`),
  capture grammar chips, list lifecycle (create→children→seal→chronicle→
  unseal), plan lock/drop toast, preview enter/exit byte-identical, theme
  soak ×3 with exactly one `<style>` mounted.

## 10. Local hosting & example data (for review rounds)

`npm run dev` → open the app → Records → Refurnish the house → Yoizakura
(or set from any theme's picker; `werf_theme` persists) → the empty state's
"Borrow a furnished house" or Records → kiri box → preview loads the sample
yard. Reviewers drive every parity item on that data.
