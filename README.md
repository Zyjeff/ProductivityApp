# Quest

Personal OS for shipping — a single-user productivity dashboard built around capture-to-ship for solo work. Six views, keyboard-driven, AI-assisted but always editable.

Six views: **Today** · **Queue** · **Pipeline** · **Planner** · **Habits** · **Trophies**. Dark palette, one violet accent. Keyboard shortcuts: `N` new task, `1–6` views, `?` help, `Esc` close, `⌘↵` submit.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173.

Data persists to `localStorage` via the `window.storage` shim in [src/main.jsx](src/main.jsx). Clear the keys prefixed `quest_*` to reset — though there's an in-app **Export** / **Import** in the sidebar that's safer than nuking storage.

## Deploy (Netlify)

Build config lives in [netlify.toml](netlify.toml):

- Build: `npm run build`
- Publish: `dist`
- Node 20

Connect this repo to a Netlify site; pushes to `main` auto-deploy.

### Required environment variable

Set `ANTHROPIC_API_KEY` on your Netlify site. The bundled function at [netlify/functions/anthropic.js](netlify/functions/anthropic.js) proxies all `/api/anthropic` calls server-side and injects the header, so the key never reaches the browser. The Anthropic SDK is not used directly from the client.

### Local dev + AI

Without the proxy configured, AI calls degrade gracefully:

- `aiScore` → `{ xp: 20, difficulty: "medium", hours: 1.5 }`
- `aiPlanWeek` / `aiReplanOps` → `null` (the plan stays as-is)
- `aiFromDescription` → a stripped-down version of the input
- `aiExtendProject` / `aiImportFromScreenshot` → return `null`, surface a toast

So the app works offline; AI just becomes a no-op until the proxy is reachable.

## Models in use

- **Haiku 4.5** for short structured outputs: `aiScore`, `aiFromDescription` (capture parser), `aiExtendProject` (project task generation)
- **Sonnet 4.6** for reasoning: `aiPlanWeek`, `aiReplanOps` (surgical replan with operations), `aiImportFromScreenshot` (vision)

All calls use Anthropic prompt caching via `cache_control: { type: "ephemeral" }` on the static rules prefix.

## Data model

Everything lives under `KEYS.*` in [src/App.jsx](src/App.jsx):

- `quest_tasks` — task list with `xp`, `hours`, `difficulty`, `priority`, `recurring`, `projectId`, `deadlineAt`, `focusMs`, `focusDate`
- `quest_projects` — project list with `color`, `type`, `childTaskIds[]`, `desc`, `notes`, ship state
- `quest_weekplan` — per-date `items[]` (chunks) with per-chunk `hours`, `note`, `done`, `doneAt` so a single task can be split across multiple days
- `quest_profile` — `totalXP`, `todayXP`, `streak`, `lastDate`, `completedCount`
- `quest_caps` — workday capacity in hours, per weekday
- `quest_screen` — manual screen-time log keyed by date
- `quest_locks` — per-date "planner skip this" flag
- `quest_achievements` — unlocked trophy ids
- `quest_custom_tags` — user-added tags beyond the built-in set
- `quest_day_start_hour` — when "today" rolls over (0 = midnight, 4 = 4am for night owls)
- `quest_schema_v` — schema version. Migrations run on load and are additive only.

## Migrations

`runMigrations()` runs at app start. Existing data from the two predecessor apps is pulled forward:

- `vsq_*` keys (legacy gamified Quest) → `quest_*`
- `shiplist-projects-v2` → Quest projects + child tasks

Schema versions add fields rather than rewriting shape:

- v2 — weekPlan `{week, day}` → ISO dates
- v3 — weekPlan `tasks[title]` → `taskIds[id]`
- v4 — `taskIds[]` → `items[{taskId, hours?, note?}]`
- v5 — items gain `done`
- v6 — projects gain `color`
- v7 — items gain `doneAt` timestamp

The current schema is v7. Older data loads cleanly; newer data refuses to import.

## Export / Import

The sidebar footer has **export** and **import** buttons. Export dumps every `KEYS.*` namespace plus the schema version into a JSON file. Import supports two modes:

- **Replace** — current data is overwritten entirely
- **Merge** — lists deduplicated by id, counters take the max, achievements unioned

Both refuse to import data from a schema newer than what the app understands.

## Architecture notes

- Single-file React in [src/App.jsx](src/App.jsx). Section comments serve as table of contents. There's a `<AppErrorBoundary>` wrapping the tree so a render-time crash in one view falls back to a recovery card instead of unmounting.
- All state lives in the top-level `App()` component and threads down via a `shared` props object. No state library.
- The chunk-XP distribution math is in `toggleChunkDone` — each chunk pays its share of `task.xp` proportional to its hours; the final chunk tops up so the user is credited exactly the total.
- The replan flow is surgical: `aiReplanOps` returns a JSON array of `move` / `split` / `schedule` / `unschedule` operations, and `applyReplanOps` mutates only the referenced tasks. Anything unmentioned is preserved.
- AI prompts include project tags in `[brackets]` and `deadline:` annotations per task line so user instructions can reference both.
