// views/today.jsx — PAD: countdown board + mission column + ops ledger.
// Logic lifted from nightwatch; Apogee composition and voice only.

import React, { useEffect, useMemo, useState } from "react";
import { Icon, Kbd, Stamp, Cell, Meter, DotNumeral, EmptyState, fitFontSize } from "../components.jsx";
import { Spark, WeekDots } from "../charts.jsx";
import { CaptureBar } from "../capture.jsx";
import { TaskRow, ChunksEditor } from "../taskrow.jsx";
import { rampTex } from "../texture.js";
import * as D from "../../../core/domain.js";
import {
  useStore, getState, setUI, setCompletion, todayLineup,
  dismissChunk, moveChunkDate, patchScreenToday, reopenDay,
  enterPreview, setLineupOrder, ensureMorningBrief, patchBrief, applyBriefOrder,
  reviewPromptDue, openReview, patchReview,
} from "../../../core/store.js";
import { generateBriefProse } from "../../../core/enrich.js";
import { registerActiveList } from "../../../core/keys.js";

const COUNTDOWN_RAMP = rampTex("countdown");
// .ap-cols mission column is 340px (tokens.css); .ap-countdown padding is 18px each side.
// Small safety margin for border/rounding.
const COUNTDOWN_MAX_W = 300;

/** Hours for one lineup row (chunk hours if split; else taskHours). */
function rowEstHours(row) {
  if (row.chunk) {
    const h = row.chunk.hours;
    return typeof h === "number" && h > 0 ? h : 0;
  }
  return D.taskHours(row.task);
}

