// Ledger.jsx — "what the yard remembers". Nightwatch renders the
// Ledger as a full-page overlay (same statsOpen state, same `4` and
// Esc): level stack with NEXT RANK, 30-day averages, estimate
// calibration, screen weather, trophies, reviews, rollover, data
// tools, Switch deck picker. Every capability of the Drydock panel ships
// here, recomposed.

import React, { useMemo, useRef, useState } from "react";
import { Icon, Eyebrow, Stamp, Meter, Kbd } from "../components.jsx";
import { CalRow, WeekBars } from "../charts.jsx";
import { statementBg } from "../texture.js";
import * as D from "../../../core/domain.js";
import { useStore, getState, setUI, setDayStartHour, exportData, importDataFromFile, enterPreview, exitPreview, notify, openReview } from "../../../core/store.js";
import { listBackups } from "../../../core/db.js";
import { useThemeId, setThemeId } from "../../../core/theme.js";
import { THEMES } from "../../registry.js";

export function LedgerPage() {
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
  const mVals = screen14.filter((d) => d.mobile != null).map((d) => d.mobile);
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

  return (
    <div className="r-ledger" role="dialog" aria-label="Ledger">
      <aside className="r-ledger-rail">
        <div className="r-lab r-lab--lit" style={{ padding: "4px 8px 12px" }}>/ledger</div>
        <button className="r-stage-btn r-stage-btn--on" type="button">Rank</button>
        <button className="r-stage-btn" type="button">Trophies</button>
        <button className="r-stage-btn" type="button">Screen</button>
        <button className="r-stage-btn" type="button">Rollover</button>
        <button className="r-stage-btn" type="button">Data</button>
        <button className="r-stage-btn" type="button">Theme</button>
        <button className="r-btn r-btn--ghost r-btn--sm r-ledger-close" onClick={() => setUI({ statsOpen: false })}>
          Close <Kbd>Esc</Kbd>
        </button>
      </aside>
      <div className="r-ledger-main">
        <div style={{ marginBottom: 24 }}>
          <div className="r-lab" style={{ marginBottom: 10 }}>
            <span className="r-lab">Ledger · the record</span>
          </div>
          <div className="r-feed-head">
            <h1 className="r-display" style={{ fontSize: 26 }}>What the grid remembers.</h1>
            <div className="r-feed-counts">SINCE {sinceLabel} · {derived.activeDays} ACTIVE DAY{derived.activeDays === 1 ? "" : "S"}</div>
          </div>
        </div>

        <div style={{ paddingBottom: 56 }}>
          <div className="log-grid">
            {/* left column */}
            <div>
              <div className="r-plate" style={{ ...statementBg("level-" + derived.level.lvl) }} id="r-sec-rank">
                <div className="r-lab" style={{ marginBottom: 8 }}>Current rank</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span className="r-display r-num" style={{ fontSize: 42, color: "var(--channel)" }}>{derived.level.lvl}</span>
                  <span className="r-display" style={{ fontSize: 19 }}>{derived.level.title.toUpperCase()}</span>
                </div>
                <div className="r-spectrum"><div className="r-spectrum-fill" style={{ width: Math.min(100, derived.level.pct) + "%" }} /></div>
                <div className="r-num" style={{ marginTop: 10, fontSize: 10.5, color: "var(--ink)", opacity: 0.78 }}>
                  {derived.total} XP{derived.level.xpToNext > 0 ? ` · ${derived.level.xpToNext} TO LEVEL ${derived.level.lvl + 1}` : " · MAX"}
                </div>
                <div className="r-meter" style={{ marginTop: 10, background: "rgba(20,16,10,0.25)" }}>
                  <div className="r-meter-fill" style={{ width: derived.level.pct + "%", backgroundColor: "var(--ink)" }} />
                </div>
                {nextLevelName && nextThreshold != null && (
                  <div className="r-num" style={{ marginTop: 14, fontSize: 9.5, color: "var(--ink)", opacity: 0.65, lineHeight: 1.7 }}>
                    NEXT RANK — {nextLevelName.toUpperCase()} AT {nextThreshold} XP
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 26 }}>
                {[
                  { l: "Streak", v: `${derived.streakRun}d` },
                  { l: "Completed", v: derived.count },
                  { l: "Launched", v: derived.launched },
                ].map((x) => (
                  <div key={x.l} className="r-plate r-plate--flush" style={{ padding: "10px 12px" }}>
                    <div className="r-lab" style={{ fontSize: 8.5, marginBottom: 4 }}>{x.l}</div>
                    <div className="r-num" style={{ fontSize: 17, fontWeight: 600 }}>{x.v}</div>
                  </div>
                ))}
              </div>

              <div className="log-section">
                <div className="r-lab" style={{ marginBottom: 10 }}><span className="r-lab">Day rollover</span></div>
                <div className="r-plate" style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <span className="r-num" style={{ fontSize: 11, color: "var(--fg-dim)", flex: 1 }}>DAY STARTS AT</span>
                    <button className="r-btn r-btn--sm r-btn--ghost" onClick={() => setDayStartHour(Math.max(0, hour - 1))}>−</button>
                    <input type="number" min="0" max="23" value={hour} onChange={(e) => setDayStartHour(e.target.value)}
                      className="r-field r-num" style={{ width: 52, textAlign: "center", fontSize: 13, color: "var(--channel)", padding: "4px" }} aria-label="Day rollover hour" />
                    <button className="r-btn r-btn--sm r-btn--ghost" onClick={() => setDayStartHour(Math.min(23, hour + 1))}>+</button>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {presets.map((p) => (
                      <button key={p.label} title={p.hint} onClick={() => setDayStartHour(p.hourVal)}
                        className="r-btn r-btn--sm r-btn--ghost"
                        style={hour === p.hourVal ? { background: "var(--amber)", color: "var(--ink)", borderColor: "transparent" } : {}}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 8 }}>
                    Work after midnight counts toward the previous day when this is set past 0.
                  </div>
                </div>
              </div>

              <div className="log-section">
                <div className="r-lab" style={{ marginBottom: 10 }} id="r-sec-theme"><span className="r-lab">Switch deck</span></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {THEMES.map((t) => (
                    <button key={t.id} title={t.tagline} onClick={() => setThemeId(t.id)}
                      className="r-btn r-btn--ghost"
                      style={themeId === t.id ? { background: "var(--amber)", color: "var(--ink)", borderColor: "transparent", justifyContent: "space-between" } : { justifyContent: "space-between" }}>
                      <span>{t.name}</span>
                      <span style={{ fontSize: 9, opacity: 0.7, textTransform: "none", letterSpacing: 0 }}>{t.tagline}</span>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 6 }}>
                  Switches the whole presentation instantly. Data and features are identical in every theme.
                </div>
              </div>

              <div className="log-section">
                <div className="r-lab" style={{ marginBottom: 10 }}><span className="r-lab">Data</span></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <button className="r-btn r-btn--ghost" onClick={exportData}>Export manifest (JSON)</button>
                  <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const mode = window.confirm("OK = MERGE with current data (safe). Cancel = choose replace on the next dialog.")
                        ? "merge"
                        : window.confirm("REPLACE all current data with the backup? This overwrites everything (a daily auto-backup exists).") ? "replace" : null;
                      if (mode) importDataFromFile(f, mode).catch((err) => notify(String(err.message || err)));
                      e.target.value = "";
                    }} />
                  <button className="r-btn r-btn--ghost" onClick={() => fileRef.current?.click()}>Import manifest (Werf or Quest)</button>
                  {previewMode
                    ? <button className="r-btn r-btn--ghost" style={{ color: "var(--amber-hot)", borderColor: "var(--amber-deep)" }} onClick={exitPreview}>Exit preview</button>
                    : <button className="r-btn r-btn--ghost" onClick={enterPreview}><Icon name="bolt" size={11} /> Preview with sample data</button>}
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 8, lineHeight: 1.5 }}>
                  Auto-backup keeps the last 7 days in local storage{backups.length ? ` (latest: ${backups[0].day})` : ""}. Export weekly for an off-machine copy.
                </div>
                {meta.migratedFrom && (
                  <div className="r-num" style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 6 }}>
                    migrated from: {[meta.migratedFrom.quest && "quest", meta.migratedFrom.vsq && "vsq", meta.migratedFrom.shiplist && "shiplist"].filter(Boolean).join(" + ")} · lifetime XP preserved
                  </div>
                )}
              </div>
            </div>

            {/* right column */}
            <div>
              <div className="log-section" style={{ marginTop: 0 }}>
                <div className="r-lab" style={{ marginBottom: 10 }}><span className="r-lab">30-day averages</span></div>
                <div className="r-plate" style={{ padding: "14px 16px" }}>
                  <CalRow label="XP per day" pct={Math.min(100, (avg30.xpPerDay / 150) * 100)} value={avg30.xpPerDay} />
                  <CalRow label="Focus hours" pct={Math.min(100, (avg30.focusPerDay / 5) * 100)} tone="var(--channel)" value={avg30.focusPerDay >= 0.05 ? avg30.focusPerDay.toFixed(1) + "H" : "—"} />
                  <CalRow label="Active days" pct={avg30.activeRate} tone="var(--starboard)" value={avg30.activeRate + "%"} />
                  <CalRow label="Adrift now" pct={Math.min(100, avg30.adriftNow * 12)} tone="var(--port)" value={avg30.adriftNow} last />
                </div>
              </div>

              <div className="log-section">
                <div className="r-lab" style={{ marginBottom: 10 }}><span className="r-lab">Estimate calibration · last 60 days</span></div>
                <div className="r-plate" style={{ padding: "14px 16px" }}>
                  {cal.overall.n < 3 ? (
                    <div style={{ fontSize: 12, color: "var(--fg-faint)", lineHeight: 1.5 }}>
                      Not enough finished, focused work to calibrate yet ({cal.overall.n}/3 tasks).
                      Run the focus tunnel on real tasks and this becomes your actual-vs-estimate mirror.
                      {focusTotal > 0 && <> Logged so far: {D.fmtMs(focusTotal)}.</>}
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                        <span className="r-display" style={{ fontSize: 26, fontWeight: 600, color: cal.overall.factor > 1.15 ? "var(--warn)" : cal.overall.factor < 0.9 ? "var(--channel)" : "var(--starboard)" }}>
                          {cal.overall.factor}×
                        </span>
                        <span style={{ fontSize: 12, color: "var(--fg-dim)" }}>
                          actual vs estimate · {cal.overall.n} tasks · {D.fmtMs(focusTotal)} focused
                        </span>
                      </div>
                      {Object.entries(cal.byDifficulty).map(([k, v], i, arr) => (
                        v.factor && v.n >= 2
                          ? <CalRow key={k} label={`${k} (n=${v.n})`} pct={Math.min(100, v.factor * 50)} tone={v.factor > 1.15 ? "var(--warn)" : "var(--starboard)"} value={v.factor + "×"} last={i === arr.length - 1} />
                          : <CalRow key={k} label={k} pct={0} tone="var(--fg-faint)" value="—" last={i === arr.length - 1} />
                      ))}
                      <div style={{ fontSize: 10.5, color: "var(--fg-faint)", marginTop: 10 }}>
                        The AI scorer reads these factors, so new estimates learn from your reality.
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="log-section">
                <div className="r-lab" style={{ marginBottom: 10 }}><span className="r-lab">Screen weather · 14 days</span></div>
                <div className="r-plate" style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
                    <Stamp>7D: {totX} X · {totYT} YT</Stamp>
                    <Stamp>AVG MOBILE {avgMobile}</Stamp>
                  </div>
                  <WeekBars data={screen14.map((d) => ({ value: d.opens, title: `${d.iso}: ${d.x} X · ${d.yt} YT` }))} threshold={10} />
                  <div className="r-num" style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 9, color: "var(--fg-faint)" }}>
                    <span>X + YT OPENS PER DAY</span><span>PORT MARKS DAYS OVER 10</span>
                  </div>
                  {mVals.length > 0 && (
                    <>
                      <div className="r-num" style={{ fontSize: 9, color: "var(--fg-faint)", margin: "12px 0 6px" }}>MOBILE HOURS</div>
                      <WeekBars height={30} data={screen14.map((d) => ({ value: d.mobile ?? 0, title: `${d.iso}: ${d.mobile ?? "—"}h` }))} />
                    </>
                  )}
                </div>
              </div>

              <div className="log-section">
                <div className="r-lab" style={{ marginBottom: 10 }}><span className="r-lab">Trophies · {achievements.length}/{D.ACHIEVEMENTS.length}</span></div>
                <div className="plate plate--flush ledger">
                  {D.ACHIEVEMENTS.map((a) => {
                    const done = achievements.includes(a.id);
                    const prog = !done ? D.achievementProgress(a.id, ctx) : null;
                    const pct = prog ? Math.min(100, Math.round((prog.cur / prog.target) * 100)) : 0;
                    return (
                      <div key={a.id} className="lrow" style={{ minHeight: 42, "--row-lamp": done ? "var(--amber)" : "var(--line-dim)" }}>
                        <span style={{ color: done ? "var(--amber)" : "var(--fg-faint)" }}><Icon name="trophy" size={13} /></span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="lrow-title" style={{ fontSize: 12, letterSpacing: "0.06em" }}>{a.title.toUpperCase()}</div>
                          <div className="lrow-meta w-num"><span>{a.desc.toUpperCase()}</span></div>
                        </div>
                        {done
                          ? <span className="r-lab r-lab--lit" style={{ fontSize: 8 }}>Earned</span>
                          : prog
                            ? <>
                                <div className="trophy-meter"><Meter pct={pct} height={4} /></div>
                                <span className="r-num" style={{ fontSize: 9, color: "var(--fg-faint)", width: 42, textAlign: "right" }}>{prog.cur}/{prog.target}</span>
                              </>
                            : <span className="r-num" style={{ fontSize: 9, color: "var(--fg-faint)" }}>—</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="log-section">
                <div className="r-lab" style={{ marginBottom: 10 }}><span className="r-lab">Reviews</span></div>
                {weeks.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>No weeks with activity yet — the record starts when the work does.</div>
                ) : (
                  <div className="ledger">
                    {weeks.map((w) => {
                      const entry = reviews?.[w];
                      const label = entry?.text
                        ? entry.text.slice(0, 64) + (entry.text.length > 64 ? "…" : "")
                        : "stats ready · no retro written yet";
                      return (
                        <div key={w} className="manifest-row">
                          <span className="r-lab r-lab--lit">W{weekNo(w)}</span>
                          <span style={{ flex: 1, fontSize: 12.5, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                          <button className="r-link" onClick={() => { setUI({ statsOpen: false }); openReview(w); }}>Open →</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ marginTop: 10 }}>
                  <button className="r-btn r-btn--sm r-btn--ghost" onClick={() => { setUI({ statsOpen: false }); openReview(); }}>
                    Weekly review <Kbd>W</Kbd>
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
