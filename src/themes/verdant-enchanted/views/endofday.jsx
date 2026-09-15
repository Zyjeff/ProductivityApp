// endofday.jsx — lowering the flag: recap, roll-forward, screen log.
// Identical behavior to the core contract.

import React, { useMemo, useState } from "react";
import { PixelText, RuneRule, Sprite, Glyph } from "../art.jsx";
import { Icon } from "../components.jsx";
import * as D from "../../../core/domain.js";
import { useStore, getState, setUI, closeDay, patchScreenToday } from "../../../core/store.js";

export function EndOfDayDialog() {
  const open = useStore((s) => s.ui.endOfDayOpen);
  if (!open) return null;
  return <Inner />;
}

function Inner() {
  const s = useStore(state=>state);
  const hour = s.meta.dayStartHour || 0;
  const todayIso = D.effectiveTodayIso(hour);
  const [rollForward, setRollForward] = useState(true);
  const [mobile, setMobile] = useState("");

  const { completedToday, xpToday, unfinished } = useMemo(() => {
    const activity = D.activityByDay(s.tasks, s.plan, hour).get(todayIso) || new Set();
    const completedToday = s.tasks.filter((t) => activity.has(t.id));
    const entry = (s.plan || []).find((e) => e.date === todayIso);
    const byId = new Map(s.tasks.map((t) => [t.id, t]));
    const unfinished = (entry?.items || [])
      .filter((it) => !it.done)
      .map((it) => byId.get(it.taskId))
      .filter((t) => t && !t.completed);
    return { completedToday, xpToday: D.todayXP(s.tasks, s.plan, hour), unfinished };
  }, []);

  const screenEntry = s.screen[todayIso] || { xOpens: 0, ytOpens: 0, mobileHours: null };

  return <div className="backdrop e-day-backdrop" onClick={()=>setUI({endOfDayOpen:false})}><section className="console e-day-receipt v-receipt" onClick={e=>e.stopPropagation()}><header className="console-head"><span className="e-eyebrow">THE LAST INSCRIPTION</span><span style={{flex:1}}/><button className="icon-btn" aria-label="Close" onClick={()=>setUI({endOfDayOpen:false})}><Icon name="close"/></button></header><div className="e-day-receipt-body"><Sprite kind="hourglass" size={58}/><h1><PixelText size={24}>SEAL THE DAY</PixelText></h1><p>{completedToday.length?'You made something of today.':'Tomorrow is another beginning.'}</p><RuneRule/><div className="e-day-receipt-stats"><div><strong>{completedToday.length}</strong><span>COMPLETE</span></div><Glyph seed={3} size={26}/><div><strong>{xpToday}</strong><span>XP EARNED</span></div></div>{completedToday.length>0&&<div className="e-receipt-list">{completedToday.map(t=><div key={t.id}><Icon name="check" size={11}/><span>{t.title}</span></div>)}</div>}{unfinished.length>0&&<section className="e-receipt-unfinished"><label><input type="checkbox" checked={rollForward} onChange={e=>setRollForward(e.target.checked)}/> Roll to next working day</label><p>{unfinished.length} unfinished intentions</p>{unfinished.map(t=><div key={t.id}>{t.title}</div>)}</section>}<div className="e-receipt-screen"><span className="e-form-label">Screen time</span>{screenEntry.mobileHours!=null?<p>{screenEntry.mobileHours}h mobile · {screenEntry.xOpens||0} X · {screenEntry.ytOpens||0} YT</p>:<div className="e-form-row"><input type="number" min="0" max="24" step="0.5" className="field" placeholder="Mobile hours (optional)" value={mobile} onChange={e=>setMobile(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&mobile){patchScreenToday({mobileHours:parseFloat(mobile)||0});setMobile('');}}}/><button className="bezel" disabled={!mobile} onClick={()=>{patchScreenToday({mobileHours:parseFloat(mobile)||0});setMobile('');}}>Log</button></div>}</div><button className="switch" onClick={()=>closeDay({rollForward:rollForward&&unfinished.length>0})}><Icon name="moon"/> Close the day</button><p className="e-form-note">The ritual ends. The progress remains.</p></div></section></div>;
}
