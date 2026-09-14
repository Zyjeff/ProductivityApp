import React, { useEffect, useMemo, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';

export function PressMark({size=30}) {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="5" fill="currentColor"/>{Array.from({length:12},(_,i)=><path key={i} d="M20 2V12M17 4L20 2L23 4" stroke="currentColor" strokeWidth="1.2" transform={`rotate(${i*30} 20 20)`}/>)}</svg>;
}

function Impression({rows,date,svgRef}) {
  const id=useId().replace(/:/g,'');
  const done=rows.filter(r=>r.doneHere).length;
  const seed=[...date].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);
  const paths=useMemo(()=>Array.from({length:68},(_,i)=>{
    const points=[];
    for(let j=0;j<=300;j++) {
      const a=j/300*Math.PI*2;
      const r=134+48*Math.sin(3*a+i*.064+(seed%360)*Math.PI/180+done*.04);
      const twist=i*.024;
      points.push((j?'L':'M')+(240+Math.cos(a+twist)*r*(.65+i*.005)).toFixed(2)+','+(282+Math.sin(a+twist)*r*(1.14-i*.003)).toFixed(2));
    }
    return points.join(' ')+'Z';
  }),[seed,done]);
  return <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" className="f-print-art" viewBox="0 0 480 620" role="img" aria-label={`${done} of ${rows.length} tasks complete. An original print for ${date}.`}>
    <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff0c5"/><stop offset=".65" stopColor="#e9a97f"/><stop offset="1" stopColor="#d1795b"/></linearGradient></defs>
    <rect width="480" height="620" fill="#782d3e"/>
    <rect x="17" y="17" width="446" height="586" fill="none" stroke="#dfac91" strokeOpacity=".35"/>
    <g fill="#f8e5c9" fontFamily="Consolas,monospace" fontSize="8" letterSpacing="1.8"><text x="36" y="45">FOLIO / THE PRIVATE PRESS</text><text x="444" y="45" textAnchor="end">{date}</text></g>
    <g fill="none" stroke={`url(#${id})`} strokeWidth=".65" opacity=".9">{paths.map((d,i)=><path d={d} key={i}/>)}</g>
    <circle cx="240" cy="282" r="205" fill="none" stroke="#f2c79f" strokeOpacity=".5" strokeDasharray="1 7"/>
    {rows.map((r,i)=>{const a=i/rows.length*Math.PI*2-Math.PI/2;return <circle key={r.task.id} cx={240+205*Math.cos(a)} cy={282+205*Math.sin(a)} r={r.doneHere?5:2.5} fill={r.doneHere?'#f8e5c9':'#782d3e'} stroke="#efc3a0"><title>{r.task.title}: {r.doneHere?'complete':'pending'}</title></circle>})}
    <text x="240" y="307" fill="#f8e5c9" textAnchor="middle" fontFamily="Baskerville,Georgia,serif" fontStyle="italic" fontSize="82">{String(done).padStart(2,'0')}</text>
    <g fill="#f8e5c9"><text x="36" y="535" fontFamily="Baskerville,Georgia,serif" fontSize="44" letterSpacing="-1.7">Attention, made visible.</text><path d="M36 556H444" stroke="#f8e5c9" strokeOpacity=".4"/><text x="36" y="582" fontFamily="Consolas,monospace" fontSize="8" letterSpacing="1.4">{done} OF {rows.length} IMPRESSIONS / {rows.length?Math.round(done/rows.length*100):0}% COMPLETE</text><text x="444" y="582" textAnchor="end" fontFamily="Georgia,serif" fontStyle="italic" fontSize="16">f.</text></g>
  </svg>;
}

