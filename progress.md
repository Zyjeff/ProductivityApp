# progress

## done
- Phase 0: quest-original cloned read-only (origin removed); quest-next initialized, no remotes.
- Phase 1–2: AUDIT.md — full code read + live driving session; all major defects confirmed with repros.
- Phase 3: VERDICT.md committed — partial rebuild as **Werf**, harbor-at-night direction.
- Scaffold: package.json / vite.config (dev AI middleware) / index.html / netlify function (contract unchanged) / manifest+icon / tokens.css.
- Core: domain.js (derived XP ledger, one date convention), db.js (migration quest v≤8 + vsq_* + shiplist → werf v1 with XP baseline; debounced persist; 7-slot backup ring; export/import incl. quest format), store.js (single store, ONE completion mutation, undo stack), ai.js (status-aware client, ported prompts, typed failures).
- Tests: 21/21 green (`npm test`) — no-double-pay, chunk share sums, migration idempotence, legacy plan shapes, replan ops surgical behavior, rollover hour.

## next
- components.jsx + keys.js (command registry / palette)
- views: today / plan / dock / focus / stats panel
- app.jsx shell + main.jsx
- README rewrite; Phase 5 verification

## decisions
- Weekly recurring tasks now use a Monday-anchored week window (was: "7 days since completion", which crept later every week). Both dailies and weeklies keep a `history[]` of ISO dates; XP derives from history.
- Deterministic scoring is the default; AI is a suggester. Rationale in AUDIT C4/C5.
- Legacy quest_*/vsq_* keys are left in place after migration (old app still works; re-migration possible by clearing werf_*).
- Dependencies: zero added — react, react-dom, vite, @vitejs/plugin-react only.
