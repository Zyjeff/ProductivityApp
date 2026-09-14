import React, { useMemo } from 'react';

export function PressMark({size=30}) {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="5" fill="currentColor"/>{Array.from({length:12},(_,i)=><path key={i} d="M20 3V12M18 4L20 3L22 4" stroke="currentColor" strokeWidth="1.5" transform={`rotate(${i*30} 20 20)`}/>)}</svg>;
}

// One stable print per effective day. Progress reads the actual ordered lineup.
export function DailyPrint({rows=[],date}) {
  const done=rows.filter(r=>r.doneHere).length;
  const paths=useMemo(()=>Array.from({length:52},(_,i)=>{
    const seed=[...date].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);
    const points=[];
    for(let j=0;j<=240;j++) {
      const a=j/240*Math.PI*2;
      const r=110+31*Math.sin(3*a+i*.086+(seed%360)*Math.PI/180);
      const twist=i*(.022+(seed%9)*.001);
      const x=230+Math.cos(a+twist)*r*(.57+i*.009);
      const y=213+Math.sin(a+twist)*r*(1.03-i*.004);
      points.push((j?'L':'M')+x.toFixed(2)+','+y.toFixed(2));
    }
    return points.join(' ')+'Z';
  }),[date]);
  return <figure className="f-print">
    <div className="f-print-top"><span>FIG. 01 — AN IMPRESSION OF TODAY</span><span>F / {date.slice(-2)}</span></div>
    <svg className="f-print-art" viewBox="0 0 460 430" role="img" aria-label={`${done} of ${rows.length} tasks complete. Each mark around the print represents one task.`}>
      <defs><linearGradient id="folio-ink" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#863347"/><stop offset=".6" stopColor="#a34636"/><stop offset="1" stopColor="#c86542"/></linearGradient></defs>
      <path d="M20 36V20H36M424 20H440V36M440 394V410H424M36 410H20V394" stroke="#ae7665" strokeWidth=".8" fill="none"/>
      <path d="M230 16V36M220 26H240M230 394V414M220 404H240M12 215H32M22 205V225M428 215H448M438 205V225" stroke="#ae7665" strokeWidth=".7"/>
      <g fill="none" stroke="url(#folio-ink)" strokeWidth=".65" opacity=".86">{paths.map((d,i)=><path d={d} key={i}/>)}</g>
      <circle cx="230" cy="213" r="169" fill="none" stroke="#af7c69" strokeDasharray="1 5" strokeWidth=".7"/>
      {rows.map((r,i)=>{const a=i/rows.length*Math.PI*2-Math.PI/2;return <circle key={r.task.id} cx={230+169*Math.cos(a)} cy={213+169*Math.sin(a)} r={r.doneHere?4.5:3} fill={r.doneHere?'#7c293b':'#efddc9'} stroke="#7c293b" strokeWidth="1"><title>{r.task.title}: {r.doneHere?'complete':'pending'}</title></circle>})}
      <text x="230" y="210" textAnchor="middle" className="f-print-count">{String(done).padStart(2,'0')}</text>
      <text x="230" y="233" textAnchor="middle" className="f-print-small">OF {String(rows.length).padStart(2,'0')} IMPRESSIONS</text>
    </svg>
    <figcaption><span>Progress takes its own shape.</span><span>LIVE PRINT <i/></span></figcaption>
  </figure>;
}

export function FocusDial({elapsed,hours,time,running}) {
  const percent=Math.min(1,elapsed/Math.max(1,hours*3600000));
  return <div className={'f-focus-dial'+(running?' is-running':'')}><svg viewBox="0 0 340 340" aria-hidden="true">
    {Array.from({length:60},(_,i)=><line key={i} x1="170" y1={i%5?"20":"13"} x2="170" y2="25" stroke={i<percent*60?'#e7a285':'#6d625a'} strokeWidth={i%5?1:2} transform={`rotate(${i*6} 170 170)`}/>)}
    <circle cx="170" cy="170" r="123" fill="none" stroke="#63564f" strokeWidth=".7"/>
    <circle cx="170" cy="170" r="123" fill="none" stroke="#e7a285" strokeWidth="2" pathLength="100" strokeDasharray={`${percent*100} 100`} transform="rotate(-90 170 170)"/>
  </svg><div><span className="f-kicker">{running?'ATTENTION, UNDILUTED':'A MOMENT OF PAUSE'}</span><strong>{time}</strong><span className="f-kicker">{Math.round(percent*100)}% OF {hours}H ESTIMATE</span></div></div>;
}
