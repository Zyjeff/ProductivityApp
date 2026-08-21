# Yoizakura — VERIFICATION (W3 integration + parity walk)

Walked Friday 21 Aug 2026 against `http://localhost:5173` with preview data (`werf_theme=yoizakura`). Keyboard first where the item has a key; then mouse. AI was **off** locally (`AI is off — no API key configured`).

The Cursor IDE browser MCP did not keep a tab attached from this wave (`browser_navigate` → no tab). The same Vite server was driven with Playwright/Chromium against the live app. Screenshots are under `src/themes/yoizakura/shots/`. Dev server left running.

## Integration decisions

| Item | Decision |
|---|---|
| `YZ_DOCK` sentinels | Extracted to `nav.js`. `app.jsx` and `views/dock.jsx` import it. `app.jsx` still re-exports for convenience. |
| `.yz-shishi` size | `--yz-shishi-scale` on `.yz-shishi`; `.yz-shishi--lg` = 1.66. Night garden uses the modifier. `.yzt-shishi` kept as an alias. |
| `.yz-banner--closed` / `--tea` | Added in `base.css` (in-sheet, static). Today uses them. |
| `yz-sheet--week` dusk sheet | **Skipped.** Week rail copy is sumi-on-washi; the Gardener is already a dusk band; the kumiko frame (`--wood`) already sits the lattice on evening wood. Flipping the whole sheet to dusk would restyle the rail and fight the two-polarity thesis. |
| `--wood` tokens | `--wood` / `--wood-deep` / `--wood-hi` / `--wood-glow` in `base.css`; `plan.css` consumes them. |
| `.yz-swatch` | Primitive in `base.css`; drawer color picker uses it. |
| Cream washi `statementBg` | **Skipped.** In-hand / day-cleared plates are the gold/leaf statement moment (DESIGN §4). Changing them is polish with contrast risk. |
| `Eyebrow` `flush` | Added (`yz-eyebrow--flush`). Call sites not mass-migrated. |
| Pace → `components.jsx` | **Skipped.** Only Today uses it; moving it would drag `yzt-pace` CSS. `EnergyToggle` remains exported from `today.jsx`. |
| Duplicate “Writing desk” aria-label | **Fixed.** Pane `aside` keeps the name; embedded form omits it when `embedded`. |
| House rules `role="dialog"` | **Added** (`aria-label="House rules"`) so the overlay matches other sheets. |

Copy table (§3) and `SHORTCUT_ROWS` / `MOD` are rendered as-is. Help `.yz-kbd` is visually uppercase (shared kbd style); the data strings are unchanged (`Shift+N` in the row, painted as `SHIFT+N`).

## Bugs found and fixed this wave

1. **Morning letter missing after Borrow a furnished house (T3/T4).** `enterPreview()` wipes `briefs` to `{}` without changing `todayIso`. The ensure effect was keyed only on `todayIso`, so Today (already mounted on the empty sheet) never re-called `ensureMorningBrief()`. The letter stayed unmounted and `b` no-op’d (core also requires an existing brief). **Fix:** `useEffect(() => { if (!brief) ensureMorningBrief(); }, [todayIso, brief])`. Re-walk: letter mounts; facts + Attendant away + Retry; `b` folds `0 → 1`.
2. **Duplicate Writing desk accessible name** when the desk is embedded in the pane. **Fix:** form omits `aria-label` when `embedded`.
3. Sentinel duplication `app.jsx` / `dock.jsx` — extracted to `nav.js` (backlog, not a live bug).

## Static gates

| Gate | Result |
|---|---|
| `npm test` | **25/25** (after integration, form label, and brief-effect fix) |
| `npm run build` | **pass** (existing >500 kB chunk note only, ~1.7 MB) |
| `localStorage` in theme js/jsx/css | **zero** |
| `requestAnimationFrame` | **only** `garden.jsx` petal layer (~9 fps, hidden-tab pause, reduced-motion static, one sync first frame) |
| `toDataURL` | **only** `texture.js` |
| `index.js` CSS concat | `base + today + plan + dock` |
| `registry.js` | exactly one `yoizakura` import + one `THEMES` entry |

## Theme soak

Switched Drydock ↔ Yoizakura **×3** from Records → Refurnish.

- `werf_*` data keys **byte-identical** across switches (theme key excluded).
- `document.querySelectorAll('style').length` **= 1** on every hop (6 measurements).

