---
name: werf-theme
description: >-
  Build, extend, or debug a Werf theme — a complete, self-contained UI
  replacement for the quest-next app (layouts, components, visuals,
  animations, and unique per-theme extras), on top of the untouchable
  functional core. Use this skill whenever the user wants a new theme, a new
  skin, a restyle, a "different look", a visual overhaul, a variant of
  Drydock or Nightwatch, wants to change how a Werf view is composed, asks
  why a theme is missing a feature, or mentions FEATURE_PARITY.md /
  THEMING.md / the theme registry — even if they never say the word "theme".
  Also use it when adding a signature visual (like Nightwatch's horizon or
  bridge gauges) to an existing theme.
---

# Building Werf themes

Werf is one functional core with swappable presentation. A theme is not a
color-and-font swap — it may replace every layout, component, chart,
animation, and interaction surface, and add its own UI-level inventions.
The one thing it may never change is what the app can do. That single rule
generates everything else in this skill.

Two themes ship today and double as reference implementations:

- **Drydock** (`src/themes/drydock/`) — the working yard. Machined plates,
  ledger rows, canvas dither charts, a slide-over Logbook panel.
- **Nightwatch** (`src/themes/nightwatch/`) — the yard after dark. Harbor
  strip with real ship's bells, an animated horizon, a draught level gauge,
  rotary berth gauges, a full-page Logbook.

They answer almost every "how do I…" by example: same capability, two
completely different presentations. When in doubt, open the matching file
in each and compare.

## The three documents that govern a theme

1. `FEATURE_PARITY.md` (repo root) — the contract. 100+ numbered
   capabilities (G/K/C/T/P/D/F/X/L/S/E/R/A/M/DATA). Every theme ships all
   of them. Read it before designing; walk it after building.
2. `THEMING.md` (repo root) — the short architectural map for humans.
3. This skill — the deep version, with the workflow and the reference
   files below.

## Architecture in one breath

`src/core/` = store, domain, db, ai, enrich, keys, theme. Core never
imports presentation. `src/themes/<id>/` = one self-contained folder per
theme; its `index.js` default-exports `{ id, name, tagline, App, css }`
where `css` comes from `import css from "./tokens.css?inline"`.
`src/themes/registry.js` lists installed themes — adding one is a folder
plus one import and one array entry, zero core edits. `main.jsx` mounts
exactly ONE theme's `<style>` + `<App/>`; the choice persists in
localStorage `werf_theme`; switching is a single React commit with zero
data impact. Because only one stylesheet is ever mounted, themes name CSS
classes freely and never collide.

## Hard rules (each exists for a reason)

- **Parity is law.** If your design has no obvious home for a capability,
  design one in your theme's language. Dropping it is the one forbidden
  move — users switch themes, their muscle memory and data don't.
- **Never edit `src/core/`** while building a theme. If an idea seems to
  need a core change, it's a feature request, not a theme; flag it and
  keep building. (This has come up: the Nightwatch reference wanted a `C`
  capture key and different capture semantics — both were flagged and NOT
  adopted, because keybindings and semantics are core behavior.)
- **Themes never import each other.** Copy shared-looking code (like the
  texture engine) into your theme instead — the whole point of a theme
  folder is that it can evolve or be deleted without touching anything
  else.
- **No new npm dependencies.** The app ships react + react-dom only.
  Everything visual is hand-rolled (canvas, SVG data-URIs, CSS). If a
  dependency seems genuinely necessary, stop and flag it.
- **Display keyboard bindings, never rebind them.** Keys live in
  `core/keys.js`; a theme renders hints (`SHORTCUT_ROWS`, `MOD`).

## The build workflow

Work through these steps in order; each has a reference file with the
depth.

**1. Absorb the contract.** Read `FEATURE_PARITY.md` end to end, then
`references/core-contract.md` — the exact API surface a theme consumes
(state shape, every action, the keyboard wiring, AI functions, derived
data). Do not skip this; most theme bugs are a missed wiring call, not a
CSS problem.

**2. Name the world.** A Werf theme is a coherent fiction, not a
stylesheet. Drydock is a working shipyard by day; Nightwatch is watches,
bells, and a moonlit horizon. Pick the fiction first — it decides your
palette, your copy ("Scuttle" vs "Delete", "Stow" vs "Add"), your
signature visuals, and your empty-state lines. Renaming button labels and
flavor copy is fair game; renaming capabilities is not.

