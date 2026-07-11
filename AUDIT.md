# AUDIT — Quest (ProductivityApp) from first principles

Auditor: incoming lead product engineer. Method: read every line of the
codebase (7,591-line `src/App.jsx`, `main.jsx`, `tokens.css`, `netlify/*`,
README, and the in-repo `quest-review-triage.md`), then live in the running
app the way the owner does. This file is the raw log; VERDICT.md is the
decision.

Status: Phase 1 (reading) done · Phase 1 (driving) in progress.

---

## Part A — Findings from reading the code (pre-run)

### A1. Defects found by inspection (to be confirmed at runtime)

1. **Stale-schema reads of `todayEntry.taskIds`** — the weekplan schema
   moved `taskIds[]` → `items[]` at migration v4, but two live code paths
   still read the dead field:
   - `App.jsx:6300` ("day cleared" detector): `todayEntry?.taskIds || []`
     is always `[]`, so the "Day cleared. Solid day." moment only ever
     fires from daily tasks; scheduled work never counts.
   - `App.jsx:7174` (focus tunnel "up next"): same dead read, so after
     completing a task in focus mode the tunnel never advances to the
     day's scheduled tasks — only daily recurring ones. Focus-chaining,
     a core flow, is quietly broken.

2. **Double-XP integrity hole** — chunk completion (`toggleChunkDone`)
   pays per-chunk XP shares; `completeTask` pays the full `task.xp`.
   Complete 2 of 3 chunks (≈66% XP paid), then complete the task from the
   Queue's whole-row circle → `completeTask` pays 100% again (~166%
   total). The profile XP counter is a mutated running total with no
   reconciliation, so this drift is permanent.

3. **Today's "Schedule pending" ignores the user's capacity settings** —
   `TodayView.generatePlan` calls `aiPlanWeek(tasks, DEFAULT_CAPS, …)`
   (App.jsx:3419) while PlannerView uses the saved `quest_caps`. The same
   button in two views produces different schedules.

4. **UTC/local date mixing** — `isoDate()` is local, but `todayKey()` and
   `HabitsView.days7` use `toISOString().slice(0,10)` (UTC). For the owner
   (Netherlands, UTC+1/+2) anything logged after midnight lands on the
   wrong day in Habits, and the "today" column highlight mismatches
   between midnight and ~2am. The day-rollover-hour feature makes this
   worse: Habits' 7-day strip ignores `dayStartHour` entirely for its keys.

