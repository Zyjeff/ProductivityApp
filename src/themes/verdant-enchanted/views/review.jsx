// review.jsx — the weekly review in the Verdant console. Stats
// always render; the AI retro is written once per week and cached.
// Identical behavior to the core contract.

import React, { useEffect, useMemo } from "react";
import { Icon, Eyebrow, Kbd } from "../components.jsx";
import { WeekBars } from "../charts.jsx";
import { PixelText, Sprite, Glyph, RuneRule } from "../art.jsx";
import * as D from "../../../core/domain.js";
import { useStore, getState, setUI, closeReview, patchReview } from "../../../core/store.js";
import { generateReviewRetro } from "../../../core/enrich.js";

export function ReviewOverlay() {
  const week = useStore((s) => s.ui.reviewWeek);
  if (!week) return null;
  return <Inner key={week} week={week} />;
}

function Inner({ week }) {
  const tasks = useStore((s) => s.tasks);
  const plan = useStore((s) => s.plan);
  const projects = useStore((s) => s.projects);
  const sessions = useStore((s) => s.sessions);
  const reviews = useStore((s) => s.reviews);
  const aiStatus = useStore((s) => s.ui.aiStatus);
  const meta = useStore((s) => s.meta);
  const hour = meta.dayStartHour || 0;

  const stats = useMemo(
    () => D.weeklyReviewData(tasks, plan, projects, sessions, week, hour),
    [tasks, plan, projects, sessions, week, hour]
  );
  const weeks = useMemo(() => {
    const all = D.reviewableWeeks(tasks, plan, hour);
    return all.includes(week) ? all : [week, ...all].sort().reverse();
  }, [tasks, plan, hour, week]);
  const idx = weeks.indexOf(week);
  const entry = reviews?.[week] || null;

  useEffect(() => {
    if (stats.total > 0 && (!entry || (!entry.attempted && !entry.text))) {
      generateReviewRetro(week, stats);
    }
  }, [week]);

  const maxSplit = Math.max(1, ...stats.effortSplit.map((e) => e.hours));


  return <div className="backdrop e-reflection-backdrop" onClick={closeReview}>
    <section className="console e-reflection" onClick={e=>e.stopPropagation()} aria-label="Weekly reflection">
      <header className="e-reflection-header"><Sprite kind="book" size={38}/><div><span className="e-eyebrow">THE WEEKLY CHRONICLE</span><h2>Weekly reflection</h2></div><nav aria-label="Reflection week"><button className="icon-btn" disabled={idx>=weeks.length-1} onClick={()=>setUI({reviewWeek:weeks[idx+1]})} aria-label="Older week"><Icon name="chevron"/></button><button className="icon-btn" disabled={idx<=0} onClick={()=>setUI({reviewWeek:weeks[idx-1]})} aria-label="Newer week"><Icon name="chevronR"/></button></nav><button className="icon-btn" onClick={closeReview} aria-label="Close"><Icon name="close"/></button></header>
      <div className="e-reflection-pages"><section className="e-reflection-page"><span className="e-eyebrow">I · THE RECORD</span><h3>{stats.label}</h3><RuneRule seed={1}/>
        <div className="e-week-score"><PixelText size={52}>{stats.total}</PixelText><span>intentions<br/>made real</span><Glyph seed={5} size={40}/></div>
        <div className="e-week-metrics"><span><strong>{stats.xp}</strong> XP earned</span><span><strong>{stats.focusMs?D.fmtMs(stats.focusMs):'—'}</strong> focused</span><span><strong>{stats.launched.length}</strong> grimoires sealed</span></div>
        <div className="e-week-chart"><WeekBars data={stats.perDay.map(d=>({label:d.label[0],value:d.count,title:d.iso+': '+d.count+' done · '+d.xp+' XP'+(d.focusMs?' · '+D.fmtMs(d.focusMs):''),isToday:stats.bestDay?d.iso===stats.bestDay.iso:false}))}/></div>
        <div className="e-week-observations">{stats.bestDay&&<span>Brightest day: {stats.bestDay.label} · {stats.bestDay.count} done</span>}{stats.accuracy&&<span>Estimates ran {stats.accuracy.factor}× · {stats.accuracy.n} tasks</span>}{stats.adriftNow>0&&<span>{stats.adriftNow} overdue now</span>}</div>
        {stats.launched.length>0&&<div className="e-week-sealed"><Eyebrow>Sealed this week</Eyebrow>{stats.launched.map(l=><span key={l.title}><Sprite kind="book" size={22}/>{l.title}</span>)}</div>}
      </section><section className="e-reflection-page"><span className="e-eyebrow">II · WHAT REMAINS</span><h3>A little perspective.</h3><RuneRule seed={3}/>
        {stats.total===0?<div className="e-reflection-empty"><Sprite kind="quill" size={60}/><p>Nothing logged this week — no completions, no focus sessions.</p>{weeks.length>1&&idx<weeks.length-1&&<button className="bezel" onClick={()=>setUI({reviewWeek:weeks[idx+1]})}>← Older week</button>}</div>:<>
          {stats.effortSplit.length>0&&<section className="e-week-effort"><Eyebrow>Where the hours went</Eyebrow>{stats.effortSplit.map(e2=><div key={e2.id}><span>{e2.title}</span><b>{e2.hours}h</b><div className="meter"><div className="meter-fill" style={{width:(e2.hours/maxSplit)*100+'%',backgroundColor:e2.color}}/></div></div>)}</section>}
          <section className="e-week-retro"><Eyebrow right={entry?.text?<button className="icon-btn" title="Rewrite the retro" onClick={()=>{patchReview(week,{text:null,attempted:false});generateReviewRetro(week,stats);}}><Icon name="reset"/></button>:null}>The retro</Eyebrow>{entry?.text?<p>{entry.text}</p>:entry?.attempted&&aiStatus!=='busy'?<p>AI is off — the numbers above stand on their own. <button className="link" onClick={()=>generateReviewRetro(week,stats)}>Retry</button></p>:<p>Writing the retro…</p>}</section>
        </>}
      </section></div><footer className="e-reflection-footer"><Glyph seed={7} size={18}/><span>Small things, steadily done.</span><Kbd>Esc</Kbd></footer>
    </section>
  </div>;
}
