// plan.jsx — the same tasks arranged in time. Agenda-first (today at the
// top, empty past days never shown), capacity strip, drag between days,
// AI schedule/replan with visible status and honest failures.

import React, { useMemo, useState } from "react";
import { Icon, Eyebrow, EmptyState, PageHeader, ProgressBar, AiDot, Kbd, MOD } from "../components.jsx";
import * as D from "../domain.js";
import {
  useStore, getState, setUI, setCompletion, setCaps, toggleDayLock,
  applyPlan, moveChunkDate, notify, dismissChunk,
} from "../store.js";
import { aiPlan, aiReplan, aiFailureMessage } from "../ai.js";

const VIEW_PAD = "28px 36px 48px";

export function PlanView() {
  const tasks = useStore((s) => s.tasks);
  const plan = useStore((s) => s.plan);
  const projects = useStore((s) => s.projects);
  const caps = useStore((s) => s.caps);
  const locks = useStore((s) => s.locks);
  const meta = useStore((s) => s.meta);
  const aiStatus = useStore((s) => s.ui.aiStatus);
  const aiDetail = useStore((s) => s.ui.aiDetail);

  const [busy, setBusy] = useState(null); // "schedule" | "replan" | "optimize"
  const [instruction, setInstruction] = useState("");
  const [replanText, setReplanText] = useState("");
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [editingCap, setEditingCap] = useState(null);
  const [dragged, setDragged] = useState(null); // { taskId, fromDate }
  const [dragOver, setDragOver] = useState(null);
  const [horizon, setHorizon] = useState(28);

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

  // Agenda days: today → today+horizon. Skip days that are BOTH off and
  // empty. Recurring tasks are shown once in a slim banner, not repeated
  // per cell (the audit's "28 copies of Morning planning" problem).
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

  // Past days that still hold items (context, shown collapsed on top).
  const missed = useMemo(() => D.getMissedWork(tasks, plan, hour), [tasks, plan, hour]);

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

  return (
    <div className="w-view-pad" style={{ padding: VIEW_PAD, maxWidth: 1080, margin: "0 auto" }}>
      <PageHeader
        eyebrow="The slipway"
        title="Plan"
        sub={`${pending.length} pending · ~${totalH.toFixed(1)}h${unscheduled.length ? ` · ${unscheduled.length} unscheduled` : ""}${recurring.length ? ` · ${recurringHours.toFixed(1)}h/day recurring` : ""}`}
        right={
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-faint)", marginRight: 6 }}>
              <AiDot status={aiStatus} detail={aiDetail} />
              {aiStatus === "off" ? "AI off" : aiStatus === "busy" ? "thinking…" : "AI"}
            </span>
            {unscheduled.length > 0 && (
              <div style={{ display: "inline-flex", borderRadius: "var(--r-md)", overflow: "hidden", boxShadow: "0 0 0 1px var(--amber)" }}>
                <button className="w-btn w-btn--primary" disabled={!!busy} onClick={() => runSchedule("")}
                  style={{ borderRadius: 0 }}>
                  {busy === "schedule" ? "Scheduling…" : `Schedule ${unscheduled.length} pending`}
                </button>
                <button className="w-btn w-btn--primary" disabled={!!busy} onClick={() => setInstructionOpen((v) => !v)}
                  title="Schedule with custom instructions" aria-expanded={instructionOpen}
                  style={{ borderRadius: 0, borderLeft: "1px solid rgba(0,0,0,0.25)", padding: "0 8px" }}>
                  <Icon name="chevron" size={12} />
                </button>
              </div>
            )}
            {(plan || []).length > 0 && (
              <button className="w-btn w-btn--outline" disabled={!!busy} onClick={runOptimize} title="Rebuild the whole plan from scratch (undoable)">
                {busy === "optimize" ? "Rebuilding…" : "Rebuild"}
              </button>
            )}
          </div>
        }
      />

      {instructionOpen && (
        <div className="w-card w-fade-in" style={{ padding: 14, marginBottom: 16, borderColor: "var(--amber)" }}>
          <Eyebrow>Schedule with instructions</Eyebrow>
          <textarea autoFocus className="w-textarea" value={instruction} disabled={!!busy}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runSchedule(instruction); }
              else if (e.key === "Escape") setInstructionOpen(false);
            }}
            placeholder="e.g. spread over the next 2 weeks · alternate IGP with other work · finish by Friday"
            style={{ height: 56, fontSize: 13, marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="w-btn w-btn--primary w-btn--sm" disabled={!!busy} onClick={() => runSchedule(instruction)}>
              {busy === "schedule" ? "Scheduling…" : "Schedule"}
            </button>
            <button className="w-btn w-btn--ghost w-btn--sm" disabled={!!busy} onClick={() => { setInstructionOpen(false); setInstruction(""); }}>Cancel</button>
            <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: "auto", fontFamily: "var(--font-mono)" }}>
              empty = earliest-first · <Kbd>{MOD}</Kbd><Kbd>↵</Kbd>
            </span>
          </div>
        </div>
      )}

      {/* capacity strip */}
      <div className="w-card" style={{ padding: 14, marginBottom: 16 }}>
        <Eyebrow>Weekly capacity — click a day to edit</Eyebrow>
        <div className="w-week-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 10 }}>
          {D.WEEK_ALL.map((day) => {
            const val = caps[day] ?? 0;
            const isOff = val === 0;
            const isToday = day === D.weekdayName(new Date());
            const tone = isOff ? "var(--border-strong)" : val <= 2 ? "var(--port)" : val <= 4 ? "var(--warning)" : "var(--starboard)";
            return (
              <div key={day} style={{ textAlign: "center", opacity: isOff ? 0.6 : 1 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 600, color: isToday ? "var(--amber)" : "var(--text-muted)" }}>{day.slice(0, 3)}</div>
                {editingCap === day ? (
                  <input type="number" min="0" max="10" step="0.5" defaultValue={val} autoFocus
                    onBlur={(e) => { updateCap(day, e.target.value); setEditingCap(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { updateCap(day, e.target.value); setEditingCap(null); } }}
                    className="w-input w-input--sm" style={{ textAlign: "center", fontFamily: "var(--font-mono)" }} />
                ) : (
                  <button onClick={() => setEditingCap(day)} className="w-btn w-btn--outline w-btn--sm"
                    style={{ width: "100%", justifyContent: "center", fontFamily: "var(--font-mono)", color: isOff ? "var(--text-faint)" : "var(--text)" }}>
                    {isOff ? "off" : `${val}h`}
                  </button>
                )}
                <div style={{ marginTop: 6 }}><ProgressBar pct={isOff ? 0 : (val / 8) * 100} tone={tone} height={3} /></div>
              </div>
            );
          })}
        </div>
        {recurring.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
            recurring every day: {recurring.filter((t) => t.recurring === "daily").map((t) => t.title).join(" · ") || "—"}
            {" "}({recurringHours.toFixed(1)}h/day reserved)
          </div>
        )}
      </div>

      {missed.length > 0 && (
        <div style={{ marginBottom: 14, fontSize: 12, color: "var(--warning)", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="bolt" size={12} /> {missed.length} adrift item{missed.length > 1 ? "s" : ""} from past days — triage on <button className="w-link" onClick={() => setUI({ view: "today" })}>Today</button>
        </div>
      )}

      {/* agenda */}
      {agendaDays.every((d) => d.items.length === 0) && pending.length === 0 ? (
        <EmptyState dashed>
          <div style={{ fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>Nothing planned.</div>
          <div>Capture work on Today, then schedule it here — by hand (drag) or with the AI.</div>
        </EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {agendaDays.map((day) => {
            const dayScheduledH = day.items.reduce((s, it) => {
              const t = tasksById.get(it.taskId);
              if (!t || t.recurring !== "none") return s;
              return s + (it.hours != null ? it.hours : D.taskHours(t));
            }, 0);
            const dayH = dayScheduledH + (day.cap > 0 ? recurringHours : 0);
            const loadPct = day.cap > 0 ? Math.min(Math.round((dayH / day.cap) * 100), 100) : 0;
            const over = day.cap > 0 && dayH > day.cap;
            const loadColor = over ? "var(--port)" : loadPct > 65 ? "var(--warning)" : "var(--starboard)";
            return (
              <div key={day.iso}
                className={"w-day-card" + (day.isToday ? " w-day-card--today" : "") + (dragOver === day.iso ? " w-day-card--dragover" : "") + (day.locked ? " w-day-card--locked" : "")}
                onDragOver={(e) => { if (!day.locked) { e.preventDefault(); setDragOver(day.iso); } }}
                onDragLeave={() => { if (dragOver === day.iso) setDragOver(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (day.locked) { notify("That day is locked"); }
                  else if (dragged) moveChunkDate(dragged.taskId, dragged.fromDate, day.iso);
                  setDragged(null); setDragOver(null);
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: day.items.length ? 8 : 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: day.isToday ? "var(--amber)" : "var(--text)", minWidth: 92 }}>
                    {day.isToday ? "Today" : day.d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  {day.cap === 0
                    ? <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>off</span>
                    : <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: dayH > 0 ? loadColor : "var(--text-faint)" }}>{dayH.toFixed(1)}/{day.cap}h</span>}
                  {over && <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--port)", fontWeight: 600 }}>OVERLOADED</span>}
                  <div style={{ flex: 1 }}>
                    {day.cap > 0 && dayH > 0 && <ProgressBar pct={loadPct} tone={loadColor} height={3} />}
                  </div>
                  <button className="w-icon-btn" onClick={() => toggleDayLock(day.iso)}
                    title={day.locked ? "Locked — planner skips it. Click to unlock." : "Lock day (planner will skip it)"}
                    aria-pressed={day.locked} style={{ color: day.locked ? "var(--amber-strong)" : undefined }}>
                    <Icon name={day.locked ? "lock" : "unlock"} size={11} />
                  </button>
                </div>
                {day.items.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {day.items.map((it) => {
                      const t = tasksById.get(it.taskId);
                      if (!t) return null;
                      const project = t.projectId ? projectsById.get(t.projectId) : null;
                      const chunks = D.getTaskChunks(t.id, plan);
                      const isSplit = chunks.length > 1;
                      const idx = chunks.findIndex((c) => c.date === day.iso);
                      const chunkDone = !!(it.done || t.completed);
                      const hoursHere = it.hours != null ? it.hours : D.taskHours(t);
                      return (
                        <div key={it.taskId} className="w-plan-item"
                          draggable={!chunkDone}
                          onDragStart={(e) => { setDragged({ taskId: t.id, fromDate: day.iso }); e.dataTransfer.effectAllowed = "move"; }}
                          onDragEnd={() => { setDragged(null); setDragOver(null); }}
                          style={{
                            minWidth: 180, maxWidth: 320, flex: "1 1 220px",
                            borderLeft: "2px solid " + (chunkDone ? "var(--border)" : project?.color || D.DIFFICULTY[t.difficulty]?.tone || "var(--channel)"),
                            opacity: chunkDone ? 0.55 : 1,
                            cursor: chunkDone ? "default" : "grab",
                          }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <button type="button" className={"w-check" + (chunkDone ? " w-check--done" : "")}
                              style={{ width: 14, height: 14 }}
                              onClick={() => setCompletion(t.id, { done: !chunkDone, chunkDate: day.iso })}
                              aria-label={chunkDone ? "Reopen" : "Complete"}>
                              {chunkDone && <svg width="8" height="8" viewBox="0 0 12 12"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#071a10" strokeWidth="2.2" strokeLinecap="round" fill="none" /></svg>}
                            </button>
                            <span onClick={() => setUI({ editingTaskId: t.id, formOpen: true })} title="Click to edit · drag to move"
                              style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: chunkDone ? "line-through" : "none", color: chunkDone ? "var(--text-faint)" : "var(--text)" }}>
                              {t.title}
                            </span>
                            {isSplit && <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--amber-strong)", background: "var(--amber-soft)", borderRadius: 3, padding: "1px 4px", flexShrink: 0 }}>{idx + 1}/{chunks.length}</span>}
                            <button className="w-icon-btn" style={{ padding: 2 }} onClick={() => dismissChunk(t.id, day.iso)} title="Unschedule (undoable)" aria-label="Unschedule">
                              <Icon name="close" size={9} />
                            </button>
                          </div>
                          {(project || it.note) && (
                            <div style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: 20, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {project && <span style={{ color: chunkDone ? "var(--text-faint)" : project.color }}>{project.title}</span>}
                              {project && it.note && " · "}
                              {it.note && <span style={{ fontStyle: "italic" }}>{it.note}</span>}
                            </div>
                          )}
                          <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-faint)", marginLeft: 20 }}>{hoursHere}h</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
            <button className="w-btn w-btn--ghost w-btn--sm" onClick={() => setHorizon((h) => h + 28)}>Show 4 more weeks</button>
          </div>
        </div>
      )}

      {/* replan bar */}
      {(plan || []).length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, padding: "8px 10px 8px 14px", background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "500 11px var(--font-mono)", color: "var(--amber-strong)", letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0 }}>
              <Icon name="bolt" size={12} /> Ask
            </span>
            <input value={replanText} disabled={!!busy}
              onChange={(e) => setReplanText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runReplan(); } else if (e.key === "Escape") setReplanText(""); }}
              placeholder={busy === "replan" ? "Rearranging…" : "Spread the IGP work over 2 weeks · push everything past Friday…"}
              aria-label="Replan instruction"
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", font: "13.5px var(--font-sans)", color: "var(--text)", padding: "4px 0" }} />
            <AiDot status={aiStatus} detail={aiDetail} />
            <button className="w-btn w-btn--primary w-btn--sm" disabled={!replanText.trim() || !!busy} onClick={runReplan}>
              {busy === "replan" ? "Replanning…" : "Replan"}
            </button>
          </div>
          {!replanText && !busy && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6, paddingLeft: 4 }}>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-faint)", marginRight: 2 }}>Try</span>
              {["Spread the client work over 2 weeks", "Push everything past Friday", "Move design tasks earlier"].map((ex) => (
                <button key={ex} onClick={() => setReplanText(ex)}
                  style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 6px", borderRadius: 3, background: "transparent", border: "1px solid var(--border)", color: "var(--text-faint)", cursor: "pointer" }}>
                  {ex}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
