// stats.jsx — the slide-over stats panel: level, trophies (with derived
// progress), screen-log history, settings (day rollover), data tools.

import React, { useMemo, useRef } from "react";
import { Icon, Eyebrow, ProgressBar, Chip } from "../components.jsx";
import { DitherBars, DitherStackedBars } from "../dither.jsx";
import * as D from "../domain.js";
import { useStore, getState, setUI, setDayStartHour, exportData, importDataFromFile, enterPreview, exitPreview, notify, openReview } from "../store.js";
import { listBackups } from "../db.js";

export function StatsPanel() {
  const open = useStore((s) => s.ui.statsOpen);
  if (!open) return null;
  return (
    <div onClick={() => setUI({ statsOpen: false })} style={{ position: "fixed", inset: 0, zIndex: 10002, background: "rgba(6,8,12,0.5)" }}>
      <div onClick={(e) => e.stopPropagation()} className="w-scroll w-fade-in" style={{
        position: "absolute", top: 0, right: 0, bottom: 0, width: "min(400px, 92vw)",
        background: "var(--bg-elev)", borderLeft: "1px solid var(--border-strong)",
        overflowY: "auto", padding: "22px 20px 40px",
      }}>
        <StatsInner />
      </div>
    </div>
  );
}

// Estimate calibration (F4): actual ÷ estimated hours, from the focus
// session ledger. The honest mirror for a freelancer's estimates.
function CalibrationCard({ tasks, sessions }) {
  const cal = useMemo(() => D.calibration(tasks, sessions), [tasks, sessions]);
  const focusTotal = (sessions || []).reduce((s, x) => s + (x.ms || 0), 0);
  return (
    <div>
      <Eyebrow>Estimate calibration · last 60 days</Eyebrow>
      {cal.overall.n < 3 ? (
        <div style={{ fontSize: 12, color: "var(--text-faint)", lineHeight: 1.5 }}>
          Not enough finished, focused work to calibrate yet
          ({cal.overall.n}/3 tasks). Run the focus tunnel on real tasks and
          this becomes your actual-vs-estimate mirror.
          {focusTotal > 0 && <> Logged so far: {D.fmtMs(focusTotal)}.</>}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
            <span className="w-display" style={{ fontSize: 26, fontWeight: 600, color: cal.overall.factor > 1.15 ? "var(--warning)" : cal.overall.factor < 0.9 ? "var(--channel)" : "var(--starboard)" }}>
              {cal.overall.factor}×
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              actual vs estimate · {cal.overall.n} tasks · {D.fmtMs(focusTotal)} focused
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {Object.entries(cal.byDifficulty).map(([k, v]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                <span style={{ width: 52, color: "var(--text-muted)" }}>{k}</span>
                {v.factor && v.n >= 2 ? (
                  <>
                    <div style={{ flex: 1, height: 4, background: "var(--bg-muted)", borderRadius: 2, overflow: "hidden" }}>
                      <div className="w-bar-fill" style={{ height: "100%", width: Math.min(100, v.factor * 50) + "%", background: v.factor > 1.15 ? "var(--warning)" : "var(--starboard)" }} />
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text)", width: 44, textAlign: "right" }}>{v.factor}×</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)", fontSize: 10 }}>n={v.n}</span>
                  </>
                ) : (
                  <span style={{ color: "var(--text-faint)", fontSize: 11 }}>not enough data</span>
                )}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 8 }}>
            The AI scorer reads these factors, so new estimates learn from your reality.
          </div>
        </>
      )}
    </div>
  );
}