export function DailyPrint({rows=[],date}) {
  const [open,setOpen]=useState(false);
  const trigger=useRef(null),dialog=useRef(null),svg=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const prior=document.activeElement,overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    dialog.current?.querySelector('button')?.focus();
    const key=e=>{
      if(e.key==='Escape'){e.preventDefault();setOpen(false);}
      if(e.key==='Tab'){
        const els=[...dialog.current.querySelectorAll('button')],first=els[0],last=els.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
      // The print viewer owns focus; app row shortcuts must not change work behind it.
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown',key,true);
    return()=>{document.body.style.overflow=overflow;window.removeEventListener('keydown',key,true);prior?.focus();};
  },[open]);
  const save=()=>{
    const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg.current)],{type:'image/svg+xml'}));
    const a=document.createElement('a');a.href=url;a.download=`Folio-impression-${date}.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const tilt=e=>{
    if(e.pointerType==='touch'||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const r=e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--rx',`${-(e.clientY-r.top-r.height/2)/r.height*7}deg`);
    e.currentTarget.style.setProperty('--ry',`${(e.clientX-r.left-r.width/2)/r.width*7}deg`);
  };
  return <div className="f-print-object"><span className="f-print-pin" aria-hidden="true"/><button ref={trigger} className="f-print" aria-label="Open today's art print" onClick={()=>setOpen(true)} onPointerMove={tilt} onPointerLeave={e=>{e.currentTarget.style.setProperty('--rx','0deg');e.currentTarget.style.setProperty('--ry','0deg');}}><Impression rows={rows} date={date}/><span className="f-print-open">Your day, in an edition of one. <span>Open print ↗</span></span></button>
    {open&&createPortal(<div className="f-gallery" onClick={()=>setOpen(false)}><section ref={dialog} className="f-gallery-content" role="dialog" aria-modal="true" aria-label="Your daily art print" onClick={e=>e.stopPropagation()}><div className="f-gallery-heading"><span>AN EDITION OF ONE / {date}</span><button className="f-circle-button" aria-label="Close print" onClick={()=>setOpen(false)}>×</button></div><Impression rows={rows} date={date} svgRef={svg}/><div className="f-gallery-bottom"><div><h2>A small record of<br/><em>what mattered.</em></h2><p>Every finished task leaves a mark.<br/>Keep this moment as a vector art print.</p></div><button className="w-switch" onClick={save}>Collect this print ↓</button></div></section></div>,document.body)}
  </div>;
}

export function BookArt({index=0,progress=0}) {
  return <svg className="f-book-art" viewBox="0 0 260 200" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth=".7">{Array.from({length:30},(_,i)=><ellipse key={i} cx="130" cy="100" rx={38+i*2.2} ry={75-i*.8} transform={`rotate(${i*(3+index%5)+index*27} 130 100)`}/>)}</g><circle cx="130" cy="100" r="22" fill="var(--book-color)"/><text x="130" y="106" textAnchor="middle" fill="currentColor" fontFamily="Georgia,serif" fontSize="17">{Math.round(progress)}%</text></svg>;
}

export function FocusDial({elapsed,hours,time,running}) {
  const [visible,setVisible]=useState(!document.hidden);
  useEffect(()=>{const change=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',change);return()=>document.removeEventListener('visibilitychange',change);},[]);
  const percent=Math.min(1,elapsed/Math.max(1,hours*3600000));
  return <div className={'f-focus-dial'+(running&&visible?' is-running':'')}><svg viewBox="0 0 480 480" aria-hidden="true"><g className="f-focus-orbit" fill="none" stroke="#bc8163" strokeWidth=".6" opacity=".45">{Array.from({length:32},(_,i)=><ellipse key={i} cx="240" cy="240" rx={142+i*2.2} ry={216-i*1.7} transform={`rotate(${i*5.7} 240 240)`}/>)}</g>{Array.from({length:60},(_,i)=><line key={i} x1="240" y1={i%5?"20":"13"} x2="240" y2="25" stroke={i<percent*60?'#f1c2a1':'#6d625a'} strokeWidth={i%5?1:2} transform={`rotate(${i*6} 240 240)`}/>)}<circle cx="240" cy="240" r="122" fill="#251f22"/><circle cx="240" cy="240" r="124" fill="none" stroke="#e7a285" strokeWidth="1.5" pathLength="100" strokeDasharray={`${percent*100} 100`} transform="rotate(-90 240 240)"/></svg><div><span className="f-kicker">{running?'ATTENTION, UNDILUTED':'A MOMENT OF PAUSE'}</span><strong>{time}</strong><span className="f-kicker">{Math.round(percent*100)}% OF {hours}H ESTIMATE</span></div></div>;
}
