# HANDOFF — Yoizakura W2-D (Lists, Records, Caller, writing desk)

Replaced the W1 stubs for dock / logbook / palette / task form. Logic lifted from Nightwatch; composition follows DESIGN.md §5.3 / §5.4 / §5.8 / §5.9.

`npm test` 25/25. `npm run build` passed (bundle-size note only). Grep of owned files: no `localStorage`, no rAF, no `toDataURL`.

## What landed

**Lists (`views/dock.jsx` + `css/dock.css`)**
- Tabs via `dockFilter.tab`: Lists / All tasks. `CaptureStrip` (no auto-schedule) above both.
- Chest: type chips (All + real `PROJECT_TYPES`), `+ New drawer` (Enter creates + opens, Esc cancels), drawer grid with woodgrain label, ink dot, counts, `Enso`, READY TO SEAL glow + Seal at 100%.
- Open drawer fills the sheet from `dockFilter.project` (YZ_DOCK real id) or a click. Back-to-chest, inline rename, 10 swatches, description (blur/⌘Enter, Esc cancel), child ledger, add-child input that stays open, Attendant add-tasks (⌘/Ctrl+Enter), Sweep away, Seal the list → `shipProject` → `ChronicleDialog`.
- House chronicle under the chest. `__chronicle__` scrolls/highlights it. Break the seal / Write/Edit entry.
- All tasks: status · sort · search · list dropdown including **No list** (`__none__`) · used-tag chips · `TaskRow` + `onOpen={openTask}` + `registerActiveList("library", …)` · Put in a drawer · Import from a photo (preview toggles + group-as-list).
- `ChronicleDialog` still exported; App mounts it. Not remounted from DockView.

**Records (`views/logbook.jsx`)**
- Full-surface tokonoma, one vertical scroll, kakejiku hanging from a wooden rod, unrolls down (grid-template-rows; instant under reduced-motion).
- Level calligraphy, streak/completed/sealed, Sunday tea + Open, craftsman’s eye, omamori rack (all 16, real names), 7-day window charts (canvas, data-change only), House clock presets + 0–23, kiri box (export / import merge-replace confirms / borrow-return / `listBackups()` / migration), Refurnish the house (`THEMES` from `../../registry.js`). Close clears `statsOpen`.

**Caller (`views/palette.jsx`)**
- Left ~360px dusk panel + backdrop. `buildCommands()` inside the memo. `>` quick add with chips + sacred capture sequence. Arrow/hover/Enter, `keepOpen`, hint seeds `"> "`.

**Writing desk (`taskform.jsx`)**
- Nightwatch form rules verbatim. Renders as a washi sheet when `embedded` (pane.jsx). No second centered overlay from App. Promote → Lists with the new drawer open (`dockFilter.project = res.projectId`).

## YZ_DOCK paths (drive these)

| Index | Expected |
|---|---|
| Inbox | library + `project === "__none__"` → No list filter (unlisted only) |
| All tasks | library, `project` null |
| A list | projects tab, that drawer fills the sheet |
| Sealed lists | projects tab + scroll to House chronicle |
| `+ New list` (index) | already creates; chest `+ New drawer` still works. `__new__` opens the create row |

Sentinels are **duplicated** in `dock.jsx` (`inbox/chronicle/newList`). Importing `YZ_DOCK` from `app.jsx` would cycle. Integration can extract a tiny `sentinels.js` if it wants one source.

## Wanted from W1 / integration (did not touch)

- Extract `YZ_DOCK` out of `app.jsx` so views can import it without a cycle.
- A `yz-swatch` primitive — used `yzd-swatch` in dock.css.
- Chart helpers (WeatherBars / CalRow) — painted in logbook with `yzd-` canvases.
- `yz-desk` in base.css is only flex padding; washi fill is `yz-washi` + `yzd-desk`. A base washi-desk utility would help other waves.
- Library D12 “expand + chunk editor”: TaskRow does not expand in place (HANDOFF-W1). Click → paper pane TaskSheet (already has `ChunksEditor`). Do not add in-row expand.
- `registerActiveList` cleanup when leaving the library tab — Nightwatch doesn’t; neither do we. A core or App-level clear on view change would be nicer.
- Deadline field is grouped with schedule in Nightwatch (hidden for recurring/split). DESIGN lists deadline separately; we kept Nightwatch. Integration can split the fields if desired.
- Focus-visible already covers `button/input/textarea/select` in base; no extra `yzd-` list needed.

## Deviations from DESIGN.md (with reasons)

1. **Today/Tomorrow on the desk** use `effectiveTodayIso(dayStartHour)` rather than Nightwatch’s `isoDate(new Date())`, so House clock rollover is honest (§6).
2. **New-drawer default type is `other`**, matching the index create row, not Nightwatch’s `client`.
3. **Add-child + Attendant stay visible** in the open drawer (DESIGN D6 “stays open”), not Nightwatch’s toggle-to-Add/AI modes.
4. **Sealed hanko lives on chronicle rows**, not chest fronts — sealed lists are not in the grid (they’re the chronicle). Ready-to-seal glow is on the chest.
5. **No 30-day averages plate** in Records — not in §5.4. Calibration + window + tiles cover S2/S4/S6.
6. **Desk is one column** (380px pane). A 2-col Nightwatch console would crush.
7. **Promote opens the new drawer** (`project: res.projectId`) instead of only flipping the Lists tab — YZ_DOCK convention.
8. **Kakejiku unroll** is CSS grid-template-rows + a 30ms timeout, not rAF.

## Drive hard in verification

1. **YZ_DOCK**: Inbox → No list; a list in the index → that drawer; Sealed lists → chronicle scroll; All tasks tag chip from index Tags.
2. **Embedded desk**: `e` / Shift+N / row Edit → form in the **paper pane**, not a centered modal. Esc once. Week view should grow the pane column (W1 pane.jsx).
3. **Screenshot import**: photo → busy → preview toggles → optional group-as-list → Import N. AI-off still imports with whatever scores came back (core deterministic fallback).
4. **Import/export confirms**: kiri box Import → first confirm MERGE (OK) vs replace path (Cancel then second REPLACE confirm). Cancel on the second leaves data untouched. Preview: Borrow a furnished house / Return home.
5. **List lifecycle**: create drawer → add children (Enter stays) → complete all → Seal the list → chronicle dialog (Attendant draft / Skip / Log it) → expand chronicle → Break the seal → Sweep away → Undo (`U`).
6. **Caller**: ⌘K left panel; `>` + date token schedules; hint row seeds `> `; cursor-row commands live (complete/edit/focus/today/sweep/promote).
7. **Never wrap `setCompletion` in a toast** — child ledger and library rows call it raw.
