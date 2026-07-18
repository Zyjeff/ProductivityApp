# THEMING.md — how Werf themes work

Werf is one functional core with swappable presentation. A theme may
replace layouts, components, visual structure, animations, and add its
own UI-level extras — it may never change what the app can do.
`FEATURE_PARITY.md` is the contract: every theme ships 100% of that
inventory. This document is everything needed to build a third theme.

## Anatomy

```
src/
  core/                 the functional core — state, data, actions,
    store.js            logic, keyboard. NEVER imports from a theme.
    domain.js
    db.js
    ai.js
    enrich.js
    keys.js
    theme.js            persisted theme id + useThemeId()/setThemeId()
  themes/
    registry.js         the installed themes — one import + one entry each
    drydock/            theme: the working yard (the original UI)
    nightwatch/         theme: the yard after dark (watches & bells)
      index.js          default-exports the theme definition
      tokens.css        the theme's entire stylesheet
      app.jsx           the shell: nav, overlays, banners, toasts
      views/…           the surfaces
      …                 anything else the theme needs (textures, charts)
  main.jsx              boot: initStore → initTheme → installKeyboard →
                        render <ThemeRoot/> (mounts ONE theme's css+App)
```

A theme is one folder. Its `index.js` default-exports:

```js
import App from "./app.jsx";
import css from "./tokens.css?inline";   // Vite inlines the sheet as a string

export default {
  id: "mytheme",        // stable slug — persisted in localStorage werf_theme
  name: "My Theme",     // shown in theme pickers
  tagline: "One line of character.",
  App,                  // React component rendering the ENTIRE app UI
  css,                  // the whole stylesheet, mounted only while active
};
```

`main.jsx` renders `<style>{theme.css}</style>` plus `<theme.App/>` for
the active theme only. Because exactly one sheet is ever mounted,
themes never collide — name your classes whatever you like. Switching
themes swaps both in one React commit: instant, no reload, and the
store (all data) is untouched.

## The contract a theme consumes

Themes import ONLY from `src/core/` (and their own folder — never from
another theme). The core surface:

**State** — `useStore(selector)` subscribes to the single store;
`getState()` reads it imperatively; `sel` has common selectors
(`sel.level`, `sel.totalXP`, `sel.streak`, `sel.todayIso`, …);
`todayLineup(state)` builds today's ordered lineup rows.

**UI state** — `s.ui` holds view/overlay state the keyboard layer
drives: `view` ("today"|"plan"|"dock"), `statsOpen`, `paletteOpen`,
`helpOpen`, `formOpen`+`editingTaskId`, `focusTaskId`, `reviewWeek`,
`endOfDayOpen`, `launchNoteFor`, `captureMode`, `energy`, `cursor`,
`toast`, `confetti`, `levelUp`, `previewMode`, `externalChange`,
`aiStatus`+`aiDetail`, `dockFilter`. Write with `setUI(patch)`. Your
App must render a surface for every one of these — the Esc cascade and
number keys in `core/keys.js` assume they exist.

**Actions** (all in `core/store.js`) — `setCompletion` (the one
completion mutation), `captureTask`, `addTask`, `updateTask`,
`deleteTask`, `toggleSubtask`, `promoteToProject`, plan mutations
(`pinTaskToDate`, `moveChunkDate`, `updateChunk`, `dismissChunk`,
`applyPlan`, `toggleDayLock`, `setCaps`), project actions
(`createProject`, `updateProject`, `deleteProject`, `shipProject`,
`unshipProject`, `addChildToProject`, `detachFromProject`,
`saveLaunchNote`), lineup order (`setLineupOrder`, `moveLineupRow`),
brief/review (`ensureMorningBrief`, `patchBrief`, `applyBriefOrder`,
`openReview`, `closeReview`, `patchReview`, `reviewPromptDue`),
day (`closeDay`, `reopenDay`, `setDayStartHour`, `patchScreenToday`),
focus (`saveFocusTime`, `logSession`), data (`exportData`,
`importDataFromFile`, `enterPreview`, `exitPreview`), plus
`notify(msg, xp?, undoFn?)` / `runUndo` / `undoLast`.

