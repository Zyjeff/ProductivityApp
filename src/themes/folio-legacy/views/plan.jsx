// plan.jsx — the slipway. 1-Bit Harbor: the TIDE RAIL — a continuous
// dithered date gutter down the left, day bands to its right; capacity
// as a 7-dial instrument row; AI controls in a radio-console slab.
// All state, handlers, and data flow identical to the previous version.

import React, { useEffect, useMemo, useState } from "react";
import { Icon, EmptyState, PageHeader, ProgressBar, AiDot, Kbd, MOD } from "../components.jsx";
import * as D from "../../../core/domain.js";
import {
  useStore, setUI, setCompletion, setCaps, toggleDayLock,
  applyPlan, moveChunkDate, pinTaskToDate, notify, dismissChunk,
} from "../../../core/store.js";
import { aiPlan, aiReplan, aiFailureMessage } from "../../../core/ai.js";

import { registerActiveList } from "../../../core/keys.js";
export function PlanView() {
  useEffect(() => { registerActiveList("plan", []); }, []);
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
  const [moveTarget,setMoveTarget]=useState(null);
  const [moveDate,setMoveDate]=useState("");

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
    <div className="f-page f-plan">
      <PageHeader
        eyebrow="02 / THE IMPOSITION BOARD"
        title="Make space."
        sub={`${pending.length} PENDING · ~${totalH.toFixed(1)}H${unscheduled.length ? ` · ${unscheduled.length} UNSCHEDULED` : ""}${recurring.length ? ` · ${recurringHours.toFixed(1)}H/DAY RECURRING` : ""}`}
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="w-num" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9.5, color: "var(--fg-faint)", marginRight: 4 }}>
              <AiDot status={aiStatus} detail={aiDetail} />
              {aiStatus === "off" ? "AI OFF" : aiStatus === "busy" ? "THINKING…" : "AI"}
            </span>
            {unscheduled.length > 0 && (
              <div style={{ display: "inline-flex" }}>
                <button className="w-switch" disabled={!!busy} onClick={() => runSchedule("")} style={{ clipPath: "none" }}>
                  {busy === "schedule" ? "Scheduling…" : `Schedule ${unscheduled.length} pending`}
                </button>
                <button className="w-switch" disabled={!!busy} onClick={() => setInstructionOpen((v) => !v)}
                  title="Schedule with custom instructions" aria-expanded={instructionOpen}
                  style={{ padding: "0 9px", background: "var(--amber-deep)", color: "var(--amber-hot)" }}>
                  <Icon name="chevron" size={11} />
                </button>
              </div>
            )}
            {(plan || []).length > 0 && (
              <button className="w-bezel" disabled={!!busy} onClick={runOptimize} title="Rebuild the whole plan from scratch (undoable)">
                {busy === "optimize" ? "Rebuilding…" : "Rebuild"}
              </button>
            )}
          </div>
        }
      />

      {instructionOpen && (
        <div className="w-plate w-fade-in" style={{ padding: 14, marginBottom: 18 }}>
          <div className="w-stencil-row" style={{ marginBottom: 10 }}><span className="w-stencil w-stencil--lit">Schedule with instructions</span></div>
          <div className="w-well" style={{ marginBottom: 10 }}>
            <textarea autoFocus value={instruction} disabled={!!busy}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runSchedule(instruction); }
                else if (e.key === "Escape") setInstructionOpen(false);
              }}
              placeholder="e.g. spread over the next 2 weeks · alternate IGP with other work · finish by Friday"
              style={{ height: 56 }} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="w-switch w-switch--sm" disabled={!!busy} onClick={() => runSchedule(instruction)}>
              {busy === "schedule" ? "Scheduling…" : "Schedule"}
            </button>
            <button className="w-bezel w-bezel--sm" disabled={!!busy} onClick={() => { setInstructionOpen(false); setInstruction(""); }}>Cancel</button>
            <span className="w-num" style={{ fontSize: 9.5, color: "var(--fg-faint)", marginLeft: "auto" }}>
              EMPTY = EARLIEST-FIRST · <Kbd>{MOD}</Kbd><Kbd>↵</Kbd>
            </span>
          </div>
        </div>
      )}

      {/* capacity: 7-dial instrument row */}
      <div className="w-plate w-plate--flush w-cap-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", marginBottom: 22 }}>
        {D.WEEK_ALL.map((day, i) => {
          const val = caps[day] ?? 0;
          const isOff = val === 0;
          const isToday = day === D.weekdayName(D.parseIsoDate(todayIso));
          const tone = isOff ? "var(--line)" : val <= 2 ? "var(--port)" : val <= 4 ? "var(--warn)" : "var(--starboard)";
          return (
            <div key={day} style={{
              padding: "12px 12px 14px", textAlign: "center", opacity: isOff ? 0.55 : 1,
              backgroundImage: i ? "var(--dither-vsplit)" : "none", backgroundRepeat: "repeat-y", backgroundPosition: "left top",
            }}>
              <div className="w-stencil" style={{ marginBottom: 8, color: isToday ? "var(--amber)" : undefined }}>{day.slice(0, 3)}</div>
              {editingCap === day ? (
                <input type="number" min="0" max="10" step="0.5" defaultValue={val} autoFocus
                  onBlur={(e) => { updateCap(day, e.target.value); setEditingCap(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { updateCap(day, e.target.value); setEditingCap(null); } }}
                  className="w-bare" style={{ width: "100%", textAlign: "center" }} />
              ) : (
                <button onClick={() => setEditingCap(day)} className="w-bezel w-bezel--sm"
                  style={{ width: "100%", justifyContent: "center", color: isOff ? "var(--fg-faint)" : "var(--fg)" }}>
                  {isOff ? "off" : `${val}h`}
                </button>
              )}
              <div style={{ marginTop: 8 }}><ProgressBar pct={isOff ? 0 : (val / 8) * 100} tone={tone} height={4} /></div>
            </div>
          );
        })}
      </div>
      {recurring.length > 0 && (
        <div className="w-num" style={{ margin: "-14px 0 20px", fontSize: 9.5, color: "var(--fg-faint)" }}>
          RECURRING EVERY DAY: {recurring.filter((t) => t.recurring === "daily").map((t) => t.title.toUpperCase()).join(" · ") || "—"} ({recurringHours.toFixed(1)}H/DAY RESERVED)
        </div>
      )}

      {missed.length > 0 && (
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <span className="w-tape w-tape--warn">Carryovers</span>
          <span style={{ fontSize: 12, color: "var(--fg-dim)" }}>{missed.length} item{missed.length > 1 ? "s" : ""} from past days — triage on</span>
          <button className="w-link" onClick={() => setUI({ view: "today" })}>Today</button>
        </div>
      )}

      {unscheduled.length>0 && <section className="f-unplaced"><div className="f-section-title"><span>Unplaced manuscripts · {unscheduled.length}</span><span className="f-kicker">DRAG TO A DAY, OR CHOOSE A DATE</span></div><div className="f-unplaced-list">{unscheduled.map(t=><div key={t.id} draggable className="f-unplaced-task" onDragStart={e=>{setDragged({taskId:t.id,fromDate:null});e.dataTransfer.effectAllowed="move";}} onDragEnd={()=>setDragged(null)}><span>{t.title}</span><small>{D.taskHours(t)}h</small><button className="w-icon-btn" aria-label={"Schedule "+t.title} onClick={()=>{setMoveTarget({taskId:t.id,fromDate:null});setMoveDate(todayIso);}}><Icon name="calendar"/></button></div>)}</div></section>}
      {moveTarget && <div className="f-move-strip" role="group" aria-label="Choose task date"><span>Place this task on</span><input type="date" aria-label="Destination date" value={moveDate} onChange={e=>setMoveDate(e.target.value)} className="w-field"/><button className="w-switch" disabled={!moveDate} onClick={()=>{if(locks[moveDate]){notify("That day is locked");return;}if(moveTarget.fromDate)moveChunkDate(moveTarget.taskId,moveTarget.fromDate,moveDate);else pinTaskToDate(moveTarget.taskId,moveDate);setMoveTarget(null);}}>Place task</button><button className="w-bezel" onClick={()=>setMoveTarget(null)}>Cancel</button></div>}
      <div className="f-section-title"><span>At a glance</span><span className="f-kicker">SELECT A DAY TO TURN TO ITS PAGE</span></div>
      <div className="f-atlas">{agendaDays.map(day => {const hours=day.items.reduce((n,it)=>n+(it.hours??D.taskHours(tasksById.get(it.taskId)||{})),0)+(day.cap>0?recurringHours:0);return <button key={day.iso} className={"f-atlas-day"+(day.isToday?" is-today":"")} onClick={()=>document.getElementById('folio-day-'+day.iso)?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})} title={day.iso+' · '+hours.toFixed(1)+'h / '+day.cap+'h'}><span>{day.wd.slice(0,2)}</span><b>{day.d.getDate()}</b><i style={{opacity:hours?1:.18,width:Math.min(100,day.cap?hours/day.cap*100:100)+'%'}}/>{day.locked && <Icon name="lock" size={10}/>}</button>})}</div>
      <div className="f-section-title"><span>The working pages</span><span className="f-kicker">DRAG TASKS BETWEEN DAYS</span></div>
      {/* imposition sheets */}
      {agendaDays.length === 0 ? (
        <EmptyState>
          <div className="w-display" style={{ fontSize: 17, color: "var(--fg)", marginBottom: 8 }}>Nothing planned.</div>
          <div>Capture work on Today, then schedule it here — by hand (drag) or with the AI.</div>
        </EmptyState>
      ) : (
        <div className="f-plan-grid">
          {agendaDays.map((day) => {
            const dayScheduledH = day.items.reduce((s, it) => {
              const t = tasksById.get(it.taskId);
              if (!t || t.recurring !== "none") return s;
              return s + (it.hours != null ? it.hours : D.taskHours(t));
            }, 0);
            const dayH = dayScheduledH + (day.cap > 0 ? recurringHours : 0);
            const loadPct = day.cap > 0 ? Math.min(Math.round((dayH / day.cap) * 100), 100) : 0;
            const over = day.cap > 0 && dayH > day.cap;
            const loadColor = over ? "var(--port)" : loadPct > 65 ? "var(--warn)" : "var(--starboard)";
            return (
              <div key={day.iso} id={"folio-day-"+day.iso} className={"f-day-sheet"+(day.isToday?" is-today":"")}>
                {/* date gutter with continuous tick column */}
                <div className="f-day-date" style={{
                  position: "relative", padding: "12px 12px 12px 0", textAlign: "right",
                  backgroundImage: "var(--dither-vsplit)", backgroundRepeat: "repeat-y", backgroundPosition: "right top",
                }}>
                  {day.isToday ? (
                    <span className="w-tape" style={{ fontSize: 8.5 }}>Today</span>
                  ) : (
                    <>
                      <div className="w-stencil" style={{ fontSize: 8.5 }}>{day.wd.slice(0, 3)}</div>
                      <div className="w-display w-num" style={{ fontSize: 17, color: day.items.length ? "var(--fg)" : "var(--fg-faint)" }}>{day.d.getDate()}</div>
                    </>
                  )}
                  {day.locked && <div style={{ marginTop: 4, color: "var(--amber-hot)" }}><Icon name="lock" size={10} /></div>}
                </div>
                {/* day band */}
                <div className="f-day-body"
                  onDragOver={(e) => { e.preventDefault(); setDragOver(day.iso); }}
                  onDragLeave={() => { if (dragOver === day.iso) setDragOver(null); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (day.locked) { notify("That day is locked"); }
                    else if (dragged) { if(dragged.fromDate) moveChunkDate(dragged.taskId, dragged.fromDate, day.iso); else pinTaskToDate(dragged.taskId, day.iso); }
                    setDragged(null); setDragOver(null);
                  }}
                  style={{
                    margin: "6px 0 6px 14px", padding: "8px 12px 10px",
                    background: dragOver === day.iso ? "var(--amber-ground)" : day.items.length ? "var(--plate)" : "transparent",
                    boxShadow: day.items.length ? "inset 0 1px 0 var(--line-dim)" : "none",
                    opacity: day.locked ? 0.6 : 1,
                    minHeight: 44,
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: day.items.length ? 8 : 0 }}>
                    {day.cap === 0
                      ? <span className="w-stencil" style={{ fontSize: 8.5 }}>Off</span>
                      : <span className="w-num" style={{ fontSize: 9.5, color: dayH > 0 ? loadColor : "var(--fg-faint)" }}>{dayH.toFixed(1)}/{day.cap}H</span>}
                    {over && <span className="w-tape w-tape--port" style={{ fontSize: 8 }}>Overloaded</span>}
                    <div style={{ flex: 1, maxWidth: 220 }}>
                      {day.cap > 0 && dayH > 0 && <ProgressBar pct={loadPct} tone={loadColor} height={3} />}
                    </div>
                    <button className="w-icon-btn" onClick={() => toggleDayLock(day.iso)}
                      title={day.locked ? "Locked — planner skips it. Click to unlock." : "Lock day (planner will skip it)"}
                      aria-pressed={day.locked} style={{ color: day.locked ? "var(--amber-hot)" : undefined, padding: 2 }}>
                      <Icon name={day.locked ? "lock" : "unlock"} size={11} />
                    </button>
                  </div>
                  {day.items.length === 0 && <p className="f-blank-page">{day.cap ? "Room to make something." : "Leave this page blank."}</p>}
                  {day.items.length > 0 && (
                    <div className="f-day-items">
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
                          <div key={it.taskId} className="f-plan-task"
                            draggable
                            onDragStart={(e) => { setDragged({ taskId: t.id, fromDate: day.iso }); e.dataTransfer.effectAllowed = "move"; }}
                            onDragEnd={() => { setDragged(null); setDragOver(null); }}
                            style={{
                              minWidth: 190, maxWidth: 330, flex: "1 1 230px",
                              background: "var(--well)",
                              boxShadow: `inset 3px 0 0 ${chunkDone ? "var(--line-dim)" : project?.color || D.DIFFICULTY[t.difficulty]?.tone || "var(--channel)"}`,
                              padding: "6px 9px 7px 11px",
                              opacity: chunkDone ? 0.5 : 1,
                              cursor: chunkDone ? "default" : "grab",
                            }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <button type="button" className={"w-light" + (chunkDone ? " w-light--on" : "")}
                                style={{ width: 13, height: 13 }}
                                onClick={() => setCompletion(t.id, { done: !chunkDone, chunkDate: day.iso })}
                                aria-label={chunkDone ? "Reopen" : "Complete"}>
                                {chunkDone && <svg width="7" height="7" viewBox="0 0 12 12"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="square" fill="none" /></svg>}
                              </button>
                              <button className="f-task-title" onClick={() => setUI({ editingTaskId: t.id, formOpen: true })} title="Click to edit · drag to move"
                                style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: chunkDone ? "line-through" : "none", color: chunkDone ? "var(--fg-faint)" : "var(--fg)" }}>
                                {t.title}
                              </button>
                              {isSplit && <span className="w-stamp w-stamp--lamp" style={{ color: "var(--amber-hot)", flexShrink: 0, fontSize: 8.5 }}>{idx + 1}/{chunks.length}</span>}
                              <button className="w-icon-btn" title="Move to date" aria-label={"Move "+t.title} onClick={()=>{setMoveTarget({taskId:t.id,fromDate:day.iso});setMoveDate(day.iso);document.querySelector(".f-unplaced")?.scrollIntoView({block:"center"});}}><Icon name="calendar" size={11}/></button>
                              <button className="w-icon-btn" style={{ padding: 1 }} onClick={() => dismissChunk(t.id, day.iso)} title="Unschedule (undoable)" aria-label="Unschedule">
                                <Icon name="close" size={9} />
                              </button>
                            </div>
                            {(project || it.note) && (
                              <div className="w-num" style={{ fontSize: 9, color: "var(--fg-faint)", marginLeft: 19, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {project && <span style={{ color: chunkDone ? "var(--fg-faint)" : `color-mix(in srgb, ${project.color} 40%, #302d29)` }}>{project.title.toUpperCase()}</span>}
                                {project && it.note && " · "}
                                {it.note && <span style={{ fontStyle: "italic" }}>{it.note}</span>}
                              </div>
                            )}
                            <div className="w-num" style={{ fontSize: 8.5, color: "var(--fg-faint)", marginLeft: 19 }}>{hoursHere}H</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div className="f-more-weeks" style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
            <button className="w-bezel w-bezel--sm" onClick={() => setHorizon((h) => h + 28)}>Show 4 more weeks</button>
          </div>
        </div>
      )}

      {/* radio console: replan */}
      {(plan || []).length > 0 && (
        <>
          <div className="w-well" style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 22, paddingLeft: 12 }}>
            <span className="w-stencil w-stencil--lit" style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <Icon name="bolt" size={11} /> Ask
            </span>
            <input value={replanText} disabled={!!busy}
              onChange={(e) => setReplanText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runReplan(); } else if (e.key === "Escape") setReplanText(""); }}
              placeholder={busy === "replan" ? "Rearranging…" : "Spread the IGP work over 2 weeks · push everything past Friday…"}
              aria-label="Replan instruction"
              style={{ height: 42 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 8, flexShrink: 0 }}>
              <AiDot status={aiStatus} detail={aiDetail} />
              <button className="w-switch w-switch--sm" disabled={!replanText.trim() || !!busy} onClick={runReplan}>
                {busy === "replan" ? "Replanning…" : "Replan"}
              </button>
            </div>
          </div>
          {!replanText && !busy && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7, alignItems: "center" }}>
              <span className="w-stencil" style={{ fontSize: 8.5, marginRight: 2 }}>Try</span>
              {["Spread the client work over 2 weeks", "Push everything past Friday", "Move design tasks earlier"].map((ex) => (
                <button key={ex} onClick={() => setReplanText(ex)} className="w-stamp"
                  style={{ cursor: "pointer", background: "transparent", textTransform: "none", letterSpacing: 0, fontSize: 10 }}>
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
