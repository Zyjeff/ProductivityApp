// views/logbook.jsx — Records, the kakejiku (DESIGN.md §5.4).
// Logic lifted from nightwatch/views/logbook.jsx; composition is a
// hanging scroll unrolling in a tokonoma, not a two-column page.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Eyebrow, Meter, Kbd } from "../components.jsx";
import { woodGrain, REDUCED_MOTION } from "../texture.js";
import * as D from "../../../core/domain.js";
import { useStore, setUI, setDayStartHour, exportData, importDataFromFile, enterPreview, exitPreview, notify, openReview } from "../../../core/store.js";
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
  const [unrolled, setUnrolled] = useState(!!REDUCED_MOTION);

  useEffect(() => {
    if (REDUCED_MOTION) return undefined;
    const t = setTimeout(() => setUnrolled(true), 30);
    return () => clearTimeout(t);
  }, []);

  const derived = useMemo(() => {
    const total = D.totalXP(tasks, plan, meta.xpBaseline, hour);
    const activity = D.activityByDay(tasks, plan, hour);
    let firstIso = null;
    for (const iso of activity.keys()) if (!firstIso || iso < firstIso) firstIso = iso;
    return {
      total,
      level: D.levelInfo(total),
      streakRun: D.streak(tasks, plan, hour),
      count: D.completedCount(tasks),
      launched: projects.filter((p) => p.completedAt).length,
    };
  }, [tasks, plan, projects, meta, hour]);

  const cal = useMemo(() => D.calibration(tasks, sessions), [tasks, sessions]);
  const focusTotal = (sessions || []).reduce((s, x) => s + (x.ms || 0), 0);

  const screen7 = useMemo(() => {
    const out = [];
    const anchor = D.effectiveToday(hour);
    for (let i = 6; i >= 0; i--) {
      const iso = D.isoDate(D.addDays(anchor, -i));
      const e = screen[iso] || {};
      out.push({
        iso,
        x: e.xOpens || 0,
        yt: e.ytOpens || 0,
        mobile: e.mobileHours ?? null,
      });
    }
    return out;
  }, [screen, hour]);
  const totX = screen7.reduce((s, d) => s + d.x, 0);
  const totYT = screen7.reduce((s, d) => s + d.yt, 0);
  const mVals = screen7.filter((d) => d.mobile != null).map((d) => d.mobile);
  const avgMobile = mVals.length ? (mVals.reduce((s, v) => s + v, 0) / mVals.length).toFixed(1) + "h" : "—";

  const weeks = useMemo(() => D.reviewableWeeks(tasks, plan, hour, 8), [tasks, plan, hour]);

  const nextLevelName = derived.level.lvl < D.LEVEL_NAMES.length ? D.LEVEL_NAMES[derived.level.lvl] : null;
  const nextThreshold = D.LEVEL_THRESHOLDS[derived.level.lvl] ?? null;

  const ctx = { tasks, plan, projects, dayStartHour: hour, baseline: meta.xpBaseline };
  const presets = [
    { label: "Standard", hourVal: 0, hint: "day rolls at midnight" },
    { label: "Late", hourVal: 22, hint: "rolls at 10pm" },
    { label: "Overnight", hourVal: 4, hint: "rolls at 4am — late-night work counts as today" },
  ];
  const backups = listBackups();

  return (
    <div className="yz-overlay yzd-tokonoma" role="dialog" aria-label="Records">
      <button type="button" className="yz-btn yz-btn--dusk yz-btn--sm yzd-tokonoma-close"
        onClick={() => setUI({ statsOpen: false })} aria-label="Close records">
        Close <Kbd>Esc</Kbd>
      </button>

      <div className="yzd-kakejiku">
        <div className="yzd-rod" style={{ backgroundImage: woodGrain("kakejiku-rod") }} />
        <div className={"yzd-scroll" + (unrolled ? " is-unrolled" : "")}>
          <div className="yzd-scroll-clip">
            <div className="yz-washi yzd-paper">
              <section className="yzd-callig yzd-sec">
                <div className="yz-sec" style={{ marginBottom: 8, justifyContent: "center" }}>Records</div>
                <div className="yzd-lvl">{derived.level.lvl}</div>
                <div className="yzd-lvl-name">{derived.level.title}</div>
                <div className="yzd-lvl-xp">
                  {derived.total} XP{derived.level.xpToNext > 0 ? ` · ${derived.level.xpToNext} to next` : " · max"}
                </div>
                <div className="yz-meter yz-meter--ink" style={{ margin: "12px auto 0", maxWidth: 280 }}>
                  <div className="yz-meter-fill" style={{ width: derived.level.pct + "%", backgroundColor: "var(--sumi)" }} />
                </div>
                {nextLevelName && nextThreshold != null && (
                  <div className="yzd-next">
                    Next — {nextLevelName} at {nextThreshold} XP
                  </div>
                )}
              </section>

              <div className="yzd-statline yzd-sec">
                {[
                  { l: "Streak", v: `${derived.streakRun}d` },
                  { l: "Completed", v: derived.count },
                  { l: "Sealed", v: derived.launched },
                ].map((x) => (
                  <div key={x.l} className="yzd-statline-item">
                    <div className="yz-label yz-label--sumi">{x.l}</div>
                    <div className="yzd-tile-v">{x.v}</div>
                  </div>
                ))}
              </div>

              <section className="yzd-sec">
                <Eyebrow sumi>Sunday tea</Eyebrow>
                {weeks.length === 0 ? (
                  <div className="yzd-hint">No weeks with activity yet — the record starts when the work does.</div>
                ) : (
                  <div>
                    {weeks.map((w) => {
                      const entry = reviews?.[w];
                      const label = entry?.text
                        ? entry.text.slice(0, 64) + (entry.text.length > 64 ? "…" : "")
                        : "stats ready · no retro written yet";
                      const d = D.parseIsoDate(w);
                      return (
                        <div key={w} className="yzd-week-row">
                          <span className="yzd-week-when">{d ? D.fmtWeekLabel(d) : w}</span>
                          <span>{label}</span>
                          <button type="button" className="yz-link" onClick={() => { setUI({ statsOpen: false }); openReview(w); }}>Open</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ marginTop: 10 }}>
                  <button type="button" className="yz-btn yz-btn--ghost yz-btn--sm" onClick={() => { setUI({ statsOpen: false }); openReview(); }}>
                    Sunday tea <Kbd>W</Kbd>
                  </button>
                </div>
              </section>

              <section className="yzd-sec">
                <Eyebrow sumi>The craftsman's eye</Eyebrow>
                {cal.overall.n < 3 ? (
                  <div className="yzd-hint">
                    &lt;3 tasks — not enough yet ({cal.overall.n}/3).
                    Run Focus on real work and this becomes your actual-vs-estimate mirror.
                    {focusTotal > 0 && <> Logged so far: {D.fmtMs(focusTotal)}.</>}
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                      <span className="yzd-cal-factor" style={{
                        color: cal.overall.factor > 1.15 ? "var(--warn)" : cal.overall.factor < 0.9 ? "var(--channel)" : "var(--starboard)",
                      }}>
                        {cal.overall.factor}×
                      </span>
                      <span style={{ fontSize: 12, color: "var(--sumi-dim)" }}>
                        actual vs estimate · {cal.overall.n} tasks · {D.fmtMs(focusTotal)} focused
                      </span>
                    </div>
                    {Object.entries(cal.byDifficulty).map(([k, v]) => (
                      <div key={k} className="yzd-cal-row">
                        <span style={{ width: 92 }}>{k}{v.n ? ` (n=${v.n})` : ""}</span>
                        <Meter pct={v.factor && v.n >= 2 ? Math.min(100, v.factor * 50) : 0}
                          tone={v.factor > 1.15 ? "var(--warn)" : "var(--starboard)"} />
                        <span className="yz-num" style={{ width: 42, textAlign: "right" }}>
                          {v.factor && v.n >= 2 ? v.factor + "×" : "—"}
                        </span>
                      </div>
                    ))}
                    <div className="yzd-hint">The Attendant's scorer reads these factors, so new estimates learn from your reality.</div>
                  </>
                )}
              </section>

              <section className="yzd-sec">
                <Eyebrow sumi>Omamori rack · {achievements.length}/{D.ACHIEVEMENTS.length}</Eyebrow>
                <div className="yzd-omamori">
                  <div className="yzd-omamori-rail" style={{ backgroundImage: woodGrain("omamori-rail") }} />
                  <div className="yzd-rack">
                  {D.ACHIEVEMENTS.map((a) => {
                    const done = achievements.includes(a.id);
                    const prog = !done ? D.achievementProgress(a.id, ctx) : null;
                    const pct = prog ? Math.min(100, Math.round((prog.cur / prog.target) * 100)) : 0;
                    return (
                      <div key={a.id} className={"yzd-charm" + (done ? " is-earned" : " is-locked")} title={a.desc}>
                        {!done && prog && <div className="yzd-charm-fill" style={{ height: pct + "%" }} />}
                        <div className="yzd-charm-title">{a.title}</div>
                        <div className="yzd-charm-desc">{a.desc}</div>
                        {done
                          ? null
                          : prog
                            ? <div className="yz-num" style={{ fontSize: 10, color: "var(--sumi-faint)", marginTop: 6, position: "relative", zIndex: 1 }}>{prog.cur}/{prog.target}</div>
                            : <div className="yz-num" style={{ fontSize: 10, color: "var(--sumi-faint)", marginTop: 8, position: "relative", zIndex: 1 }}>—</div>}
                      </div>
                    );
                  })}
                  </div>
                </div>
              </section>

              <section className="yzd-sec">
                <Eyebrow sumi>The window</Eyebrow>
                <div className="yzd-legend">
                  <span><i className="yzd-swatch-key" style={{ background: "var(--amber)" }} />7d: {totX} X</span>
                  <span><i className="yzd-swatch-key" style={{ background: "var(--sakura)" }} />{totYT} YT</span>
                  <span>avg mobile {avgMobile}</span>
                </div>
                <WeatherChart days={screen7} active={unrolled} />
                {mVals.length > 0 && (
                  <>
                    <div className="yz-sec" style={{ margin: "12px 0 6px" }}>Mobile hours</div>
                    <MobileChart days={screen7} active={unrolled} />
                  </>
                )}
              </section>

              <section className="yzd-sec">
                <Eyebrow sumi>House clock</Eyebrow>
                <div className="yzd-clock">
                  <span className="yz-label yz-label--sumi" style={{ flex: 1 }}>Day starts at</span>
                  <button type="button" className="yz-btn yz-btn--ghost yz-btn--sm" onClick={() => setDayStartHour(Math.max(0, hour - 1))}>−</button>
                  <input type="number" min="0" max="23" value={hour} onChange={(e) => setDayStartHour(e.target.value)}
                    className="yz-bare yz-num yz-field" style={{ width: 56, textAlign: "center", color: "var(--amber-deep)" }}
                    aria-label="Day rollover hour" />
                  <button type="button" className="yz-btn yz-btn--ghost yz-btn--sm" onClick={() => setDayStartHour(Math.min(23, hour + 1))}>+</button>
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
                  {presets.map((p) => (
                    <button type="button" key={p.label} title={p.hint} onClick={() => setDayStartHour(p.hourVal)}
                      className={"yz-btn yz-btn--sm" + (hour === p.hourVal ? " yz-btn--gold" : " yz-btn--ghost")}>
                      {p.label} {p.hourVal}
                    </button>
                  ))}
                </div>
                <div className="yzd-hint">Work after midnight counts toward the previous day when this is set past 0.</div>
              </section>

              <section className="yzd-sec">
                <Eyebrow sumi>The kiri box</Eyebrow>
                <div className="yzd-tools">
                  <button type="button" className="yz-btn yz-btn--ghost" onClick={exportData}>Export JSON</button>
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
                  <button type="button" className="yz-btn yz-btn--ghost" onClick={() => fileRef.current?.click()}>Import JSON (merge or replace)</button>
                  {previewMode
                    ? <button type="button" className="yz-btn yz-btn--gold" onClick={exitPreview}>Return home</button>
                    : <button type="button" className="yz-btn yz-btn--ghost" onClick={enterPreview}>Borrow a furnished house</button>}
                </div>
                <div className="yzd-hint">
                  Auto-backup keeps the last 7 days{backups.length ? ` (latest: ${backups[0].day})` : ""}. Export weekly for an off-machine copy.
                </div>
                {meta.migratedFrom && (
                  <div className="yz-num" style={{ fontSize: 10, color: "var(--sumi-faint)", marginTop: 6 }}>
                    migrated from: {[meta.migratedFrom.quest && "quest", meta.migratedFrom.vsq && "vsq", meta.migratedFrom.shiplist && "shiplist"].filter(Boolean).join(" + ")} · lifetime XP preserved
                  </div>
                )}
              </section>

              <section className="yzd-sec">
                <Eyebrow sumi>Refurnish the house</Eyebrow>
                <div className="yzd-themes">
                  {THEMES.map((t) => (
                    <button type="button" key={t.id} title={t.tagline} onClick={() => setThemeId(t.id)}
                      className={"yz-btn yzd-theme " + (themeId === t.id ? "" : "yz-btn--ghost")}>
                      <span>{t.name}{themeId === t.id ? " · current" : ""}</span>
                      <span className="yzd-theme-sub">{t.tagline}</span>
                    </button>
                  ))}
                </div>
                <div className="yzd-hint">Switches the whole presentation instantly. Data and features are identical in every theme.</div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeatherChart({ days, active }) {
  const ref = useRef(null);
  const key = JSON.stringify(days.map((d) => [d.iso, d.x, d.yt]));
  useEffect(() => {
    if (!active) return;
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const W = Math.max(280, (cv.offsetWidth || 640) * 2);
    const H = 112;
    cv.width = W; cv.height = H;
    ctx.clearRect(0, 0, W, H);
    const n = days.length || 1;
    const max = Math.max(1, ...days.map((d) => d.x + d.yt));
    const gap = 8;
    const bw = (W - gap * (n + 1)) / n;
    days.forEach((d, i) => {
      const x = gap + i * (bw + gap);
      const total = d.x + d.yt;
      const h = (total / max) * (H - 10);
      const hX = total ? (d.x / total) * h : 0;
      const hYt = h - hX;
      const yBase = H - 4;
      ctx.fillStyle = "#dfa14e";
      ctx.fillRect(x, yBase - hX, bw, hX);
      ctx.fillStyle = "#e88bb0";
      ctx.fillRect(x, yBase - hX - hYt, bw, hYt);
    });
  }, [key, active]);
  return <canvas ref={ref} className="yzd-weather" aria-hidden />;
}

function MobileChart({ days, active }) {
  const ref = useRef(null);
  const key = JSON.stringify(days.map((d) => [d.iso, d.mobile]));
  useEffect(() => {
    if (!active) return;
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const W = Math.max(280, (cv.offsetWidth || 640) * 2);
    const H = 72;
    cv.width = W; cv.height = H;
    ctx.clearRect(0, 0, W, H);
    const n = days.length || 1;
    const max = Math.max(1, ...days.map((d) => d.mobile || 0));
    const gap = 8;
    const bw = (W - gap * (n + 1)) / n;
    days.forEach((d, i) => {
      const x = gap + i * (bw + gap);
      const v = d.mobile || 0;
      const h = (v / max) * (H - 10);
      ctx.fillStyle = "#63c3cf";
      ctx.fillRect(x, H - 4 - h, bw, h);
    });
  }, [key, active]);
  return <canvas ref={ref} className="yzd-weather yzd-weather--sm" aria-hidden />;
}
