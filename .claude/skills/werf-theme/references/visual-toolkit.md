# Visual toolkit — textures, charts, CSS, and the budgets

Everything here is hand-rolled: react + react-dom are the only
dependencies, and that's a rule, not an accident. This file covers the
tools both themes use and the budgets that keep the app fast and
readable no matter how loud a theme gets.

## The texture engine (copy it into your theme)

Each theme owns a copy of `texture.js` (~190 lines) so it can tune
recipes freely. The engine is seeded, deterministic, and cached — the
same options object always returns the same data-URL string, instantly
after the first call.

```js
tex({ seed, algo, w, h, cell, fg, bg?, density | grad, alpha })
// → 'url("data:image/png;base64,…")' for backgroundImage
```

- `seed` is identity: `"berth-" + project.id` gives every project a
  unique, stable grain that survives re-renders forever. Seed by entity
  id, never by index.
- `algo`: `"bayer"` (ordered, mechanical), `"noise"` (blue-noise cell
  hash, organic), `"fs"` (Floyd–Steinberg, flowing). Vary algorithm AND
  seed across surfaces so no two loud plates match.
- `grad: {from, to, dir: "down"|"up"|"left"|"right"|"radial"}` makes
  density ramps — the dithered fade is the system's signature move.
- `cell` 2–3 px reads as machined; bigger reads as decorative.

Recipes worth stealing (see either theme's texture.js):
- `edgeTex({side, depth, fg, from})` — a fade strip anchored to one
  edge, tiled along the other axis. The workhorse.
- `statementBg(seed, ink, amber)` — amber plate with ink dither creeping
  from top/bottom edges only. The restraint values (depth ~10–16, from
  ~0.30–0.36) came from a legibility failure: heavier settings ate the
  text. Start there.
- DD `plateTex(seed, color)` — the seed hash picks algo/cell/density/
  direction, so per-entity textures are varied by construction.
- NW `plateFade`, `ghostFill` — under-glow and the ghost-numeral fill.

CSS-side micro-textures (data-URI SVGs in tokens.css `:root`):
`--dither-grain` (body), `--dither-dot` (fills), `--dither-tail`
(label rules), `--dither-vsplit` (column splits), `--dither-baseline`
(row separators), `--hazard` (warning edge). Cheap, cacheable,
resolution-independent — prefer these for repeating hairline texture;
use `tex()` for anything seeded or gradient.

## Charts

Two proven approaches; both live entirely in the theme:

- **Canvas, painted on data change** (DD `dither.jsx`, NW Spark/
  RotaryGauge): draw synchronously in the effect body first, THEN
  animate via rAF if you must — rAF is throttled in occluded tabs and a
  paint that only happens inside rAF renders blank panes. Key the
  effect on `JSON.stringify(data)`.
- **Dithered divs** (NW WeekBars/WeatherBars/CalRow): a `.wb`/`.meter`
  well + an absolutely-positioned fill + a `--dither-dot` overlay via
  `::after`. Zero canvas, themable with pure CSS, right for small bar
  sets and meters.

Whatever you build, keep call sites dumb: components take
`{label, value, title, isToday}`-shaped arrays computed in the view's
memo from core derivations.

## tokens.css conventions

- Start with the fonts `@import` (must be the first rule — the sheet is
  injected as an inline `<style>`). Both themes use Inter + Bricolage
  Grotesque + JetBrains Mono from Google Fonts; reusing them costs no
  new request. A different stack is a legitimate theme statement.
- Define the full token set in `:root`: grounds/surfaces
  (`--ground/--rail/--plate/--plate-hi/--well/--ink`), lines, three text
  levels (`--fg/--fg-dim/--fg-faint`), the semantic lamps
  (`--amber(+hot/deep/ground)`, `--port`, `--starboard`, `--channel`,
  `--warn` + their `-ground` tints), type roles
  (`--t-display/--t-body/--t-mono`), and motion (`--fast`, `--med`).
  Keep the NAMES even if you change every value — `main.jsx`'s crash
  card and muscle memory across themes rely on the vocabulary.
- One sheet is mounted at a time, so class names are yours; still,
  prefix or namespace distinctively enough that grep can attribute a
  class to a theme instantly.
- Include: `::placeholder`, `::selection`, a `prefers-reduced-motion`
  kill-switch for transitions/animations, thin scrollbars, and a
  `:focus-visible` treatment on every interactive class — keyboard-first
  app, visible focus is non-negotiable.
- Media queries: both themes collapse the aux column ≤1080px and shrink
  the nav to icons ≤900px. Match those breakpoints unless your layout
  genuinely differs.

## Performance budget

- Texture generation NEVER happens per frame — `tex()` is called during
  render with cached results (measured: cold ~14ms for a big tile, hit
  0ms). If you add a new generator, cache it in a Map keyed by the
  options.
- At most ONE continuously-animating canvas per theme, and it follows
  the horizon's four rules: low-res + upscale, stepped cadence (~9fps),
  one synchronous first frame, and it stops under `document.hidden` and
  `REDUCED_MOTION`.
- Selector discipline (core-contract §1): raw slices in `useStore`,
  arrays derived in `useMemo`. The store emits on every keystroke in
  some flows; a `.map()` inside a selector re-renders the world.
- Sanity numbers from the shipped themes: idle frames < 25ms worst,
  view-switch mount spikes only, CSS ≤ ~20KB per theme, build stays
  warning-free apart from the known both-themes-in-one-bundle size note.

## Legibility budget (the law)

- Body text never sits on high-contrast dither. Statement plates keep
  texture at the edges (see statementBg's tuned depths); anything
  behind paragraphs stays under ~0.15 density or behind a scrim
  (the horizon HUD's gradient is the pattern).
- Contrast floors that shipped: ink-on-amber ≥ 9:1, body on plates
  ≥ 7:1, 10px stencil/tertiary labels ≥ 3:1. Check yours with a
  quick computed-style probe if you change the palette.
- Loudness is a budget per view: one statement plate, one signature,
  everything else tonal. Infrastructure (meters, separators, gauges of
  record) stays small and quiet — a full-width per-day meter in the
  Plan view was the first thing a real user asked to shrink.
- Every state color also carries a non-color signal (icon, label, or
  position); the lamps are legible in grayscale.

## Verifying visuals without trusting your eyes

From the browser console of the running app:

```js
// contrast of two tokens
const css = getComputedStyle(document.documentElement);
const L = c => { const [r,g,b] = c.match(/\d+/g).map(Number);
  const f = v => { v/=255; return v<=.03928 ? v/12.92 : ((v+.055)/1.055)**2.4 };
  return .2126*f(r)+.7152*f(g)+.0722*f(b); };
// idle-frame sampler: collect rAF deltas for ~2s and eyeball the max
```

And the two structural greps that catch budget violations early:
`grep -rn "requestAnimationFrame" src/themes/<id>/` (should list only
your one animated canvas and chart entrances) and
`grep -rn "toDataURL" src/themes/<id>/` (should appear only inside the
cached engine).
