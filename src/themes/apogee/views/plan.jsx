// views/plan.jsx — TRAJECTORY (Plan): horizontal downrange board.
// Logic lifted from nightwatch/views/plan.jsx; Apogee ap- composition.

import React, { useMemo, useState, useEffect, useRef } from "react";
import { Icon, Kbd, MOD, Lamp, Stamp, Meter, Cell, EmptyState } from "../components.jsx";
import * as D from "../../../core/domain.js";
import {
  useStore, setUI, setCompletion, setCaps, toggleDayLock,
  applyPlan, moveChunkDate, notify, dismissChunk,
} from "../../../core/store.js";
import { aiPlan, aiReplan, aiFailureMessage } from "../../../core/ai.js";

function CompleteToggle({ done, onComplete, onReopen }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        done ? onReopen && onReopen() : onComplete && onComplete();
      }}
      title={done ? "Reopen" : "Confirm nominal"}
      aria-label={done ? "Reopen" : "Confirm nominal"}
      style={{
        width: 14,
        height: 14,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        border: "1px solid " + (done ? "var(--signal)" : "var(--line-strong)"),
        background: done ? "var(--signal)" : "transparent",
        color: done ? "var(--ink)" : "var(--fg-dim)",
        cursor: "pointer",
        font: "700 9px var(--t-mono)",
        lineHeight: 1,
      }}
    >
      {done ? "✓" : ""}
    </button>
  );
}

