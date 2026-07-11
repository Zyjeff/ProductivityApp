# progress

## done — all phases complete
- Phase 0: quest-original cloned read-only (origin removed, never touched after); quest-next initialized, no remotes, never pushed.
- Phase 1–2: AUDIT.md Parts A–C — full code read + live driving session of the original; all major defects confirmed with numeric repros.
- Phase 3: VERDICT.md — partial rebuild as **Werf** (harbor-at-night identity); committed as its own checkpoint before building.
- Phase 4: built per the 13-item checklist. Core: derived-XP ledger (domain.js), one-shot migration quest v≤8 + vsq_* + shiplist with lifetime-XP baseline (db.js), single store with ONE completion mutation + undo (store.js), status-aware AI client (ai.js), dev AI middleware in vite.config.js (same contract as the Netlify function). UI: Today / Plan / Dock + Logbook panel, command layer (j/k/x/e/f/t/del, Ctrl+K palette), focus tunnel with working chaining, end-of-day ritual, preview mode, rotating auto-backups.
- Phase 5: verified in the running product — see AUDIT.md Part D. 21/21 tests, clean build (302 kB / 92 kB gz), live migration proof (2340 XP preserved exactly), double-pay scenario now sums 70/70, honest AI in all three modes (no key / bad key / working), mobile capture fixed, preview round-trip exact.

## verification-found fixes
- watchLevel synchronous recursion on level-up (froze React; ledger stayed consistent — derived state proved its worth). Fixed: order + re-entrancy guard + resilient emit().
- Dev middleware read .env from process.cwd(); anchored to config dir.

## decisions
- Weekly recurring uses a Monday-anchored week window (old: creeping "7 days since done"). Recurring tasks keep `history[]`; XP derives from it.
- Deterministic scoring is the default; AI refines when reachable. Capture never blocks on the network.
- Capture on Today pins to today (fixes capture-to-void); capture on Dock goes to the library unscheduled.
- Streak is recomputed from history at migration and may differ from the old counter (documented in README).
- Legacy quest_*/vsq_* keys left in place after migration; werf_* clear re-runs it.
- Dependencies: zero added — react, react-dom / vite, @vitejs/plugin-react.

## next (owner's call, not started)
- Real-key smoke test of aiPlan/aiReplan prompt quality (transport is proven; prompt tuning may want a pass with live traffic).
- Optional: .ics export, per-task actual-time ledger, PWA service worker for full offline.