## FEATURE_PARITY walk

Legend: **PASS** driven live · **CODE** verified in theme source, not fully timed/clicked · **DESIGN** presentation choice vs parity wording · **OPEN** not fully driven (reason).

### G — Global shell

| # | Result | Notes |
|---|---|---|
| G1 | PASS | Index: Today / Week / Lists / Records. Keys `1 2 3 4`. |
| G2 | PASS | Garden plaque: level 3, Builder, 312 XP, 188 to next, meter, “8 days tended”. |
| G3 | PASS | Attendant lamp; away + Retry on brief / review / gardener / chronicle. |
| G4 | PASS | Toast + signed XP + Undo `U`. In-hand Complete produces core’s toast only (no theme wrapper). |
| G5 | PASS | Undo button and `U` (delete drawer “Seal me W3” → Undo `U`). |
| G6 | PASS | Entering preview from an empty house crosses levels; hanko banner **“A new rank / Builder”** with origami. Core clears at 2.8s. Trophy toast **Tidal** also fired on seal. |
| G7 | PASS | Seal → origami burst count 1 + chronicle dialog. |
| G8 | PASS | “A borrowed house — sample life is loaded.” **Return home** always on the banner. |
| G9 | CODE | Cross-tab banner copy + Reload / Dismiss in `app.jsx`. Not dual-tabbed. |
| G10 | PASS | `?` → House rules dialog; SHORTCUT_ROWS + Close / Esc / backdrop. `Shift+N` present. |
| G11 | CODE | Theme `ErrorBoundary`: “A paper screen tore.” + Reload. |

### K — Keyboard

| # | Result | Notes |
|---|---|---|
| K1 | PASS | `Ctrl+K` from the capture input opens The Caller. |
| K2 | PASS | Esc closes palette, help, writing desk (sheet remains), Records, Night garden, Sunday tea, Close the amado — one layer. |
| K3 | PASS | Shortcuts ignored in capture; `Ctrl+K` passes through. |
| K4 | PASS | `1 2 3 4`. |
| K5 | PASS | `n` on Week opens the writing desk; `Shift+N` in help. Capture registers `setCaptureFocus`. |
| K6 | PASS | `U` undo · `W` Sunday tea · `B` folds the morning letter · `?` help. |
| K7 | PASS | After Esc-clear, `j` highlights the fallen leaf first (`.yzt-leaf--cursor`). Lineup uses `.yz-row--cursor`. |
| K8 | PASS | `e` → desk. `f` → Night garden. Delete undoable. |
| K9 | PASS | `f` with no cursor opens Night garden on the In-hand task. |
| K10 | PASS | `]` with cursor on a lineup row swapped Reply ↔ Audit. After reload the order was still Audit, Reply, Morning planning. |

### C — Capture

| # | Result | Notes |
|---|---|---|
| C1 | PASS | Today (auto-schedule) + Lists (no auto-schedule). Modes Task / Steps / List. |
| C2 | PASS | Enter saves; Esc clears + blurs. |
| C3 | PASS | Past-dated capture `Old fallen leaf 1h 2026-08-19` landed in Fallen leaves. Grammar chips live in the strip. |
| C4–C6 | CODE | Sacred sequence + `enrichCapturedTask` in `capture.jsx`. AI-off: raw title kept. |
| C7 | PASS | Capture pencil → full form (`Shift+N` hint). |

### T — Today

| # | Result | Notes |
|---|---|---|
| T1 | PASS | Greeting “Afternoon on the engawa.” Yard counts on the garden pane. |
| T2 | PASS | Foot instruments: today XP, streak dots, done-today, slate done/total + XP left. |
| T3 | PASS / **FIXED** | Facts always after the brief-effect fix (yesterday / fallen / load vs cap / deadline). Attendant away + Retry. |
| T4 | PASS / **FIXED** | `b` folds the letter (`yzt-letter--folded` 0→1). |
| T5 | PASS | In hand plate: title, estimate, Complete + Focus, Then-row. |
| T6 | CODE | Day-cleared copy + Close the amado when lineup empty. Not cleared this yard. |
| T7 | PASS | Fallen leaves: Today / Done / Let go; **Sweep all to today**. |
| T8 | PASS | Lineup click opens the **task sheet** (not in-row accordion). Description click-to-edit blur-commits (“Quick-access description”). |
| T9 | PASS | `[` `]` + drag handlers both `setLineupOrder`. `]` persist verified across reload. |
| T10 | PASS | Pace Gentle / Auto / Push. |
| T11 | CODE | Mon/Tue nudge (`reviewPromptDue`). Today is Friday — not shown. |
| T12 | PASS | “Close the amado →” after work done. |
| T13 | PASS | Empty copy + Borrow a furnished house (used to enter preview). |
| T14–T16 | PASS | Garden slips: yard, next-up Sat 22 Rework navigation, X/YT + mobile log. Ready-to-seal appears when a list hits 100%. |

