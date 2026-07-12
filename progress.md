# progress

## Platform phase (previous sessions) — done
Full rebuild of Quest → Werf: derived-XP ledger, one completion
mutation, migration (quest v≤8 / vsq_* / shiplist, lifetime-XP baseline),
honest AI transport (Netlify fn + Vite dev middleware), 3-surface IA,
keyboard-first command layer. See AUDIT.md, VERDICT.md.

## Product phase (this session) — done
Rollback point: tag `pre-feature-expansion` + `../quest-next-backup-2026-07-12`.
Docs: PARITY.md (6 restorations, 2 supersessions, 4 kills), IDEAS.md
(26 candidates scored), ROADMAP.md.

Shipped, each finished (nav + shortcut + identity + empty/error +
persistence/migration + exercised live), one commit each:
- R1 restorations: focus badge on rows · Dock type-filter chips ·
  first-launch sample-data CTA · "Day cleared" moment (whole lineup).
- R2 Promote to project (edit form + palette, undoable).
- R3 Screen-log detail restored in Logbook (X/YT split, mobile, averages).
- F3 Run order + NOW/NEXT stage (`[` `]` + drag, per-day persist).
- F6 Natural-language quick add (grammar in capture bar + palette `>`).
- F4 Session ledger + estimate calibration (schema v2; AI scorer reads it).
- F1 Morning Brief (`B`; skeleton always + AI prose + apply run order).
- F2 Weekly Review (`W`; stats overlay + browsable history + AI retro).
- F5 Ship Log (launch freezes stats + AI-drafted editable note; fleet diary).

Schema: v1 → **v2**, additive (werf_sessions/briefs/reviews). v1→v2
upgrade tested + verified live to leave existing data intact.

## verification (Phase 5) — all green
- `npm test` 25/25; `npm run build` clean (352 kB / 106 kB gz, ~0.85s).
- Fresh quest-v8 + shiplist migration → schema 2, lifetime XP preserved
  exactly (1850→1850), v2 slices created, brief renders, no real errors.
- Every shortcut driven live: 1/2/3/4, B, W, Ctrl+K, ?, j/k, [/], x, u.
- Each flagship exercised incl. AI working-path (stubbed Anthropic-shaped
  responses) and degraded path (no key / off).
- Bug found + fixed during verify: `fmtWeekLabel` wasn't ported into
  domain.js (review overlay crashed to boundary on first open) → added +
  re-verified. (Same "port a helper" class as the platform phase's dead
  reads; caught by driving, not reading.)

## decisions / engineering-gravity notes (resisted)
- Wanted to refactor the growing store.js into slices — resisted; no
  roadmap feature demanded it. Noted for a future platform pass.
- Wanted a shared "AI-generated card" component (brief/review/note repeat
  the attempted/text/degraded pattern) — resisted the abstraction mid-
  build; three concrete copies ship finished, dedupe later if it earns it.
- Kept run-order in meta (not a per-plan field) so it prunes cleanly and
  never complicates the plan schema the platform phase locked down.

## next (backlog, not built — see IDEAS.md)
Deadline radar · plan-tomorrow inside Close Day · inbox/triage · full
project notes drawer · ask-the-yard Q&A · streak stakes · day journal ·
year heatmap · store.js slice refactor (platform, not product).

## dither pass (post-product session)
- Adopted the tripwire.sh dither-kit AESTHETIC via a hand-rolled ordered-dither canvas engine (src/dither.jsx): Bayer-8 fills, colour bloom, entrance sweep. Deliberately did NOT vendor the npm kit: it requires motion + d3-scale + d3-shape + clsx + tailwind-merge + Tailwind-styled DOM and shows no license, for 5 chart types where Werf needs 2. Zero deps added. Revisit the real kit if pie/radar/scrub-tooltips ever earn a place.
- Charts swapped: Today XP + done sparklines, week bars, Review per-day bars, Logbook screen-log stacked + mobile bars. All solid meter fills carry a dither texture (.w-bar-fill); body + focus tunnel gained a faint dither grain.
- Engine paints synchronously and only animates via rAF as enhancement (rAF is throttled in occluded tabs — found live when the preview pane rendered blank canvases).
- Day rollover: was never missing — Logbook > Day rollover (presets + hour, migrated from quest_day_start_hour). Added a palette command and a README section for discoverability.
