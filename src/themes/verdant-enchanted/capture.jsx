import React, { useEffect,useMemo,useRef,useState } from 'react';
import { Icon,Kbd } from './components.jsx';
import { Glyph, Sprite } from './art.jsx';
import { parseQuickAdd } from '../../core/domain.js';
import { useStore,captureTask,setUI } from '../../core/store.js';
import { enrichCapturedTask,captureProject } from '../../core/enrich.js';
import { setCaptureFocus } from '../../core/keys.js';
export function CaptureSlab({scheduleToday=false,autoRegister=true}) {
  const mode=useStore(s=>s.ui.captureMode),projects=useStore(s=>s.projects);
  const [text,setText]=useState(''),ref=useRef(null),[flash,setFlash]=useState(false);
  useEffect(()=>{if(!flash)return;const timer=setTimeout(()=>setFlash(false),450);return()=>clearTimeout(timer);},[flash]);
  const parsed=useMemo(()=>mode==='task'&&text.trim()?parseQuickAdd(text,{projects}):null,[text,mode,projects]);
  const grammar=!!parsed?.chips.length;
  useEffect(()=>{if(!autoRegister)return;setCaptureFocus(()=>ref.current?.focus());return()=>setCaptureFocus(null);},[autoRegister]);
  const submit=()=>{const v=text.trim();if(!v)return;setText('');setFlash(true);if(mode==='project'){captureProject(v);return;}const task=captureTask(v,{mode,scheduleToday,parsed});if(task)enrichCapturedTask(task.id,grammar?parsed.title:v,mode,{grammarUsed:grammar,hasHours:!!parsed?.hours});ref.current?.focus();};
  return <div className={'e-capture v-capture'+(flash?' is-inscribed':'')}><div className="e-inscribe-icon"><Sprite kind="quill" size={28}/></div><select aria-label="Capture type" value={mode} onChange={e=>{setUI({captureMode:e.target.value});ref.current?.focus();}}><option value="task">Task</option><option value="subtasks">Steps</option><option value="project">Project</option></select><input ref={ref} value={text} aria-label="Capture a task" placeholder={mode==='project'?'Name a new grimoire…':mode==='subtasks'?'An intention to break into steps…':'Inscribe a new intention…'} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')submit();if(e.key==='Escape'){setText('');ref.current?.blur();}}}/><button className="e-capture-submit" disabled={!text.trim()} onClick={submit} aria-label="Capture"><Icon name="plus" size={14}/></button><button className="icon-btn" title="Full task form (Shift+N)" aria-label="Open full task form" onClick={()=>setUI({formOpen:true,editingTaskId:null})}><Icon name="edit"/></button><Kbd>N</Kbd>{grammar&&<div className="slab-chips"><b>{parsed.title}</b>{parsed.chips.map((c,i)=><span className="stamp" key={i}>{c.label}</span>)}</div>}</div>;
}
