// stats.jsx — the slide-over stats panel: level, trophies (with derived
// progress), screen-log history, settings (day rollover), data tools.

import React, { useMemo, useRef } from "react";
import { Icon, Eyebrow, ProgressBar, Chip } from "../components.jsx";
import { DitherBars, DitherStackedBars } from "../dither.jsx";
import { statementBg } from "../texture.js";
import * as D from "../../../core/domain.js";
import { useStore, getState, setUI, setDayStartHour, exportData, importDataFromFile, enterPreview, exitPreview, notify, openReview } from "../../../core/store.js";
import { listBackups } from "../../../core/db.js";
import { useThemeId, setThemeId } from "../../../core/theme.js";
import { THEMES } from "../../registry.js";

export function StatsPanel() {
  const open = useStore((s) => s.ui.statsOpen);
  if (!open) return null;
  return (
    <div className="w-backdrop" onClick={() => setUI({ statsOpen: false })} style={{ zIndex: 10002 }}>
      <div onClick={(e) => e.stopPropagation()} className="w-scroll w-fade-in" style={{
        position: "absolute", top: 0, right: 0, bottom: 0, width: "min(400px, 92vw)",
        background: "var(--rail)",
        backgroundImage: "var(--dither-vsplit)", backgroundRepeat: "repeat-y", backgroundPosition: "left top",
        overflowY: "auto", padding: "20px 20px 40px 26px",
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
        <div style={{ fontSize: 12, color: "var(--fg-faint)", lineHeight: 1.5 }}>
          Not enough finished, focused work to calibrate yet
          ({cal.overall.n}/3 tasks). Run the focus tunnel on real tasks and
          this becomes your actual-vs-estimate mirror.
          {focusTotal > 0 && <> Logged so far: {D.fmtMs(focusTotal)}.</>}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
            <span className="w-display" style={{ fontSize: 26, fontWeight: 600, color: cal.overall.factor > 1.15 ? "var(--warn)" : cal.overall.factor < 0.9 ? "var(--channel)" : "var(--starboard)" }}>
              {cal.overall.factor}×
            </span>
            <span style={{ fontSize: 12, color: "var(--fg-dim)" }}>
              actual vs estimate · {cal.overall.n} tasks · {D.fmtMs(focusTotal)} focused
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {Object.entries(cal.byDifficulty).map(([k, v]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                <span style={{ width: 52, color: "var(--fg-dim)" }}>{k}</span>
                {v.factor && v.n >= 2 ? (
                  <>
                    <div style={{ flex: 1, height: 4, background: "var(--plate-hi)", borderRadius: 2, overflow: "hidden" }}>
                      <div className="w-bar-fill" style={{ height: "100%", width: Math.min(100, v.factor * 50) + "%", background: v.factor > 1.15 ? "var(--warn)" : "var(--starboard)" }} />
                    </div>
                    <span style={{ fontFamily: "var(--t-mono)", color: "var(--fg)", width: 44, textAlign: "right" }}>{v.factor}×</span>
                    <span style={{ fontFamily: "var(--t-mono)", color: "var(--fg-faint)", fontSize: 10 }}>n={v.n}</span>
                  </>
                ) : (
                  <span style={{ color: "var(--fg-faint)", fontSize: 11 }}>not enough data</span>
                )}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--fg-faint)", marginTop: 8 }}>
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
        <div style={{ fontSize: 12, color: "var(--fg-faint)", padding: "6px 0" }}>
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
              <div key={s.l} style={{ background: "var(--plate)", boxShadow: "inset 0 1px 0 var(--line-dim)", padding: "8px 10px" }}>
                <div style={{ fontSize: 10, color: "var(--fg-faint)", marginBottom: 3 }}>{s.l}</div>
                <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--t-mono)" }}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "var(--fg-faint)", marginBottom: 6 }}>
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
              <div style={{ fontSize: 10, color: "var(--fg-faint)", marginBottom: 6 }}>Mobile hours</div>
              <div style={{ width: "100%", height: 52 }}>
                <DitherBars
                  data={days.map((d) => ({ label: d.label[0], value: d.mobile ?? 0, title: `${d.iso}: ${d.mobile ?? "—"}h` }))}
                  activeIndex={6}
                  tone={"var(--warn)"}
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
  const themeId = useThemeId();
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
        {/* the level stack — the panel's statement moment */}
        <div className="w-statement" style={{ ...statementBg("level-" + derived.level.lvl), padding: "14px 16px 16px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span className="w-display w-num" style={{ fontSize: 42, lineHeight: 1 }}>{derived.level.lvl}</span>
            <div>
              <div className="w-stencil">Level</div>
              <div className="w-display" style={{ fontSize: 18 }}>{derived.level.title}</div>
            </div>
          </div>
          <div style={{ margin: "12px 0 6px" }}>
            <div style={{ height: 6, background: "rgba(20,16,10,0.25)" }}>
              <div style={{ height: "100%", width: derived.level.pct + "%", background: "var(--ink)", backgroundImage: "var(--dither-dot)" }} />
            </div>
          </div>
          <div className="w-num" style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "var(--ink)", opacity: 0.75 }}>
            <span>{derived.total} XP LIFETIME</span>
            <span>{derived.level.xpToNext > 0 ? `${derived.level.xpToNext} TO NEXT` : "MAX"}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[
          { l: "Streak", v: `${derived.streakRun}d` },
          { l: "Completed", v: derived.count },
          { l: "Launched", v: derived.launched },
        ].map((x) => (
          <div key={x.l} style={{ background: "var(--plate)", boxShadow: "inset 0 1px 0 var(--line-dim)", padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "var(--fg-faint)", marginBottom: 4 }}>{x.l}</div>
            <div style={{ fontSize: 17, fontWeight: 600, fontFamily: "var(--t-mono)" }}>{x.v}</div>
          </div>
        ))}
      </div>

      <div>
        <Eyebrow>Reviews</Eyebrow>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="w-bezel w-bezel--sm" onClick={() => { setUI({ statsOpen: false }); openReview(); }}>
            Weekly review <span className="w-key" style={{ marginLeft: 3 }}>W</span>
          </button>
          <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>
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
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: done ? "var(--starboard-ground)" : "var(--plate)", boxShadow: done ? "inset 3px 0 0 var(--starboard)" : "inset 3px 0 0 var(--line-dim)", opacity: done ? 1 : 0.78 }}>
                <Icon name="trophy" size={13} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: done ? "var(--starboard)" : "var(--fg)" }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: "var(--fg-faint)" }}>{a.desc}</div>
                  {prog && (
                    <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1 }}><ProgressBar pct={pct} height={2} /></div>
                      <span style={{ fontSize: 9, fontFamily: "var(--t-mono)", color: "var(--fg-faint)" }}>{prog.cur}/{prog.target}</span>
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
              className="w-bezel w-bezel--sm"
              style={hour === p.hourVal ? { background: "var(--amber)", color: "var(--ink)", borderColor: "transparent" } : {}}>
              {p.label}
            </button>
          ))}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--fg-faint)", fontFamily: "var(--t-mono)" }}>
            <input type="number" min="0" max="23" value={hour} onChange={(e) => setDayStartHour(e.target.value)}
              className="w-bare" style={{ width: 52, textAlign: "center" }} aria-label="Day rollover hour" />:00
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 6 }}>
          Work after midnight counts toward the previous day when this is set past 0.
        </div>
      </div>

      <div>
        <Eyebrow>Theme</Eyebrow>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {THEMES.map((t) => (
            <button key={t.id} title={t.tagline} onClick={() => setThemeId(t.id)}
              className="w-bezel w-bezel--sm"
              style={themeId === t.id ? { background: "var(--amber)", color: "var(--ink)", borderColor: "transparent" } : {}}>
              {t.name}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 6 }}>
          Switches the whole presentation instantly. Data and features are identical in every theme.
        </div>
      </div>

      <div>
        <Eyebrow>Data</Eyebrow>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className="w-bezel w-bezel--sm" onClick={exportData}>Export backup</button>
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
          <button className="w-bezel w-bezel--sm" onClick={() => fileRef.current?.click()}>Import (Werf or Quest)</button>
          {previewMode
            ? <button className="w-bezel w-bezel--sm" style={{ color: "var(--amber-hot)", borderColor: "var(--amber-deep)" }} onClick={exitPreview}>Exit preview</button>
            : <button className="w-bezel w-bezel--sm" onClick={enterPreview}><Icon name="bolt" size={11} /> Preview with sample data</button>}
        </div>
        <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 8, lineHeight: 1.5 }}>
          Auto-backup keeps the last 7 days in local storage{backups.length ? ` (latest: ${backups[0].day})` : ""}. Export weekly for an off-machine copy.
        </div>
        {meta.migratedFrom && (
          <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 6, fontFamily: "var(--t-mono)" }}>
            migrated from: {[meta.migratedFrom.quest && "quest", meta.migratedFrom.vsq && "vsq", meta.migratedFrom.shiplist && "shiplist"].filter(Boolean).join(" + ")} · lifetime XP preserved
          </div>
        )}
      </div>
    </div>
  );
}
