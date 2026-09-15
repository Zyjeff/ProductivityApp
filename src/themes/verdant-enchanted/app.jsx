import React, { useEffect, useState } from 'react';
import { Icon, Kbd, Lamp, Confetti, MOD } from './components.jsx';
import { Glyph, Segments, PixelText, Sprite, RuneRule } from './art.jsx';
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

// Translate only known system notifications; task and project titles stay intact.
function noticeCopy(message) {
  if(message==='Logged in the fleet')return 'Inscribed in the archive';
  if(message==='Day cleared. Solid day.')return "The day's seal is complete.";
  for(const [from,to] of [['Ready to launch: ','Ready to seal: '],['Launched: ','Grimoire sealed: '],['Trophy: ','Relic acquired: ']])if(typeof message==='string'&&message.startsWith(from))return to+message.slice(from.length);
  return message;
}
const NAV = [['today','Sanctum','Today','crystal'],['plan','Atlas','Plan','atlas'],['dock','Grimoires','Projects & library','book'],['codex','Chronicle','Progress & settings','crown']];
class VerdantBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <main className="v-recovery"><section className="v-panel"><Glyph size={36}/><span className="v-eyebrow">VERDANT ENCHANTED</span><h1>A moment to reset.</h1><p>The workspace could not render. Your saved data is still available.</p><pre>{String(this.state.error.message || this.state.error)}</pre><button className="switch" onClick={()=>location.reload()}>Reload workspace</button></section></main>;
    return this.props.children;
  }
}
export default function App() {
  return <VerdantBoundary><Workspace/></VerdantBoundary>;
}
function Workspace() {
  const ui = useStore(s=>s.ui), level=useStore(sel.level), total=useStore(sel.totalXP), streak=useStore(sel.streak);
  // Chronicle occupies the main canvas. Reveal the destination when the core
  // handles a navigation key; bindings and command behavior stay in the core.
  useEffect(()=>{
    const reveal=e=>{
      if(!ui.statsOpen||e.metaKey||e.ctrlKey||e.altKey||ui.paletteOpen||ui.formOpen||ui.focusTaskId||ui.endOfDayOpen)return;
      if(e.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
      if(['1','2','3','b','B'].includes(e.key))setUI({statsOpen:false});
    };
    document.addEventListener('keydown',reveal);
    return()=>document.removeEventListener('keydown',reveal);
  },[ui.statsOpen,ui.paletteOpen,ui.formOpen,ui.focusTaskId,ui.endOfDayOpen]);
  const [shown,setShown]=useState(ui.confetti);
  useEffect(()=>{const old=document.title; document.title='Verdant Enchanted'; return()=>{document.title=old;};},[]);
  useEffect(()=>{
    const existing=document.querySelector('link[rel="icon"]'),icon=existing||document.createElement('link');
    const old=icon.getAttribute('href');icon.rel='icon';
    icon.href='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#0a1318" d="M0 0h32v32H0z"/><path fill="#76ff55" d="M14 2h6v4h4v16h-4v6h-6v-4h-4V10h4z"/><path fill="#dffff4" d="M14 6h4v12h-4z"/><path fill="#23814a" d="M18 14h6v8h-4v6h-6v-6h4z"/></svg>');
    if(!existing)document.head.appendChild(icon);
    const meta=document.querySelector('meta[name="theme-color"]'),oldColor=meta?.content;if(meta)meta.content='#0a1318';
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
  return <div className="e-app v-app">
    <a className="e-skip" href="#v-main">Skip to workspace</a>
    <header className="e-header"><button className="e-brand" onClick={()=>setUI({view:'today',statsOpen:false,cursor:null})} aria-label="Verdant Enchanted home"><Sprite kind="crystal" size={30}/><span><PixelText size={18}>VERDANT</PixelText><small>ENCHANTED</small></span></button><div className="e-header-runes" aria-hidden="true"><RuneRule seed={2}/></div><button className="e-player" onClick={()=>setUI({statsOpen:true,cursor:null})} aria-label="Open progress"><Sprite kind="crown" size={34}/><span><b>LV {level.lvl} · {level.title}</b><Segments pct={level.pct} count={28}/><small>{total.toLocaleString()} XP <i>·</i> {level.xpToNext} to next level</small></span></button>{streak>0&&<span className="e-streak"><Sprite kind="flame" size={27}/><span>{streak}<small>DAY STREAK</small></span></span>}</header>
    {ui.previewMode&&<div className="e-banner v-banner"><Glyph size={14}/><span>Sample realm <span className="e-banner-detail">· Your saved work returns when you leave.</span></span><button onClick={exitPreview}>Exit preview ↗</button></div>}
    {ui.externalChange&&<div className="e-banner v-banner"><span>Data changed in another tab.</span><button onClick={()=>location.reload()}>Reload</button><button onClick={()=>setUI({externalChange:false})}>Dismiss</button></div>}
    <main id="v-main" tabIndex={-1} className="e-main">{ui.statsOpen?<LogbookPage/>:ui.view==='today'?<TodayView/>:ui.view==='plan'?<PlanView/>:<DockView/>}</main>
    <div className="e-hotbar-wrap"><span className="e-dock-side e-ai"><Lamp status={ui.aiStatus} detail={ui.aiDetail}/> AI {ui.aiStatus==='ok'?'ready':ui.aiStatus==='busy'?'working':ui.aiStatus==='off'?'off':'standby'}</span><nav className="e-hotbar" aria-label="Main navigation">{NAV.map(([id,label,detail,sprite],i)=>{const active=id==='codex'?ui.statsOpen:ui.view===id&&!ui.statsOpen;return <button key={id} aria-current={active?'page':undefined} title={detail+' ('+(i+1)+')'} onClick={()=>setUI(id==='codex'?{statsOpen:!ui.statsOpen,cursor:null}:{view:id,statsOpen:false,cursor:null})}><span className="e-slot"><Kbd>{i+1}</Kbd><Sprite kind={sprite} size={33}/><i/></span><span>{label}</span></button>;})}<button className="e-invoke" onClick={()=>setUI({paletteOpen:true})} aria-label="Invoke command palette"><span className="e-slot"><Sprite kind="quill" size={32}/></span><span>Invoke <Kbd>{MOD}K</Kbd></span></button></nav><button className="e-dock-side e-help" onClick={()=>setUI({helpOpen:true})}>Shortcuts <Kbd>?</Kbd></button></div>
    {ui.toast&&<div className="ticker" role="status"><Glyph size={22}/>{ui.toast.xp!=null&&ui.toast.xp!==0&&<strong style={{color:ui.toast.xp<0?'var(--port)':'var(--amber)'}}>{ui.toast.xp>0?'+':''}{ui.toast.xp} XP</strong>}<span>{noticeCopy(ui.toast.msg)}</span>{ui.toast.undoId&&<button className="bezel" onClick={()=>runUndo(ui.toast.undoId)}>Undo <Kbd>U</Kbd></button>}</div>}
    {ui.confetti>shown&&<Confetti onDone={()=>setShown(ui.confetti)}/>}
    {ui.levelUp&&<div className="v-level-up" role="status"><Glyph seed={ui.levelUp.lvl} size={34}/><div><small>NEW LEVEL · {ui.levelUp.lvl}</small><h2>{ui.levelUp.title}</h2></div></div>}
    {ui.helpOpen&&<div className="backdrop" onClick={()=>setUI({helpOpen:false})}><section className="console v-help-dialog" onClick={e=>e.stopPropagation()}><div className="v-dialog-title"><Glyph/><h2>Little shortcuts. More flow.</h2><button className="icon-btn" aria-label="Close help" onClick={()=>setUI({helpOpen:false})}><Icon name="close"/></button></div><div className="v-shortcuts">{SHORTCUT_ROWS.map(([k,v])=><div key={k}><span>{v.replaceAll("Today","Sanctum").replaceAll("Plan","Atlas").replaceAll("Dock","Grimoires").replace("Stats panel","Chronicle").replace("Focus tunnel","Focus ritual")}</span><Kbd>{k}</Kbd></div>)}</div><button className="bezel" onClick={()=>setUI({helpOpen:false})}>Back to the workspace</button></section></div>}
    <TaskFormModal/><ReviewOverlay/><Palette/><EndOfDayDialog/><FocusTunnel/><LaunchNoteDialog/>
  </div>;
}
