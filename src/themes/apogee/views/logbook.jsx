// views/logbook.jsx — FLIGHT LOG / GROUND STATION tile wall.
// Rendered inside .ap-stage when statsOpen (app.jsx gates). No .ap-screen shell.

import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  Icon, Kbd, Cell, Meter, EmptyState, DotNumeral, fitFontSize,
} from "../components.jsx";
import { StackBars, HourBars } from "../charts.jsx";
import * as D from "../../../core/domain.js";
import {
  useStore, setUI, setDayStartHour, exportData, importDataFromFile,
  enterPreview, exitPreview, notify, openReview,
} from "../../../core/store.js";
import { listBackups } from "../../../core/db.js";
import { useThemeId, setThemeId } from "../../../core/theme.js";
import { THEMES } from "../../registry.js";

const ALT_MIN_KM = 160;
const ALT_MAX_KM = 35786;

/** Log-linear map of lifetime XP onto LEO→GEO altitude (km). Matches chrome.jsx. */
function altitudeKm(totalXP) {
  const xp0 = D.LEVEL_THRESHOLDS[0];
  const xp1 = D.LEVEL_THRESHOLDS[D.LEVEL_THRESHOLDS.length - 1];
  const xp = Math.max(xp0, Math.min(xp1, Number(totalXP) || 0));
  const denom = Math.log1p(xp1) - Math.log1p(xp0);
  const t = denom === 0 ? 0 : (Math.log1p(xp) - Math.log1p(xp0)) / denom;
  const clamped = Math.max(0, Math.min(1, t));
  return Math.round(ALT_MIN_KM + clamped * (ALT_MAX_KM - ALT_MIN_KM));
}

const weekNo = (iso) => {
  const d = D.parseIsoDate(iso);
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
};

const EPOCH_PRESETS = [
  { label: "Standard", hourVal: 0 },
  { label: "Late", hourVal: 22 },
  { label: "Overnight", hourVal: 4 },
];

