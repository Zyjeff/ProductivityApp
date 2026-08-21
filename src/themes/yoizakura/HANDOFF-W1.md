# HANDOFF — Yoizakura W1 (foundation)

W2 agents replace **only their own files**. Do not edit `css/base.css`, `app.jsx`, `pane.jsx`, `capture.jsx`, `taskrow.jsx`, `components.jsx`, `garden.jsx`, `texture.js`, `index.js`, or `css/` files you do not own.

## Pane / TaskSheet API

Wrap is already done in `app.jsx` (`<PaneProvider>`). Views import:

```js
import { usePane } from "../pane.jsx";
import { TaskRow } from "../taskrow.jsx";

const { selectedTaskId, openTask, closeTask } = usePane();
// row click:
<TaskRow ... onOpen={openTask} onHoverCursor={() => setUI({ cursor: { index: globalIdx } })} />
```

| Call | Effect |
|---|---|
| `openTask(id)` | Selects the task; paper pane shows **TaskSheet**. Closes the writing desk if it was open. |
| `closeTask()` | Returns the garden (or hides the pane on Week / ≤1080). |
| `selectedTaskId` | Current sheet id, or `null`. |

**Writing desk:** core `ui.formOpen` + `editingTaskId`. `PaperPane` renders `TaskFormModal` **in the pane slot** (pass `embedded`). Do **not** also mount the form as a centered overlay — Esc would double-close and the desk would leave the house.

**Week (plan):** the pane column mounts only when a task sheet or the desk is open. Today / Lists keep the garden at rest on wide screens.

**≤1080px:** the pane overlays the sheet with a backdrop only when a sheet/desk is open. Backdrop click closes the sheet (`closeTask`) or the desk (`setUI({ formOpen: false, editingTaskId: null })`).

