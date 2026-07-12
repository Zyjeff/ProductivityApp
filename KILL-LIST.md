# KILL-LIST — every pattern of the current visual language, with its sentence

Contract for the survivor sweep: after Phase 4, none of these may be
visible in any view or state, and their styles must not exist in code.

| # | Current pattern | Where it lives | Replacement (see DESIGN.md) |
|---|---|---|---|
| 1 | Uniform bordered card: `bg-elev + 1px var(--border) + 12px radius` (`.w-card`) | every view | **Plates**: square, borderless; machined top-light + dithered bottom fade, or corner-tick brackets for quiet modules |
| 2 | Bordered list row `.w-row` (8px radius, hairline) | Today lineup, Library, adrift items | **Ledger rows**: borderless, dotted dither baselines, left status channel, hover dither sweep |
| 3 | Rounded pill buttons (`.w-btn--primary/outline/ghost/launch`) | everywhere | **Switches** (amber block, ink text, single chamfered corner), **bezels** (1px square), **stencil links** (mono uppercase) |
| 4 | Soft amber focus glow ring (`box-shadow: 0 0 0 3px --amber-soft`) | inputs, buttons, capture | **Underline bar focus**: 2px amber bottom bar + label lights up; focus-visible = plotter double-line offset outline |
| 5 | Rounded input fields with border (`.w-input`, `.w-textarea`, `.w-capture`) | forms, capture, palette | **Wells**: sunken squares (darker than plate, inset top edge), amber underline on focus |
| 6 | Tiny uppercase bordered chip `.w-chip` (+ color variants) | tags, badges, deadline chips | **Stamps**: square mono, bezel (1px) or **tape** (solid block, ink text) for semantic urgency |
| 7 | Mono eyebrow labels floating unanchored (`.w-eyebrow`) | every section | **Stencil labels with dither tails** — label anchored by a fading Bayer rule to the plate edge; loud sections get amber tape labels |
| 8 | 5/8/12px radius language | everywhere | Radius **0** everywhere; circles reserved for harbor lights (status/complete dots); statement plates get 10px **chamfers** (clip-path), not rounds |
| 9 | Identical 4-up stat cards grid | Today momentum | **One instrument bar**: single plate, four gauge clusters split by vertical dither dividers, sized by importance |
| 10 | Right column = two more identical cards | Today (Next up, Screen log) | **The Rail**: dedicated sunken right channel (darker ground, vertical dither divider, stencil sections, no card boxes) |
| 11 | NOW card = another bordered card w/ amber border | Today stage | **Inverted statement plate**: solid amber, ink text, dark dither creeping from edges, chamfered — THE loud moment of the screen |
| 12 | Dashed-border empty states (`EmptyState dashed`) | all views | **Dither ghosts**: procedural horizon band + centered stencil caption, no box |
| 13 | Floating top-right toast card | global | **Ticker**: bottom-center square strip, amber lead block, mono text |
| 14 | Modal = centered rounded card on plain dim backdrop | task form, end-of-day, ship log, review, help | **Console plates**: chamfered, tape header bar, dithered backdrop |
| 15 | Sidebar soft-hover rounded nav buttons + progress footer | shell | **Instrument mast**: square glyph slots, active = solid amber block w/ ink icon, dithered divider, level as mini stack |
| 16 | Rounded pill progress bars (`ProgressBar`) | level, plan load, trophies, calibration | **Density meters**: square track, dithered fill ramp (already textured — now square + ramped), tick marks at quarters |
| 17 | Palette = rounded floating search card | Ctrl+K | **Command slab**: square terminal well, amber block caret, ledger results |
| 18 | Soft black drop shadows (`box-shadow: 0 12px 36px…`) | menus, palette, toasts | Shadows die; elevation = tone + texture; menus get 1px edge + dither underskirt |
| 19 | `--accent/--success/--danger/--info/--bg-elev/--bg-soft/--border` legacy token names | tokens + inline styles everywhere | New token set (`--plate/--well/--rail/--amber/--port/--starboard/--channel/--fg…`); legacy names deleted from code |
| 20 | Uniform 14–18px card padding rhythm | everywhere | 8px-grid rhythm: dense in-module (8/12), generous between modules (24/32), asymmetric main-vs-rail |
| 21 | Rounded capture bar with inline mode chip | Today/Dock headers | **Command slab** under the header: full-width well, mode as tape stamp, grammar chips as stamps on the slab's underside |
| 22 | Generic hover = background lighten | rows, buttons, nav | Hover = **dither sweep** (seeded texture slides in) or plate-raise; never a plain lighten alone |