**3. Scaffold.** Create `src/themes/<id>/` with `index.js`, `tokens.css`,
`app.jsx`, `views/`. Copy the texture engine from an existing theme and
tune its recipes to your fiction. Register the theme in `registry.js`
immediately so you can iterate live via the in-app picker (Logbook →
Theme).

**4. Build the shell first** (`app.jsx`): navigation for the three views +
Logbook, and a rendered surface for EVERY `ui` overlay state — form,
logbook, palette, help, focus tunnel, review, end-of-day, launch note,
toast (with Undo), level-up, confetti, preview and cross-tab banners. The
Esc cascade and number keys in core assume these exist; a missing surface
is an invisible dead key.

**5. Build views in this order:** capture → Today → Plan → Dock → form →
tunnel → palette → Logbook → end-of-day → review. Today is the hardest
and teaches you the row/cursor wiring everything else reuses. For each
view, `references/parity-walkthrough.md` lists what must be wired and the
traps (registerActiveList, setCaptureFocus, chunk-aware completion,
cursor index offsets when a view stacks two lists).

**6. Promote signature visuals.** This is what separates a theme from a
reskin: each view gets one invented centerpiece derived from REAL app
data. Nightwatch's Today is the canonical example — an animated horizon
whose HUD reads live state (tide = today's XP, swell = adrift count,
visibility = streak), a harbor strip computed from the actual clock, a
Focus gauge derived from the session ledger. The full pattern — how to
find candidates, derive honestly, and stay within the performance and
legibility budget — is in `references/worked-examples.md`.

**7. Wire the theme picker** into your settings surface (`THEMES` from
`../registry.js`, `useThemeId`/`setThemeId` from `core/theme.js`). Every
theme must offer the way out of itself.

**8. Verify like a skeptic.** `npm test` (25 core tests) and
`npm run build` are table stakes. The real gate is the parity walk: drive
every FEATURE_PARITY item in the running app — keyboard first, then
mouse — and the theme-switch soak (switch back and forth repeatedly;
data in localStorage must stay byte-identical, exactly one `<style>` tag
mounted). `references/parity-walkthrough.md` ends with the drive script
patterns used to verify Drydock and Nightwatch.

## Reference files

- `references/core-contract.md` — the complete core API a theme consumes:
  state slices and `ui` fields, every store action with semantics, the
  keyboard layer's two mandatory hooks, AI + enrichment functions and
  their honest-degradation requirements, domain derivations and
  constants. Read during step 1; keep open while wiring views.
- `references/parity-walkthrough.md` — FEATURE_PARITY section by section:
  what each item means in practice, where each theme implements it, the
  known traps, and verification drive patterns. Read per-view during
  step 5 and fully during step 8.
- `references/worked-examples.md` — Drydock and Nightwatch dissected file
  by file, then the signature-visual promotion pattern (Nightwatch Today
  as the case study) and the naming/fiction craft. Read during steps 2
  and 6.
- `references/visual-toolkit.md` — the texture engine API and recipes,
  canvas chart patterns, CSS conventions (tokens, tonal elevation,
  data-URI micro-textures, fonts, focus-visible, reduced-motion), and the
  performance + legibility budgets. Read during steps 3 and 6.

## Fast answers

- **Add a theme:** folder under `src/themes/`, default-export
  `{ id, name, tagline, App, css }`, one import + one entry in
  `registry.js`. First registry entry is the fallback default.
- **Test it live:** `npm run dev`, open the app, Logbook → Theme picker.
  Switching is instant; your data is never at risk (state lives in the
  core, not the theme).
- **A key does nothing in my theme:** you forgot `registerActiveList` (row
  keys), `setCaptureFocus` (the `n` key), or a surface for the `ui` flag
  the key sets (overlay keys).
- **My chart/texture janks:** you're generating per frame. Textures are
  cached data-URLs generated once per parameter set; canvases paint on
  data change, never in a rAF loop (the horizon is the one exception and
  it steps at ~9fps, pauses when hidden, and respects reduced-motion).
- **Where do theme-only stats come from?** Derive from existing data
  (`sessions`, `plan`, `screen`, `xpEvents`) — never store new numbers.
  If it can't be derived, it doesn't belong in a theme.
