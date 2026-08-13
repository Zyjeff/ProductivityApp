// plan.jsx — The Shrine Map.
//
// DEPARTURE: the plan is a route, not a grid or a rail of cells. Days
// are torii gates strung along one inked road; each gate inks itself
// in as its work completes, and the items are small shrines standing
// under it. Locked days are barred gates.
//
// All state, handlers and data flow are the core contract.

import React, { useMemo, useState } from "react";
import { Icon, EmptyState, Lamp, Kbd, MOD, Seal, Bloom, Meter, SealPick } from "../components.jsx";
import { ToriiRow } from "../charts.jsx";
import { ghostWash } from "../texture.js";
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

  const hour = meta.dayStartHour || 0;
  const todayIso = D.effectiveTodayIso(hour);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const lockedDateSet = useMemo(() => new Set(Object.keys(locks || {}).filter((k) => locks[k])), [locks]);

  const pending = tasks.filter((t) => !t.completed && t.recurring === "none");
  const recurring = tasks.filter((t) => t.recurring !== "none");
  const recurringHours = recurring.reduce((acc, t) => acc + (t.recurring === "daily" ? D.taskHours(t) : D.taskHours(t) / 5), 0);
  const scheduledIds = new Set((plan || []).flatMap((e) => e.items.map((i) => i.taskId)));
  const unscheduled = pending.filter((t) => !scheduledIds.has(t.id));
  const totalH = pending.reduce((acc, t) => acc + D.taskHours(t), 0);

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
      const h = day.items.reduce((acc, it) => {
        const t = tasksById.get(it.taskId);
        if (!t || t.recurring !== "none") return acc;
        return acc + (it.hours != null ? it.hours : D.taskHours(t));
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
      applyPlan(next, { snapshotLabel: "The map is redrawn" });
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
      applyPlan(next, { snapshotLabel: "The route is redrawn" });
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
        notify("The oracle couldn't find that on the map — nothing moved");
      } else {
        applyPlan(res.plan, { snapshotLabel: `${res.applied.length} change${res.applied.length === 1 ? "" : "s"} to the route` });
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
  const capTone = (v) => v === 0 ? "var(--line)" : v <= 2 ? "var(--port)" : v <= 4 ? "var(--warn)" : "var(--sakura)";
  const todayDow = D.weekdayName(now);
  const ghostBg = useMemo(() => ghostWash("plan-w" + weekN, 300, 180), [weekN]);

  const shrine = (day, it) => {
    const t = tasksById.get(it.taskId);
    if (!t) return null;
    const project = t.projectId ? projectsById.get(t.projectId) : null;
    const chunks = D.getTaskChunks(t.id, plan);
    const isSplit = chunks.length > 1;
    const idx = chunks.findIndex((c) => c.date === day.iso);
    const chunkDone = !!(it.done || t.completed);
    const hoursHere = it.hours != null ? it.hours : D.taskHours(t);
    const color = chunkDone ? "var(--line-dim)" : project?.color || D.DIFFICULTY[t.difficulty]?.tone || "var(--road-lit)";
    return (
      <div key={it.taskId} className="kz-shrine"
        draggable={!chunkDone}
        onDragStart={(e) => { setDragged({ taskId: t.id, fromDate: day.iso }); e.dataTransfer.effectAllowed = "move"; }}
        onDragEnd={() => { setDragged(null); setDragOver(null); }}
        style={{ "--row-lamp": color, opacity: chunkDone ? 0.55 : 1, cursor: chunkDone ? "default" : "grab" }}>
        <Bloom size={15} done={chunkDone}
          onComplete={() => setCompletion(t.id, { done: true, chunkDate: day.iso })}
          onReopen={() => setCompletion(t.id, { done: false, chunkDate: day.iso })} />
        <span className="kz-shrine-title"
          style={{ textDecoration: chunkDone ? "line-through" : "none", color: chunkDone ? "var(--fg-faint)" : "var(--fg)" }}
          onClick={() => setUI({ editingTaskId: t.id, formOpen: true })} title="Click to edit · drag to move">
          {t.title}
          {it.note && <span style={{ color: "var(--fg-faint)", fontStyle: "italic" }}> — {it.note}</span>}
        </span>
        {isSplit && <Seal tone="var(--amber-hot)">{idx + 1}/{chunks.length}</Seal>}
        {project && <span className="kz-label" style={{ color: project.color, flexShrink: 0 }}>{project.title}</span>}
        <span className="kz-label" style={{ flexShrink: 0 }}>{hoursHere}h</span>
        <button className="kz-icon-btn" onClick={() => dismissChunk(t.id, day.iso)} title="Take it off the map (undoable)" aria-label="Unschedule">
          <Icon name="close" size={10} />
        </button>
      </div>
    );
  };

  return (
    <div className="kz-pad">
      <div className="kz-head">
        <div className="kz-ghost" aria-hidden style={{ backgroundImage: ghostBg }}>路</div>
        <div className="kz-label-row" style={{ marginBottom: 11 }}>
          <span className="kz-label kz-label--lit">Week {weekN} · {D.fmtWeekLabel(D.mondayOf(now))}</span>
        </div>
        <div className="kz-greet">
          <h1 className="kz-brush">Where the road goes.</h1>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 9 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <span className="kz-label" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Lamp status={aiStatus} detail={aiDetail} /> {aiStatus === "off" ? "oracle silent" : aiStatus === "busy" ? "consulting…" : "oracle"}
              </span>
              {unscheduled.length > 0 && (
                <div style={{ display: "inline-flex", gap: 2 }}>
                  <button className="kz-go kz-go--sm" disabled={!!busy} onClick={() => runSchedule("")}>
                    {busy === "schedule" ? "Drawing…" : `Place ${unscheduled.length} waypoint${unscheduled.length === 1 ? "" : "s"}`}
                  </button>
                  <button className="kz-go kz-go--sm" disabled={!!busy} onClick={() => setInstructionOpen((v) => !v)}
                    title="Place them with instructions" aria-expanded={instructionOpen}
                    style={{ padding: "5px 8px", background: "var(--amber-deep)", color: "var(--amber-hot)" }}>
                    <Icon name="chevron" size={11} />
                  </button>
                </div>
              )}
              {(plan || []).length > 0 && (
                <button className="kz-btn kz-btn--sm" disabled={!!busy} onClick={runOptimize} title="Redraw the whole route (undoable)">
                  {busy === "optimize" ? "Redrawing…" : "Redraw"}
                </button>
              )}
            </div>
            <div className="kz-count">
              {pending.length} waiting · ~{totalH.toFixed(1)}h{unscheduled.length ? ` · ${unscheduled.length} unplaced` : ""} · {headStats.placed} on the map{headStats.over ? ` · ${headStats.over} gate${headStats.over > 1 ? "s" : ""} overfull` : ""}
            </div>
          </div>
        </div>
      </div>

      {instructionOpen && (
        <div className="kz-card kz-fade-in" style={{ padding: 15, marginBottom: 18 }}>
          <div className="kz-label-row" style={{ marginBottom: 11 }}><span className="kz-label kz-label--lit">Tell the oracle how to walk it</span></div>
          <textarea autoFocus value={instruction} disabled={!!busy} className="kz-field"
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runSchedule(instruction); }
              else if (e.key === "Escape") setInstructionOpen(false);
            }}
            placeholder="e.g. spread it over two weeks · keep the mornings light · finish before Friday"
            style={{ height: 58, marginBottom: 11 }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button className="kz-go kz-go--sm" disabled={!!busy} onClick={() => runSchedule(instruction)}>
              {busy === "schedule" ? "Drawing…" : "Place them"}
            </button>
            <button className="kz-btn kz-btn--sm" disabled={!!busy} onClick={() => { setInstructionOpen(false); setInstruction(""); }}>Never mind</button>
            <span className="kz-label" style={{ marginLeft: "auto" }}>empty = earliest first · <Kbd>{MOD}</Kbd><Kbd>↵</Kbd></span>
          </div>
        </div>
      )}

      {/* capacity — how far you can walk each day */}
      <div style={{ marginBottom: 26 }}>
        <div className="kz-label-row" style={{ marginBottom: 11 }}><span className="kz-label">How far you walk · hours per day</span></div>
        <div className="kz-caps">
          {D.WEEK_ALL.map((day) => {
            const val = caps[day] ?? 0;
            const isOff = val === 0;
            return (
              <div key={day} className={"kz-cap" + (isOff ? " off" : "")}>
                <div className={"kz-cap-dow" + (day === todayDow ? " today" : "")}>{day.slice(0, 3)}</div>
                {editingCap === day ? (
                  <input type="number" min="0" max="10" step="0.5" defaultValue={val} autoFocus
                    onBlur={(e) => { updateCap(day, e.target.value); setEditingCap(null); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { updateCap(day, e.target.value); setEditingCap(null); }
                      if (e.key === "Escape") setEditingCap(null);
                    }}
                    className="kz-cap-input" aria-label={`Hours for ${day}`} />
                ) : (
                  <button onClick={() => setEditingCap(day)} className="kz-btn kz-btn--sm"
                    style={{ width: "100%", justifyContent: "center", color: isOff ? "var(--fg-faint)" : "var(--fg)" }}>
                    {isOff ? "rest" : `${val}h`}
                  </button>
                )}
                <div style={{ marginTop: 8 }}><Meter pct={isOff ? 0 : (val / 8) * 100} tone={capTone(val)} height={4} /></div>
              </div>
            );
          })}
        </div>
        {recurring.length > 0 && (
          <div className="kz-label" style={{ marginTop: 9 }}>
            Daily rituals: {recurring.filter((t) => t.recurring === "daily").map((t) => t.title).join(" · ") || "—"} ({recurringHours.toFixed(1)}h/day held back)
          </div>
        )}
      </div>

      {missed.length > 0 && (
        <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="kz-tape kz-tape--warn">Weathered</span>
          <span style={{ fontSize: 12.5, color: "var(--fg-dim)" }}>{missed.length} waypoint{missed.length > 1 ? "s" : ""} behind you — triage them on</span>
          <button className="kz-link" onClick={() => setUI({ view: "today" })}>Today's Path</button>
        </div>
      )}

      {/* the route */}
      <div style={{ paddingBottom: 22 }}>
        <div className="kz-label-row" style={{ marginBottom: 15 }}><span className="kz-label">The route</span></div>

        {agendaDays.every((d) => d.items.length === 0) && pending.length === 0 ? (
          <EmptyState haiku={"No gates on the map —\nnothing marked, nothing waiting.\nThe road starts blank."}>
            Mark work on Today's Path, then place it here — by hand, or ask the oracle.
          </EmptyState>
        ) : (
          <>
            <div className="kz-route">
              {agendaDays.map((day) => {
                const dayScheduledH = day.items.reduce((acc, it) => {
                  const t = tasksById.get(it.taskId);
                  if (!t || t.recurring !== "none") return acc;
                  return acc + (it.hours != null ? it.hours : D.taskHours(t));
                }, 0);
                const dayH = dayScheduledH + (day.cap > 0 ? recurringHours : 0);
                const loadPct = day.cap > 0 ? Math.min(Math.round((dayH / day.cap) * 100), 100) : 0;
                const over = day.cap > 0 && dayH > day.cap;
                const doneHere = day.items.filter((it) => it.done).length;
                const gateDone = day.items.length > 0 && doneHere === day.items.length;
                const loadColor = over ? "var(--port)" : gateDone ? "var(--sakura)" : "var(--amber)";
                return (
                  <div key={day.iso}
                    className={"kz-gate"
                      + (day.isToday ? " kz-gate--today" : "")
                      + (day.locked ? " kz-gate--locked" : "")
                      + (gateDone ? " kz-gate--full" : "")
                      + (over ? " kz-gate--over" : "")}>
                    <span className="kz-gate-mark" aria-hidden>
                      <svg width="30" height="26" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                        <path d="M2 4h12M3 6h10M4.5 4v9M11.5 4v9M2.5 3.2h11" />
                      </svg>
                    </span>
                    <div className="kz-gate-date">
                      <span className="kz-gate-dow">{day.wd.slice(0, 3)}</span>
                      <span className="kz-gate-num kz-brush">{day.d.getDate()}</span>
                      {day.isToday && <span className="kz-tape" style={{ fontSize: 8 }}>here</span>}
                    </div>
                    <div className="kz-gate-body"
                      onDragOver={(e) => { if (!day.locked) { e.preventDefault(); setDragOver(day.iso); } }}
                      onDragLeave={() => { if (dragOver === day.iso) setDragOver(null); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (day.locked) { notify("That gate is barred"); }
                        else if (dragged) moveChunkDate(dragged.taskId, dragged.fromDate, day.iso);
                        setDragged(null); setDragOver(null);
                      }}
                      style={dragOver === day.iso ? { background: "var(--amber-ground)" } : undefined}>
                      <div className="kz-gate-head">
                        <span className={"kz-gate-load " + (day.cap === 0 ? "kz-gate-load--off" : over ? "kz-gate-load--over" : "kz-gate-load--ok")}>
                          {day.cap === 0 ? "rest" : `${dayH.toFixed(1)}h of ${day.cap}h${over ? " — too far" : ""}`}
                        </span>
                        {over && <span className="kz-tape kz-tape--port" style={{ fontSize: 8 }}>Overfull</span>}
                        {day.items.length > 0 && (
                          <ToriiRow pct={(doneHere / day.items.length) * 100} count={Math.min(5, day.items.length)} size={13}
                            color={gateDone ? "var(--sakura)" : "var(--amber)"} />
                        )}
                        <div style={{ flex: 1, maxWidth: 180 }}>
                          {day.cap > 0 && dayH > 0 && <Meter pct={loadPct} tone={loadColor} height={3} />}
                        </div>
                        <button className="kz-icon-btn" onClick={() => toggleDayLock(day.iso)}
                          title={day.locked ? "Barred — the oracle walks past it. Click to open." : "Bar this gate (the oracle will skip it)"}
                          aria-pressed={day.locked} style={{ color: day.locked ? "var(--channel)" : undefined }}>
                          <Icon name={day.locked ? "lock" : "unlock"} size={11} />
                        </button>
                      </div>
                      {day.items.length === 0
                        ? <div className="kz-label" style={{ padding: "0 12px 10px" }}>{day.cap === 0 ? "the road rests here" : "no shrine at this gate"}</div>
                        : <div>{day.items.map((it) => shrine(day, it))}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
              <button className="kz-btn kz-btn--sm" onClick={() => setHorizon((h) => h + 28)}>Walk four weeks further</button>
            </div>
          </>
        )}
      </div>

      {/* ask the wind — the replan console */}
      {(plan || []).length > 0 && (
        <div style={{ paddingBottom: 40 }}>
          <div className="kz-card" style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 14px", flexWrap: "wrap" }}>
            <span className="kz-tape">Ask the wind</span>
            <input value={replanText} disabled={!!busy} className="kz-bare"
              style={{ flex: 1, minWidth: 180, fontFamily: "var(--t-body)", fontSize: 13 }}
              onChange={(e) => setReplanText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runReplan(); } else if (e.key === "Escape") setReplanText(""); }}
              placeholder={busy === "replan" ? "Redrawing the route…" : "e.g. move the hard climbs to Wednesday, keep Friday gentle…"}
              aria-label="Replan instruction" autoComplete="off" />
            <Lamp status={aiStatus} detail={aiDetail} />
            <button className="kz-go kz-go--sm" disabled={!replanText.trim() || !!busy} onClick={runReplan}>
              {busy === "replan" ? "Asking…" : "Ask"}
            </button>
          </div>
          {!replanText && !busy && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 9, alignItems: "center" }}>
              <span className="kz-label" style={{ marginRight: 2 }}>Try</span>
              {["Spread the client work over two weeks", "Push everything past Friday", "Bring the creative work earlier"].map((ex) => (
                <SealPick key={ex} onClick={() => setReplanText(ex)}>
                  <span style={{ textTransform: "none", letterSpacing: 0 }}>{ex}</span>
                </SealPick>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
