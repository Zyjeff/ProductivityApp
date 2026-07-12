# IDEAS — divergence log (product phase)

Raw material from living in the app (gaps logged as "I wish it…") plus
deliberate exploration across capture / planning / execution /
reflection / motivation / AI / structure. Scored below; winners moved to
ROADMAP.md, everything else is labeled backlog.

## The gap log (from driving the app)
- I finish a task and the list just sits there — nothing tells me what's *now* and what's *next*.
- I can't put today's lineup in the order I intend to do it. Energy sort is a heuristic, not my call.
- The tunnel counts minutes but the app never uses them: no actual-vs-estimate anywhere, ever. For a freelancer this is the single most valuable number the app already collects and throws away.
- Opening the app in the morning gives me stats, not a starting point. I want the app to have an opinion at 8:00.
- Sunday night: no way to see "what did this week amount to?" without archaeology in the Library.
- Launching a project is confetti and then… the moment evaporates. A designer's launches are portfolio material; the app forgets them.
- Typing "invoice friday" should just schedule an invoice task for Friday. Every date requires a form or the planner.
- Projects are 4-line accordion cards; there's no place where a project *lives* (hours in, notes, ship history).
- The palette can't take arguments — it finds, it doesn't do-with-parameters.
- The streak tells me it exists but not what today requires to keep it. (Momentum card partially covers this.)

## Candidates (26)

**Capture**
1. **Natural-language quick add** — capture grammar: `!p` priority, `#tag`, `@project`, `2h`, `fri`/`tomorrow`/`jul 20` dates, `every day`; deterministic parser (offline) with AI fallback for prose. Works in the capture bar and palette.
2. Inbox state + triage flow — capture without deciding; keyboard triage (today/tomorrow/date/project/kill) to inbox-zero. Overlaps the Today-pin model; risk of a fourth home for tasks.
3. Voice capture via Web Speech API — hands-free capture. Dependency on flaky browser API.
4. Clipboard watcher — offer to capture copied text on focus. Creepy/noisy; against calm.

**Planning**
5. Deadline radar — 7-day horizon strip on Today with load vs capacity and deadline flags.
6. **Run order for Today** — the lineup is an ordered queue I control: drag + `[`/`]` to reorder, persisted per day.
7. Time-of-day blocks (morning/afternoon/evening lanes) — heavier Sunsama-style structure; likely over-structure for a 5-task day.
8. Planning ritual ("Plan tomorrow" step inside Close Day: pick 3 from the yard). Good, small; fold into end-of-day later.
9. Auto-rebalance button — one-click "spread my overloaded day". Already ~= replan instruction; marginal.

**Execution / focus**
10. **NOW / NEXT hero** — the top of Today becomes a stage: current task huge, next queued, start/f directly. The list becomes the backstage.
11. Focus tunnel v2: estimate arc around the timer, session note on exit, auto-log session. (Merged into 13.)
12. Pomodoro cadence — explicit non-goal in the original triage; the tunnel's simplicity is the feature. Kill.
13. **Session ledger + estimate calibration** — every tunnel run logs a session (task, date, minutes). Tasks show actual vs estimate; Logbook shows a calibration factor (e.g. "hard tasks run 1.6× your estimate"); the AI scorer receives your calibration so estimates get honest over time.
14. "Timebox the day" — assign clock times to lineup items. Over-structure; run order covers intent without the calendar cosplay.

**Reflection**
15. **Weekly Review** — a real surface: the week's ships, XP, focus hours, estimate accuracy, best day, adrift count, per-project split; an AI-written 3-paragraph retro with one concrete suggestion; every week stored and browsable (this becomes the app's memory and supersedes both Weekly Pulse and past-planner navigation).
16. Estimate coach toasts — "this took 2.1× estimate" on complete. Fold into 13's chips instead of nagging toasts.
17. Year heatmap (GitHub-style) — pretty, low daily value. Backlog.
18. Day journal line at Close Day ("one line about today") stored per day. Nice, small. Backlog (weekly review covers reflection this session).

**Motivation loop**
19. **Ship Log** — launching a project mints a log entry: stats frozen at launch (tasks, hours, actual focus time, span), an AI-drafted launch note you can edit, browsable fleet history. Turns confetti into a portfolio diary — the loop's *substance* for a designer.
20. Streak stakes — show exactly what today needs to keep the flame; streak-freeze tokens earned by launches. Backlog (semantics change needs owner buy-in).
21. Season levels / prestige — resets yearly. Gimmick risk, backlog.
22. XP multiplier days ("double XP Friday"). Decoration, kill.

