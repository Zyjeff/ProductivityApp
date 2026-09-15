// Verdant presentation. State and mutations use the shared core contract.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Eyebrow, Stamp, Meter, Kbd } from "../components.jsx";
import { WeatherBars, CalRow } from "../charts.jsx";
import { registerActiveList } from "../../../core/keys.js";
import { Heading, Seal, Glyph, Segments } from "../art.jsx";
import { statementBg } from "../texture.js";
import * as D from "../../../core/domain.js";
import { useStore, getState, setUI, setDayStartHour, exportData, importDataFromFile, enterPreview, exitPreview, notify, openReview } from "../../../core/store.js";
import { listBackups } from "../../../core/db.js";
import { useThemeId, setThemeId } from "../../../core/theme.js";
import { THEMES } from "../../registry.js";

export function LogbookPage() {
  const open = useStore((s) => s.ui.statsOpen);
  if (!open) return null;
  return <Inner />;
}

function Inner() {
  const tasks = useStore((s) => s.tasks);
  const plan = useStore((s) => s.plan);
  const projects = useStore((s) => s.projects);
  const screen = useStore((s) => s.screen);
  const sessions = useStore((s) => s.sessions);
  const reviews = useStore((s) => s.reviews);
  const achievements = useStore((s) => s.achievements);
  const meta = useStore((s) => s.meta);
  const previewMode = useStore((s) => s.ui.previewMode);
  const themeId = useThemeId();
  const fileRef = useRef(null);
  const hour = meta.dayStartHour || 0;

  const derived = useMemo(() => {
    const total = D.totalXP(tasks, plan, meta.xpBaseline, hour);
    const activity = D.activityByDay(tasks, plan, hour);
    const activeDays = activity.size;
    let firstIso = null;
    for (const iso of activity.keys()) if (!firstIso || iso < firstIso) firstIso = iso;
    return {
      total,
      level: D.levelInfo(total),
      streakRun: D.streak(tasks, plan, hour),
      count: D.completedCount(tasks),
      launched: projects.filter((p) => p.completedAt).length,
      activeDays,
      firstIso,
    };
  }, [tasks, plan, projects, meta, hour]);

  // 30-day averages — all derived from the ledgers.
  const avg30 = useMemo(() => {
    const anchor = D.effectiveToday(hour);
    const xpMap = D.xpByDay(tasks, plan, hour);
    const activity = D.activityByDay(tasks, plan, hour);
    const focusMap = D.focusMsByDay(sessions || []);
    let xp = 0, focus = 0, activeDays = 0;
    for (let i = 0; i < 30; i++) {
      const iso = D.isoDate(D.addDays(anchor, -i));
      xp += xpMap.get(iso) || 0;
      focus += focusMap.get(iso) || 0;
      if (activity.has(iso)) activeDays += 1;
    }
    return {
      xpPerDay: Math.round(xp / 30),
      focusPerDay: focus / 30 / 3600000,
      activeRate: Math.round((activeDays / 30) * 100),
      adriftNow: D.getMissedWork(tasks, plan, hour).length,
    };
  }, [tasks, plan, sessions, hour]);

  const cal = useMemo(() => D.calibration(tasks, sessions), [tasks, sessions]);
  const focusTotal = (sessions || []).reduce((s, x) => s + (x.ms || 0), 0);

  const screen14 = useMemo(() => {
    const out = [];
    const anchor = D.effectiveToday(hour);
    for (let i = 13; i >= 0; i--) {
      const iso = D.isoDate(D.addDays(anchor, -i));
      const e = screen[iso] || {};
      out.push({
        iso,
        opens: (e.xOpens || 0) + (e.ytOpens || 0),
        x: e.xOpens || 0, yt: e.ytOpens || 0,
        mobile: e.mobileHours ?? null,
      });
    }
    return out;
  }, [screen, hour]);
  const s7 = screen14.slice(7);
  const totX = s7.reduce((s, d) => s + d.x, 0);
  const totYT = s7.reduce((s, d) => s + d.yt, 0);
  const mVals = s7.filter((d) => d.mobile != null).map((d) => d.mobile);
  const avgMobile = mVals.length ? (mVals.reduce((s, v) => s + v, 0) / mVals.length).toFixed(1) + "h" : "—";

  const weeks = useMemo(() => D.reviewableWeeks(tasks, plan, hour, 8), [tasks, plan, hour]);
  const weekNo = (iso) => {
    const d = D.parseIsoDate(iso);
    const onejan = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  };

  const nextLevelName = derived.level.lvl < D.LEVEL_NAMES.length ? D.LEVEL_NAMES[derived.level.lvl] : null;
  const nextThreshold = D.LEVEL_THRESHOLDS[derived.level.lvl] ?? null;

  const ctx = { tasks, plan, projects, dayStartHour: hour, baseline: meta.xpBaseline };
  const presets = [
    { label: "Standard", hourVal: 0, hint: "day rolls at midnight" },
    { label: "Late", hourVal: 22, hint: "rolls at 10pm" },
    { label: "Overnight", hourVal: 4, hint: "rolls at 4am — late-night work counts as today" },
  ];
  const backups = listBackups();
  const sinceLabel = derived.firstIso
    ? D.parseIsoDate(derived.firstIso).toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase()
    : "TODAY";


  useEffect(()=>{registerActiveList('codex',[]);},[]);
  const [chapter,setChapter]=useState('Overview');
  const importBackup=e=>{const f=e.target.files?.[0];if(!f)return;const mode=window.confirm('Merge this backup with current data? Cancel to choose Replace.')?'merge':window.confirm('Replace all current data with this backup?')?'replace':null;if(mode)importDataFromFile(f,mode).catch(err=>notify(String(err.message||err)));e.target.value='';};
  return <div className="v-codex"><Heading eyebrow="THE CODEX" title="Every little thing adds up." subtitle={'Your record, since '+sinceLabel.toLowerCase()+'.'}><button className="bezel" onClick={()=>openReview()}>Weekly reflection <Kbd>W</Kbd></button></Heading>
    <div className="v-chapter-tabs" role="tablist" aria-label="Codex chapters">{['Overview','Relics','Screen log','Settings'].map((name,i)=><button key={name} role="tab" aria-selected={name===chapter} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();const tabs=[...e.currentTarget.parentElement.querySelectorAll('[role=tab]')];tabs[(i+(e.key==='ArrowRight'?1:3))%4].click();tabs[(i+(e.key==='ArrowRight'?1:3))%4].focus();}}} aria-controls="v-chapter" onClick={()=>setChapter(name)}><Glyph seed={i+1} size={18}/>{name}{name==='Relics'&&<span>{achievements.length}/{D.ACHIEVEMENTS.length}</span>}</button>)}</div>
    <div id="v-chapter" role="tabpanel" aria-label={chapter}>
    {chapter==='Overview'&&<><section className="v-codex-overview"><div className="v-level-seal"><Seal pct={derived.level.pct} compact seed={derived.level.lvl}/><div><span className="v-eyebrow">LEVEL {derived.level.lvl}</span><h2>{derived.level.title}</h2><p>{derived.total.toLocaleString()} lifetime XP · {derived.level.xpToNext} to next level</p><Segments pct={derived.level.pct}/>{nextLevelName&&<small>Next: {nextLevelName} · {nextThreshold} XP</small>}</div></div><div className="v-summary-stack">{[['Day streak',derived.streakRun],['Tasks completed',derived.count],['Projects launched',derived.launched]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>
      <section className="v-codex-columns"><div className="v-panel"><Eyebrow>30 days of momentum</Eyebrow><CalRow label="XP / day" pct={Math.min(100,avg30.xpPerDay/150*100)} value={avg30.xpPerDay}/><CalRow label="Focus / day" pct={Math.min(100,avg30.focusPerDay/5*100)} value={avg30.focusPerDay.toFixed(1)+'h'}/><CalRow label="Active days" pct={avg30.activeRate} value={avg30.activeRate+'%'}/><CalRow label="Overdue now" pct={Math.min(100,avg30.adriftNow*12)} value={avg30.adriftNow}/></div><div className="v-panel"><Eyebrow>Estimate calibration · 60 days</Eyebrow>{cal.overall.n<3?<p>Not enough finished, focused work to calibrate yet ({cal.overall.n}/3 tasks). Focus sessions help reveal your natural pace. {focusTotal>0&&<>Logged: {D.fmtMs(focusTotal)}.</>}</p>:<><h2>{cal.overall.factor}× <small>actual / estimate</small></h2><p>{cal.overall.n} tasks · {D.fmtMs(focusTotal)} focused</p>{Object.entries(cal.byDifficulty).map(([key,v])=><CalRow key={key} label={key+' (n='+v.n+')'} pct={v.factor?Math.min(100,v.factor*50):0} value={v.n>=2&&v.factor?v.factor+'×':'—'}/>)}</>}</div></section>
      <section className="v-panel"><Eyebrow>Reflections</Eyebrow>{weeks.length?weeks.map(w=><div className="manifest-row" key={w}><Glyph seed={w} size={19}/><span>{D.fmtWeekLabel(D.parseIsoDate(w))}</span><p>{reviews[w]?.text?.slice(0,95)||'Your week in numbers, ready to revisit.'}</p><button className="link" onClick={()=>openReview(w)}>Open ↗</button></div>):<p>Your first week of activity will appear here.</p>}</section>
    </>}
    {chapter==='Relics'&&<><div className="v-relic-heading"><h2>A cabinet of small victories.</h2><p>Earned through the work you do. Nothing extra to chase.</p></div><section className="v-relic-grid">{D.ACHIEVEMENTS.map((a,i)=>{const done=achievements.includes(a.id),prog=done?null:D.achievementProgress(a.id,ctx),pct=done?100:prog?Math.min(100,prog.cur/prog.target*100):0;return <article className={'v-relic'+(done?' is-earned':'')} key={a.id}><div className="v-relic-icon"><Glyph seed={i} size={38}/></div><span className="v-eyebrow">{done?'UNLOCKED':'UNDISCOVERED'}</span><h3>{a.title}</h3><p>{a.desc}</p><Segments pct={pct} count={16}/><small>{done?'Relic acquired':prog?prog.cur+' / '+prog.target:'Keep exploring'}</small></article>;})}</section></>}
    {chapter==='Screen log'&&<section className="v-screen-chapter"><Heading eyebrow="LAST 7 DAYS" title="Notice where your attention goes."/><div className="v-screen-totals"><span><strong>{totX}</strong>X opens</span><span><strong>{totYT}</strong>YouTube opens</span><span><strong>{avgMobile}</strong>Average mobile hours</span></div><div className="v-screen-chart">{s7.map(d=><div key={d.iso}><div className="v-screen-bars" title={d.iso+': '+d.x+' X, '+d.yt+' YouTube'}><i style={{height:(d.x/Math.max(1,...s7.map(x=>x.opens))*100)+'%'}}/><i style={{height:(d.yt/Math.max(1,...s7.map(x=>x.opens))*100)+'%'}}/></div><b>{d.opens}</b><span>{D.parseIsoDate(d.iso).toLocaleDateString('en-GB',{weekday:'short'})}</span><small>{d.mobile==null?'—':d.mobile+'h mobile'}</small></div>)}</div><p><span className="v-chart-key"/> X opens <span className="v-chart-key v-chart-key--yt"/> YouTube opens</p><div className="v-panel"><Eyebrow>Mobile hours</Eyebrow><WeatherBars height={65} data={s7.map(d=>({value:d.mobile??0,title:d.iso+': '+(d.mobile??'Not logged')+'h'}))}/></div></section>}
    {chapter==='Settings'&&<div className="v-settings"><section><div><Glyph seed={4}/><h2>Make it yours.</h2><p>Choose a world for your work.</p></div><div className="v-theme-grid">{THEMES.map(t=><button key={t.id} aria-pressed={themeId===t.id} title={t.tagline} onClick={()=>setThemeId(t.id)} className={'v-theme-choice'+(themeId===t.id?' is-selected':'')}><span>{t.name}</span><small>{t.tagline}</small>{themeId===t.id&&<Icon name="check"/>}</button>)}</div></section><section><div><Glyph seed={5}/><h2>When does your day begin?</h2><p>Late-night work can count toward the previous day.</p></div><div className="v-settings-control"><label>Rollover hour <input type="number" className="field" min="0" max="23" value={hour} aria-label="Day rollover hour" onChange={e=>setDayStartHour(e.target.value)}/></label><div className="v-button-row">{presets.map(p=><button key={p.label} className={'bezel'+(hour===p.hourVal?' is-selected':'')} title={p.hint} onClick={()=>setDayStartHour(p.hourVal)}>{p.label} · {String(p.hourVal).padStart(2,'0')}:00</button>)}</div></div></section><section><div><Glyph seed={2}/><h2>Your work, kept safe.</h2><p>Backups, transfers, and a sample workspace.</p></div><div><div className="v-button-row"><button className="bezel" onClick={exportData} disabled={previewMode}>Export backup (JSON)</button><input ref={fileRef} hidden type="file" accept=".json,application/json" onChange={importBackup}/><button className="bezel" disabled={previewMode} onClick={()=>fileRef.current?.click()}>Import backup</button><button className="bezel" onClick={previewMode?exitPreview:enterPreview}>{previewMode?'Exit preview':'Preview with sample data'}</button></div><p className="v-settings-note">7 rotating daily backups{backups.length?' · Latest: '+backups[0].day:''}. Import supports existing Werf and Quest backups.</p>{meta.migratedFrom&&<p>Migration provenance: {Object.entries(meta.migratedFrom).filter(([,v])=>v).map(([key])=>key).join(', ')} · Lifetime XP preserved.</p>}</div></section></div>}
    </div></div>;
}
