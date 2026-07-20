// today.jsx — the night deck. Nightwatch composition: harbor strip is
// in the shell; here: ghost day-numeral header, the HORIZON (the
// screen's window, HUD derived from real state), the command slab,
// the bridge (XP / streak / focus / lined-up gauges), the ON DECK
// statement, adrift triage, the indexed lineup ledger, and the rail
// (ready to launch · next up · signal log).
// All state, handlers, and data flow identical to the core contract.

import React, { useEffect, useMemo, useState } from "react";
import { Icon, Eyebrow, EmptyState, GhostFoot, Kbd, Stamp, HLight } from "../components.jsx";
import { Spark, WeekBars } from "../charts.jsx";
import { GhostNumeral, Horizon } from "../chrome.jsx";
import { CaptureSlab } from "../capture.jsx";
import { TaskRow, ChunksEditor } from "../taskrow.jsx";
import * as D from "../../../core/domain.js";
import { statementBg, plateFade } from "../texture.js";
import {
  useStore, getState, setUI, setCompletion, todayLineup,
  dismissChunk, moveChunkDate, patchScreenToday, reopenDay,
  enterPreview, setLineupOrder, ensureMorningBrief, patchBrief, applyBriefOrder,
  reviewPromptDue, openReview, patchReview,
} from "../../../core/store.js";
import { generateBriefProse } from "../../../core/enrich.js";
import { registerActiveList } from "../../../core/keys.js";

