// Verdant presentation. State and mutations use the shared core contract.
import React, { useEffect, useRef, useState } from "react";
import { Icon, Kbd, MOD, StampPick, HLight } from "./components.jsx";
import {
  effectiveToday, DIFFICULTY, PRIORITIES, allKnownTags, TAGS_BUILTIN, isoDate, addDays,
  deterministicScore, getTaskChunks, getTaskScheduledDate, uid,
} from "../../core/domain.js";
import { useStore, getState, addTask, updateTask, setUI, notify, addCustomTag, promoteToProject } from "../../core/store.js";
import { enrichManualTask, scoreTask } from "../../core/enrich.js";

import { PixelText, Sprite, Glyph, RuneRule } from "./art.jsx";

export function TaskFormModal() {
  const formOpen = useStore((s) => s.ui.formOpen);
  const editingTaskId = useStore((s) => s.ui.editingTaskId);
  if (!formOpen) return null;
  const task = editingTaskId ? getState().tasks.find((t) => t.id === editingTaskId) : null;
  return (
    <div onClick={() => setUI({ formOpen: false, editingTaskId: null })}
      className="backdrop v-form-backdrop"
      style={{ zIndex: 10001, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "7vh 16px 16px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 760 }}>
        <TaskForm key={editingTaskId || "new"} initial={task} isEdit={!!task} onClose={() => setUI({ formOpen: false, editingTaskId: null })} />
      </div>
    </div>
  );
}

function TaskForm({ initial, isEdit, onClose }) {
  const s = getState();
  const projects = s.projects.filter((p) => !p.completedAt || p.id === initial?.projectId);
  const customTags = s.customTags;
  const chunks = initial ? getTaskChunks(initial.id, s.plan) : [];
  const isSplit = chunks.length > 1;
  const initialScheduled = initial ? getTaskScheduledDate(initial.id, s.plan) : "";

  const [title, setTitle] = useState(initial?.title || "");
  const [desc, setDesc] = useState(initial?.desc || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [tags, setTags] = useState(initial?.tags || []);
  const [subs, setSubs] = useState(() => (initial?.subtasks || []).map((x) => ({ k: x.id || uid(), title: x.title })));
  const [stIn, setStIn] = useState("");
  const [tagIn, setTagIn] = useState("");
  const [recurring, setRecurring] = useState(initial?.recurring || "none");
  const [priority, setPriority] = useState(initial?.priority || "medium");
  const [difficulty, setDifficulty] = useState(initial?.difficulty || "medium");
  const [scheduleDate, setScheduleDate] = useState(initialScheduled || "");
  const [projectId, setProjectId] = useState(initial?.projectId || "");
  const initialDeadline = initial?.deadlineAt ? isoDate(new Date(initial.deadlineAt)) : "";
  const [deadline, setDeadline] = useState(initialDeadline);
  const [hours, setHours] = useState(initial ? (initial.hours ?? DIFFICULTY[initial.difficulty]?.hours ?? 1.5) : DIFFICULTY.medium.hours);
  const [xp, setXp] = useState(initial ? (initial.xp ?? 20) : deterministicScore("medium").xp);
  const [scoreTouched, setScoreTouched] = useState(false);
  const titleRef = useRef(null);
  useEffect(() => { titleRef.current?.focus(); }, []);

  const applyDifficulty = (d) => {
    setDifficulty(d);
    if (!scoreTouched) {
      const det = deterministicScore(d, null);
      setHours(det.hours); setXp(det.xp);
    }
  };
  const applyHours = (raw) => {
    const h = Math.max(0.25, Math.min(24, parseFloat(raw) || 0));
    if (!h) return;
    setHours(h);
    if (!scoreTouched) setXp(deterministicScore(difficulty, h).xp);
  };

  const commitSubInput = (list) => {
    const v = stIn.trim();
    return v ? [...list, { k: uid(), title: v }] : list;
  };
  const commitTagInput = (list) => {
    const raw = tagIn.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (!raw || list.includes(raw)) return list;
    return [...list, raw];
  };

  const canSubmit = title.trim().length > 0;
  const submit = () => {
    if (!canSubmit) return;
    const finalSubs = commitSubInput(subs);
    const finalTags = commitTagInput(tags);
    for (const t of finalTags) {
      if (!TAGS_BUILTIN.includes(t) && !customTags.includes(t)) addCustomTag(t);
    }
    const payload = {
      title: title.trim(), desc, notes, tags: finalTags,
      subtasks: finalSubs.map((x) => x.title),
      recurring, priority, difficulty,
      xp: Math.round(xp), hours,
      deadlineAt: deadline ? (() => { const [y, m, d] = deadline.split("-").map(Number); return new Date(y, m - 1, d, 12).getTime(); })() : null,
    };
    if (isEdit) {
      const patch = { ...payload };
      if (scheduleDate !== (initialScheduled || "") && !isSplit) {
        patch.scheduleDate = scheduleDate || null;
        patch.scheduleDateChanged = true;
      }
      if ((projectId || "") !== (initial.projectId || "")) {
        patch.projectId = projectId || null;
        patch.projectIdChanged = true;
      }
      updateTask(initial.id, patch);
      notify("Saved");
    } else {
      const created = addTask({
        ...payload,
        projectId: projectId || null,
        scheduleDate: recurring === "none" ? (scheduleDate || null) : null,
      });
      if (created && !scoreTouched) enrichManualTask(created.id);
    }
    onClose();
  };

  const onFormKeys = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); }
  };

  const Label = ({ children }) => <div className="w-stencil" style={{ marginBottom: 6 }}>{children}</div>;

  return <div className="console e-inscription v-inscription" onKeyDown={onFormKeys} role="dialog" aria-modal="true" aria-label={isEdit?'Edit intention':'New task'}><header className="console-head"><Sprite kind="quill" size={24}/><PixelText size={13}>{isEdit?'REFINE AN INTENTION':'INSCRIBE AN INTENTION'}</PixelText><span style={{flex:1}}/><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close"/></button></header>
    <div className="e-inscription-pages"><section className="e-inscription-page"><span className="e-eyebrow">I. GIVE IT A NAME</span><input ref={titleRef} className="field e-title-field" aria-label="Task title" placeholder="What will you bring to life?" value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.metaKey&&!e.ctrlKey)submit();}}/><label><span className="e-form-label">The intention</span><textarea className="field" aria-label="Description" placeholder="Description (optional)" value={desc} onChange={e=>setDesc(e.target.value)} rows={3}/></label><label><span className="e-form-label">Notes in the margin</span><textarea className="field" aria-label="Notes" placeholder="Notes — context, blockers, references" value={notes} onChange={e=>setNotes(e.target.value)} rows={2}/></label><RuneRule seed={1}/><div><span className="e-form-label">Small steps</span><input className="field" placeholder="Type a step + Enter" value={stIn} onChange={e=>setStIn(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();setSubs(commitSubInput(subs));setStIn('');}}}/>{subs.map((x,i)=><div className="e-step-item" key={x.k}><Glyph seed={i} size={13}/><span>{x.title}</span><button className="icon-btn" aria-label="Remove step" onClick={()=>setSubs(p=>p.filter(y=>y.k!==x.k))}><Icon name="close" size={10}/></button></div>)}</div><div><span className="e-form-label">Tags</span><div className="e-form-choices">{[...new Set([...allKnownTags(customTags),...tags])].map(t=><StampPick key={t} active={tags.includes(t)} onClick={()=>setTags(p=>p.includes(t)?p.filter(x=>x!==t):[...p,t])}>{t}</StampPick>)}</div><input className="field" placeholder="+ new tag" value={tagIn} onChange={e=>setTagIn(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();setTags(commitTagInput(tags));setTagIn('');}}}/></div></section>
    <section className="e-inscription-page"><span className="e-eyebrow">II. SHAPE THE WORK</span><div><span className="e-form-label">Priority</span><div className="e-form-choices">{Object.keys(PRIORITIES).map(k=><StampPick key={k} active={priority===k} onClick={()=>setPriority(k)}>{PRIORITIES[k].label}</StampPick>)}</div></div><div><span className="e-form-label">Difficulty</span><div className="e-form-choices e-difficulty-choices">{Object.keys(DIFFICULTY).map((k,i)=><StampPick key={k} active={difficulty===k} onClick={()=>applyDifficulty(k)}><Sprite kind={['quill','hourglass','book','crystal'][i]} size={23}/>{k}</StampPick>)}</div></div><div className="e-form-row"><label><span className="e-form-label">Hours</span><input aria-label="Estimated hours" className="field" type="number" min="0.25" max="24" step="0.25" value={hours} disabled={isSplit} onChange={e=>applyHours(e.target.value)}/></label><label><span className="e-form-label">XP</span><input aria-label="Task XP" className="field" type="number" min="5" max="200" step="5" value={xp} disabled={isSplit} onChange={e=>{setXp(Math.max(5,Math.min(200,parseInt(e.target.value,10)||0)));setScoreTouched(true);}}/></label></div>{isSplit&&<p className="e-form-note">Split-task estimates are edited in the chunk list.</p>}<div><span className="e-form-label">Repeats</span><div className="e-form-choices">{[['none','Once'],['daily','Daily'],['weekly','Weekly']].map(([k,label])=><StampPick key={k} active={recurring===k} onClick={()=>setRecurring(k)}>{label}</StampPick>)}</div></div><RuneRule seed={4}/>{recurring==='none'&&!isSplit&&<div><span className="e-form-label">Scheduled {scheduleDate?'':'· planner decides'}</span><div className="e-form-row"><input aria-label="Schedule date" type="date" className="field" value={scheduleDate} onChange={e=>setScheduleDate(e.target.value)}/><button className="link" onClick={()=>setScheduleDate(isoDate(effectiveToday(s.meta.dayStartHour||0)))}>Today</button><button className="link" onClick={()=>setScheduleDate(isoDate(addDays(effectiveToday(s.meta.dayStartHour||0),1)))}>Tomorrow</button>{scheduleDate&&<button className="link" onClick={()=>setScheduleDate('')}>Clear</button>}</div></div>}<label><span className="e-form-label">Deadline · optional</span><div className="e-form-row"><input aria-label="Deadline" type="date" className="field" value={deadline} onChange={e=>setDeadline(e.target.value)}/>{deadline&&<button className="link" onClick={()=>setDeadline('')}>Clear</button>}</div></label>{projects.length>0&&<label><span className="e-form-label">Grimoire · project</span><select aria-label="Project" className="field" value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">No project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title}{p.completedAt?' (sealed)':''}</option>)}</select></label>}</section></div>
    <footer className="e-form-foot"><span><Kbd>{MOD}↵</Kbd> Save inscription <i>·</i> <Kbd>Esc</Kbd> Cancel</span>{isEdit&&!initial?.projectId&&<button className="bezel" disabled={subs.length===0&&!stIn.trim()} onClick={()=>{const finalSubs=commitSubInput(subs);if(!finalSubs.length)return;updateTask(initial.id,{subtasks:finalSubs.map(x=>x.title)});const res=promoteToProject(initial.id);if(res){for(const cid of res.childIds)scoreTask(cid);setUI({formOpen:false,editingTaskId:null,view:'dock',dockFilter:{...getState().ui.dockFilter,tab:'projects'}});}}}>Promote to project</button>}<button className="switch" onClick={submit} disabled={!canSubmit}><Icon name="check" size={12}/>{isEdit?'Save changes':'Create task'}</button><button className="bezel" onClick={onClose}>Cancel</button></footer></div>;
}
