// app.jsx — the Kaze shell.
//
// DEPARTURE: navigation is not a bar, a rail, or a frame edge — it is
// the signature instrument itself. The Guiding Wind runs across the
// top of every view and the three waypoints ride ON it. The ribbon's
// petals, steadiness and warmth are live readings of adrift count,
// streak and the real clock; the markers you click are part of the
// same object. (kuromi/relay already own top bars, apogee owns
// frame-edge nav, drydock/nightwatch/loft own left rails, sluis owns
// the bottom bar — so none of those were available, and none of them
// fuse nav with their data visual anyway.)
//
// The shell also stamps `data-kz-phase` on <html> so the whole palette
// tracks the real clock (dawn → day → golden → dusk → night).

import React from "react";
import { Icon, Kbd, Lamp, Charm, PetalBurst, MOD } from "./components.jsx";
import { WindRibbon } from "./wind.jsx";
import { phaseAt, PHASE_LABEL, leafBg } from "./texture.js";
import { useStore, setUI, runUndo, sel, exitPreview } from "../../core/store.js";
import { SHORTCUT_ROWS } from "../../core/keys.js";
import * as D from "../../core/domain.js";
import { TodayView } from "./views/today.jsx";
import { PlanView } from "./views/plan.jsx";
import { DockView } from "./views/dock.jsx";
import { JournalScroll } from "./views/logbook.jsx";
import { HotSpring } from "./views/review.jsx";
import { Meditation } from "./views/focus.jsx";
import { Palette } from "./views/palette.jsx";
import { CampfireDialog } from "./views/endofday.jsx";
import { TaskFormModal } from "./taskform.jsx";

const WAYPOINTS = [
  { id: "today", label: "Today's Path", icon: "path", key: "1" },
  { id: "plan", label: "The Shrine Map", icon: "map", key: "2" },
  { id: "dock", label: "The Satchel", icon: "satchel", key: "3" },
];

