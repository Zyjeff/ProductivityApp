# Quest Review Triage

A separate reviewer read the repo cold and produced a long write-up. This is
my triage from the inside — what survives, what gets reframed, what gets
dropped, and what's deferred.

The hard constraint: **live data**. Anything that touches storage gets a
migration path with defaults. Existing users open the app and notice
improvement, not surgery.

---

## ✅ Ship now

### Error boundary
Reviewer right. We've actually crashed the whole tree once already (the
`projectsMap.get()` bug). Wrapping the view region with a small boundary
that renders a recovery card is high-leverage. Old data unaffected.

### Due-date field on tasks
Reviewer right. We have `scheduleDate` for pinning to the planner, but no
immutable "deadline is Friday". For the freelance use case that's a real
omission. Cleanly additive: `task.deadlineAt: number | null`, defaults to
null on existing rows (no migration version bump needed — the field is
optional and JS treats missing as undefined; code uses `task.deadlineAt ??
null`). Surfaces:
- TaskForm: optional date picker labeled "Due"
- TaskRow: small chip "Due Fri" (red if past, amber if ≤3 days, neutral
  otherwise)
- AI planner prompt: include `deadline: YYYY-MM-DD` per task line so the
  AI can respect it
- AI rule: "Tasks with a deadline must complete on or before their deadline
  date. Override the earliest-first default if needed to honor it."

### Project description editing in Pipeline
Reviewer right. `project.desc` exists in the data model, gets set on
capture, but is never rendered or editable post-creation. Add a small desc
field to the expanded panel. No data change — just UI.

### Move-to-project picker in TaskForm
Reviewer right. Today, the only way to attach a task to a project is to
create it inside the project's expanded panel. The TaskForm has no project
picker. Easy add: dropdown in the form. Existing data already supports
projectId on tasks.

### JSON export + import
Reviewer right that this is the most dangerous gap. Clear localStorage →
all data gone. Cleanly solvable with one menu entry that dumps everything
keyed by `KEYS.*` (which is literally a manifest already) plus the schema
version. Import validates schema version, refuses to clobber if higher,
offers merge-vs-replace.

### "Generate plan" CTA shown when queue is empty
Reviewer right. Tiny bug — `Today` shows "Generate plan" even when
`allPending.length === 0`. Should hide it and surface "Capture your first
task" instead.

### Trophy progress hints
Reviewer right that locked trophies could show progress. "Complete 20
tasks" with `8/20` underneath is better than "Complete 20 tasks" alone.
Data already exists in `profile.completedCount`, just unrendered.

### Replan examples row
Add a `Try: "…"` chip row under the replan input. Three or four canonical
examples. Discoverability is the only thing missing from this feature.

### Day-rollover natural-language presets
Reviewer right. The numeric input below the level meter is opaque. Add a
small preset row (Standard / Late / Overnight) above the numeric input
that translates to 0 / 22 / 4. Numeric still works for power users.

### PWA manifest
Small, isolated, immediately makes the app installable. No risk.

### README + theme-color fixes
Reviewer right. The README claims a warm off-white palette (we're dark
mode) and tells users to add a serverless proxy (we already have one).
The `index.html` `theme-color="#faf7f2"` makes the browser chrome flash
light on load. Both are credibility-erosion bugs.

---

## 🟡 Good idea, not like that

### "Auto-enter Preview on first launch"
Reviewer's suggested implementation: detect first launch, enter preview,
show "Start fresh" banner. The idea is right but the detection needs
care — existing users (who all have data) must NOT see this. Implement
by gating on `tasks.length === 0 && projects.length === 0 && profile.totalXP
=== 0` at ready-time. Existing users with any data sail past. Show a
single first-launch banner with a "Start fresh" button on the Today view's
empty state, not the regular preview banner.

### "Close day from sidebar / 6pm nudge"
Reviewer wants a persistent nudge. Sidebar surface would clutter that
chrome. Better: an in-Today subtle banner that appears after a threshold
(e.g., after-hours + completions exist + day not closed). Keep the sidebar
clean.

### "Quick capture mode tabs"
Reviewer wants Task/Subtasks/Project as three visible tabs in QuickCapture.
That's three pieces of chrome where there's currently one. Cheaper fix:
make the mode chip more discoverable — small label "mode" next to it, or
keep the chevron but add a brief inline hint on first use. The mode menu
itself stays as-is.

