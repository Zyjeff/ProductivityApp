# Verdant

A little enchantment. A clearer mind.

Verdant is a complete presentation for Werf's existing productivity core. It turns the workspace into a quiet enchanted study: mineral surfaces, acid-green light, off-white inscriptions, and a small faceted focus stone. The reference images informed the mood; their layouts and assets are not used.

## Screen architecture

| Surface | Composition | Real data driving the visual |
| --- | --- | --- |
| Shell | Horizontal navigation, branded command launcher, bottom progress band | Current view, level, XP, streak, AI state |
| Sanctum / Today | Focus stone beside the capture field and task ledger; activity instruments below | First pending task, next task, completion fraction, time focused, daily activity |
| Almanac / Plan | Weeks of upright day cards; separate capacity and AI workbenches | Capacity, recurring reserve, scheduled hours, locks, chunks |
| Collections / Dock | Glyph-sealed project cards that open a full-width workbench; completed collection archive | Stable project ID, completion percentage, children, frozen launch record |
| Codex / Logbook | Overview, Relics, Screen log, Settings chapters | Level progress, calibration, all 16 achievements, screen history, backups |
| Focus | Full-screen etched timer with only the current action and next task | Accumulated focus, live timer, pause state, task context |
| Task form | Large right-hand inscription sheet | Every original task field, steps, project membership, schedule and deadline |
| Day close / Review | A compact day receipt and a wider weekly journal | Completed work, roll-forward, XP, sessions, project effort, cached reflection |

## Materials and interaction

- Original SVG pixel crystal and eight authored geometric glyphs. No game assets, reference-image crops, bitmap dependencies, or external fonts.
- Cached procedural surface grain; subdued etching around the workspace's most important object.
- Segmented progress, illuminated completion states, live capture chips, tactile button feedback, and drag feedback.
- A gently floating crystal, pointer tilt, slow rune orbit, small rising square particles, and pixel confetti on earned milestones.
- Ambient motion can be toggled on the focus stone. System reduced-motion preference disables animation; continuous seal motion pauses in hidden tabs.
- Keyboard controls retain the original bindings. Dialogs trap Tab focus, restore prior focus, and expose accessible labels. Primary views and the form adapt to narrow screens.
- No extra currency or invented progression. Existing XP, level names, achievement names, and completion semantics remain the source of truth.

## Integration

Theme ID: `verdant`.

All implementation is inside `src/themes/verdant/`; registration adds one import and one array entry in `src/themes/registry.js`. Existing core files, package manifests, lockfile, other themes, and the API proxy are unchanged. There are no cross-theme imports. Proven task/store wiring and the cached texture machinery were adapted into this folder, then the screen compositions were rebuilt.

`index.js` exposes the theme contract. `app.jsx` owns the shell, branded error recovery, overlay focus handling, and global feedback. `art.jsx` owns glyphs, crystal, rune rings, and segment meters. `tokens.css` owns the visual system and responsive behavior. `capture.jsx`, `taskrow.jsx`, `taskform.jsx`, and `views/` connect the new presentation to the shared domain and store APIs.

The theme picker remains in Codex → Settings. Verdant changes the document title, favicon, and theme color while mounted and restores them when switching away.

The optional root-level `verdant-preview.html` is a development preview entrance. It selects Verdant and uses the core's existing sample-workspace snapshot/restore flow. It is not a separate persistence implementation and is not an additional production build entry.
