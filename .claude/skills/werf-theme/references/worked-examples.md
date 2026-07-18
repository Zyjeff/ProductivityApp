# Worked examples — Drydock and Nightwatch, dissected

Same contract, two different worlds. Diff any pair of same-named files
across the two themes to see exactly where the freedom is: the handler
code and data flow are near-identical, everything around them changes.

## File maps

### Drydock (`src/themes/drydock/`) — the original UI, extracted intact

```
index.js        { id:"drydock", name:"Drydock", … }
tokens.css      "1-Bit Harbor" system: w-* classes; tonal elevation
                (ground/rail/plate/well), stencil labels + dither tails,
                amber tapes, chamfered statement plates, w-switch/w-bezel
                controls, w-mast nav, w-ticker toast, w-console modals
texture.js      seeded dither engine (bayer/noise/fs), Map-cached
dither.jsx      canvas charts: DitherSparkline/Bars/StackedBars/Arc —
                synchronous first paint + rAF entrance, reduced-motion
components.jsx  Icon set, Chip/stamps, harbor-light CompleteButton,
                ProgressBar (w-meter), Eyebrow, EmptyState+GhostHorizon,
                Kbd, PageHeader, Confetti, AiDot
capture.jsx     command slab with a mode DROPDOWN + grammar chip strip
taskrow.jsx     w-ledger-row: lamp channel, cursor bracket, expand well
taskform.jsx    w-console modal; ChipChoice stamp-toggles
app.jsx         mast shell; slide-over StatsPanel is the settings home
views/          today (instrument bar + NOW statement + rail column),
                plan (tide rail, 66px date gutter), dock (berth plates +
                DitherArc gauges, Projects/Library tabs), stats
                (slide-over logbook), review, palette (w-slab), endofday,
                focus (phosphor timer)
```

Drydock's role as an example: it is the reference for *restraint* — the
legibility law (body text never sits on loud dither; statement textures
confined to edge bands), the tonal-elevation system with zero borders/
shadows, and chart rendering through one cached engine.

### Nightwatch (`src/themes/nightwatch/`) — rebuilt from an external design

```
index.js        { id:"nightwatch", … }
tokens.css      reference-derived sheet EXTENDED with everything the
                reference lacked (console/backdrop/field/tunnel/…)
texture.js      the engine, copied + retuned (plateFade, ghostFill,
                reference-strength statementBg)
charts.jsx      Spark (canvas), RotaryGauge (canvas ring of cells),
                WeekBars / WeatherBars (dithered DIVs), CalRow meters
chrome.jsx      THE SIGNATURE FILE: HarborStrip (bells()), GhostNumeral,
                Horizon (animated canvas + HUD)
components.jsx  same roles as DD, different vocabulary (Stamp/StampPick,
                HLight, Lamp, GhostFoot)
capture.jsx     slab with INLINE type toggles + block caret
taskrow.jsx     lrow with index numerals and per-row +XP readout
taskform.jsx    console chassis, stamp-pick choosers, "Give it a berth"
app.jsx         mast with draught gauge + coords; HarborStrip mounted
                above the deck with per-view context cells
views/          today (horizon + bridge), plan (tide rail w/ tick ruler,
                Rail/Cards modes), dock (rotary berth gauges + manifest
                rail + Berth quick-assign), logbook (FULL PAGE),
                review, palette ("Issue a command…"), endofday
                ("End of watch"), focus (tunnel with a horizon at the
                foot)
```

Nightwatch's role as an example: it is the reference for *reach* — a
layout that departs completely (Logbook becomes a page; Dock gains a
manifest rail), invented chrome, and new affordances over existing
operations (Berth = `updateTask` with `projectIdChanged`).

Nightwatch also demonstrates the boundary: its source demo wanted a `C`
capture key, "Sub attaches to the on-deck task" semantics, and a 0–8
rollover clamp. All three were functional changes, so all three were
flagged in FEATURE_PARITY.md Appendix A and NOT built. When your design
reference and the core disagree, core wins and the disagreement gets
written down.

## The signature-visual promotion pattern

A theme earns its name by promoting one invented centerpiece per view —
derived from real data, costing nothing at runtime, legible under it.
Case study — **Nightwatch's Today**:

1. **Find the dead air.** Drydock's Today header is type + numbers. The
   space between the greeting and the capture bar could carry the
   theme's fiction.
2. **Pick a visual with a data spine.** A night seascape (the horizon)
   is pure fiction — until its HUD reads live state:
   - `TIDE` → today's XP (`FLOOD +145XP` / `SLACK`)
   - `HW` → the next planned day (`fmtIsoShort(upcoming.date)`)
   - `SWELL` → adrift count · `VIS` → streak (`3D CLEAR` / `FOG`)
   The joke lands *because* the numbers are real. Same move in the
   harbor strip: watch names and bells are computed from the actual
   clock (`bells()` in chrome.jsx — 4-hour watches, a bell per half
   hour), and the strip's context cells read pending counts, weekly
   capacity, berth counts.
3. **Promote data the base theme under-uses.** The bridge adds a Focus
   gauge — hours focused today from `focusMsByDay(sessions)`, a slice
   the session ledger already had. New stat, zero new state. Same with
   the Logbook's "30-day averages" and NEXT-RANK line (pure functions of
   `xpEvents`/`LEVEL_THRESHOLDS`).
4. **Respect the budgets.** The horizon is the only per-frame drawing in
   the app, so it pays rent: low-res cells upscaled, stepped at ~9fps
   (not smooth — the step IS the aesthetic), paints one frame
   synchronously, skips when `document.hidden`, static under
   `prefers-reduced-motion`. Everything else (ghost numerals, plate
   fades, statement plates) is a cached data-URL generated once.
5. **Keep the text safe.** HUD text sits on a gradient scrim; statement
   plates keep dither at the edges; the ghost numeral is background-clip
   text at faint density behind the header, never under body copy.

To invent your own: scan the state shapes in core-contract §8 and ask
"what does no view currently show?" — per-tag effort, capture→completion
latency, chunk-splitting habits, weekday activity fingerprints are all
derivable today. If it needs new stored data, it's not a theme feature.

## Naming and fiction craft

- The id is a slug forever (`werf_theme` values in users' storage);
  the display name carries the fiction. Werf is a Dutch solo shipyard —
  good names live in that world.
- Flavor copy may rename ACTIONS' labels, not capabilities: Nightwatch
  says Scuttle/Stow/Refit/"Give it a berth"/"End of watch" for
  delete/add/edit/promote/close-day. The palette still finds them
  because command labels come from core; your view labels are the
  costume. Empty states are prime fiction real estate ("nothing moored",
  "REST — the yard is closed.", "calm waters beyond").
- Tone budget: one signature per view. Nightwatch's Plan gets the tick
  ruler and the amber TODAY block — its load meters stay small and
  quiet (a user asked for exactly that within a day of shipping: the
  full-width meter was "long and distracting". Loud infrastructure
  reads as noise; loud *centerpieces* read as character).
