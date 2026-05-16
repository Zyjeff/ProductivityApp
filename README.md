# Quest

Personal OS for shipping — merged from two earlier productivity tools (gamified task tracker + project shipping list) into one designer-focused app.

Six views: **Today** · **Queue** · **Pipeline** · **Planner** · **Habits** · **Trophies**. Warm off-white palette, one accent, keyboard shortcuts (`N` new task, `1–6` views, `?` help, `Esc` close, `⌘↵` submit).

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173.

Data persists to `localStorage` via the `window.storage` shim in [src/main.jsx](src/main.jsx). Clear the keys prefixed `quest_*` to reset.

## Deploy

Netlify is wired via [netlify.toml](netlify.toml):

- Build: `npm run build`
- Publish: `dist`

Connect this repo to a Netlify site and pushes to `main` will auto-deploy.

## AI features

Task XP scoring and the two-week planner call `https://api.anthropic.com/v1/messages` directly. From a browser this is blocked by CORS and requires an API key, so both will silently fall back:

- `aiScore` → `{ xp: 20, difficulty: "medium" }`
- `aiPlanWeek` → `null` (planner stays empty)

To enable for real, add a serverless proxy (Netlify Function / Cloudflare Worker) that injects `x-api-key` server-side, and point both `fetch` calls in [src/App.jsx](src/App.jsx) at the proxy path. **Never ship the API key to the client.**

## Migration

On first load `runMigrations()` pulls forward any existing data from the two source apps:

- `vsq_*` keys (legacy Quest) → `quest_*`
- `shiplist-projects-v2` → Quest projects + child tasks, with type mapping

Schema is versioned (`quest_schema_v`) so it runs once.