5. **AI failures are silent by design** — `aiScore` catch → `{xp:20,
   difficulty:"medium"}` with `reason:"auto"`; `aiFromDescription` catch →
   truncated raw input as the title. Under plain `npm run dev` there is no
   `/api/anthropic` (that's a Netlify function; Vite doesn't serve it, and
   there's no dev proxy in vite.config.js), so **every AI feature
   silently no-ops in local dev** and every captured task scores 20 XP /
   medium / 1.5h. The README calls this graceful; from the chair it's
   indistinguishable from "the AI is broken and lying about it."
   The planner's fallback returns the existing plan → "Generate plan"
   spins and then... nothing visibly happens. No toast, no error.

6. **`QuickCapture` Enter-to-submit races the network** — capture calls
   the AI before creating the task (`submit()` awaits
   `aiFromDescription`). Capture latency = model latency (or a 404 round
   trip). The input is disabled while loading. Capture — the single most
   frequent action in a capture tool — is gated on a network call.

7. **Weekly recurring reset is "7 days since completedAt"**, not a fixed
   weekday — a Friday-completed weekly chore next appears Friday, then
   creeps later every week.

8. **README/schema drift** — README documents schema v7; code is v8.
   Small, but the README is the only doc.

9. **Two-tab / multi-device corruption acknowledged and accepted** in the
   triage doc. Every mutation path does read-modify-write of whole arrays
   through ~60 scattered `saveKV` calls; last write wins.

### A2. Architecture observations

- Single-file App.jsx with all state in one component, threaded through a
  40-key `shared` props object. The comments are honest about the cost:
  `toggleChunkDone` can't use functional setState ("React 18 defers the
  updater"), FocusTunnel needs an eslint-disable and a ref dance to avoid
  self-resetting, and profile bookkeeping (XP/streak/lastDate/counts) is
  duplicated across four different completion paths (completeTask,
  uncompleteTask, completeDailyOn/uncompleteDailyOn, toggleChunkDone) —
  each with its own inverse. This is the signature of derived state being
  stored instead of computed.
- `window.storage` is an async Promise shim over synchronous localStorage
  — a vestige of the original host environment. It buys nothing in a
  browser and forces async loading states (e.g. Habits' "Loading…").
- Screen-log state is loaded independently by TodayView, HabitsView, and
  EndOfDayDialog, each keeping its own copy and writing the whole object —
  same-session clobber risk between views.
- Migration system (v1→v8 + vsq_* + shiplist import) is genuinely good:
  additive, defensive, well-commented. The KEYS manifest + export/import
  with schema gating is solid engineering.
- AI layer: prompt design is thoughtful (surgical replan ops, frozen/done
  chunk handling, title→id normalization at the boundary). The transport
  and error surfacing are the weak half: raw fetch, no timeouts, no
  status surface, console-only diagnostics.

### A3. Product observations (pre-run hypotheses to test)

- **"Keyboard-first" is mostly navigation.** N, 1–6, ?, Esc, ⌘↵ — that's
  the whole map. You cannot select, complete, edit, schedule, or focus a
  task without the mouse. For a keyboard-first daily driver this is the
  single biggest gap between the pitch and the product.
- **Six views is two apps stapled together.** Queue vs Today vs Planner
  all render the same tasks with different lenses and different
  completion semantics (whole-task vs chunk vs daily-on-date). Pipeline is
  the old ship-list app; Habits is a manual screen-time logger with no
  connection to tasks; Trophies is a static grid. Navigation cost is real:
  the "where do I do X" question has ≥2 correct answers for most X.
- **Deleting is scary**: window.confirm, no undo anywhere.
- **No settings surface**: day-rollover lives in nav chrome; capacity
  lives inside Planner; export/import hides in the sidebar footer.
- Visual identity: competent dark dashboard (Inter + JetBrains Mono,
  near-black surfaces, violet accent) — a familiar "Linear-adjacent" look.
  Professionally fine, personally anonymous.

---

## Part B — Findings from driving the app (live session)

Setup: working copy in scratchpad, `npm install` + `npm run dev` (Vite
5.4.21, up in 933ms). Drove it first from a fresh profile, then seeded a
realistic 30-task / 4-project / 6-plan-day dataset with split chunks,
missed work, daily history, and a 4-day streak, and lived in it. It was
~00:30 local (Sunday) during the session — the owner's actual usage hour.

### B1. Confirmed live, with numbers

1. **Silent AI fallback mangles capture.** Typed *"Reply to Sara about
   the Q3 scope change before the client call"* into Quick Capture →
   `/api/anthropic` 404s in 11ms (plain Vite serves no functions) → task
   silently created as **"Reply to Sara about the Q3 scope change before
   the client ca"** (hard 60-char mid-word truncation), 20 XP / medium /
   reason "auto". No toast, no error, no indication AI never ran.

2. **"Generate plan" silently no-ops.** Clicked it on Today with 1
   pending task: spinner for a beat, then nothing. No plan, no toast,
   `quest_weekplan` still null. The app's flagship feature fails without
   a word.

3. **Captured tasks are invisible.** After capturing, Today says
   "1 pending · 0 on today's plan" and shows an empty state. The task I
   created five seconds ago appears nowhere on the default screen — it
   went to Queue (a different view) until AI-planned or manually pinned
   via the full form's date picker. Capture-to-void is the single worst
   daily-driver flaw: the tool's core promise is capture→ship, and the
   capture lands in a drawer.

4. **Double-XP confirmed.** 70-XP task split into 3×2h chunks. Marked one
   chunk done → +23 XP (2340→2363, exactly 70×2/6). Then clicked the
   whole-task complete circle in Queue → +70 more (2363→2433). 93 XP
   credited for a 70-XP task, and the third chunk remains `done:false` in
   the plan while the task is `completed:true`. The ledger drifts
   permanently; no reconciliation exists.

5. **Completing a task does not complete its chunks** (inverse of #4):
   finished "IGP contact form" via the focus tunnel; its scheduled chunk
   for today stayed `done:false` in `quest_weekplan`. Two completion
   systems, no synchronization — this is the same root cause as #4.

6. **"Day cleared. Solid day." fires falsely.** With "Write component
   teardown post" still pending on today's plan, completing just the two
   daily tasks triggered the day-cleared toast. Root cause confirmed: the
   detector reads `todayEntry.taskIds`, a field that stopped existing at
   schema v4. Scheduled tasks are invisible to it.

7. **Focus tunnel never chains into scheduled work.** Same dead
   `taskIds` read: "Up next" showed only daily tasks; after the dailies
   were done the tunnel closed even though a scheduled task was pending.
   Focus-chaining, the flow the tunnel exists for, works only for
   dailies.

8. **Replan failure blames the user.** Typed "Push the IGP work to next
   week" into the replan bar → API unreachable → toast **"Couldn't apply
   that — try rephrasing"**. The phrasing was fine; the network was
   down. Same pattern on AI-extend ("AI couldn't generate tasks — try
   rephrasing").

9. **UTC/local split, live at 00:34.** Local date 2026-07-12, UTC still
   2026-07-11. Habits' "Today" card (keyed local) showed today's counts,
   but the 7-day chart (keyed UTC via `toISOString`) ends on the 11th: a
   log entry made now appears in *no* chart column and no column is
   highlighted as today. The owner built a day-rollover-hour feature
   because he works past midnight — and the Habits chart breaks exactly
   past midnight.

10. **Capture bar unreachable on a phone.** At 375px, the sidebar
    collapses nicely to a 64px rail and the page doesn't overflow, but
    the header's capture input sits at x=156→492 — 117px clipped
    off-screen with no way to scroll to it (container hides overflow).
    Mobile Today = read-only.

11. **Subtask text dropped on submit.** Text typed into "Type subtask +
    Enter" that isn't Enter-committed is silently discarded when the form
    is submitted (code: `submit()` reads only the committed `subs` array,
    never pending `stIn`). Same for the tag input.

12. **Planner noise.** The two daily tasks render into all 28 day cells
    (including "off" days and past days), and each empty day's XP footer
    claims "20 XP" from dailies alone. On a Sunday, the current week row
    leads with six already-dead days; today renders in the bottom-right
    of the first row.

13. **Windows keyboard hints are wrong.** The UI says "⌘ ↵ to submit"
    on a Windows machine (Ctrl+Enter works, ⌘ doesn't exist).

### B2. What genuinely works (credit where due)

- **Reload persistence is flawless** — full state (streak, plan, chunk
  states, screen log) survives reloads exactly.
- **Preview mode round-trip is data-safe**: 30 tasks / 2528 XP →
  snapshot → 41 demo tasks → exit → exact restore. Careful engineering.
- **The ship moment lands.** 100% ring → "Ship it" → confetti → shipped
  ledger. This is the emotional core of the product and it's right.
- **Missed-work triage strip** (Today/Move/Done/Dismiss per late chunk)
  is a genuinely good pattern — arrived at through real use, clearly.
- **Export/Import** works (toast + versioned JSON, replace/merge).
- **Trophy progress hints** ("5 / 7" toward Week Warrior) are live.
- **Split-chunk model** — per-chunk hours, notes, per-chunk XP shares,
  "1/3" badges, chunk editor — is a real differentiator; the planner's
  data model is more sophisticated than most commercial tools.
- Keyboard nav (N, 1–6, ?) responds instantly; N focuses capture.

---

## Part C — Phase 2: the first-principles audit

For each subsystem: what exists, does it survive "would I build it this
way today," and why.

### C1. Architecture & code organization — REBUILD

One 7,591-line file is not the crime; for a single-user tool, small file
count is a defensible aesthetic. The crime is the **state architecture**:
every derived quantity (XP totals, streak, counts, completion) is stored
and hand-maintained by four parallel mutation paths, each with
hand-written inverse operations. The confirmed bug crop — double XP,
chunk/task divergence, dead `taskIds` reads surviving four schema
versions, "day cleared" false-fires — are not four bugs; they are one
disease: *storing what should be derived, and duplicating what should be
centralized*. The file's own comments document the fights (React 18
batching workarounds, self-resetting effects, eslint-disables). Patching
individual symptoms leaves the generator running. Today I would build: a
single store with one completion mutation, derived selectors for
XP/streak/activity, and a schema accessed through one module so a dead
field can't silently haunt two views. That is a rebuild of the core, not
a refactor of the file.

### C2. State & persistence — REWORK (keep localStorage, rebuild the layer)

localStorage as the primary store *survives* the test for a single-user,
single-machine, local-first tool — no server, no accounts, instant boot.
What fails: the async `window.storage` shim (a vestige of the original
host; pure complexity tax in a browser), ~60 scattered `saveKV` calls
with read-modify-write races, and durability that hangs on the owner
remembering to click "export". Today: synchronous boot reads, one
persist function (debounced, per-slice), a 7-slot rotating auto-backup,
and export/import kept (same format, plus accepting the old format).
The migration discipline (additive v1→v8, legacy vsq_*/shiplist import)
is the best engineering in the repo — keep the approach, extend it.

### C3. The six-view IA — REBUILD around the day

The six views are visibly two merged apps plus satellites: Queue/Planner
(scheduling app) + Pipeline (ship-list app) + Habits (screen logger) +
Trophies (static grid) + Today (the actual product). Evidence from use:
captured tasks land invisible (B1.3); most actions have two homes with
different semantics (completing in Queue vs Planner vs Today does
different things — B1.4/5); Habits connects to nothing; Trophies is a
destination you visit twice a year. The right mental model for a daily
driver is **the day as the spine**: capture lands *in view*, today's
lineup is the home screen, the planner is the same list arranged in
time, projects are a grouping lens with a ship ritual, and stats/trophies
are a drawer, not a room. Three surfaces, not six.

### C4. The AI layer — REWORK (keep the brains, replace the trust model)

The prompt engineering genuinely survives first principles: the
surgical-ops replanner (move/split/schedule/unschedule, done-chunks
frozen, title→id normalization at the boundary, defensive
refuse-to-clobber) is better thought out than most production AI
features. What fails is the trust model: every failure is silent or
blames the user (B1.1/2/8), capture is *gated* on a network round trip,
and local dev has no functions runtime at all, so the README's "degrades
gracefully" means "all AI silently off unless deployed." Today: capture
saves locally in 0ms and AI enriches asynchronously; AI status
(ready/offline) is visible where it matters; failures say what actually
failed; the same `/api/anthropic` contract is served by the Netlify
function in prod and a Vite dev middleware locally (zero new deps, key
via env). Auto-scoring also loses its monopoly: scores become
deterministic-by-default (difficulty × hours) with AI as a *suggester*,
because an XP economy built on unverifiable model guesses (or flat-20
fallbacks) is noise wearing a number.

### C5. Gamification — REWORK (keep the pull, retire the fake precision)

What actually pulls: the streak, the day-close ritual, the ship confetti,
the week bars. What doesn't: an XP ledger that provably leaks (B1.4), a
12,000-XP level ladder that goes quiet for weeks at the owner's real
pace, and a 14-trophy set that is 9/14 exhausted. Decoration vs pull, on
the evidence: the *moments* are pull; the *numbers* are decoration that
can silently lie. Today: XP and streak become **derived, recomputable
functions of the completion history** (kills the entire drift class,
makes merge/import trivially correct), the owner's lifetime total is
preserved via a one-time baseline at migration, levels stay (identity he
earned), and trophies fold into the stats surface with derived progress.

### C6. Daily-use ergonomics — REBUILD the input layer

"Keyboard-driven" today means view-switching. There is no way to select,
complete, edit, schedule, or focus a task from the keyboard; deletes go
through `window.confirm`; there is no undo anywhere; the capture bar is
gated on the network, drops uncommitted subtask text, and is physically
unreachable on a phone; error messages blame the user. The owner's
stated love (keyboard-first) is the least-built part of the product.
Today: a real command layer — j/k cursor, single-key complete/edit/
focus/schedule, a Ctrl+K palette, undo-toast instead of confirm — which
requires the centralized store the current architecture can't offer.
Startup speed is already good; keep the instant-boot property.

### C7. Visual identity & brand — REPLACE

"Quest" + XP + levels frames a professional's shipping tool as an RPG,
and the look is a competent but anonymous violet-on-black dashboard —
the default aesthetic of every 2024 side project. The product the
evidence describes is not a game: it's a **solo shipyard** — work is
built in the yard, then launched. The owner is Dutch, a designer, and
ships client sites for a living; the identity should be his, not
Linear's. Decision + three explored directions recorded in VERDICT.md.