### "Notes during focus"
Reviewer wants in-tunnel note capture. The TaskForm has `notes`. Adding a
small text area to the focus overlay would work, but the right scope is a
single "Quick note for this task" textarea that appends to `task.notes`
rather than a separate field. Lower priority though.

### "Day rolls at NN:00 input is a settings smell in nav chrome"
Reviewer wants a settings panel. Disagree on the smell — putting one
high-leverage knob in chrome is fine for a one-user app. But the preset
row (above) softens this anyway.

---

## ❌ Not applicable

### "Rename Habits to Screen Log"
Existing users would lose a sidebar surface they recognize. The "Habits"
label is also intentionally aspirational — the view exists because the
trophy system gates on it (clean_day). Surprise-renaming a top-level
view in a live app is a no.

### "Add client / external party concept"
This is a single-user app. The reviewer flagged it as out-of-scope
themselves. Skip.

### "Multi-tenant / auth / sharing"
Different product. The author explicitly built this as a personal tool.
Not what we're doing.

### "Read-only share link for a project"
Needs a backend, an auth boundary, a public-render path. Out of scope.

### "No code splitting"
Reviewer flagged it as irrelevant for a personal tool in the same
sentence. Agreed. Vite + 320KB on first paint is fine for a tool you
keep open.

### "No tests"
True. Maintenance cost. The chunk-XP math and migrations are exactly the
places I'd want tests, but adding a test framework now is more work than
benefit for a solo project that's iterated daily.

### "Two tabs corrupt state"
Acceptable failure mode. The user can be told. Bigger problem to fix.

### "Custom recurring patterns" (every other Tuesday, first Monday)
Significant data model + scheduler work for a niche need. Daily and weekly
cover 95% of real use.

### "Pomodoro / break nudges"
Feature creep. The focus tunnel is intentionally simple.

### "Multi-select / bulk drag in Planner"
Drag-and-drop UX is non-trivial; multi-select would 3x the complexity.
Better to add a per-day "select all" if the use case proves real.

### "Visible 3-tab mode picker on QuickCapture"
Already covered above — changes more chrome than the discoverability
problem justifies.

---

## 🔮 Worth considering later

These are real ideas, just not now. Parking them with brief notes.

- **Command palette (Cmd+K)** — high value, significant work. Should
  expose: switch view, jump to project, search task, schedule chunk,
  enter focus mode. Build after the data layer has more typed shape so
  search is fast.
- **Mobile breakpoint** — desktop is the dominant use today. Tablet/phone
  needs the planner reimagined as an agenda view, not a grid.
- **Per-task actual time** (`actualHours` from focus sessions accumulated
  across days) — useful for estimate calibration, but the storage layer
  doesn't track per-day focus history yet. Needs a per-task ledger.
- **Browser notifications** — opt-in flow + permission UX. Reasonable
  later.
- **Calendar .ics feed** — needs a stable public URL or a download
  format. Latter is feasible right now if we add it to export.
- **Sticky capture bar** — would need to handle the case where the form
  is open. Minor UX, defer.
- **j/k keyboard cursor + Space-to-complete in Queue** — meaningful for
  power users.
- **Daily-recurring streak chart** — interesting but the data isn't
  aggregated today.
- **Task templates / duplicate task** — small but multiple touchpoints.
- **Undo for delete** — replaces `window.confirm` with toast + 5s grace.
  Doable but needs a pending-action store.
- **Quiet AI failure → one-time toast** — small, valuable.
- **Post-ship project archive view** — stats per shipped project.
- **Filter chips in Planner** — show only one project or tag.

---

## Implementation order

Doing this in two phases. Phase 1 is the highest-impact / lowest-risk
batch. Phase 2 is the next round.

### Phase 1 (this session)
1. Error boundary
2. JSON export + import
3. Due date field (additive, defensive defaults)
4. README + theme-color fix
5. "Generate plan" empty-state bug fix
6. Project description editing in Pipeline
7. Move-to-project picker in TaskForm
8. Trophies progress indicators
9. Replan example hints
10. Day-rollover natural-language presets
11. PWA manifest
12. First-launch auto-preview (gated on no data)

### Phase 2 (future)
13. Quiet AI failure toast
14. Daily-recurring streak rollup
15. Sticky capture bar
16. Undo for delete via toast
17. Command palette
18. Filter chips in Planner
19. Calendar export (.ics download from settings)

Phase 1 is what ships now.
