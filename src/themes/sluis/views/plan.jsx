// plan.jsx — Het Kanaal, Sluis cut: a stepped profile of pounds, one
// per day, water fill = load ÷ capacity, lock gates in the gaps. ONE
// detail tray (de bak) for the selected day holds every chunk action —
// complete, edit, hours/note, unschedule, drag out. The Sluismeester
// panel carries scheduling, rebuild and the replan console. All state,
// handlers and data flow lifted from the core contract (Nightwatch plan).

import React, { useMemo, useState } from "react";
import { Icon, Kbd, Lamp, Meter, Chip, CompleteButton, Eyebrow, EmptyState, MOD } from "../components.jsx";
import * as D from "../../../core/domain.js";
import {
  useStore, setUI, setCompletion, setCaps, toggleDayLock,
  applyPlan, moveChunkDate, updateChunk, notify, dismissChunk,
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
  const [selIso, setSelIso] = useState(null); // null = effective today
  const [chunkEdits, setChunkEdits] = useState({});

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

  // Load of one day: scheduled chunk hours + recurring reserve (only when
  // the day is open). Same math as the reference per-day meter.
  const dayLoad = (day) => {
    const sched = day.items.reduce((s2, it) => {
      const t = tasksById.get(it.taskId);
      if (!t || t.recurring !== "none") return s2;
      return s2 + (it.hours != null ? it.hours : D.taskHours(t));
    }, 0);
    const dayH = sched + (day.cap > 0 ? recurringHours : 0);
    const loadPct = day.cap > 0 ? Math.min(Math.round((dayH / day.cap) * 100), 100) : 0;
    const over = day.cap > 0 && dayH > day.cap;
    return { dayH, loadPct, over };
  };

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

  // The selected day — default effective today; falls back to the first
  // agenda day if the selection scrolls out of the agenda.
  const selDay = agendaDays.find((d) => d.iso === (selIso || todayIso)) || agendaDays[0] || null;

  /* ── chunk hours/note editing — the reference chunk-editor commit
        semantics: blur commits, Enter blurs, quarter-hour rounding,
        empty hours clears the override, empty note clears the note. */
  const editKey = (taskId) => (selDay ? `${selDay.iso}:${taskId}` : taskId);
  const chunkVal = (taskId, field, fallback) => {
    const cell = chunkEdits[editKey(taskId)];
    if (cell && Object.prototype.hasOwnProperty.call(cell, field)) return cell[field];
    return fallback;
  };
  const setChunkVal = (taskId, field, value) =>
    setChunkEdits((p) => ({ ...p, [editKey(taskId)]: { ...(p[editKey(taskId)] || {}), [field]: value } }));
  const commitChunkVal = (taskId, field) => {
    const k = editKey(taskId);
    const cell = chunkEdits[k];
    if (!cell || !Object.prototype.hasOwnProperty.call(cell, field) || !selDay) return;
    const v = cell[field];
    if (field === "hours") {
      const num = parseFloat(v);
      if (Number.isFinite(num) && num > 0) updateChunk(taskId, selDay.iso, { hours: Math.round(num * 4) / 4 });
      else if (v === "") updateChunk(taskId, selDay.iso, { hours: null });
    } else {
      updateChunk(taskId, selDay.iso, { note: typeof v === "string" ? v.trim() : null });
    }
    setChunkEdits((p) => {
      const next = { ...p };
      const cc = { ...next[k] };
      delete cc[field];
      if (Object.keys(cc).length === 0) delete next[k]; else next[k] = cc;
      return next;
    });
  };

  const capacityInput = (day, val, style) => (
    <input type="number" min="0" max="10" step="0.5" defaultValue={val} autoFocus
      onBlur={(e) => { updateCap(day, e.target.value); setEditingCap(null); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { updateCap(day, e.target.value); setEditingCap(null); }
        if (e.key === "Escape") setEditingCap(null);
      }}
      className="s-field" style={{ padding: "3px 6px", fontSize: 12, ...style }} />
  );

  const chunkCard = (day, it) => {
    const t = tasksById.get(it.taskId);
    if (!t) return null;
    const project = t.projectId ? projectsById.get(t.projectId) : null;
    const chunks = D.getTaskChunks(t.id, plan);
    const isSplit = chunks.length > 1;
    const idx = chunks.findIndex((c) => c.date === day.iso);
    const chunkDone = !!(it.done || t.completed);
    const color = chunkDone ? "var(--line-strong)" : project?.color || D.DIFFICULTY[t.difficulty]?.tone || "var(--channel)";
    return (
      <div key={it.taskId} className="s-chunk"
        style={{ boxShadow: `inset 3px 0 0 ${color}`, opacity: chunkDone ? 0.55 : 1 }}>
        <span
          draggable={!chunkDone}
          onDragStart={(e) => { setDragged({ taskId: t.id, fromDate: day.iso }); e.dataTransfer.effectAllowed = "move"; }}
          onDragEnd={() => { setDragged(null); setDragOver(null); }}
          title={chunkDone ? "Locked through" : "Drag onto a pound to move"}
          style={{ cursor: chunkDone ? "default" : "grab", color: "var(--fg-faint)", display: "inline-flex", alignItems: "center", flexShrink: 0, touchAction: "none" }}>
          <Icon name="drag" size={12} />
        </span>
        <CompleteButton size={20} done={chunkDone}
          onComplete={() => setCompletion(t.id, { done: true, chunkDate: day.iso })}
          onReopen={() => setCompletion(t.id, { done: false, chunkDate: day.iso })} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span onClick={() => setUI({ editingTaskId: t.id, formOpen: true })} title="Click to edit"
              style={{ fontWeight: 600, fontSize: 13, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: chunkDone ? "line-through" : "none", color: chunkDone ? "var(--fg-faint)" : "var(--fg)" }}>
              {t.title}
            </span>
            {isSplit && <Chip tone="var(--amber-deep)" style={{ flexShrink: 0 }}>{idx + 1}/{chunks.length}</Chip>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
            {project && <span className="s-num" style={{ fontSize: 9, color: project.color, flexShrink: 0 }}>{project.title.toUpperCase()}</span>}
            <input type="text" placeholder="What happens this day" disabled={chunkDone}
              value={chunkVal(t.id, "note", it.note || "")}
              onChange={(e) => setChunkVal(t.id, "note", e.target.value)}
              onBlur={() => commitChunkVal(t.id, "note")}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
              aria-label="Chunk note"
              style={{ flex: 1, minWidth: 110, border: "none", borderBottom: "1px dashed var(--line)", background: "none", outline: "none", fontSize: 11.5, fontStyle: "italic", color: "var(--fg-dim)", padding: "1px 0" }} />
          </div>
        </div>
        <input type="number" min="0.25" max="24" step="0.25" placeholder="hrs" disabled={chunkDone}
          value={chunkVal(t.id, "hours", it.hours ?? "")}
          onChange={(e) => setChunkVal(t.id, "hours", e.target.value)}
          onBlur={() => commitChunkVal(t.id, "hours")}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
          aria-label="Chunk hours" title="Hours for this chunk"
          className="s-field" style={{ width: 56, padding: "3px 5px", fontSize: 11, textAlign: "center", flexShrink: 0 }} />
        <input type="date" value={day.iso} disabled={chunkDone}
          onChange={(e) => { const v = e.target.value; if (v && v !== day.iso) moveChunkDate(t.id, day.iso, v); }}
          aria-label="Move chunk to date" title="Move to another day"
          className="s-field" style={{ width: 126, padding: "3px 5px", fontSize: 11, flexShrink: 0 }} />
        <button className="s-icon-btn" onClick={() => dismissChunk(t.id, day.iso)} title="Unschedule (undoable)" aria-label="Unschedule" style={{ flexShrink: 0 }}>
          <Icon name="close" size={10} />
        </button>
      </div>
    );
  };

  const allEmpty = agendaDays.every((d) => d.items.length === 0) && pending.length === 0;

  return (
    <div>
      {/* ── header ── */}
      <div style={{ marginBottom: 20 }}>
        <Eyebrow lit>Week {weekN} · {D.fmtWeekLabel(D.mondayOf(now))}</Eyebrow>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <h1 className="s-display" style={{ fontSize: 30, margin: 0 }}>Het Kanaal</h1>
          <div className="s-num" style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: ".06em", paddingBottom: 4 }}>
            {pending.length} PENDING · ~{totalH.toFixed(1)}H{unscheduled.length ? ` · ${unscheduled.length} UNSCHEDULED` : ""} · {headStats.placed} PLACED{headStats.over ? ` · ${headStats.over} DAY${headStats.over > 1 ? "S" : ""} OVER` : ""}{recurring.length ? ` · RESERVE ${recurringHours.toFixed(1)}H/DAY` : ""}
          </div>
        </div>
      </div>

      {/* ── sluisschalen: week capacity ── */}
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>Sluisschalen · capacity — hours per day</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(84px, 1fr))", gap: 8 }}>
          {D.WEEK_ALL.map((day) => {
            const val = caps[day] ?? 0;
            const isOff = val === 0;
            const isTodayDow = day === todayDow;
            return (
              <div key={day} style={{
                background: "var(--plate)", border: "1px solid", borderRadius: "var(--r-sm)",
                borderColor: isTodayDow ? "var(--amber)" : "var(--line)",
                boxShadow: isTodayDow ? "0 0 0 3px var(--amber-ground)" : "var(--sh-1)",
                padding: "8px 10px", opacity: isOff ? 0.6 : 1,
              }}>
                <div className="s-stencil" style={{ color: isTodayDow ? "var(--amber-hot)" : undefined, marginBottom: 6 }}>
                  {day.slice(0, 3)}
                </div>
                {editingCap === day ? (
                  capacityInput(day, val, { width: "100%", marginBottom: 6 })
                ) : (
                  <button onClick={() => setEditingCap(day)} className="s-btn s-btn--ghost s-btn--sm"
                    title="Edit capacity (0–10h)"
                    style={{ width: "100%", marginBottom: 6, color: isOff ? "var(--fg-faint)" : "var(--fg)" }}>
                    {isOff ? "off" : `${val}h`}
                  </button>
                )}
                <Meter pct={isOff ? 0 : (val / 8) * 100} tone={capTone(val)} height={4} />
              </div>
            );
          })}
        </div>
        {recurring.length > 0 && (
          <div className="s-num" style={{ margin: "8px 0 0", fontSize: 9.5, color: "var(--fg-faint)" }}>
            RECURRING EVERY DAY: {recurring.filter((t) => t.recurring === "daily").map((t) => t.title.toUpperCase()).join(" · ") || "—"} ({recurringHours.toFixed(1)}H/DAY RESERVED)
          </div>
        )}
      </div>

      {/* ── het kanaal ── */}
      <Eyebrow right={<span className="s-stencil" style={{ fontSize: 8.5 }}>click selects · drag chunks onto a pound</span>}>
        Het Kanaal
      </Eyebrow>

      {allEmpty ? (
        <EmptyState caption="stil water">
          <div className="s-display" style={{ fontSize: 17, color: "var(--fg)", marginBottom: 8 }}>Het kanaal is leeg.</div>
          <div>Capture work in de Kolk, then chart it here — by hand (drag) or via de Sluismeester.</div>
        </EmptyState>
      ) : (
        <>
          <div className="s-canal">
            {agendaDays.map((day) => {
              const { dayH, loadPct, over } = dayLoad(day);
              const isSel = selDay && day.iso === selDay.iso;
              return (
                <div key={day.iso} style={{ position: "relative", flexShrink: 0, display: "flex" }}>
                  <div
                    className={"s-pound"
                      + (day.isToday ? " s-pound--today" : "")
                      + (day.locked ? " s-pound--locked" : "")
                      + (isSel ? " s-pound--sel" : "")
                      + (over ? " s-pound--over" : "")
                      + (day.cap === 0 ? " s-pound--off" : "")}
                    role="button" tabIndex={0} aria-pressed={!!isSel}
                    title={`${D.fmtIsoShort(day.iso)} — ${day.locked ? "locked; " : ""}click to open in de bak`}
                    onClick={() => setSelIso(day.iso)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelIso(day.iso); } }}
                    onDragOver={(e) => { if (!day.locked) { e.preventDefault(); setDragOver(day.iso); } }}
                    onDragLeave={() => { if (dragOver === day.iso) setDragOver(null); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (day.locked) { notify("That day is locked"); }
                      else if (dragged) moveChunkDate(dragged.taskId, dragged.fromDate, day.iso);
                      setDragged(null); setDragOver(null);
                    }}
                    style={dragOver === day.iso ? { background: "var(--amber-ground)" } : undefined}>
                    <div className="s-pound-water" style={{ height: loadPct + "%" }} />
                    <div className="s-pound-label">{day.wd.slice(0, 3)} {day.d.getDate()}</div>
                    <div className="s-pound-cap" style={loadPct < 18 ? { color: "var(--fg-dim)", textShadow: "none" } : undefined}>
                      {day.cap === 0 ? "RUST" : `${dayH.toFixed(1)}/${day.cap}`}
                    </div>
                  </div>
                  <div className="s-pound-gate" style={{ right: 0, color: day.locked ? "var(--port)" : undefined }}>
                    <Icon name={day.locked ? "lock" : "gate"} size={10} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
            <button className="s-btn s-btn--ghost s-btn--sm" onClick={() => setHorizon((h) => h + 28)}>+4 weken</button>
          </div>

          {/* ── de bak: the selected day ── */}
          {selDay && (() => {
            const { dayH, loadPct, over } = dayLoad(selDay);
            const loadTone = over ? "var(--port)" : dayH === selDay.cap && selDay.cap > 0 ? "var(--starboard)" : "var(--water)";
            return (
              <div className="s-tray">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 190 }}>
                    <div className="s-stencil" style={{ marginBottom: 4 }}>De bak</div>
                    <div className="s-display" style={{ fontSize: 20, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {D.fmtIsoShort(selDay.iso)}
                      {selDay.isToday && <Chip tone="var(--amber-deep)">VANDAAG</Chip>}
                      {selDay.locked && <Chip tone="var(--port)">LOCKED</Chip>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="s-stencil">Schaal</span>
                    {editingCap === selDay.wd ? (
                      capacityInput(selDay.wd, selDay.cap, { width: 64 })
                    ) : (
                      <button className="s-btn s-btn--ghost s-btn--sm" onClick={() => setEditingCap(selDay.wd)}
                        title={`Edit ${selDay.wd} capacity (0–10h)`}>
                        {selDay.cap === 0 ? "off" : `${selDay.cap}h`}
                      </button>
                    )}
                  </div>
                  <button className={"s-btn s-btn--sm " + (selDay.locked ? "s-btn--amber" : "s-btn--ghost")}
                    onClick={() => toggleDayLock(selDay.iso)} aria-pressed={selDay.locked}
                    title={selDay.locked ? "Locked — planner skips it. Click to unlock." : "Lock day (planner will skip it)"}>
                    <Icon name={selDay.locked ? "lock" : "unlock"} size={11} />
                    {selDay.locked ? "Locked" : "Lock"}
                  </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span className="s-num" style={{ fontSize: 10.5, whiteSpace: "nowrap", color: over ? "var(--port)" : "var(--fg-dim)" }}>
                    {selDay.cap === 0 ? "DE SLUIS IS DICHT" : `${dayH.toFixed(1)}H OF ${selDay.cap}H${over ? " — OVER" : ""}`}
                  </span>
                  <div style={{ flex: 1 }}>
                    <Meter pct={selDay.cap > 0 ? loadPct : 0} tone={loadTone} height={5} />
                  </div>
                  {selDay.cap > 0 && (
                    <span className="s-num" style={{ fontSize: 10.5, color: "var(--fg-faint)", flexShrink: 0 }}>
                      {Math.round((dayH / selDay.cap) * 100)}%
                    </span>
                  )}
                </div>

                {selDay.items.length === 0 ? (
                  <div style={{ padding: "12px 4px 6px", textAlign: "center", color: "var(--fg-faint)", fontSize: 12.5 }}>
                    {selDay.cap === 0 ? "RUST — de sluis is dicht" : "rustig water"}
                  </div>
                ) : (
                  <div>{selDay.items.map((it) => chunkCard(selDay, it))}</div>
                )}
              </div>
            );
          })()}
        </>
      )}

      {/* ── sluismeester: AI scheduling ── */}
      <div className="s-rail-card" style={{ marginTop: 18 }}>
        <Eyebrow lit right={
          <span className="s-num" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9.5, color: "var(--fg-faint)" }}>
            <Lamp status={aiStatus} detail={aiDetail} /> {aiStatus === "off" ? "AI OFF" : aiStatus === "busy" ? "THINKING…" : "AI"}
          </span>
        }>
          Sluismeester
        </Eyebrow>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {unscheduled.length > 0 && (
            <>
              <button className="s-btn s-btn--sm" disabled={!!busy} onClick={() => runSchedule("")}>
                {busy === "schedule" ? "Scheduling…" : `Schedule ${unscheduled.length} pending`}
              </button>
              <button className="s-btn s-btn--ghost s-btn--sm" disabled={!!busy} onClick={() => setInstructionOpen((v) => !v)}
                title="Schedule with custom instructions" aria-expanded={instructionOpen}>
                <Icon name="chevron" size={11} />
              </button>
            </>
          )}
          {(plan || []).length > 0 && (
            <button className="s-btn s-btn--ghost s-btn--sm" disabled={!!busy} onClick={runOptimize}
              title="Rebuild the whole plan from scratch (undoable)">
              {busy === "optimize" ? "Rebuilding…" : "Rebuild"}
            </button>
          )}
          {unscheduled.length === 0 && (plan || []).length === 0 && (
            <span style={{ fontSize: 12, color: "var(--fg-faint)" }}>
              Niets in te plannen — meld eerst vaartuigen aan in de Kolk.
            </span>
          )}
        </div>
        {instructionOpen && (
          <div style={{ marginTop: 12 }}>
            <textarea autoFocus value={instruction} disabled={!!busy} className="s-field"
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runSchedule(instruction); }
                else if (e.key === "Escape") setInstructionOpen(false);
              }}
              placeholder="e.g. spread over the next 2 weeks · alternate IGP with other work · finish by Friday"
              style={{ height: 56, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="s-btn s-btn--sm" disabled={!!busy} onClick={() => runSchedule(instruction)}>
                {busy === "schedule" ? "Scheduling…" : "Schedule"}
              </button>
              <button className="s-btn s-btn--ghost s-btn--sm" disabled={!!busy} onClick={() => { setInstructionOpen(false); setInstruction(""); }}>Cancel</button>
              <span className="s-num" style={{ fontSize: 9.5, color: "var(--fg-faint)", marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}>
                EMPTY = EARLIEST-FIRST · <Kbd>{MOD}</Kbd><Kbd>↵</Kbd>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── herplannen: the replan console ── */}
      {(plan || []).length > 0 && (
        <div className="s-rail-card" style={{ marginTop: 14 }}>
          <Eyebrow right={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Lamp status={aiStatus} detail={aiDetail} />
              <span className="s-stencil">AI</span>
            </span>
          }>
            Herplannen — vraag de sluismeester
          </Eyebrow>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input value={replanText} disabled={!!busy} className="s-field" style={{ flex: 1, minWidth: 0 }}
              onChange={(e) => setReplanText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runReplan(); } else if (e.key === "Escape") setReplanText(""); }}
              placeholder={busy === "replan" ? "Re-charting…" : "e.g. move everything hard to Wednesday, keep Friday light…"}
              aria-label="Replan instruction" autoComplete="off" />
            <button className="s-btn s-btn--sm" disabled={!replanText.trim() || !!busy} onClick={runReplan} style={{ flexShrink: 0 }}>
              <Icon name="send" size={11} /> {busy === "replan" ? "Transmitting…" : "Transmit"}
            </button>
          </div>
          {!replanText && !busy && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
              <span className="s-stencil" style={{ marginRight: 2 }}>Try</span>
              {["Spread the client work over 2 weeks", "Push everything past Friday", "Move design tasks earlier"].map((ex) => (
                <button key={ex} onClick={() => setReplanText(ex)} className="s-chip s-chip--pick"
                  style={{ textTransform: "none", letterSpacing: 0, fontSize: 10.5 }}>
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── drijfwerk ── */}
      {missed.length > 0 && (
        <div className="s-rail-card" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, borderColor: "var(--amber)" }}>
          <Chip tone="var(--amber-deep)">DRIJFWERK</Chip>
          <span style={{ fontSize: 12, color: "var(--fg-dim)" }}>
            {missed.length} item{missed.length > 1 ? "s" : ""} from past days — triage in
          </span>
          <button onClick={() => setUI({ view: "today" })}
            style={{ color: "var(--water)", fontWeight: 600, fontSize: 12, textDecoration: "underline" }}>
            de Kolk
          </button>
        </div>
      )}

      <div style={{ height: 40 }} />
    </div>
  );
}