/** Format float hours as T-hh:mm (nearest minute, hh not clamped). */
function fmtTMinus(hours) {
  const totalMin = Math.round(hours * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = Math.abs(totalMin % 60);
  return `T-${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function trendArrow(trend) {
  if (trend == null) return null;
  const color =
    trend > 0 ? "var(--starboard)"
    : trend < 0 ? "var(--port)"
    : "var(--fg-faint)";
  const arrow = trend > 0 ? "▲" : trend < 0 ? "▼" : "·";
  return (
    <span className="ap-num" style={{ fontSize: 10, color }}>
      {arrow}{Math.abs(trend)}%
    </span>
  );
}

function MobileHoursInput({ entry }) {
  const [v, setV] = useState("");
  if (entry.mobileHours != null) {
    return (
      <div className="ap-num ap-faint" style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5 }}>
        <span>{entry.mobileHours}H ON MOBILE TODAY</span>
        <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" onClick={() => patchScreenToday({ mobileHours: null })}>
          clear
        </button>
      </div>
    );
  }
  const log = () => {
    if (v) {
      patchScreenToday({ mobileHours: parseFloat(v) || 0 });
      setV("");
    }
  };
  return (
    // gap: no dedicated mobile-hours row class
    <div style={{ display: "flex", gap: 5 }}>
      <input
        type="number"
        min="0"
        max="24"
        step="0.5"
        placeholder="Mobile hours"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") log(); }}
        className="ap-field ap-field--mono ap-grow"
      />
      <button type="button" className="ap-btn ap-btn--sm" disabled={!v} onClick={log}>Log</button>
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
  const [tick, setTick] = useState(0);

  // 60s clock tick for countdown board — one setInterval, no rAF.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

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
      week.push({
        label: "MTWTFSS"[i],
        value: activity.get(iso)?.size || 0,
        title: iso + ": " + (activity.get(iso)?.size || 0) + " tasks",
        isToday: iso === todayIso,
      });
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
  const readyToShip = projects.filter(
    (p) => !p.completedAt && (p.childTaskIds || []).length > 0 && D.progressOfProject(p, tasksById) === 100
  );
  const planDone = lineup.filter((r) => r.doneHere).length;
  const entry = screen[todayIso] || { xOpens: 0, ytOpens: 0, mobileHours: null };
  const dayClosed = meta.dayClosed && meta.dayClosed.date === todayIso ? meta.dayClosed : null;
  const upcoming = (plan || [])
    .filter((e) => e.date > todayIso && e.items.length)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const cursorIdx = cursor ? cursor.index : -1;
  const dueWeek = reviewPromptDue(getState());
  const xpLeft = lineup.reduce((s2, r) => s2 + (r.doneHere ? 0 : (r.task.xp || 0)), 0);

  const allDone = lineup.length > 0 && lineup.every((r) => r.doneHere);
  const weekDotsData = stats.week.map((d) => ({ on: d.value > 0 }));

  // Countdown board derivation — re-runs on lineup change and 60s tick.
  const countdown = useMemo(() => {
    void tick;
    if (lineup.length === 0) {
      return { mode: "empty", text: "T-00:00 · PAD CLEAR", unest: 0 };
    }
    if (allDone) {
      return { mode: "liftoff", text: null, unest: 0 };
    }
    let hours = 0;
    let unest = 0;
    for (const row of lineup) {
      if (row.doneHere) continue;
      if (row.chunk) {
        const h = row.chunk.hours;
        if (typeof h === "number" && h > 0) {
          hours += h;
        } else if (h == null) {
          unest += 1;
        }
      } else {
        hours += D.taskHours(row.task);
      }
    }
    return { mode: "count", text: fmtTMinus(hours), unest };
  }, [lineup, allDone, tick]);

  const hourNow = new Date().getHours();
  const greeting = allDone
    ? "All systems nominal. Ground secured."
    : lineup.length === 0 && pending.length === 0
      ? "Pad clear. Manifest a payload to begin."
      : hourNow < 5
        ? "Night ops. Console is yours."
        : hourNow < 12
          ? "Morning window. Clear for manifest."
          : hourNow < 14
            ? "Midday. Hold the pad steady."
            : hourNow < 18
              ? "Afternoon push. Stay on sequence."
              : hourNow < 22
                ? "Evening window. Finish what you can."
                : "Late shift. Fly careful.";

  const openDebrief = () => setUI({ endOfDayOpen: true });

  // ── ON THE PAD plate content ───────────────────────────────
  let padPlate;
  if (lineup.length === 0) {
    padPlate = (
      <div className="ap-faint ap-mono" style={{ fontSize: 12 }}>
        PAD CLEAR — nothing manifested.
      </div>
    );
  } else if (allDone) {
    padPlate = (
      // gap: no dedicated liftoff-plate layout class
      <div className="ap-flex-col ap-gap-sm">
        <Stamp tone="liftoff">LIFTOFF</Stamp>
        <div className="ap-display" style={{ fontSize: 15 }}>
          Everything on the pad is nominal. Ground secured.
        </div>
        {!dayClosed && (
          <button type="button" className="ap-btn ap-btn--primary ap-btn--sm" onClick={openDebrief}>
            Debrief and secure
          </button>
        )}
      </div>
    );
  } else {
    const pendingRows = lineup.filter((r) => !r.doneHere);
    const nowRow = pendingRows[0];
    const nextRow = pendingRows[1];
    const nowProject = nowRow.task.projectId ? projectsById.get(nowRow.task.projectId) : null;
    const estH = rowEstHours(nowRow);
    const focusMin = D.todayFocusMs(nowRow.task, hour);
    padPlate = (
      <div className="ap-flex-col ap-gap-sm">
        <div className="ap-stencil">ON THE PAD</div>
        <div className="ap-display" style={{ fontSize: 18, lineHeight: 1.2 }}>{nowRow.task.title}</div>
        {/* gap: meta strip has no dedicated class */}
        <div className="ap-num ap-muted" style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 10.5 }}>
          {nowProject && (
            <span style={{ color: nowProject.color || "var(--channel)" }}>
              {nowProject.title.toUpperCase()}
            </span>
          )}
          {nowRow.chunkNote && <span style={{ fontStyle: "italic" }}>{nowRow.chunkNote}</span>}
          <span>~{estH}H</span>
          {focusMin > 0 && <span>{D.fmtMs(focusMin)} IN</span>}
        </div>
        {/* gap: action row */}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            type="button"
            className="ap-btn ap-btn--primary ap-btn--sm"
            title="Confirm nominal"
            aria-label="Confirm nominal"
            onClick={() => setCompletion(nowRow.task.id, {
              done: true,
              chunkDate: nowRow.chunk ? todayIso : null,
            })}
          >
            <Icon name="check" size={12} /> Complete
          </button>
          <button
            type="button"
            className="ap-btn ap-btn--sm"
            onClick={() => setUI({ focusTaskId: nowRow.task.id })}
          >
            Burn <Kbd>F</Kbd>
          </button>
        </div>
        {nextRow && (
          // gap: IN QUEUE strip — no dedicated class
          <div
            className="ap-mt-sm"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderTop: "1px solid var(--line)",
            }}
          >
            <span className="ap-stencil">IN QUEUE</span>
            <span className="ap-truncate ap-muted" style={{ fontSize: 12.5, flex: 1 }}>
              {nextRow.task.title}
            </span>
          </div>
        )}
      </div>
    );
  }

  const energyOpts = [
    { id: "low", label: "Easy", title: "Surface easy tasks first" },
    { id: "normal", label: "Auto", title: "Sort by priority" },
    { id: "high", label: "Hard", title: "Surface hard tasks first" },
  ];

  return (
    <div className="ap-cols">
      {/* ════════ LEFT — MISSION column ════════ */}
      <div className="ap-cols-mission ap-flex-col ap-gap-md">
        {/* (a) COUNTDOWN BOARD */}
        <div
          className={
            "ap-countdown ap-panel--reg" +
            (countdown.mode === "liftoff" ? " ap-scanlines" : "")
          }
        >
          {/* gap: ramp texture layer — decorative, not a class */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.12,
              pointerEvents: "none",
              backgroundImage: `url(${COUNTDOWN_RAMP})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div className="ap-countdown-label">T-MINUS TO PAD CLEAR</div>
            {countdown.mode === "liftoff" ? (
              // gap: liftoff stack inside countdown
              <div className="ap-flex-col ap-gap-sm" style={{ alignItems: "center" }}>
                <Stamp tone="liftoff">LIFTOFF</Stamp>
                {!dayClosed && (
                  <button type="button" className="ap-btn ap-btn--primary ap-btn--sm" onClick={openDebrief}>
                    Debrief and secure
                  </button>
                )}
              </div>
            ) : (
              <>
                <DotNumeral
                  size="xl"
                  style={{ fontSize: fitFontSize(countdown.text.length, 120, COUNTDOWN_MAX_W) }}
                >
                  {countdown.text}
                </DotNumeral>
                {countdown.unest > 0 && (
                  <div className="ap-num ap-faint ap-mt-sm" style={{ fontSize: 10 }}>
                    +{countdown.unest} unest.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* (b) ON THE PAD plate */}
        <div className="ap-panel ap-panel--reg ap-p-md">
          {padPlate}
        </div>

        {/* (c) GO/NO-GO cells */}
        {/* gap: three-cell flex row — no gonogo class */}
        <div style={{ display: "flex", gap: 8 }}>
          <Cell label="PENDING IN YARD">{pending.length}</Cell>
          <Cell label="LINED UP">{lineup.length}</Cell>
          <Cell label="READY TO LAUNCH">
            <span style={readyToShip.length > 0 ? { color: "var(--starboard)" } : undefined}>
              {readyToShip.length}
            </span>
          </Cell>
        </div>

        {/* (d) Instrument minis */}
        <div className="ap-flex-col ap-gap-sm">
          {/* TODAY'S XP */}
          <div className="ap-panel ap-p-sm">
            {/* gap: instrument head row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span className="ap-stencil">TODAY&apos;S XP</span>
              {trendArrow(stats.xpTrend)}
            </div>
            <DotNumeral size="md">{stats.todayXP}</DotNumeral>
            <div className="ap-mt-sm"><Spark data={stats.xp7} /></div>
          </div>

          {/* L-STREAK */}
          <div className="ap-panel ap-p-sm">
            <div className="ap-stencil ap-mb-sm">L-STREAK</div>
            {/* gap: readout + unit */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <DotNumeral size="md">{stats.streakRun}</DotNumeral>
              <span className="ap-stencil">D</span>
            </div>
            <div className="ap-mt-sm"><WeekDots days={weekDotsData} /></div>
          </div>

          {/* DONE TODAY */}
          <div className="ap-panel ap-p-sm">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span className="ap-stencil">DONE TODAY</span>
              {trendArrow(stats.doneTrend)}
            </div>
            <DotNumeral size="md">{stats.doneToday}</DotNumeral>
            {/* gap: difficulty tally — no dedicated class */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, fontSize: 10 }}>
              {["epic", "hard", "medium", "easy"].map((d) => {
                const count = pending.filter((t) => t.difficulty === d).length;
                if (!count) return null;
                return (
                  <span
                    key={d}
                    className="ap-num ap-muted"
                    title={`${count} ${d} pending`}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <i
                      style={{
                        display: "inline-block",
                        width: 7,
                        height: 7,
                        background: D.DIFFICULTY[d].tone,
                      }}
                    />
                    {count} {d.toUpperCase()}
                  </span>
                );
              })}
            </div>
          </div>

          {/* SLATE XP */}
          <div className="ap-panel ap-p-sm">
            <div className="ap-stencil ap-mb-sm">SLATE XP</div>
            {/* gap: done/total readout */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <DotNumeral size="md">{planDone}</DotNumeral>
              <span className="ap-num ap-faint" style={{ fontSize: 16 }}>/ {lineup.length}</span>
            </div>
            <div className="ap-mt-sm">
              <Meter
                pct={lineup.length ? (planDone / lineup.length) * 100 : 0}
                tone="var(--starboard)"
              />
            </div>
            <div className="ap-num ap-faint ap-mt-sm" style={{ fontSize: 10 }}>
              {xpLeft} XP LEFT ON THE SLATE
            </div>
          </div>
        </div>
      </div>

      {/* ════════ RIGHT — OPS ledger ════════ */}
      <div className="ap-cols-ops ap-flex-col ap-gap-md">
        {/* (e) GREETING */}
        <div>
          <div className="ap-stencil-row ap-mb-sm">
            <span className="ap-stencil ap-stencil--lit">
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </div>
          <h1 className="ap-display" style={{ fontSize: 22, margin: "0 0 8px" }}>{greeting}</h1>
          <div className="ap-num ap-muted" style={{ fontSize: 11 }}>
            {pending.length} IN THE YARD · {lineup.length} LINED UP
            {readyToShip.length > 0 && (
              <span style={{ color: "var(--starboard)" }}> · {readyToShip.length} READY</span>
            )}
          </div>
        </div>

        {/* (f) Capture */}
        <CaptureBar scheduleToday />

        {/* (g) Day-closed banner */}
        {dayClosed && (
          // gap: day-closed banner layout
          <div
            className="ap-panel ap-p-sm"
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <span className="ap-num ap-muted ap-grow" style={{ fontSize: 11 }}>
              DAY CLOSED .{" "}
              {new Date(dayClosed.closedAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              }).toUpperCase()}
            </span>
            <button type="button" className="ap-btn ap-btn--sm" onClick={reopenDay}>
              RESUME MISSION
            </button>
          </div>
        )}

        {/* (h) Review-due nudge */}
        {dueWeek && (
          // gap: review nudge row
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Stamp tone="var(--warn)">Review due</Stamp>
            <span className="ap-muted ap-grow" style={{ fontSize: 12.5 }}>
              Last week is in the books — worth two minutes of hindsight.
            </span>
            <button type="button" className="ap-btn ap-btn--sm" onClick={() => openReview(dueWeek)}>
              Review <Kbd>W</Kbd>
            </button>
            <button
              type="button"
              className="ap-icon-btn"
              aria-label="Dismiss review prompt"
              onClick={() => patchReview(dueWeek, { promptDismissed: true })}
            >
              <Icon name="close" size={11} />
            </button>
          </div>
        )}

        {/* (i) MISSION BRIEF */}
        {brief && (brief.dismissed ? (
          <button
            type="button"
            className="ap-panel ap-p-sm ap-w-full"
            onClick={() => patchBrief(todayIso, { dismissed: false })}
            // gap: collapsed brief is a full-width button panel
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              textAlign: "left",
              background: "var(--plate)",
              border: "1px solid var(--line)",
              color: "inherit",
            }}
          >
            <Icon name="bolt" size={10} />
            <span className="ap-stencil">Mission brief</span>
            <span style={{ marginLeft: "auto" }}><Kbd>B</Kbd></span>
          </button>
        ) : (
          <div className="ap-panel ap-panel--reg ap-p-md">
            {/* gap: brief header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span className="ap-stencil ap-stencil--lit">MISSION BRIEF</span>
              <span className="ap-num ap-faint" style={{ fontSize: 10 }}>
                {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).toUpperCase()}
              </span>
              <div className="ap-grow" />
              <button
                type="button"
                className="ap-icon-btn"
                title="Regenerate the written brief"
                onClick={() => patchBrief(todayIso, { attempted: false, text: null, order: null })}
              >
                <Icon name="undo" size={11} />
              </button>
              <button
                type="button"
                className="ap-icon-btn"
                title="Collapse (B)"
                aria-label="Collapse brief"
                onClick={() => patchBrief(todayIso, { dismissed: true })}
              >
                <Icon name="close" size={11} />
              </button>
            </div>
            {/* gap: fact stamps row */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: brief.text || brief.attempted ? 10 : 0 }}>
              <Stamp>
                {briefData.yesterday.count > 0
                  ? `yesterday ${briefData.yesterday.count} done · ${briefData.yesterday.xp} XP${briefData.yesterday.focusMs ? " · " + D.fmtMs(briefData.yesterday.focusMs) : ""}`
                  : "yesterday quiet"}
              </Stamp>
              {briefData.adrift > 0 && (
                <Stamp tone="var(--warn)">{`${briefData.adrift} adrift`}</Stamp>
              )}
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
                <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--fg)" }}>{brief.text}</div>
                {brief.order?.length > 1 && (
                  <button
                    type="button"
                    className="ap-btn ap-btn--sm ap-mt-sm"
                    onClick={() => applyBriefOrder(brief.order)}
                  >
                    Apply suggested run order
                  </button>
                )}
              </>
            ) : brief.attempted && aiStatus !== "busy" ? (
              <div className="ap-num ap-faint" style={{ fontSize: 11 }}>
                GUIDANCE OFFLINE — flying manual. The numbers above are the brief.{" "}
                <button
                  type="button"
                  className="ap-btn ap-btn--ghost ap-btn--sm"
                  style={{ fontSize: 10 }}
                  onClick={() => patchBrief(todayIso, { attempted: false })}
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="ap-num ap-faint" style={{ fontSize: 11 }}>WRITING THE BRIEF...</div>
            )}
          </div>
        ))}

        {/* (j) ORBITAL DECAY */}
        {missed.length > 0 && (
          <div className="ap-hazard">
            {/* gap: hazard header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className="ap-stencil" style={{ color: "var(--warn)" }}>ORBITAL DECAY</span>
              <span className="ap-num ap-muted" style={{ fontSize: 10.5 }}>
                {missed.length} PAST ITEM{missed.length === 1 ? "" : "S"}
              </span>
            </div>
            <div className="ap-ledger">
              {missed.map(({ date, taskId, task, item }, i) => {
                const project = task.projectId ? projectsById.get(task.projectId) : null;
                const daysAgo = Math.max(
                  1,
                  Math.round((D.parseIsoDate(todayIso) - D.parseIsoDate(date)) / 86400000)
                );
                return (
                  // gap: decay row layout (no ap-decay-* class)
                  <div
                    key={`${date}-${taskId}`}
                    className={"ap-lrow" + (cursorIdx === i ? " ap-lrow--cursor" : "")}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="ap-lrow-title">{task.title}</div>
                      <div className="ap-lrow-meta ap-num" style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 10 }}>
                        <span style={{ color: "var(--warn)" }}>{daysAgo}D ADRIFT</span>
                        {project && (
                          <span style={{ color: project.color }}>{project.title.toUpperCase()}</span>
                        )}
                        {item.hours && <span>{item.hours}H CHUNK</span>}
                      </div>
                    </div>
                    {/* gap: decay action buttons */}
                    <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="ap-btn ap-btn--sm"
                        onClick={() => moveChunkDate(taskId, date, todayIso)}
                        title="Tow into today"
                      >
                        Reboost
                      </button>
                      <button
                        type="button"
                        className="ap-btn ap-btn--sm"
                        onClick={() => setCompletion(taskId, { done: true, chunkDate: date })}
                        title="It actually got done"
                      >
                        Recovered
                      </button>
                      <button
                        type="button"
                        className="ap-icon-btn"
                        onClick={() => dismissChunk(taskId, date)}
                        title="Strike from the plan (undoable)"
                        aria-label="Deorbit"
                      >
                        <Icon name="close" size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* (k) LAUNCH SEQUENCE */}
        <div>
          {/* gap: section head with energy chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <span className="ap-stencil">LAUNCH SEQUENCE</span>
            <div role="group" aria-label="Energy mode" style={{ display: "flex", gap: 4 }}>
              {energyOpts.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  title={o.title}
                  aria-pressed={energy === o.id}
                  className={"ap-chip" + (energy === o.id ? " ap-chip--on" : "")}
                  onClick={() => setUI({ energy: o.id })}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {stats.doneToday > 0 && !dayClosed && (
              <button
                type="button"
                className="ap-btn ap-btn--ghost ap-btn--sm"
                style={{ marginLeft: "auto" }}
                onClick={openDebrief}
              >
                Close day -&gt;
              </button>
            )}
          </div>

          {lineup.length > 0 ? (
            <>
              <div className="ap-ledger">
                {lineup.map((r, i) => {
                  const globalIdx = missed.length + i;
                  const chunks = r.chunk ? D.getTaskChunks(r.task.id, plan) : [];
                  return (
                    <div
                      key={r.task.id}
                      draggable
                      onDragStart={(e) => {
                        setDragIdx(i);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverIdx !== i) setDragOverIdx(i);
                      }}
                      onDragLeave={() => {
                        if (dragOverIdx === i) setDragOverIdx(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIdx != null && dragIdx !== i) {
                          const ids = lineup.map((x) => x.task.id);
                          const [moved] = ids.splice(dragIdx, 1);
                          ids.splice(i, 0, moved);
                          setLineupOrder(ids);
                        }
                        setDragIdx(null);
                        setDragOverIdx(null);
                      }}
                      onDragEnd={() => {
                        setDragIdx(null);
                        setDragOverIdx(null);
                      }}
                      // gap: drag feedback — no dedicated drag class
                      style={{
                        opacity: dragIdx === i ? 0.4 : 1,
                        boxShadow:
                          dragOverIdx === i && dragIdx !== null && dragIdx !== i
                            ? "inset 0 2px 0 var(--amber)"
                            : "none",
                      }}
                    >
                      <TaskRow
                        task={r.task}
                        index={i}
                        project={r.task.projectId ? projectsById.get(r.task.projectId) : null}
                        doneHere={r.doneHere}
                        onToggleDone={(done) =>
                          setCompletion(r.task.id, {
                            done,
                            chunkDate: r.chunk ? todayIso : null,
                          })
                        }
                        chunkNote={r.chunkNote}
                        chunkLabel={r.chunkLabel}
                        isCursor={cursorIdx === globalIdx}
                        onHoverCursor={() => setUI({ cursor: { index: globalIdx } })}
                        expanded={exp === r.task.id}
                        onToggleExpand={() => setExp(exp === r.task.id ? null : r.task.id)}
                        extraExpanded={
                          chunks.length > 1
                            ? <ChunksEditor task={r.task} chunks={chunks} dayStartHour={hour} />
                            : null
                        }
                        dayStartHour={hour}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="ap-num ap-faint ap-mt-sm" style={{ fontSize: 9.5 }}>
                {planDone}/{lineup.length} NOMINAL · [ ] REORDER · DRAG
              </div>
            </>
          ) : (
            pending.length === 0 ? (
              <EmptyState
                title="Nothing manifested."
                line="Type in MANIFEST INTAKE above — it lands right here, scheduled for today."
                action={
                  tasks.length === 0 && projects.length === 0 ? (
                    // gap: empty simulation CTA stack
                    <div className="ap-flex-col ap-gap-sm">
                      <button type="button" className="ap-btn ap-btn--primary" onClick={enterPreview}>
                        RUN SIMULATION
                      </button>
                      <div className="ap-faint" style={{ fontSize: 11 }}>
                        Snapshots your (empty) data and loads a demo yard — restore on exit.
                      </div>
                    </div>
                  ) : null
                }
              />
            ) : (
              <EmptyState
                title="Nothing lined up for today."
                line={
                  upcoming
                    ? `Next planned day: ${D.fmtIsoShort(upcoming.date)} · ${upcoming.items.length} task${upcoming.items.length > 1 ? "s" : ""}.`
                    : `${pending.length} task${pending.length > 1 ? "s" : ""} waiting in the yard.`
                }
                action={
                  <button type="button" className="ap-btn" onClick={() => setUI({ view: "plan" })}>
                    TRAJECTORY
                  </button>
                }
              />
            )
          )}
        </div>

        {/* (l) Aux strip */}
        {/* gap: aux three-block strip */}
        <div className="ap-flex-col ap-gap-md">
          {readyToShip.length > 0 && (
            <div className="ap-panel ap-p-sm">
              <div className="ap-stencil ap-mb-sm" style={{ color: "var(--starboard)" }}>
                READY TO LAUNCH
              </div>
              {/* gap: ready list */}
              <div className="ap-flex-col" style={{ gap: 8 }}>
                {readyToShip.slice(0, 4).map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    {/* gap: square lamp (no radius) */}
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        background: "var(--starboard)",
                        flexShrink: 0,
                      }}
                    />
                    <span className="ap-truncate ap-grow" style={{ fontSize: 12.5, fontWeight: 500 }}>
                      {p.title}
                    </span>
                    <button
                      type="button"
                      className="ap-btn ap-btn--sm"
                      onClick={() => setUI({ view: "dock" })}
                    >
                      Launch
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="ap-panel ap-p-sm">
            <div className="ap-stencil ap-mb-sm">
              NEXT WINDOW{upcoming ? ` · ${D.fmtIsoShort(upcoming.date)}` : ""}
            </div>
            {upcoming ? (
              <>
                {/* gap: next-window item list */}
                <div className="ap-flex-col" style={{ gap: 6 }}>
                  {upcoming.items.slice(0, 4).map((it) => {
                    const t = tasksById.get(it.taskId);
                    if (!t) return null;
                    return (
                      <div key={it.taskId} className="ap-truncate" style={{ fontSize: 12.5 }}>
                        {t.title}
                        {it.note ? (
                          <span className="ap-faint" style={{ fontStyle: "italic" }}> — {it.note}</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="ap-btn ap-btn--ghost ap-btn--sm ap-mt-sm"
                  onClick={() => setUI({ view: "plan" })}
                >
                  TRAJECTORY -&gt;
                </button>
              </>
            ) : (
              <div className="ap-faint" style={{ fontSize: 12 }}>Nothing on the manifest yet.</div>
            )}
          </div>

          <div className="ap-panel ap-p-sm">
            <div className="ap-stencil ap-mb-sm">DOWNLINK USAGE</div>
            {/* gap: X/YT open counters grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              {[
                { label: "X opens", key: "xOpens" },
                { label: "YT opens", key: "ytOpens" },
              ].map((item) => {
                const count = entry[item.key] || 0;
                return (
                  <div key={item.key} className="ap-panel ap-panel--flat ap-p-sm">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                      <span className="ap-stencil" style={{ fontSize: 8.5 }}>{item.label}</span>
                      <DotNumeral size="sm">{count}</DotNumeral>
                    </div>
                    {/* gap: +1/− buttons */}
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        className="ap-btn ap-btn--sm ap-grow"
                        onClick={() => patchScreenToday({ [item.key]: count + 1 })}
                      >
                        +1
                      </button>
                      {count > 0 && (
                        <button
                          type="button"
                          className="ap-btn ap-btn--sm"
                          onClick={() => patchScreenToday({ [item.key]: Math.max(0, count - 1) })}
                        >
                          −
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <MobileHoursInput entry={entry} />
            <button
              type="button"
              className="ap-btn ap-btn--ghost ap-btn--sm ap-mt-sm"
              onClick={() => setUI({ statsOpen: true })}
            >
              FLIGHT LOG -&gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
