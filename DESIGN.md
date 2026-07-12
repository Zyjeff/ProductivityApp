# DESIGN — the 1-Bit Harbor system

Werf's second visual language. The first one was the default dark
dashboard every model produces; this one is an **instrument built with
obsessive love, where dithering is the material of the whole product**.
Mental model: a night-harbor control console — machined plates, stencil
labels, phosphor-grain data, tape markings, navigation lights.

## 0. The one-paragraph theory

Dither is tone made of decisions: every pixel is on or off, density does
the rest. The system treats every gradient, glow, elevation, and hover in
the app as a density field. Surfaces are square machined **plates** that
get their depth from a top light and a dithered under-fade — never from
hairline borders or drop shadows. Labels are **stencils** anchored by
dither tails. Emphasis is spent like a budget: each screen gets one or
two **statement plates** (solid amber, ink text, dark dither creeping in
from the edges) and everything else stays quiet so those moments land.

## 1. Tokens

Ground & surfaces (tonal elevation, no border elevation):
```
--ground   #080b10   page
--rail     #05070b   sunken right channel + wells' deepest tone
--plate    #0e1219   module base
--plate-hi #141a28   raised / hover / menus
--well     #0a0e15   input wells (sunken)
--ink      #14100a   text/ink on amber surfaces
--line     #232c3f   the ONLY stroke tone (ticks, bezels, dotted baselines)
--line-dim #161d2b   quiet strokes
```
Light (text):
```
--fg #edeef2 · --fg-dim #98a2b6 · --fg-faint #5a6478
```
Lamps:
```
--amber #f5a524 · --amber-hot #ffc25e · --amber-deep #7a5310
--port #ff6d63 (urgent/overdue) · --starboard #3fd68f (done/launch)
--channel #5b9dff (scheduled/info) · --warn #e8c353 (caution)
soft grounds: --port-ground #2b1512 · --starboard-ground #0e2a1c ·
--channel-ground #131f30 · --warn-ground #292210 · --amber-ground #2b2008
```
Type roles:
```
--t-display  Bricolage Grotesque 700, -0.03em   (titles 28–34, statement numerals)
--t-label    JetBrains Mono 600, 10px, +0.22em, UPPERCASE  (stencils, tapes)
--t-body     Inter 400/500, 13.5px
--t-num      JetBrains Mono 500/600 tabular      (every number in the app)
```
Space: strict 8px grid. In-module 8/12, module gap 24, zone gap 32.
Corners: **0px everywhere**. Chamfer (clip-path, 10px cut) only on
statement plates and switches (single bottom-right cut, 6px). Circles
only for harbor lights (status dots, completion lights).
Motion: 120ms ease-out; hover dither-sweeps via background-position;
all sweeps and canvas entrances disabled under prefers-reduced-motion.

## 2. Texture engine (src/texture.js)

Seeded, cached, one-line to use. Rendered once per parameter set to an
offscreen canvas → dataURL → CSS; never per frame.

```
tex({ seed, algo, w, h, cell=2, fg, bg=null, density | grad:{from,to,dir}, alpha })
edgeTex({ seed, algo, side, depth, fg, cell })          // 1D fade strips, tileable
plateTex(seedString, fg)                                 // per-card identity: hash picks
                                                         // algo + density + drift so no
                                                         // two cards match, stable forever
```
Algorithms: `bayer` (ordered 8×8), `noise` (seeded blue-noise-ish jitter
threshold, tileable via coordinate hashing), `fs` (Floyd–Steinberg error
diffusion — organic ramps; non-tiling, used at generated size only).
Cache: Map keyed by canonical opts JSON (plus seed). React hook `useTex`.

## 3. Component language

