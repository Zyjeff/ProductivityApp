// plan.jsx — the tide rail, Nightwatch cut: ghost week numeral, tick
// ruler, date gutters with the amber TODAY block, per-day load meters
// with % of capacity, Rail/Cards layout toggle, the radio console
// ("Ask the observatory… Transmit"). All state, handlers, and data flow
// identical to the core contract.

import React, { useMemo, useState } from "react";
import { Icon, EmptyState, Lamp, Kbd, MOD, Stamp, HLight, Meter } from "../components.jsx";
import { GhostNumeral } from "../chrome.jsx";
import * as D from "../../../core/domain.js";
import {
  useStore, setUI, setCompletion, setCaps, toggleDayLock,
  applyPlan, moveChunkDate, notify, dismissChunk,
} from "../../../core/store.js";
import { aiPlan, aiReplan, aiFailureMessage } from "../../../core/ai.js";

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
  const [viewMode, setViewMode] = useState("rows");

  const hour = meta.dayStartHour || 0;
  const todayIso = D.effectiveTodayIso(hour);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const lockedDateSet = useMemo(() => new Set(Object.keys(locks || {}).filter((k) => locks[k])), [locks]);

  const pending = tasks.filter((t) => !t.completed && t.recurring === "none");
  const recurring = tasks.filter((t) => t.recurring !== "none");
  const recurringHours = recurring.reduce((s, t) => s + (t.recurring === "daily" ? D.taskHours(t) : D.taskHours(t) / 5), 0);
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
        notify("The AI couldn't map that request onto the plan — nothing was changed");
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

  const now = new Date();
  const onejan = new Date(now.getFullYear(), 0, 1);
  const weekN = Math.ceil((((now - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  const capTone = (v) => v === 0 ? "var(--line)" : v <= 2 ? "var(--port)" : v <= 4 ? "var(--warn)" : "var(--starboard)";
  const todayDow = D.weekdayName(now);

  const chunkPill = (day, it, mode) => {
    const t = tasksById.get(it.taskId);
    if (!t) return null;
    const project = t.projectId ? projectsById.get(t.projectId) : null;
    const chunks = D.getTaskChunks(t.id, plan);
    const isSplit = chunks.length > 1;
    const idx = chunks.findIndex((c) => c.date === day.iso);
    const chunkDone = !!(it.done || t.completed);
    const hoursHere = it.hours != null ? it.hours : D.taskHours(t);
    const color = chunkDone ? "var(--line-dim)" : project?.color || D.DIFFICULTY[t.difficulty]?.tone || "var(--channel)";
    const dragProps = {
      draggable: !chunkDone,
      onDragStart: (e) => { setDragged({ taskId: t.id, fromDate: day.iso }); e.dataTransfer.effectAllowed = "move"; },
      onDragEnd: () => { setDragged(null); setDragOver(null); },
    };
    if (mode === "cards") {
      return (
        <div key={it.taskId} className="pcard" {...dragProps} style={{ boxShadow: `inset 3px 0 0 ${color}`, opacity: chunkDone ? 0.5 : 1, cursor: chunkDone ? "default" : "grab" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <HLight size={14} done={chunkDone}
              onComplete={() => setCompletion(t.id, { done: true, chunkDate: day.iso })}
              onReopen={() => setCompletion(t.id, { done: false, chunkDate: day.iso })} />
            <span className="pcard-title" onClick={() => setUI({ editingTaskId: t.id, formOpen: true })} title="Click to edit · drag to move"
              style={{ cursor: "pointer", textDecoration: chunkDone ? "line-through" : "none", color: chunkDone ? "var(--fg-faint)" : "var(--fg)" }}>
              {t.title}
            </span>
            {isSplit && <Stamp tone="var(--amber-hot)" style={{ flexShrink: 0, fontSize: 8.5 }}>{idx + 1}/{chunks.length}</Stamp>}
            <button className="icon-btn" style={{ padding: 1, marginLeft: "auto" }} onClick={() => dismissChunk(t.id, day.iso)} title="Unschedule (undoable)" aria-label="Unschedule">
              <Icon name="close" size={9} />
            </button>
          </div>
          {(project || it.note) && (
            <div className="w-num" style={{ fontSize: 9, color: "var(--fg-faint)", margin: "3px 0 0 21px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {project && <span style={{ color: chunkDone ? "var(--fg-faint)" : project.color }}>{project.title.toUpperCase()}</span>}
              {project && it.note && " · "}
              {it.note && <span style={{ fontStyle: "italic" }}>{it.note}</span>}
            </div>
          )}
          <div className="w-num" style={{ fontSize: 8.5, color: "var(--fg-faint)", marginLeft: 21 }}>{hoursHere}H</div>
        </div>
      );
    }
    return (
      <div key={it.taskId} className="lrow" {...dragProps}
        style={{ "--row-lamp": color, minHeight: 38, opacity: chunkDone ? 0.55 : 1, cursor: chunkDone ? "default" : "grab" }}>
        <HLight size={14} done={chunkDone}
          onComplete={() => setCompletion(t.id, { done: true, chunkDate: day.iso })}
          onReopen={() => setCompletion(t.id, { done: false, chunkDate: day.iso })} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="lrow-title" style={{ fontSize: 12.5, cursor: "pointer", textDecoration: chunkDone ? "line-through" : "none", color: chunkDone ? "var(--fg-faint)" : "var(--fg)" }}
            onClick={() => setUI({ editingTaskId: t.id, formOpen: true })} title="Click to edit · drag to move">
            {t.title}
          </div>
          {it.note && <div className="lrow-meta w-num"><span style={{ fontStyle: "italic" }}>{it.note}</span></div>}
        </div>
        {isSplit && <Stamp tone="var(--amber-hot)">{idx + 1}/{chunks.length}</Stamp>}
        {project && <span className="w-num" style={{ fontSize: 9, color: project.color, flexShrink: 0 }}>{project.title.toUpperCase()}</span>}
        <span className="w-num" style={{ fontSize: 9.5, color: "var(--fg-faint)", flexShrink: 0 }}>{hoursHere}H</span>
        <button className="icon-btn" style={{ padding: 1 }} onClick={() => dismissChunk(t.id, day.iso)} title="Unschedule (undoable)" aria-label="Unschedule">
          <Icon name="close" size={10} />
        </button>
      </div>
    );
  };

  return (
    <div className="view-pad">
      <div className="header-band" style={{ marginBottom: 26 }}>
        <GhostNumeral text={"W" + weekN} fontSize={118} top={-38} />
        <div className="w-stencil-row" style={{ marginBottom: 10 }}>
          <span className="w-stencil w-stencil--lit">Week {weekN} · {D.fmtWeekLabel(D.mondayOf(now))}</span>
        </div>
        <div className="greeting-row">
          <h1 className="w-display greeting">Chart the week.</h1>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="w-num" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9.5, color: "var(--fg-faint)" }}>
                <Lamp status={aiStatus} detail={aiDetail} /> {aiStatus === "off" ? "AI OFF" : aiStatus === "busy" ? "THINKING…" : "AI"}
              </span>
              {unscheduled.length > 0 && (
                <div style={{ display: "inline-flex" }}>
                  <button className="switch switch--sm" disabled={!!busy} onClick={() => runSchedule("")} style={{ clipPath: "none" }}>
                    {busy === "schedule" ? "Scheduling…" : `Schedule ${unscheduled.length} pending`}
                  </button>
                  <button className="switch switch--sm" disabled={!!busy} onClick={() => setInstructionOpen((v) => !v)}
                    title="Schedule with custom instructions" aria-expanded={instructionOpen}
                    style={{ padding: "0 9px", background: "var(--amber-deep)", color: "var(--amber-hot)" }}>
                    <Icon name="chevron" size={11} />
                  </button>
                </div>
              )}
              {(plan || []).length > 0 && (
                <button className="bezel bezel--sm" disabled={!!busy} onClick={runOptimize} title="Rebuild the whole plan from scratch (undoable)">
                  {busy === "optimize" ? "Rebuilding…" : "Rebuild"}
                </button>
              )}
            </div>
            <div className="yard-count w-num">
              {pending.length} PENDING · ~{totalH.toFixed(1)}H{unscheduled.length ? ` · ${unscheduled.length} UNSCHEDULED` : ""} · {headStats.placed} PLACED{headStats.over ? ` · ${headStats.over} DAY${headStats.over > 1 ? "S" : ""} OVER` : ""}
            </div>
          </div>
        </div>
      </div>

      {instructionOpen && (
        <div className="plate fade-in" style={{ padding: 14, marginBottom: 18, marginRight: 34 }}>
          <div className="w-stencil-row" style={{ marginBottom: 10 }}><span className="w-stencil w-stencil--lit">Schedule with instructions</span></div>
          <textarea autoFocus value={instruction} disabled={!!busy} className="field"
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runSchedule(instruction); }
              else if (e.key === "Escape") setInstructionOpen(false);
            }}
            placeholder="e.g. spread over the next 2 weeks · alternate IGP with other work · finish by Friday"
            style={{ height: 56, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="switch switch--sm" disabled={!!busy} onClick={() => runSchedule(instruction)}>
              {busy === "schedule" ? "Scheduling…" : "Schedule"}
            </button>
            <button className="bezel bezel--sm" disabled={!!busy} onClick={() => { setInstructionOpen(false); setInstruction(""); }}>Cancel</button>
            <span className="w-num" style={{ fontSize: 9.5, color: "var(--fg-faint)", marginLeft: "auto" }}>
              EMPTY = EARLIEST-FIRST · <Kbd>{MOD}</Kbd><Kbd>↵</Kbd>
            </span>
          </div>
        </div>
      )}

      {/* capacity */}
      <div style={{ paddingRight: 34, marginBottom: 26 }}>
        <div className="w-stencil-row" style={{ marginBottom: 10 }}><span className="w-stencil">Capacity · hours per day</span></div>
        <div className="cap-grid">
          {D.WEEK_ALL.map((day, i) => {
            const val = caps[day] ?? 0;
            const isOff = val === 0;
            return (
              <div key={day} className={"cap-cell" + (i ? " cap-cell--split" : "") + (isOff ? " off" : "")}>
                <div className={"cd-dow" + (day === todayDow ? " today" : "")}>{day.slice(0, 3).toUpperCase()}</div>
                {editingCap === day ? (
                  <input type="number" min="0" max="10" step="0.5" defaultValue={val} autoFocus
                    onBlur={(e) => { updateCap(day, e.target.value); setEditingCap(null); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { updateCap(day, e.target.value); setEditingCap(null); }
                      if (e.key === "Escape") setEditingCap(null);
                    }}
                    className="cap-input" />
                ) : (
                  <button onClick={() => setEditingCap(day)} className="bezel bezel--sm cap-btn"
                    style={{ color: isOff ? "var(--fg-faint)" : "var(--fg)" }}>
                    {isOff ? "off" : `${val}h`}
                  </button>
                )}
                <div style={{ marginTop: 8 }}><Meter pct={isOff ? 0 : (val / 8) * 100} tone={capTone(val)} height={4} /></div>
              </div>
            );
          })}
        </div>
        {recurring.length > 0 && (
          <div className="w-num" style={{ margin: "8px 0 0", fontSize: 9.5, color: "var(--fg-faint)" }}>
            RECURRING EVERY DAY: {recurring.filter((t) => t.recurring === "daily").map((t) => t.title.toUpperCase()).join(" · ") || "—"} ({recurringHours.toFixed(1)}H/DAY RESERVED)
          </div>
        )}
      </div>

      {missed.length > 0 && (
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10, paddingRight: 34 }}>
          <span className="w-tape w-tape--warn">Adrift</span>
          <span style={{ fontSize: 12, color: "var(--fg-dim)" }}>{missed.length} item{missed.length > 1 ? "s" : ""} from past days — triage on</span>
          <button className="link" onClick={() => setUI({ view: "today" })}>Today</button>
        </div>
      )}

      {/* the tide rail */}
      <div style={{ paddingRight: 34, paddingBottom: 20 }}>
        <div className="section-head" style={{ marginBottom: 12 }}>
          <div className="w-stencil-row" style={{ flex: 1 }}><span className="w-stencil">Tide rail</span></div>
          <div className="slab-types" role="group" aria-label="Task layout">
            <button className={viewMode === "rows" ? "on" : ""} onClick={() => setViewMode("rows")}>Rail</button>
            <button className={viewMode === "cards" ? "on" : ""} onClick={() => setViewMode("cards")}>Cards</button>
          </div>
        </div>

        {agendaDays.every((d) => d.items.length === 0) && pending.length === 0 ? (
          <EmptyState caption="nothing moored">
            <div className="w-display" style={{ fontSize: 17, color: "var(--fg)", marginBottom: 8 }}>Nothing planned.</div>
            <div>Capture work on Today, then chart it here — by hand (drag) or over the radio.</div>
          </EmptyState>
        ) : (
          <>
            <div className="tiderail">
              <div className="tiderail-ticks" aria-hidden />
              {agendaDays.map((day) => {
                const dayScheduledH = day.items.reduce((s2, it) => {
                  const t = tasksById.get(it.taskId);
                  if (!t || t.recurring !== "none") return s2;
                  return s2 + (it.hours != null ? it.hours : D.taskHours(t));
                }, 0);
                const dayH = dayScheduledH + (day.cap > 0 ? recurringHours : 0);
                const loadPct = day.cap > 0 ? Math.min(Math.round((dayH / day.cap) * 100), 100) : 0;
                const over = day.cap > 0 && dayH > day.cap;
                const loadColor = over ? "var(--port)" : dayH === day.cap && day.cap > 0 ? "var(--starboard)" : "var(--amber)";
                return (
                  <div key={day.iso} className={"tide-day" + (day.isToday ? " tide-day--today" : "") + (day.locked ? " tide-day--locked" : "")}>
                    <div className="tide-date">
                      <div className="dow">{day.wd.slice(0, 3).toUpperCase()}</div>
                      <div className="dnum">{day.d.getDate()}</div>
                    </div>
                    <div className="plate plate--flush"
                      onDragOver={(e) => { if (!day.locked) { e.preventDefault(); setDragOver(day.iso); } }}
                      onDragLeave={() => { if (dragOver === day.iso) setDragOver(null); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (day.locked) { notify("That day is locked"); }
                        else if (dragged) moveChunkDate(dragged.taskId, dragged.fromDate, day.iso);
                        setDragged(null); setDragOver(null);
                      }}
                      style={dragOver === day.iso ? { background: "var(--amber-ground)" } : undefined}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px 8px" }}>
                        <span className={"tide-load w-num " + (day.cap === 0 ? "tide-load--off" : over ? "tide-load--over" : "tide-load--ok")} style={{ flexShrink: 0 }}>
                          {day.cap === 0 ? "DAY OFF" : `${dayH.toFixed(1)}H OF ${day.cap}H${over ? " — OVER" : ""}`}
                        </span>
                        {over && <span className="w-tape w-tape--port" style={{ fontSize: 8 }}>Overloaded</span>}
                        <div style={{ flex: 1, maxWidth: 220 }}>
                          {day.cap > 0 && dayH > 0 && (
                            <div className="meter" style={{ height: 3 }}>
                              <div className="meter-fill" style={{ width: loadPct + "%", backgroundColor: loadColor }} />
                            </div>
                          )}
                        </div>
                        <button className="icon-btn" onClick={() => toggleDayLock(day.iso)}
                          title={day.locked ? "Locked — planner skips it. Click to unlock." : "Lock day (planner will skip it)"}
                          aria-pressed={day.locked} style={{ color: day.locked ? "var(--amber-hot)" : undefined, padding: 2 }}>
                          <Icon name={day.locked ? "lock" : "unlock"} size={11} />
                        </button>
                      </div>
                      {day.items.length === 0
                        ? <div className="w-num" style={{ padding: "0 12px 10px", fontSize: 10, color: "var(--fg-faint)" }}>{day.cap === 0 ? "REST — the observatory is closed." : "nothing moored"}</div>
                        : viewMode === "cards"
                          ? <div className="pcard-grid">{day.items.map((it) => chunkPill(day, it, "cards"))}</div>
                          : <div className="ledger" style={{ padding: "0 0 2px" }}>{day.items.map((it) => chunkPill(day, it, "rows"))}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
              <button className="bezel bezel--sm" onClick={() => setHorizon((h) => h + 28)}>Show 4 more weeks</button>
            </div>
          </>
        )}
      </div>

      {/* radio console */}
      {(plan || []).length > 0 && (
        <div style={{ paddingRight: 34, paddingBottom: 56 }}>
          <div className="radio-console">
            <span className="w-tape">Ask the observatory</span>
            <input value={replanText} disabled={!!busy}
              onChange={(e) => setReplanText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runReplan(); } else if (e.key === "Escape") setReplanText(""); }}
              placeholder={busy === "replan" ? "Re-charting…" : "e.g. move everything hard to Wednesday, keep Friday light…"}
              aria-label="Replan instruction" autoComplete="off" />
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Lamp status={aiStatus} detail={aiDetail} />
              <span className="w-stencil" style={{ fontSize: 8.5 }}>AI</span>
            </span>
            <button className="switch switch--sm" disabled={!replanText.trim() || !!busy} onClick={runReplan}>
              {busy === "replan" ? "Transmitting…" : "Transmit"}
            </button>
          </div>
          {!replanText && !busy && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7, alignItems: "center" }}>
              <span className="w-stencil" style={{ fontSize: 8.5, marginRight: 2 }}>Try</span>
              {["Spread the client work over 2 weeks", "Push everything past Friday", "Move design tasks earlier"].map((ex) => (
                <button key={ex} onClick={() => setReplanText(ex)} className="stamp stamp--pick"
                  style={{ textTransform: "none", letterSpacing: 0, fontSize: 10 }}>
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
