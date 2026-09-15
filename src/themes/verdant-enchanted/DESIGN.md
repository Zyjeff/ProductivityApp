# Verdant Enchanted

An obsidian enchantment desk for real work. White spectral inscriptions surround an emerald focus crystal; projects become illustrated pixel grimoires. The composition, artwork, navigation, controls and typography were rebuilt for this version. The supplied references informed atmosphere and materials; none of their pixels, layouts or assets were copied.

## Separate identities

- **Verdant Legacy** retains the approved first version. Its ID remains `verdant`, preserving the saved theme preference. Only its picker display name changed.
- **Verdant Enchanted** lives in its own self-contained folder with ID `verdant-enchanted`. It imports no other theme. Both are selectable in Chronicle → Settings.

## Composition and real data

| Surface | New presentation | Existing data and actions |
| --- | --- | --- |
| Shell | Crest and inventory status above a five-slot pixel hotbar | Level, lifetime XP, streak, four destinations and command palette |
| Sanctum | Wide illustrated altar, inscription line, full-width task-card board, day journal | Current/next task, chunk-aware completion, capture, overdue triage, brief, daily statistics and screen logging |
| Focus | A pixel clock above an isometric obsidian summoning floor | Real elapsed time, focus ledger, pause/reset, complete/advance and skip |
| Atlas | Selectable week folio with upright schedule columns and a spectral date ribbon | Rolling horizon, capacities, recurring reserve, locks, task chunks and AI planning |
| Grimoires | Illustrated books open into two-column task leaves; completed books have an archive | Full project lifecycle, descriptions, colors, task assignment, AI task generation and completion journal |
| Chronicle | Chapter rail, character seal and an inventory of pixel artifacts | Actual level, 30-day averages, calibration, all 16 achievements, screen history and settings |
| Inscription form | Two facing pages for prose and scheduling traits | Every task field, tags, pending steps, score behavior, split chunks and project promotion |
| Day sealing | A narrow closing receipt with a pixel hourglass | Recap, unfinished work roll-forward, screen capture and reopen |
| Reflection | Two-page chronicle: record on the left, perspective on the right | Weekly work, XP, focused time, completed projects, effort allocation and cached AI retro |

Altar sockets illuminate from today's completion fraction. Book leaves and clasps show project completion. The character seal uses real level progress. None of the new artwork introduces a second currency, fake rewards or separate game state.

## Art and interaction language

- Original hand-authored 5×7 pixel heading alphabet, 8×8 icons, faceted crystal, books, quills, crowns, flames, hourglasses and relics.
- Original deterministic 128×128 obsidian tile material, layered below quiet blue-black surfaces.
- White geometric rune circuits and a voxel plinth; neon emerald for selected states, completion and primary actions.
- Readable system body fonts and restrained serif task/section titles. Pixel type stays in titles, clocks and short labels.
- Stepped button presses, traced card corners, rune checkboxes, completion bursts, capture flashes, opening-book feedback, crystal pointer tilt and slow floating inscriptions.
- Ambient-motion toggle, hidden-tab pausing, system reduced motion, focus outlines, dialog focus containment and responsive pages.

## Implementation boundary

The original core, shortcuts, dependencies, entry point, build configuration, AI proxy and persistence remain unchanged. The registry adds two independent theme entries. Optional development HTML entrances activate the existing isolated sample-workspace mechanism; leaving preview restores the previous workspace on that origin. Presentation copy says “seal grimoire” for the existing project-completion action. Internal schema and achievement IDs are unchanged.

The screenshot gallery shows the running app with its official sample data. Fonts and art require no downloads. See VERIFICATION.md for the exercised workflows and limits.
