// app.jsx — the Nightwatch shell: mast with the draught gauge, the
// harbor strip (clock · watch · bells), three surfaces, and every
// overlay. Same capabilities as Drydock's shell, different night.

import React from "react";
import { Icon, Kbd, Lamp, Confetti, MOD } from "./components.jsx";
import { HarborStrip } from "./chrome.jsx";
import { tex, statementBg } from "./texture.js";
import { useStore, setUI, runUndo, sel, exitPreview } from "../../core/store.js";
import { SHORTCUT_ROWS } from "../../core/keys.js";
import * as D from "../../core/domain.js";
import { TodayView } from "./views/today.jsx";
import { PlanView } from "./views/plan.jsx";
import { DockView } from "./views/dock.jsx";
import { LogbookPage } from "./views/logbook.jsx";
import { ReviewOverlay } from "./views/review.jsx";
import { FocusTunnel } from "./views/focus.jsx";
import { Palette } from "./views/palette.jsx";
import { EndOfDayDialog } from "./views/endofday.jsx";
import { TaskFormModal } from "./taskform.jsx";

function BrandMark() {
  const bg = React.useMemo(
    () => tex({ seed: "nightwatch-mark", algo: "noise", w: 30, h: 30, cell: 2, fg: "#f5a524", grad: { from: 0.9, to: 0.1, dir: "down" } }),
    []
  );
  return (
    <div aria-hidden style={{
      width: 30, height: 30, flexShrink: 0,
      backgroundImage: bg, backgroundColor: "var(--plate)",
      clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
    }} />
  );
}