**Plate** — the module. Square; `background: --plate`; 1px top inner
light (`--line-dim`); bottom 28px dithered under-fade (edgeTex, seeded by
the plate's identity). Variants:
- `plate--quiet`: no fade; four 1px corner ticks (8px L-brackets).
- `plate--loud`: full-bleed seeded plateTex at 4–7% alpha over the base.
- `plate--statement`: solid `--amber`, `--ink` text, chamfered 10px, dark
  Bayer dither creeping 24–48px from top and bottom edges; max 1–2 per
  screen.
- `plate--hazard`: warn tape header + diagonal dither hazard edge (adrift).

**Stencil** — section label: `--t-label` in `--fg-faint`, followed by a
**dither tail** (edgeTex fading right) that runs to the plate edge.
Loud sections use **tape**: solid amber block, ink text, 3px pad.

**Ledger row** — tasks: no box. 44px, dotted dither baseline
(1px, `--line-dim`), 3px left status channel colored by project/difficulty,
harbor-light completion circle, hover = seeded dither sweep sliding from
the left edge + plate-raise; cursor = amber corner brackets.

**Switch** — primary action: amber block, ink mono-caps text, square with
one 6px chamfer (bottom-right), press = dark dither overlay. Bezel =
1px `--line` square, hover dither fill. Stencil-link = mono caps text,
amber, dotted underline on hover. Icon button = 22px square plate-hi hover.

**Well** — inputs: `--well` bg, inset 1px top shade, square; focus = 2px
amber bottom bar (no glow ring). Capture = the **command slab**: a
full-width well directly under the view header.

**Stamp** — chips: square mono caps; bezel stamps (1px) for tags/meta,
tape stamps (solid) for urgency (deadline warn/port, AI-off, adrift).

**Meter** — progress: square track (`--well`), dithered density-ramp fill
(dense at origin → airier at tip), quarter tick marks; the fill color is
semantic. Replaces every pill bar.

**Ticker** — toast: bottom-center strip, plate-hi, amber lead block with
glyph, mono message, switch-styled undo.

**Console** — modals: chamfered plate, tape header bar (title stencil +
close), body on plain plate (legibility), dithered backdrop (6% Bayer
over 70% black).

## 4. Screens (composed from blank canvas)

**Shell** — left **instrument mast** (176px): brand block with dithered
wave mark; square glyph slots; active slot = solid amber block with ink
glyph + stencil label; bottom: level mini-stack (Lv numeral + density
meter) and key hints. A 12px **dither divider strip** separates the mast
from the deck. Signature: the amber active slot.

**Today** — three zones:
1. Header band: date stencil, display greeting (32px), then the
   **command slab** full-width beneath (capture never fights the title).
2. **Instrument bar**: one plate, four gauge clusters (XP w/ spark ·
   streak w/ week bars · done · lined-up meter) split by vertical dither
   dividers. Density: numerals huge (`--t-num` 26px), labels stencil.
3. Work column + **the Rail**. Work column: brief as **telegram plate**
   (quiet, mono body, tape header, regenerate/dismiss as icon slots);
   **NOW statement plate** (signature of the whole app) with NEXT strip
   bolted under it; adrift as hazard plate; lineup as ledger rows.
   The Rail (300px): sunken `--rail` channel running the full column
   height, separated by a vertical dither strip; NEXT UP and SCREEN LOG
   as stencil sections directly on the channel (no boxes); ready-to-
   launch (when present) sits at the rail top as the rail's single loud
   tape moment.
   Signature: the NOW plate.

**Plan** — the **tide rail**: a left date gutter (56px) with a continuous
vertical dithered tick column; each day is a ledger band to its right
(today = amber date tape). Capacity editor becomes a 7-dial instrument
row on one plate. AI controls dock into a **radio console** slab at the
bottom (ask input + status lamp + switch). Signature: the tide rail.

**Dock** — projects are **berths**: wide plates, left = dithered progress
arc gauge (canvas, cached) sized 56px, right = title display + stamps;
ready berth = starboard statement tape "READY TO LAUNCH". Ship log =
**manifest**: ledger rows with launch stats as stamps, notes in mono.
Library = same ledger language as Today. Signature: the berth gauges.

**Logbook** — right console: **level stack** statement plate (Lv numeral
42px on amber, dithered), then stencil sections: reviews, calibration
(meters), trophies (ledger with tiny meters), screen charts (dithered),
rollover dial, data switches. Signature: the level stack.

**Weekly Review** — console plate with **week banner**: full-width amber
tape title + dither tail; stat quartet as instrument bar; day bars
(dither); effort meters; retro in mono serif-adjacent body. Signature:
the week banner.

**Palette** — **command slab**: square terminal well, `▮` amber block
caret glyph in the prompt row, results as ledger rows, selected = amber
bracket + sweep. Signature: the block caret.

**Focus tunnel** — **phosphor chamber**: dithered vignette walls
(precomputed radial density field), task title display 40px, timer
`--t-num` 96px with amber dither bloom halo (cached canvas), controls as
switches. Signature: the phosphor timer.

**Empty states** — dither ghosts: a low horizon band of FS-dithered
gradient + stencil caption + one switch. No boxes, no dashes.

## 5. Legibility law
Body text never sits on dither denser than 8% alpha without a solid
backing zone; statement plates keep a clean center panel (dither only at
edges); ink-on-amber ≥ 8:1; fg-dim on plate ≥ 4.5:1. Eye candy loses
every tie against this section.

## 6. Anti-generic critique (Phase 1 gate)
- Bordered rounded cards? Dead — plates with machined edges/ticks.
- Single accent glow focus? Dead — underline bars + plotter outlines.
- 4-up equal stat cards? Dead — one instrument bar, weighted clusters.
- Floating toasts top-right? Dead — bottom ticker.
- Would a model given "dark productivity dashboard" produce tape labels
  with dither tails, chamfered amber statement plates with ink dither,
  a sunken rail channel, a tide-rail planner gutter, phosphor timer? No.
  The parts that WOULD have survived (plain mono eyebrows, rounded pills,
  uniform grids) are all on the kill list.
