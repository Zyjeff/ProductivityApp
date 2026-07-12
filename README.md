# Werf

A single-user shipyard: capture in zero clicks, plan honestly, launch
relentlessly. Werf is the successor to Quest — same mission (a personal
OS for shipping solo work), rebuilt on a foundation where the numbers
can't lie and the AI can't fail silently.

Three surfaces: **Today** (the workbench — a morning brief, a NOW/NEXT
stage, capture that lands here scheduled for today, a run order you
control) · **Plan** (the same work arranged in time, with an AI
scheduler) · **Dock** (projects with a launch ritual + Ship Log, plus
the full task library). The **Logbook** panel holds level, trophies,
estimate calibration, screen-log history, weekly reviews, settings, and
data tools.

## What Werf does that Quest didn't

- **Morning Brief** (`B`) — opens the day with a real briefing: yesterday's
  ships and focus hours, what's adrift, today's load vs capacity, near
  deadlines; AI adds a written brief and a suggested run order you apply
  in one click. Always renders the numbers even with AI off.
- **NOW / NEXT stage + run order** — Today's lineup is a queue you own:
  drag or `[` / `]` to reorder (persists per day); a stage highlights the
  current task with Focus/complete inline and previews what's next.
- **Session ledger + estimate calibration** — the focus tunnel logs real
  time; task rows show actual-vs-estimate, and the Logbook shows how far
  your estimates run from reality (per difficulty). The AI scorer reads
  that calibration, so estimates learn from you.
- **Weekly Review** (`W`) — every past week, browsable: ships, XP, focus
  hours, estimate accuracy, best day, effort split by project, and an
  AI-written retro stored as the app's memory.
- **Ship Log** — launching a project freezes its stats and mints an
  editable log entry (AI-drafted); the launched fleet is a browsable
  diary, not just confetti.
- **Natural-language quick add** — type `invoice @igp fri 1h !high #admin`
  in the capture bar or the palette's `>` mode; a live chip preview shows
  what parsed. Fully offline (a parser, not a model).

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 25 domain/migration tests (node:test, no deps)
```

AI features work locally too: copy `.env.example` to `.env`, set
`ANTHROPIC_API_KEY`, restart the dev server. The Vite config includes a
tiny dev middleware that serves the same `/api/anthropic` contract as
the production Netlify function — the key stays server-side in both.
**Without a key the app is fully usable**: capture is instant, scores
are deterministic (difficulty × hours), and the status dot + toasts say
plainly that AI is off. Nothing silently pretends.

## Deploy (Netlify)

- Build `npm run build`, publish `dist`, Node 20 (see `netlify.toml`).
- Set `ANTHROPIC_API_KEY` on the site. `netlify/functions/anthropic.js`
  proxies `/api/anthropic` server-side; the key never reaches the client.

## Migration — your old data comes with you

On first launch Werf looks for previous-generation data in
localStorage and imports it once, automatically:

- `quest_*` keys (any schema v1–v8, including all four historical
  weekplan shapes)
- `vsq_*` keys (the original gamified app), where quest data is absent
- `shiplist-projects-v2` (the old ship-list), if quest never imported it
- Backup files from either app (Logbook → Import accepts Werf format-2
  *and* Quest format-1 JSON)

**Your lifetime XP is preserved exactly.** Werf derives XP from the
completion history instead of keeping a mutable counter, so at
migration it stores a one-time baseline = (old total − derived total).
The number in the sidebar on day one is the number you had. The streak
is *recomputed from your actual history* and may differ from the old
counter — the history is the truth.

Legacy keys are left untouched, so the old app still works if you ever
open it. To re-run the migration, clear only the `werf_*` keys.

## Night-owl day rollover

Logbook (`4`) → **Day rollover**: presets Standard (midnight) / Late
(10pm) / Overnight (4am), or any hour. With Overnight set, 1am work
still counts as *today* — streak, Today's lineup, screen log, briefs,
and reviews all respect it. Migrated automatically from Quest's
`quest_day_start_hour`. Also reachable via `Ctrl/⌘+K` → "day rollover".

## Data & durability

- Everything lives in localStorage under `werf_*` (local-first, no
  accounts, no server).
- A rotating **auto-backup** (7 slots, one per weekday) is written on
  the first open of each day.
- **Export** (Logbook) downloads a full JSON backup; **Import** offers
  merge (dedupe by id) or replace. Export weekly for an off-machine copy.
- Multi-tab edits are detected and surfaced with a reload banner rather
  than silently last-write-wins.

## Keyboard

`N` capture · `Shift+N` full form · `1/2/3` surfaces · `4` Logbook ·
`B` morning brief · `W` weekly review · `Ctrl/⌘+K` palette (type `>` to
quick-add from anywhere) · `j/k` cursor · `[ / ]` reorder today's lineup ·
`x`/`Enter` complete · `e` edit · `f` focus tunnel (with no cursor,
focuses NOW) · `t` schedule today · `Del` delete (undoable) · `u` undo ·
`?` help. Complete/delete never ask for confirmation — every destructive
action has a 6-second undo instead.

### Quick-add grammar (capture bar + palette `>`)
`!urgent`/`!high`/`!low` priority · `#tag` · `@project` (fuzzy) ·
`2h` / `~1.5h` / `30m` estimate · `today`/`tomorrow`/`fri`/`jul 20`/`20-07`
schedule · `due <date>` deadline · `every day` / `weekly` recurrence.
Anything unrecognized stays in the title — nothing typed is lost.

## Architecture (for future-me)

- `src/domain.js` — pure logic. XP, streak, activity, and levels are
  **derived** from the completion history (tasks + plan chunks +
  recurring `history[]`); nothing accumulates in place, so the ledger
  can't drift and merge/import is trivially correct. One date
  convention: local ISO strings, rollover-hour aware, everywhere.
- `src/db.js` — sync load, one-shot migration, debounced per-slice
  persist, backup ring, export/import.
- `src/store.js` — single store (`useSyncExternalStore`), **one
  completion mutation** (`setCompletion`) for tasks, chunks, and
  recurring — the task/chunk divergence class of the old app is
  structurally impossible.
- `src/ai.js` — status-tracked client for score / capture-parse / plan /
  surgical replan / project-extend / screenshot-vision / morning brief /
  weekly retro / launch note. Typed failures; the UI reports what broke.
- `src/domain.js` also holds the pure feature logic: the quick-add
  grammar (`parseQuickAdd`), session calibration, morning-brief and
  weekly-review data, launch stats — all deterministic and unit-tested.
- `src/views/*` — Today, Plan, Dock, Logbook (stats), Review, focus
  tunnel, palette, end-of-day.
- **Schema v2** adds three additive slices — `werf_sessions` (focus
  ledger), `werf_briefs` (per-day morning briefs), `werf_reviews` (weekly
  retros). The v1→v2 upgrade is additive and leaves all existing data
  untouched (tested).
- Dependencies: `react`, `react-dom` (runtime); `vite`,
  `@vitejs/plugin-react` (dev). Nothing else — no new deps this phase.