const NAV = [
  { id: "today", label: "Today", icon: "today", key: "1" },
  { id: "plan", label: "Plan", icon: "calendar", key: "2" },
  { id: "dock", label: "Dock", icon: "anchor", key: "3" },
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
  const level = useStore(sel.level);
  const totalXP = useStore(sel.totalXP);
  const streakRun = useStore(sel.streak);
  const aiStatus = useStore((s) => s.ui.aiStatus);
  const aiDetail = useStore((s) => s.ui.aiDetail);
  const stripData = useStore((s) => {
    const hour = s.meta.dayStartHour || 0;
    const todayIso = D.effectiveTodayIso(hour);
    const pending = s.tasks.filter((t) => !t.completed && t.recurring === "none").length;
    const e = s.screen[todayIso] || {};
    const capSum = Object.values(s.caps || {}).reduce((a, b) => a + (b || 0), 0);
    const berths = s.projects.filter((p) => !p.completedAt).length;
    const launched = s.projects.filter((p) => p.completedAt).length;
    return { pending, x: e.xOpens || 0, yt: e.ytOpens || 0, capSum, berths, launched };
  });
  const [confettiShown, setConfettiShown] = React.useState(0);

  const stripCells = view === "plan"
    ? [`CAPACITY ${stripData.capSum}H/WK`, `SIG ${stripData.x}X · ${stripData.yt}YT`]
    : view === "dock"
      ? [`${stripData.berths} BERTH${stripData.berths === 1 ? "" : "S"} · ${stripData.launched} LAUNCHED`, `SIG ${stripData.x}X · ${stripData.yt}YT`]
      : [`${stripData.pending} IN THE YARD`, `SIG ${stripData.x}X · ${stripData.yt}YT`];

  const draughtM = ((level.pct / 100) * 18.3).toFixed(1);

  return (
    <div className="shell">
      <aside className="mast">
        <div className="mast-brand">
          <BrandMark />
          <div className="brand-text">
            <div className="w-display mast-brand-name">WERF</div>
            <div className="w-stencil" style={{ fontSize: 8, marginTop: 3 }}>the nightwatch</div>
          </div>
        </div>
        <div className="mast-coords w-num">52.3026°N 4.6889°E</div>

        <nav className="mast-nav">
          {NAV.map((n) => (
            <button key={n.id}
              className={"slot" + (view === n.id && !statsOpen ? " slot--active" : "")}
              onClick={() => setUI({ view: n.id, cursor: null, statsOpen: false })}
              title={`${n.label} (${n.key})`}>
              <span className="slot-glyph"><Icon name={n.icon} size={14} /></span>
              <span className="slot-label">{n.label}</span>
              <span className="slot-key">{n.key}</span>
            </button>
          ))}
          <button className={"slot" + (statsOpen ? " slot--active" : "")} onClick={() => setUI({ statsOpen: !statsOpen })} title="Logbook — the record, settings, data (4)">
            <span className="slot-glyph"><Icon name="stats" size={14} /></span>
            <span className="slot-label">Logbook</span>
            <span className="slot-key">4</span>
          </button>
        </nav>

        <div className="mast-foot">
          <div className="w-stencil-row" style={{ marginBottom: 2 }}><span className="w-stencil">Level</span></div>
          <div className="draught">
            <div className="draught-meter"><div className="draught-fill" style={{ height: Math.min(100, level.pct) + "%" }} /></div>
            <div className="draught-read">
              <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                <span className="w-display w-num" style={{ fontSize: 26, color: "var(--amber)" }}>{level.lvl}</span>
                <span className="w-stencil" style={{ color: "var(--fg-dim)", fontSize: 8.5 }}>{level.title}</span>
              </div>
              <div className="w-num" style={{ marginTop: 4, fontSize: 9, color: "var(--fg-faint)" }}>{draughtM}M DRAUGHT</div>
              <div className="w-num" style={{ marginTop: "auto", paddingTop: 8, fontSize: 9.5, color: "var(--fg-faint)", display: "flex", flexDirection: "column", gap: 2 }}>
                <span>{totalXP} XP</span>
                <span>{level.xpToNext > 0 ? `${level.xpToNext} TO GO` : "MAX"}</span>
                {streakRun > 0 && <span style={{ color: "var(--amber-hot)" }}>{streakRun}-DAY STREAK</span>}
              </div>
            </div>
          </div>
          <div className="mast-keys">
            <button className="icon-btn" style={{ padding: 0 }} onClick={() => setUI({ helpOpen: true })} title="Keyboard help (?)">
              <Kbd>?</Kbd>
            </button>
            <button className="icon-btn" style={{ padding: 0 }} onClick={() => setUI({ paletteOpen: true })} title="Command palette">
              <Kbd>{MOD}K</Kbd>
            </button>
            <span style={{ marginLeft: "auto" }}><Lamp status={aiStatus} detail={aiDetail} /></span>
          </div>
        </div>
      </aside>

      <main className="deck">
        <HarborStrip view={view.toUpperCase()} cells={stripCells} />
        {previewMode && (
          <div style={{ position: "sticky", top: 34, zIndex: 19, display: "flex", alignItems: "center", gap: 12, padding: "7px 18px", background: "var(--amber)", color: "var(--ink)" }}>
            <span className="w-stencil" style={{ color: "var(--ink)" }}>Preview</span>
            <span style={{ font: "500 12px var(--t-body)", flex: 1 }}>Sample data — your real yard is snapshotted and comes back on exit.</span>
            <button className="bezel bezel--sm" style={{ borderColor: "var(--ink)", color: "var(--ink)" }} onClick={exitPreview}>Exit preview</button>
          </div>
        )}
        {externalChange && (
          <div style={{ position: "sticky", top: 34, zIndex: 18, display: "flex", alignItems: "center", gap: 12, padding: "7px 18px", background: "var(--warn)", color: "var(--ink)" }}>
            <span className="w-stencil" style={{ color: "var(--ink)" }}>Cross-tab</span>
            <span style={{ font: "500 12px var(--t-body)", flex: 1 }}>Werf data changed in another tab — reload to pick it up safely.</span>
            <button className="bezel bezel--sm" style={{ borderColor: "var(--ink)", color: "var(--ink)" }} onClick={() => window.location.reload()}>Reload</button>
            <button className="icon-btn" style={{ color: "var(--ink)" }} onClick={() => setUI({ externalChange: false })} aria-label="Dismiss"><Icon name="close" size={12} /></button>
          </div>
        )}
        {view === "today" && <TodayView />}
        {view === "plan" && <PlanView />}
        {view === "dock" && <DockView />}
      </main>

      {toast && (
        <div className="ticker" role="status">
          <span className={"ticker-lead" + (toast.xp != null && toast.xp < 0 ? " ticker-lead--port" : "")}>
            <Icon name={toast.xp != null && toast.xp !== 0 ? "bolt" : "check"} size={13} />
          </span>
          {toast.xp != null && toast.xp !== 0 && (
            <span className="w-num" style={{ color: toast.xp >= 0 ? "var(--starboard)" : "var(--port)", fontWeight: 600, fontSize: 12 }}>
              {toast.xp >= 0 ? "+" : ""}{toast.xp} XP
            </span>
          )}
          <span style={{ padding: "10px 0" }}>{toast.msg}</span>
          {toast.undoId && (
            <button className="bezel bezel--sm" onClick={() => runUndo(toast.undoId)}>
              Undo <Kbd>U</Kbd>
            </button>
          )}
        </div>
      )}

      {confetti > confettiShown && <Confetti onDone={() => setConfettiShown(confetti)} />}

      {levelUp && (
        <div role="status" aria-live="polite" className="statement fade-in" style={{ ...statementBg("nw-levelup-" + levelUp.lvl), position: "fixed", left: "50%", top: 26, transform: "translateX(-50%)", zIndex: 10002, padding: "10px 20px 12px", display: "flex", alignItems: "center", gap: 12 }}>
          <span className="w-display w-num" style={{ fontSize: 26, lineHeight: 1 }}>{levelUp.lvl}</span>
          <span>
            <span className="w-stencil" style={{ display: "block" }}>New rank</span>
            <span className="w-display" style={{ fontSize: 15 }}>{levelUp.title}</span>
          </span>
        </div>
      )}

      {helpOpen && (
        <div onClick={() => setUI({ helpOpen: false })} className="backdrop" style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10003 }}>
          <div onClick={(e) => e.stopPropagation()} className="console fade-in" style={{ padding: 22, minWidth: 350 }}>
            <div style={{ marginBottom: 16 }}><span className="w-tape">Standing orders</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {SHORTCUT_ROWS.map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
                  <span style={{ fontSize: 13 }}>{v}</span>
                  <Kbd>{k}</Kbd>
                </div>
              ))}
            </div>
            <button className="bezel bezel--sm" style={{ marginTop: 18, width: "100%", justifyContent: "center" }} onClick={() => setUI({ helpOpen: false })}>Close</button>
          </div>
        </div>
      )}

      <TaskFormModal />
      <LogbookPage />
      <ReviewOverlay />
      <Palette />
      <EndOfDayDialog />
      <FocusTunnel />
    </div>
  );
}
