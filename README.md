# Werf

A single-user shipyard: capture in zero clicks, plan honestly, launch
relentlessly. Werf is the successor to Quest — same mission (a personal
OS for shipping solo work), rebuilt on a foundation where the numbers
can't lie and the AI can't fail silently.

Three surfaces: **Today** (the workbench — capture lands here,
scheduled for today) · **Plan** (the same work arranged in time, with an
AI scheduler) · **Dock** (projects with a launch ritual, plus the full
task library). The **Logbook** panel holds level, trophies, screen-log
history, settings, and data tools.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 21 domain/migration tests (node:test, no deps)
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
`Ctrl/⌘+K` palette · `j/k` cursor · `x`/`Enter` complete · `e` edit ·
`f` focus tunnel · `t` schedule today · `Del` delete (undoable) ·
`u` undo · `?` help. Complete/delete never ask for confirmation — every
destructive action has a 6-second undo instead.

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
  surgical replan / project-extend / screenshot-vision. Typed failures;
  the UI reports what actually broke.
- `src/views/*` — Today, Plan, Dock, Logbook, focus tunnel, palette.
- Dependencies: `react`, `react-dom` (runtime); `vite`,
  `@vitejs/plugin-react` (dev). Nothing else.
