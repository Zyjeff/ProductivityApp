// today.jsx — Feed: mesh field, vertical signal stack, no right rail.

import React, { useEffect, useMemo, useState } from "react";
import { Icon, EmptyState, Kbd, Stamp, Meter } from "../components.jsx";
import { Spark, WeekBars } from "../charts.jsx";
import { MeshField } from "../mesh.jsx";
import { CaptureSlab } from "../capture.jsx";
import { TaskRow, ChunksEditor } from "../taskrow.jsx";
import * as D from "../../../core/domain.js";
import {
  useStore, getState, setUI, setCompletion, todayLineup,
  dismissChunk, moveChunkDate, patchScreenToday, reopenDay,
  enterPreview, setLineupOrder, ensureMorningBrief, patchBrief, applyBriefOrder,
  reviewPromptDue, openReview, patchReview,
} from "../../../core/store.js";
import { generateBriefProse } from "../../../core/enrich.js";
import { registerActiveList } from "../../../core/keys.js";

function EnergyToggle() {
  const energy = useStore((s) => s.ui.energy);
  const opts = [
    { id: "low", label: "Low" },
    { id: "normal", label: "Auto" },
    { id: "high", label: "High" },
  ];
  return (
    <div className="r-gain" role="group" aria-label="Gain">
      {opts.map((o) => (
        <button key={o.id} type="button" className={energy === o.id ? "on" : ""}
          onClick={() => setUI({ energy: o.id })}>{o.label}</button>
      ))}
    </div>
  );
}

