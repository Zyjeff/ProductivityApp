// views/plan.jsx — Yoizakura Week: the shoji wall (DESIGN.md §5.2).
// Logic (memos, handlers, AI schedule/rebuild/replan, capacity commit,
// recurring-reserve formula) lifted from nightwatch/views/plan.jsx.
// Composition is the 2D week×weekday lattice — never a 1D day strip.

import React, { useMemo, useRef, useState } from "react";
import { Icon, Stamp, Lamp, Kbd, MOD, BudButton, Field } from "../components.jsx";
import { woodGrain } from "../texture.js";
import * as D from "../../../core/domain.js";
import {
  useStore, setUI, setCompletion, setCaps, toggleDayLock,
  applyPlan, moveChunkDate, notify, dismissChunk,
} from "../../../core/store.js";
import { aiPlan, aiReplan, aiFailureMessage } from "../../../core/ai.js";

function scheduledHours(items, tasksById) {
  return items.reduce((s, it) => {
    const t = tasksById.get(it.taskId);
    if (!t || t.recurring !== "none") return s;
    return s + (it.hours != null ? it.hours : D.taskHours(t));
  }, 0);
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
  const [weekCount, setWeekCount] = useState(4);
  const skipCapCommit = useRef(false);

  const hour = meta.dayStartHour || 0;
  const todayIso = D.effectiveTodayIso(hour);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const lockedDateSet = useMemo(
    () => new Set(Object.keys(locks || {}).filter((k) => locks[k])),
    [locks]
  );

  const pending = useMemo(
    () => tasks.filter((t) => !t.completed && t.recurring === "none"),
    [tasks]
  );
  const recurring = useMemo(
    () => tasks.filter((t) => t.recurring !== "none"),
    [tasks]
  );
  const recurringHours = useMemo(
    () => recurring.reduce((s, t) => s + (t.recurring === "daily" ? D.taskHours(t) : D.taskHours(t) / 5), 0),
    [recurring]
  );
  const scheduledIds = useMemo(
    () => new Set((plan || []).flatMap((e) => e.items.map((i) => i.taskId))),
    [plan]
  );
  const unscheduled = useMemo(
    () => pending.filter((t) => !scheduledIds.has(t.id)),
    [pending, scheduledIds]
  );
  const totalH = useMemo(
    () => pending.reduce((s, t) => s + D.taskHours(t), 0),
    [pending]
  );

  const weekRows = useMemo(() => {
    const start = D.mondayOf(D.parseIsoDate(todayIso));
    const planByDate = new Map((plan || []).map((e) => [e.date, e]));
    const rows = [];
    for (let w = 0; w < weekCount; w++) {
      const monday = D.addDays(start, w * 7);
      const days = [];
      for (let i = 0; i < 7; i++) {
        const d = D.addDays(monday, i);
        const iso = D.isoDate(d);
        const wd = D.weekdayName(d);
        const cap = caps[wd] ?? 0;
        const items = planByDate.get(iso)?.items || [];
        days.push({
          iso, d, wd, cap, items,
          isToday: iso === todayIso,
          isPast: iso < todayIso,
          locked: !!locks[iso],
          resting: cap === 0 && items.length === 0,
        });
      }
      rows.push({ monday, mondayIso: D.isoDate(monday), label: D.fmtWeekLabel(monday), days });
    }
    return rows;
  }, [plan, caps, locks, todayIso, weekCount]);

  const missed = useMemo(() => D.getMissedWork(tasks, plan, hour), [tasks, plan, hour]);

  const todayDow = D.weekdayName(D.parseIsoDate(todayIso));
  const thisWeekLoads = useMemo(() => {
    const row = weekRows[0];
    const map = {};
    if (!row) return map;
    for (const day of row.days) {
      map[day.wd] = scheduledHours(day.items, tasksById) + (day.cap > 0 ? recurringHours : 0);
    }
    return map;
  }, [weekRows, tasksById, recurringHours]);

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
        notify("The Gardener couldn't map that.");
        setReplanText("");
      } else {
        applyPlan(res.plan, { snapshotLabel: `Applied ${res.applied.length} change${res.applied.length === 1 ? "" : "s"}` });
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

  const commitCap = (day, val) => {
    if (skipCapCommit.current) {
      skipCapCommit.current = false;
      setEditingCap(null);
      return;
    }
    updateCap(day, val);
    setEditingCap(null);
  };

  const tanzaku = (day, it) => {
    const t = tasksById.get(it.taskId);
    if (!t) return null;
    const project = t.projectId ? projectsById.get(t.projectId) : null;
    const chunks = D.getTaskChunks(t.id, plan);
    const isSplit = chunks.length > 1;
    const idx = chunks.findIndex((c) => c.date === day.iso);
    const chunkDone = !!(it.done || t.completed);
    const hoursHere = it.hours != null ? it.hours : D.taskHours(t);
    const color = chunkDone
      ? "var(--sumi-faint)"
      : project?.color || D.DIFFICULTY[t.difficulty]?.tone || "var(--channel)";
    const inert = day.isPast;
    return (
      <div
        key={it.taskId}
        className={"yzp-tanzaku" + (chunkDone ? " yzp-tanzaku--done" : "") + (dragged?.taskId === t.id && dragged?.fromDate === day.iso ? " yzp-tanzaku--lift" : "")}
        style={{ "--yzp-tick": color }}
        draggable={!chunkDone && !inert}
        onDragStart={(e) => {
          if (inert || chunkDone) return;
          setDragged({ taskId: t.id, fromDate: day.iso });
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => { setDragged(null); setDragOver(null); }}
      >
        <BudButton
          done={chunkDone}
          size={16}
          onComplete={() => setCompletion(t.id, { done: true, chunkDate: day.iso })}
          onReopen={() => setCompletion(t.id, { done: false, chunkDate: day.iso })}
        />
        <div className="yzp-tanzaku-body">
          <button
            type="button"
            className="yzp-tanzaku-title"
            title="Click to edit · drag to move"
            onClick={() => setUI({ editingTaskId: t.id, formOpen: true })}
          >
            {t.title}
          </button>
          {(project || it.note) && (
            <div className="yzp-tanzaku-meta">
              {project && <span className="yzp-tanzaku-list" style={{ color: chunkDone ? "var(--sumi-faint)" : project.color }}>{project.title}</span>}
              {project && it.note && " · "}
              {it.note && <em>{it.note}</em>}
            </div>
          )}
        </div>
        {isSplit && <Stamp tone="var(--amber-deep)">{idx + 1}/{chunks.length}</Stamp>}
        <span className="yzp-tanzaku-h yz-num">{hoursHere}h</span>
        <button
          type="button"
          className="yz-icon-btn"
          onClick={() => dismissChunk(t.id, day.iso)}
          title="Unschedule (undoable)"
          aria-label="Unschedule"
        >
          <Icon name="close" size={9} />
        </button>
      </div>
    );
  };

  const paneHandlers = (day) => {
    if (day.isPast) return {};
    return {
      onDragOver: (e) => {
        if (!dragged) return;
        e.preventDefault();
        setDragOver(day.iso);
      },
      onDragLeave: () => { if (dragOver === day.iso) setDragOver(null); },
      onDrop: (e) => {
        e.preventDefault();
        if (day.locked) notify("That day is locked");
        else if (dragged && dragged.fromDate !== day.iso) moveChunkDate(dragged.taskId, dragged.fromDate, day.iso);
        setDragged(null);
        setDragOver(null);
      },
    };
  };

  const examples = ["Spread the client work over 2 weeks", "Push everything past Friday", "Move design tasks earlier"];

  return (
    <div className="yz-sheet-inner yzp-week">
      <header className="yzp-rail">
        <div className="yzp-rail-mark">
          <h1 className="yz-display yzp-rail-title">The shoji wall</h1>
        </div>
        <div className="yzp-rail-stats" aria-label="Week totals">
          <div className="yzp-stat">
            <span className="yz-label yz-label--sumi">Pending</span>
            <span className="yz-num yzp-stat-v">{pending.length}</span>
          </div>
          <div className="yzp-stat">
            <span className="yz-label yz-label--sumi">Est. hours</span>
            <span className="yz-num yzp-stat-v">~{totalH.toFixed(1)}h</span>
          </div>
          <div className="yzp-stat">
            <span className="yz-label yz-label--sumi">Unscheduled</span>
            <span className="yz-num yzp-stat-v">{unscheduled.length}</span>
          </div>
          <div className="yzp-stat">
            <span className="yz-label yz-label--sumi">Reserve</span>
            <span className="yz-num yzp-stat-v">{recurringHours.toFixed(1)}h/day</span>
          </div>
        </div>
        {missed.length > 0 && (
          <div className="yzp-fallen" role="status">
            <Icon name="leaf" size={13} />
            <span>
              {missed.length} fallen {missed.length === 1 ? "leaf" : "leaves"} — triage on
            </span>
            <button type="button" className="yz-link" onClick={() => setUI({ view: "today" })}>Today</button>
          </div>
        )}
      </header>

      <div className="yzp-wall" role="grid" aria-label="Shoji wall">
        <div className="yzp-grid" style={{ backgroundImage: woodGrain("shoji-lintel") }}>
          <div className="yzp-corner" aria-hidden />
          {D.WEEK_ALL.map((day) => {
            const val = caps[day] ?? 0;
            const isOff = val === 0;
            const load = thisWeekLoads[day] || 0;
            const loadPct = val > 0 ? Math.min(100, (load / val) * 100) : 0;
            const over = val > 0 && load > val;
            return (
              <div
                key={day}
                className={"yzp-lintel" + (day === todayDow ? " yzp-lintel--today" : "") + (isOff ? " yzp-lintel--off" : "")}
              >
                <div className="yzp-lintel-dow">{day.slice(0, 3)}</div>
                {editingCap === day ? (
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    defaultValue={val}
                    autoFocus
                    aria-label={`${day} capacity hours`}
                    className="yzp-cap-input yz-bare"
                    onBlur={(e) => commitCap(day, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); commitCap(day, e.target.value); }
                      if (e.key === "Escape") { skipCapCommit.current = true; setEditingCap(null); }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="yzp-cap-btn"
                    onClick={() => { skipCapCommit.current = false; setEditingCap(day); }}
                    title="Edit capacity 0–10 hours"
                  >
                    {isOff ? "rest" : `${val}h`}
                  </button>
                )}
                {load > 0 && val > 0 && (
                  <div className={"yzp-load" + (over ? " yzp-load--over" : "")} aria-hidden>
                    <i style={{ width: loadPct + "%" }} />
                  </div>
                )}
              </div>
            );
          })}

          {weekRows.map((row) => (
            <React.Fragment key={row.mondayIso}>
              <div className="yzp-gutter" title={row.label}>
                <span className="yz-num yzp-gutter-d">{row.monday.getDate()}</span>
                <span className="yzp-gutter-m">{row.monday.toLocaleDateString("en-US", { month: "short" })}</span>
              </div>
              {row.days.map((day) => {
                const dayScheduledH = scheduledHours(day.items, tasksById);
                const dayH = dayScheduledH + (day.cap > 0 ? recurringHours : 0);
                const loadPct = day.cap > 0 ? Math.min(Math.round((dayH / day.cap) * 100), 100) : 0;
                const over = day.cap > 0 && dayH > day.cap;
                const dropping = dragOver === day.iso;
                return (
                  <div
                    key={day.iso}
                    role="gridcell"
                    className={
                      "yzp-shoji"
                      + (day.isToday ? " yzp-shoji--today" : "")
                      + (day.locked ? " yzp-shoji--locked" : "")
                      + (day.isPast ? " yzp-shoji--past" : "")
                      + (day.resting ? " yzp-shoji--rest" : "")
                      + (over ? " yzp-shoji--over" : "")
                      + (dropping ? (day.locked ? " yzp-shoji--blocked" : " yzp-shoji--drop") : "")
                    }
                    {...paneHandlers(day)}
                  >
                    {over && <span className="yzp-crack" aria-hidden />}
                    <div className="yzp-shoji-head">
                      <span className="yz-display yzp-shoji-num">{day.d.getDate()}</span>
                      {over && <span className="yz-label" style={{ color: "var(--port)", fontSize: 11 }}>Overloaded</span>}
                      {!day.isPast && (
                        <button
                          type="button"
                          className="yz-icon-btn yzp-lock"
                          onClick={() => toggleDayLock(day.iso)}
                          title={day.locked ? "Locked — planner skips it. Click to unlock." : "Lock day (planner will skip it)"}
                          aria-pressed={day.locked}
                          aria-label={day.locked ? "Unlock day" : "Lock day"}
                        >
                          <Icon name={day.locked ? "lock" : "unlock"} size={11} />
                        </button>
                      )}
                    </div>
                    <div className="yzp-shoji-body">
                      {day.items.length === 0
                        ? <div className="yzp-shoji-empty">{day.cap === 0 ? "resting" : ""}</div>
                        : day.items.map((it) => tanzaku(day, it))}
                    </div>
                    <div className="yzp-shoji-foot">
                      {day.cap > 0 && dayH > 0 && (
                        <div className={"yzp-load" + (over ? " yzp-load--over" : "")} aria-hidden>
                          <i style={{ width: loadPct + "%" }} />
                        </div>
                      )}
                    </div>
                    <div className="yzp-shoji-paper" aria-hidden={!day.locked}>
                      <span className="yzp-rest-stamp">Resting</span>
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div className="yzp-more">
          <button type="button" className="yz-btn yz-btn--ghost yz-btn--sm" onClick={() => setWeekCount((n) => n + 4)}>
            +4 weeks
          </button>
        </div>
      </div>

      <div
        className="yzp-gardener"
        style={{ backgroundImage: woodGrain("gardener-band") }}
      >
        <div className="yzp-gardener-top">
          <span className="yzp-gardener-mark">
            <Lamp status={aiStatus} detail={aiDetail} />
            <span className="yz-sec yz-sec--dusk">The Gardener</span>
            {busy && <span className="yzp-busy">{busy === "schedule" ? "Scheduling…" : busy === "optimize" ? "Rebuilding…" : "Listening…"}</span>}
          </span>
          <div className="yzp-gardener-acts">
            {unscheduled.length > 0 && (
              <div className="yzp-split">
                <button type="button" className="yz-btn yz-btn--gold yz-btn--sm" disabled={!!busy} onClick={() => runSchedule("")}>
                  {busy === "schedule" ? "Scheduling…" : `Schedule ${unscheduled.length} pending`}
                </button>
                <button
                  type="button"
                  className="yz-btn yz-btn--gold yz-btn--sm yzp-split-chev"
                  disabled={!!busy}
                  onClick={() => setInstructionOpen((v) => !v)}
                  title="Schedule with custom instructions"
                  aria-expanded={instructionOpen}
                >
                  <Icon name="chevron" size={11} />
                </button>
              </div>
            )}
            {(plan || []).length > 0 && (
              <button
                type="button"
                className="yz-btn yz-btn--dusk yz-btn--sm"
                disabled={!!busy}
                onClick={runOptimize}
                title="Rebuild the whole plan from scratch (undoable)"
              >
                {busy === "optimize" ? "Rebuilding…" : "Rebuild"}
              </button>
            )}
          </div>
        </div>

        {instructionOpen && (
          <div className="yzp-instruct fade-in">
            <Field
              as="textarea"
              dusk
              autoFocus
              value={instruction}
              disabled={!!busy}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runSchedule(instruction); }
                else if (e.key === "Escape") setInstructionOpen(false);
              }}
              placeholder="e.g. spread over the next 2 weeks · keep Friday light · finish by Friday"
              style={{ height: 56, marginBottom: 8 }}
            />
            <div className="yzp-instruct-row">
              <button type="button" className="yz-btn yz-btn--gold yz-btn--sm" disabled={!!busy} onClick={() => runSchedule(instruction)}>
                {busy === "schedule" ? "Scheduling…" : "Schedule"}
              </button>
              <button type="button" className="yz-btn yz-btn--dusk yz-btn--sm" disabled={!!busy} onClick={() => { setInstructionOpen(false); setInstruction(""); }}>
                Cancel
              </button>
              <span className="yzp-hint">
                empty = earliest-first · <Kbd>{MOD}</Kbd><Kbd>↵</Kbd>
              </span>
            </div>
          </div>
        )}

        {(plan || []).length > 0 && (
          <div className="yzp-replan">
            <input
              className="yz-field yz-field--dusk"
              value={replanText}
              disabled={!!busy}
              onChange={(e) => setReplanText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); runReplan(); }
                else if (e.key === "Escape") setReplanText("");
              }}
              placeholder={busy === "replan" ? "Listening…" : "Ask the Gardener… e.g. move everything hard to Wednesday, keep Friday light…"}
              aria-label="Replan instruction"
              autoComplete="off"
            />
            <button
              type="button"
              className="yz-btn yz-btn--gold yz-btn--sm"
              disabled={!replanText.trim() || !!busy}
              onClick={runReplan}
            >
              {busy === "replan" ? "Listening…" : "Ask"}
            </button>
          </div>
        )}
        {(plan || []).length > 0 && !replanText && !busy && (
          <div className="yzp-examples">
            <span className="yz-label">Try</span>
            {examples.map((ex) => (
              <button key={ex} type="button" className="yz-chip yz-chip--pick yz-chip--dusk" onClick={() => setReplanText(ex)}>
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