export function PlanView() {
  const tasks = useStore((s) => s.tasks);
  const plan = useStore((s) => s.plan);
  const projects = useStore((s) => s.projects);
  const caps = useStore((s) => s.caps);
  const locks = useStore((s) => s.locks);
  const meta = useStore((s) => s.meta);
  const aiStatus = useStore((s) => s.ui.aiStatus);
  const aiDetail = useStore((s) => s.ui.aiDetail);

  const [busy, setBusy] = useState(null);
  const [instruction, setInstruction] = useState("");
  const [replanText, setReplanText] = useState("");
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [editingCap, setEditingCap] = useState(null);
  const [dragged, setDragged] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [horizon, setHorizon] = useState(28);

  const boardRef = useRef(null);

  const hour = meta.dayStartHour || 0;
  const todayIso = D.effectiveTodayIso(hour);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const lockedDateSet = useMemo(
    () => new Set(Object.keys(locks || {}).filter((k) => locks[k])),
    [locks],
  );

  const pending = tasks.filter((t) => !t.completed && t.recurring === "none");
  const recurring = tasks.filter((t) => t.recurring !== "none");
  const recurringHours = recurring.reduce(
    (s, t) => s + (t.recurring === "daily" ? D.taskHours(t) : D.taskHours(t) / 5),
    0,
  );
  const scheduledIds = new Set((plan || []).flatMap((e) => e.items.map((i) => i.taskId)));
  const unscheduled = pending.filter((t) => !scheduledIds.has(t.id));
  const totalH = pending.reduce((s, t) => s + D.taskHours(t), 0);

  const agendaDays = useMemo(() => {
    const out = [];
    const planByDate = new Map((plan || []).map((e) => [e.date, e]));
    for (let i = 0; i < horizon; i++) {
      const d = D.addDays(D.parseIsoDate(todayIso), i);
      const iso = D.isoDate(d);
      const wd = D.weekdayName(d);
      const cap = caps[wd] ?? 0;
      const entry = planByDate.get(iso);
      const items = entry?.items || [];
      if (cap === 0 && items.length === 0 && i > 0) continue;
      out.push({ iso, d, wd, cap, items, isToday: i === 0, locked: !!locks[iso] });
    }
    return out;
  }, [plan, caps, locks, todayIso, horizon]);

  const missed = useMemo(() => D.getMissedWork(tasks, plan, hour), [tasks, plan, hour]);

  const headStats = useMemo(() => {
    let placed = 0, over = 0;
    for (const day of agendaDays) {
      const h = day.items.reduce((s, it) => {
        const t = tasksById.get(it.taskId);
        if (!t || t.recurring !== "none") return s;
        return s + (it.hours != null ? it.hours : D.taskHours(t));
      }, 0) + (day.cap > 0 ? recurringHours : 0);
      placed += day.items.length;
      if (day.cap > 0 && h > day.cap) over += 1;
    }
    return { placed, over };
  }, [agendaDays, tasksById, recurringHours]);

  const boardEmpty = agendaDays.every((d) => d.items.length === 0) && pending.length === 0;

  // Vertical wheel → horizontal scroll on the downrange board.
  // Must use native addEventListener with { passive: false } so preventDefault works.
  // Re-bind when the board mounts/unmounts (empty state toggles the ref node).
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [boardEmpty]);

  const failToast = (e) => notify(aiFailureMessage(e.kind));

  const runSchedule = async (withInstruction = "") => {
    setBusy("schedule");
    try {
      const next = await aiPlan(tasks, caps, {
        mode: plan?.length ? "append" : "fresh",
        existingPlan: plan || [], lockedDates: lockedDateSet, projects,
        instruction: withInstruction, dayStartHour: hour,
      });
      applyPlan(next, { snapshotLabel: "Plan updated" });
    } catch (e) { failToast(e); }
    setBusy(null); setInstructionOpen(false); setInstruction("");
  };

  const runOptimize = async () => {
    setBusy("optimize");
    try {
      const next = await aiPlan(tasks, caps, {
        mode: "optimize", existingPlan: plan || [], lockedDates: lockedDateSet,
        projects, dayStartHour: hour,
      });
      applyPlan(next, { snapshotLabel: "Plan rebuilt" });
    } catch (e) { failToast(e); }
    setBusy(null);
  };

  const runReplan = async () => {
    const instr = replanText.trim();
    if (!instr || busy) return;
    setBusy("replan");
    try {
      const res = await aiReplan(tasks, caps, {
        existingPlan: plan || [], instruction: instr,
        lockedDates: lockedDateSet, projects,
      });
      if (res.empty || !res.plan) {
        notify("GUIDANCE could not map that request — nothing was changed.");
      } else {
        applyPlan(res.plan, {
          snapshotLabel: "Applied " + res.applied.length + " change" + (res.applied.length === 1 ? "" : "s"),
        });
        setReplanText("");
      }
    } catch (e) { failToast(e); }
    setBusy(null);
  };

  const updateCap = (day, val) => {
    const raw = parseFloat(val);
    const v = Number.isNaN(raw) ? 0 : Math.max(0, Math.min(10, raw));
    setCaps({ ...caps, [day]: v });
  };

  const now = new Date();
  const todayDow = D.weekdayName(now);
  const capTone = (v) =>
    v === 0 ? "var(--line)"
    : v <= 2 ? "var(--port)"
    : v <= 4 ? "var(--warn)"
    : "var(--starboard)";

  const renderChunk = (day, it) => {
    const t = tasksById.get(it.taskId);
    if (!t) return null;
    const project = t.projectId ? projectsById.get(t.projectId) : null;
    const chunks = D.getTaskChunks(t.id, plan);
    const isSplit = chunks.length > 1;
    const idx = chunks.findIndex((c) => c.date === day.iso);
    const chunkDone = !!(it.done || t.completed);
    const hoursHere = it.hours != null ? it.hours : D.taskHours(t);
    const color = chunkDone
      ? "var(--line-dim)"
      : project?.color || D.DIFFICULTY[t.difficulty]?.tone || "var(--channel)";

    return (
      <div
        key={it.taskId}
        className={"ap-chunk" + (chunkDone ? " ap-chunk--held" : "")}
        draggable={!chunkDone}
        onDragStart={(e) => {
          setDragged({ taskId: t.id, fromDate: day.iso });
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => { setDragged(null); setDragOver(null); }}
        style={{
          borderLeftColor: color,
          opacity: chunkDone ? 0.55 : 1,
          cursor: chunkDone ? "default" : "grab",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <CompleteToggle
            done={chunkDone}
            onComplete={() => setCompletion(t.id, { done: true, chunkDate: day.iso })}
            onReopen={() => setCompletion(t.id, { done: false, chunkDate: day.iso })}
          />
          <span
            className="ap-chunk-title ap-grow"
            onClick={() => setUI({ editingTaskId: t.id, formOpen: true })}
            title="Click to edit · drag to move"
            style={{
              cursor: "pointer",
              textDecoration: chunkDone ? "line-through" : "none",
              color: chunkDone ? "var(--fg-faint)" : "var(--fg)",
              minWidth: 0,
            }}
          >
            {t.title}
          </span>
          {chunkDone && (
            <Stamp tone="nominal" style={{ flexShrink: 0, fontSize: 8 }}>NOMINAL</Stamp>
          )}
          {isSplit && (
            <Stamp style={{ flexShrink: 0, fontSize: 8.5 }}>{idx + 1}/{chunks.length}</Stamp>
          )}
          <button
            type="button"
            className="ap-icon-btn"
            style={{ width: 20, height: 20, padding: 0 }}
            onClick={() => dismissChunk(t.id, day.iso)}
            title="Unschedule (undoable)"
            aria-label="Unschedule"
          >
            <Icon name="close" size={9} />
          </button>
        </div>
        <div className="ap-chunk-meta">
          {project && (
            <span style={{ color: chunkDone ? "var(--fg-faint)" : project.color }}>
              {project.title.toUpperCase()}
            </span>
          )}
          {it.note && <span style={{ fontStyle: "italic" }} className="ap-truncate">{it.note}</span>}
          <span className="ap-num" style={{ marginLeft: "auto" }}>{hoursHere}H</span>
        </div>
      </div>
    );
  };

  return (
    <div className="ap-flex ap-flex-col ap-gap-md ap-w-full" style={{ paddingBottom: 40 }}>
      {/* ── Header stats ─────────────────────────────────────── */}
      <div className="ap-flex" style={{ alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="ap-stencil-row ap-mb-sm">
            <span className="ap-stencil ap-stencil--lit">TRAJECTORY</span>
          </div>
          <div className="ap-flex ap-gap-md" style={{ flexWrap: "wrap" }}>
            <Cell label="Pending">
              <span className="ap-num">{pending.length}</span>
            </Cell>
            <Cell label="Est hours">
              <span className="ap-num">~{totalH.toFixed(1)}H</span>
            </Cell>
            <Cell label="Unscheduled">
              <span className="ap-num">{unscheduled.length}</span>
            </Cell>
            <Cell label="Recurring reserve">
              <span className="ap-num">{recurringHours.toFixed(1)}H/DAY</span>
            </Cell>
            {headStats.placed > 0 && (
              <Cell label="Placed">
                <span className="ap-num">{headStats.placed}</span>
              </Cell>
            )}
            {headStats.over > 0 && (
              <Cell label="Overloaded">
                <span className="ap-num" style={{ color: "var(--port)" }}>
                  {headStats.over} DAY{headStats.over > 1 ? "S" : ""}
                </span>
              </Cell>
            )}
          </div>
        </div>
        <div className="ap-flex ap-gap-sm" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <span className="ap-mono ap-faint" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9.5 }}>
            <Lamp status={aiStatus} detail={aiDetail} />
            {aiStatus === "off"
              ? "GUIDANCE OFFLINE"
              : aiStatus === "busy"
                ? "GUIDANCE…"
                : "GUIDANCE"}
          </span>
          {unscheduled.length > 0 && (
            <div className="ap-flex" style={{ gap: 0 }}>
              <button
                type="button"
                className="ap-btn ap-btn--primary ap-btn--sm"
                disabled={!!busy}
                onClick={() => runSchedule("")}
              >
                {busy === "schedule" ? "UPLINK…" : `Schedule ${unscheduled.length} pending`}
              </button>
              <button
                type="button"
                className="ap-btn ap-btn--sm"
                disabled={!!busy}
                onClick={() => setInstructionOpen((v) => !v)}
                title="Schedule with custom instructions"
                aria-expanded={instructionOpen}
                style={{
                  padding: "0 8px",
                  background: "var(--amber)",
                  color: "var(--ink)",
                  borderColor: "var(--amber)",
                }}
              >
                <Icon name="chevron-d" size={11} />
              </button>
            </div>
          )}
          {(plan || []).length > 0 && (
            <button
              type="button"
              className="ap-btn ap-btn--ghost ap-btn--sm"
              disabled={!!busy}
              onClick={runOptimize}
              title="Rebuild the whole plan from scratch (undoable)"
            >
              {busy === "optimize" ? "RECOMPUTING…" : "RECOMPUTE TRAJECTORY"}
            </button>
          )}
        </div>
      </div>

      {/* instruction uplink */}
      {instructionOpen && (
        <div className="ap-panel ap-panel--well">
          <div className="ap-stencil-row ap-mb-sm">
            <span className="ap-stencil ap-stencil--lit">Instruction uplink</span>
          </div>
          <textarea
            autoFocus
            value={instruction}
            disabled={!!busy}
            className="ap-field"
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                runSchedule(instruction);
              } else if (e.key === "Escape") {
                setInstructionOpen(false);
              }
            }}
            placeholder="e.g. spread over the next 2 weeks · alternate hard with light · finish by Friday"
            style={{ height: 56, marginBottom: 10, minHeight: 56 }}
          />
          <div className="ap-flex ap-gap-sm" style={{ alignItems: "center" }}>
            <button
              type="button"
              className="ap-btn ap-btn--primary ap-btn--sm"
              disabled={!!busy}
              onClick={() => runSchedule(instruction)}
            >
              {busy === "schedule" ? "UPLINK…" : "Schedule"}
            </button>
            <button
              type="button"
              className="ap-btn ap-btn--ghost ap-btn--sm"
              disabled={!!busy}
              onClick={() => { setInstructionOpen(false); setInstruction(""); }}
            >
              Cancel
            </button>
            <span className="ap-mono ap-faint" style={{ fontSize: 9.5, marginLeft: "auto" }}>
              EMPTY = EARLIEST-FIRST · <Kbd>{MOD}</Kbd><Kbd>↵</Kbd>
            </span>
          </div>
        </div>
      )}

      {/* adrift notice → PAD */}
      {missed.length > 0 && (
        <div className="ap-banner ap-banner--warn" role="status">
          <Icon name="warn" size={12} />
          <span className="ap-grow">
            <span className="ap-num">{missed.length}</span>
            {" "}item{missed.length > 1 ? "s" : ""} adrift — triage on PAD
          </span>
          <button
            type="button"
            className="ap-btn ap-btn--sm"
            onClick={() => setUI({ view: "today" })}
          >
            Open PAD
          </button>
        </div>
      )}

      {/* ── THROTTLE: 7 weekday capacity cells ────────────────── */}
      {/* gap: no .ap-throttle* class — layout via inline grid */}
      <div>
        <div className="ap-stencil-row ap-mb-sm">
          <span className="ap-stencil">THROTTLE</span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            gap: 0,
            border: "1px solid var(--line)",
            background: "var(--plate)",
          }}
        >
          {D.WEEK_ALL.map((day, i) => {
            const val = caps[day] ?? 0;
            const isOff = val === 0;
            const isTodayCell = day === todayDow;
            return (
              <div
                key={day}
                className="ap-cell"
                style={{
                  padding: "8px 10px",
                  borderLeft: i ? "1px solid var(--line)" : "none",
                  background: isTodayCell ? "var(--signal-ground)" : undefined,
                  boxShadow: isTodayCell ? "inset 0 -2px 0 var(--signal)" : undefined,
                }}
              >
                <div
                  className="ap-cell-label"
                  style={{ color: isTodayCell ? "var(--signal)" : undefined }}
                >
                  {day.slice(0, 3).toUpperCase()}
                </div>
                {editingCap === day ? (
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    defaultValue={val}
                    autoFocus
                    className="ap-field ap-field--mono"
                    style={{ width: "100%", padding: "2px 4px", fontSize: 13 }}
                    onBlur={(e) => { updateCap(day, e.target.value); setEditingCap(null); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { updateCap(day, e.target.value); setEditingCap(null); }
                      if (e.key === "Escape") setEditingCap(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="ap-btn ap-btn--ghost ap-btn--sm"
                    onClick={() => setEditingCap(day)}
                    style={{
                      width: "100%",
                      justifyContent: "flex-start",
                      color: isOff ? "var(--fg-faint)" : "var(--fg)",
                      padding: "2px 6px",
                    }}
                  >
                    {isOff ? "off" : `${val}h`}
                  </button>
                )}
                <div style={{ marginTop: 6 }}>
                  <Meter pct={isOff ? 0 : (val / 8) * 100} tone={capTone(val)} />
                </div>
              </div>
            );
          })}
        </div>
        {recurring.length > 0 && (
          <div className="ap-mono ap-faint ap-mt-sm" style={{ fontSize: 9.5 }}>
            RECURRING RESERVE:{" "}
            {recurring.filter((t) => t.recurring === "daily").map((t) => t.title.toUpperCase()).join(" · ") || "—"}
            {" "}({recurringHours.toFixed(1)}H/DAY)
          </div>
        )}
      </div>

      {/* ── Downrange board ──────────────────────────────────── */}
      <div>
        <div className="ap-stencil-row ap-mb-sm">
          <span className="ap-stencil">DOWNRANGE</span>
        </div>

        {boardEmpty ? (
          <EmptyState
            title="Nothing on trajectory."
            line="Manifest payloads on PAD, then chart them here — by hand (drag) or via GUIDANCE."
            action={
              <button
                type="button"
                className="ap-btn ap-btn--ghost ap-btn--sm"
                onClick={() => setUI({ view: "today" })}
              >
                Open PAD
              </button>
            }
          />
        ) : (
          <>
            {/* Single scroll container: ruler + columns share 240px tracks and scroll together */}
            <div
              ref={boardRef}
              className="ap-board"
              style={{ flexDirection: "column", alignItems: "flex-start" }}
            >
              <div
                className="ap-board-ruler"
                style={{
                  position: "relative",
                  flexShrink: 0,
                  width: "max-content",
                  minWidth: "100%",
                  borderBottom: "1px solid var(--line)",
                }}
                aria-hidden
              >
                {agendaDays.map((day) => (
                  <div
                    key={"r-" + day.iso}
                    style={{
                      flex: "0 0 240px",
                      width: 240,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      borderRight: "1px solid var(--line)",
                      color: day.isToday ? "var(--signal)" : "var(--fg-faint)",
                      fontWeight: day.isToday ? 600 : 500,
                    }}
                  >
                    <span>{day.wd.slice(0, 3)}</span>
                    <span className="ap-num">{day.d.getDate()}</span>
                    {day.isToday && <span style={{ color: "var(--signal)" }}>TODAY</span>}
                  </div>
                ))}
                {agendaDays[0]?.isToday && (
                  <div className="ap-board-ruler-today" style={{ left: 0 }} />
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "row", width: "max-content", minWidth: "100%" }}>
                {agendaDays.map((day) => {
                  const dayScheduledH = day.items.reduce((s2, it) => {
                    const t = tasksById.get(it.taskId);
                    if (!t || t.recurring !== "none") return s2;
                    return s2 + (it.hours != null ? it.hours : D.taskHours(t));
                  }, 0);
                  const dayH = dayScheduledH + (day.cap > 0 ? recurringHours : 0);
                  const loadPct = day.cap > 0 ? Math.min(Math.round((dayH / day.cap) * 100), 100) : 0;
                  const over = day.cap > 0 && dayH > day.cap;
                  const loadColor = over
                    ? "var(--port)"
                    : dayH === day.cap && day.cap > 0
                      ? "var(--starboard)"
                      : "var(--amber)";

                  const colCls = [
                    "ap-board-col",
                    dragOver === day.iso ? "ap-board-col--dragover" : "",
                    day.locked ? "ap-board-col--held" : "",
                    over ? "ap-board-col--overloaded" : "",
                  ].filter(Boolean).join(" ");

                  return (
                    <div
                      key={day.iso}
                      className={colCls}
                      onDragOver={(e) => {
                        if (!day.locked) { e.preventDefault(); setDragOver(day.iso); }
                      }}
                      onDragLeave={() => {
                        if (dragOver === day.iso) setDragOver(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (day.locked) {
                          notify("HOLD — GUIDANCE will not touch this day");
                        } else if (dragged) {
                          moveChunkDate(dragged.taskId, dragged.fromDate, day.iso);
                        }
                        setDragged(null);
                        setDragOver(null);
                      }}
                      style={day.isToday ? { boxShadow: "inset 0 2px 0 0 var(--signal)" } : undefined}
                    >
                      <div className="ap-board-col-head">
                        <div>
                          <div
                            className="ap-board-col-date"
                            style={day.isToday ? { color: "var(--signal)" } : undefined}
                          >
                            {day.d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
                            {day.isToday ? " · TODAY" : ""}
                          </div>
                          <div className="ap-board-col-dow">{day.wd.toUpperCase()}</div>
                        </div>
                        <button
                          type="button"
                          className="ap-icon-btn"
                          onClick={() => toggleDayLock(day.iso)}
                          title={
                            day.locked
                              ? "Click to release"
                              : "HOLD — GUIDANCE will not touch this day"
                          }
                          aria-pressed={day.locked}
                          style={{ color: day.locked ? "var(--amber)" : undefined }}
                        >
                          <Icon name={day.locked ? "lock" : "unlock"} size={11} />
                        </button>
                      </div>

                      <div className="ap-flex ap-gap-sm ap-mb-sm" style={{ alignItems: "center", flexWrap: "wrap" }}>
                        <span
                          className="ap-mono ap-num"
                          style={{
                            fontSize: 9,
                            color: day.cap === 0 ? "var(--fg-faint)" : over ? "var(--port)" : "var(--fg-dim)",
                            flexShrink: 0,
                          }}
                        >
                          {day.cap === 0
                            ? "DAY OFF"
                            : `${dayH.toFixed(1)}H / ${day.cap}H`}
                        </span>
                        {over && (
                          <Stamp style={{ fontSize: 8, color: "var(--port)", borderColor: "var(--port)" }}>
                            OVERLOADED
                          </Stamp>
                        )}
                        {day.locked && <Stamp tone="hold" style={{ fontSize: 8 }}>HOLD</Stamp>}
                      </div>
                      {day.cap > 0 && dayH > 0 && (
                        <div className="ap-mb-sm">
                          <Meter pct={loadPct} tone={loadColor} />
                        </div>
                      )}

                      {day.items.length === 0 ? (
                        <div className="ap-mono ap-faint" style={{ fontSize: 10, paddingTop: 4 }}>
                          {day.cap === 0 ? "REST — pad closed." : "clear range"}
                        </div>
                      ) : (
                        day.items.map((it) => renderChunk(day, it))
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="ap-flex" style={{ justifyContent: "center", marginTop: 10 }}>
              <button
                type="button"
                className="ap-btn ap-btn--ghost ap-btn--sm"
                onClick={() => setHorizon((h) => h + 28)}
              >
                +4 WEEKS
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── GUIDANCE console ─────────────────────────────────── */}
      {(plan || []).length > 0 && (
        <div className="ap-panel">
          <div className="ap-stencil-row ap-mb-sm">
            <span className="ap-stencil ap-stencil--lit">GUIDANCE</span>
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Lamp status={aiStatus} detail={aiDetail} />
              <span className="ap-mono ap-faint" style={{ fontSize: 8.5 }}>
                {aiStatus === "off"
                  ? "GUIDANCE OFFLINE — flying manual."
                  : aiStatus === "busy"
                    ? "WORKING…"
                    : "READY"}
              </span>
            </span>
          </div>

          <div className="ap-terminal-prompt" style={{ borderTop: "none", padding: "8px 0", background: "transparent" }}>
            <span className="ap-signal" style={{ flexShrink: 0 }}>{">"}</span>
            <input
              value={replanText}
              disabled={!!busy}
              onChange={(e) => setReplanText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); runReplan(); }
                else if (e.key === "Escape") setReplanText("");
              }}
              placeholder={
                busy === "replan"
                  ? "Recomputing…"
                  : "e.g. move everything hard to Wednesday, keep Friday light…"
              }
              aria-label="Replan instruction"
              autoComplete="off"
            />
            <span className="ap-terminal-caret" aria-hidden />
            <button
              type="button"
              className="ap-btn ap-btn--primary ap-btn--sm"
              disabled={!replanText.trim() || !!busy}
              onClick={runReplan}
            >
              {busy === "replan" ? "UPLINK…" : "UPLINK"}
            </button>
          </div>

          {!replanText && !busy && (
            <div className="ap-flex ap-gap-sm ap-mt-sm" style={{ flexWrap: "wrap", alignItems: "center" }}>
              <span className="ap-stencil" style={{ fontSize: 8.5 }}>Try</span>
              {[
                "Spread the client work over 2 weeks",
                "Push everything past Friday",
                "Move design tasks earlier",
              ].map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className="ap-chip"
                  onClick={() => setReplanText(ex)}
                  style={{ textTransform: "none", letterSpacing: 0, fontSize: 10 }}
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