export function LogbookScreen() {
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
  const altTileRef = useRef(null);
  const [altTileW, setAltTileW] = useState(220);
  const hour = meta.dayStartHour || 0;

  useEffect(() => {
    if (altTileRef.current) setAltTileW(altTileRef.current.offsetWidth);
  }, []);

  const derived = useMemo(() => {
    const totalXP = D.totalXP(tasks, plan, meta.xpBaseline, hour);
    const level = D.levelInfo(totalXP);
    return {
      totalXP,
      level,
      alt: altitudeKm(totalXP),
      streak: D.streak(tasks, plan, hour),
      completed: D.completedCount(tasks),
      launched: projects.filter((p) => p.completedAt).length,
    };
  }, [tasks, plan, projects, meta, hour]);

  const cal = useMemo(() => D.calibration(tasks, sessions), [tasks, sessions]);
  const focusTotal = useMemo(
    () => (sessions || []).reduce((s, x) => s + (x.ms || 0), 0),
    [sessions],
  );

  const weeks = useMemo(
    () => D.reviewableWeeks(tasks, plan, hour, 8),
    [tasks, plan, hour],
  );

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

  const weather = useMemo(() => {
    const totX = screen7.reduce((s, d) => s + d.x, 0);
    const totYT = screen7.reduce((s, d) => s + d.yt, 0);
    const mVals = screen7.filter((d) => d.mobile != null).map((d) => d.mobile);
    const avgMobile = mVals.length
      ? (mVals.reduce((s, v) => s + v, 0) / mVals.length).toFixed(1) + "h"
      : null;
    return {
      totX,
      totYT,
      avgMobile,
      stackRows: screen7.map((d) => ({ a: d.x, b: d.yt })),
      hourRows: screen7.map((d) => ({ v: d.mobile ?? 0 })),
      hasMobile: mVals.length > 0,
    };
  }, [screen7]);

  const ctx = useMemo(
    () => ({ tasks, plan, projects, dayStartHour: hour, baseline: meta.xpBaseline }),
    [tasks, plan, projects, hour, meta.xpBaseline],
  );

  const backups = listBackups();
  const factorColor =
    cal.overall.factor > 1.15
      ? "var(--warn)"
      : cal.overall.factor < 0.9
        ? "var(--channel)"
        : "var(--starboard)";

  const migratedList = meta.migratedFrom
    ? [
      meta.migratedFrom.quest && "quest",
      meta.migratedFrom.vsq && "vsq",
      meta.migratedFrom.shiplist && "shiplist",
    ].filter(Boolean).join(" + ")
    : "";

  return (
    <div>
      <div className="ap-stencil-row ap-mb-md">
        <span className="ap-stencil ap-stencil--lit">GROUND STATION</span>
      </div>

      <div className="ap-tilewall">
        {/* 1. ALT statement */}
        <div className="ap-tile" ref={altTileRef}>
          <div className="ap-tile-label">ALT STATEMENT</div>
          <div className="ap-tile-body">
            <DotNumeral
              size="xl"
              style={{ fontSize: fitFontSize(`${derived.alt} KM`.length, 120, altTileW - 32) }}
            >
              {derived.alt} KM
            </DotNumeral>
            <div className="ap-uppercase ap-mt-sm" style={{ fontWeight: 600, letterSpacing: "0.08em" }}>
              L{derived.level.lvl} — {derived.level.title}
            </div>
            <div className="ap-mono ap-faint ap-mt-sm" style={{ fontSize: 11 }}>
              {derived.totalXP} XP
              {derived.level.xpToNext > 0
                ? ` · ${derived.level.xpToNext} TO LEVEL ${derived.level.lvl + 1}`
                : " · MAX"}
            </div>
            <div className="ap-mt-sm">
              <Meter pct={derived.level.pct} />
            </div>
          </div>
        </div>

        {/* 2. Counts */}
        <div className="ap-tile">
          <div className="ap-tile-label">COUNTS</div>
          {/* gap: no 3-col cell-row utility; compose with flex + gap */}
          <div style={{ display: "flex", gap: 8 }}>
            <Cell label="L-STREAK">{derived.streak}D</Cell>
            <Cell label="COMPLETED">{derived.completed}</Cell>
            <Cell label="LAUNCHED">{derived.launched}</Cell>
          </div>
        </div>

        {/* 3. POST-FLIGHT REPORTS */}
        <div className="ap-tile">
          <div className="ap-tile-label">POST-FLIGHT REPORTS</div>
          <div className="ap-tile-body">
            <button
              type="button"
              className="ap-btn ap-btn--sm ap-btn--primary"
              onClick={() => { setUI({ statsOpen: false }); openReview(); }}
            >
              Open last report <Kbd>W</Kbd>
            </button>
            {weeks.length === 0 ? (
              <div className="ap-faint ap-mt-sm" style={{ fontSize: 12 }}>
                No weeks with activity yet.
              </div>
            ) : (
              <div className="ap-ledger ap-mt-sm">
                {weeks.map((w) => {
                  const entry = reviews?.[w];
                  const snippet = entry?.text
                    ? entry.text.slice(0, 56) + (entry.text.length > 56 ? "…" : "")
                    : "stats ready — no retro written yet";
                  return (
                    <div key={w} className="ap-lrow" style={{ minHeight: 36 }}>
                      <span className="ap-chip ap-chip--on" style={{ flexShrink: 0 }}>W{weekNo(w)}</span>
                      {/* gap: no ellipsis utility on flex children; truncate via inline */}
                      <span
                        className="ap-lrow-title ap-grow"
                        style={{
                          fontSize: 12,
                          color: "var(--fg-dim)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {snippet}
                      </span>
                      <button
                        type="button"
                        className="ap-btn ap-btn--ghost ap-btn--sm"
                        onClick={() => { setUI({ statsOpen: false }); openReview(w); }}
                      >
                        Open
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 4. GUIDANCE CALIBRATION */}
        <div className="ap-tile">
          <div className="ap-tile-label">GUIDANCE CALIBRATION</div>
          <div className="ap-tile-body">
            {cal.overall.n < 3 ? (
              <div className="ap-faint" style={{ fontSize: 12, lineHeight: 1.5 }}>
                Not enough finished, focused work to calibrate yet ({cal.overall.n}/3 tasks).
                {focusTotal > 0 && <> Logged so far: {D.fmtMs(focusTotal)}.</>}
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                  <DotNumeral size="lg">
                    <span style={{ color: factorColor }}>{cal.overall.factor}x</span>
                  </DotNumeral>
                  <span className="ap-faint" style={{ fontSize: 11 }}>
                    {cal.overall.n} tasks · {D.fmtMs(focusTotal)} focused
                  </span>
                </div>
                {Object.entries(cal.byDifficulty).map(([k, v]) => (
                  /* gap: no labeled-meter-row (CalRow) component in Apogee — compose inline */
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 6,
                      fontSize: 11,
                      fontFamily: "var(--t-mono)",
                    }}
                  >
                    <span className="ap-uppercase ap-faint" style={{ width: 56, flexShrink: 0 }}>
                      {k}
                    </span>
                    {v.factor && v.n >= 2 ? (
                      <>
                        <div className="ap-grow">
                          <Meter
                            pct={Math.min(100, v.factor * 50)}
                            tone={v.factor > 1.15 ? "var(--warn)" : "var(--starboard)"}
                          />
                        </div>
                        <span className="ap-num" style={{ width: 72, textAlign: "right", flexShrink: 0 }}>
                          {v.factor}x <span className="ap-faint">(n={v.n})</span>
                        </span>
                      </>
                    ) : (
                      <span className="ap-faint">—</span>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* 5. MISSION PATCHES */}
        <div className="ap-tile ap-tile--wide ap-tile--tall">
          <div className="ap-tile-label">
            MISSION PATCHES · {achievements.length}/{D.ACHIEVEMENTS.length}
          </div>
          {/* gap: tile needs internal scroll for 16 rows; no max-height token */}
          <div className="ap-ledger ap-scrolly" style={{ maxHeight: 420, overflowY: "auto" }}>
            {D.ACHIEVEMENTS.map((a) => {
              const done = achievements.includes(a.id);
              const prog = !done ? D.achievementProgress(a.id, ctx) : null;
              const pct = prog
                ? Math.min(100, Math.round((prog.cur / prog.target) * 100))
                : 0;
              return (
                <div key={a.id} className="ap-lrow" style={{ minHeight: 40 }}>
                  <span className="ap-lrow-idx" style={{ color: done ? "var(--signal)" : "var(--fg-faint)" }}>
                    <Icon name="patch" size={12} />
                  </span>
                  <div className="ap-grow" style={{ minWidth: 0 }}>
                    <div className="ap-lrow-title" style={{ fontSize: 12 }}>
                      {a.title}
                    </div>
                    <div className="ap-lrow-meta ap-faint" style={{ fontSize: 10 }}>
                      {a.desc}
                    </div>
                  </div>
                  {done ? (
                    <span className="ap-stamp ap-stamp--nominal">EARNED</span>
                  ) : prog ? (
                    <>
                      {/* gap: no fixed-width trophy-meter slot; Meter + cur/target inline */}
                      <div style={{ width: 64, flexShrink: 0 }}>
                        <Meter pct={pct} />
                      </div>
                      <span className="ap-num ap-faint" style={{ fontSize: 10, width: 44, textAlign: "right" }}>
                        {prog.cur}/{prog.target}
                      </span>
                    </>
                  ) : (
                    <span className="ap-num ap-faint" style={{ fontSize: 10 }}>—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 6. DOWNLINK WEATHER */}
        <div className="ap-tile">
          <div className="ap-tile-label">DOWNLINK WEATHER</div>
          <div className="ap-tile-body">
            <div className="ap-mono ap-faint ap-mb-sm" style={{ fontSize: 11 }}>
              7D: {weather.totX} X · {weather.totYT} YT
            </div>
            <StackBars rows={weather.stackRows} />
            {weather.hasMobile && (
              <>
                <div className="ap-mono ap-faint ap-mt-md ap-mb-sm" style={{ fontSize: 10, letterSpacing: "0.12em" }}>
                  MOBILE HOURS · AVG {weather.avgMobile}
                </div>
                <HourBars rows={weather.hourRows} />
              </>
            )}
          </div>
        </div>

        {/* 7. MISSION DAY EPOCH */}
        <div className="ap-tile">
          <div className="ap-tile-label">MISSION DAY EPOCH</div>
          <div className="ap-tile-body">
            {/* gap: no preset-chip-row; flex wrap + active fill via inline */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {EPOCH_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="ap-btn ap-btn--sm"
                  onClick={() => setDayStartHour(p.hourVal)}
                  style={
                    hour === p.hourVal
                      ? { background: "var(--signal)", color: "var(--ink)", borderColor: "transparent" }
                      : undefined
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className="ap-mono ap-faint" style={{ fontSize: 10 }}>HOUR</span>
              <input
                type="number"
                min={0}
                max={23}
                value={hour}
                onChange={(e) => setDayStartHour(e.target.value)}
                className="ap-field ap-field--mono"
                style={{ width: 56 }}
                aria-label="Day start hour"
              />
            </div>
            <div className="ap-faint" style={{ fontSize: 11, lineHeight: 1.45 }}>
              Work after midnight counts toward the previous day when this is set past 0.
            </div>
          </div>
        </div>

        {/* 8. TELEMETRY VAULT */}
        <div className="ap-tile ap-tile--wide">
          <div className="ap-tile-label">TELEMETRY VAULT</div>
          <div className="ap-tile-body">
            {/* gap: no stacked-action-column utility; flex-col + gap */}
            <div className="ap-flex ap-flex-col ap-gap-sm">
              <button type="button" className="ap-btn" onClick={exportData}>
                Export telemetry (JSON)
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
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
              <button type="button" className="ap-btn" onClick={() => fileRef.current?.click()}>
                Import telemetry (JSON)
              </button>
              {previewMode ? (
                <button
                  type="button"
                  className="ap-btn"
                  style={{ color: "var(--warn)", borderColor: "var(--warn)" }}
                  onClick={exitPreview}
                >
                  End simulation
                </button>
              ) : (
                <button type="button" className="ap-btn" onClick={enterPreview}>
                  <Icon name="bolt" size={11} /> Run simulation
                </button>
              )}
            </div>
            <div className="ap-faint ap-mt-sm" style={{ fontSize: 11, lineHeight: 1.5 }}>
              Auto-backup keeps the last 7 days in local storage
              {backups.length ? ` (latest: ${backups[0].day})` : ""}.
            </div>
            {meta.migratedFrom && migratedList && (
              <div className="ap-mono ap-faint ap-mt-sm" style={{ fontSize: 10 }}>
                migrated from: {migratedList} — lifetime XP preserved
              </div>
            )}
          </div>
        </div>

        {/* 9. CONSOLE SKIN */}
        <div className="ap-tile">
          <div className="ap-tile-label">CONSOLE SKIN</div>
          <div className="ap-tile-body">
            {/* gap: no theme-picker-row; stacked buttons with active fill */}
            <div className="ap-flex ap-flex-col ap-gap-sm">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="ap-btn"
                  title={t.tagline}
                  onClick={() => setThemeId(t.id)}
                  style={
                    themeId === t.id
                      ? {
                        background: "var(--signal)",
                        color: "var(--ink)",
                        borderColor: "transparent",
                        justifyContent: "space-between",
                      }
                      : { justifyContent: "space-between" }
                  }
                >
                  <span>{t.name}</span>
                  <span
                    className="ap-faint"
                    style={{
                      fontSize: 9,
                      textTransform: "none",
                      letterSpacing: 0,
                      opacity: themeId === t.id ? 0.85 : 0.7,
                      color: themeId === t.id ? "var(--ink)" : undefined,
                    }}
                  >
                    {t.tagline}
                  </span>
                </button>
              ))}
            </div>
            <div className="ap-faint ap-mt-sm" style={{ fontSize: 11, lineHeight: 1.45 }}>
              Switches the whole presentation instantly. Data and features are identical in every theme.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
