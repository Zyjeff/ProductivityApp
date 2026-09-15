import React, { useEffect,useMemo,useRef,useState } from 'react';
import { Icon,Kbd } from './components.jsx';
import { Glyph } from './art.jsx';
import { parseQuickAdd } from '../../core/domain.js';
import { useStore,captureTask,setUI } from '../../core/store.js';
import { enrichCapturedTask,captureProject } from '../../core/enrich.js';
import { setCaptureFocus } from '../../core/keys.js';
export function CaptureSlab({scheduleToday=false,autoRegister=true}) {
  const mode=useStore(s=>s.ui.captureMode),projects=useStore(s=>s.projects);
  const [text,setText]=useState(''),ref=useRef(null);
  const parsed=useMemo(()=>mode==='task'&&text.trim()?parseQuickAdd(text,{projects}):null,[text,mode,projects]);
  const grammar=!!parsed?.chips.length;
  useEffect(()=>{if(!autoRegister)return;setCaptureFocus(()=>ref.current?.focus());return()=>setCaptureFocus(null);},[autoRegister]);
  const submit=()=>{const v=text.trim();if(!v)return;setText('');if(mode==='project'){captureProject(v);return;}const task=captureTask(v,{mode,scheduleToday,parsed});if(task)enrichCapturedTask(task.id,grammar?parsed.title:v,mode,{grammarUsed:grammar,hasHours:!!parsed?.hours});ref.current?.focus();};
  return <div className="v-capture"><div className="v-capture-input"><Glyph seed={3}/><input ref={ref} value={text} aria-label="Capture a task" placeholder={mode==='project'?'A project worth bringing to life…':mode==='subtasks'?'A task to break into small steps…':'What will you make progress on?'} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')submit();if(e.key==='Escape'){setText('');ref.current?.blur();}}}/><button className="v-capture-submit" disabled={!text.trim()} onClick={submit} aria-label="Capture">↵</button></div><div className="v-capture-bottom"><div className="slab-types" role="group" aria-label="Capture type">{[['task','Task'],['subtasks','Steps'],['project','Project']].map(([id,label])=><button key={id} className={id===mode?'on':''} aria-pressed={id===mode} onClick={()=>{setUI({captureMode:id});ref.current?.focus();}}>{label}</button>)}</div><span className="v-capture-grammar">!priority · #tag · 30m · tomorrow</span><button className="icon-btn" title="Full task form (Shift+N)" aria-label="Open full task form" onClick={()=>setUI({formOpen:true,editingTaskId:null})}><Icon name="edit"/></button><Kbd>N</Kbd></div>{grammar&&<div className="slab-chips"><b>{parsed.title}</b>{parsed.chips.map((c,i)=><span className="stamp" key={i}>{c.label}</span>)}</div>}</div>;
}
