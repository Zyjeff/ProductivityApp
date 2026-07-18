// logbook.jsx — Het Peilhuis, the gauge house. Sluis renders the
// Logbook as a bottom sheet rising from the wal (same statsOpen state,
// same `4` and Esc): level staff with NEXT RANK, the gauge wall of
// streak/completed/launched + 30-day averages, weekschouw entries,
// estimate calibration, seinlog (screen weather), all sixteen
// trophies, dagwissel rollover, data tools, and the theme picker
// ("Wissel van werf"). Every capability of the Nightwatch logbook
// ships here, recomposed.

import React, { useMemo, useRef } from "react";
import { Icon, Kbd, Chip, ChipPick, Meter, PeilStaff, Eyebrow } from "../components.jsx";
import * as D from "../../../core/domain.js";
import { useStore, setUI, setDayStartHour, exportData, importDataFromFile, enterPreview, exitPreview, notify, openReview } from "../../../core/store.js";
import { listBackups } from "../../../core/db.js";
import { useThemeId, setThemeId } from "../../../core/theme.js";
import { THEMES } from "../../registry.js";

export function PeilhuisSheet() {
  const open = useStore((s) => s.ui.statsOpen);
  if (!open) return null;
  return <Inner />;
}

/* ── tiny local instruments (Sluis has no charts module) ────── */

// Screen-weather columns: water fill, port-red when over threshold.
function Bars({ data, threshold = null, height = 44 }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height }}>
      {data.map((d, i) => {
        const over = threshold != null && d.value > threshold;
        return (
          <div key={i} title={d.title || `${d.value}`}
            style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", background: "var(--well)", border: "1px solid var(--line)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              width: "100%", height: Math.max(0, Math.min(100, (d.value / max) * 100)) + "%",
              background: over ? "var(--port)" : "linear-gradient(180deg, var(--water-bright), var(--water))",
            }} />
          </div>
        );
      })}
    </div>
  );
}