**AI as a feature surface**
23. **Morning Brief** — on first open each day: yesterday shipped, what's adrift, today's lineup vs capacity, deadline risk, suggested run order — deterministic skeleton always, AI prose + reasoning when reachable; cached per day; `b` reopens it.
24. AI weekly retro writer — folded into 15.
25. "Ask the yard" — free-form Q&A over your tasks/history ("what did I ship for IGP in June?"). Powerful but unbounded scope; backlog.
26. AI estimate second-opinion on demand (`$` on a task: "is 2h realistic given my history?"). Fold into 13's calibration + backlog.

**Structure**
27. **Project drawer** — click a project → full-height drawer: description, notes, children, progress, hours logged vs estimated, ship state. Gives projects a *home* without a fourth surface. (Absorbed into 19's Dock work + backlog for full notes editor.)
28. Merge Plan into Today as one scrollable "today + horizon" surface. Tempting; kills the clean 1/2/3 model — backlog experiment.

## Scoring (5 criteria, 0–2 each: daily loop · depth>novelty · keyboard-first · local-first fit · finishable this session)

| # | Idea | Loop | Depth | Kbd | Local | Finish | Σ | Call |
|---|---|---|---|---|---|---|---|---|
| 23 | Morning Brief | 2 | 2 | 2 | 2 | 2 | 10 | **F1** |
| 15 | Weekly Review + history | 2 | 2 | 2 | 2 | 2 | 10 | **F2** |
| 6+10 | Run order + NOW/NEXT hero | 2 | 2 | 2 | 2 | 2 | 10 | **F3** |
| 13 | Session ledger + calibration | 2 | 2 | 1 | 2 | 2 | 9 | **F4** |
| 19 | Ship Log | 1 | 2 | 1 | 2 | 2 | 8 | **F5** |
| 1 | NL quick add | 2 | 1 | 2 | 2 | 2 | 9 | **F6** |
| 5 | Deadline radar | 1 | 1 | 1 | 2 | 2 | 7 | backlog |
| 8 | Plan-tomorrow in Close Day | 2 | 1 | 1 | 2 | 2 | 8 | backlog (next session — extends F1/F2 ritual pair) |
| 2 | Inbox + triage | 1 | 1 | 2 | 2 | 1 | 7 | backlog |
| 27 | Project drawer (full) | 1 | 2 | 1 | 2 | 1 | 7 | partially in F5; full drawer backlog |
| 25 | Ask the yard | 1 | 2 | 1 | 1 | 0 | 5 | backlog |
| 20 | Streak stakes/freezes | 1 | 1 | 1 | 2 | 1 | 6 | backlog |
| 18 | Day journal line | 1 | 1 | 1 | 2 | 2 | 7 | backlog |
| 17 | Year heatmap | 0 | 1 | 1 | 2 | 2 | 6 | backlog |
| 26 | Estimate second opinion | 1 | 1 | 1 | 1 | 1 | 5 | backlog |
| 28 | Today+horizon merge | 1 | 1 | 1 | 2 | 0 | 5 | backlog |
| 9 | Auto-rebalance | 0 | 0 | 1 | 1 | 2 | 4 | kill (replan covers) |
| 3 | Voice capture | 1 | 0 | 0 | 1 | 1 | 3 | kill |
| 4 | Clipboard watcher | 0 | 0 | 0 | 1 | 1 | 2 | kill |
| 7 | Time-of-day lanes | 1 | 0 | 1 | 2 | 1 | 5 | kill (run order wins) |
| 12 | Pomodoro | 0 | 0 | 1 | 2 | 2 | 5 | kill (re-affirmed non-goal) |
| 14 | Timeboxing | 0 | 0 | 1 | 2 | 1 | 4 | kill |
| 22 | XP multiplier days | 0 | 0 | 0 | 2 | 2 | 4 | kill |
| 21 | Prestige seasons | 0 | 0 | 0 | 2 | 1 | 3 | kill |
| 16 | Coach toasts | 1 | 0 | 0 | 2 | 2 | 5 | folded into F4 |
| 24 | AI retro writer | — | — | — | — | — | — | folded into F2 |
| 11 | Tunnel v2 | — | — | — | — | — | — | folded into F4 |