TaskSheet already wires: inline title rename, click-to-edit description/notes (blur / ⌘Enter → `updateTask`), subtasks, `ChunksEditor` when split, meta slip + Edit, Complete/Focus/Today/Edit/Sweep away. Complete is chunk-aware (today's chunk date when split). Never wrap `setCompletion` in a toast.

## Index → Lists (dock) convention

`app.jsx` exports `YZ_DOCK` sentinels. Index writes `ui.dockFilter` and `ui.view = "dock"`. W2-D **must** read them.

| Index click | `setUI` payload |
|---|---|
| Today | `{ view: "today", cursor: null, statsOpen: false }` |
| Week | `{ view: "plan", cursor: null, statsOpen: false }` |
| Inbox | `{ view: "dock", tab via dockFilter: library, status: "pending", project: YZ_DOCK.inbox ("__none__"), tag: null, q: "" }` |
| All tasks | library, `project: null`, `tag: null`, status pending (key 3) |
| A list | `{ tab: "projects", project: <projectId> }` — **open that drawer** |
| A tag | library, `tag: <name>`, `project: null`, status pending |
| Sealed lists → House chronicle | `{ tab: "projects", project: YZ_DOCK.chronicle ("__chronicle__") }` — **scroll to chronicle** |
| + New list | Index creates inline (name + `PROJECT_TYPES`, Enter/Esc). After create it opens that drawer (`project: newId`). |

**Library filter (W2-D):**

```js
if (filter.project === YZ_DOCK.inbox) arr = arr.filter((t) => !t.projectId);
else if (filter.project && !String(filter.project).startsWith("__"))
  arr = arr.filter((t) => t.projectId === filter.project);
```

**Lists tab (W2-D):** if `filter.tab === "projects"` and `filter.project` is a real id, start with that drawer open (do not only use local `expandedId`). If `filter.project === YZ_DOCK.chronicle`, scroll/open House chronicle. `YZ_DOCK.newList` (`__new__`) is reserved if you want the chest's create row to open from elsewhere — the index currently creates itself.

## Capture / rows

- `CaptureStrip` from `capture.jsx`. Today: `<CaptureStrip scheduleToday />`. Lists: `<CaptureStrip />` (no auto-schedule). Sacred sequence is already in the component. `setCaptureFocus` on mount/unmount.
- Modes display as Task / Steps / List; core ids remain `task` / `subtasks` / `project`.
- `TaskRow` does **not** expand in place. Pass `onOpen={openTask}`. Drag props: `draggable`, `onDragStart/Over/Drop/End`, `dragging` → `.yz-row--lift`.
- `ChunksEditor` is exported from `taskrow.jsx` (same logic as Nightwatch).
- Today keyboard list: fallen leaves first, then lineup; `chunkDate` = row iso for fallen, today iso for lineup chunks; highlight lineup with `missed.length` offset. Re-`registerActiveList` on every memo change.

## Signature visuals (garden.jsx)

| Component | Props | Notes |
|---|---|---|
| `Tree` | `level, pct, blossoms, buds, groundPetals, streak` | Body cached offscreen. Petal rAF is the theme's only loop. |
| `Lantern` | `glow` (0–1), `full` | todayXP ÷ slate XP; `full` at day-cleared. |
| `Enso` | `pct`, `size` | Lists drawer progress. Complete circle at 100%. |
| `ShishiOdoshi` | `pct` | Night garden timer. Tips at each quarter via CSS; **no rAF**. |

Garden resting pane already derives T1 / T14 / T15 / T16. W2-T may restyle with `yzt-` but should not duplicate the derivations unless moving them.

## Overlays W2 replaces

App already mounts: `Palette`, `LogbookPage`, `ReviewOverlay`, `EndOfDayDialog`, `FocusTunnel`, `ChronicleDialog`.

- **W2-D** `views/palette.jsx`, `views/logbook.jsx`, `views/dock.jsx` (`ChronicleDialog` + `DockView`), `taskform.jsx`. Keep the **same export names**. Keep a Close that clears the matching `ui` flag. Theme picker must stay somewhere in Records (`THEMES` + `useThemeId`/`setThemeId`).
- **W2-T** `views/today.jsx`, `views/focus.jsx`, `views/endofday.jsx`. Copy Nightwatch timer logic **verbatim** for the tunnel. Lift Today brief `useEffect`s verbatim.
- **W2-P** `views/plan.jsx`, `views/review.jsx`.

Do not mount a second `ChronicleDialog` or `TaskFormModal` from App — they already live in App / the pane.

## base.css class inventory (reuse these; do not fork)

**Type:** `.yz-display` `.yz-label` `.yz-label--lit` `.yz-label--sumi` `.yz-num`

**Shell:** `.yz-shell` `.yz-index` `.yz-sheet` `.yz-sheet-inner` `.yz-pane` `.yz-washi` `.yz-slip` `.yz-slip-h` `.yz-dot`

**Buttons:** `.yz-btn` `.yz-btn--ghost` `.yz-btn--ink` `.yz-btn--gold` `.yz-btn--leaf` `.yz-btn--port` `.yz-btn--sm` `.yz-btn--dusk` `.yz-icon-btn` `.yz-link` `.yz-link--moon`

**Chips / stamps / fields:** `.yz-chip` `.yz-chip--pick` `.yz-chip--on` `.yz-chip--dusk` `.yz-tag` `.yz-stamp` `.yz-stamp--pick` `.yz-stamp--on` `.yz-hanko` `.yz-field` `.yz-field--mono` `.yz-field--dusk` `.yz-bare` `.yz-kbd` `.yz-seg` (+ `button.is-on`) `.yz-modes` `.yz-mode`

**Meters / complete:** `.yz-meter` `.yz-meter-fill` `.yz-meter--gold` `.yz-meter--ink` `.yz-bud` `.yz-bud--on` `.yz-bud--sq`

**Rows / capture:** `.yz-row` `.yz-row--cursor` `.yz-row--done` `.yz-row--fallen` `.yz-row--lift` `.yz-row--fresh` `.yz-capture` `.yz-capture-chips` `.yz-chunks` `.yz-chunk`

**Overlays / chrome:** `.yz-toast` `.yz-banner` `.yz-banner--preview` `.yz-banner--xtab` `.yz-levelup` `.yz-backdrop` `.yz-help` `.yz-overlay` `.yz-stub` `.yz-caller` `.yz-desk` `.yz-empty` `.yz-eyebrow` `.fade-in`

Prefixes for your CSS files: `yzt-` (today.css), `yzp-` (plan.css), `yzd-` (dock.css).

## Deviations from DESIGN.md (with reasons)

1. **`css/base.css` is ~1400 lines**, not 700–900. The house, rows, capture, garden instruments, overlays, and three breakpoints needed a complete system; trimming would have left W2 without buttons/fields/focus-visible.
2. **`--line-dim` added** (not in §1 token list) as a quieter dusk hairline. Required token *names* are all present with spec values.
3. **Inbox “No list”** is `dockFilter.project === "__none__"` rather than a new core field. Core `dockFilter` has no dedicated inbox key; a sentinel is the Berth-pattern affordance.
4. **Chronicle jump** uses `project: "__chronicle__"` for the same reason.
5. **≤1080 garden is not an overlay.** Overlaying the day sheet with the resting garden would hide Today. The pane overlays only for task sheet / writing desk; garden is a wide-screen luxury. Matches “pane overlays the sheet” for the surfaces that need it.
6. **`+ New list` creates in the index** (name + type, Enter/Esc) instead of only flipping to the tansu create row. D3 still belongs in W2-D's chest; the index is usable in W1.
7. **W1 Today/Lists stubs include `CaptureStrip`** so `N` is not a dead key before W2 lands. W2 will replace those files.
8. **Records stub includes the theme picker** so Yoizakura is not a trap. W2-D must keep a picker in the kakejiku.
9. **`ChronicleDialog` lives in `views/dock.jsx` but is mounted by App**, so sealing a list from any view still gets a surface. W2-D should keep that export.
10. **Plaque streak line** always prints `{n} days tended` (including 0) on the garden tree; the index foot still hides the streak when 0, per G2.

## Copy / keys (do not “improve”)

Display `SHORTCUT_ROWS` and `MOD` as-is. Level names, trophy titles, `PROJECT_TYPES`, priorities, difficulties: core constants, verbatim. Capture placeholder: `Add a task… (!urgent #tag @list 2h fri)`.
