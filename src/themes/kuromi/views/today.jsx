// today.jsx — the scheme sheet. Kuromi composition: KURO-VISION on
// top (the imp's mood is an honest readout of real state), the
// whisper slot, four pocket gauges, ORDERS (the brief), the NOW
// SCHEMING statement plate, BUSTED triage, the scheme list, and a
// rail with ready bosses, the next stage, and the bad-habits radar.

import React, { useEffect, useMemo, useState } from "react";
import { Icon, EmptyState, Kbd, Meter, PriorityDot, Tag, GhostFoot, GLYPH_HEART } from "../components.jsx";
import { Spark, WeekBars } from "../charts.jsx";
import { KuroVision, GhostSkull } from "../chrome.jsx";
import { CaptureSlab } from "../capture.jsx";
import { TaskRow } from "../taskrow.jsx";
import * as D from "../../../core/domain.js";
import { statementBg } from "../texture.js";
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
      week.push({ label: "MTWTFSS"[i], value: activity.get(iso)?.size || 0, title: `${iso}: ${activity.get(iso)?.size || 0} schemes pulled off`, isToday: iso === todayIso });
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
  const pendingToday = lineup.length - planDone;
  const cleared = lineup.length > 0 && pendingToday === 0;

  const hourNow = new Date().getHours();
  const greeting =
    cleared ? "Day conquered. Obviously."
    : lineup.length === 0 && pending.length === 0 ? "No schemes?! Boring."
    : hourNow < 5 ? "Up past bedtime. Excellent."
    : hourNow < 12 ? "Morning. Time for mischief."
    : hourNow < 14 ? "Midday. Keep scheming."
    : hourNow < 18 ? "Back to the good stuff."
    : hourNow < 22 ? "Evening chaos window."
    : "Mischief never sleeps.";

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

  const mood = cleared ? "win" : stats.doneToday > 0 && pendingToday > 0 ? "work" : (pendingToday > 0 || pending.length > 0) ? "plot" : "bored";

  const hud = [
    { label: "SCORE", value: `+${stats.todayXP}` },
    { label: "COMBO", value: stats.streakRun > 0 ? `×${stats.streakRun}` : "—" },
    { label: "NEXT", value: upcoming ? D.fmtIsoShort(upcoming.date).toUpperCase() : "—" },
    { label: "HEAT", value: missed.length ? `${missed.length} BUSTED` : "CLEAN" },
  ];

  return (
    <div className="k-wrap">
      {dayClosed && (
        <div className="k-plate k-plate-pad k-rowline k-mb">
          <Icon name="moon" size={13} color="var(--port)" />
          <span className="k-mono-sm k-dim" style={{ flex: 1 }}>
            DIARY SIGNED · {new Date(dayClosed.closedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toUpperCase()}
          </span>
          <button className="k-btn is-sm" onClick={reopenDay}>REOPEN THE DAY</button>
        </div>
      )}

      <div className="k-pagehead k-ghostwrap">
        <div className="k-ghost"><GhostSkull size={104} /></div>
        <div className="k-title">
          {greeting} <span className="k-accent">♥</span>
        </div>
        <div className="k-sub">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          {" — "}{pending.length} in the notebook · {lineup.length} on today's page
          {readyToShip.length ? <span className="k-green"> · {readyToShip.length} boss{readyToShip.length > 1 ? "es" : ""} beatable</span> : null}
        </div>
      </div>

      {/* KURO-VISION */}
      <div className="k-mb">
        <KuroVision mood={mood} hud={hud} height={152} />
      </div>

      {/* whisper slot */}
      <div className="k-mb">
        <CaptureSlab scheduleToday />
      </div>

      {/* pocket gauges */}
      <div className="k-gauges k-mb">
        <div className="k-gauge">
          <span className="k-lab">Chaos today</span>
          <span className="k-big is-pink">{stats.todayXP}<span style={{ fontSize: 8 }}> XP</span></span>
          <div className="k-note">
            {stats.xpTrend != null
              ? <span className={stats.xpTrend > 0 ? "k-green" : stats.xpTrend < 0 ? "k-pink" : ""}>{stats.xpTrend > 0 ? "▲" : stats.xpTrend < 0 ? "▼" : "·"}{Math.abs(stats.xpTrend)}% vs last wk</span>
              : "fresh spree"}
          </div>
          <div style={{ marginTop: 7 }}><Spark points={stats.xp7} width={150} height={26} /></div>
        </div>
        <div className="k-gauge">
          <span className="k-lab">Combo</span>
          <span className="k-big is-green">{stats.streakRun}<span style={{ fontSize: 8 }}> DAYS</span></span>
          <div className="k-note">
            {stats.streakRun === 0 ? "pull 1 off to start" : stats.doneToday > 0 ? "safe for today" : "1 more keeps it alive"}
          </div>
          <div style={{ marginTop: 7 }}><WeekBars days={stats.week} tone="green" height={40} /></div>
        </div>
        <div className="k-gauge">
          <span className="k-lab">Mischief clock</span>
          <span className="k-big">{fmtFocus(stats.focusToday)}</span>
          <div className="k-note">
            {stats.doneToday} pulled off{stats.doneTrend != null ? ` · ${stats.doneTrend > 0 ? "▲" : stats.doneTrend < 0 ? "▼" : "·"}${Math.abs(stats.doneTrend)}%` : ""}
          </div>
          <div className="k-note k-faint">
            {["epic", "hard", "medium", "easy"].map((d) => {
              const c = pending.filter((t) => t.difficulty === d).length;
              return c > 0 ? <span key={d} style={{ marginRight: 8 }}><span style={{ color: D.DIFFICULTY[d].tone }}>■</span> {c} {d}</span> : null;
            })}
          </div>
        </div>
        <div className="k-gauge">
          <span className="k-lab">Today's page</span>
          <span className="k-big is-violet">{planDone}<span style={{ fontSize: 9, color: "var(--fg-faint)" }}> / {lineup.length}</span></span>
          <div style={{ marginTop: 9 }}><Meter pct={lineup.length ? (planDone / lineup.length) * 100 : 0} tone="green" /></div>
          <div className="k-note">{xpLeft} XP still up for grabs</div>
        </div>
      </div>

      <div className="k-grid k-grid-today">
        <div className="k-col">
          {dueWeek && (
            <div className="k-plate k-plate-pad k-rowline">
              <span className="k-eyebrow is-violet" style={{ marginBottom: 0 }}>REWIND DUE</span>
              <span className="k-dim k-sm" style={{ flex: 1 }}>Last week happened. Let's judge it.</span>
              <button className="k-btn is-sm" onClick={() => openReview(dueWeek)}>REWIND <Kbd>W</Kbd></button>
              <button className="k-mini-btn" aria-label="Dismiss" onClick={() => patchReview(dueWeek, { promptDismissed: true })}>
                <Icon name="x" size={9} />
              </button>
            </div>
          )}

          {/* ORDERS — the brief */}
          {brief && (brief.dismissed ? (
            <button
              className="k-plate k-plate-pad k-rowline"
              style={{ width: "100%", cursor: "pointer", border: "2px solid var(--line)", textAlign: "left" }}
              onClick={() => patchBrief(todayIso, { dismissed: false })}
            >
              <Icon name="bolt" size={11} color="var(--amber)" />
              <span className="k-eyebrow" style={{ marginBottom: 0 }}>ORDERS FROM THE BOSS (ME)</span>
              <span className="k-spacer" />
              <Kbd>B</Kbd>
            </button>
          ) : (
            <div className="k-plate is-hi">
              <div className="k-plate-pad" style={{ paddingBottom: 0 }}>
                <div className="k-rowline">
                  <span className="k-eyebrow" style={{ marginBottom: 0 }}>ORDERS FROM THE BOSS (ME)</span>
                  <span className="k-spacer" />
                  <button className="k-mini-btn" title="Rewrite the orders"
                    onClick={() => patchBrief(todayIso, { attempted: false, text: null, order: null })}>
                    <Icon name="rewind" size={10} />
                  </button>
                  <button className="k-mini-btn" title="Fold away (B)" onClick={() => patchBrief(todayIso, { dismissed: true })}>
                    <Icon name="x" size={10} />
                  </button>
                </div>
              </div>
              <div className="k-plate-pad" style={{ paddingTop: 10 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: brief.text || brief.attempted ? 10 : 0 }}>
                  <span className="k-chip is-on">
                    {briefData.yesterday.count > 0
                      ? `yesterday: ${briefData.yesterday.count} pulled off · ${briefData.yesterday.xp} XP${briefData.yesterday.focusMs ? " · " + D.fmtMs(briefData.yesterday.focusMs) : ""}`
                      : "yesterday: suspiciously quiet"}
                  </span>
                  {briefData.adrift > 0 && <span className="k-chip" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>{briefData.adrift} busted</span>}
                  <span className="k-chip" style={briefData.overloaded ? { borderColor: "var(--port)", color: "var(--port)" } : {}}>
                    {briefData.dayOff
                      ? `day off · ${briefData.lineup.length} schemed anyway (greedy)`
                      : `today: ${briefData.lineup.length} schemes · ${briefData.lineupHours}h of ${briefData.capacity}h${briefData.overloaded ? " — TOO GREEDY" : ""}`}
                  </span>
                  {briefData.deadlinesSoon.map((d) => (
                    <span key={d.title} className="k-chip" style={d.overdue ? { borderColor: "var(--port)", color: "var(--port)" } : { borderColor: "var(--warn)", color: "var(--warn)" }}>
                      {d.overdue ? "BUSTED" : d.days === 0 ? "due TODAY" : `due ${d.days}d`}: {d.title.slice(0, 30)}
                    </span>
                  ))}
                </div>
                {brief.text ? (
                  <>
                    <div className="k-dim" style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{brief.text}</div>
                    {brief.order?.length > 1 && (
                      <button className="k-btn is-sm is-primary k-mt" onClick={() => applyBriefOrder(brief.order)}>
                        RUN THEM IN MY ORDER
                      </button>
                    )}
                  </>
                ) : brief.attempted && aiStatus !== "busy" ? (
                  <div className="k-mono-sm k-faint">
                    THE IMP IS OUT — THE NUMBERS ABOVE ARE THE ORDERS.{" "}
                    <button className="k-btn is-sm is-ghost" onClick={() => patchBrief(todayIso, { attempted: false })}>poke it</button>
                  </div>
                ) : (
                  <div className="k-mono-sm k-faint">THE IMP IS SCRIBBLING…</div>
                )}
              </div>
            </div>
          ))}

          {/* NOW SCHEMING statement */}
          {lineup.length > 0 && (() => {
            const pendingRows = lineup.filter((r) => !r.doneHere);
            const nowRow = pendingRows[0];
            const nextRow = pendingRows[1];
            if (!nowRow) {
              return (
                <div
                  className="k-statement"
                  style={{ ...statementBg("cleared-" + todayIso, "#062115", "#4df2a4") }}
                >
                  <div className="k-rowline">
                    <Icon name="star" size={20} color="#06331e" />
                    <div style={{ flex: 1 }}>
                      <div className="k-display" style={{ fontSize: 8, marginBottom: 6 }}>PAGE CLEARED</div>
                      <div className="k-display" style={{ fontSize: 14 }}>Everything pulled off. Bow to your genius.</div>
                    </div>
                    {!dayClosed && (
                      <button className="k-btn is-green" onClick={() => setUI({ endOfDayOpen: true })}>
                        <Icon name="moon" size={11} /> SIGN THE DIARY
                      </button>
                    )}
                  </div>
                </div>
              );
            }
            const nowProject = nowRow.task.projectId ? projectsById.get(nowRow.task.projectId) : null;
            const focusMin = D.todayFocusMs(nowRow.task, hour);
            return (
              <div>
                <div className="k-statement" style={{ ...statementBg("now-" + nowRow.task.id) }}>
                  <div className="k-rowline" style={{ alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="k-display" style={{ fontSize: 8, marginBottom: 7 }}>NOW SCHEMING</div>
                      <div className="k-display" style={{ fontSize: 15, lineHeight: 1.5 }}>{nowRow.task.title}</div>
                      <div className="k-mono" style={{ fontSize: 14, marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap", color: "#5c1030" }}>
                        {nowProject && <span>▸ BOSS: {nowProject.title.toUpperCase()}</span>}
                        {nowRow.chunkNote && <span style={{ fontStyle: "italic" }}>{nowRow.chunkNote}</span>}
                        <span>~{nowRow.chunk?.hours ?? D.taskHours(nowRow.task)}H{focusMin > 0 ? ` · ${D.fmtMs(focusMin)} IN` : ""}</span>
                        <span>{(nowRow.task.difficulty || "medium").toUpperCase()} · +{nowRow.task.xp} XP</span>
                      </div>
                    </div>
                    <button
                      className="k-btn is-green"
                      title="Pull it off now"
                      onClick={() => setCompletion(nowRow.task.id, { done: true, chunkDate: nowRow.chunk ? todayIso : null })}
                    >
                      <Icon name="check" size={11} /> GOT IT
                    </button>
                    <button className="k-btn" style={{ background: "#2a0718", borderColor: "#2a0718", color: "var(--amber-hot)" }} onClick={() => setUI({ focusTaskId: nowRow.task.id })}>
                      ▶ MISCHIEF MODE <Kbd>F</Kbd>
                    </button>
                  </div>
                </div>
                {nextRow && (
                  <div className="k-rowline k-mono-sm k-faint" style={{ marginTop: 6, padding: "0 4px" }}>
                    <span className="k-pink">NEXT:</span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nextRow.task.title}</span>
                    <span><Kbd>[</Kbd><Kbd>]</Kbd> shuffle</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* BUSTED — adrift triage */}
          {missed.length > 0 && (
            <div className="k-plate" style={{ borderColor: "var(--warn)" }}>
              <div className="k-plate-pad" style={{ paddingBottom: 6 }}>
                <div className="k-rowline">
                  <span className="k-eyebrow" style={{ color: "var(--warn)", marginBottom: 0 }}>BUSTED</span>
                  <span className="k-mono-sm k-faint">{missed.length} scheme{missed.length === 1 ? "" : "s"} the plan snitched on</span>
                </div>
              </div>
              <div className="k-plate-pad" style={{ paddingTop: 4 }}>
                {missed.map(({ date, taskId, task, item }, i) => {
                  const project = task.projectId ? projectsById.get(task.projectId) : null;
                  const daysAgo = Math.max(1, Math.round((D.parseIsoDate(todayIso) - D.parseIsoDate(date)) / 86400000));
                  return (
                    <div key={`${date}-${taskId}`} className={"k-row" + (cursorIdx === i ? " is-cursor" : "")}>
                      <div className="k-row-main">
                        <div className="k-row-title">{task.title}</div>
                        <div className="k-row-sub">
                          <span className="k-warn">{daysAgo}D OVERDUE</span>
                          {project && <span style={{ color: project.color }}>{project.title.toUpperCase()}</span>}
                          {item.hours && <span>{item.hours}H PART</span>}
                        </div>
                      </div>
                      <div className="k-row-acts" style={{ opacity: 1 }}>
                        <button className="k-btn is-sm" onClick={() => moveChunkDate(taskId, date, todayIso)} title="Reschedule into today">TODAY</button>
                        <button className="k-btn is-sm is-green" onClick={() => setCompletion(taskId, { done: true, chunkDate: date })} title="It actually happened — mark it">PULLED IT</button>
                        <button className="k-mini-btn" onClick={() => dismissChunk(taskId, date)} title="Let it go (undoable)" aria-label="Let it go">
                          <Icon name="x" size={10} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* the scheme list */}
          <div className="k-rowline">
            <span className="k-eyebrow" style={{ marginBottom: 0, flex: 1 }}>TODAY'S SCHEMES</span>
            <EnergyToggle />
            {stats.doneToday > 0 && !dayClosed && (
              <button className="k-btn is-sm is-ghost" onClick={() => setUI({ endOfDayOpen: true })}>sign the diary →</button>
            )}
          </div>

          {lineup.length > 0 ? (
            <>
              <div>
                {lineup.map((r, i) => {
                  const globalIdx = missed.length + i;
                  return (
                    <div
                      key={r.task.id}
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
                    >
                      <TaskRow
                        task={r.task}
                        chunk={r.chunk}
                        doneHere={r.doneHere}
                        chunkLabel={r.chunkLabel}
                        chunkNote={r.chunkNote}
                        recurringRow={r.recurringRow}
                        cursor={cursorIdx === globalIdx}
                        globalIdx={globalIdx}
                        dragState={dragIdx === i ? "drag" : dragOverIdx === i && dragIdx !== null && dragIdx !== i ? "dragover" : null}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="k-rowline k-mono-sm k-faint" style={{ marginTop: 8, flexWrap: "wrap", gap: 12 }}>
                <span>{planDone}/{lineup.length} PULLED OFF</span>
                <span className="k-spacer" />
                <span><Kbd>J</Kbd><Kbd>K</Kbd> move · <Kbd>X</Kbd> pull off · <Kbd>[</Kbd><Kbd>]</Kbd> shuffle · drag works too</span>
              </div>
            </>
          ) : (
            <EmptyState
              title={pending.length === 0 ? "NOTHING TO PULL OFF" : "NOTHING ON TODAY'S PAGE"}
              glyphRows={GLYPH_HEART}
              sub={pending.length === 0
                ? "The notebook is empty. Whisper a scheme into the slot above — it lands right here."
                : upcoming
                  ? `Next stage: ${D.fmtIsoShort(upcoming.date)} · ${upcoming.items.length} scheme${upcoming.items.length > 1 ? "s" : ""}.`
                  : `${pending.length} scheme${pending.length > 1 ? "s" : ""} waiting in the notebook.`}
              action={
                pending.length === 0 && tasks.length === 0 && projects.length === 0 ? (
                  <button className="k-btn is-primary" onClick={enterPreview}>
                    <Icon name="bolt" size={11} /> REHEARSE WITH SAMPLE MISCHIEF
                  </button>
                ) : pending.length > 0 ? (
                  <button className="k-btn" onClick={() => setUI({ view: "plan" })}>OPEN THE MAP</button>
                ) : null
              }
            />
          )}
        </div>

        {/* the rail */}
        <aside className="k-col">
          {readyToShip.length > 0 && (
            <div className="k-plate k-plate-pad" style={{ borderColor: "var(--starboard)" }}>
              <div className="k-eyebrow is-green">READY TO BEAT</div>
              {readyToShip.slice(0, 4).map((p) => (
                <div key={p.id} className="k-rowline" style={{ marginBottom: 8 }}>
                  <span style={{ width: 8, height: 8, background: "var(--starboard)", borderRadius: 2, boxShadow: "0 0 8px var(--starboard)", flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                  <button className="k-btn is-sm is-green" onClick={() => setUI({ view: "dock", dockFilter: { tab: "projects" } })}>FINISH 'EM</button>
                </div>
              ))}
            </div>
          )}

          <div className="k-plate k-plate-pad">
            <div className="k-eyebrow">NEXT STAGE{upcoming ? ` · ${D.fmtIsoShort(upcoming.date)}` : ""}</div>
            {upcoming ? (
              <>
                {upcoming.items.slice(0, 4).map((it) => {
                  const t = tasksById.get(it.taskId);
                  if (!t) return null;
                  return (
                    <div key={it.taskId} className="k-rowline k-sm" style={{ marginBottom: 6 }}>
                      <span className="k-sub-dot" style={{ background: "var(--port)" }} />
                      <span className="k-dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.title}{it.note ? <span className="k-faint"> — {it.note}</span> : null}
                      </span>
                    </div>
                  );
                })}
                <button className="k-btn is-sm is-ghost k-mt" onClick={() => setUI({ view: "plan" })}>the map →</button>
              </>
            ) : (
              <div className="k-faint k-sm">Nothing scheduled beyond today. Suspiciously responsible.</div>
            )}
          </div>

          <div className="k-plate k-plate-pad">
            <div className="k-eyebrow">BAD HABITS RADAR</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[{ label: "X opens", key: "xOpens" }, { label: "YT opens", key: "ytOpens" }].map((item) => {
                const count = entry[item.key] || 0;
                return (
                  <div key={item.key} className="k-plate k-plate-pad" style={{ padding: "9px 10px" }}>
                    <div className="k-rowline" style={{ marginBottom: 7 }}>
                      <span className="k-lab" style={{ fontFamily: "var(--t-display)", fontSize: 7, color: "var(--fg-faint)" }}>{item.label}</span>
                      <span className="k-spacer" />
                      <span className="k-display" style={{ fontSize: 15 }}>{count}</span>
                    </div>
                    <div className="k-rowline">
                      <button className="k-btn is-sm" style={{ flex: 1 }} onClick={() => patchScreenToday({ [item.key]: count + 1 })}>+1</button>
                      {count > 0 && <button className="k-btn is-sm is-ghost" onClick={() => patchScreenToday({ [item.key]: Math.max(0, count - 1) })}>−</button>}
                    </div>
                  </div>
                );
              })}
            </div>
            <MobileHoursInput entry={entry} />
            <button className="k-btn is-sm is-ghost k-mt" onClick={() => setUI({ statsOpen: true })}>confession history →</button>
          </div>

          <div className="k-rowline" style={{ justifyContent: "center", opacity: 0.6 }}>
            <GhostFoot rows={GLYPH_HEART} color="#37234e" size={30} />
            <span className="k-mono-sm k-faint">plotting, always plotting</span>
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
      <div className="k-rowline k-mono-sm k-dim k-mt">
        <span>{entry.mobileHours}H ON THE PHONE TODAY</span>
        <span className="k-spacer" />
        <button className="k-btn is-sm is-ghost" onClick={() => patchScreenToday({ mobileHours: null })}>clear</button>
      </div>
    );
  }
  const log = () => { if (v) { patchScreenToday({ mobileHours: parseFloat(v) || 0 }); setV(""); } };
  return (
    <div className="k-rowline k-mt">
      <input
        type="number" min="0" max="24" step="0.5" placeholder="phone hours"
        value={v} onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") log(); }}
        className="k-input k-mono" style={{ flex: 1, padding: "5px 9px" }}
      />
      <button className="k-btn is-sm" disabled={!v} onClick={log}>CONFESS</button>
    </div>
  );
}

export function EnergyToggle() {
  const energy = useStore((s) => s.ui.energy);
  const opts = [
    { id: "low", label: "SOFT", title: "Surface easy schemes first" },
    { id: "normal", label: "AUTO", title: "Sort by heat" },
    { id: "high", label: "FERAL", title: "Surface hard schemes first" },
  ];
  return (
    <div className="k-slab-types" role="group" aria-label="Mood of the day" style={{ margin: 0, width: 210 }}>
      {opts.map((o) => (
        <button key={o.id} type="button" title={o.title} aria-pressed={energy === o.id}
          className={energy === o.id ? "is-on" : ""}
          onClick={() => setUI({ energy: o.id })}>{o.label}</button>
      ))}
    </div>
  );
}