export function TodayView() {
  const tasks = useStore((s) => s.tasks);
  const plan = useStore((s) => s.plan);
  const projects = useStore((s) => s.projects);
  const screen = useStore((s) => s.screen);
  const caps = useStore((s) => s.caps);
  const sessions = useStore((s) => s.sessions);
  const briefs = useStore((s) => s.briefs);
  const aiStatus = useStore((s) => s.ui.aiStatus);
  const meta = useStore((s) => s.meta);
  const energy = useStore((s) => s.ui.energy);
  const cursor = useStore((s) => s.ui.cursor);
  const [exp, setExp] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const hour = meta.dayStartHour || 0;
  const todayIso = D.effectiveTodayIso(hour);
  const s = getState();
  const lineup = useMemo(() => todayLineup(s), [tasks, plan, energy, hour, meta]);
  const missed = useMemo(() => D.getMissedWork(tasks, plan, hour), [tasks, plan, hour]);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

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
  useEffect(() => { ensureMorningBrief(); }, [todayIso]);
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
      week,
      focusToday,
    };
  }, [tasks, plan, sessions, hour, todayIso]);

  const pending = tasks.filter((t) => !t.completed && t.recurring === "none");
  const readyToShip = projects.filter((p) => !p.completedAt && (p.childTaskIds || []).length > 0 && D.progressOfProject(p, tasksById) === 100);
  const planDone = lineup.filter((r) => r.doneHere).length;

  const hourNow = new Date().getHours();
  const allDone = lineup.length > 0 && planDone === lineup.length;
  const greeting = allDone ? "Clear skies. The dome is quiet."
    : lineup.length === 0 && pending.length === 0 ? "Empty program. Log a sighting."
    : hourNow < 5 ? "Late watch under the dome."
    : hourNow < 12 ? "Morning. Open the dome."
    : hourNow < 14 ? "Midday. Keep moving."
    : hourNow < 18 ? "Back at it."
    : hourNow < 22 ? "Evening push."
    : "Still at the eyepiece.";

  const entry = screen[todayIso] || { xOpens: 0, ytOpens: 0, mobileHours: null };
  const dayClosed = meta.dayClosed && meta.dayClosed.date === todayIso ? meta.dayClosed : null;
  const upcoming = (plan || []).filter((e) => e.date > todayIso && e.items.length).sort((a, b) => a.date.localeCompare(b.date))[0];

  let cursorIdx = cursor ? cursor.index : -1;
  const dueWeek = reviewPromptDue(getState());

  const xpLeft = lineup.reduce((s2, r) => s2 + (r.doneHere ? 0 : (r.task.xp || 0)), 0);
  const fmtFocus = (ms) => {
    const min = Math.round(ms / 60000);
    return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
  };

  const hud = [
    { label: "SKY CAM 01" },
    { label: "PHOTONS", value: stats.todayXP > 0 ? `FLOOD +${stats.todayXP}XP` : "SLACK" },
    { label: "HW", value: upcoming ? D.fmtIsoShort(upcoming.date).toUpperCase() : "—" },
    { right: true, items: [
      { label: "ADRIFT", value: missed.length ? `${missed.length} ADRIFT` : "0.0M" },
      { label: "SEEING", value: stats.streakRun > 0 ? `${stats.streakRun}D CLEAR` : "FOG" },
    ] },
  ];

  return (
    <div className="view-pad">
      <div className="header-band">
        <GhostNumeral text={String(new Date().getDate()).padStart(2, "0")} />
        {dayClosed && (
          <div className="plate plate--flush fade-in" style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 14px", marginBottom: 16 }}>
            <Icon name="moon" size={13} />
            <span className="w-num" style={{ fontSize: 11, color: "var(--fg-dim)", flex: 1 }}>
              DAY CLOSED · {new Date(dayClosed.closedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toUpperCase()}
            </span>
            <button className="link" onClick={reopenDay}>Reopen</button>
          </div>
        )}
        <div className="w-stencil-row" style={{ marginBottom: 10 }}>
          <span className="w-stencil w-stencil--lit">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
        </div>
        <div className="greeting-row">
          <h1 className="w-display greeting">{greeting}</h1>
          <div className="yard-count w-num">
            {pending.length} IN THE PROGRAM · {lineup.length} SCHEDULED{readyToShip.length ? <span style={{ color: "var(--starboard)" }}> · {readyToShip.length} READY</span> : null}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <Horizon hud={hud} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <CaptureSlab scheduleToday />
        </div>

        {/* the bridge */}
        <div className="bridge" style={{ marginBottom: 26 }}>
          <div className="gauge">
            <div className="gauge-head">
              <span className="w-stencil" style={{ fontSize: 9 }}>Today's XP</span>
              {stats.xpTrend != null && (
                <span className="gauge-trend w-num" style={{ color: stats.xpTrend > 0 ? "var(--starboard)" : stats.xpTrend < 0 ? "var(--port)" : "var(--fg-faint)" }}>
                  {stats.xpTrend > 0 ? "▲" : stats.xpTrend < 0 ? "▼" : "·"}{Math.abs(stats.xpTrend)}%
                </span>
              )}
            </div>
            <div className="bignum"><span className="n w-display w-num">{stats.todayXP}</span><span className="unit w-stencil">XP</span></div>
            <div style={{ margin: "8px -14px 0 -16px" }}><Spark data={stats.xp7} /></div>
          </div>
          <div className="gauge">
            <div className="gauge-head">
              <span className="w-stencil" style={{ fontSize: 9 }}>Streak</span>
              <span className="gauge-trend w-num" style={{ color: "var(--fg-faint)" }}>
                {stats.streakRun === 0 ? "LAUNCH SOMETHING" : stats.doneToday > 0 ? "SECURED TODAY" : "COMPLETE 1 TO KEEP IT"}
              </span>
            </div>
            <div className="bignum"><span className="n w-display w-num">{stats.streakRun}</span><span className="unit w-stencil">DAYS</span></div>
            <div style={{ marginTop: 8 }}><WeekBars data={stats.week} /></div>
          </div>
          <div className="gauge">
            <div className="gauge-head">
              <span className="w-stencil" style={{ fontSize: 9 }}>Focus</span>
              <span className="gauge-trend w-num" style={{ color: "var(--fg-faint)" }}>{stats.doneToday} DONE{stats.doneTrend != null ? ` · ${stats.doneTrend > 0 ? "▲" : stats.doneTrend < 0 ? "▼" : "·"}${Math.abs(stats.doneTrend)}%` : ""}</span>
            </div>
            <div className="bignum"><span className="n w-display w-num">{fmtFocus(stats.focusToday)}</span><span className="unit w-stencil">HRS</span></div>
            <div className="diff-tally">
              {["epic", "hard", "medium", "easy"].map((d) => {
                const count = pending.filter((t) => t.difficulty === d).length;
                return count > 0 ? (
                  <span key={d} title={`${count} ${d} pending`}><i style={{ background: D.DIFFICULTY[d].tone }} />{count} {d.toUpperCase()}</span>
                ) : null;
              })}
            </div>
          </div>
          <div className="gauge">
            <div className="gauge-head"><span className="w-stencil" style={{ fontSize: 9 }}>Lined up</span></div>
            <div className="bignum"><span className="n w-display w-num">{planDone}</span><span className="dim w-display w-num"> / {lineup.length}</span></div>
            <div style={{ marginTop: 14 }}>
              <div className="meter"><div className="meter-fill" style={{ width: (lineup.length ? (planDone / lineup.length) * 100 : 0) + "%", backgroundColor: "var(--starboard)" }} /></div>
            </div>
            <div className="gauge-hint w-num">{xpLeft} XP LEFT ON THE SLATE</div>
          </div>
        </div>
      </div>

      {/* deck grid */}
      <div className="deck-grid">
        <div className="work-col">
          {dueWeek && (
            <div className="fade-in" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span className="w-tape w-tape--channel">Review due</span>
              <span style={{ fontSize: 12.5, color: "var(--fg-dim)", flex: 1 }}>Last week is in the books — worth two minutes of hindsight.</span>
              <button className="bezel bezel--sm" onClick={() => openReview(dueWeek)}>Review <Kbd>W</Kbd></button>
              <button className="icon-btn" aria-label="Dismiss review prompt" onClick={() => patchReview(dueWeek, { promptDismissed: true })}>
                <Icon name="close" size={11} />
              </button>
            </div>
          )}

          {/* the telegram brief */}
          {brief && (brief.dismissed ? (
            <button className="fade-in w-stencil" onClick={() => patchBrief(todayIso, { dismissed: false })}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", marginBottom: 16, padding: "6px 10px", background: "var(--plate)", border: "none", cursor: "pointer", boxShadow: "inset 0 1px 0 var(--line-dim)" }}>
              <Icon name="bolt" size={10} /> Morning brief <span style={{ marginLeft: "auto" }} className="kbd">B</span>
            </button>
          ) : (
            <div className="plate fade-in" style={{ marginBottom: 18, "--u-fade": plateFade("brief-" + todayIso) }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px 0" }}>
                <span className="w-tape">Morning brief</span>
                <span className="w-num" style={{ fontSize: 10, color: "var(--fg-faint)" }}>
                  {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).toUpperCase()}
                </span>
                <div className="w-stencil-row" style={{ flex: 1 }}><span /></div>
                <button className="icon-btn" title="Regenerate the written brief"
                  onClick={() => patchBrief(todayIso, { attempted: false, text: null, order: null })}>
                  <Icon name="reset" size={11} />
                </button>
                <button className="icon-btn" title="Collapse (B)" aria-label="Collapse brief"
                  onClick={() => patchBrief(todayIso, { dismissed: true })}>
                  <Icon name="close" size={11} />
                </button>
              </div>
              <div style={{ padding: "10px 14px 14px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: brief.text || brief.attempted ? 10 : 0 }}>
                  <Stamp>{briefData.yesterday.count > 0
                    ? `yesterday ${briefData.yesterday.count} done · ${briefData.yesterday.xp} XP${briefData.yesterday.focusMs ? " · " + D.fmtMs(briefData.yesterday.focusMs) : ""}`
                    : "yesterday quiet"}</Stamp>
                  {briefData.adrift > 0 && <Stamp tone="var(--warn)">{`${briefData.adrift} adrift`}</Stamp>}
                  <Stamp tone={briefData.overloaded ? "var(--port)" : undefined}>
                    {briefData.dayOff
                      ? `day off · ${briefData.lineup.length} lined up anyway`
                      : `today ${briefData.lineup.length} tasks · ${briefData.lineupHours}h of ${briefData.capacity}h${briefData.overloaded ? " — OVERLOADED" : ""}`}
                  </Stamp>
                  {briefData.deadlinesSoon.map((d) => (
                    <Stamp key={d.title} tone={d.overdue ? "var(--port)" : "var(--warn)"}>
                      {`${d.overdue ? "OVERDUE" : d.days === 0 ? "due today" : "due " + d.days + "d"}: ${d.title.slice(0, 30)}`}
                    </Stamp>
                  ))}
                </div>
                {brief.text ? (
                  <>
                    <div className="brief-body">{brief.text}</div>
                    {brief.order?.length > 1 && (
                      <button className="bezel bezel--sm" style={{ marginTop: 10 }}
                        onClick={() => applyBriefOrder(brief.order)}>
                        Apply suggested run order
                      </button>
                    )}
                  </>
                ) : brief.attempted && aiStatus !== "busy" ? (
                  <div className="w-num" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                    AI OFF — THE NUMBERS ABOVE ARE THE BRIEF.{" "}
                    <button className="link" style={{ fontSize: 10 }} onClick={() => patchBrief(todayIso, { attempted: false })}>retry</button>
                  </div>
                ) : (
                  <div className="w-num" style={{ fontSize: 11, color: "var(--fg-faint)" }}>WRITING THE BRIEF…</div>
                )}
              </div>
            </div>
          ))}

          {/* ON DECK statement */}
          {lineup.length > 0 && (() => {
            const pendingRows = lineup.filter((r) => !r.doneHere);
            const nowRow = pendingRows[0];
            const nextRow = pendingRows[1];
            if (!nowRow) {
              return (
                <div className="statement fade-in" style={{ marginBottom: 18, padding: "16px 20px 18px", ...statementBg("cleared-" + todayIso, "#06170e", "#3fd68f"), display: "flex", alignItems: "center", gap: 14 }}>
                  <Icon name="ship" size={20} />
                  <div style={{ flex: 1 }}>
                    <div className="w-stencil" style={{ marginBottom: 4 }}>Day cleared</div>
                    <div className="w-display" style={{ fontSize: 21 }}>Everything on the slate is done. Harbor's quiet.</div>
                  </div>
                  {!dayClosed && (
                    <button className="switch switch--sm switch--ink" style={{ color: "var(--starboard)" }} onClick={() => setUI({ endOfDayOpen: true })}>
                      <Icon name="moon" size={11} /> Close the day
                    </button>
                  )}
                </div>
              );
            }
            const nowProject = nowRow.task.projectId ? projectsById.get(nowRow.task.projectId) : null;
            const focusMin = D.todayFocusMs(nowRow.task, hour);
            return (
              <div className="fade-in" style={{ marginBottom: 18 }}>
                <div className="statement ondeck" style={{ ...statementBg("ondeck-" + nowRow.task.id) }}>
                  <div className="ondeck-top">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="w-stencil" style={{ marginBottom: 6 }}>Current target</div>
                      <div className="w-display ondeck-title">{nowRow.task.title}</div>
                      <div className="ondeck-meta w-num">
                        {nowProject && <span>▸ {nowProject.title.toUpperCase()}</span>}
                        {nowRow.chunkNote && <span style={{ fontStyle: "italic" }}>{nowRow.chunkNote}</span>}
                        <span>~{nowRow.chunk?.hours ?? D.taskHours(nowRow.task)}H{focusMin > 0 ? ` · ${D.fmtMs(focusMin)} IN` : ""}</span>
                        <span>{(nowRow.task.difficulty || "medium").toUpperCase()} · +{nowRow.task.xp} XP</span>
                      </div>
                    </div>
                    <button type="button" className="complete-light"
                      title="Complete now" aria-label="Complete current task"
                      onClick={() => setCompletion(nowRow.task.id, { done: true, chunkDate: nowRow.chunk ? todayIso : null })} />
                    <button onClick={() => setUI({ focusTaskId: nowRow.task.id })} className="switch switch--ink">
                      ▶ Focus <span style={{ opacity: 0.7 }}>F</span>
                    </button>
                  </div>
                </div>
                {nextRow && (
                  <div className="next-strip">
                    <span className="w-stencil">Next</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nextRow.task.title}</span>
                    <span className="w-num" style={{ fontSize: 9.5, color: "var(--fg-faint)" }}>[ ] REORDER</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* adrift hazard */}
          {missed.length > 0 && (
            <div className="hazard fade-in" style={{ marginBottom: 18, padding: "12px 14px 12px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span className="w-tape w-tape--warn">Adrift</span>
                <span className="w-num" style={{ fontSize: 10.5, color: "var(--fg-dim)" }}>{missed.length} PAST ITEM{missed.length === 1 ? "" : "S"}</span>
              </div>
              <div className="ledger">
                {missed.map(({ date, taskId, task, item }, i) => {
                  const project = task.projectId ? projectsById.get(task.projectId) : null;
                  const daysAgo = Math.max(1, Math.round((D.parseIsoDate(todayIso) - D.parseIsoDate(date)) / 86400000));
                  return (
                    <div key={`${date}-${taskId}`}
                      className={"lrow" + (cursorIdx === i ? " lrow--cursor" : "")}
                      style={{ "--row-lamp": project?.color || "var(--warn)" }}>
                      <span className="lrow-bracket" aria-hidden />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="lrow-title">{task.title}</div>
                        <div className="lrow-meta w-num">
                          <span style={{ color: "var(--warn)" }}>{daysAgo}D ADRIFT</span>
                          {project && <span style={{ color: project.color }}>{project.title.toUpperCase()}</span>}
                          {item.hours && <span>{item.hours}H CHUNK</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                        <button className="bezel bezel--sm" onClick={() => moveChunkDate(taskId, date, todayIso)} title="Tow into today">Today</button>
                        <button className="bezel bezel--sm bezel--starboard" onClick={() => setCompletion(taskId, { done: true, chunkDate: date })} title="It actually got done — mark it">Done</button>
                        <button className="icon-btn" onClick={() => dismissChunk(taskId, date)} title="Strike from the plan (undoable)" aria-label="Dismiss"><Icon name="close" size={11} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* the lineup */}
          <div className="section-head">
            <div className="w-stencil-row" style={{ flex: 1 }}>
              <span className="w-stencil">Observing program</span>
            </div>
            <EnergyToggle />
            {stats.doneToday > 0 && !dayClosed && (
              <button className="link" onClick={() => setUI({ endOfDayOpen: true })}>Close day →</button>
            )}
          </div>

          {lineup.length > 0 ? (
            <>
              <div className="plate plate--flush ledger">
                {lineup.map((r, i) => {
                  const globalIdx = missed.length + i;
                  const chunks = r.chunk ? D.getTaskChunks(r.task.id, plan) : [];
                  return (
                    <div key={r.task.id}
                      draggable
                      onDragStart={(e) => { setDragIdx(i); e.dataTransfer.effectAllowed = "move"; }}
                      onDragOver={(e) => { e.preventDefault(); if (dragOverIdx !== i) setDragOverIdx(i); }}
                      onDragLeave={() => { if (dragOverIdx === i) setDragOverIdx(null); }}
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
                      onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                      style={{
                        opacity: dragIdx === i ? 0.4 : 1,
                        boxShadow: dragOverIdx === i && dragIdx !== null && dragIdx !== i ? "inset 0 2px 0 var(--amber)" : "none",
                      }}>
                      <TaskRow
                        task={r.task}
                        index={i}
                        project={r.task.projectId ? projectsById.get(r.task.projectId) : null}
                        doneHere={r.doneHere}
                        onToggleDone={(done) => setCompletion(r.task.id, { done, chunkDate: r.chunk ? todayIso : null })}
                        chunkNote={r.chunkNote} chunkLabel={r.chunkLabel}
                        isCursor={cursorIdx === globalIdx}
                        onHoverCursor={() => setUI({ cursor: { index: globalIdx } })}
                        expanded={exp === r.task.id}
                        onToggleExpand={() => setExp(exp === r.task.id ? null : r.task.id)}
                        extraExpanded={chunks.length > 1 ? <ChunksEditor task={r.task} chunks={chunks} dayStartHour={hour} /> : null}
                        dayStartHour={hour}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="w-num" style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 8, fontSize: 9.5, color: "var(--fg-faint)", flexWrap: "wrap" }}>
                <span>{planDone}/{lineup.length} DONE</span>
                <span>J/K MOVE · X COMPLETE · [ ] REORDER · DRAG</span>
              </div>
            </>
          ) : (
            <EmptyState caption="nothing moored">
              {pending.length === 0 ? (
                <>
                  <div className="w-display" style={{ fontSize: 17, color: "var(--fg)", marginBottom: 8 }}>Nothing in the observatory.</div>
                  <div>Type in the command slab above — it lands right here, scheduled for today.</div>
                  {tasks.length === 0 && projects.length === 0 && (
                    <div style={{ marginTop: 16 }}>
                      <button className="bezel" onClick={enterPreview}>
                        <Icon name="bolt" size={11} /> Try with sample data
                      </button>
                      <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 8 }}>
                        Loads a demo yard — your (empty) data is snapshotted and restored on exit.
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="w-display" style={{ fontSize: 17, color: "var(--fg)", marginBottom: 8 }}>Nothing lined up for today.</div>
                  <div style={{ marginBottom: 14 }}>
                    {upcoming
                      ? <>Next planned day: {D.fmtIsoShort(upcoming.date)} · {upcoming.items.length} task{upcoming.items.length > 1 ? "s" : ""}.</>
                      : <>{pending.length} task{pending.length > 1 ? "s" : ""} waiting in the observatory.</>}
                  </div>
                  <button className="bezel" onClick={() => setUI({ view: "plan" })}>Open the plan</button>
                </>
              )}
            </EmptyState>
          )}
        </div>

        {/* the rail */}
        <aside className="rail-col">
          {readyToShip.length > 0 && (
            <div className="rail-section">
              <div style={{ marginBottom: 10 }}><span className="w-tape w-tape--starboard">Ready to launch</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {readyToShip.slice(0, 4).map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--starboard)", boxShadow: "0 0 8px 0 var(--starboard)", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                    <button className="switch switch--launch switch--sm" onClick={() => setUI({ view: "dock" })}>Publish</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rail-section">
            <div className="w-stencil-row" style={{ marginBottom: 10 }}>
              <span className="w-stencil">Next up{upcoming ? ` · ${D.fmtIsoShort(upcoming.date)}` : ""}</span>
            </div>
            {upcoming ? (
              <>
                <div className="rail-tide">
                  {upcoming.items.slice(0, 4).map((it) => {
                    const t = tasksById.get(it.taskId);
                    if (!t) return null;
                    return (
                      <div key={it.taskId} className="rail-tide-row">
                        <i />
                        <span>
                          {t.title}{it.note ? <span style={{ color: "var(--fg-faint)", fontStyle: "italic" }}> — {it.note}</span> : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button className="link" style={{ marginTop: 10 }} onClick={() => setUI({ view: "plan" })}>Plan →</button>
              </>
            ) : (
              <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>Nothing on the slipway yet.</div>
            )}
          </div>

          <div className="rail-section">
            <div className="w-stencil-row" style={{ marginBottom: 10 }}>
              <span className="w-stencil">Signal log</span>
            </div>
            <div className="screen-grid">
              {[{ label: "X opens", key: "xOpens" }, { label: "YT opens", key: "ytOpens" }].map((item) => {
                const count = entry[item.key] || 0;
                return (
                  <div key={item.key} className="plate plate--flush" style={{ padding: "9px 10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                      <span className="w-stencil" style={{ fontSize: 8.5 }}>{item.label}</span>
                      <span className="w-display w-num" style={{ fontSize: 19 }}>{count}</span>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="bezel bezel--sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => patchScreenToday({ [item.key]: count + 1 })}>+1</button>
                      {count > 0 && <button className="bezel bezel--sm" onClick={() => patchScreenToday({ [item.key]: Math.max(0, count - 1) })}>−</button>}
                    </div>
                  </div>
                );
              })}
            </div>
            <MobileHoursInput entry={entry} />
            <button className="link" style={{ marginTop: 10 }} onClick={() => setUI({ statsOpen: true })}>History →</button>
          </div>

          <div className="rail-section">
            <GhostFoot caption="calm waters beyond" />
          </div>
        </aside>
      </div>
    </div>
  );
}

function MobileHoursInput({ entry }) {
  const [v, setV] = useState("");
  if (entry.mobileHours != null) {
    return (
      <div className="w-num" style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--fg-dim)" }}>
        <span>{entry.mobileHours}H ON MOBILE TODAY</span>
        <button className="link" style={{ fontSize: 9.5 }} onClick={() => patchScreenToday({ mobileHours: null })}>clear</button>
      </div>
    );
  }
  const log = () => { if (v) { patchScreenToday({ mobileHours: parseFloat(v) || 0 }); setV(""); } };
  return (
    <div style={{ display: "flex", gap: 5 }}>
      <input type="number" min="0" max="24" step="0.5" placeholder="Mobile hours"
        value={v} onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") log(); }}
        className="field field--mono" style={{ flex: 1 }} />
      <button className="bezel bezel--sm" disabled={!v} onClick={log}>Log</button>
    </div>
  );
}

export function EnergyToggle() {
  const energy = useStore((s) => s.ui.energy);
  const opts = [
    { id: "low", label: "Easy", title: "Surface easy tasks first" },
    { id: "normal", label: "Auto", title: "Sort by priority" },
    { id: "high", label: "Hard", title: "Surface hard tasks first" },
  ];
  return (
    <div className="energy" role="group" aria-label="Energy mode">
      {opts.map((o) => (
        <button key={o.id} type="button" title={o.title} aria-pressed={energy === o.id}
          className={energy === o.id ? "on" : ""}
          onClick={() => setUI({ energy: o.id })}>{o.label}</button>
      ))}
    </div>
  );
}
