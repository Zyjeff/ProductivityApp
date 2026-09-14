import React, { useEffect, useMemo, useState } from "react";
import { Icon, Eyebrow, EmptyState, GhostHorizon, Sparkline, BarStrip, Kbd } from "../components.jsx";
import { CaptureBar } from "../capture.jsx";
import { TaskRow, ChunksEditor } from "../taskrow.jsx";
import * as D from "../../../core/domain.js";
import { statementBg, tex } from "../texture.js";
import {
  useStore, getState, setUI, setCompletion, todayLineup, sel,
  pinTaskToDate, dismissChunk, moveChunkDate, patchScreenToday, reopenDay,
  enterPreview, setLineupOrder, ensureMorningBrief, patchBrief, applyBriefOrder,
  reviewPromptDue, openReview, patchReview,
} from "../../../core/store.js";
import { generateBriefProse } from "../../../core/enrich.js";
import { DailyPrint } from "../print.jsx";
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
  const [reading, setReading] = useState(false);
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
  useEffect(() => { if (!brief) ensureMorningBrief(); }, [todayIso, !!brief]);
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
    return {
      todayXP: D.todayXP(tasks, plan, hour),
      streakRun: D.streak(tasks, plan, hour),
      doneToday: activity.get(todayIso)?.size || 0,
      xpTrend: trend(xp14.slice(0, 7), xp14.slice(7)),
      doneTrend: trend(done14.slice(0, 7), done14.slice(7)),
      xp7: xp14.slice(7),
      done14,
      week,
      weekActiveIdx: week.findIndex((w) => w.isToday),
    };
  }, [tasks, plan, hour, todayIso]);

  const pending = tasks.filter((t) => !t.completed && t.recurring === "none");
  const readyToShip = projects.filter((p) => !p.completedAt && (p.childTaskIds || []).length > 0 && D.progressOfProject(p, tasksById) === 100);
  const planDone = lineup.filter((r) => r.doneHere).length;

  const hourNow = new Date().getHours();
  const allDone = lineup.length > 0 && planDone === lineup.length;
  const greeting = allDone ? "All clear. Solid day."
    : lineup.length === 0 && pending.length === 0 ? "Empty collection. Capture something."
    : hourNow < 5 ? "Late shift."
    : hourNow < 12 ? "Morning. Let's launch."
    : hourNow < 14 ? "Midday. Keep moving."
    : hourNow < 18 ? "Back at it."
    : hourNow < 22 ? "Evening push."
    : "Still at the collection.";

  const entry = screen[todayIso] || { xOpens: 0, ytOpens: 0, mobileHours: null };
  const dayClosed = meta.dayClosed && meta.dayClosed.date === todayIso ? meta.dayClosed : null;
  const upcoming = (plan || []).filter((e) => e.date > todayIso && e.items.length).sort((a, b) => a.date.localeCompare(b.date))[0];

  let cursorIdx = cursor ? cursor.index : -1;
  const dueWeek = reviewPromptDue(getState());


  const nowRow = lineup.find(r => !r.doneHere);
  const nextRow = lineup.filter(r => !r.doneHere)[1];
  const nowProject = nowRow?.task.projectId ? projectsById.get(nowRow.task.projectId) : null;
  return <div className={"f-page f-today" + (reading ? " f-reading" : "")}>
    {dayClosed && <div className="f-notice"><Icon name="moon"/> This edition is closed.<button className="w-link" onClick={reopenDay}>Reopen day</button></div>}
    <div className="f-edition-line"><span>VOL. {String(D.effectiveToday(hour).getMonth()+1).padStart(2,'0')} / {D.effectiveToday(hour).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span><span>THE DAILY EDITION <span className="f-cross">✳</span></span></div>
    <section className="f-cover">
      <div className="f-cover-copy"><div className="f-kicker">A little intention. A lasting impression.</div>
        <h1>{allDone?<>A day,<br/><em>well made.</em></>:<>Make<br/>something<br/><em>matter.</em></>}</h1>
        <p>A day is a small work of art.<br/>Give yours the attention it deserves.</p>
        <div className="f-cover-counts"><span><b>{pending.length}</b> in the collection</span><span><b>{lineup.length}</b> on today's press</span>{readyToShip.length>0 && <span><b>{readyToShip.length}</b> ready to publish</span>}</div>
      </div>
      <DailyPrint rows={lineup} date={todayIso}/>
    </section>
    <section className="f-composing">
      <div className="f-section-title"><span><i>01</i> The composing desk</span><button className="w-link" onClick={()=>setReading(!reading)} aria-pressed={reading}>{reading ? '← Full edition' : 'Reading mode ↗'}</button></div>
      <CaptureBar scheduleToday/>
      <div className="f-desk-spread">
      <aside className="f-desk-frontispiece">
      {nowRow ? <div className="f-now">
        <div className="f-now-label"><span className="f-frontispiece-flower" aria-hidden="true">✳</span><span className="f-kicker">ON THE PRESS</span><span className="f-now-number">{String(lineup.indexOf(nowRow)+1).padStart(2,'0')}</span></div>
        <div className="f-now-content"><h2>{nowRow.task.title}</h2><div className="f-now-meta">{nowProject && <span>{nowProject.title}</span>}<span>~{nowRow.chunk?.hours ?? D.taskHours(nowRow.task)}h estimated</span>{D.todayFocusMs(nowRow.task,hour)>0 && <span>{D.fmtMs(D.todayFocusMs(nowRow.task,hour))} focused</span>}{nowRow.chunkNote && <span>{nowRow.chunkNote}</span>}</div>{nextRow && <p className="f-next-line">Then, {nextRow.task.title}</p>}</div>
        <div className="f-now-actions"><button className="w-switch" onClick={()=>setUI({focusTaskId:nowRow.task.id})}><Icon name="focus"/> Begin focus <Kbd>F</Kbd></button><button className="w-link" onClick={()=>setCompletion(nowRow.task.id,{done:true,chunkDate:nowRow.chunk?todayIso:null})}>Mark complete ✓</button></div>
      </div> : allDone ? <div className="f-now f-all-done"><span className="f-seal">✓</span><div><h2>Today's edition is complete.</h2><p>Good work leaves an impression.</p></div>{!dayClosed && <button className="w-switch" onClick={()=>setUI({endOfDayOpen:true})}>Close the day →</button>}</div> : null}
      </aside><div className="f-desk-proofs">
                {missed.length > 0 && (
            <div className="w-hazard w-fade-in" style={{ marginBottom: 18, padding: "12px 14px 12px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span className="w-tape w-tape--warn">Carryovers</span>
                <span className="w-num" style={{ fontSize: 10.5, color: "var(--fg-dim)" }}>{missed.length} PAST ITEM{missed.length === 1 ? "" : "S"}</span>
              </div>
              <div className="w-ledger">
                {missed.map(({ date, taskId, task, item }, i) => {
                  const project = task.projectId ? projectsById.get(task.projectId) : null;
                  const daysAgo = Math.max(1, Math.round((D.parseIsoDate(todayIso) - D.parseIsoDate(date)) / 86400000));
                  return (
                    <div key={`${date}-${taskId}`}
                      onMouseEnter={() => setUI({ cursor: { index: i } })}
                      className={"w-ledger-row" + (cursorIdx === i ? " w-ledger-row--cursor" : "")}
                      style={{ "--row-lamp": project?.color || "var(--warn)" }}>
                      <span className="w-cursor-bracket" aria-hidden />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</div>
                        <div className="w-num" style={{ display: "flex", gap: 8, marginTop: 2, fontSize: 9.5, color: "var(--fg-faint)" }}>
                          <span>{daysAgo}D OVERDUE</span>
                          {project && <span style={{ color: `color-mix(in srgb, ${project.color} 40%, #302d29)` }}>{project.title.toUpperCase()}</span>}
                          {item.hours && <span>{item.hours}H CHUNK</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                        <button className="w-bezel w-bezel--sm" onClick={() => moveChunkDate(taskId, date, todayIso)} title="Reschedule to today">Today</button>
                        <button className="w-bezel w-bezel--sm w-bezel--starboard" onClick={() => setCompletion(taskId, { done: true, chunkDate: date })} title="It actually got done — mark it">Done</button>
                        <button className="w-icon-btn" onClick={() => dismissChunk(taskId, date)} title="Remove from plan (undoable)" aria-label="Dismiss"><Icon name="close" size={11} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


                {/* lineup ledger */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div className="w-stencil-row" style={{ flex: 1 }}>
              <span className="w-stencil">Today’s running order</span>
            </div>
            <EnergyToggle />
            {stats.doneToday > 0 && !dayClosed && (
              <button className="w-link" onClick={() => setUI({ endOfDayOpen: true })}>Close day →</button>
            )}
          </div>

          {lineup.length > 0 ? (
            <>
              <div className="w-plate w-plate--flush w-ledger">
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
                        ordinal={i+1}
                        task={r.task}
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
            <EmptyState>
              {pending.length === 0 ? (
                <>
                  <div className="w-display" style={{ fontSize: 17, color: "var(--fg)", marginBottom: 8 }}>A blank page is a beginning.</div>
                  <div>Capture your first task above. It becomes part of today’s edition.</div>
                  {tasks.length === 0 && projects.length === 0 && (
                    <div style={{ marginTop: 16 }}>
                      <button className="w-bezel" onClick={enterPreview}>
                        <Icon name="bolt" size={11} /> Try with sample data
                      </button>
                      <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 8 }}>
                        Loads a sample edition — your (empty) data is snapshotted and restored on exit.
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
                      : <>{pending.length} task{pending.length > 1 ? "s" : ""} waiting in the collection.</>}
                  </div>
                  <button className="w-bezel" onClick={() => setUI({ view: "plan" })}>Open the plan</button>
                </>
              )}
            </EmptyState>
          )}

    </div></div></section>
    <section className="f-footnotes">
      <div className="f-brief-column"><div className="f-section-title"><span><i>02</i> Editor's notes</span><Kbd>B</Kbd></div>          {dueWeek && (
            <div className="w-fade-in" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span className="w-tape w-tape--channel">Review due</span>
              <span style={{ fontSize: 12.5, color: "var(--fg-dim)", flex: 1 }}>Last week is in the books — worth two minutes of hindsight.</span>
              <button className="w-bezel w-bezel--sm" onClick={() => openReview(dueWeek)}>Review <Kbd>W</Kbd></button>
              <button className="w-icon-btn" aria-label="Dismiss review prompt" onClick={() => patchReview(dueWeek, { promptDismissed: true })}>
                <Icon name="close" size={11} />
              </button>
            </div>
          )}

          {brief && (brief.dismissed ? (
            <button className="w-fade-in w-stencil" onClick={() => patchBrief(todayIso, { dismissed: false })}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", marginBottom: 16, padding: "6px 10px", background: "var(--plate)", border: "none", cursor: "pointer", boxShadow: "inset 0 1px 0 var(--line-dim)" }}>
              <Icon name="bolt" size={10} /> Morning brief <span style={{ marginLeft: "auto" }} className="w-key">B</span>
            </button>
          ) : (
            <div className="w-plate w-fade-in" style={{ marginBottom: 18, "--u-fade": tex({ seed: "brief-" + todayIso, algo: "bayer", w: 64, h: 14, cell: 2, fg: "#222c44", grad: { from: 0, to: 0.3, dir: "down" } }) }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px 0" }}>
                <span className="w-tape">Morning brief</span>
                <span className="w-num" style={{ fontSize: 10, color: "var(--fg-faint)" }}>
                  {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase()}
                </span>
                <div className="w-stencil-row" style={{ flex: 1 }}><span /></div>
                <button className="w-icon-btn" title="Regenerate the written brief"
                  onClick={() => patchBrief(todayIso, { attempted: false, text: null, order: null })}>
                  <Icon name="reset" size={11} />
                </button>
                <button className="w-icon-btn" title="Collapse (B)" aria-label="Collapse brief"
                  onClick={() => patchBrief(todayIso, { dismissed: true })}>
                  <Icon name="close" size={11} />
                </button>
              </div>
              <div style={{ padding: "10px 14px 14px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: brief.text || brief.attempted ? 10 : 0 }}>
                  <BriefFact label={briefData.yesterday.count > 0
                    ? `yesterday ${briefData.yesterday.count} done · ${briefData.yesterday.xp} XP${briefData.yesterday.focusMs ? " · " + D.fmtMs(briefData.yesterday.focusMs) : ""}`
                    : "yesterday quiet"} />
                  {briefData.adrift > 0 && <BriefFact tone="var(--warn)" label={`${briefData.adrift} adrift`} />}
                  <BriefFact
                    tone={briefData.overloaded ? "var(--port)" : undefined}
                    label={briefData.dayOff
                      ? `day off · ${briefData.lineup.length} lined up anyway`
                      : `today ${briefData.lineup.length} tasks · ${briefData.lineupHours}h of ${briefData.capacity}h${briefData.overloaded ? " — OVERLOADED" : ""}`} />
                  {briefData.deadlinesSoon.map((d) => (
                    <BriefFact key={d.title} tone={d.overdue ? "var(--port)" : "var(--warn)"}
                      label={`${d.overdue ? "OVERDUE" : d.days === 0 ? "due today" : "due " + d.days + "d"}: ${d.title.slice(0, 30)}`} />
                  ))}
                </div>
                {brief.text ? (
                  <>
                    <div style={{ fontSize: 13, color: "var(--fg)", lineHeight: 1.65, maxWidth: 640 }}>{brief.text}</div>
                    {brief.order?.length > 1 && (
                      <button className="w-bezel w-bezel--sm" style={{ marginTop: 10 }}
                        onClick={() => applyBriefOrder(brief.order)}>
                        Apply suggested run order
                      </button>
                    )}
                  </>
                ) : brief.attempted && aiStatus !== "busy" ? (
                  <div className="w-num" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                    AI OFF — THE NUMBERS ABOVE ARE THE BRIEF.{" "}
                    <button className="w-link" style={{ fontSize: 10 }} onClick={() => patchBrief(todayIso, { attempted: false })}>retry</button>
                  </div>
                ) : (
                  <div className="w-num" style={{ fontSize: 11, color: "var(--fg-faint)" }}>WRITING THE BRIEF…</div>
                )}
              </div>
            </div>
          ))}

</div>
      <div className="f-side-notes">          {readyToShip.length > 0 && (
            <div className="w-rail-section">
              <div style={{ marginBottom: 10 }}><span className="w-tape w-tape--starboard">Ready to publish</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {readyToShip.slice(0, 4).map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--starboard)", boxShadow: "0 0 8px 0 var(--starboard)", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                    <button className="w-switch w-switch--launch w-switch--sm" onClick={() => setUI({ view: "dock" })}>Publish</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="w-rail-section">
            <div className="w-stencil-row" style={{ marginBottom: 10 }}>
              <span className="w-stencil">Next up{upcoming ? ` · ${D.fmtIsoShort(upcoming.date)}` : ""}</span>
            </div>
            {upcoming ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {upcoming.items.slice(0, 4).map((it) => {
                    const t = tasksById.get(it.taskId);
                    if (!t) return null;
                    return (
                      <div key={it.taskId} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12.5, color: "var(--fg-dim)", minWidth: 0 }}>
                        <span style={{ width: 5, height: 5, background: "var(--channel)", flexShrink: 0, alignSelf: "center" }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.title}{it.note ? <span style={{ color: "var(--fg-faint)", fontStyle: "italic" }}> — {it.note}</span> : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button className="w-link" style={{ marginTop: 10 }} onClick={() => setUI({ view: "plan" })}>Plan →</button>
              </>
            ) : (
              <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>Nothing on the next edition yet.</div>
            )}
          </div>

          <div className="w-rail-section">
            <div className="w-stencil-row" style={{ marginBottom: 10 }}>
              <span className="w-stencil">Screen log</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              {[{ label: "X OPENS", key: "xOpens" }, { label: "YT OPENS", key: "ytOpens" }].map((item) => {
                const count = entry[item.key] || 0;
                return (
                  <div key={item.key} className="w-plate w-plate--flush" style={{ padding: "9px 10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                      <span className="w-stencil" style={{ fontSize: 8.5 }}>{item.label}</span>
                      <span className="w-display w-num" style={{ fontSize: 19 }}>{count}</span>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="w-bezel w-bezel--sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => patchScreenToday({ [item.key]: count + 1 })}>+1</button>
                      {count > 0 && <button className="w-bezel w-bezel--sm" onClick={() => patchScreenToday({ [item.key]: Math.max(0, count - 1) })}>−</button>}
                    </div>
                  </div>
                );
              })}
            </div>
            <MobileHoursInput entry={entry} />
            <button className="w-link" style={{ marginTop: 10 }} onClick={() => setUI({ statsOpen: true })}>History →</button>
          </div>

</div>
    </section>
    <section className="f-records"><div className="f-section-title"><span><i>03</i> The day's impressions</span><span className="f-kicker">SMALL EFFORTS ADD UP</span></div><div className="f-records-grid">          <Gauge first label="Today's XP" trend={stats.xpTrend}>
            <BigNum>{stats.todayXP}</BigNum>
            <div style={{ height: 34, margin: "8px -14px 0 -16px" }}>
              <Sparkline data={stats.xp7} />
            </div>
          </Gauge>
          <Gauge label="Streak" hint={stats.streakRun === 0 ? "launch something today" : stats.doneToday > 0 ? "secured today" : "complete 1 to keep it"}>
            <BigNum unit="DAYS">{stats.streakRun}</BigNum>
            <div style={{ height: 34, marginTop: 8 }}>
              <BarStrip data={stats.week} activeIndex={stats.weekActiveIdx} height={34} />
            </div>
          </Gauge>
          <Gauge label="Done today" trend={stats.doneTrend}>
            <BigNum>{stats.doneToday}</BigNum><div style={{height:25,marginTop:8}}><Sparkline data={stats.done14} tone="var(--channel)"/></div>
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              {["epic", "hard", "medium", "easy"].map((d) => {
                const count = pending.filter((t) => t.difficulty === d).length;
                return count > 0 ? (
                  <span key={d} className="w-num" title={`${count} ${d} pending`} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9.5, color: "var(--fg-faint)" }}>
                    <span style={{ width: 6, height: 6, background: D.DIFFICULTY[d].tone, display: "inline-block" }} /> {count}
                  </span>
                ) : null;
              })}
            </div>
          </Gauge>
          <Gauge label="Lined up" hint={`${lineup.reduce((s2, r) => s2 + (r.task.xp || 0), 0)} XP on the slate`}>
            <BigNum dim={` / ${lineup.length}`}>{planDone}</BigNum>
            <div style={{ marginTop: 14 }}>
              <div className="w-meter" style={{ height: 5 }}>
                <div className="w-meter-fill" style={{ width: (lineup.length ? (planDone / lineup.length) * 100 : 0) + "%", backgroundColor: "var(--starboard)" }} />
              </div>
            </div>
          </Gauge>
</div></section>
  </div>;
}

function Gauge({ label, trend, hint, first, children }) {
  return (
    <div style={{
      padding: "14px 16px 12px",
      backgroundImage: first ? "none" : "var(--dither-vsplit)",
      backgroundRepeat: "repeat-y",
      backgroundPosition: "left top",
      minWidth: 0, overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
        <span className="w-stencil" style={{ fontSize: 9 }}>{label}</span>
        {trend != null && (
          <span className="w-num" style={{ fontSize: 9.5, color: trend > 0 ? "var(--starboard)" : trend < 0 ? "var(--port)" : "var(--fg-faint)" }}>
            {trend > 0 ? "▲" : trend < 0 ? "▼" : "·"}{Math.abs(trend)}%
          </span>
        )}
      </div>
      {children}
      {hint && <div className="w-num" style={{ fontSize: 9, color: "var(--fg-faint)", marginTop: 8, letterSpacing: "0.04em" }}>{hint.toUpperCase()}</div>}
    </div>
  );
}

function BigNum({ children, unit, dim }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
      <span className="w-display w-num" style={{ fontSize: 30, lineHeight: 1 }}>{children}</span>
      {unit && <span className="w-stencil" style={{ fontSize: 8.5 }}>{unit}</span>}
      {dim && <span className="w-display w-num" style={{ fontSize: 15, color: "var(--fg-faint)" }}>{dim}</span>}
    </div>
  );
}

function BriefFact({ label, tone }) {
  return (
    <span className="w-stamp" style={tone ? { color: tone, borderColor: tone } : undefined}>{label}</span>
  );
}

function MobileHoursInput({ entry }) {
  const [v, setV] = useState("");
  if (entry.mobileHours != null) {
    return (
      <div className="w-num" style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--fg-dim)" }}>
        <span>{entry.mobileHours}H ON MOBILE TODAY</span>
        <button className="w-link" style={{ fontSize: 9.5 }} onClick={() => patchScreenToday({ mobileHours: null })}>clear</button>
      </div>
    );
  }
  const log = () => { if (v) { patchScreenToday({ mobileHours: parseFloat(v) || 0 }); setV(""); } };
  return (
    <div style={{ display: "flex", gap: 5 }}>
      <div className="w-well w-well--sm" style={{ flex: 1 }}>
        <input type="number" min="0" max="24" step="0.5" placeholder="Mobile hours"
          value={v} onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") log(); }}
          style={{ fontFamily: "var(--t-mono)" }} />
      </div>
      <button className="w-bezel w-bezel--sm" disabled={!v} onClick={log}>Log</button>
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
    <div style={{ display: "inline-flex", background: "var(--well)", boxShadow: "inset 0 1px 0 rgba(0,0,0,0.5)", padding: 2 }} role="group" aria-label="Energy mode">
      {opts.map((o) => (
        <button key={o.id} type="button" title={o.title} aria-pressed={energy === o.id}
          onClick={() => setUI({ energy: o.id })}
          className="w-stencil"
          style={{
            background: energy === o.id ? "var(--amber)" : "transparent",
            color: energy === o.id ? "var(--ink)" : "var(--fg-faint)",
            border: "none", cursor: "pointer",
            padding: "4px 9px", fontSize: 8.5, letterSpacing: "0.16em",
          }}>{o.label}</button>
      ))}
    </div>
  );
}
