// plan.jsx — THE MAP, Kuromi cut: a stage-select ladder. Each day is
// a stage: date slab on the left (amber when it's today's stage with a
// YOU ARE HERE flag), chunk cards you drag between stages, a lock that
// tells the imp DO NOT TOUCH, and a quiet load readout. The imp takes
// orders at the bottom ("bark an order").

import React, { useMemo, useState } from "react";
import { Icon, EmptyState, Kbd, MOD, SkullBox } from "../components.jsx";
import { GhostSkull } from "../chrome.jsx";
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
  const caps = useStore(s => s.caps);
  const locks = useStore((s) => s.locks);
  const meta = useStore((s) => s.meta);
  const aiStatus = useStore((s) => s.ui.aiStatus);

  const [busy, setBusy] = useState(null);
  const [instruction, setInstruction] = useState("");
  const [replanText, setReplanText] = useState("");
  const [instructionOpen, setInstructionOpen] = useState(false);
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
      applyPlan(next, { snapshotLabel: "Map plotted" });
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
      applyPlan(next, { snapshotLabel: "Map redrawn" });
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
        notify("The imp couldn't map that order onto the plan — nothing was changed");
      } else {
        applyPlan(res.plan, { snapshotLabel: `Obeyed: ${res.applied.length} change${res.applied.length === 1 ? "" : "s"}` });
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

  const todayDow = D.weekdayName(new Date());

  const chunkCard = (day, it) => {
    const t = tasksById.get(it.taskId);
    if (!t) return null;
    const project = t.projectId ? projectsById.get(t.projectId) : null;
    const chunks = D.getTaskChunks(t.id, plan);
    const isSplit = chunks.length > 1;
    const idx = chunks.findIndex((c) => c.date === day.iso);
    const chunkDone = !!(it.done || t.completed);
    const hoursHere = it.hours != null ? it.hours : D.taskHours(t);
    return (
      <span
        key={it.taskId}
        className={"k-chunk" + (chunkDone ? " is-done" : "")}
        draggable={!chunkDone}
        onDragStart={(e) => { setDragged({ taskId: t.id, fromDate: day.iso }); e.dataTransfer.effectAllowed = "move"; }}
        onDragEnd={() => { setDragged(null); setDragOver(null); }}
        style={{ borderColor: chunkDone ? "var(--line)" : project?.color || "var(--line-hi)" }}
        title="Drag to another stage · click the name to edit"
      >
        <SkullBox
          done={chunkDone}
          onClick={() => setCompletion(t.id, { done: !chunkDone, chunkDate: day.iso })}
          title={chunkDone ? "reopen this part" : "pull off this part"}
        />
        <span
          className="k-chunk-title"
          onClick={() => setUI({ editingTaskId: t.id, formOpen: true })}
          style={{ cursor: "pointer" }}
        >
          {t.title}
        </span>
        {isSplit && <span className="k-chunk-split">{idx + 1}/{chunks.length}</span>}
        {it.note && <span className="k-faint" style={{ fontStyle: "italic", fontSize: 12 }}>{it.note}</span>}
        <span className="k-chunk-hrs">{hoursHere}H</span>
        <button className="k-mini-btn" style={{ width: 19, height: 19 }} onClick={() => dismissChunk(t.id, day.iso)} title="Unschedule (undoable)" aria-label="Unschedule">
          <Icon name="x" size={8} />
        </button>
      </span>
    );
  };

  return (
    <div className="k-wrap">
      <div className="k-pagehead k-ghostwrap">
        <div className="k-ghost"><GhostSkull size={104} /></div>
        <div className="k-title">THE MAP <span className="k-accent">— pick your stages</span></div>
        <div className="k-sub">
          {pending.length} schemes loose · {totalH.toFixed(1)}h of mischief
          {unscheduled.length ? ` · ${unscheduled.length} not plotted` : ""} · {headStats.placed} placed
          {headStats.over ? <span className="k-pink"> · {headStats.over} stage{headStats.over > 1 ? "s" : ""} overloaded</span> : ""}
        </div>
        <div className="k-rowline k-mt" style={{ flexWrap: "wrap" }}>
          {unscheduled.length > 0 && (
            <button className="k-btn is-primary" disabled={!!busy} onClick={() => runSchedule("")}>
              {busy === "schedule" ? "THE IMP IS PLOTTING…" : `AUTO-PLOT ${unscheduled.length} SCHEME${unscheduled.length > 1 ? "S" : ""}`}
            </button>
          )}
          {unscheduled.length > 0 && (
            <button className="k-btn" disabled={!!busy} onClick={() => setInstructionOpen((v) => !v)} aria-expanded={instructionOpen}>
              WITH CONDITIONS…
            </button>
          )}
          {(plan || []).length > 0 && (
            <button className="k-btn" disabled={!!busy} onClick={runOptimize} title="Redraw the whole map from scratch (undoable)">
              {busy === "optimize" ? "REDRAWING…" : "REDRAW THE MAP"}
            </button>
          )}
          <span className="k-mono-sm k-faint">
            {aiStatus === "off" ? "imp offline — plotting by hand works fine" : aiStatus === "busy" ? "imp busy…" : "imp ready"}
          </span>
        </div>
      </div>

      {instructionOpen && (
        <div className="k-plate is-hi k-plate-pad k-mb">
          <div className="k-eyebrow">PLOT WITH CONDITIONS</div>
          <textarea
            autoFocus value={instruction} disabled={!!busy} className="k-textarea"
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runSchedule(instruction); }
              else if (e.key === "Escape") setInstructionOpen(false);
            }}
            placeholder="e.g. spread it over 2 weeks · nothing evil on weekends · finish before Friday"
            style={{ height: 56, marginBottom: 10 }}
          />
          <div className="k-rowline">
            <button className="k-btn is-primary" disabled={!!busy} onClick={() => runSchedule(instruction)}>
              {busy === "schedule" ? "PLOTTING…" : "PLOT IT"}
            </button>
            <button className="k-btn" disabled={!!busy} onClick={() => { setInstructionOpen(false); setInstruction(""); }}>NEVER MIND</button>
            <span className="k-spacer" />
            <span className="k-mono-sm k-faint">blank = earliest-first · <Kbd>{MOD}+↵</Kbd></span>
          </div>
        </div>
      )}

      {/* mischief budget */}
      <div className="k-mb">
        <div className="k-eyebrow">DAILY MISCHIEF BUDGET — HOURS PER DAY</div>
        <div className="k-capgrid">
          {D.WEEK_ALL.map((day) => {
            const val = caps[day] ?? 0;
            const isOff = val === 0;
            return (
              <div key={day} className="k-capcell" style={day === todayDow ? { borderColor: "var(--amber)" } : {}}>
                <div className="k-dow">{day.slice(0, 3)}</div>
                <input
                  type="number" min="0" max="10" step="0.5" value={val}
                  onChange={(e) => updateCap(day, e.target.value)}
                  title={`${day}: 0–10h`}
                  style={isOff ? { color: "var(--fg-faint)" } : {}}
                />
                <div className="k-mono-sm k-faint">{isOff ? "rest" : "hrs"}</div>
              </div>
            );
          })}
        </div>
        {recurring.length > 0 && (
          <div className="k-mono-sm k-faint" style={{ marginTop: 8 }}>
            DAILY RITUALS: {recurring.filter((t) => t.recurring === "daily").map((t) => t.title.toUpperCase()).join(" · ") || "—"} ({recurringHours.toFixed(1)}H/DAY RESERVED)
          </div>
        )}
      </div>

      {missed.length > 0 && (
        <div className="k-plate k-plate-pad k-rowline k-mb" style={{ borderColor: "var(--warn)" }}>
          <span className="k-eyebrow" style={{ color: "var(--warn)", marginBottom: 0 }}>BUSTED</span>
          <span className="k-dim k-sm" style={{ flex: 1 }}>{missed.length} leftover{missed.length > 1 ? "s" : ""} from past stages — deal with them on</span>
          <button className="k-btn is-sm" onClick={() => setUI({ view: "today" })}>TODAY</button>
        </div>
      )}

      {/* the stage ladder */}
      <div className="k-eyebrow">STAGE SELECT</div>
      {agendaDays.every((d) => d.items.length === 0) && pending.length === 0 ? (
        <EmptyState
          title="NO STAGES PLOTTED"
          sub="Whisper schemes on Today first, then plot them here — drag by hand, or make the imp do it."
        />
      ) : (
        <>
          <div className="k-ladder">
            {agendaDays.map((day) => {
              const dayScheduledH = day.items.reduce((s2, it) => {
                const t = tasksById.get(it.taskId);
                if (!t || t.recurring !== "none") return s2;
                return s2 + (it.hours != null ? it.hours : D.taskHours(t));
              }, 0);
              const dayH = dayScheduledH + (day.cap > 0 ? recurringHours : 0);
              const over = day.cap > 0 && dayH > day.cap;
              return (
                <div key={day.iso} className={"k-stage-row" + (day.isToday ? " is-today" : "") + (day.locked ? " is-locked" : "")}>
                  <div className="k-stage-date">
                    <span className="k-dow">{day.wd.slice(0, 3)}</span>
                    <span className="k-dmy">{D.parseIsoDate(day.iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                  </div>
                  <div
                    className={"k-stage-day" + (dragOver === day.iso ? " is-dragover" : "")}
                    onDragOver={(e) => { if (!day.locked) { e.preventDefault(); setDragOver(day.iso); } }}
                    onDragLeave={() => { if (dragOver === day.iso) setDragOver(null); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (day.locked) { notify("That stage says DO NOT TOUCH"); }
                      else if (dragged) moveChunkDate(dragged.taskId, dragged.fromDate, day.iso);
                      setDragged(null); setDragOver(null);
                    }}
                  >
                    {day.items.length === 0 ? (
                      <div className="k-mono-sm k-faint" style={{ padding: "4px 2px" }}>
                        {day.cap === 0 ? "REST — even villains nap." : "empty stage"}
                      </div>
                    ) : (
                      day.items.map((it) => chunkCard(day, it))
                    )}
                  </div>
                  <div className="k-stage-side">
                    {day.isToday && <span className="k-you-flag">YOU ARE HERE</span>}
                    {day.cap === 0 ? (
                      <span className="k-faint">OFF</span>
                    ) : (
                      <span className={over ? "k-pink" : "k-faint"}>{dayH.toFixed(1)}/{day.cap}H{over ? " OVER" : ""}</span>
                    )}
                    <button
                      className="k-mini-btn"
                      onClick={() => toggleDayLock(day.iso)}
                      title={day.locked ? "DO NOT TOUCH is ON — the imp skips this stage. Click to unlock." : "Mark DO NOT TOUCH (the imp skips it)"}
                      aria-pressed={day.locked}
                      style={day.locked ? { color: "var(--amber-hot)", borderColor: "var(--amber)" } : {}}
                    >
                      <Icon name={day.locked ? "lock" : "unlock"} size={10} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="k-rowline" style={{ justifyContent: "center", marginTop: 12 }}>
            <button className="k-btn is-sm" onClick={() => setHorizon((h) => h + 28)}>REVEAL 4 MORE WEEKS</button>
          </div>
        </>
      )}

      {/* bark an order */}
      {(plan || []).length > 0 && (
        <div className="k-mt" style={{ paddingBottom: 40 }}>
          <div className="k-eyebrow is-violet">BARK AN ORDER AT THE IMP</div>
          <div className="k-slab">
            <div className="k-slab-inputrow">
              <span className="k-slab-caret">▸</span>
              <input
                value={replanText} disabled={!!busy}
                onChange={(e) => setReplanText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runReplan(); } else if (e.key === "Escape") setReplanText(""); }}
                placeholder={busy === "replan" ? "the imp is redrawing…" : "e.g. move everything hard to Wednesday, keep Friday light…"}
                aria-label="Replan order" autoComplete="off"
              />
              <button className="k-btn is-primary" disabled={!replanText.trim() || !!busy} onClick={runReplan}>
                {busy === "replan" ? "OBEYING…" : "OBEY ME"}
              </button>
            </div>
          </div>
          {!replanText && !busy && (
            <div className="k-rowline k-mt" style={{ flexWrap: "wrap", gap: 5 }}>
              <span className="k-mono-sm k-faint">try:</span>
              {["Spread the client work over 2 weeks", "Push everything past Friday", "Move design tasks earlier"].map((ex) => (
                <button key={ex} className="k-chip" onClick={() => setReplanText(ex)}>{ex}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
