// today.jsx — the day sheet (DESIGN.md §5.1).
// Logic lifted from nightwatch/views/today.jsx (memos, effects, handlers,
// brief-generation guards, drag reorder). Composition is the house: a
// single washi page with a morning letter, an In-hand plate, fallen
// leaves, the lineup, and quiet foot instruments. Garden derivations
// stay in pane.jsx.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, EmptyState, Kbd, Meter } from "../components.jsx";
import { CaptureStrip } from "../capture.jsx";
import { TaskRow } from "../taskrow.jsx";
import { usePane } from "../pane.jsx";
import { bayerAt } from "../texture.js";
import * as D from "../../../core/domain.js";
import {
  useStore, getState, setUI, setCompletion, todayLineup,
  dismissChunk, moveChunkDate, reopenDay,
  enterPreview, setLineupOrder, ensureMorningBrief, patchBrief, applyBriefOrder,
  reviewPromptDue, openReview, patchReview,
} from "../../../core/store.js";
import { generateBriefProse } from "../../../core/enrich.js";
import { registerActiveList } from "../../../core/keys.js";

export function TodayView() {
  const tasks = useStore((s) => s.tasks);
  const plan = useStore((s) => s.plan);
  const projects = useStore((s) => s.projects);
  const caps = useStore((s) => s.caps);
  const sessions = useStore((s) => s.sessions);
  const briefs = useStore((s) => s.briefs);
  const aiStatus = useStore((s) => s.ui.aiStatus);
  const meta = useStore((s) => s.meta);
  const energy = useStore((s) => s.ui.energy);
  const cursor = useStore((s) => s.ui.cursor);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const { openTask } = usePane();

  const hour = meta.dayStartHour || 0;
  const todayIso = D.effectiveTodayIso(hour);
  const s = getState();
  const lineup = useMemo(() => todayLineup(s), [tasks, plan, energy, hour, meta]);
  const missed = useMemo(() => D.getMissedWork(tasks, plan, hour), [tasks, plan, hour]);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const pending = useMemo(
    () => tasks.filter((t) => !t.completed && t.recurring === "none"),
    [tasks]
  );

  const kbRows = useMemo(() => [
    ...missed.map((m) => ({ taskId: m.taskId, chunkDate: m.date, done: false })),
    ...lineup.map((r) => ({ taskId: r.task.id, chunkDate: r.chunk ? todayIso : null, done: r.doneHere, recurring: r.recurringRow })),
  ], [missed, lineup, todayIso]);
  useEffect(() => { registerActiveList("today", kbRows); }, [kbRows]);

  const briefData = useMemo(
    () => D.morningBriefData(tasks, plan, caps, sessions, hour),
    [tasks, plan, caps, sessions, hour]
  );
  const brief = briefs?.[todayIso] || null;
  // Re-run when today's brief is missing (preview wipe, import, first paint).
  // todayIso alone is not enough: enterPreview() clears briefs without
  // changing the date, so the letter would never mount.
  useEffect(() => { if (!brief) ensureMorningBrief(); }, [todayIso, brief]);
  useEffect(() => {
    if (brief && !brief.attempted) generateBriefProse(todayIso, briefData);
  }, [brief, todayIso]);

  const stats = useMemo(() => {
    const xpMap = D.xpByDay(tasks, plan, hour);
    const activity = D.activityByDay(tasks, plan, hour);
    const anchor = D.effectiveToday(hour);
    const days14 = [];
    for (let i = 13; i >= 0; i--) days14.push(D.isoDate(D.addDays(anchor, -i)));
    const xp14 = days14.map((d) => xpMap.get(d) || 0);
    const done14 = days14.map((d) => activity.get(d)?.size || 0);
    const trend = (a, b) => {
      const sa = a.reduce((x, y) => x + y, 0), sb = b.reduce((x, y) => x + y, 0);
      return sa === 0 ? null : Math.round(((sb - sa) / sa) * 100);
    };
    const monday = D.mondayOf(anchor);
    const week = [];
    for (let i = 0; i < 7; i++) {
      const iso = D.isoDate(D.addDays(monday, i));
      week.push({ label: "MTWTFSS"[i], value: activity.get(iso)?.size || 0, title: `${iso}: ${activity.get(iso)?.size || 0} tasks`, isToday: iso === todayIso });
    }
    const focusToday = D.focusMsByDay(sessions || []).get(todayIso) || 0;
    return {
      todayXP: D.todayXP(tasks, plan, hour),
      streakRun: D.streak(tasks, plan, hour),
      doneToday: activity.get(todayIso)?.size || 0,
      xpTrend: trend(xp14.slice(0, 7), xp14.slice(7)),
      doneTrend: trend(done14.slice(0, 7), done14.slice(7)),
      xp7: xp14.slice(7),
      done14,
      week,
      focusToday,
    };
  }, [tasks, plan, sessions, hour, todayIso]);

  const planDone = lineup.filter((r) => r.doneHere).length;
  const hourNow = new Date().getHours();
  const allDone = lineup.length > 0 && planDone === lineup.length;
  const greeting = allDone ? "The garden is tended."
    : lineup.length === 0 && pending.length === 0 ? "The sheet is blank. The garden waits."
    : hourNow < 5 ? "Late. The house is still awake."
    : hourNow < 12 ? "Morning. Open the shoji."
    : hourNow < 14 ? "Midday. Keep tending."
    : hourNow < 18 ? "Afternoon on the engawa."
    : hourNow < 22 ? "Evening. The lanterns are lit."
    : "Night. The garden still waits.";

  const dayClosed = meta.dayClosed && meta.dayClosed.date === todayIso ? meta.dayClosed : null;
  const upcoming = (plan || []).filter((e) => e.date > todayIso && e.items.length).sort((a, b) => a.date.localeCompare(b.date))[0];
  const cursorIdx = cursor ? cursor.index : -1;
  const dueWeek = reviewPromptDue(getState());
  const xpLeft = lineup.reduce((s2, r) => s2 + (r.doneHere ? 0 : (r.task.xp || 0)), 0);
  const todayDate = D.parseIsoDate(todayIso) || new Date();
  const longDate = todayDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const sweepAllFallen = () => {
    missed.forEach(({ date, taskId }) => moveChunkDate(taskId, date, todayIso));
  };

  return (
    <div className="yz-sheet-inner yzt-sheet">
      <header className="yzt-head">
        <div className="yz-label yz-label--sumi">{longDate}</div>
        <h1 className="yz-display yzt-greet">{greeting}</h1>

        {dayClosed && (
          <div className="yz-banner yz-banner--closed fade-in">
            <Icon name="lantern" size={14} />
            <span style={{ flex: 1 }}>
              The amado are closed.
              <span className="yz-num" style={{ marginLeft: 8, color: "var(--sumi-faint)", fontSize: 11 }}>
                {new Date(dayClosed.closedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
            </span>
            <button type="button" className="yz-btn yz-btn--ghost yz-btn--sm" onClick={reopenDay}>Open the house</button>
          </div>
        )}

        {dueWeek && (
          <div className="yz-banner yz-banner--tea fade-in">
            <Icon name="teacup" size={14} />
            <span style={{ flex: 1 }}>Sunday tea is waiting — last week is in the books.</span>
            <button type="button" className="yz-btn yz-btn--sm" onClick={() => openReview(dueWeek)}>
              Open <Kbd>W</Kbd>
            </button>
            <button type="button" className="yz-icon-btn" aria-label="Dismiss review prompt"
              onClick={() => patchReview(dueWeek, { promptDismissed: true })}>
              <Icon name="close" size={11} />
            </button>
          </div>
        )}

        {stats.doneToday > 0 && !dayClosed && (
          <button type="button" className="yz-link yzt-close-link" onClick={() => setUI({ endOfDayOpen: true })}>
            Close the amado →
          </button>
        )}
      </header>

      <div className="yzt-capture">
        <CaptureStrip scheduleToday />
      </div>

      {brief && (
        <MorningLetter
          brief={brief}
          briefData={briefData}
          todayIso={todayIso}
          aiStatus={aiStatus}
        />
      )}

      {lineup.length > 0 && (
        <InHand
          lineup={lineup}
          projectsById={projectsById}
          todayIso={todayIso}
          hour={hour}
          dayClosed={dayClosed}
          openTask={openTask}
        />
      )}

      {missed.length > 0 && (
        <section className="yzt-fallen fade-in">
          <div className="yzt-fallen-head">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 className="yz-sec">Fallen leaves</h2>
              <span className="yz-num" style={{ color: "var(--amber-deep)", fontSize: 13 }}>{missed.length}</span>
            </div>
            <button type="button" className="yz-btn yz-btn--ghost yz-btn--sm" onClick={sweepAllFallen}
              title="Move every fallen leaf onto today's sheet">
              Sweep all to today
            </button>
          </div>
          <div className="yzt-fallen-list">
            {missed.map(({ date, taskId, task, item }, i) => {
              const project = task.projectId ? projectsById.get(task.projectId) : null;
              const daysAgo = Math.max(1, Math.round((D.parseIsoDate(todayIso) - D.parseIsoDate(date)) / 86400000));
              return (
                <div
                  key={`${date}-${taskId}`}
                  className={"yzt-leaf" + (cursorIdx === i ? " yzt-leaf--cursor" : "")}
                  onMouseEnter={() => setUI({ cursor: { index: i } })}
                  onClick={() => openTask(taskId)}
                >
                  <div className="yzt-leaf-body">
                    <div className="yzt-leaf-title">{task.title}</div>
                    <div className="yzt-leaf-meta yz-num">
                      <span style={{ color: "var(--amber-deep)" }}>{daysAgo}d fallen</span>
                      {project && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <i className="yz-dot" style={{ background: project.color || "var(--sumi-faint)" }} />
                          {project.title}
                        </span>
                      )}
                      {item.hours ? <span>{item.hours}h</span> : null}
                    </div>
                  </div>
                  <div className="yzt-leaf-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="yz-btn yz-btn--ghost yz-btn--sm"
                      onClick={() => moveChunkDate(taskId, date, todayIso)} title="Reschedule onto today">Today</button>
                    <button type="button" className="yz-btn yz-btn--leaf yz-btn--sm"
                      onClick={() => setCompletion(taskId, { done: true, chunkDate: date })} title="It actually got done">Done</button>
                    <button type="button" className="yz-btn yz-btn--ghost yz-btn--sm"
                      onClick={() => dismissChunk(taskId, date)} title="Let go (undoable)">Let go</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="yzt-lineup">
        <div className="yzt-lineup-head">
          <h2 className="yz-sec">Today</h2>
          <PaceToggle />
        </div>

        {lineup.length > 0 ? (
          <>
            <div className="yzt-ledger">
              {lineup.map((r, i) => {
                const globalIdx = missed.length + i;
                return (
                  <div
                    key={r.task.id}
                    className={"yzt-slot" + (dragOverIdx === i && dragIdx != null && dragIdx !== i ? " yzt-slot--over" : "")}
                    style={{ opacity: dragIdx === i ? 0.4 : 1 }}
                    draggable
                    onDragStart={(e) => {
                      const tag = (e.target.tagName || "").toLowerCase();
                      if (tag === "button" || tag === "input") { e.preventDefault(); return; }
                      setDragIdx(i);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => { e.preventDefault(); if (dragOverIdx !== i) setDragOverIdx(i); }}
                    onDragLeave={() => { if (dragOverIdx === i) setDragOverIdx(null); }}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIdx != null && dragIdx !== i) {
                        const ids = lineup.map((x) => x.task.id);
                        const [moved] = ids.splice(dragIdx, 1);
                        ids.splice(i, 0, moved);
                        setLineupOrder(ids);
                      }
                      setDragIdx(null); setDragOverIdx(null);
                    }}
                  >
                    <TaskRow
                      task={r.task}
                      project={r.task.projectId ? projectsById.get(r.task.projectId) : null}
                      doneHere={r.doneHere}
                      onToggleDone={(done) => setCompletion(r.task.id, { done, chunkDate: r.chunk ? todayIso : null })}
                      chunkNote={r.chunkNote}
                      chunkLabel={r.chunkLabel}
                      isCursor={cursorIdx === globalIdx}
                      onHoverCursor={() => setUI({ cursor: { index: globalIdx } })}
                      onOpen={openTask}
                      dayStartHour={hour}
                      dragging={dragIdx === i}
                    />
                  </div>
                );
              })}
            </div>
            <div className="yzt-lineup-hint">
              <span className="yz-num">{planDone}/{lineup.length} done</span>
              <span><Kbd>J</Kbd>/<Kbd>K</Kbd> · <Kbd>X</Kbd> · <Kbd>[ ]</Kbd> reorder · drag</span>
            </div>
          </>
        ) : (
          <EmptyState caption="">
            {pending.length === 0 ? (
              <>
                <div className="yz-display" style={{ fontSize: 18, color: "var(--sumi)", marginBottom: 8 }}>
                  The sheet is blank. The garden waits.
                </div>
                <div>Write in the strip above — it lands here, scheduled for today.</div>
                {tasks.length === 0 && projects.length === 0 && (
                  <div style={{ marginTop: 16 }}>
                    <button type="button" className="yz-btn yz-btn--gold" onClick={enterPreview}>
                      <Icon name="house" size={12} /> Borrow a furnished house
                    </button>
                    <div style={{ fontSize: 12, color: "var(--sumi-faint)", marginTop: 8 }}>
                      Loads a sample life — your empty house is snapshotted and restored on Return home.
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="yz-display" style={{ fontSize: 18, color: "var(--sumi)", marginBottom: 8 }}>
                  Nothing lined up for today.
                </div>
                <div style={{ marginBottom: 14 }}>
                  {upcoming
                    ? <>Next planned day: {D.fmtIsoShort(upcoming.date)} · {upcoming.items.length} task{upcoming.items.length > 1 ? "s" : ""}.</>
                    : <>{pending.length} task{pending.length > 1 ? "s" : ""} waiting in the house.</>}
                </div>
                <button type="button" className="yz-btn" onClick={() => setUI({ view: "plan", cursor: null, statsOpen: false })}>
                  Week →
                </button>
              </>
            )}
          </EmptyState>
        )}
      </section>

      <footer className="yzt-foot">
        <div className="yzt-inst">
          <div className="yz-label yz-label--sumi">Today XP</div>
          <div className="yzt-inst-n yz-display yz-num">
            {stats.todayXP}
            {stats.xpTrend != null && (
              <span className="yzt-trend" style={{ color: stats.xpTrend > 0 ? "var(--starboard)" : stats.xpTrend < 0 ? "var(--port)" : "var(--sumi-faint)" }}>
                {stats.xpTrend > 0 ? "▲" : stats.xpTrend < 0 ? "▼" : "·"}{Math.abs(stats.xpTrend)}%
              </span>
            )}
          </div>
          <InkSpark data={stats.xp7} />
        </div>
        <div className="yzt-inst">
          <div className="yz-label yz-label--sumi">Streak</div>
          <div className="yzt-inst-n yz-display yz-num">
            {stats.streakRun}
            <span className="yzt-unit">days</span>
          </div>
          <WeekDots week={stats.week} />
        </div>
        <div className="yzt-inst">
          <div className="yz-label yz-label--sumi">Done today</div>
          <div className="yzt-inst-n yz-display yz-num">
            {stats.doneToday}
            {stats.doneTrend != null && (
              <span className="yzt-trend" style={{ color: stats.doneTrend > 0 ? "var(--starboard)" : stats.doneTrend < 0 ? "var(--port)" : "var(--sumi-faint)" }}>
                {stats.doneTrend > 0 ? "▲" : stats.doneTrend < 0 ? "▼" : "·"}{Math.abs(stats.doneTrend)}%
              </span>
            )}
          </div>
          <DoneBars data={stats.done14} />
          <div className="yzt-diff">
            {["epic", "hard", "medium", "easy"].map((d) => {
              const count = pending.filter((t) => t.difficulty === d).length;
              if (!count) return null;
              const cfg = D.DIFFICULTY[d];
              return (
                <span key={d} title={`${count} ${cfg.label} pending`}>
                  <i style={{ background: cfg.tone }} />
                  {count} {cfg.label}
                </span>
              );
            })}
          </div>
        </div>
        <div className="yzt-inst">
          <div className="yz-label yz-label--sumi">Lined up</div>
          <div className="yzt-inst-n yz-display yz-num">
            {planDone}<span className="yzt-unit"> / {lineup.length}</span>
          </div>
          <Meter pct={lineup.length ? (planDone / lineup.length) * 100 : 0} tone="var(--sumi)" gold={false} />
          <div className="yz-num yzt-slate-xp">{xpLeft} XP left</div>
        </div>
      </footer>
    </div>
  );
}

function MorningLetter({ brief, briefData, todayIso, aiStatus }) {
  if (brief.dismissed) {
    const facts = collapsedFacts(briefData);
    return (
      <button type="button" className="yzt-letter yzt-letter--folded fade-in" onClick={() => patchBrief(todayIso, { dismissed: false })}>
        <Icon name="scroll" size={12} />
        <span className="yzt-letter-folded-text">{facts}</span>
        <Kbd>B</Kbd>
      </button>
    );
  }
  const lines = letterLines(briefData);
  return (
    <div className="yzt-letter yz-washi fade-in">
      <span className="yzt-letter-seal" aria-hidden>印</span>
      <div className="yzt-letter-bar">
        <h2 className="yz-sec">Morning letter</h2>
        <div style={{ flex: 1 }} />
        <button type="button" className="yz-icon-btn" title="Regenerate"
          onClick={() => patchBrief(todayIso, { attempted: false, text: null, order: null })}>
          <Icon name="reset" size={11} />
        </button>
        <button type="button" className="yz-icon-btn" title="Collapse (B)" aria-label="Collapse brief"
          onClick={() => patchBrief(todayIso, { dismissed: true })}>
          <Icon name="close" size={11} />
        </button>
      </div>
      <div className="yzt-letter-prose">
        {lines.map((line, i) => (
          <p key={i} className={line.kind === "ink" ? "yzt-letter-ink" : undefined}>{line.text}</p>
        ))}
      </div>
      {brief.text ? (
        <>
          <div className="yzt-letter-body">{brief.text}</div>
          {brief.order?.length > 1 && (
            <button type="button" className="yz-btn yz-btn--ghost yz-btn--sm" style={{ marginTop: 10 }}
              onClick={() => applyBriefOrder(brief.order)}>
              Apply suggested order
            </button>
          )}
        </>
      ) : brief.attempted && aiStatus !== "busy" ? (
        <div className="yzt-letter-away">
          The Attendant is away — the house runs itself.{" "}
          <button type="button" className="yz-link" onClick={() => patchBrief(todayIso, { attempted: false })}>Retry</button>
        </div>
      ) : (
        <div className="yzt-letter-away">The Attendant is writing…</div>
      )}
    </div>
  );
}

function letterLines(briefData) {
  const lines = [];
  const y = briefData.yesterday;
  if (y.count > 0) {
    const focus = y.focusMs ? `, ${D.fmtMs(y.focusMs)} focused` : "";
    lines.push({ kind: "body", text: `Yesterday: ${y.count} done, ${y.xp} XP${focus}.` });
  } else {
    lines.push({ kind: "body", text: "Yesterday was quiet." });
  }
  if (briefData.adrift === 1) lines.push({ kind: "body", text: "One leaf has fallen." });
  else if (briefData.adrift > 1) lines.push({ kind: "body", text: `${briefData.adrift} leaves have fallen.` });
  if (briefData.dayOff) {
    const n = briefData.lineup.length;
    lines.push({ kind: "body", text: `A rest day — yet ${n} ${n === 1 ? "task is" : "tasks are"} lined up.` });
  } else {
    const n = briefData.lineup.length;
    lines.push({ kind: "body", text: `Today holds ${n} ${n === 1 ? "task" : "tasks"} — ${briefData.lineupHours}h of your ${briefData.capacity}h.` });
    if (briefData.overloaded) lines.push({ kind: "ink", text: "The sheet is overloaded." });
  }
  for (const d of briefData.deadlinesSoon || []) {
    const when = d.overdue ? "Overdue" : d.days === 0 ? "Due today" : d.days === 1 ? "Due tomorrow" : `Due in ${d.days} days`;
    lines.push({ kind: "ink", text: `${when}: ${d.title}.` });
  }
  return lines;
}

function collapsedFacts(briefData) {
  const bits = [
    briefData.yesterday.count > 0
      ? `Yesterday: ${briefData.yesterday.count} done, ${briefData.yesterday.xp} XP${briefData.yesterday.focusMs ? `, ${D.fmtMs(briefData.yesterday.focusMs)} focused` : ""}`
      : "Yesterday was quiet",
    briefData.adrift === 1 ? "one leaf has fallen" : briefData.adrift > 1 ? `${briefData.adrift} leaves have fallen` : null,
    briefData.dayOff
      ? "a rest day"
      : `${briefData.lineupHours}h of ${briefData.capacity}h`,
  ].filter(Boolean);
  return bits.join(". ") + ".";
}

function InHand({ lineup, projectsById, todayIso, hour, dayClosed, openTask }) {
  const pendingRows = lineup.filter((r) => !r.doneHere);
  const nowRow = pendingRows[0];
  const nextRow = pendingRows[1];
  if (!nowRow) {
    return (
      <div className="yzt-tended fade-in">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="yz-sec" style={{ marginBottom: 6 }}>Day cleared</h2>
          <div className="yz-display" style={{ fontSize: 22, color: "var(--sumi)" }}>
            The garden is tended. The evening is yours.
          </div>
        </div>
        {!dayClosed && (
          <button type="button" className="yz-btn yz-btn--ink" onClick={() => setUI({ endOfDayOpen: true })}>
            <Icon name="lantern" size={12} /> Close the amado
          </button>
        )}
      </div>
    );
  }
  const nowProject = nowRow.task.projectId ? projectsById.get(nowRow.task.projectId) : null;
  const focusMin = D.todayFocusMs(nowRow.task, hour);
  const diff = D.DIFFICULTY[nowRow.task.difficulty] || D.DIFFICULTY.medium;
  return (
    <div className="yzt-hand-wrap fade-in">
      <div className="yzt-hand">
        <span className="yzt-hand-seal" aria-hidden>now</span>
        <div className="yzt-hand-copy">
          <h2 className="yz-sec">In hand</h2>
          <button type="button" className="yzt-hand-title yz-display" onClick={() => openTask(nowRow.task.id)}>
            {nowRow.task.title}
          </button>
          <div className="yzt-hand-meta">
            {nowProject && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <i className="yz-dot" style={{ background: nowProject.color || "var(--sumi)" }} />
                {nowProject.title}
              </span>
            )}
            {nowRow.chunkNote && <span style={{ fontStyle: "italic" }}>{nowRow.chunkNote}</span>}
            <span>~{nowRow.chunk?.hours ?? D.taskHours(nowRow.task)}h{focusMin > 0 ? ` · ${D.fmtMs(focusMin)} so far` : ""}</span>
            <span>{diff.label} · <span className="yz-num">+{nowRow.task.xp}</span> XP</span>
          </div>
        </div>
        <div className="yzt-hand-actions">
          <button type="button" className="yz-btn yz-btn--blossom"
            onClick={() => setCompletion(nowRow.task.id, { done: true, chunkDate: nowRow.chunk ? todayIso : null })}>
            Complete
          </button>
          <button type="button" className="yz-btn yz-btn--ghost" onClick={() => setUI({ focusTaskId: nowRow.task.id })}>
            Focus <Kbd>F</Kbd>
          </button>
        </div>
      </div>
      {nextRow && (
        <button type="button" className="yzt-then" onClick={() => openTask(nextRow.task.id)}>
          <span className="yz-label yz-label--sumi">Then</span>
          <span className="yzt-then-title">{nextRow.task.title}</span>
        </button>
      )}
    </div>
  );
}

export function EnergyToggle() {
  return <PaceToggle />;
}

function PaceToggle() {
  const energy = useStore((s) => s.ui.energy);
  const opts = [
    { id: "low", label: "Gentle", title: "Surface easy tasks first" },
    { id: "normal", label: "Auto", title: "Sort by priority" },
    { id: "high", label: "Push", title: "Surface hard tasks first" },
  ];
  return (
    <div className="yz-seg yzt-pace" role="group" aria-label="Pace">
      <span className="yzt-pace-label yz-label yz-label--sumi">Pace</span>
      {opts.map((o) => (
        <button key={o.id} type="button" title={o.title} aria-pressed={energy === o.id}
          className={energy === o.id ? "is-on" : ""}
          onClick={() => setUI({ energy: o.id })}>{o.label}</button>
      ))}
    </div>
  );
}

function InkSpark({ data, height = 28 }) {
  const ref = useRef(null);
  const key = JSON.stringify(data);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !data || data.length < 2) return;
    const ctx = cv.getContext("2d");
    const W = (cv.width = Math.max(72, cv.offsetWidth || 120) * 2);
    const H = (cv.height = height * 2);
    const max = Math.max(...data, 1);
    ctx.clearRect(0, 0, W, H);
    const px = (i) => (i / (data.length - 1)) * (W - 8) + 4;
    const py = (v) => H - 6 - (v / max) * (H - 14);
    for (let gx = 0; gx < W; gx += 3) {
      const t = gx / W;
      const i = Math.min(data.length - 2, Math.floor(t * (data.length - 1)));
      const f = t * (data.length - 1) - i;
      const v = data[i] + (data[i + 1] - data[i]) * f;
      const top = py(v);
      for (let gy = Math.floor(top); gy < H; gy += 3) {
        const depth = (gy - top) / (H - top || 1);
        if (bayerAt(gx / 3, gy / 3) < 0.4 * (1 - depth * 0.75)) {
          ctx.fillStyle = "rgba(42,36,51,0.28)";
          ctx.fillRect(gx, gy, 2, 2);
        }
      }
    }
    ctx.strokeStyle = "#2a2433";
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((v, i) => { i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v)); });
    ctx.stroke();
    ctx.fillStyle = "#b05a80";
    ctx.fillRect(px(data.length - 1) - 2.5, py(data[data.length - 1]) - 2.5, 5, 5);
  }, [key, height]);
  return <canvas ref={ref} className="yzt-spark" style={{ width: "100%", height, display: "block" }} aria-hidden />;
}

function WeekDots({ week }) {
  return (
    <div className="yzt-dots" role="img" aria-label="This week's activity">
      {week.map((d, i) => (
        <span
          key={i}
          className={"yzt-wd" + (d.value > 0 ? " yzt-wd--on" : "") + (d.isToday ? " yzt-wd--today" : "")}
          title={d.title}
        />
      ))}
    </div>
  );
}

function DoneBars({ data }) {
  const top = Math.max(1, ...(data || [0]));
  return (
    <div className="yzt-bars" aria-hidden>
      {(data || []).map((v, i) => (
        <div key={i} className="yzt-bar" title={`${v}`}>
          <i style={{ height: (v / top) * 100 + "%" }} />
        </div>
      ))}
    </div>
  );
}
