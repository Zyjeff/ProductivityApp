// logbook.jsx — the KUROMI NOTE diary: a full-page overlay. Crime
// record (rank), the spree tiles, lights-out (day rollover), the
// costume rack (theme picker), the boring adult stuff (data tools),
// the 30-day crime spree, the lie detector (calibration), bad-habits
// weather, the sticker collection (trophies), and past REWINDS.

import React, { useMemo, useRef } from "react";
import { Icon, Meter, Kbd } from "../components.jsx";
import { ScreenBars, CalRow } from "../charts.jsx";
import { GhostSkull } from "../chrome.jsx";
import { statementBg } from "../texture.js";
import * as D from "../../../core/domain.js";
import { useStore, setUI, setDayStartHour, exportData, importDataFromFile, enterPreview, exitPreview, notify, openReview } from "../../../core/store.js";
import { listBackups } from "../../../core/db.js";
import { useThemeId, setThemeId } from "../../../core/theme.js";
import { THEMES } from "../../registry.js";

export function DiaryPage() {
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

  const screen7 = useMemo(() => {
    const out = [];
    const anchor = D.effectiveToday(hour);
    for (let i = 6; i >= 0; i--) {
      const iso = D.isoDate(D.addDays(anchor, -i));
      const e = screen[iso] || {};
      out.push({
        label: "SMTWTFS"[D.parseIsoDate(iso).getDay()],
        x: e.xOpens || 0, yt: e.ytOpens || 0,
        mobile: e.mobileHours ?? null,
        title: `${iso}: ${e.xOpens || 0} X · ${e.ytOpens || 0} YT · ${e.mobileHours ?? "—"}h phone`,
      });
    }
    return out;
  }, [screen, hour]);
  const totX = screen7.reduce((s, d) => s + d.x, 0);
  const totYT = screen7.reduce((s, d) => s + d.yt, 0);

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
    { label: "angel", hourVal: 0, hint: "day rolls at midnight" },
    { label: "night owl", hourVal: 22, hint: "rolls at 10pm" },
    { label: "nocturnal", hourVal: 4, hint: "rolls at 4am — after-midnight mischief counts as today" },
  ];
  const backups = listBackups();
  const sinceLabel = derived.firstIso
    ? D.parseIsoDate(derived.firstIso).toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase()
    : "TODAY";

  return (
    <div className="k-backdrop" style={{ zIndex: 50, padding: 0, alignItems: "stretch" }} role="dialog" aria-label="Kuromi Note diary">
      <div className="k-stage" style={{ overflowY: "auto", flex: 1, background: "var(--ground) var(--dither-grain)" }}>
        <div className="k-wrap">
          <div className="k-pagehead k-ghostwrap">
            <div className="k-ghost"><GhostSkull size={104} /></div>
            <div className="k-rowline" style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div className="k-title">KUROMI NOTE <span className="k-accent">— her diary. hands off.</span></div>
                <div className="k-sub">a criminal record since {sinceLabel} · {derived.activeDays} active day{derived.activeDays === 1 ? "" : "s"}</div>
              </div>
              <button className="k-btn" onClick={() => setUI({ statsOpen: false })} aria-label="Close diary">
                CLOSE <Kbd>Esc</Kbd>
              </button>
            </div>
          </div>

          <div className="k-diary-grid">
            {/* left column */}
            <div className="k-col">
              <div className="k-statement" style={{ ...statementBg("kuromi-rank-" + derived.level.lvl) }}>
                <div className="k-display" style={{ fontSize: 8, marginBottom: 9 }}>CRIME RECORD · CURRENT RANK</div>
                <div className="k-diary-rank">
                  <span className="k-rank-lv">{derived.level.lvl}</span>
                  <div>
                    <div className="k-rank-name">{derived.level.title.toUpperCase()}</div>
                    <div className="k-mono" style={{ fontSize: 14, color: "#5c1030", marginTop: 4 }}>
                      {derived.total} XP{derived.level.xpToNext > 0 ? ` · ${derived.level.xpToNext} to rank ${derived.level.lvl + 1}` : " · MAX — obviously"}
                    </div>
                  </div>
                </div>
                <div className="k-meter" style={{ marginTop: 12, background: "rgba(42,7,24,0.28)", borderColor: "rgba(42,7,24,0.4)" }}>
                  <div className="k-meter-fill" style={{ width: derived.level.pct + "%", background: "#2a0718" }} />
                </div>
                {nextLevelName && nextThreshold != null && (
                  <div className="k-mono" style={{ marginTop: 9, fontSize: 12.5, color: "#5c1030" }}>
                    NEXT RANK — {nextLevelName.toUpperCase()} AT {nextThreshold} XP
                  </div>
                )}
              </div>

              <div className="k-tiles">
                {[
                  { l: "Combo", v: `${derived.streakRun}d`, s: "days in a row" },
                  { l: "Pulled off", v: derived.count, s: "schemes total" },
                  { l: "Bosses beaten", v: derived.launched, s: "in the hall of fame" },
                ].map((x) => (
                  <div key={x.l} className="k-tile">
                    <div className="k-lab">{x.l}</div>
                    <div className="k-val">{x.v}</div>
                    <div className="k-sub2">{x.s}</div>
                  </div>
                ))}
              </div>

              <div className="k-plate k-plate-pad">
                <div className="k-eyebrow">LIGHTS OUT — WHEN THE DAY ROLLS OVER</div>
                <div className="k-rowline" style={{ marginBottom: 10 }}>
                  <span className="k-mono-sm k-dim" style={{ flex: 1 }}>TOMORROW STARTS AT</span>
                  <button className="k-btn is-sm" onClick={() => setDayStartHour(Math.max(0, hour - 1))}>−</button>
                  <input
                    type="number" min="0" max="23" value={hour} onChange={(e) => setDayStartHour(e.target.value)}
                    className="k-input k-mono" style={{ width: 58, textAlign: "center", padding: "4px 6px", color: "var(--amber-hot)" }}
                    aria-label="Day rollover hour"
                  />
                  <button className="k-btn is-sm" onClick={() => setDayStartHour(Math.min(23, hour + 1))}>+</button>
                </div>
                <div className="k-rowline" style={{ flexWrap: "wrap", gap: 5 }}>
                  {presets.map((p) => (
                    <button
                      key={p.label} title={p.hint} onClick={() => setDayStartHour(p.hourVal)}
                      className={"k-chip" + (hour === p.hourVal ? " is-on" : "")}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="k-faint k-sm" style={{ marginTop: 9 }}>
                  Set past 0 and after-midnight mischief still counts as today. As it should.
                </div>
              </div>

              <div className="k-plate k-plate-pad">
                <div className="k-eyebrow">COSTUME RACK</div>
                <div className="k-costumes">
                  {THEMES.map((t) => (
                    <button key={t.id} title={t.tagline} onClick={() => setThemeId(t.id)} className={"k-costume" + (themeId === t.id ? " is-on" : "")}>
                      <span className="k-c-name">{t.name}</span>
                      {themeId === t.id && <span className="k-c-check">WEARING</span>}
                    </button>
                  ))}
                </div>
                <div className="k-faint k-sm" style={{ marginTop: 9 }}>
                  Same crimes, different outfit. Your data never changes.
                </div>
              </div>

              <div className="k-plate k-plate-pad">
                <div className="k-eyebrow is-dim">THE BORING ADULT STUFF</div>
                <div className="k-col" style={{ gap: 7 }}>
                  <button className="k-btn" onClick={exportData}>EXPORT THE EVIDENCE (JSON)</button>
                  <input
                    ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const mode = window.confirm("OK = MERGE with current data (safe). Cancel = choose replace on the next dialog.")
                        ? "merge"
                        : window.confirm("REPLACE all current data with the backup? This overwrites everything (a daily auto-backup exists).") ? "replace" : null;
                      if (mode) importDataFromFile(f, mode).catch((err) => notify(String(err.message || err)));
                      e.target.value = "";
                    }}
                  />
                  <button className="k-btn" onClick={() => fileRef.current?.click()}>IMPORT A MANIFEST (WERF OR QUEST)</button>
                  {previewMode
                    ? <button className="k-btn is-danger" onClick={exitPreview}>EXIT REHEARSAL</button>
                    : <button className="k-btn" onClick={enterPreview}><Icon name="bolt" size={11} /> REHEARSE WITH SAMPLE MISCHIEF</button>}
                </div>
                <div className="k-faint k-sm" style={{ marginTop: 9, lineHeight: 1.5 }}>
                  Auto-backup keeps the last 7 days in local storage{backups.length ? ` (latest: ${backups[0].day})` : ""}. Export weekly if you're paranoid. You should be.
                </div>
                {meta.migratedFrom && (
                  <div className="k-mono-sm k-faint" style={{ marginTop: 6 }}>
                    migrated from: {[meta.migratedFrom.quest && "quest", meta.migratedFrom.vsq && "vsq", meta.migratedFrom.shiplist && "shiplist"].filter(Boolean).join(" + ")} · lifetime XP preserved
                  </div>
                )}
              </div>
            </div>

            {/* right column */}
            <div className="k-col">
              <div className="k-plate k-plate-pad">
                <div className="k-eyebrow">THE 30-DAY CRIME SPREE</div>
                {[
                  { l: "Chaos per day", v: avg30.xpPerDay + " XP", pct: Math.min(100, (avg30.xpPerDay / 150) * 100), tone: undefined },
                  { l: "Mischief hours", v: avg30.focusPerDay >= 0.05 ? avg30.focusPerDay.toFixed(1) + "H" : "—", pct: Math.min(100, (avg30.focusPerDay / 5) * 100), tone: "violet" },
                  { l: "Active days", v: avg30.activeRate + "%", pct: avg30.activeRate, tone: "green" },
                  { l: "Busted right now", v: avg30.adriftNow, pct: Math.min(100, avg30.adriftNow * 12), tone: "warn" },
                ].map((x) => (
                  <div key={x.l} style={{ marginBottom: 10 }}>
                    <div className="k-rowline k-mono-sm" style={{ marginBottom: 4 }}>
                      <span className="k-dim">{x.l}</span>
                      <span className="k-spacer" />
                      <span className="k-pink">{x.v}</span>
                    </div>
                    <Meter pct={x.pct} tone={x.tone} />
                  </div>
                ))}
              </div>

              <div className="k-plate k-plate-pad">
                <div className="k-eyebrow">LIE DETECTOR · LAST 60 DAYS</div>
                {cal.overall.n < 3 ? (
                  <div className="k-faint k-sm" style={{ lineHeight: 1.6 }}>
                    Not enough evidence to convict you yet ({cal.overall.n}/3 focused, finished schemes).
                    Run MISCHIEF MODE on real schemes and this becomes your estimates-vs-reality mirror.
                    {focusTotal > 0 && <> Logged so far: {D.fmtMs(focusTotal)}.</>}
                  </div>
                ) : (
                  <>
                    <div className="k-rowline" style={{ alignItems: "baseline", marginBottom: 12 }}>
                      <span className="k-display" style={{ fontSize: 22, color: cal.overall.factor > 1.15 ? "var(--warn)" : cal.overall.factor < 0.9 ? "var(--channel)" : "var(--starboard)" }}>
                        {cal.overall.factor}×
                      </span>
                      <span className="k-dim k-sm">
                        reality vs your guesses · {cal.overall.n} schemes · {D.fmtMs(focusTotal)} in mischief mode
                      </span>
                    </div>
                    {Object.entries(cal.byDifficulty).map(([k, v]) =>
                      v.factor && v.n >= 2
                        ? <CalRow key={k} label={k} factor={v.factor} n={v.n} />
                        : null
                    )}
                    <div className="k-faint k-sm" style={{ marginTop: 10 }}>
                      The imp reads these when scoring new schemes — your lies train it.
                    </div>
                  </>
                )}
              </div>

              <div className="k-plate k-plate-pad">
                <div className="k-eyebrow">BAD HABITS WEATHER · 7 DAYS</div>
                <div className="k-rowline k-mono-sm k-faint" style={{ marginBottom: 10, gap: 12 }}>
                  <span>7D: {totX} X · {totYT} YT</span>
                </div>
                <ScreenBars days={screen7} />
              </div>

              <div className="k-plate k-plate-pad">
                <div className="k-eyebrow">STICKER COLLECTION · {achievements.length}/{D.ACHIEVEMENTS.length}</div>
                <div className="k-stickers">
                  {D.ACHIEVEMENTS.map((a) => {
                    const done = achievements.includes(a.id);
                    const prog = !done ? D.achievementProgress(a.id, ctx) : null;
                    const pct = prog ? Math.min(100, Math.round((prog.cur / prog.target) * 100)) : 0;
                    return (
                      <div key={a.id} className={"k-sticker" + (done ? " is-earned" : "")}>
                        <span className="k-s-ico" style={{ filter: done ? "none" : "grayscale(1)", opacity: done ? 1 : 0.45 }}>★</span>
                        <div className="k-s-name">{a.title.toUpperCase()}</div>
                        <div className="k-s-desc">{a.desc}</div>
                        {!done && prog && (
                          <>
                            <Meter pct={pct} />
                            <div className="k-mono-sm k-faint" style={{ marginTop: 4 }}>{prog.cur}/{prog.target}</div>
                          </>
                        )}
                        {!done && !prog && <div className="k-mono-sm k-faint" style={{ marginTop: 8 }}>—</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="k-plate k-plate-pad">
                <div className="k-eyebrow is-violet">PAST REWINDS</div>
                {weeks.length === 0 ? (
                  <div className="k-faint k-sm">No weeks worth judging yet — the record starts when the mischief does.</div>
                ) : (
                  <div className="k-col" style={{ gap: 6 }}>
                    {weeks.map((w) => {
                      const entry = reviews?.[w];
                      const label = entry?.text
                        ? entry.text.slice(0, 64) + (entry.text.length > 64 ? "…" : "")
                        : "stats ready · no verdict written yet";
                      return (
                        <div key={w} className="k-rowline">
                          <span className="k-chip is-violet is-on">W{weekNo(w)}</span>
                          <span className="k-dim k-sm" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                          <button className="k-btn is-sm" onClick={() => { setUI({ statsOpen: false }); openReview(w); }}>REWIND →</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="k-mt">
                  <button className="k-btn is-sm" onClick={() => { setUI({ statsOpen: false }); openReview(); }}>
                    WEEKLY REWIND <Kbd>W</Kbd>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