// Labelled meter row (calibration factors).
function FactorRow({ label, pct, tone = "var(--water)", value, last = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: last ? 0 : 8 }}>
      <span className="s-stencil" style={{ width: 96, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}><Meter pct={pct} tone={tone} height={5} /></div>
      <span className="s-num" style={{ width: 44, textAlign: "right", fontSize: 11, color: tone, flexShrink: 0 }}>{value}</span>
    </div>
  );
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

  const tiles = [
    { l: "Streak", v: `${derived.streakRun}d`, sub: "days with locked-through work" },
    { l: "Doorgeschut", v: derived.count, sub: "vessels completed" },
    { l: "Te water", v: derived.launched, sub: "ships launched" },
    { l: "XP per dag", v: avg30.xpPerDay, sub: "30-day average" },
    { l: "Focus per dag", v: avg30.focusPerDay >= 0.05 ? avg30.focusPerDay.toFixed(1) + "h" : "—", sub: "30-day average" },
    { l: "Kolk leeg", v: avg30.activeRate + "%", sub: "of the last 30 days" },
    { l: "Drijfwerk", v: avg30.adriftNow, sub: "adrift right now" },
  ];

  return (
    <div className="s-backdrop" onClick={() => setUI({ statsOpen: false })}>
      <div className="s-sheet s-sheet--wide" role="dialog" aria-label="Het Peilhuis" onClick={(e) => e.stopPropagation()}>
        <div className="s-sheet-grip" />
        <div className="s-sheet-body">

          {/* ── header: the level statement ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <PeilStaff pct={derived.level.pct} height={86} width={14} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="s-stencil-row" style={{ marginBottom: 8 }}>
                <span className="s-stencil s-stencil--lit">Het Peilhuis · de stand van de werf</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span className="s-display s-num" style={{ fontSize: 38, lineHeight: 1, color: "var(--water-deep)" }}>{derived.level.lvl}</span>
                <span className="s-display" style={{ fontSize: 19, textTransform: "uppercase" }}>{derived.level.title}</span>
              </div>
              <div className="s-num" style={{ marginTop: 8, fontSize: 11, color: "var(--fg-dim)" }}>
                {derived.total} XP{derived.level.xpToNext > 0 ? ` · ${derived.level.xpToNext} TO LEVEL ${derived.level.lvl + 1}` : " · MAX"}
              </div>
              <div style={{ marginTop: 8, maxWidth: 340 }}>
                <Meter pct={derived.level.pct} height={6} />
              </div>
              {nextLevelName && nextThreshold != null && (
                <div className="s-num" style={{ marginTop: 8, fontSize: 9.5, color: "var(--fg-faint)", letterSpacing: ".06em" }}>
                  NEXT RANK — {nextLevelName.toUpperCase()} AT {nextThreshold} XP
                </div>
              )}
              <div className="s-num" style={{ marginTop: 4, fontSize: 9.5, color: "var(--fg-faint)", letterSpacing: ".06em" }}>
                SINCE {sinceLabel} · {derived.activeDays} ACTIVE DAY{derived.activeDays === 1 ? "" : "S"}
              </div>
            </div>
            <button className="s-btn s-btn--sm s-btn--ghost" style={{ alignSelf: "flex-start", flexShrink: 0 }} onClick={() => setUI({ statsOpen: false })} aria-label="Close peilhuis">
              <Icon name="close" size={11} /> Close <Kbd>Esc</Kbd>
            </button>
          </div>

          {/* ── the gauge wall ── */}
          <div className="s-gaugewall" style={{ marginTop: 20 }}>
            {tiles.map((t) => (
              <div key={t.l} className="s-gauge-tile">
                <div className="s-stencil">{t.l}</div>
                <div className="s-gauge-val">{t.v}</div>
                <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 3 }}>{t.sub}</div>
              </div>
            ))}
          </div>

          {/* ── weekschouw ── */}
          <section style={{ marginTop: 26 }}>
            <Eyebrow right={
              <button className="s-btn s-btn--sm" onClick={() => { setUI({ statsOpen: false }); openReview(); }}>
                Weekschouw <Kbd>W</Kbd>
              </button>
            }>Weekschouw</Eyebrow>
            {weeks.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>No weeks with activity yet — the log starts when the work does.</div>
            ) : (
              <div style={{ background: "var(--plate-hi)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "4px 14px" }}>
                {weeks.map((w) => {
                  const entry = reviews?.[w];
                  const label = entry?.text
                    ? entry.text.slice(0, 64) + (entry.text.length > 64 ? "…" : "")
                    : "stats ready · no retro written yet";
                  return (
                    <div key={w} className="s-reg-row" style={{ padding: "8px 0", borderBottom: "1px dashed var(--line)" }}>
                      <Chip tone="var(--channel)">W{weekNo(w)}</Chip>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                      <button className="s-btn s-btn--sm s-btn--ghost" onClick={() => { setUI({ statsOpen: false }); openReview(w); }}>Open</button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── kalibratie ── */}
          <section style={{ marginTop: 26 }}>
            <Eyebrow>Kalibratie · last 60 days</Eyebrow>
            <div style={{ background: "var(--plate-hi)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "14px 16px" }}>
              {cal.overall.n < 3 ? (
                <div style={{ fontSize: 12, color: "var(--fg-faint)", lineHeight: 1.5 }}>
                  Not enough finished, focused work to calibrate yet ({cal.overall.n}/3 tasks).
                  Run the focus tunnel on real tasks and this becomes your actual-vs-estimate mirror.
                  {focusTotal > 0 && <> Logged so far: {D.fmtMs(focusTotal)}.</>}
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
                    <span className="s-display s-num" style={{ fontSize: 26, color: cal.overall.factor > 1.15 ? "var(--amber-hot)" : cal.overall.factor < 0.9 ? "var(--channel)" : "var(--starboard)" }}>
                      {cal.overall.factor}×
                    </span>
                    <span style={{ fontSize: 12, color: "var(--fg-dim)" }}>
                      actual vs estimate · {cal.overall.n} tasks · {D.fmtMs(focusTotal)} focused
                    </span>
                  </div>
                  {Object.entries(cal.byDifficulty).map(([k, v], i, arr) => (
                    v.factor && v.n >= 2
                      ? <FactorRow key={k} label={`${k} (n=${v.n})`} pct={Math.min(100, v.factor * 50)} tone={v.factor > 1.15 ? "var(--amber-hot)" : "var(--starboard)"} value={v.factor + "×"} last={i === arr.length - 1} />
                      : <FactorRow key={k} label={k} pct={0} tone="var(--fg-faint)" value="—" last={i === arr.length - 1} />
                  ))}
                  <div style={{ fontSize: 10.5, color: "var(--fg-faint)", marginTop: 10 }}>
                    The AI scorer reads these factors, so new estimates learn from your reality.
                  </div>
                </>
              )}
            </div>
          </section>

          {/* ── seinlog: screen weather ── */}
          <section style={{ marginTop: 26 }}>
            <Eyebrow>Seinlog · 14 days</Eyebrow>
            <div style={{ background: "var(--plate-hi)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "14px 16px" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <Chip>7D: {totX} X · {totYT} YT</Chip>
                <Chip>AVG MOBILE {avgMobile}</Chip>
              </div>
              <Bars data={screen14.map((d) => ({ value: d.opens, title: `${d.iso}: ${d.x} X · ${d.yt} YT` }))} threshold={10} />
              <div className="s-num" style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 9, color: "var(--fg-faint)", letterSpacing: ".06em" }}>
                <span>X + YT OPENS PER DAY</span><span>PORT MARKS DAYS OVER 10</span>
              </div>
              {mVals.length > 0 && (
                <>
                  <div className="s-num" style={{ fontSize: 9, color: "var(--fg-faint)", margin: "14px 0 6px", letterSpacing: ".06em" }}>MOBILE HOURS</div>
                  <Bars height={30} data={screen14.map((d) => ({ value: d.mobile ?? 0, title: `${d.iso}: ${d.mobile ?? "—"}h` }))} />
                </>
              )}
            </div>
          </section>

          {/* ── trofeeën ── */}
          <section style={{ marginTop: 26 }}>
            <Eyebrow>Trofeeën · {achievements.length}/{D.ACHIEVEMENTS.length}</Eyebrow>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 10 }}>
              {D.ACHIEVEMENTS.map((a) => {
                const done = achievements.includes(a.id);
                const prog = !done ? D.achievementProgress(a.id, ctx) : null;
                const pct = prog ? Math.min(100, Math.round((prog.cur / prog.target) * 100)) : 0;
                return (
                  <div key={a.id} className={"s-trophy" + (done ? " s-trophy--earned" : "")}>
                    <span style={{ color: done ? "var(--amber-hot)" : "var(--fg-faint)", flexShrink: 0, display: "inline-flex" }}>
                      <Icon name="trophy" size={14} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{a.title}</div>
                      <div style={{ fontSize: 10.5, color: "var(--fg-faint)", lineHeight: 1.4 }}>{a.desc}</div>
                      {!done && prog && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                          <div style={{ flex: 1, minWidth: 0 }}><Meter pct={pct} height={4} /></div>
                          <span className="s-num" style={{ fontSize: 9.5, color: "var(--fg-faint)", flexShrink: 0 }}>{prog.cur}/{prog.target}</span>
                        </div>
                      )}
                      {!done && !prog && (
                        <div className="s-num" style={{ fontSize: 9.5, color: "var(--fg-faint)", marginTop: 4 }}>—</div>
                      )}
                    </div>
                    {done && <span className="s-chip" style={{ background: "var(--amber-ground)", color: "var(--amber-deep)", flexShrink: 0 }}>Verdiend</span>}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── dagwissel: day rollover ── */}
          <section style={{ marginTop: 26 }}>
            <Eyebrow>Dagwissel</Eyebrow>
            <div style={{ background: "var(--plate-hi)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "13px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span className="s-num" style={{ fontSize: 11, color: "var(--fg-dim)", flex: 1, letterSpacing: ".06em" }}>DAY STARTS AT</span>
                <button className="s-btn s-btn--sm s-btn--ghost" onClick={() => setDayStartHour(Math.max(0, hour - 1))} aria-label="One hour earlier">−</button>
                <input type="number" min="0" max="23" value={hour} onChange={(e) => setDayStartHour(e.target.value)}
                  className="s-field s-num" style={{ width: 58, textAlign: "center", padding: "5px 6px" }} aria-label="Day rollover hour" />
                <button className="s-btn s-btn--sm s-btn--ghost" onClick={() => setDayStartHour(Math.min(23, hour + 1))} aria-label="One hour later">+</button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {presets.map((p) => (
                  <ChipPick key={p.label} title={p.hint} active={hour === p.hourVal} onClick={() => setDayStartHour(p.hourVal)}>
                    {p.label}
                  </ChipPick>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 10 }}>
                Work after midnight counts toward the previous day when this is set past 0.
              </div>
            </div>
          </section>

          {/* ── data ── */}
          <section style={{ marginTop: 26 }}>
            <Eyebrow>Data</Eyebrow>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 420 }}>
              <button className="s-btn s-btn--ghost" style={{ justifyContent: "flex-start" }} onClick={exportData}>Export manifest (JSON)</button>
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
              <button className="s-btn s-btn--ghost" style={{ justifyContent: "flex-start" }} onClick={() => fileRef.current?.click()}>Import manifest (Werf or Quest)</button>
              {previewMode
                ? <button className="s-btn s-btn--amber" style={{ justifyContent: "flex-start" }} onClick={exitPreview}>Exit oefenwater</button>
                : <button className="s-btn s-btn--ghost" style={{ justifyContent: "flex-start" }} onClick={enterPreview}><Icon name="bolt" size={11} /> Oefenwater — preview with sample data</button>}
            </div>
            <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 10, lineHeight: 1.5 }}>
              Auto-backup keeps the last 7 days in local storage{backups.length ? ` (latest: ${backups[0].day})` : ""}. Export weekly for an off-machine copy.
            </div>
            {meta.migratedFrom && (
              <div className="s-num" style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 6 }}>
                migrated from: {[meta.migratedFrom.quest && "quest", meta.migratedFrom.vsq && "vsq", meta.migratedFrom.shiplist && "shiplist"].filter(Boolean).join(" + ")} · lifetime XP preserved
              </div>
            )}
          </section>

          {/* ── wissel van werf: theme picker ── */}
          <section style={{ marginTop: 26 }}>
            <Eyebrow>Wissel van werf</Eyebrow>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
              {THEMES.map((t) => {
                const active = themeId === t.id;
                return (
                  <button key={t.id} title={t.tagline} onClick={() => setThemeId(t.id)}
                    style={{
                      textAlign: "left", cursor: "pointer", padding: "12px 14px",
                      borderRadius: "var(--r-md)",
                      background: active ? "var(--water-ground)" : "var(--plate-hi)",
                      border: "1px solid " + (active ? "var(--water)" : "var(--line)"),
                      boxShadow: active ? "0 0 0 3px var(--water-ground)" : "none",
                      transition: "border-color var(--fast), box-shadow var(--fast), background var(--fast)",
                    }}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span className="s-display" style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</span>
                      {active && <span className="s-stencil s-stencil--lit" style={{ flexShrink: 0 }}>actief</span>}
                    </span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--fg-dim)", marginTop: 4, lineHeight: 1.45 }}>{t.tagline}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 8 }}>
              Switches the whole presentation instantly. Data and features are identical on every werf.
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
