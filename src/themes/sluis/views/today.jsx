// views/today.jsx — DE KOLK. The lock chamber cross-section: greeting,
// the KolkCanvas with its gate leaves and HUD, the lock entrance
// (capture), the sluisbericht, the NU spotlight, drijfwerk triage, the
// vessel lineup with drag reorder, and the rail (nachtsluiting banner,
// weekschouw nudge, tewaterlating, next pound, seinlog).
// All state, handlers, and data flow lifted from the Nightwatch
// reference — identical to the core contract.

import React, { useEffect, useMemo, useState } from "react";
import {
  Icon, Kbd, Chip, Eyebrow, EmptyState, WakeFoot,
  GateLeaf, GateMark, KolkCanvas, TideSwitch, seededUnit,
} from "../components.jsx";
import { CaptureSlab } from "../capture.jsx";
import { TaskRow, ChunksEditor } from "../taskrow.jsx";
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

  // The keyboard contract: drijfwerk rows first, then the lineup.
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
      week.push({ label: "MTWTFSS"[i], value: activity.get(iso)?.size || 0, title: `${iso}: ${activity.get(iso)?.size || 0} door geschut`, isToday: iso === todayIso });
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

  // Live focus: the tunnel saves task.focusMs every 5s but only appends
  // to the session ledger on exit — add the not-yet-logged difference
  // (clamped per task, so logged time is never counted twice).
  const focusTodayMs = useMemo(() => {
    const logged = new Map();
    for (const x of sessions || []) {
      if (x.dateIso === todayIso) logged.set(x.taskId, (logged.get(x.taskId) || 0) + (x.ms || 0));
    }
    let extra = 0;
    for (const t of tasks) extra += Math.max(0, D.todayFocusMs(t, hour) - (logged.get(t.id) || 0));
    return stats.focusToday + extra;
  }, [sessions, tasks, todayIso, hour, stats.focusToday]);

  const pending = tasks.filter((t) => !t.completed && t.recurring === "none");
  const readyToShip = projects.filter((p) => !p.completedAt && (p.childTaskIds || []).length > 0 && D.progressOfProject(p, tasksById) === 100);
  const planDone = lineup.filter((r) => r.doneHere).length;

  const hourNow = new Date().getHours();
  const allDone = lineup.length > 0 && planDone === lineup.length;
  const greeting = allDone ? "Kolk leeg — de deuren gaan open."
    : lineup.length === 0 && pending.length === 0 ? "Stil water — geen vaartuig aangemeld."
    : hourNow < 5 ? "Night watch — the lock never sleeps."
    : hourNow < 12 ? "Goedemorgen, sluiswachter."
    : hourNow < 14 ? "Midday — keep the water moving."
    : hourNow < 18 ? "Back at the gates."
    : hourNow < 22 ? "Avonddienst — evening tide at the lock."
    : "Late shift at the lock.";

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

  // The chamber: earned slate XP ÷ total slate XP; pending vessels bob
  // at the waterline, x seeded by task id, hull width from hours.
  const kolk = useMemo(() => {
    const total = lineup.reduce((a, r) => a + (r.task.xp || 0), 0);
    const earned = lineup.reduce((a, r) => a + (r.doneHere ? (r.task.xp || 0) : 0), 0);
    const fillPct = lineup.length === 0 ? (stats.todayXP > 0 ? 1 : 0) : total > 0 ? earned / total : 0;
    const vessels = lineup.filter((r) => !r.doneHere).map((r) => {
      const h = r.chunk?.hours ?? D.taskHours(r.task);
      return { x: seededUnit(r.task.id), w: Math.max(0.06, Math.min(0.2, h / 6)), done: false };
    });
    return { fillPct, vessels };
  }, [lineup, stats.todayXP]);

  const trendSign = (v) => (v > 0 ? "+" : v < 0 ? "−" : "±");
  const trendColor = (v) => (v > 0 ? "var(--starboard)" : v < 0 ? "var(--port)" : "var(--fg-faint)");

  return (
    <div>
      {/* ── greeting row ─────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div className="s-stencil-row" style={{ marginBottom: 8 }}>
          <span className="s-stencil s-stencil--lit">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <h1 className="s-display" style={{ fontSize: 29, margin: 0, lineHeight: 1.15 }}>{greeting}</h1>
          <div className="s-num" style={{ fontSize: 10.5, color: "var(--fg-dim)", letterSpacing: ".04em" }}>
            {pending.length} OP DE WERF · {lineup.length} IN DE KOLK
            {readyToShip.length ? <span style={{ color: "var(--starboard)" }}> · {readyToShip.length} KLAAR VOOR TEWATERLATING</span> : null}
          </div>
        </div>
      </div>

      {/* ── de kolk — the chamber cross-section ──────────────── */}
      <div className="s-kolk" style={{ marginBottom: 12 }}>
        <div style={{ position: "relative" }}>
          <KolkCanvas fillPct={kolk.fillPct} vessels={kolk.vessels} height={150} animate />
          <GateLeaf side="l" open={allDone} />
          <GateLeaf side="r" open={allDone} />
        </div>
        <div className="s-kolk-hud">
          <div className="s-kolk-hud-cell">
            <span className="s-stencil">Peil</span>
            <div className="s-kolk-hud-val">
              {stats.todayXP}<span style={{ fontSize: 10, color: "var(--fg-faint)" }}> XP</span>
            </div>
            <div className="s-num" style={{ fontSize: 9.5, marginTop: 2, color: stats.xpTrend != null ? trendColor(stats.xpTrend) : "var(--fg-faint)" }}>
              {stats.xpTrend != null ? `${trendSign(stats.xpTrend)}${Math.abs(stats.xpTrend)}% 7v7` : "eerste week"}
            </div>
          </div>
          <div className="s-kolk-hud-cell">
            <span className="s-stencil">Stroom</span>
            <div className="s-kolk-hud-val" style={{ display: "flex", alignItems: "center", gap: 6, color: stats.xpTrend != null ? trendColor(stats.xpTrend) : "var(--fg-faint)" }}>
              {stats.xpTrend == null ? "—" : <Icon name={stats.xpTrend >= 0 ? "up" : "down"} size={16} />}
            </div>
            <div className="s-num" style={{ fontSize: 9.5, marginTop: 2, color: "var(--fg-faint)" }}>
              {stats.xpTrend == null ? "stil" : stats.xpTrend >= 0 ? "opgaand" : "afgaand"}
            </div>
          </div>
          <div className="s-kolk-hud-cell">
            <span className="s-stencil">Vaart</span>
            <div className="s-kolk-hud-val">
              {stats.streakRun}<span style={{ fontSize: 10, color: "var(--fg-faint)" }}> D</span>
            </div>
            <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
              {stats.week.map((d, i) => (
                <span key={d.title || i} title={d.title} style={{
                  width: 8, height: 8, borderRadius: 2,
                  background: d.value > 0 ? "var(--water)" : "var(--well)",
                  border: "1px solid var(--line)",
                  boxShadow: d.isToday ? "0 0 0 2px var(--amber-ground), 0 0 0 3px var(--amber)" : "none",
                }} />
              ))}
            </div>
          </div>
          <div className="s-kolk-hud-cell">
            <span className="s-stencil">Drijfwerk</span>
            <div className="s-kolk-hud-val" style={{ color: missed.length ? "var(--amber-deep)" : undefined }}>
              {missed.length}
            </div>
            <div className="s-num" style={{ fontSize: 9.5, marginTop: 2, color: "var(--fg-faint)" }}>
              {missed.length ? "te bergen" : "helder water"}
            </div>
          </div>
          <div className="s-kolk-hud-cell">
            <span className="s-stencil">Focus</span>
            <div className="s-kolk-hud-val">{fmtFocus(focusTodayMs)}</div>
            <div className="s-num" style={{ fontSize: 9.5, marginTop: 2, color: "var(--fg-faint)" }}>
              {stats.doneToday} GESCHUT{stats.doneTrend != null ? ` · ${trendSign(stats.doneTrend)}${Math.abs(stats.doneTrend)}%` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* ── the lock entrance ────────────────────────────────── */}
      <div style={{ marginBottom: 18 }}>
        <CaptureSlab scheduleToday />
      </div>

      <div className="s-grid-2">
        <div className="s-col">
          {/* ── sluisbericht ─────────────────────────────────── */}
          {brief && (brief.dismissed ? (
            <button className="s-brief" onClick={() => patchBrief(todayIso, { dismissed: false })}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", cursor: "pointer", textAlign: "left" }}>
              <Icon name="bolt" size={11} />
              <span className="s-stencil">Sluisbericht</span>
              <span style={{ marginLeft: "auto" }}><Kbd>B</Kbd></span>
            </button>
          ) : (
            <div className="s-brief">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span className="s-stencil s-stencil--lit">Sluisbericht</span>
                <span className="s-num" style={{ fontSize: 10, color: "var(--fg-faint)" }}>
                  {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).toUpperCase()}
                </span>
                <div style={{ flex: 1 }} />
                <button className="s-icon-btn" title="Herschrijf het bericht"
                  onClick={() => patchBrief(todayIso, { attempted: false, text: null, order: null })}>
                  <Icon name="reset" size={11} />
                </button>
                <button className="s-icon-btn" title="Inklappen (B)" aria-label="Collapse brief"
                  onClick={() => patchBrief(todayIso, { dismissed: true })}>
                  <Icon name="close" size={11} />
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: brief.text || brief.attempted ? 10 : 0 }}>
                <Chip>{briefData.yesterday.count > 0
                  ? `gisteren ${briefData.yesterday.count} geschut · ${briefData.yesterday.xp} XP${briefData.yesterday.focusMs ? " · " + D.fmtMs(briefData.yesterday.focusMs) : ""}`
                  : "gisteren stil water"}</Chip>
                {briefData.adrift > 0 && <Chip tone="var(--amber-deep)">{`${briefData.adrift} drijfwerk`}</Chip>}
                <Chip tone={briefData.overloaded ? "var(--port)" : undefined}>
                  {briefData.dayOff
                    ? `rustdag · ${briefData.lineup.length} toch aangemeld`
                    : `vandaag ${briefData.lineup.length} vaartuigen · ${briefData.lineupHours}h van ${briefData.capacity}h${briefData.overloaded ? " — TE VOL" : ""}`}
                </Chip>
                {briefData.deadlinesSoon.map((d) => (
                  <Chip key={d.title} tone={d.overdue ? "var(--port)" : "var(--amber-deep)"}>
                    {`${d.overdue ? "OVER TIJD" : d.days === 0 ? "deadline vandaag" : "deadline over " + d.days + "d"}: ${d.title.slice(0, 30)}`}
                  </Chip>
                ))}
              </div>
              {brief.text ? (
                <>
                  <div style={{ fontSize: 13, lineHeight: 1.65 }}>{brief.text}</div>
                  {brief.order?.length > 1 && (
                    <button className="s-btn s-btn--sm s-btn--amber" style={{ marginTop: 10 }}
                      onClick={() => applyBriefOrder(brief.order)}>
                      Pas de voorgestelde vaartvolgorde toe
                    </button>
                  )}
                </>
              ) : brief.attempted && aiStatus !== "busy" ? (
                <div className="s-num" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                  AI staat uit — de cijfers hierboven zijn het bericht.{" "}
                  <button style={{ fontSize: 11, color: "var(--water)", fontWeight: 600, textDecoration: "underline" }}
                    onClick={() => patchBrief(todayIso, { attempted: false })}>Retry</button>
                </div>
              ) : (
                <div className="s-num" style={{ fontSize: 11, color: "var(--fg-faint)" }}>HET BERICHT WORDT GESCHREVEN…</div>
              )}
            </div>
          ))}

          {/* ── nu aan de kolk ───────────────────────────────── */}
          {lineup.length > 0 && (() => {
            const pendingRows = lineup.filter((r) => !r.doneHere);
            const nowRow = pendingRows[0];
            const nextRow = pendingRows[1];
            if (!nowRow) {
              return (
                <div className="s-now" style={{ ...statementBg("cleared-" + todayIso, "#095b70", "#d9edf2"), display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ color: "var(--water-deep)", display: "inline-flex", flexShrink: 0 }}><GateMark open size={26} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="s-stencil" style={{ marginBottom: 4, color: "var(--water-deep)" }}>Kolk leeg</div>
                    <div className="s-display" style={{ fontSize: 20 }}>De deuren gaan open — alles op de stapel is door geschut.</div>
                  </div>
                  {!dayClosed && (
                    <button className="s-btn s-btn--sm" style={{ flexShrink: 0 }} onClick={() => setUI({ endOfDayOpen: true })}>
                      <Icon name="moon" size={11} /> Nachtsluiting
                    </button>
                  )}
                </div>
              );
            }
            const nowProject = nowRow.task.projectId ? projectsById.get(nowRow.task.projectId) : null;
            const focusMin = D.todayFocusMs(nowRow.task, hour);
            return (
              <div className="s-now" style={{ background: "var(--plate)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="s-stencil" style={{ marginBottom: 6 }}>Nu aan de kolk</div>
                    <div className="s-display" style={{ fontSize: 21, lineHeight: 1.2, marginBottom: 6 }}>{nowRow.task.title}</div>
                    <div className="s-num" style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 10.5, color: "var(--fg-dim)" }}>
                      {nowProject && <span style={{ color: nowProject.color }}>▸ {nowProject.title.toUpperCase()}</span>}
                      {nowRow.chunkNote && <span style={{ fontStyle: "italic" }}>{nowRow.chunkNote}</span>}
                      <span>~{nowRow.chunk?.hours ?? D.taskHours(nowRow.task)}h{focusMin > 0 ? ` · ${D.fmtMs(focusMin)} gefocust` : ""}</span>
                      <span>{(nowRow.task.difficulty || "medium").toUpperCase()} · +{nowRow.task.xp} XP</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                    <button className="s-btn"
                      onClick={() => setCompletion(nowRow.task.id, { done: true, chunkDate: nowRow.chunk ? todayIso : null })}>
                      <Icon name="check" size={12} /> Schut door
                    </button>
                    <button className="s-btn s-btn--ghost" onClick={() => setUI({ focusTaskId: nowRow.task.id })}>
                      <Icon name="focus" size={11} /> Focus <Kbd>F</Kbd>
                    </button>
                  </div>
                </div>
                {nextRow && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--line-strong)" }}>
                    <span className="s-stencil">Hierna</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nextRow.task.title}</span>
                    <span className="s-num" style={{ fontSize: 9.5, color: "var(--fg-faint)" }}>[ ] REORDER</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── drijfwerk ────────────────────────────────────── */}
          {missed.length > 0 && (
            <div>
              <Eyebrow lit right={
                <span className="s-num" style={{ fontSize: 10, color: "var(--amber-deep)" }}>
                  {missed.length} TE BERGEN
                </span>
              }>Drijfwerk</Eyebrow>
              <div className="s-drift">
                {missed.map(({ date, taskId, task, item }, i) => {
                  const project = task.projectId ? projectsById.get(task.projectId) : null;
                  const daysAgo = Math.max(1, Math.round((D.parseIsoDate(todayIso) - D.parseIsoDate(date)) / 86400000));
                  return (
                    <div key={`${date}-${taskId}`}
                      className={"s-vessel s-vessel--adrift" + (cursorIdx === i ? " s-vessel--cursor" : "")}
                      style={{ alignItems: "center" }}>
                      <span className="s-num" title={`${daysAgo} day${daysAgo === 1 ? "" : "s"} adrift`}
                        style={{ fontSize: 9.5, fontWeight: 700, color: "var(--amber-deep)", background: "var(--amber-ground)", border: "1px solid var(--amber)", borderRadius: 6, padding: "2px 6px", flexShrink: 0 }}>
                        {daysAgo}D
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="s-vessel-title">{task.title}</div>
                        <div className="s-vessel-meta s-num" style={{ fontSize: 10 }}>
                          {project && <span style={{ color: project.color }}>{project.title.toUpperCase()}</span>}
                          {item.hours ? <span>{item.hours}H BLOK</span> : null}
                          <span style={{ color: "var(--fg-faint)" }}>gemerkt {D.fmtIsoShort(date).toUpperCase()}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <button className="s-btn s-btn--sm" onClick={() => moveChunkDate(taskId, date, todayIso)} title="Sleep naar vandaag">Vandaag</button>
                        <button className="s-btn s-btn--sm s-btn--ghost" onClick={() => setCompletion(taskId, { done: true, chunkDate: date })} title="Was al gedaan — schut alsnog door">Schut</button>
                        <button className="s-btn s-btn--sm s-btn--ghost" onClick={() => dismissChunk(taskId, date)} title="Laat liggen (vaar terug mogelijk)">Laat liggen</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── the lineup ───────────────────────────────────── */}
          <div>
            <Eyebrow lit right={
              <TideSwitch value={energy} onChange={(v) => setUI({ energy: v })} />
            }>Aangemeld voor vandaag</Eyebrow>

            {lineup.length > 0 ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                        className={dragIdx === i ? "s-vessel--drag" : undefined}
                        style={{
                          borderRadius: "var(--r-md)",
                          boxShadow: dragOverIdx === i && dragIdx !== null && dragIdx !== i ? "inset 0 2px 0 var(--water)" : "none",
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
                <div className="s-num" style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 8, fontSize: 9.5, color: "var(--fg-faint)", flexWrap: "wrap" }}>
                  <span>{planDone}/{lineup.length} DOOR GESCHUT · {xpLeft} XP TE GAAN</span>
                  <span>J/K MOVE · X COMPLETE · [ ] REORDER · DRAG</span>
                </div>
              </>
            ) : (
              <EmptyState caption={pending.length === 0 ? "stil water — geen vaartuig aangemeld" : "rustig water"}>
                {pending.length === 0 ? (
                  <>
                    <div className="s-display" style={{ fontSize: 17, color: "var(--fg)", marginBottom: 8 }}>Stil water — nothing afloat.</div>
                    <div>Type in the lock entrance above — the vessel moors right here, scheduled for today.</div>
                    {tasks.length === 0 && projects.length === 0 && (
                      <div style={{ marginTop: 16 }}>
                        <button className="s-btn" onClick={enterPreview}>
                          <Icon name="wave" size={12} /> Try oefenwater
                        </button>
                        <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 8 }}>
                          Loads a demo yard — your (empty) data is snapshotted and restored on exit.
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="s-display" style={{ fontSize: 17, color: "var(--fg)", marginBottom: 8 }}>Nothing lined up for today.</div>
                    <div style={{ marginBottom: 14 }}>
                      {upcoming
                        ? <>Next planned day: {D.fmtIsoShort(upcoming.date)} · {upcoming.items.length} vessel{upcoming.items.length > 1 ? "s" : ""}.</>
                        : <>{pending.length} vessel{pending.length > 1 ? "s" : ""} waiting on the werf.</>}
                    </div>
                    <button className="s-btn" onClick={() => setUI({ view: "plan" })}>Open het kanaal</button>
                  </>
                )}
              </EmptyState>
            )}
          </div>
        </div>

        {/* ── the rail ───────────────────────────────────────── */}
        <aside className="s-col">
          {dayClosed && (
            <div className="s-rail-card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="moon" size={14} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="s-stencil">Nachtsluiting</div>
                <div className="s-num" style={{ fontSize: 10, color: "var(--fg-dim)", marginTop: 2 }}>
                  DE DEUREN ZIJN DICHT · {new Date(dayClosed.closedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toUpperCase()}
                </div>
              </div>
              <button className="s-btn s-btn--sm s-btn--ghost" onClick={reopenDay}>Heropen</button>
            </div>
          )}

          {dueWeek && (
            <div className="s-rail-card">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span className="s-chip" style={{ background: "var(--channel-ground)", color: "var(--channel)" }}>Weekschouw</span>
                <button className="s-icon-btn" style={{ marginLeft: "auto" }} aria-label="Dismiss review prompt"
                  onClick={() => patchReview(dueWeek, { promptDismissed: true })}>
                  <Icon name="close" size={11} />
                </button>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--fg-dim)", marginBottom: 10 }}>
                Last week is in the books — worth two minutes of hindsight.
              </div>
              <button className="s-btn s-btn--sm" onClick={() => openReview(dueWeek)}>
                Open weekschouw <Kbd>W</Kbd>
              </button>
            </div>
          )}

          {readyToShip.length > 0 && (
            <div className="s-rail-card">
              <Eyebrow lit>Klaar voor tewaterlating</Eyebrow>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {readyToShip.slice(0, 4).map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--starboard)", boxShadow: "0 0 8px 0 var(--starboard)", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                    <button className="s-btn s-btn--sm s-btn--amber" onClick={() => setUI({ view: "dock" })}>Te water laten</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="s-rail-card">
            <Eyebrow right={
              upcoming ? <span className="s-num" style={{ fontSize: 10, color: "var(--fg-faint)" }}>{D.fmtIsoShort(upcoming.date).toUpperCase()}</span> : null
            }>Eerstvolgende vaardag</Eyebrow>
            {upcoming ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {upcoming.items.slice(0, 4).map((it) => {
                    const t = tasksById.get(it.taskId);
                    if (!t) return null;
                    return (
                      <div key={it.taskId} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12.5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--water)", flexShrink: 0, position: "relative", top: -1 }} />
                        <span style={{ minWidth: 0 }}>
                          {t.title}{it.note ? <span style={{ color: "var(--fg-faint)", fontStyle: "italic" }}> — {it.note}</span> : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button className="s-btn s-btn--sm s-btn--ghost" style={{ marginTop: 12 }} onClick={() => setUI({ view: "plan" })}>
                  Kanaal →
                </button>
              </>
            ) : (
              <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>Niets op het kanaal gepland.</div>
            )}
          </div>

          <div className="s-rail-card">
            <Eyebrow>Seinlog</Eyebrow>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[{ label: "X opens", key: "xOpens" }, { label: "YT opens", key: "ytOpens" }].map((item) => {
                const count = entry[item.key] || 0;
                return (
                  <div key={item.key} style={{ background: "var(--well)", borderRadius: "var(--r-sm)", padding: "8px 10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <span className="s-stencil" style={{ fontSize: 8.5 }}>{item.label}</span>
                      <span className="s-num" style={{ fontSize: 17, fontWeight: 700 }}>{count}</span>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="s-btn s-btn--sm s-btn--ghost" style={{ flex: 1, justifyContent: "center" }}
                        onClick={() => patchScreenToday({ [item.key]: count + 1 })}>+1</button>
                      {count > 0 && (
                        <button className="s-btn s-btn--sm s-btn--ghost"
                          onClick={() => patchScreenToday({ [item.key]: Math.max(0, count - 1) })}>−1</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <MobileHoursInput entry={entry} />
            <button style={{ marginTop: 10, fontSize: 11, color: "var(--water)", fontWeight: 600 }}
              onClick={() => setUI({ statsOpen: true })}>Peilhuis →</button>
          </div>

          {stats.doneToday > 0 && !dayClosed && (
            <button className="s-btn s-btn--ghost" style={{ justifyContent: "flex-start" }}
              onClick={() => setUI({ endOfDayOpen: true })}>
              <Icon name="moon" size={12} /> Nachtsluiting →
            </button>
          )}

          <WakeFoot caption="kalm water verderop" />
        </aside>
      </div>
    </div>
  );
}

function MobileHoursInput({ entry }) {
  const [v, setV] = useState("");
  if (entry.mobileHours != null) {
    return (
      <div className="s-num" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, fontSize: 10.5, color: "var(--fg-dim)" }}>
        <span>{entry.mobileHours}H MOBIEL VANDAAG</span>
        <button style={{ fontSize: 10, color: "var(--water)", fontWeight: 600 }} onClick={() => patchScreenToday({ mobileHours: null })}>wis</button>
      </div>
    );
  }
  const log = () => { if (v) { patchScreenToday({ mobileHours: parseFloat(v) || 0 }); setV(""); } };
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
      <input type="number" min="0" max="24" step="0.5" placeholder="Mobiele uren"
        value={v} onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") log(); }}
        className="s-field" style={{ flex: 1, padding: "5px 9px", fontSize: 12 }} />
      <button className="s-btn s-btn--sm" disabled={!v} onClick={log}>Log</button>
    </div>
  );
}
