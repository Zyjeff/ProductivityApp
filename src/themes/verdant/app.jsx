import React, { useEffect, useState } from 'react';
import { Icon, Kbd, Lamp, Confetti, MOD } from './components.jsx';
import { Glyph, Segments } from './art.jsx';
import { useStore, setUI, runUndo, sel, exitPreview } from '../../core/store.js';
import { SHORTCUT_ROWS } from '../../core/keys.js';
import { TodayView } from './views/today.jsx';
import { PlanView } from './views/plan.jsx';
import { DockView, LaunchNoteDialog } from './views/dock.jsx';
import { LogbookPage } from './views/logbook.jsx';
import { ReviewOverlay } from './views/review.jsx';
import { FocusTunnel } from './views/focus.jsx';
import { Palette } from './views/palette.jsx';
import { EndOfDayDialog } from './views/endofday.jsx';
import { TaskFormModal } from './taskform.jsx';

const NAV = [['today','Sanctum','Today'],['plan','Almanac','Plan'],['dock','Collections','Projects & library'],['codex','Codex','Progress & settings']];
class VerdantBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <main className="v-recovery"><section className="v-panel"><Glyph size={36}/><span className="v-eyebrow">VERDANT</span><h1>A moment to reset.</h1><p>The workspace could not render. Your saved data is still available.</p><pre>{String(this.state.error.message || this.state.error)}</pre><button className="switch" onClick={()=>location.reload()}>Reload workspace</button></section></main>;
    return this.props.children;
  }
}
export default function App() {
  return <VerdantBoundary><Workspace/></VerdantBoundary>;
}
function Workspace() {
  const ui = useStore(s=>s.ui), level=useStore(sel.level), total=useStore(sel.totalXP), streak=useStore(sel.streak);
  const [shown,setShown]=useState(ui.confetti);
  useEffect(()=>{const old=document.title; document.title='Verdant — a clearer mind'; return()=>{document.title=old;};},[]);
  useEffect(()=>{
    const existing=document.querySelector('link[rel="icon"]'),icon=existing||document.createElement('link');
    const old=icon.getAttribute('href');icon.rel='icon';
    icon.href='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="5" fill="#142018"/><path d="M9 7v13h14V7M16 20v7" fill="none" stroke="#9cf16f" stroke-width="3"/></svg>');
    if(!existing)document.head.appendChild(icon);
    const meta=document.querySelector('meta[name="theme-color"]'),oldColor=meta?.content;if(meta)meta.content='#111713';
    return()=>{if(existing){if(old!==null)icon.setAttribute('href',old);else icon.removeAttribute('href');}else icon.remove();if(meta)meta.content=oldColor;};
  },[]);
  // Dialog semantics and keyboard focus stay inside the uppermost overlay.
  useEffect(()=>{
    const observer = new MutationObserver(()=>{
      document.querySelectorAll('.console,.palette,.tunnel').forEach(el=>{el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');if(!el.hasAttribute('aria-label'))el.setAttribute('aria-label',el.querySelector('h1,h2,.w-tape')?.textContent||'Workspace dialog');});
    });observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();
  },[]);
  const overlayKey=[ui.paletteOpen,ui.formOpen,!!ui.focusTaskId,ui.helpOpen,!!ui.reviewWeek,ui.endOfDayOpen,!!ui.launchNoteFor].join('-');
  useEffect(()=>{
    if(!overlayKey.includes('true')) return;
    const previous=document.activeElement;
    const top=()=>{const all=[...document.querySelectorAll('.console,.palette,.tunnel')];return all.sort((a,b)=>Number(getComputedStyle(a.closest('.backdrop,.palette-backdrop')||a).zIndex||0)-Number(getComputedStyle(b.closest('.backdrop,.palette-backdrop')||b).zIndex||0)).at(-1);};
    const focusables=el=>[...el.querySelectorAll('button:not(:disabled),input:not(:disabled):not([type=hidden]),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(x=>x.getClientRects().length);
    const timer=setTimeout(()=>{const el=top();if(el&&!el.contains(document.activeElement))focusables(el)[0]?.focus();},0);
    const trap=e=>{if(e.key!=='Tab')return;const el=top();if(!el)return;const list=focusables(el);if(!list.length)return;const first=list[0],last=list.at(-1);if(e.shiftKey&&(document.activeElement===first||!el.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!el.contains(document.activeElement))){e.preventDefault();first.focus();}};
    document.addEventListener('keydown',trap);return()=>{clearTimeout(timer);document.removeEventListener('keydown',trap);if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[overlayKey]);
  return <div className="v-app">
    <a className="v-skip" href="#v-main">Skip to workspace</a>
    <header className="v-topbar">
      <button className="v-brand" onClick={()=>setUI({view:'today',statsOpen:false,cursor:null})} aria-label="Verdant home"><span className="v-brand-mark"><Glyph seed={4} size={25}/></span><span>VERDANT<small>A CLEARER MIND</small></span></button>
      <nav aria-label="Main navigation">{NAV.map(([id,label,detail],i)=>{const active=id==='codex'?ui.statsOpen:ui.view===id&&!ui.statsOpen;return <button key={id} aria-current={active?'page':undefined} title={`${detail} (${i+1})`} onClick={()=>setUI(id==='codex'?{statsOpen:!ui.statsOpen,cursor:null}:{view:id,statsOpen:false,cursor:null})}><span className="v-nav-number">0{i+1}</span>{label}<i/></button>;})}</nav>
      <button className="v-invoke" onClick={()=>setUI({paletteOpen:true})}><Icon name="search" size={16}/><span>Invoke</span><Kbd>{MOD}K</Kbd></button>
    </header>
    {ui.previewMode && <div className="v-banner"><Glyph size={18}/><span>Sample workspace <span className="v-banner-detail">· Your saved data returns when you exit.</span></span><button onClick={exitPreview}>Exit preview ↗</button></div>}
    {ui.externalChange && <div className="v-banner v-banner--warn"><span>Data changed in another tab.</span><button onClick={()=>location.reload()}>Reload</button><button onClick={()=>setUI({externalChange:false})}>Dismiss</button></div>}
    <main id="v-main" tabIndex={-1} className="v-main">{ui.statsOpen?<LogbookPage/>:ui.view==='today'?<TodayView/>:ui.view==='plan'?<PlanView/>:<DockView/>}</main>
    <footer className="v-statusbar"><span className="v-rank"><Glyph seed={level.lvl} size={18}/><b>LV {level.lvl}</b><span>{level.title}</span></span><Segments pct={level.pct}/><span>{total.toLocaleString()} XP</span><span className="v-to-next">{level.xpToNext} to next level</span>{streak>0&&<span className="v-streak">✧ {streak} day streak</span>}<span className="v-ai"><Lamp status={ui.aiStatus} detail={ui.aiDetail}/><span>AI {ui.aiStatus==='ok'?'ready':ui.aiStatus==='busy'?'working':ui.aiStatus==='off'?'off':'standby'}</span></span><button className="v-help" onClick={()=>setUI({helpOpen:true})} title="Keyboard shortcuts (?)">Shortcuts <Kbd>?</Kbd></button></footer>
    {ui.toast&&<div className="ticker" role="status"><Glyph size={22}/>{ui.toast.xp!=null&&ui.toast.xp!==0&&<strong style={{color:ui.toast.xp<0?'var(--port)':'var(--amber)'}}>{ui.toast.xp>0?'+':''}{ui.toast.xp} XP</strong>}<span>{ui.toast.msg}</span>{ui.toast.undoId&&<button className="bezel" onClick={()=>runUndo(ui.toast.undoId)}>Undo <Kbd>U</Kbd></button>}</div>}
    {ui.confetti>shown&&<Confetti onDone={()=>setShown(ui.confetti)}/>}
    {ui.levelUp&&<div className="v-level-up" role="status"><Glyph seed={ui.levelUp.lvl} size={34}/><div><small>NEW LEVEL · {ui.levelUp.lvl}</small><h2>{ui.levelUp.title}</h2></div></div>}
    {ui.helpOpen&&<div className="backdrop" onClick={()=>setUI({helpOpen:false})}><section className="console v-help-dialog" onClick={e=>e.stopPropagation()}><div className="v-dialog-title"><Glyph/><h2>Little shortcuts. More flow.</h2><button className="icon-btn" aria-label="Close help" onClick={()=>setUI({helpOpen:false})}><Icon name="close"/></button></div><div className="v-shortcuts">{SHORTCUT_ROWS.map(([k,v])=><div key={k}><span>{v.replaceAll("Today","Sanctum").replaceAll("Plan","Almanac").replaceAll("Dock","Collections").replace("Stats panel","Codex").replace("Focus tunnel","Focus ritual")}</span><Kbd>{k}</Kbd></div>)}</div><button className="bezel" onClick={()=>setUI({helpOpen:false})}>Back to the workspace</button></section></div>}
    <TaskFormModal/><ReviewOverlay/><Palette/><EndOfDayDialog/><FocusTunnel/><LaunchNoteDialog/>
  </div>;
}