export default function App() {
  const view = useStore((s) => s.ui.view);
  const toast = useStore((s) => s.ui.toast);
  const confetti = useStore((s) => s.ui.confetti);
  const levelUp = useStore((s) => s.ui.levelUp);
  const helpOpen = useStore((s) => s.ui.helpOpen);
  const statsOpen = useStore((s) => s.ui.statsOpen);
  const previewMode = useStore((s) => s.ui.previewMode);
  const externalChange = useStore((s) => s.ui.externalChange);
  const aiStatus = useStore((s) => s.ui.aiStatus);
  const aiDetail = useStore((s) => s.ui.aiDetail);
  const level = useStore(sel.level);
  const totalXP = useStore(sel.totalXP);
  const streakRun = useStore(sel.streak);

  // Live readings for the wind. Raw slices in, numbers derived here.
  const windData = useStore((s) => {
    const hour = s.meta.dayStartHour || 0;
    return {
      adrift: D.getMissedWork(s.tasks, s.plan, hour).length,
      todayXP: D.todayXP(s.tasks, s.plan, hour),
    };
  });
  const lineupLift = useStore((s) => {
    const rows = (s.plan || []).find((e) => e.date === D.effectiveTodayIso(s.meta.dayStartHour || 0));
    if (!rows || !rows.items.length) return 0;
    return rows.items.filter((i) => i.done).length / rows.items.length;
  });

  const [confettiShown, setConfettiShown] = React.useState(0);
  const [phase, setPhase] = React.useState(() => phaseAt());

  // The clock drives the palette. Checked once a minute; the attribute
  // lives on <html> so texture.js can resolve tokens, and is removed
  // when the theme is switched away.
  React.useEffect(() => {
    const apply = () => setPhase(phaseAt());
    apply();
    const iv = setInterval(apply, 60000);
    return () => {
      clearInterval(iv);
      document.documentElement.removeAttribute("data-kz-phase");
    };
  }, []);
  React.useEffect(() => {
    document.documentElement.setAttribute("data-kz-phase", phase);
  }, [phase]);

  return (
    <div className="kz-shell">
      {/* ── The Guiding Wind: instrument and navigation in one ── */}
      <header className="kz-wind">
        <WindRibbon adrift={windData.adrift} streak={streakRun} lift={lineupLift} phase={phase} />

        <div className="kz-wind-mark">
          <span className="kz-wind-kanji" aria-hidden>風</span>
          <span>
            <span className="kz-wind-name">KAZE</span>
            <span className="kz-wind-sub">{PHASE_LABEL[phase]}</span>
          </span>
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: 2 }} aria-label="Main">
          {WAYPOINTS.map((w) => (
            <button key={w.id}
              className={"kz-waypoint" + (view === w.id && !statsOpen ? " kz-waypoint--here" : "")}
              onClick={() => setUI({ view: w.id, cursor: null, statsOpen: false })}
              title={`${w.label} (${w.key})`}>
              <Icon name={w.icon} size={13} />
              <span className="kz-wp-label">{w.label}</span>
              <span className="kz-waypoint-key">{w.key}</span>
            </button>
          ))}
          <button
            className={"kz-waypoint" + (statsOpen ? " kz-waypoint--here" : "")}
            onClick={() => setUI({ statsOpen: !statsOpen })}
            title="Travel Journal — the record, settings, data (4)">
            <Icon name="journal" size={13} />
            <span className="kz-wp-label">Journal</span>
            <span className="kz-waypoint-key">4</span>
          </button>
        </nav>

        <div className="kz-wind-tools">
          {streakRun > 0 && (
            <span className="kz-label" style={{ color: "var(--sakura)" }} title={`${streakRun} days with the wind at your back`}>
              <Icon name="wind" size={11} /> {streakRun}d
            </span>
          )}
          <span className="kz-label kz-num" title={`${totalXP} resolve · ${level.xpToNext > 0 ? level.xpToNext + " to the next charm" : "highest charm"}`}>
            {windData.todayXP > 0 ? `+${windData.todayXP}` : "—"}
          </span>
          <Charm pct={level.pct} glyph={String(level.lvl)}
            title={`Charm ${level.lvl} · ${level.title} · ${totalXP} resolve${level.xpToNext > 0 ? ` · ${level.xpToNext} to the next` : " · highest"}`} />
          <button className="kz-icon-btn" onClick={() => setUI({ helpOpen: true })} title="The traveller's marks (?)"><Kbd>?</Kbd></button>
          <button className="kz-icon-btn" onClick={() => setUI({ paletteOpen: true })} title="Ask the wind — command palette"><Kbd>{MOD}K</Kbd></button>
          <Lamp status={aiStatus} detail={aiDetail} />
        </div>
      </header>

      <main className="kz-stage">
        {previewMode && (
          <div className="kz-banner" style={{ top: 66, background: "var(--amber)", color: "var(--ink)" }}>
            <span className="kz-tape" style={{ background: "var(--ink)", color: "var(--amber)" }}>Borrowed road</span>
            <span style={{ flex: 1 }}>Sample country — your real road is kept safe and returns when you leave.</span>
            <button className="kz-btn kz-btn--sm" style={{ borderColor: "var(--ink)", color: "var(--ink)" }} onClick={exitPreview}>Leave preview</button>
          </div>
        )}
        {externalChange && (
          <div className="kz-banner" style={{ top: 66, background: "var(--warn)", color: "var(--ink)" }}>
            <span className="kz-tape" style={{ background: "var(--ink)", color: "var(--warn)" }}>Another traveller</span>
            <span style={{ flex: 1 }}>This road changed in another window — reload to walk the same one.</span>
            <button className="kz-btn kz-btn--sm" style={{ borderColor: "var(--ink)", color: "var(--ink)" }} onClick={() => window.location.reload()}>Reload</button>
            <button className="kz-icon-btn" style={{ color: "var(--ink)" }} onClick={() => setUI({ externalChange: false })} aria-label="Dismiss"><Icon name="close" size={12} /></button>
          </div>
        )}

        {view === "today" && <TodayView />}
        {view === "plan" && <PlanView />}
        {view === "dock" && <DockView />}
      </main>

      {toast && (
        <div className="kz-toast" role="status">
          <span className={"kz-toast-lead" + (toast.xp != null && toast.xp < 0 ? " kz-toast-lead--port" : "")}>
            <Icon name={toast.xp != null && toast.xp !== 0 ? "petal" : "check"} size={13} />
          </span>
          {toast.xp != null && toast.xp !== 0 && (
            <span className="kz-num" style={{ color: toast.xp >= 0 ? "var(--sakura)" : "var(--port)", fontWeight: 600, fontSize: 12 }}>
              {toast.xp >= 0 ? "+" : ""}{toast.xp}
            </span>
          )}
          <span style={{ padding: "11px 0" }}>{toast.msg}</span>
          {toast.undoId && (
            <button className="kz-btn kz-btn--sm" onClick={() => runUndo(toast.undoId)}>
              Unscatter <Kbd>U</Kbd>
            </button>
          )}
        </div>
      )}

      {confetti > confettiShown && <PetalBurst onDone={() => setConfettiShown(confetti)} />}

      {levelUp && (
        <div role="status" aria-live="polite" className="kz-statement kz-fade-in"
          style={{ ...leafBg("kz-charm-" + levelUp.lvl), position: "fixed", left: "50%", top: 82, transform: "translateX(-50%)", zIndex: 10007, padding: "11px 22px 13px", display: "flex", alignItems: "center", gap: 14 }}>
          <Charm pct={100} glyph={String(levelUp.lvl)} title={`Charm ${levelUp.lvl}`} />
          <span>
            <span className="kz-label" style={{ display: "block" }}>A new charm</span>
            <span className="kz-brush" style={{ fontSize: 16 }}>{levelUp.title}</span>
          </span>
        </div>
      )}

      {helpOpen && (
        <div onClick={() => setUI({ helpOpen: false })} className="kz-backdrop"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10004 }}>
          <div onClick={(e) => e.stopPropagation()} className="kz-sheet kz-fade-in" style={{ padding: 24, minWidth: 360, maxWidth: 440 }}>
            <div style={{ marginBottom: 18 }}><span className="kz-tape">The traveller's marks</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {SHORTCUT_ROWS.map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
                  <span style={{ fontSize: 13 }}>{v}</span>
                  <Kbd>{k}</Kbd>
                </div>
              ))}
            </div>
            <button className="kz-btn" style={{ marginTop: 20, width: "100%", justifyContent: "center" }} onClick={() => setUI({ helpOpen: false })}>Close</button>
          </div>
        </div>
      )}

      <TaskFormModal />
      <JournalScroll />
      <HotSpring />
      <Palette />
      <CampfireDialog />
      <Meditation />
    </div>
  );
}