// The old Habits view's detail, restored: X-vs-YT stacked opens,
// color-graded mobile-hours bars, 7-day totals and averages.
function ScreenLogDetail({ days }) {
  const hasAny = days.some((d) => d.x || d.yt || d.mobile != null);
  const totX = days.reduce((s, d) => s + d.x, 0);
  const totYT = days.reduce((s, d) => s + d.yt, 0);
  const mVals = days.filter((d) => d.mobile != null).map((d) => d.mobile);
  const avgMobile = mVals.length ? (mVals.reduce((s, v) => s + v, 0) / mVals.length).toFixed(1) + "h" : "—";
  const maxOpens = Math.max(1, ...days.map((d) => d.x + d.yt));
  const maxMobile = Math.max(1, ...mVals);
  return (
    <div>
      <Eyebrow>Screen log · last 7 days</Eyebrow>
      {!hasAny ? (
        <div style={{ fontSize: 12, color: "var(--text-faint)", padding: "6px 0" }}>
          No screen data yet — log opens and mobile hours from the card on Today.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            {[
              { l: "X opens", v: totX },
              { l: "YT opens", v: totYT },
              { l: "Avg mobile", v: avgMobile },
            ].map((s) => (
              <div key={s.l} style={{ background: "var(--bg-soft)", borderRadius: "var(--r-md)", padding: "8px 10px" }}>
                <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 3 }}>{s.l}</div>
                <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 6 }}>
            Social opens · <span style={{ color: "var(--channel)" }}>X</span> vs <span style={{ color: "var(--port)" }}>YT</span>
          </div>
          <div style={{ width: "100%", height: 78, marginBottom: 14 }}>
            <DitherStackedBars
              data={days.map((d) => ({ label: d.label[0], values: [d.x, d.yt], title: `${d.iso}: ${d.x} X · ${d.yt} YT` }))}
              tones={["var(--channel)", "var(--port)"]}
            />
          </div>
          {mVals.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 6 }}>Mobile hours</div>
              <div style={{ width: "100%", height: 52 }}>
                <DitherBars
                  data={days.map((d) => ({ label: d.label[0], value: d.mobile ?? 0, title: `${d.iso}: ${d.mobile ?? "—"}h` }))}
                  activeIndex={6}
                  tone={"var(--warning)"}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function StatsInner() {
  const tasks = useStore((s) => s.tasks);
  const plan = useStore((s) => s.plan);
  const projects = useStore((s) => s.projects);
  const screen = useStore((s) => s.screen);
  const sessions = useStore((s) => s.sessions);
  const achievements = useStore((s) => s.achievements);
  const meta = useStore((s) => s.meta);
  const previewMode = useStore((s) => s.ui.previewMode);
  const fileRef = useRef(null);
  const hour = meta.dayStartHour || 0;

  const derived = useMemo(() => {
    const total = D.totalXP(tasks, plan, meta.xpBaseline, hour);
    return {
      total,
      level: D.levelInfo(total),
      streakRun: D.streak(tasks, plan, hour),
      count: D.completedCount(tasks),
      launched: projects.filter((p) => p.completedAt).length,
    };
  }, [tasks, plan, projects, meta, hour]);

  const screen7 = useMemo(() => {
    const out = [];
    const anchor = D.effectiveToday(hour);
    for (let i = 6; i >= 0; i--) {
      const iso = D.isoDate(D.addDays(anchor, -i));
      const e = screen[iso] || {};
      out.push({
        iso,
        label: D.parseIsoDate(iso).toLocaleDateString("en-US", { weekday: "short" })[0],
        x: e.xOpens || 0,
        yt: e.ytOpens || 0,
        mobile: e.mobileHours ?? null,
      });
    }
    return out;
  }, [screen, hour]);

  const ctx = { tasks, plan, projects, dayStartHour: hour, baseline: meta.xpBaseline };
  const presets = [
    { label: "Standard", hourVal: 0, hint: "day rolls at midnight" },
    { label: "Late", hourVal: 22, hint: "rolls at 10pm" },
    { label: "Overnight", hourVal: 4, hint: "rolls at 4am — late-night work counts as today" },
  ];
  const backups = listBackups();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <Eyebrow right={<button className="w-icon-btn" onClick={() => setUI({ statsOpen: false })} aria-label="Close"><Icon name="close" size={13} /></button>}>Logbook</Eyebrow>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span className="w-display" style={{ fontSize: 30, fontWeight: 600 }}>Lv.{derived.level.lvl}</span>
          <span style={{ fontSize: 15, color: "var(--amber-strong)", fontWeight: 600 }}>{derived.level.title}</span>
        </div>
        <div style={{ margin: "10px 0 6px" }}><ProgressBar pct={derived.level.pct} height={4} /></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>
          <span>{derived.total} XP lifetime</span>
          <span>{derived.level.xpToNext > 0 ? `${derived.level.xpToNext} to next` : "max"}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[
          { l: "Streak", v: `${derived.streakRun}d` },
          { l: "Completed", v: derived.count },
          { l: "Launched", v: derived.launched },
        ].map((x) => (
          <div key={x.l} style={{ background: "var(--bg-soft)", borderRadius: "var(--r-md)", padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 4 }}>{x.l}</div>
            <div style={{ fontSize: 17, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{x.v}</div>
          </div>
        ))}
      </div>

      <div>
        <Eyebrow>Reviews</Eyebrow>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="w-btn w-btn--outline w-btn--sm" onClick={() => { setUI({ statsOpen: false }); openReview(); }}>
            Weekly review <span className="w-kbd" style={{ marginLeft: 3 }}>W</span>
          </button>
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
            Browse any past week — stats + the written retro.
          </span>
        </div>
      </div>

      <CalibrationCard tasks={tasks} sessions={sessions} />

      <div>
        <Eyebrow>Trophies · {achievements.length}/{D.ACHIEVEMENTS.length}</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {D.ACHIEVEMENTS.map((a) => {
            const done = achievements.includes(a.id);
            const prog = !done ? D.achievementProgress(a.id, ctx) : null;
            const pct = prog ? Math.min(100, Math.round((prog.cur / prog.target) * 100)) : 0;
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: "var(--r-md)", background: done ? "var(--starboard-soft)" : "var(--bg-soft)", opacity: done ? 1 : 0.75 }}>
                <Icon name="trophy" size={13} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: done ? "var(--starboard)" : "var(--text)" }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{a.desc}</div>
                  {prog && (
                    <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1 }}><ProgressBar pct={pct} height={2} /></div>
                      <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>{prog.cur}/{prog.target}</span>
                    </div>
                  )}
                </div>
                {done && <Chip kind="green">✓</Chip>}
              </div>
            );
          })}
        </div>
      </div>

      <ScreenLogDetail days={screen7} />

      <div>
        <Eyebrow>Day rollover</Eyebrow>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {presets.map((p) => (
            <button key={p.label} title={p.hint} onClick={() => setDayStartHour(p.hourVal)}
              className={hour === p.hourVal ? "w-btn w-btn--outline w-btn--sm" : "w-btn w-btn--ghost w-btn--sm"}
              style={hour === p.hourVal ? { borderColor: "var(--amber)", color: "var(--amber-strong)" } : {}}>
              {p.label}
            </button>
          ))}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
            <input type="number" min="0" max="23" value={hour} onChange={(e) => setDayStartHour(e.target.value)}
              className="w-input w-input--sm" style={{ width: 52, textAlign: "center" }} aria-label="Day rollover hour" />:00
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>
          Work after midnight counts toward the previous day when this is set past 0.
        </div>
      </div>

      <div>
        <Eyebrow>Data</Eyebrow>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className="w-btn w-btn--outline w-btn--sm" onClick={exportData}>Export backup</button>
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
          <button className="w-btn w-btn--outline w-btn--sm" onClick={() => fileRef.current?.click()}>Import (Werf or Quest)</button>
          {previewMode
            ? <button className="w-btn w-btn--outline w-btn--sm" style={{ color: "var(--amber-strong)" }} onClick={exitPreview}>Exit preview</button>
            : <button className="w-btn w-btn--ghost w-btn--sm" onClick={enterPreview}><Icon name="bolt" size={11} /> Preview with sample data</button>}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 8, lineHeight: 1.5 }}>
          Auto-backup keeps the last 7 days in local storage{backups.length ? ` (latest: ${backups[0].day})` : ""}. Export weekly for an off-machine copy.
        </div>
        {meta.migratedFrom && (
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6, fontFamily: "var(--font-mono)" }}>
            migrated from: {[meta.migratedFrom.quest && "quest", meta.migratedFrom.vsq && "vsq", meta.migratedFrom.shiplist && "shiplist"].filter(Boolean).join(" + ")} · lifetime XP preserved
          </div>
        )}
      </div>
    </div>
  );
}
