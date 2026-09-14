import React, {useEffect, useState} from 'react';
import {useStore,setUI,runUndo,sel,exitPreview} from '../../core/store.js';
import {SHORTCUT_ROWS,registerActiveList} from '../../core/keys.js';
import {Icon,Kbd,ProgressBar,Confetti,MOD,AiDot} from './components.jsx';
import {PressMark} from './print.jsx';
import {useDialogFocus} from './dialogs.js';
import {TodayView} from './views/today.jsx';
import {PlanView} from './views/plan.jsx';
import {DockView,LaunchNoteDialog} from './views/dock.jsx';
import {StatsPanel} from './views/stats.jsx';
import {ReviewOverlay} from './views/review.jsx';
import {FocusTunnel} from './views/focus.jsx';
import {Palette} from './views/palette.jsx';
import {EndOfDayDialog} from './views/endofday.jsx';
import {TaskFormModal} from './taskform.jsx';

const nav=[['today','Daily edition','1'],['plan','Imposition','2'],['dock','Collection','3']];
export default function App(){
  const ui=useStore(s=>s.ui);
  useDialogFocus(ui);
  const level=useStore(sel.level), xp=useStore(sel.totalXP), streak=useStore(sel.streak);
  const [confettiShown,setConfettiShown]=useState(0);
  useEffect(()=>{if(ui.statsOpen)registerActiveList('colophon',[]);},[ui.statsOpen]);
  useEffect(()=>{const before=document.title;document.title='Folio Enhanced — A private press for your day';return()=>{document.title=before;};},[]);
  const go=view=>setUI({view,cursor:null,statsOpen:false});
  return <div className="f-shell">
    <a href="#folio-main" className="f-skip">Skip to the work</a>
    <header className="f-masthead">
      <button className="f-brand" onClick={()=>go('today')} aria-label="Folio — Today"><PressMark/><span>FOLIO<span className="f-brand-dot">.</span></span></button>
      <span className="f-brand-description">A private press<br/><em>for a considered life.</em></span><span className="f-masthead-note">EST. TODAY<br/>AN INDEPENDENT EDITION</span>

      <button className="f-search" onClick={()=>setUI({paletteOpen:true})} title="Command palette"><Icon name="search" size={17}/><Kbd>{MOD} K</Kbd></button>
    </header>
    <main id="folio-main" className="f-main">
      {ui.previewMode && <div className="f-notice f-preview"><span>SAMPLE EDITION · You’re exploring sample data.</span><button className="w-link" onClick={exitPreview}>Exit preview ↗</button></div>}
      {ui.externalChange && <div className="f-notice"><span>Your work changed in another tab.</span><button className="w-bezel" onClick={()=>location.reload()}>Reload</button><button className="w-link" onClick={()=>setUI({externalChange:false})}>Dismiss</button></div>}
      {ui.statsOpen?<StatsPanel/>:ui.view==='plan'?<PlanView/>:ui.view==='dock'?<DockView/>:<TodayView/>}
    </main>
    <nav className="f-bookmark" aria-label="Main navigation">{nav.map(([id,label,key])=><button key={id} className={ui.view===id&&!ui.statsOpen?'is-active':''} onClick={()=>go(id)} title={`${id==='dock'?'Dock':id==='plan'?'Plan':'Today'} (${key})`}><sup>0{key}</sup>{label}</button>)}<button className={ui.statsOpen?'is-active':''} onClick={()=>setUI({statsOpen:!ui.statsOpen,cursor:null})} title="Logbook (4)"><sup>04</sup>Colophon</button></nav>
    <footer className="f-colophon-bar"><span className="f-footer-mark"><PressMark size={18}/> MADE WITH INTENTION</span><button className="f-level" onClick={()=>setUI({statsOpen:true})}><b>LVL {level.lvl}</b><span>{level.title}</span><ProgressBar pct={level.pct}/><span>{xp} XP</span><span>{level.xpToNext>0?`${level.xpToNext} TO NEXT`:'MAX LEVEL'}</span></button>{streak>0&&<span className="f-streak">{streak} DAY STREAK</span>}<span className="f-ai"><AiDot status={ui.aiStatus} detail={ui.aiDetail}/>{ui.aiStatus==='off'?'AI OFF':ui.aiStatus==='busy'?'AI WORKING':ui.aiStatus==='ok'?'AI READY':'AI STANDBY'}</span><button className="f-help" onClick={()=>setUI({helpOpen:true})} title="Keyboard help">?</button></footer>
    {ui.toast && <div key={ui.toast.at} className="f-toast" role="status"><PressMark size={21}/><span>{ui.toast.msg}</span>{ui.toast.xp!=null&&<b>{ui.toast.xp>0?'+':''}{ui.toast.xp} XP</b>}{ui.toast.undoId&&<button className="w-bezel" onClick={()=>runUndo(ui.toast.undoId)}>Undo <Kbd>U</Kbd></button>}</div>}
    {ui.levelUp && <div className="f-level-up" role="status"><PressMark size={42}/><span>A new chapter</span><strong>Level {ui.levelUp.lvl}</strong><span>{ui.levelUp.title}</span></div>}
    {ui.confetti>confettiShown&&<Confetti onDone={()=>setConfettiShown(ui.confetti)}/>}
    {ui.helpOpen&&<div className="w-backdrop f-help-backdrop" onClick={()=>setUI({helpOpen:false})}><section className="w-console f-help-sheet" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={e=>e.stopPropagation()}><div className="f-kicker">THE COMPOSITOR'S INDEX</div><h2>A few useful keys.</h2>{SHORTCUT_ROWS.map(([key,label])=><div className="f-shortcut" key={key}><span>{label}</span><Kbd>{key}</Kbd></div>)}<button className="w-switch" onClick={()=>setUI({helpOpen:false})}>Back to the work</button></section></div>}
    <TaskFormModal/><ReviewOverlay/><Palette/><EndOfDayDialog/><FocusTunnel/><LaunchNoteDialog/>
  </div>;
}
