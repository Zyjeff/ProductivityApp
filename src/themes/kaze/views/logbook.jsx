// logbook.jsx — The Travel Journal.
//
// DEPARTURE: the Logbook is a horizontal hand-scroll (emakimono). It
// unrolls left to right between two wooden rods; each panel is one
// section of the record, sealed with a hanko. No other theme uses a
// horizontal surface — the shipped ones are a slide-over panel, four
// full-page overlays, a bottom sheet and an in-stage tile wall.
//
// Every capability of the reference Logbook ships here: rank, tiles,
// 30-day averages, calibration, screen weather, all trophies with
// derived progress, the reviews list, rollover, data tools, and the
// theme picker (the way out of this theme).

import React, { useMemo, useRef, useState } from "react";
import { Icon, Eyebrow, Seal, Meter, Kbd, Charm, InkFoot } from "../components.jsx";
import { WeatherBars, CalRow, ToriiRow } from "../charts.jsx";
import { leafBg } from "../texture.js";
import * as D from "../../../core/domain.js";
import { useStore, setUI, setDayStartHour, exportData, importDataFromFile, enterPreview, exitPreview, notify, openReview } from "../../../core/store.js";
import { listBackups } from "../../../core/db.js";
import { useThemeId, setThemeId } from "../../../core/theme.js";
import { THEMES } from "../../registry.js";

export function JournalScroll() {
  const open = useStore((s) => s.ui.statsOpen);
  if (!open) return null;
  return <Inner />;
}

