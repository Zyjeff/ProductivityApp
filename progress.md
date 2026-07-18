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

## visual overhaul — 1-Bit Harbor (design-lead session)
Total visual-language replacement; zero functional change. Backup at
../werf-backup-pre-visual-2026-07-12 + tag pre-visual-overhaul.

- KILL-LIST.md: 22 condemned patterns (rounded-card grammar, border-line
  hierarchy, colored glows/shadows, pill chips, gradient buttons, emoji
  accents, generic dark-dashboard tokens…). All 22 confirmed purged from
  UI **and** code — grep sweep zero hits, legacy CSS block deleted
  (tokens.css 26.4 → 18.25 kB built).
- DESIGN.md: the 1-Bit Harbor system. Tonal elevation (no borders/
  shadows) — ground/rail/plate/well; stencil labels + dither tails;
  amber tape labels; chamfered statement plates; harbor-light circles as
  the only round shapes; instrument-panel controls (switches, bezels);
  display/mono type pairing.
- src/texture.js: seeded procedural dither engine. Three algorithms
  (ordered Bayer-8, tileable blue-noise cell hash, Floyd–Steinberg error
  diffusion), xmur3/mulberry32 PRNG, density gradients, per-entity seeds
  (`plateTex("berth-"+id)`, `statementBg("now-"+taskId)`) so every card's
  texture is unique **and** stable across re-renders. All output Map-
  cached dataURLs — generated once, never per frame. Honors
  prefers-reduced-motion. Zero deps added.
- Every view/modal/state rebuilt + screenshot-critiqued: Today (NOW
  statement, instrument bar, dedicated right rail for NEXT UP + SCREEN
  LOG), Plan (tide rail), Dock (berth gauges + manifest + ledger
  library), Logbook (level stack), Review (week banner), palette (block
  caret slab), task form (stamp toggles), end-of-day, focus tunnel
  (phosphor timer), boundary, ticker, help.
- Verify: tests 25/25; build 357.05 kB JS / 18.25 kB CSS, 1.15 s. Full
  keyboard regression drive green (nav, capture grammar, j/k/x/undo,
  [/] reorder persisting, B/W/F, palette, delete). Perf probes: idle
  120 frames max 23.8 ms (nothing regenerates per frame); view-switch
  avg 17.1 ms/frame, only mount frames spike (~53 ms worst); texture
  cold-gen 14.2 ms, cache hit 0 ms, byte-identical across calls.
  Legibility (WCAG): ink-on-amber statements 9.28:1, fg-on-plate
  16.18:1, fg-dim 7.3–7.5:1, semantic colors 7.15–10.53:1; body text
  never sits on raw dither (statement textures confined to edge bands).
- Screenshots of every view taken in final state via the preview pane.

## theme system (session: complete UI shifts)
Two-theme system per the theming mandate. FEATURE_PARITY.md is the
contract (100+ items); THEMING.md documents the anatomy + skeleton.

- Architecture: src/core/ (store/domain/db/ai/enrich/keys/theme — never
  imports presentation; MOD moved into keys.js) vs src/themes/<id>/
  (self-contained; css shipped as ?inline string; exactly ONE theme's
  <style>+App mounted by ThemeRoot). Registry = one import + one array
  entry. werf_theme persists the choice; switching is one React commit.
- Theme 1 "Drydock" = the current UI extracted verbatim: tokens.css/
  texture.js/dither.jsx byte-identical (git R100), views changed only
  in import paths; the single sanctioned addition is the Theme section
  in the Logbook panel. Keyboard install moved to main.jsx.
- Theme 2 "Nightwatch" = the reference ZIP rebuilt properly: harbor
  strip (real clock/watch/ship's bells), draught level gauge, ghost
  numerals, animated horizon (~9fps, reduced-motion + hidden-tab
  aware) with HUD derived from real state, bridge gauges incl. focus
  hours, indexed lineup ledger with +XP, tide rail with Rail/Cards
  toggle, rotary berth gauges, manifest rail, one-click Berth assign,
  full-page Logbook (NEXT RANK, 30-day averages, screen weather).
  Every functional gap in the reference designed in-theme (form,
  tunnel, end-of-watch, review, palette, undo, drag, locks, import…) —
  FEATURE_PARITY.md Appendix B lists them.
- Flagged, not adopted (would change core behavior): reference's `C`
  capture key (stays `N`), its "Sub → attaches to ON DECK" capture
  semantics (Steps keeps real semantics), its 0–8 rollover clamp.
- Zero new dependencies. Zero core behavior changes (git: core files
  untouched since the split except keys.js MOD move).
- Verified: FEATURE_PARITY walked item-by-item in BOTH themes via live
  DOM drives (results in the session log); 6 rapid theme switches with
  byte-identical data; AI degraded path shows the honest no-key toast
  in both; tests 25/25; build clean. Screenshot capture in the preview
  pane was broken this session (pane-side; page fully responsive) —
  visual checks done via computed styles + the byte-identical CSS
  proof for Drydock.

## Mould Loft (theme 3) — built with the werf-theme skill
"loft": the drawing office — Werf's first LIGHT theme (vellum, india
ink, blueprint statements, red pencil). Built from the plan the skill
smoke-test produced. Signatures: the SHEER DRAUGHT on Today (stations
= lineup rows, pencil→ink on completion, waterline = today's XP vs
14-day high), title blocks per view, body-plan SectionGauges on the
drawing register, the ISSUED—DO-NOT-REVISE stamp AS the day-lock
control and the FAIRED stamp AS the launch button (printed elements
are the controls — parity risk #3 guarded). Zero animated canvases;
all texture cached. Verified: full parity drive green (incl. lock
stamp toggle, launch-via-stamp, File under…, honest AI-off toast),
contrast floors on the light ground (fg 14.6:1, dim 7.34:1, statement
7.38:1, faint labels 3.62:1), 6-switch three-theme soak with
byte-identical data, tests 25/25, build clean. Zero core edits, zero
new deps.
