# Verdant Enchanted verification

Validated on 15 September 2026 against ProductivityApp commit `5471ed4b043261ac07adc49c3b469907d764aaee`.

## Results

- Production Vite build: passed.
- Repository core tests: **25 passed, 0 failed**.
- Browser workflow groups: **35 passed** (22 main, 11 extended, 2 recovery/help).
- Unexpected browser page errors: **0**.
- Visual review: 1440 × 1120 desktop and 390 × 844 mobile, screenshots of the running sample workspace.
- Theme-switch soak: all **13** themes, three cycles; exactly one mounted stylesheet and byte-identical persisted `werf_*` values, excluding the selected theme preference.
- Verified original core, dependency manifest, and lockfile are unchanged.

Browser validation used isolated headless Microsoft Edge contexts and the actual Vite app. Test fixtures were created through core actions. Browser screenshots are actual UI captures. The intentional crash test is the only expected render exception.

## Feature coverage

The repository's `FEATURE_PARITY.md` was used as the implementation inventory. This table distinguishes exercised workflows from the unchanged domain/persistence logic they rely on; a passing group does not imply every possible data permutation was tested.

| Contract | Validation |
| --- | --- |
| G1–G10 | Visible and numbered navigation; persistent progress surfaces; AI state; signed feedback and undo; project milestone feedback; sample restoration; real cross-tab storage event; help and Escape cascade |
| G11 | Deliberately caused a render exception; verified branded recovery and Reload; persisted task data remained identical |
| K1–K10 | Palette from inputs; suppression while editing; number navigation; capture/form fallback; brief/review/help; cursor completion/edit/delete/undo; focus; persisted bracket and drag reorder |
| C1–C7 | Local task capture and inline priority/tag/time/date grammar; full form entry; Steps and Project no-key fallbacks; grammar-preserving captures. Additional date and unmatched-token behavior covered by core tests |
| T1–T16 | Empty and populated screens reviewed; real focus task and metrics; brief facts and toggling; generated suggested order; overdue offset-cursor actions; subtask/chunk edits; energy order; review prompt; day close/reopen; next-day/ready-project surfaces; screen counters and mobile hours |
| P1–P9 | Capacity editing; rolling weeks and horizon extension; locked-drop rejection; move/complete/reopen/unschedule/undo chunks; no-key planner/replan behavior; mocked schedule success and unmapped replan; overdue notice |
| D1–D13 | Create, type filtering, workbench selection, description, color, child task, completion, launch note, completed archive, unlaunch, delete/undo; AI child creation and delayed launch-note protection; library filtering/search/cursor; screenshot import selection and grouped import |
| F1–F7 | Create/edit, field persistence, uncommitted tags/steps, keyboard submit, schedule changes, project membership, split chunk edits, promote-to-project and undo. Shared score curve covered by core tests |
| X1–X6 | Focus entry, timer pause/resume/reset, accumulated time, persisted session of at least one minute, skip, complete/advance, exit and context |
| L1–L5 | Commands, original-label aliases, task search, grammar quick add, cursor actions, keyboard navigation |
| S1–S8 | Chronicle chapters; level/summary/calibration surfaces; all 16 achievement cards and real progress; screen history; rollover range; theme picker; backup/export/import/preview controls |
| E1–E5 | Day recap, unfinished roll-forward, screen capture, close and reopen |
| R1–R4 | Empty and populated weekly review, navigation and stats, AI-off fallback; cached review behavior retained through existing core actions |
| A1–A3 | All requests still use the existing proxy. Actual no-key response tested; selected successful brief/planning/project/note/image responses mocked. Typed transport/error handling remains in the unchanged core |
| M1–M6 | Completion-derived displays and real project/level feedback exercised. Core tests cover ledger allocation, split XP, recurrence, streak, score curve, migration baseline, sorting and calibration; all individual achievement unlock thresholds were not separately replayed |
| DATA1–DATA6 | Reload persistence, exact preview restore, export/merge import, rollover, cross-tab banner, and theme-switch preservation exercised. Migration, merge, schema validation, backup and effective-date logic also covered by core tests/source audit |

## Interaction and visual checks

- All four primary screens at 390px: no horizontal document overflow. The Atlas intentionally scrolls its day strip horizontally on narrow screens.
- Mobile task form: reachable fields and no horizontal document overflow.
- Dialog Tab/Shift+Tab containment and return focus; keyboard-expandable task rows.
- System reduced motion and the live ambient-motion control.
- Representative solid token contrast ratios: body **14.69:1**, muted text **6.57:1**, primary button **13.66:1**. These are token checks, not an exhaustive accessibility certification.
- Final calendar cards fill their available week width; selecting a project scrolls to its workbench.

## Practical limits

No live AI provider credential was supplied. Successful AI-assisted interactions were tested using mocked proxy responses; actual provider quality, availability and billing were not tested. All ordinary productivity workflows operate with AI off.

The build reports the existing architecture's large bundle and mixed static/dynamic import warnings because the registry bundles all themes. No build failure occurs. No remote repository, deployed application, or production data was changed.

The local preview uses its own origin's localStorage. It does not automatically access a hosted app's saved workspace. Use the existing backup/import tools if you choose to transfer data.

## Version preservation and final visual review

All 19 Legacy files other than index.js match the original SHA-256 snapshot byte for byte. Restoring only the display name from “Verdant Legacy” to “Verdant” also reproduces the original index.js hash. The original delivery archives are retained separately.

Twenty final screen captures cover the new main screens, project workbench, task library, settings, forms, palette, day receipt, weekly reflection, shortcuts, mobile overlays and preserved Legacy. All captures have no horizontal document overflow. Dialog bounds were also measured directly: every captured panel stays inside the viewport, including the corrected 390px day receipt (left 16px, right 374px). The reworked weekly chart was visually checked with populated sample data. The mobile Close day action remains visible.

The final stage includes original art, a full two-page reflection and grimoire workbench, renamed presentation copy, a separate pixel-crystal favicon, and a clamped active-week selection shared by the Atlas rendering and keyboard list.
