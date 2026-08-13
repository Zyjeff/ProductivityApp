# Installing Kaze

Kaze is a Werf theme: one self-contained folder plus one import and one
array entry. It touches nothing in `src/core/`.

## Already installed

If you're looking at the checkout I built it in, it's already wired up:

```
C:\Users\eyadk\Desktop\ProductivityApp\
```

Run it and pick Kaze from Travel Journal → "The road out":

```bash
cd "C:/Users/eyadk/Desktop/ProductivityApp" && npm run dev
```

## Installing into a different checkout

**1.** Copy this whole folder to `src/themes/kaze/` (drop `INSTALL.md`
— it isn't part of the theme).

**2.** In `src/themes/registry.js`, add one import and one array entry:

```js
import kaze from "./kaze/index.js";

export const THEMES = [drydock, nightwatch, loft, sluis, kuromi, relay, apogee, kaze];
```

That's the entire installation. No core edits, no new dependencies —
the app still ships react + react-dom only.

## What's in here

| File | What it is |
|---|---|
| `index.js` | the theme definition (`id`, `name`, `tagline`, `App`, `css`) |
| `tokens.css` | the whole stylesheet, including the five clock phases |
| `app.jsx` | the shell: the Guiding Wind (nav + instrument) and every overlay surface |
| `wind.jsx` | the signature animated ribbon |
| `texture.js` | washi / sumi / gold-leaf engine, seeded and cached |
| `components.jsx` | charms, seals, blossoms, petals |
| `charts.jsx` | ink trace, torii progress, knots, incense |
| `capture.jsx` | Traveller's notes |
| `taskrow.jsx` | the waypoint stone + chunk editor |
| `taskform.jsx` | the long form |
| `views/today.jsx` | Today's Path |
| `views/plan.jsx` | The Shrine Map |
| `views/dock.jsx` | The Satchel |
| `views/focus.jsx` | Meditation |
| `views/palette.jsx` | Ask the wind |
| `views/logbook.jsx` | Travel Journal (the horizontal hand-scroll) |
| `views/endofday.jsx` | The Campfire |
| `views/review.jsx` | The Hot Spring |
| `DESIGN.md` | the fiction, the vocabulary, the departures, the budgets |
| `FLAGS.md` | CONFIRM items resolved + the one real core feature request |

## Fonts

`tokens.css` opens with a Google Fonts `@import` (Shippori Mincho, Zen
Kaku Gothic New, Kode Mono) — the same pattern every shipped theme uses.
Offline, the stack falls back to Georgia / system-ui / ui-monospace and
the layout is unaffected.