function MobileHoursInput({ entry }) {
  const [v, setV] = useState(entry.mobileHours != null ? String(entry.mobileHours) : "");
  useEffect(() => { setV(entry.mobileHours != null ? String(entry.mobileHours) : ""); }, [entry.mobileHours]);
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
      <span className="r-lab">Mobile h</span>
      <input className="r-field r-num" style={{ width: 64, padding: "4px 6px" }} value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if (v === "") patchScreenToday({ mobileHours: null });
          else patchScreenToday({ mobileHours: parseFloat(v) || 0 });
        }}
        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
        placeholder="—" />
      {entry.mobileHours != null && (
        <button className="r-link" onClick={() => { setV(""); patchScreenToday({ mobileHours: null }); }}>clear</button>
      )}
    </div>
  );
}

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
  const xpLeft = lineup.reduce((s2, r) => s2 + (r.doneHere ? 0 : (r.task.xp || 0)), 0);

  const hourNow = new Date().getHours();
  const allDone = lineup.length > 0 && planDone === lineup.length;
  const greeting = allDone ? "Feed clear. Cycle clean."
    : lineup.length === 0 && pending.length === 0 ? "No traffic. Route a packet."
    : hourNow < 5 ? "Late cycle."
    : hourNow < 12 ? "Morning uplink."
    : hourNow < 14 ? "Midday traffic."
    : hourNow < 18 ? "Afternoon push."
    : hourNow < 22 ? "Evening cycle."
    : "Still on the grid.";

  const entry = screen[todayIso] || { xOpens: 0, ytOpens: 0, mobileHours: null };
  const dayClosed = meta.dayClosed && meta.dayClosed.date === todayIso ? meta.dayClosed : null;
  const upcoming = (plan || []).filter((e) => e.date > todayIso && e.items.length).sort((a, b) => a.date.localeCompare(b.date))[0];
  let cursorIdx = cursor ? cursor.index : -1;
  const dueWeek = reviewPromptDue(getState());

  const fmtFocus = (ms) => {
    const min = Math.round(ms / 60000);
    return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
  };

  return (
    <div>
      <div className="r-feed-head">
        <div>
          <div className="r-lab r-lab--lit" style={{ marginBottom: 6 }}>
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <h1 className="r-feed-greet">{greeting}</h1>
        </div>
        <div className="r-feed-counts">
          <span><strong>{pending.length}</strong> pending</span>
          <span><strong>{lineup.length}</strong> queued</span>
          {readyToShip.length > 0 && <span style={{ color: "var(--lime)" }}><strong>{readyToShip.length}</strong> ready</span>}
        </div>
        <EnergyToggle />
      </div>

      {dayClosed && (
        <div className="r-plate r-plate--flush fade-in" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <Icon name="moon" size={13} />
          <span className="r-num" style={{ fontSize: 11, color: "var(--fg-dim)", flex: 1 }}>
            CYCLE CLOSED · {new Date(dayClosed.closedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toUpperCase()}
          </span>
          <button className="r-link" onClick={reopenDay}>Reopen</button>
        </div>
      )}

      <MeshField
        todayXP={stats.todayXP}
        streak={stats.streakRun}
        pending={pending.length}
        orphans={missed.length}
        focusLabel={fmtFocus(stats.focusToday)}
        nextLabel={upcoming ? D.fmtIsoShort(upcoming.date).toUpperCase() : "—"}
        trend={stats.xpTrend}
      />

      {/* stat strip under mesh */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
        <div className="r-plate r-plate--flush">
          <div className="r-lab">Signal XP</div>
          <div className="r-display r-num" style={{ fontSize: 22 }}>{stats.todayXP}</div>
          <Spark data={stats.xp7} />
        </div>
        <div className="r-plate r-plate--flush">
          <div className="r-lab">Lock</div>
          <div className="r-display r-num" style={{ fontSize: 22 }}>{stats.streakRun}<span className="r-lab" style={{ marginLeft: 4 }}>d</span></div>
          <WeekBars days={stats.week} />
        </div>
        <div className="r-plate r-plate--flush">
          <div className="r-lab">Resolved</div>
          <div className="r-display r-num" style={{ fontSize: 22 }}>{stats.doneToday}</div>
          <div className="r-lab" style={{ marginTop: 4 }}>{stats.doneTrend != null ? `${stats.doneTrend > 0 ? "▲" : stats.doneTrend < 0 ? "▼" : "·"}${Math.abs(stats.doneTrend)}%` : "—"}</div>
        </div>
        <div className="r-plate r-plate--flush">
          <div className="r-lab">Queue</div>
          <div className="r-display r-num" style={{ fontSize: 22 }}>{planDone}<span style={{ color: "var(--fg-faint)" }}>/{lineup.length}</span></div>
          <Meter pct={lineup.length ? (planDone / lineup.length) * 100 : 0} tone="var(--lime)" height={4} />
          <div className="r-lab" style={{ marginTop: 4 }}>{xpLeft} XP left</div>
        </div>
      </div>

      {/* horizontal aux chips — not a right rail */}
      <div className="r-aux-strip">
        {readyToShip.length > 0 && (
          <div className="r-aux-chip r-aux-chip--hot">
            <strong>{readyToShip.length}</strong> ready to deploy
            <button onClick={() => setUI({ view: "dock" })}>Systems →</button>
          </div>
        )}
        {upcoming && (
          <div className="r-aux-chip">
            Next lattice <strong>{D.fmtIsoShort(upcoming.date)}</strong>
            <span className="r-num" style={{ color: "var(--fg-faint)" }}>{upcoming.items.length} pkt</span>
            <button onClick={() => setUI({ view: "plan" })}>Open →</button>
          </div>
        )}
        <div className="r-aux-chip">
          <span className="r-lab">X</span>
          <strong>{entry.xOpens || 0}</strong>
          <button onClick={() => patchScreenToday({ xOpens: (entry.xOpens || 0) + 1 })}>+1</button>
          {(entry.xOpens || 0) > 0 && <button onClick={() => patchScreenToday({ xOpens: Math.max(0, (entry.xOpens || 0) - 1) })}>−</button>}
          <span className="r-lab">YT</span>
          <strong>{entry.ytOpens || 0}</strong>
          <button onClick={() => patchScreenToday({ ytOpens: (entry.ytOpens || 0) + 1 })}>+1</button>
          {(entry.ytOpens || 0) > 0 && <button onClick={() => patchScreenToday({ ytOpens: Math.max(0, (entry.ytOpens || 0) - 1) })}>−</button>}
          <MobileHoursInput entry={entry} />
        </div>
        {dueWeek && (
          <div className="r-aux-chip r-aux-chip--warn">
            Week retro due
            <button onClick={() => openReview(dueWeek)}>Open <Kbd>W</Kbd></button>
            <button onClick={() => patchReview(dueWeek, { promptDismissed: true })} aria-label="Dismiss"><Icon name="close" size={11} /></button>
          </div>
        )}
        {stats.doneToday > 0 && !dayClosed && (
          <div className="r-aux-chip">
            <button onClick={() => setUI({ endOfDayOpen: true })}>End of cycle →</button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <CaptureSlab scheduleToday />
      </div>

      {/* Uplink (brief) */}
      {brief && (brief.dismissed ? (
        <button className="r-lab" onClick={() => patchBrief(todayIso, { dismissed: false })}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", marginBottom: 14, padding: "8px 12px", background: "var(--plate)", border: "1px solid var(--line)", borderRadius: 8, cursor: "pointer" }}>
          <Icon name="bolt" size={10} /> Uplink <span style={{ marginLeft: "auto" }} className="r-kbd">B</span>
        </button>
      ) : (
        <div className="r-glass fade-in" style={{ marginBottom: 16 }} seed={"brief-" + todayIso}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span className="r-lab r-lab--lit">Uplink</span>
            <div style={{ flex: 1 }} />
            <button className="r-icon-btn" title="Regenerate" onClick={() => patchBrief(todayIso, { attempted: false, text: null, order: null })}>
              <Icon name="reset" size={11} />
            </button>
            <button className="r-icon-btn" title="Collapse (B)" onClick={() => patchBrief(todayIso, { dismissed: true })}>
              <Icon name="close" size={11} />
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
            <Stamp>{briefData.yesterday.count > 0
              ? `yesterday ${briefData.yesterday.count} · ${briefData.yesterday.xp} XP${briefData.yesterday.focusMs ? " · " + D.fmtMs(briefData.yesterday.focusMs) : ""}`
              : "yesterday quiet"}</Stamp>
            {briefData.adrift > 0 && <Stamp tone="var(--warn)">{`${briefData.adrift} orphans`}</Stamp>}
            <Stamp tone={briefData.overloaded ? "var(--port)" : undefined}>
              {briefData.dayOff
                ? `day off · ${briefData.lineup.length} queued anyway`
                : `today ${briefData.lineup.length} · ${briefData.lineupHours}h / ${briefData.capacity}h${briefData.overloaded ? " — OVER" : ""}`}
            </Stamp>
            {briefData.deadlinesSoon.map((d) => (
              <Stamp key={d.title} tone={d.overdue ? "var(--port)" : "var(--warn)"}>
                {`${d.overdue ? "OVERDUE" : d.days === 0 ? "due today" : "due " + d.days + "d"}: ${d.title.slice(0, 30)}`}
              </Stamp>
            ))}
          </div>
          {brief.text ? (
            <>
              <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--fg-dim)" }}>{brief.text}</div>
              {brief.order?.length > 1 && (
                <button className="r-btn r-btn--sm r-btn--ghost" style={{ marginTop: 10 }}
                  onClick={() => applyBriefOrder(brief.order)}>
                  Apply suggested run order
                </button>
              )}
            </>
          ) : brief.attempted && aiStatus !== "busy" ? (
            <div className="r-num" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
              AI OFF — FACTS ABOVE ARE THE UPLINK.{" "}
              <button className="r-link" onClick={() => patchBrief(todayIso, { attempted: false })}>retry</button>
            </div>
          ) : (
            <div className="r-num" style={{ fontSize: 11, color: "var(--fg-faint)" }}>WRITING UPLINK…</div>
          )}
        </div>
      ))}

      {/* Active packet (NOW) */}
      {lineup.length > 0 && (() => {
        const pendingRows = lineup.filter((r) => !r.doneHere);
        const nowRow = pendingRows[0];
        const nextRow = pendingRows[1];
        if (!nowRow) {
          return (
            <div className="r-now fade-in" style={{ background: "linear-gradient(135deg, rgba(182,255,60,.15), rgba(16,24,42,.9))", borderColor: "rgba(182,255,60,.4)" }}>
              <div className="r-lab" style={{ color: "var(--lime)" }}>Feed clear</div>
              <div className="r-now-title">Everything on the queue is resolved.</div>
              {!dayClosed && (
                <div className="r-now-actions">
                  <button className="r-btn r-btn--lime" onClick={() => setUI({ endOfDayOpen: true })}>
                    <Icon name="moon" size={11} /> End of cycle
                  </button>
                </div>
              )}
            </div>
          );
        }
        const nowProject = nowRow.task.projectId ? projectsById.get(nowRow.task.projectId) : null;
        const focusMin = D.todayFocusMs(nowRow.task, hour);
        return (
          <div className="r-now fade-in">
            <div className="r-lab r-lab--lit">Active packet</div>
            <div className="r-now-title">{nowRow.task.title}</div>
            <div className="r-pkt-meta">
              {nowProject && <span style={{ color: nowProject.color }}>{nowProject.title}</span>}
              {nowRow.chunkNote && <span style={{ fontStyle: "italic" }}>{nowRow.chunkNote}</span>}
              <span>~{nowRow.chunk?.hours ?? D.taskHours(nowRow.task)}h{focusMin > 0 ? ` · ${D.fmtMs(focusMin)} in` : ""}</span>
              <span>+{nowRow.task.xp} XP</span>
            </div>
            <div className="r-now-actions">
              <button className="r-btn" onClick={() => setCompletion(nowRow.task.id, { done: true, chunkDate: nowRow.chunk ? todayIso : null })}>
                Resolve
              </button>
              <button className="r-btn r-btn--ghost" onClick={() => setUI({ focusTaskId: nowRow.task.id })}>
                Deep cycle <Kbd>F</Kbd>
              </button>
            </div>
            {nextRow && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line)", fontSize: 12.5, color: "var(--fg-dim)" }}>
                <span className="r-lab" style={{ marginRight: 8 }}>Next</span>{nextRow.task.title}
              </div>
            )}
          </div>
        );
      })()}

      {/* Orphans */}
      {missed.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div className="r-eyebrow">
            <span className="r-lab" style={{ color: "var(--port)" }}>Orphans · {missed.length}</span>
          </div>
          {missed.map(({ date, taskId, task, item }, i) => {
            const project = task.projectId ? projectsById.get(task.projectId) : null;
            const daysAgo = Math.max(1, Math.round((D.parseIsoDate(todayIso) - D.parseIsoDate(date)) / 86400000));
            return (
              <div key={`${date}-${taskId}`}
                className={"r-pkt r-pkt--orphan" + (cursorIdx === i ? " r-pkt--cursor" : "")}
                onMouseEnter={() => setUI({ cursor: { index: i } })}>
                <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="r-pkt-title">{task.title}</div>
                    <div className="r-pkt-meta">
                      <span style={{ color: "var(--port)" }}>{daysAgo}D DROPPED</span>
                      {project && <span style={{ color: project.color }}>{project.title}</span>}
                      {item.hours && <span>{item.hours}H</span>}
                    </div>
                  </div>
                  <button className="r-btn r-btn--sm r-btn--ghost" onClick={() => moveChunkDate(taskId, date, todayIso)}>Today</button>
                  <button className="r-btn r-btn--sm" onClick={() => setCompletion(taskId, { done: true, chunkDate: date })}>Done</button>
                  <button className="r-icon-btn" onClick={() => dismissChunk(taskId, date)} title="Drop from plan" aria-label="Dismiss"><Icon name="close" size={11} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Queue */}
      <div className="r-eyebrow">
        <span className="r-lab">Queue</span>
        <EnergyToggle />
      </div>

      {lineup.length > 0 ? (
        <>
          {lineup.map((r, i) => {
            const globalIdx = missed.length + i;
            const chunks = r.chunk ? D.getTaskChunks(r.task.id, plan) : [];
            return (
              <div key={r.task.id}
                draggable
                className={(dragIdx === i ? " r-pkt--drag" : "") + (dragOverIdx === i && dragIdx !== null && dragIdx !== i ? " r-pkt--over" : "")}
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
                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}>
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
          <div className="r-num" style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 9.5, color: "var(--fg-faint)" }}>
            <span>{planDone}/{lineup.length} RESOLVED</span>
            <span>J/K · X · [ ] · DRAG</span>
          </div>
        </>
      ) : (
        <EmptyState caption="no traffic on the grid">
          {pending.length === 0 ? (
            <>
              <div className="r-display" style={{ fontSize: 17, color: "var(--fg)", marginBottom: 8 }}>No packets on the grid.</div>
              <div>Type above — it routes into today's feed.</div>
              {tasks.length === 0 && projects.length === 0 && (
                <div style={{ marginTop: 16 }}>
                  <button className="r-btn" onClick={enterPreview}>
                    <Icon name="bolt" size={11} /> Try sandbox data
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="r-display" style={{ fontSize: 17, color: "var(--fg)", marginBottom: 8 }}>Nothing queued for today.</div>
              <div style={{ marginBottom: 14 }}>
                {upcoming
                  ? <>Next lattice day: {D.fmtIsoShort(upcoming.date)} · {upcoming.items.length} packet{upcoming.items.length > 1 ? "s" : ""}.</>
                  : <>{pending.length} packet{pending.length > 1 ? "s" : ""} waiting off-grid.</>}
              </div>
              <button className="r-btn" onClick={() => setUI({ view: "plan" })}>Open lattice</button>
            </>
          )}
        </EmptyState>
      )}
    </div>
  );
}