function Panel({ no, title, children, wide = false }) {
  return (
    <section className={"kz-panel kz-scroll" + (wide ? " kz-panel--wide" : "")} aria-label={title}>
      <div className="kz-panel-head">
        <span className="kz-panel-no kz-brush">{no}</span>
        <div className="kz-label-row" style={{ flex: 1 }}>
          <span className="kz-label kz-label--lit">{title}</span>
        </div>
      </div>
      {children}
    </section>
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
  const railRef = useRef(null);
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
      arrived: projects.filter((p) => p.completedAt).length,
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
  const focusTotal = (sessions || []).reduce((acc, x) => acc + (x.ms || 0), 0);

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
  const totX = s7.reduce((acc, d) => acc + d.x, 0);
  const totYT = s7.reduce((acc, d) => acc + d.yt, 0);
  const mVals = screen14.filter((d) => d.mobile != null).map((d) => d.mobile);
  const avgMobile = mVals.length ? (mVals.reduce((acc, v) => acc + v, 0) / mVals.length).toFixed(1) + "h" : "—";

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
    { label: "Standard", hourVal: 0, hint: "the day turns at midnight" },
    { label: "Late", hourVal: 22, hint: "turns at 10pm" },
    { label: "Overnight", hourVal: 4, hint: "turns at 4am — late work still counts as today" },
  ];
  const backups = listBackups();
  const sinceLabel = derived.firstIso
    ? D.parseIsoDate(derived.firstIso).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "today";

  const nudge = (dir) => {
    const el = railRef.current;
    if (el) el.scrollBy({ left: dir * 392, behavior: "smooth" });
  };

  return (
    <div className="kz-journal" role="dialog" aria-label="Travel Journal">
      <div className="kz-journal-head">
        <span className="kz-wind-kanji" aria-hidden style={{ fontSize: 21 }}>記</span>
        <div>
          <div className="kz-brush" style={{ fontSize: 18, lineHeight: 1.2 }}>The Travel Journal</div>
          <div className="kz-label">since {sinceLabel} · {derived.activeDays} day{derived.activeDays === 1 ? "" : "s"} on the road</div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="kz-icon-btn" onClick={() => nudge(-1)} aria-label="Roll back"><Icon name="chevronL" size={15} /></button>
        <button className="kz-icon-btn" onClick={() => nudge(1)} aria-label="Unroll further"><Icon name="chevronR" size={15} /></button>
        <button className="kz-btn kz-btn--sm" onClick={() => setUI({ statsOpen: false })} aria-label="Close the journal">
          <Icon name="close" size={11} /> Roll up <Kbd>Esc</Kbd>
        </button>
      </div>

      <div className="kz-journal-rail kz-scroll" ref={railRef}>
        <div className="kz-journal-rod kz-journal-rod--l" aria-hidden />

        {/* 一 — the charm you carry */}
        <Panel no="一" title="The charm you carry">
          <div className="kz-statement" style={{ ...leafBg("kz-rank-" + derived.level.lvl), marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
              <Charm pct={derived.level.pct} glyph={String(derived.level.lvl)} size={1.5}
                title={`Charm ${derived.level.lvl}`} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="kz-label" style={{ marginBottom: 4 }}>Charm {derived.level.lvl}</div>
                <div className="kz-brush" style={{ fontSize: 20, lineHeight: 1.25 }}>{derived.level.title}</div>
              </div>
            </div>
            <div className="kz-num" style={{ marginTop: 13, fontSize: 10.5, color: "var(--ink)", opacity: .78 }}>
              {derived.total} resolve{derived.level.xpToNext > 0 ? ` · ${derived.level.xpToNext} to charm ${derived.level.lvl + 1}` : " · the last charm"}
            </div>
            <div className="kz-meter" style={{ marginTop: 10, background: "rgba(20,16,12,0.25)" }}>
              <div className="kz-meter-fill" style={{ width: derived.level.pct + "%", backgroundColor: "var(--ink)" }} />
            </div>
            {nextLevelName && nextThreshold != null && (
              <div className="kz-num" style={{ marginTop: 13, fontSize: 9.5, color: "var(--ink)", opacity: .65, lineHeight: 1.7 }}>
                NEXT — {nextLevelName} at {nextThreshold} resolve
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { l: "Wind", v: `${derived.streakRun}d` },
              { l: "Reached", v: derived.count },
              { l: "Arrived", v: derived.arrived },
            ].map((x) => (
              <div key={x.l} className="kz-card" style={{ padding: "10px 12px" }}>
                <div className="kz-label" style={{ marginBottom: 4 }}>{x.l}</div>
                <div className="kz-brush kz-num" style={{ fontSize: 17 }}>{x.v}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 22 }}>
            <Eyebrow>Thirty days behind</Eyebrow>
            <div className="kz-card" style={{ padding: "14px 16px" }}>
              <CalRow label="Resolve / day" pct={Math.min(100, (avg30.xpPerDay / 150) * 100)} tone="var(--sakura)" value={avg30.xpPerDay} />
              <CalRow label="Walked / day" pct={Math.min(100, (avg30.focusPerDay / 5) * 100)} tone="var(--channel)" value={avg30.focusPerDay >= 0.05 ? avg30.focusPerDay.toFixed(1) + "h" : "—"} />
              <CalRow label="Days walking" pct={avg30.activeRate} tone="var(--amber)" value={avg30.activeRate + "%"} />
              <CalRow label="Weathered now" pct={Math.min(100, avg30.adriftNow * 12)} tone="var(--warn)" value={avg30.adriftNow} last />
            </div>
          </div>
        </Panel>

        {/* 二 — how far you really walk */}
        <Panel no="二" title="How far you really walk">
          <div className="kz-card" style={{ padding: "14px 16px" }}>
            {cal.overall.n < 3 ? (
              <div style={{ fontSize: 12.5, color: "var(--fg-faint)", lineHeight: 1.65 }}>
                Not enough finished, walked road to measure yet ({cal.overall.n}/3 waypoints).
                Sit with real work in Meditation and this becomes an honest mirror of guess against ground.
                {focusTotal > 0 && <> Walked so far: {D.fmtMs(focusTotal)}.</>}
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 11, flexWrap: "wrap" }}>
                  <span className="kz-brush" style={{ fontSize: 26, color: cal.overall.factor > 1.15 ? "var(--warn)" : cal.overall.factor < 0.9 ? "var(--channel)" : "var(--sakura)" }}>
                    {cal.overall.factor}×
                  </span>
                  <span style={{ fontSize: 12, color: "var(--fg-dim)" }}>
                    ground against guess · {cal.overall.n} waypoints · {D.fmtMs(focusTotal)} walked
                  </span>
                </div>
                {Object.entries(cal.byDifficulty).map(([k, v], i, arr) => (
                  v.factor && v.n >= 2
                    ? <CalRow key={k} label={`${k} (n=${v.n})`} pct={Math.min(100, v.factor * 50)} tone={v.factor > 1.15 ? "var(--warn)" : "var(--sakura)"} value={v.factor + "×"} last={i === arr.length - 1} />
                    : <CalRow key={k} label={k} pct={0} tone="var(--fg-faint)" value="—" last={i === arr.length - 1} />
                ))}
                <div style={{ fontSize: 10.5, color: "var(--fg-faint)", marginTop: 11 }}>
                  The oracle reads these, so new guesses learn from your real ground.
                </div>
              </>
            )}
          </div>

          <div style={{ marginTop: 22 }}>
            <Eyebrow>Distractions · fourteen days</Eyebrow>
            <div className="kz-card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 11, flexWrap: "wrap" }}>
                <Seal>7d: {totX} X · {totYT} YT</Seal>
                <Seal>avg glass {avgMobile}</Seal>
              </div>
              <WeatherBars data={screen14.map((d) => ({ value: d.opens, title: `${d.iso}: ${d.x} X · ${d.yt} YT` }))} threshold={10} />
              <div className="kz-label" style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span>opens per day</span><span>red past ten</span>
              </div>
              {mVals.length > 0 && (
                <>
                  <div className="kz-label" style={{ margin: "13px 0 6px" }}>hours on the glass</div>
                  <WeatherBars height={30} data={screen14.map((d) => ({ value: d.mobile ?? 0, title: `${d.iso}: ${d.mobile ?? "—"}h` }))} />
                </>
              )}
            </div>
          </div>
        </Panel>

        {/* 三 — charms collected */}
        <Panel no="三" title={`Charms collected · ${achievements.length}/${D.ACHIEVEMENTS.length}`}>
          <div style={{ marginBottom: 13 }}>
            <ToriiRow pct={(achievements.length / D.ACHIEVEMENTS.length) * 100} count={8} size={19} color="var(--sakura)" />
          </div>
          <div className="kz-card" style={{ overflow: "hidden" }}>
            {D.ACHIEVEMENTS.map((a) => {
              const done = achievements.includes(a.id);
              const prog = !done ? D.achievementProgress(a.id, ctx) : null;
              const pct = prog ? Math.min(100, Math.round((prog.cur / prog.target) * 100)) : 0;
              return (
                <div key={a.id} className="kz-shrine" style={{ "--row-lamp": done ? "var(--sakura)" : "var(--line-dim)", background: "transparent" }}>
                  <span style={{ color: done ? "var(--sakura)" : "var(--fg-faint)", display: "inline-flex" }}><Icon name="charm" size={13} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                    <div className="kz-label" style={{ letterSpacing: ".06em" }}>{a.desc}</div>
                  </div>
                  {done
                    ? <span className="kz-tape kz-tape--sakura" style={{ fontSize: 8 }}>Earned</span>
                    : prog
                      ? <>
                          <div className="kz-trophy-meter"><Meter pct={pct} height={4} /></div>
                          <span className="kz-label" style={{ width: 42, textAlign: "right" }}>{prog.cur}/{prog.target}</span>
                        </>
                      : <span className="kz-label">—</span>}
                </div>
              );
            })}
          </div>
        </Panel>

        {/* 四 — the springs behind you */}
        <Panel no="四" title="The springs behind you">
          {weeks.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--fg-faint)" }}>No weeks with walking yet — the record starts when the road does.</div>
          ) : (
            <div className="kz-card" style={{ overflow: "hidden" }}>
              {weeks.map((w) => {
                const entry = reviews?.[w];
                const label = entry?.text
                  ? entry.text.slice(0, 60) + (entry.text.length > 60 ? "…" : "")
                  : "numbers ready · nothing written yet";
                return (
                  <div key={w} className="kz-shrine" style={{ "--row-lamp": entry?.text ? "var(--channel)" : "var(--line-dim)", background: "transparent" }}>
                    <span className="kz-tape kz-tape--channel" style={{ fontSize: 8 }}>W{weekNo(w)}</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                    <button className="kz-link" onClick={() => { setUI({ statsOpen: false }); openReview(w); }}>Open →</button>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ marginTop: 13 }}>
            <button className="kz-btn kz-btn--sm" onClick={() => { setUI({ statsOpen: false }); openReview(); }}>
              <Icon name="spring" size={11} /> The hot spring <Kbd>W</Kbd>
            </button>
          </div>

          <div style={{ marginTop: 26 }}>
            <Eyebrow>When the day turns</Eyebrow>
            <div className="kz-card" style={{ padding: "13px 15px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 11 }}>
                <span className="kz-label" style={{ flex: 1 }}>the day begins at</span>
                <button className="kz-btn kz-btn--sm" onClick={() => setDayStartHour(Math.max(0, hour - 1))} aria-label="Earlier">−</button>
                <input type="number" min="0" max="23" value={hour} onChange={(e) => setDayStartHour(e.target.value)}
                  className="kz-bare kz-num" style={{ width: 48, textAlign: "center", fontSize: 13, color: "var(--amber)" }} aria-label="Day rollover hour" />
                <button className="kz-btn kz-btn--sm" onClick={() => setDayStartHour(Math.min(23, hour + 1))} aria-label="Later">+</button>
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {presets.map((p) => (
                  <button key={p.label} title={p.hint} onClick={() => setDayStartHour(p.hourVal)}
                    className="kz-btn kz-btn--sm"
                    style={hour === p.hourVal ? { background: "var(--amber)", color: "var(--ink)", borderColor: "transparent" } : {}}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 9, lineHeight: 1.5 }}>
                Work after midnight belongs to the day before, when this is set past 0.
              </div>
            </div>
          </div>
        </Panel>

        {/* 五 — the way out, and the paperwork */}
        <Panel no="五" title="The road out" wide>
          <Eyebrow>Which road you walk</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {THEMES.map((t) => (
              <button key={t.id} title={t.tagline} onClick={() => setThemeId(t.id)}
                className="kz-btn"
                style={themeId === t.id
                  ? { background: "var(--amber)", color: "var(--ink)", borderColor: "transparent", justifyContent: "space-between", textAlign: "left" }
                  : { justifyContent: "space-between", textAlign: "left" }}>
                <span style={{ fontWeight: 600 }}>{t.name}</span>
                <span style={{ fontSize: 10, opacity: .75, marginLeft: 10 }}>{t.tagline}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 8, lineHeight: 1.55 }}>
            Changes the whole presentation at once. Your road, and everything on it, is identical in every one.
          </div>

          <div style={{ marginTop: 26 }}>
            <Eyebrow>What you carry out</Eyebrow>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <button className="kz-btn" onClick={exportData}>Copy the journal out (JSON)</button>
              <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const mode = window.confirm("OK = MERGE with what's here (safe). Cancel = choose replace on the next dialog.")
                    ? "merge"
                    : window.confirm("REPLACE everything with the backup? This overwrites the lot (a daily auto-backup exists).") ? "replace" : null;
                  if (mode) importDataFromFile(f, mode).catch((err) => notify(String(err.message || err)));
                  e.target.value = "";
                }} />
              <button className="kz-btn" onClick={() => fileRef.current?.click()}>Bring a journal in (Werf or Quest)</button>
              {previewMode
                ? <button className="kz-btn" style={{ color: "var(--amber-hot)", borderColor: "var(--amber-deep)" }} onClick={exitPreview}>Leave the borrowed road</button>
                : <button className="kz-btn" onClick={enterPreview}><Icon name="petal" size={11} /> Walk a borrowed road</button>}
            </div>
            <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 9, lineHeight: 1.55 }}>
              The last seven days are kept here automatically{backups.length ? ` (latest: ${backups[0].day})` : ""}. Copy it out weekly for a spare.
            </div>
            {meta.migratedFrom && (
              <div className="kz-label" style={{ marginTop: 7 }}>
                carried over from: {[meta.migratedFrom.quest && "quest", meta.migratedFrom.vsq && "vsq", meta.migratedFrom.shiplist && "shiplist"].filter(Boolean).join(" + ")} · lifetime resolve kept
              </div>
            )}
          </div>

          <div style={{ marginTop: 26 }}>
            <InkFoot caption="風 — the wind guides you" />
          </div>
        </Panel>

        <div className="kz-journal-rod kz-journal-rod--r" aria-hidden />
      </div>

      <div className="kz-journal-foot">
        <span>scroll sideways · shift+wheel · tab walks the panels</span>
      </div>
    </div>
  );
}
