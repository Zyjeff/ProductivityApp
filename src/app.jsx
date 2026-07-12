// app.jsx — the shell: rail, three surfaces, overlays, keyboard.

import React, { useEffect } from "react";
import { Icon, Kbd, ProgressBar, Confetti, MOD, AiDot } from "./components.jsx";
import { tex } from "./texture.js";

// The mast's dithered wave mark — generated, not drawn.
function BrandMark() {
  const bg = React.useMemo(
    () => tex({ seed: "werf-mark", algo: "noise", w: 30, h: 30, cell: 2, fg: "#f5a524", grad: { from: 0.9, to: 0.1, dir: "down" } }),
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
import { useStore, setUI, runUndo, sel, exitPreview } from "./store.js";
import { installKeyboard, SHORTCUT_ROWS } from "./keys.js";
import { TodayView } from "./views/today.jsx";
import { PlanView } from "./views/plan.jsx";
import { DockView } from "./views/dock.jsx";
import { StatsPanel } from "./views/stats.jsx";
import { ReviewOverlay } from "./views/review.jsx";
import { FocusTunnel } from "./views/focus.jsx";
import { Palette } from "./views/palette.jsx";
import { EndOfDayDialog } from "./views/endofday.jsx";
import { TaskFormModal } from "./taskform.jsx";

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
  const previewMode = useStore((s) => s.ui.previewMode);
  const externalChange = useStore((s) => s.ui.externalChange);
  const level = useStore(sel.level);
  const totalXP = useStore(sel.totalXP);
  const streakRun = useStore(sel.streak);
  const aiStatus = useStore((s) => s.ui.aiStatus);
  const aiDetail = useStore((s) => s.ui.aiDetail);
  const [confettiShown, setConfettiShown] = React.useState(0);

  useEffect(() => installKeyboard(), []);

  return (
    <div style={{ display: "flex", minHeight: "100vh", color: "var(--text)" }}>
      <aside className="w-mast">
        <div className="w-mast-brand" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BrandMark />
          <div className="w-brand-text">
            <div className="w-display" style={{ fontSize: 17, lineHeight: 1 }}>WERF</div>
            <div className="w-stencil" style={{ fontSize: 8, marginTop: 3 }}>solo shipyard</div>
          </div>
        </div>
        <nav className="w-mast-nav">
          {NAV.map((n) => (
            <button key={n.id}
              className={"w-slot" + (view === n.id ? " w-slot--active" : "")}
              onClick={() => setUI({ view: n.id, cursor: null })}
              title={`${n.label} (${n.key})`}>
              <span className="w-slot-glyph"><Icon name={n.icon} size={14} /></span>
              <span className="w-slot-label">{n.label}</span>
              <span className="w-slot-key">{n.key}</span>
            </button>
          ))}
          <button className="w-slot" onClick={() => setUI({ statsOpen: true })} title="Logbook — stats, trophies, settings, data (4)">
            <span className="w-slot-glyph"><Icon name="stats" size={14} /></span>
            <span className="w-slot-label">Logbook</span>
            <span className="w-slot-key">4</span>
          </button>
        </nav>
        <div className="w-mast-foot">
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 7 }}>
            <span className="w-display w-num" style={{ fontSize: 22, color: "var(--amber)" }}>{level.lvl}</span>
            <span className="w-stencil" style={{ color: "var(--fg-dim)" }}>{level.title}</span>
          </div>
          <ProgressBar pct={level.pct} height={4} />
          <div className="w-num" style={{ marginTop: 6, fontSize: 9.5, color: "var(--fg-faint)", display: "flex", justifyContent: "space-between" }}>
            <span>{totalXP} XP</span>
            <span>{level.xpToNext > 0 ? `${level.xpToNext} TO GO` : "MAX"}</span>
          </div>
          {streakRun > 0 && (
            <div style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--amber)" }}><Icon name="flame" size={11} /></span>
              <span className="w-num" style={{ fontSize: 10, color: "var(--amber-hot)", letterSpacing: "0.08em" }}>{streakRun}-DAY STREAK</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12 }}>
            <button className="w-icon-btn" style={{ padding: 0 }} onClick={() => setUI({ helpOpen: true })} title="Keyboard help (?)">
              <Kbd>?</Kbd>
            </button>
            <button className="w-icon-btn" style={{ padding: 0 }} onClick={() => setUI({ paletteOpen: true })} title="Command palette">
              <Kbd>{MOD}K</Kbd>
            </button>
            <span style={{ marginLeft: "auto" }}><AiDot status={aiStatus} detail={aiDetail} /></span>
          </div>
        </div>
      </aside>

      <main className="w-scroll" style={{ flex: 1, overflowY: "auto", maxHeight: "100vh", minWidth: 0 }}>
        {previewMode && (
          <div style={{ position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 12, padding: "7px 18px", background: "var(--amber)", color: "var(--ink)" }}>
            <span className="w-stencil" style={{ color: "var(--ink)" }}>Preview</span>
            <span style={{ font: "500 12px var(--t-body)", flex: 1 }}>Sample data — your real yard is snapshotted and comes back on exit.</span>
            <button className="w-bezel w-bezel--sm" style={{ borderColor: "var(--ink)", color: "var(--ink)" }} onClick={exitPreview}>Exit preview</button>
          </div>
        )}
        {externalChange && (
          <div style={{ position: "sticky", top: 0, zIndex: 19, display: "flex", alignItems: "center", gap: 12, padding: "7px 18px", background: "var(--warn)", color: "var(--ink)" }}>
            <span className="w-stencil" style={{ color: "var(--ink)" }}>Cross-tab</span>
            <span style={{ font: "500 12px var(--t-body)", flex: 1 }}>Werf data changed in another tab — reload to pick it up safely.</span>
            <button className="w-bezel w-bezel--sm" style={{ borderColor: "var(--ink)", color: "var(--ink)" }} onClick={() => window.location.reload()}>Reload</button>
            <button className="w-icon-btn" style={{ color: "var(--ink)" }} onClick={() => setUI({ externalChange: false })} aria-label="Dismiss"><Icon name="close" size={12} /></button>
          </div>
        )}
        {view === "today" && <TodayView />}
        {view === "plan" && <PlanView />}
        {view === "dock" && <DockView />}
      </main>

      {toast && (
        <div className="w-ticker" role="status">
          <span className={"w-ticker-lead" + (toast.xp != null && toast.xp < 0 ? " w-ticker-lead--port" : "")}>
            <Icon name={toast.xp != null && toast.xp !== 0 ? "bolt" : "check"} size={13} />
          </span>
          {toast.xp != null && toast.xp !== 0 && (
            <span className="w-num" style={{ color: toast.xp >= 0 ? "var(--starboard)" : "var(--port)", fontWeight: 600, fontSize: 12 }}>
              {toast.xp >= 0 ? "+" : ""}{toast.xp} XP
            </span>
          )}
          <span style={{ padding: "10px 0" }}>{toast.msg}</span>
          {toast.undoId && (
            <button className="w-bezel w-bezel--sm" onClick={() => runUndo(toast.undoId)}>
              Undo <Kbd>U</Kbd>
            </button>
          )}
        </div>
      )}

      {confetti > confettiShown && <Confetti onDone={() => setConfettiShown(confetti)} />}

      {levelUp && (
        <div role="status" aria-live="polite" className="w-statement w-fade-in" style={{ position: "fixed", left: "50%", top: 26, transform: "translateX(-50%)", zIndex: 10002, padding: "10px 20px 12px", display: "flex", alignItems: "center", gap: 12 }}>
          <span className="w-display w-num" style={{ fontSize: 26, lineHeight: 1 }}>{levelUp.lvl}</span>
          <span>
            <span className="w-stencil" style={{ display: "block" }}>Level up</span>
            <span className="w-display" style={{ fontSize: 15 }}>{levelUp.title}</span>
          </span>
        </div>
      )}

      {helpOpen && (
        <div onClick={() => setUI({ helpOpen: false })} className="w-backdrop" style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001 }}>
          <div onClick={(e) => e.stopPropagation()} className="w-console w-fade-in" style={{ padding: 22, minWidth: 350 }}>
            <div style={{ marginBottom: 16 }}><span className="w-tape">Keyboard</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {SHORTCUT_ROWS.map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
                  <span style={{ fontSize: 13 }}>{v}</span>
                  <Kbd>{k}</Kbd>
                </div>
              ))}
            </div>
            <button className="w-bezel w-bezel--sm" style={{ marginTop: 18, width: "100%", justifyContent: "center" }} onClick={() => setUI({ helpOpen: false })}>Close</button>
          </div>
        </div>
      )}

      <TaskFormModal />
      <StatsPanel />
      <ReviewOverlay />
      <Palette />
      <EndOfDayDialog />
      <FocusTunnel />
    </div>
  );
}