### P — Plan (Week)

| # | Result | Notes |
|---|---|---|
| P1 | PASS | Pending · est hours · unscheduled · recurring reserve. Fallen-leaf notice → Today. |
| P2 | PASS | Lintel 0–10 inline: `4h` → `6h` via Enter. |
| P3 | PASS / DESIGN | **8-track grid** (gutter + 7 days), `min-width: 860px`, 28 shoji then **56** after +4 weeks. Cap-0 weekends stay as “resting” (DESIGN, not P3 skip). |
| P4 | PASS | Lock a future pane, drop a slip → toast **“That day is locked”**. |
| P5 | PASS | Click today’s tanzaku title → writing desk **in the paper pane**. |
| P6 | CODE | `moveChunkDate` on unlocked drop. Locked-drop path driven; unlocked pane→pane not re-timed after the lock toast. |
| P7 | PASS | Gardener. Ask with AI off → `AI is off — no API key configured`. Rebuild present. |
| P8 | PASS | Nonsense replan → AI-off toast (never reaches `{empty:true}` when the proxy is down; that copy is wired). Example chips present. |
| P9 | PASS | “1 fallen leaf — triage on Today”. |

### D — Lists

| # | Result | Notes |
|---|---|---|
| D1 | PASS | Lists / All tasks tabs. |
| D2 | PASS | All + real `PROJECT_TYPES` chips. |
| D3 | PASS | + New drawer, Enter creates, opens for first task. |
| D4 | PASS | Drawer fronts: counts, ensō, woodgrain label. |
| D5 | PASS | Open drawer (index click on Landing redesign): rename, 10 swatches, description, ledger, Sweep away. |
| D6 | PASS | Add-child stays open. Attendant add-tasks present; AI-off. |
| D7 | PASS | Create “Seal me W3” → add Only child → complete → Seal the list. |
| D8 | PASS | Chronicle dialog: deterministic draft, Attendant away, Log it / Skip. |
| D9 | PASS | Chronicle row + hanko. Expand → **Break the seal** → Sweep away → `U` undo. Same session. |
| D10 | PASS | Trophy toast on seal (core). Origami 1. |
| D11 | PASS | Inbox → No list filter. |
| D12 | PASS | Library `TaskRow` + pane sheet (no in-row expand). |
| D13 | PASS | **Import from a photo** on the library. No image file injected; AI-off would take the honest/scores path. |
| Extra | PASS | **Put in a drawer** on unlisted rows. |

### F — Writing desk

| # | Result | Notes |
|---|---|---|
| F1 | PASS | Create and Edit share one form **embedded in the pane**. Never a centered modal. Esc from desk keeps the task sheet. |
| F2 | PASS | Title, description, notes, 4 priorities, Once/Daily/Weekly, 4 difficulties, hours+XP, schedule Today/Tomorrow/Clear, deadline, list, tags, steps. |
| F3–F4 | CODE | Score-follow / uncommitted commit-on-submit lifted from Nightwatch. |
| F5 | PASS | Esc cancels. ⌘/Ctrl+Enter hinted. |
| F6 | CODE | `scheduleDateChanged` / `projectIdChanged` on edit. |
| F7 | PASS | **Give it its own drawer** shown, disabled until a step exists. |

### X — Night garden

| # | Result | Notes |
|---|---|---|
| X1 | PASS | `f`, In-hand Focus, row focus. |
| X2 | PASS | Seeds from today’s `focusMs` (00:00 on a fresh task). Space → **Paused** / Resume. Esc exits. Reset present. |
| X3 | PASS | Skip + Up next “Audit hero section”. |
| X4 | CODE | Complete chunk-aware + auto-advance (Nightwatch timer lift). |
| X5 | CODE | Persist every 5s + pause/unmount; `logSession` ≥60s in core. Not waited 60s. |
| X6 | PASS | List/difficulty/estimate. Shishi-odoshi beside the timer (`.yz-shishi--lg`). Quarter-tip is CSS on the 250ms tick; not seen at 00:00 elapsed. |