**Derivations** — everything numeric comes from `core/domain.js`
(`totalXP`, `todayXP`, `streak`, `levelInfo`, `xpEvents`,
`morningBriefData`, `weeklyReviewData`, `calibration`,
`getMissedWork`, `parseQuickAdd`, constants like `DIFFICULTY`,
`PRIORITIES`, `ACHIEVEMENTS`, `LEVEL_NAMES`). Never store or invent
these numbers in a theme.

**Keyboard** — installed once by `main.jsx`; a theme only renders.
Two hooks a theme MUST call for the cursor layer to work:
- `registerActiveList(viewName, rows)` whenever the visible ordered
  list changes (`rows: [{ taskId, chunkDate?, done }]`) — this is what
  j/k/x/e/f/t/Del operate on. Today registers adrift rows then lineup;
  Library registers the filtered list.
- `setCaptureFocus(fn)` from a mounted capture input so `n` focuses it
  (unregister with `setCaptureFocus(null)` on unmount; the fallback
  opens the full form).
`buildCommands()` supplies the palette's command list, `SHORTCUT_ROWS`
the help sheet, and `MOD`/`IS_MAC` the modifier label.

**AI** — call through `core/ai.js` (`aiPlan`, `aiReplan`,
`aiExtendProject`, `aiImportFromScreenshot`, `aiLaunchNote`,
`aiFailureMessage`) and `core/enrich.js` (`enrichCapturedTask`,
`scoreTask`, `enrichManualTask`, `captureProject`,
`generateBriefProse`, `generateReviewRetro`). Every AI feature must
render its honest degraded state — the app is fully usable AI-off.

**Theme picker** — every theme's settings surface renders one:
`THEMES` from `themes/registry.js` + `useThemeId()`/`setThemeId(id)`
from `core/theme.js`.

## Satisfying FEATURE_PARITY.md

Walk the checklist top to bottom while you build; nothing there is
optional. The reliable order: shell + nav + overlays wiring (G, K),
capture (C), Today (T), Plan (P), Dock (D), form (F), tunnel (X),
palette (L), logbook (S), end of day (E), review (R). Where your
design has no obvious slot for a capability, design one — dropping it
is the one forbidden move. When you're done, run the app and walk
every item with the keyboard, not just the mouse.

## Registering a theme

1. `src/themes/mytheme/` with `index.js` as above.
2. In `src/themes/registry.js`:
   ```js
   import mytheme from "./mytheme/index.js";
   export const THEMES = [drydock, nightwatch, mytheme];
   ```
That's all — no core edits. It now appears in every theme's picker,
persists via `werf_theme`, and falls back to the first entry if its id
ever disappears.

## Minimal skeleton

```jsx
// src/themes/skeleton/index.js
import App from "./app.jsx";
import css from "./tokens.css?inline";
export default { id: "skeleton", name: "Skeleton", tagline: "Bare hull.", App, css };

// src/themes/skeleton/app.jsx  (NOT parity-complete — a starting shape)
import React from "react";
import { useStore, setUI } from "../../core/store.js";
// …import your views; render something for EVERY ui overlay state:
// formOpen, statsOpen, paletteOpen, helpOpen, focusTaskId, reviewWeek,
// endOfDayOpen, launchNoteFor, toast (with Undo), levelUp, confetti,
// previewMode + externalChange banners.
export default function App() {
  const view = useStore((s) => s.ui.view);
  return (
    <div className="sk-shell">
      <nav>{["today", "plan", "dock"].map((v) =>
        <button key={v} onClick={() => setUI({ view: v, cursor: null })}>{v}</button>)}
        <button onClick={() => setUI({ statsOpen: true })}>logbook</button>
      </nav>
      {/* views + all overlays here */}
    </div>
  );
}
```

## Rules of the road

- Core never imports a theme; themes never import each other.
- No new dependencies for a theme without flagging why.
- Keyboard bindings are core: display them, don't rebind them.
- UI extras are welcome if they derive from existing app data and live
  inside your theme folder. If an idea seems to need a core change,
  it's a feature request, not a theme — flag it and leave core alone.
