# Kaze (風) — the wind guides you

A traveller's road through Tsushima-inspired country. The app is not a
workplace, it is a road: tasks are waypoints, the day is a path, and the
wind shows you where to go next. The register is *mono no aware* —
things bloom, things fall, you keep walking.

This is a **personal** theme. The copy never says work, sprint, shift or
yard. It says intentions, errands, rituals, the road.

## Vocabulary (labels only — no capability is renamed)

| Core concept | Kaze |
|---|---|
| Capture / inbox | Traveller's notes |
| Today | Today's Path |
| Plan | The Shrine Map |
| Dock / backlog | The Satchel |
| Delete | Scatter (petals fall) |
| Adrift | Weathered |
| Focus tunnel | Meditation |
| End of day | The Campfire |
| Review | The Hot Spring |
| Logbook | Travel Journal |
| XP | Resolve |
| Streak | Wind at your back |
| Level-up | A new charm (omamori) |
| Confetti | Petal burst |

Level names, trophy titles and difficulty tones are app identity and are
displayed verbatim from `core/domain.js`.

## The departures — what no other theme does

The original plan was written believing only Drydock and Nightwatch
existed. Seven themes ship, so the list was re-derived against all of
them. Two of the plan's departures were void and were replaced.

1. **Navigation IS the signature instrument.** The Guiding Wind ribbon
   runs across the top of every view and the waypoint markers ride on
   it. Its petals, steadiness and warmth are live readings of real
   state; the thing you click and the thing that reports are one object.
   *(The plan's "torii top-frame nav" was void: kuromi and relay already
   use top bars, and apogee already puts nav on a frame edge. No theme
   fuses nav with its data visual.)*
2. **The Travel Journal is a horizontal hand-scroll** (emakimono) that
   unrolls between two rods, five numbered panels wide. Shipped
   alternatives are a slide-over panel, four full-page overlays, a
   bottom sheet and an in-stage tile wall — none horizontal.
3. **Today's lineup is laid *along* the road.** The rows are the
   stations; the ink stroke runs through them. This is the condition the
   plan set: Mould Loft already draws "stations" in its Sheer Draught,
   so a path drawn *above* a ledger would have converged on it. The path
   replaces the ledger instead.
4. **The Shrine Map is a route**, days as torii gates strung along one
   inked road, each gate inking itself in as its work completes.
5. **The Satchel is objects on cloth** — rolled scrolls tied with cord,
   grouped into provinces. Progress is read off cord knots.
6. **Charm / incense / wind instrument language.** No rotary gauges, no
   arcs, no rings, no dither bars, no level gauge — that vocabulary
   belongs to the other themes.
7. **The whole palette tracks the real clock** — dawn → day → golden →
   dusk → night, stamped as `data-kz-phase` on `<html>`. No other theme
   varies its palette with time. *(This replaced the plan's "sectioned
   Today", which is not a departure at all: `registerActiveList` makes
   adrift-then-lineup the mandated order, and all seven themes have it.)*

## Signature visuals — all derived, nothing stored

| Visual | Derivation |
|---|---|
| Guiding Wind ribbon | petal count = adrift (`getMissedWork`), steadiness = `streak`, lift = today's completed share of the plan entry, warmth = the real clock |
| Resolve charm | `sel.level.pct` and `todayXP` |
| Incense stick (Meditation) | live elapsed ÷ `taskHours(task)` — the true session timer |
| Torii progress (Shrine Map) | done chunks ÷ total chunks per day |
| Ink trace | 7-day XP from `xpByDay` |
| Campfire haiku | real completions, resolve and walked time |

## Budgets

- One animated canvas (`wind.jsx`): low-res buffer upscaled, stepped at
  ~9fps, one synchronous first frame, stops under `document.hidden` and
  `prefers-reduced-motion`. Verified: exactly one `requestAnimationFrame`
  in the theme, and `toDataURL` appears only inside the cached engine.
- Contrast, measured in all five phases (not eyeballed): ink-on-amber
  9.69–10.58, ink-on-leaf 9.32–9.77, body-on-plate 12.06–13.41,
  dim-on-plate 7.05–7.51, faint-on-plate 3.50–3.81. All clear the
  toolkit floors of 9 / 7 / 3.
- CSS ~38KB — mid-range of the shipped themes (25–44KB).