### L — Caller

| # | Result | Notes |
|---|---|---|
| L1 | PASS | Global commands with real key hints. Left index panel. |
| L2 | CODE | Task-title search → `formOpen` + `editingTaskId`. |
| L3 | CODE | `>` branch uses `parseQuickAdd` + sacred capture sequence. Hint seeds `> `. |
| L4 | CODE | `buildCommands()` inside the memo (cursor-row commands). |
| L5 | PASS | Arrow/Enter wired. Opened from inside the capture input. |

### S — Records (kakejiku)

| # | Result | Notes |
|---|---|---|
| S1 | PASS | Level 3, Builder, 312 XP, 188 to next, meter, NEXT Craftsman at 500. Unrolls down. |
| S2 | PASS | Streak 8d / Completed 13 / Sealed. |
| S3 | PASS | Sunday tea list + Open + `W`. |
| S4 | PASS | Craftsman’s eye; honest “not enough” until 3 focused tasks. |
| S5 | PASS | Omamori rack, real names, EARNED + meters. |
| S6 | PASS | The window: 7d X/YT. |
| S7 | PASS | Standard 0 / Late 22 / Overnight 4 + free 0–23 (input set 22 then 0). |
| S8 | PASS | Export blocked in preview (“Exit preview first”). Import confirms, Borrow/Return, auto-backup line, Refurnish picker. |

### E / R / A / M / DATA

| # | Result | Notes |
|---|---|---|
| E1–E4 | PASS | Close the amado from Today link. Recap, carry toggle, mobile hours, overlay + shutters. |
| E5 | CODE | Full close+reopen ceremony not finished (overlay driven; house not left closed). |
| R1 | PASS | `W` opens **last week** (Aug 10–16 from Fri 21). Older/newer. |
| R2 | PASS | Tiles, ink days + best Fri, estimates, fallen, sealed, hours-by-list (Loose tasks = core label). |
| R3 | PASS | Attendant away + Retry; stats always there. |
| R4 | CODE | Quiet-week copy when a week has no activity. |
| A1–A3 | PASS | Every AI surface showed away/Retry or `aiFailureMessage`. Deterministic chronicle prefill. App usable. |
| M1–M6 | PASS | Theme only displays core derivations. Trophy toast fired. Level-up banner on preview enter. |
| DATA1–DATA6 | PASS | No theme `localStorage`. Preview enter/exit. Export blocked while previewing. Soak proved data identity. Rollover input live. |

## Still open (not blockers)

- **G9 cross-tab banner** — not dual-windowed.
- **G11 crash card** — not thrown on purpose.
- **X5 5s persist / ≥60s ledger** — timer logic lifted verbatim; not soaked for a minute.
- **Shishi quarter-tip** — timer at 0%; CSS tip on quarter change is in `garden.jsx`.
- **D13 full photo round-trip** — no screenshot file in the drive.
- **E5 close-day + reopen banner** — overlay driven; day not actually closed.
- **P6 unlocked pane→pane drag persist** — lock-blocked drop verified; unlocked move is the same `moveChunkDate` handler.

None of these are missing surfaces.

## Screenshot inventory

`src/themes/yoizakura/shots/`

| File | Surface |
|---|---|
| `01-today.png` | Today + garden + In hand + morning letter + fallen leaves + rank hanko |
| `02-week.png` | Shoji wall, 7 days, Gardener |
| `03-lists-chest.png` | Tansu chest + ensō |
| `04-open-drawer.png` | Landing redesign drawer |
| `05-task-sheet.png` | Paper-pane task sheet |
| `06-writing-desk.png` | Writing desk in the pane (Today) |
| `06-writing-desk-week.png` | Writing desk from a Week slip |
| `07-records.png` | Kakejiku (level, tea, omamori) |
| `08-caller.png` | Caller over the index |
| `09-night-garden.png` | Night garden paused, shishi, up-next |
| `10-sunday-tea.png` | Tatami pinwheel + Attendant away |
| `11-close-amado.png` | Close the amado console |
| `12-help.png` | House rules (SHORTCUT_ROWS) |
| `13-chronicle-dialog.png` | Seal dialog + House chronicle row |
