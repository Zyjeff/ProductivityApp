// Verdant presentation. State and mutations use the shared core contract.
import React, { useEffect, useMemo, useState } from "react";
import { Icon, EmptyState, Lamp, Kbd, MOD, Stamp, HLight, Meter } from "../components.jsx";
import { registerActiveList } from "../../../core/keys.js";
import { Heading, Glyph, Segments, PixelText, Sprite, RuneRule } from "../art.jsx";
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
  const [weekIndex, setWeekIndex] = useState(0);

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

  const weeks = [...new Set(agendaDays.map(day=>D.isoDate(D.mondayOf(day.d))))];
  const activeWeekIndex = Math.min(weekIndex, Math.max(0,weeks.length-1));
  const activeWeek = weeks[activeWeekIndex];
  const cursor = useStore(s=>s.ui.cursor);
  const kbRows = useMemo(()=>agendaDays.filter(day=>D.isoDate(D.mondayOf(day.d))===activeWeek).flatMap(day=>day.items.map(it=>({taskId:it.taskId,chunkDate:day.iso,done:!!(it.done||tasksById.get(it.taskId)?.completed)}))),[agendaDays,tasksById,activeWeek]);
  useEffect(()=>{registerActiveList('plan',kbRows);return()=>registerActiveList('plan',[]);},[kbRows]);
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
  const todayDow = D.weekdayName(D.parseIsoDate(todayIso));


  const [capacityOpen,setCapacityOpen]=useState(false),[aiOpen,setAiOpen]=useState(false);
  
  return <div className="v-almanac">
    <Heading eyebrow="TIME, GIVEN INTENTION" title={<PixelText size={32}>THE ATLAS</PixelText>} subtitle={pending.length+' pending · '+totalH.toFixed(1)+'h estimated · '+unscheduled.length+' unscheduled · '+recurringHours.toFixed(1)+'h daily reserve'}>
      <button className="bezel" aria-expanded={capacityOpen} onClick={()=>setCapacityOpen(v=>!v)}>Weekly capacity <Icon name="chevron"/></button>
      <button className="bezel" aria-expanded={aiOpen} onClick={()=>setAiOpen(v=>!v)}><Glyph size={15}/> AI arrangement <Lamp status={aiStatus} detail={aiDetail}/></button>
      <button className="switch" onClick={()=>setUI({formOpen:true,editingTaskId:null})}><Icon name="plus"/> New task</button>
    </Heading>
    {capacityOpen&&<section className="v-panel">      {/* capacity */}
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
                  <button onClick={() => setEditingCap(day)} aria-label={day+" capacity"} className="bezel bezel--sm cap-btn"
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

</section>}
    {aiOpen&&<section className="v-panel v-ai-workbench"><div className="section-head"><span className="v-eyebrow">ARRANGE WITH INTENTION</span><span>AI {aiStatus==='off'?'off':aiStatus==='busy'?'working':'standby'}</span></div><div className="v-button-row"><button className="switch" disabled={!!busy||!pending.length} onClick={()=>runSchedule('')}>{busy==='schedule'?'Scheduling…':'Schedule '+unscheduled.length+' pending'}</button><button className="bezel" disabled={!!busy} onClick={()=>setInstructionOpen(v=>!v)}>Custom instructions</button><button className="bezel" disabled={!!busy||!plan.length} onClick={runOptimize}>{busy==='optimize'?'Rebuilding…':'Rebuild'}</button></div>      {instructionOpen && (
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

      {/* radio console */}
      {(plan || []).length > 0 && (
        <div style={{ paddingRight: 34, paddingBottom: 56 }}>
          <div className="radio-console">
            <span className="w-tape">Ask the workspace</span>
            <input value={replanText} disabled={!!busy}
              onChange={(e) => setReplanText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runReplan(); } else if (e.key === "Escape") setReplanText(""); }}
              placeholder={busy === "replan" ? "Replanning…" : "e.g. move everything hard to Wednesday, keep Friday light…"}
              aria-label="Replan instruction" autoComplete="off" />
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Lamp status={aiStatus} detail={aiDetail} />
              <span className="w-stencil" style={{ fontSize: 8.5 }}>AI</span>
            </span>
            <button className="switch switch--sm" disabled={!replanText.trim() || !!busy} onClick={runReplan}>
              {busy === "replan" ? "Arranging…" : "Arrange"}
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
</section>}
    {missed.length>0&&<div className="v-notice"><span>{missed.length} overdue chunks need a new home.</span><button className="link" onClick={()=>setUI({view:'today'})}>Review in Sanctum ↗</button></div>}
    <div className="v-almanac-intro"><span><Glyph size={15}/> {D.fmtWeekLabel(D.mondayOf(D.parseIsoDate(todayIso)))}</span><span>DRAG TO RESCHEDULE · LOCK TO PROTECT A DAY</span></div>
    <div className="e-week-index" aria-label="Select week">{weeks.map((w,i)=><button key={w} className={i===activeWeekIndex?'is-selected':''} aria-pressed={i===activeWeekIndex} onClick={()=>{setWeekIndex(i);setUI({cursor:null});}}><Glyph seed={i} size={20}/><span>{i===0?'This week':D.fmtWeekLabel(D.parseIsoDate(w))}</span><small>{String(i+1).padStart(2,'0')}</small></button>)}</div>{weeks.filter((_,i)=>i===activeWeekIndex).map((week,wi)=><section className="v-week" key={week}><div className="v-week-label">{activeWeekIndex===0?'This week':D.fmtWeekLabel(D.parseIsoDate(week))}<span>{String(activeWeekIndex+1).padStart(2,'0')}</span></div><div className="v-day-grid" style={{"--day-count":agendaDays.filter(day=>D.isoDate(D.mondayOf(day.d))===week).length}}>{agendaDays.filter(day=>D.isoDate(D.mondayOf(day.d))===week).map(day=>{
      const dayH=day.items.reduce((sum,it)=>{const t=tasksById.get(it.taskId);return sum+(t&&t.recurring==='none'?(it.hours??D.taskHours(t)):0);},0)+(day.cap>0?recurringHours:0);
      const over=dayH>day.cap;const pct=day.cap>0?dayH/day.cap*100:0;
      return <article key={day.iso} data-date={day.iso} className={'v-day'+(day.isToday?' is-today':'')+(day.locked?' is-locked':'')+(dragOver===day.iso?' is-drag-over':'')+(over?' is-over':'')} onDragOver={e=>{e.preventDefault();setDragOver(day.iso);}} onDragLeave={()=>setDragOver(null)} onDrop={e=>{e.preventDefault();if(day.locked)notify('That day is locked');else if(dragged)moveChunkDate(dragged.taskId,dragged.fromDate,day.iso);setDragged(null);setDragOver(null);}}>
        <header><div><span>{day.wd.slice(0,3)}</span><strong>{day.d.getDate()}</strong></div><button className="icon-btn" aria-label={(day.locked?'Unlock ':'Lock ')+day.iso} aria-pressed={day.locked} title={day.locked?'Unlock day':'Lock day'} onClick={()=>toggleDayLock(day.iso)}><Icon name={day.locked?'lock':'unlock'}/></button></header>
        <div className="v-day-cap"><Segments pct={pct} count={12}/><span>{day.cap===0?'Day off':dayH.toFixed(1)+' / '+day.cap+'h'}{over?' · Overloaded':''}</span></div>
        <div className="v-day-tasks">{day.items.map(it=>{const t=tasksById.get(it.taskId);if(!t)return null;const p=projectsById.get(t.projectId),chunks=D.getTaskChunks(t.id,plan),done=!!(it.done||t.completed);return <div key={it.taskId} className={'v-plan-task'+(done?' is-done':'')+(cursor && kbRows[cursor.index]?.taskId===t.id && kbRows[cursor.index]?.chunkDate===day.iso?' is-cursor':'')} draggable={!done} onDragStart={e=>{setDragged({taskId:t.id,fromDate:day.iso});e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',t.id);}} onDragEnd={()=>{setDragged(null);setDragOver(null);}}><div className="v-plan-task-top"><HLight done={done} onComplete={()=>setCompletion(t.id,{done:true,chunkDate:day.iso})} onReopen={()=>setCompletion(t.id,{done:false,chunkDate:day.iso})}/><span>{it.hours??D.taskHours(t)}h</span>{chunks.length>1&&<span>{chunks.findIndex(c=>c.date===day.iso)+1}/{chunks.length}</span>}<button className="icon-btn" aria-label={'Unschedule '+t.title} onClick={()=>dismissChunk(t.id,day.iso)}><Icon name="close" size={12}/></button></div><button className="v-plan-title" onClick={()=>setUI({formOpen:true,editingTaskId:t.id})}>{t.title}</button>{p&&<span className="v-plan-project"><i style={{background:p.color}}/>{p.title}</span>}{it.note&&<p>{it.note}</p>}</div>;})}{!day.items.length&&<div className="v-day-empty"><Glyph seed={day.d.getDay()} size={24}/><span>{day.cap===0?'Room to rest':'Room to grow'}</span></div>}</div>
      </article>;
    })}</div></section>)}
    <div className="v-center"><button className="bezel" onClick={()=>setHorizon(h=>h+28)}>Unfold 4 more weeks <Icon name="plus"/></button></div>
  </div>;
}
