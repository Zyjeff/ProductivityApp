# Yoizakura — FLAGS (core feature requests, not built)

Theme work stays inside `src/themes/yoizakura/` (+ the registry entry). Anything that would change `src/core/` is listed here and **not** implemented.

## Flagged (not built)

1. **Rich-text task descriptions.** The house’s reason for a persistent paper pane is quick access to the description. The pane ships a **plain-text** click-to-edit field (`updateTask` on blur / ⌘Enter), same op the writing desk uses. A formatted/markdown description would need a core field (or a documented HTML/markdown contract) and would change every theme. Not a theme job.

2. **Dedicated Inbox key in `dockFilter`.** Inbox is `project: "__none__"` (Berth-pattern sentinel in `nav.js`). Core has no “no list” filter key; adding one would be a core schema change. The sentinel works.

3. **`1 / 2 / 3` closing Records.** Core only toggles `view` on those keys; `statsOpen` stays until `4` / Esc. The index buttons clear `statsOpen`. Changing the number keys would rebind core keyboard behavior — flagged, not adopted (same class of request Nightwatch declined for `C` capture).

4. **Task-sheet on the Esc cascade.** Core Esc is palette → review → help → form → end-of-day → stats → cursor. The paper-pane task sheet is theme-local (`PaneProvider`). Closing it is the pane’s × (returns the garden). Putting the sheet on the core cascade would be a core change; the writing desk already occupies the form slot, so Esc-from-desk does not double-close.

5. **Cap-0 empty days omitted from Plan.** FEATURE_PARITY P3 says skip cap-0 empty days. DESIGN.md §5.2 requires the shoji wall to show the true week (dim “resting” panes). Followed DESIGN. Making skip-vs-show a core plan-shape would affect every theme; here it is a presentation choice.

6. **Photo-import without a file picker round-trip.** D13 is wired (`aiImportFromScreenshot` → preview toggles → Import N). AI-off uses core’s deterministic scores. There is no core hook to inject a fake image for automated verification; live check is the button + honest failure/preview path.

No new npm dependencies. No `localStorage` in theme source. No XP arithmetic beyond display.
