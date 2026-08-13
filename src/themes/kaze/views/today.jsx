// today.jsx — Today's Path.
//
// DEPARTURE: the lineup is not a ledger with a decorative path beside
// it — the rows ARE the stations, laid along a single vertical ink
// stroke that runs the height of the list. Weathered (adrift) work
// gets its own stretch of storm-greyed road above today's, exactly the
// triage shape the user's real TickTick day has.
//
// All state, handlers and data flow are the core contract.

import React, { useEffect, useMemo, useState } from "react";
import { Icon, Eyebrow, EmptyState, InkFoot, Kbd, Seal, Charm, Bloom } from "../components.jsx";
import { InkTrace, DayBars } from "../charts.jsx";
import { CaptureNote } from "../capture.jsx";
import { WaypointRow, ChunksEditor } from "../taskrow.jsx";
import * as D from "../../../core/domain.js";
import { leafBg, plateFade, ghostWash, phaseAt, PHASE_LABEL } from "../texture.js";
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

  // Cursor spans BOTH stretches of road: weathered first, then today.
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
      week.push({ label: "MTWTFSS"[i], value: activity.get(iso)?.size || 0, title: `${iso}: ${activity.get(iso)?.size || 0} waypoints`, isToday: iso === todayIso });
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

  const phase = phaseAt();
  const allDone = lineup.length > 0 && planDone === lineup.length;
  const greeting = allDone ? "The road is walked."
    : lineup.length === 0 && pending.length === 0 ? "An empty road. Mark something."
    : phase === "dawn" ? "First light. The road waits."
    : phase === "day" ? "High sun. Keep walking."
    : phase === "golden" ? "Golden hour. The best light for going on."
    : phase === "dusk" ? "The light is leaving. One more stretch."
    : "Night road. Lantern's lit.";

  const entry = screen[todayIso] || { xOpens: 0, ytOpens: 0, mobileHours: null };
  const dayClosed = meta.dayClosed && meta.dayClosed.date === todayIso ? meta.dayClosed : null;
  const upcoming = (plan || []).filter((e) => e.date > todayIso && e.items.length).sort((a, b) => a.date.localeCompare(b.date))[0];

  const cursorIdx = cursor ? cursor.index : -1;
  const dueWeek = reviewPromptDue(getState());
  const xpLeft = lineup.reduce((acc, r) => acc + (r.doneHere ? 0 : (r.task.xp || 0)), 0);
  const fmtWalk = (ms) => {
    const min = Math.round(ms / 60000);
    return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
  };

  const ghostBg = useMemo(() => ghostWash("today-" + todayIso, 300, 180), [todayIso]);

  return (
    <div className="kz-pad">
      <div className="kz-head">
        <div className="kz-ghost" aria-hidden style={{ backgroundImage: ghostBg }}>道</div>

        {dayClosed && (
          <div className="kz-card kz-fade-in" style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 15px", marginBottom: 16 }}>
            <Icon name="fire" size={13} />
            <span className="kz-label" style={{ flex: 1 }}>
              Camp made · {new Date(dayClosed.closedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </span>
            <button className="kz-link" onClick={reopenDay}>Break camp</button>
          </div>
        )}

        <div className="kz-label-row" style={{ marginBottom: 11 }}>
          <span className="kz-label kz-label--lit">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · {PHASE_LABEL[phase]}
          </span>
        </div>

        <div className="kz-greet">
          <h1 className="kz-brush">{greeting}</h1>
          <div className="kz-count">
            {pending.length} in the satchel · {lineup.length} on the path
            {readyToShip.length ? <span style={{ color: "var(--sakura)" }}> · {readyToShip.length} at the gate</span> : null}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <CaptureNote scheduleToday />
        </div>

        {/* charms, not gauges */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(184px, 1fr))", gap: 12, marginBottom: 24 }}>
          <div className="kz-card" style={{ padding: "13px 15px", "--u-fade": plateFade("resolve-" + todayIso) }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <Charm pct={Math.min(100, (stats.todayXP / 150) * 100)} glyph="心"
                title={`${stats.todayXP} resolve gathered today`} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="kz-label">Resolve today</div>
                <div className="kz-brush kz-num" style={{ fontSize: 24, lineHeight: 1.2, color: "var(--sakura)" }}>{stats.todayXP}</div>
              </div>
              {stats.xpTrend != null && (
                <span className="kz-num" style={{ fontSize: 10, color: stats.xpTrend > 0 ? "var(--sakura)" : stats.xpTrend < 0 ? "var(--port)" : "var(--fg-faint)" }}>
                  {stats.xpTrend > 0 ? "▲" : stats.xpTrend < 0 ? "▼" : "·"}{Math.abs(stats.xpTrend)}%
                </span>
              )}
            </div>
            <div style={{ margin: "9px -15px -13px" }}><InkTrace data={stats.xp7} /></div>
          </div>

          <div className="kz-card" style={{ padding: "13px 15px" }}>
            <div className="kz-label" style={{ marginBottom: 4 }}>Wind at your back</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
              <span className="kz-brush kz-num" style={{ fontSize: 24, color: "var(--amber)" }}>{stats.streakRun}</span>
              <span className="kz-label">{stats.streakRun === 1 ? "day" : "days"}</span>
            </div>
            <div style={{ marginTop: 9 }}><DayBars data={stats.week} /></div>
          </div>

          <div className="kz-card" style={{ padding: "13px 15px" }}>
            <div className="kz-label" style={{ marginBottom: 4 }}>Walked today</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
              <span className="kz-brush kz-num" style={{ fontSize: 24, color: "var(--amber)" }}>{fmtWalk(stats.focusToday)}</span>
              <span className="kz-label">
                {stats.doneToday} done{stats.doneTrend != null ? ` · ${stats.doneTrend > 0 ? "▲" : stats.doneTrend < 0 ? "▼" : "·"}${Math.abs(stats.doneTrend)}%` : ""}
              </span>
            </div>
            <div className="kz-tally">
              {["epic", "hard", "medium", "easy"].map((d) => {
                const count = pending.filter((t) => t.difficulty === d).length;
                return count > 0 ? (
                  <span key={d} title={`${count} ${d} waiting`}><i style={{ background: D.DIFFICULTY[d].tone }} />{count} {d}</span>
                ) : null;
              })}
            </div>
          </div>

          <div className="kz-card" style={{ padding: "13px 15px" }}>
            <div className="kz-label" style={{ marginBottom: 4 }}>Waypoints</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span className="kz-brush kz-num" style={{ fontSize: 24, color: "var(--sakura)" }}>{planDone}</span>
              <span className="kz-brush kz-num" style={{ fontSize: 18, color: "var(--fg-faint)" }}>/ {lineup.length}</span>
            </div>
            <div style={{ marginTop: 11 }}>
              <div className="kz-meter">
                <div className="kz-meter-fill" style={{ width: (lineup.length ? (planDone / lineup.length) * 100 : 0) + "%", backgroundColor: "var(--sakura)" }} />
              </div>
            </div>
            <div className="kz-label" style={{ marginTop: 7 }}>{xpLeft} resolve still ahead</div>
          </div>
        </div>
      </div>

      <div className="kz-cols">
        <div>
          {dueWeek && (
            <div className="kz-fade-in" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span className="kz-tape kz-tape--channel">The spring is warm</span>
              <span style={{ fontSize: 12.5, color: "var(--fg-dim)", flex: 1 }}>Last week is behind you — worth two minutes of looking back.</span>
              <button className="kz-btn kz-btn--sm" onClick={() => openReview(dueWeek)}>Reflect <Kbd>W</Kbd></button>
              <button className="kz-icon-btn" aria-label="Dismiss" onClick={() => patchReview(dueWeek, { promptDismissed: true })}>
                <Icon name="close" size={11} />
              </button>
            </div>
          )}

          {/* the morning brief — read of the road ahead */}
          {brief && (brief.dismissed ? (
            <button className="kz-fade-in kz-label" onClick={() => patchBrief(todayIso, { dismissed: false })}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", marginBottom: 16, padding: "7px 11px", background: "var(--plate)", cursor: "pointer" }}>
              <Icon name="wind" size={11} /> Read of the road <span style={{ marginLeft: "auto" }}><Kbd>B</Kbd></span>
            </button>
          ) : (
            <div className="kz-card kz-fade-in" style={{ marginBottom: 18, "--u-fade": plateFade("brief-" + todayIso) }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 15px 0" }}>
                <span className="kz-tape">Read of the road</span>
                <span className="kz-label">
                  {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                </span>
                <div className="kz-label-row" style={{ flex: 1 }}><span /></div>
                <button className="kz-icon-btn" title="Ask again"
                  onClick={() => patchBrief(todayIso, { attempted: false, text: null, order: null })}>
                  <Icon name="reset" size={11} />
                </button>
                <button className="kz-icon-btn" title="Fold away (B)" aria-label="Collapse"
                  onClick={() => patchBrief(todayIso, { dismissed: true })}>
                  <Icon name="close" size={11} />
                </button>
              </div>
              <div style={{ padding: "10px 15px 15px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: brief.text || brief.attempted ? 11 : 0 }}>
                  <Seal>{briefData.yesterday.count > 0
                    ? `yesterday ${briefData.yesterday.count} · ${briefData.yesterday.xp} resolve${briefData.yesterday.focusMs ? " · " + D.fmtMs(briefData.yesterday.focusMs) : ""}`
                    : "yesterday still"}</Seal>
                  {briefData.adrift > 0 && <Seal tone="var(--warn)">{`${briefData.adrift} weathered`}</Seal>}
                  <Seal tone={briefData.overloaded ? "var(--port)" : undefined}>
                    {briefData.dayOff
                      ? `rest day · ${briefData.lineup.length} on the path anyway`
                      : `today ${briefData.lineup.length} · ${briefData.lineupHours}h of ${briefData.capacity}h${briefData.overloaded ? " — too far" : ""}`}
                  </Seal>
                  {briefData.deadlinesSoon.map((d) => (
                    <Seal key={d.title} tone={d.overdue ? "var(--port)" : "var(--warn)"}>
                      {`${d.overdue ? "PAST" : d.days === 0 ? "due today" : "due " + d.days + "d"}: ${d.title.slice(0, 30)}`}
                    </Seal>
                  ))}
                </div>
                {brief.text ? (
                  <>
                    <div style={{ fontSize: 13.5, lineHeight: 1.75, color: "var(--fg-dim)" }}>{brief.text}</div>
                    {brief.order?.length > 1 && (
                      <button className="kz-btn kz-btn--sm" style={{ marginTop: 11 }}
                        onClick={() => applyBriefOrder(brief.order)}>
                        Walk it in this order
                      </button>
                    )}
                  </>
                ) : brief.attempted && aiStatus !== "busy" ? (
                  <div className="kz-label">
                    The oracle is silent — the marks above are the whole read.{" "}
                    <button className="kz-link" onClick={() => patchBrief(todayIso, { attempted: false })}>ask again</button>
                  </div>
                ) : (
                  <div className="kz-label">reading the road…</div>
                )}
              </div>
            </div>
          ))}

          {/* NOW — the next waypoint */}
          {lineup.length > 0 && (() => {
            const pendingRows = lineup.filter((r) => !r.doneHere);
            const nowRow = pendingRows[0];
            const nextRow = pendingRows[1];
            if (!nowRow) {
              return (
                <div className="kz-statement kz-fade-in" style={{ marginBottom: 18, ...leafBg("cleared-" + todayIso, "#f2b7cc", "#fff0f5"), display: "flex", alignItems: "center", gap: 15 }}>
                  <Icon name="petal" size={22} />
                  <div style={{ flex: 1 }}>
                    <div className="kz-label" style={{ marginBottom: 4 }}>The road is walked</div>
                    <div className="kz-brush" style={{ fontSize: 21 }}>Everything you set out to do is behind you.</div>
                  </div>
                  {!dayClosed && (
                    <button className="kz-btn" style={{ borderColor: "var(--ink)", color: "var(--ink)" }} onClick={() => setUI({ endOfDayOpen: true })}>
                      <Icon name="fire" size={12} /> Make camp
                    </button>
                  )}
                </div>
              );
            }
            const nowProject = nowRow.task.projectId ? projectsById.get(nowRow.task.projectId) : null;
            const walked = D.todayFocusMs(nowRow.task, hour);
            return (
              <div className="kz-fade-in" style={{ marginBottom: 18 }}>
                <div className="kz-statement kz-now" style={{ ...leafBg("now-" + nowRow.task.id) }}>
                  <div className="kz-now-top">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="kz-label" style={{ marginBottom: 6 }}>The wind points here</div>
                      <div className="kz-brush kz-now-title">{nowRow.task.title}</div>
                      <div className="kz-now-meta">
                        {nowProject && <span>▸ {nowProject.title}</span>}
                        {nowRow.chunkNote && <span style={{ fontStyle: "italic", textTransform: "none" }}>{nowRow.chunkNote}</span>}
                        <span>~{nowRow.chunk?.hours ?? D.taskHours(nowRow.task)}H{walked > 0 ? ` · ${D.fmtMs(walked)} walked` : ""}</span>
                        <span>{nowRow.task.difficulty || "medium"} · +{nowRow.task.xp} resolve</span>
                      </div>
                    </div>
                    <button type="button" className="kz-now-done"
                      title="Reached it" aria-label="Complete current waypoint"
                      onClick={() => setCompletion(nowRow.task.id, { done: true, chunkDate: nowRow.chunk ? todayIso : null })} />
                    <button onClick={() => setUI({ focusTaskId: nowRow.task.id })} className="kz-btn"
                      style={{ borderColor: "var(--ink)", color: "var(--ink)" }}>
                      <Icon name="lantern" size={12} /> Meditate <span style={{ opacity: .7 }}>F</span>
                    </button>
                  </div>
                </div>
                {nextRow && (
                  <div className="kz-next-strip">
                    <span className="kz-label">Then</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nextRow.task.title}</span>
                    <span className="kz-label">[ ] to reorder</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Weathered — the stretch of road behind you, still unwalked */}
          {missed.length > 0 && (
            <div className="kz-weather-band kz-fade-in">
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
                <span className="kz-tape kz-tape--warn">Weathered</span>
                <span className="kz-label">{missed.length} waypoint{missed.length === 1 ? "" : "s"} the weather got to</span>
              </div>
              <div className="kz-road kz-road--weathered">
                {missed.map(({ date, taskId, task, item }, i) => {
                  const project = task.projectId ? projectsById.get(task.projectId) : null;
                  const daysAgo = Math.max(1, Math.round((D.parseIsoDate(todayIso) - D.parseIsoDate(date)) / 86400000));
                  return (
                    <div key={`${date}-${taskId}`}
                      className={"kz-station kz-station--weathered" + (cursorIdx === i ? " kz-station--here" : "")}>
                      <div className={"kz-stone" + (cursorIdx === i ? " kz-stone--cursor" : "")}
                        style={{ "--row-lamp": project?.color || "var(--warn)" }}
                        onMouseEnter={() => setUI({ cursor: { index: i } })}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="kz-stone-title">{task.title}</div>
                          <div className="kz-stone-meta">
                            <span style={{ color: "var(--warn)" }}>{daysAgo}d weathered</span>
                            {project && <span style={{ color: project.color }}>{project.title}</span>}
                            {item.hours && <span>{item.hours}h</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                          <button className="kz-btn kz-btn--sm" onClick={() => moveChunkDate(taskId, date, todayIso)} title="Carry it into today">Carry</button>
                          <button className="kz-btn kz-btn--sm kz-btn--sakura" onClick={() => setCompletion(taskId, { done: true, chunkDate: date })} title="It was done after all — mark it there">Done</button>
                          <button className="kz-icon-btn" onClick={() => dismissChunk(taskId, date)} title="Let it go (undoable)" aria-label="Dismiss"><Icon name="close" size={11} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* today's road */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 13 }}>
            <div className="kz-label-row" style={{ flex: 1 }}>
              <span className="kz-label">Today's Path</span>
            </div>
            <EnergyToggle />
            {stats.doneToday > 0 && !dayClosed && (
              <button className="kz-link" onClick={() => setUI({ endOfDayOpen: true })}>Make camp →</button>
            )}
          </div>

          {lineup.length > 0 ? (
            <>
              <div className="kz-road">
                {lineup.map((r, i) => {
                  const globalIdx = missed.length + i;
                  const chunks = r.chunk ? D.getTaskChunks(r.task.id, plan) : [];
                  const isHere = cursorIdx === globalIdx;
                  return (
                    <div key={r.task.id}
                      className={"kz-station" + (r.doneHere ? " kz-station--done" : "") + (isHere ? " kz-station--here" : "")}
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
                        boxShadow: dragOverIdx === i && dragIdx !== null && dragIdx !== i ? "0 -2px 0 var(--amber)" : "none",
                      }}>
                      <WaypointRow
                        task={r.task}
                        index={i}
                        project={r.task.projectId ? projectsById.get(r.task.projectId) : null}
                        doneHere={r.doneHere}
                        onToggleDone={(done) => setCompletion(r.task.id, { done, chunkDate: r.chunk ? todayIso : null })}
                        chunkNote={r.chunkNote} chunkLabel={r.chunkLabel}
                        isCursor={isHere}
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
              <div className="kz-label" style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                <span>{planDone}/{lineup.length} reached</span>
                <span>J/K walk · X reach · [ ] reorder · drag</span>
              </div>
            </>
          ) : (
            <EmptyState haiku={pending.length === 0
              ? "No road marked yet —\nthe wind waits at the gate for\nsomething worth walking."
              : "The satchel is full,\nbut nothing set out for today.\nOpen the map."}>
              {pending.length === 0 ? (
                <>
                  <div>Type in the note above — it lands right here, set for today.</div>
                  {tasks.length === 0 && projects.length === 0 && (
                    <div style={{ marginTop: 18 }}>
                      <button className="kz-btn" onClick={enterPreview}>
                        <Icon name="petal" size={11} /> Walk a borrowed road
                      </button>
                      <div className="kz-label" style={{ marginTop: 9 }}>
                        Sample country — your own (empty) road is kept and returns when you leave.
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 15 }}>
                    {upcoming
                      ? <>Next gate: {D.fmtIsoShort(upcoming.date)} · {upcoming.items.length} waypoint{upcoming.items.length > 1 ? "s" : ""}.</>
                      : <>{pending.length} waypoint{pending.length > 1 ? "s" : ""} waiting in the satchel.</>}
                  </div>
                  <button className="kz-btn" onClick={() => setUI({ view: "plan" })}>Open the Shrine Map</button>
                </>
              )}
            </EmptyState>
          )}
        </div>

        {/* the rail */}
        <aside className="kz-aside">
          {readyToShip.length > 0 && (
            <div>
              <div style={{ marginBottom: 11 }}><span className="kz-tape kz-tape--sakura">At the gate</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {readyToShip.slice(0, 4).map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--sakura)", boxShadow: "0 0 8px 0 var(--sakura)", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                    <button className="kz-go kz-go--sm kz-go--bloom" onClick={() => setUI({ view: "dock" })}>Arrive</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="kz-label-row" style={{ marginBottom: 11 }}>
              <span className="kz-label">Next gate{upcoming ? ` · ${D.fmtIsoShort(upcoming.date)}` : ""}</span>
            </div>
            {upcoming ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {upcoming.items.slice(0, 4).map((it) => {
                    const t = tasksById.get(it.taskId);
                    if (!t) return null;
                    return (
                      <div key={it.taskId} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12.5, color: "var(--fg-dim)" }}>
                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--road-lit)", flexShrink: 0, marginTop: 6 }} />
                        <span>
                          {t.title}{it.note ? <span style={{ color: "var(--fg-faint)", fontStyle: "italic" }}> — {it.note}</span> : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button className="kz-link" style={{ marginTop: 11 }} onClick={() => setUI({ view: "plan" })}>The map →</button>
              </>
            ) : (
              <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>Nothing marked beyond today.</div>
            )}
          </div>

          <div>
            <div className="kz-label-row" style={{ marginBottom: 11 }}>
              <span className="kz-label">Distractions</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[{ label: "X opens", key: "xOpens" }, { label: "YT opens", key: "ytOpens" }].map((item) => {
                const count = entry[item.key] || 0;
                return (
                  <div key={item.key} className="kz-card" style={{ padding: "9px 11px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                      <span className="kz-label">{item.label}</span>
                      <span className="kz-brush kz-num" style={{ fontSize: 18 }}>{count}</span>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="kz-btn kz-btn--sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => patchScreenToday({ [item.key]: count + 1 })}>+1</button>
                      {count > 0 && <button className="kz-btn kz-btn--sm" onClick={() => patchScreenToday({ [item.key]: Math.max(0, count - 1) })}>−</button>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 9 }}><MobileHoursInput entry={entry} /></div>
            <button className="kz-link" style={{ marginTop: 11 }} onClick={() => setUI({ statsOpen: true })}>The journal →</button>
          </div>

          <InkFoot caption="the road goes on" />
        </aside>
      </div>
    </div>
  );
}

function MobileHoursInput({ entry }) {
  const [v, setV] = useState("");
  if (entry.mobileHours != null) {
    return (
      <div className="kz-label" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{entry.mobileHours}h on the glass today</span>
        <button className="kz-link" onClick={() => patchScreenToday({ mobileHours: null })}>clear</button>
      </div>
    );
  }
  const log = () => { if (v) { patchScreenToday({ mobileHours: parseFloat(v) || 0 }); setV(""); } };
  return (
    <div style={{ display: "flex", gap: 5 }}>
      <input type="number" min="0" max="24" step="0.5" placeholder="Hours on the glass"
        value={v} onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") log(); }}
        className="kz-field kz-field--mono" style={{ flex: 1 }} />
      <button className="kz-btn kz-btn--sm" disabled={!v} onClick={log}>Log</button>
    </div>
  );
}

export function EnergyToggle() {
  const energy = useStore((s) => s.ui.energy);
  const opts = [
    { id: "low", label: "Gentle", title: "Easy ground first" },
    { id: "normal", label: "As it lies", title: "Sort by priority" },
    { id: "high", label: "Steep", title: "Hard ground first" },
  ];
  return (
    <div className="kz-energy" role="group" aria-label="Energy mode">
      {opts.map((o) => (
        <button key={o.id} type="button" title={o.title} aria-pressed={energy === o.id}
          className={energy === o.id ? "on" : ""}
          onClick={() => setUI({ energy: o.id })}>{o.label}</button>
      ))}
    </div>
  );
}
