// app.jsx — the shell: rail, three surfaces, overlays, keyboard.

import React, { useEffect } from "react";
import { Icon, Kbd, ProgressBar, Confetti, MOD, AiDot } from "./components.jsx";
import { useStore, setUI, runUndo, sel, exitPreview } from "./store.js";
import { installKeyboard, SHORTCUT_ROWS } from "./keys.js";
import { TodayView } from "./views/today.jsx";
import { PlanView } from "./views/plan.jsx";
import { DockView } from "./views/dock.jsx";
import { StatsPanel } from "./views/stats.jsx";
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
      <aside className="w-sidebar" style={{
        width: 190, flexShrink: 0, height: "100vh", position: "sticky", top: 0,
        background: "var(--bg-elev)", borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", padding: "18px 0",
      }}>
        <div className="w-brand" style={{ padding: "0 16px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 9 }}>
          <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden>
            <rect width="64" height="64" rx="14" fill="var(--bg-soft)" />
            <path d="M14 40 L23 22 L32 40 L41 22 L50 40" fill="none" stroke="var(--amber)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="w-brand-name">
            <div className="w-display" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>Werf</div>
            <div style={{ fontSize: 9, color: "var(--text-faint)", fontFamily: "var(--font-mono)", letterSpacing: "0.14em", textTransform: "uppercase" }}>solo shipyard</div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map((n) => (
            <button key={n.id}
              className={"w-nav-btn" + (view === n.id ? " w-nav-btn--active" : "")}
              onClick={() => setUI({ view: n.id, cursor: null })}
              title={`${n.label} (${n.key})`}>
              <span className="w-nav-glyph"><Icon name={n.icon} size={15} /></span>
              <span className="w-nav-label" style={{ flex: 1 }}>{n.label}</span>
              <span className="w-kbd w-nav-label" style={{ opacity: view === n.id ? 0.9 : 0.5 }}>{n.key}</span>
            </button>
          ))}
          <button className="w-nav-btn" onClick={() => setUI({ statsOpen: true })} title="Logbook — stats, trophies, settings, data (4)">
            <span className="w-nav-glyph"><Icon name="stats" size={15} /></span>
            <span className="w-nav-label" style={{ flex: 1 }}>Logbook</span>
            <span className="w-kbd w-nav-label" style={{ opacity: 0.5 }}>4</span>
          </button>
        </nav>
        <div className="w-sidebar-foot" style={{ padding: "14px 16px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>Lv.{level.lvl}</span>
            <span style={{ fontSize: 11, color: "var(--text)", fontWeight: 500 }}>{level.title}</span>
          </div>
          <ProgressBar pct={level.pct} height={3} />
          <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)", display: "flex", justifyContent: "space-between" }}>
            <span>{totalXP} XP</span>
            <span>{level.xpToNext > 0 ? `${level.xpToNext} to go` : "max"}</span>
          </div>
          {streakRun > 0 && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--amber-strong)" }}>
              <Icon name="flame" size={12} />
              <span style={{ fontFamily: "var(--font-mono)" }}>{streakRun}-day streak</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <button className="w-btn w-btn--ghost w-btn--xs" style={{ padding: 0 }} onClick={() => setUI({ helpOpen: true })}>
              <Kbd>?</Kbd> keys
            </button>
            <button className="w-btn w-btn--ghost w-btn--xs" style={{ padding: 0 }} onClick={() => setUI({ paletteOpen: true })}>
              <Kbd>{MOD}K</Kbd>
            </button>
            <span style={{ marginLeft: "auto" }}><AiDot status={aiStatus} detail={aiDetail} /></span>
          </div>
        </div>
      </aside>

      <main className="w-scroll" style={{ flex: 1, overflowY: "auto", maxHeight: "100vh", minWidth: 0 }}>
        {previewMode && (
          <div style={{ position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 18px", background: "linear-gradient(90deg, rgba(245,165,36,0.16), rgba(245,165,36,0.04))", borderBottom: "1px solid var(--amber-soft)", color: "var(--amber-strong)", font: "500 12px var(--font-sans)", backdropFilter: "blur(8px)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="bolt" size={12} /> Preview mode — sample data. Your real data is snapshotted.
            </span>
            <button className="w-btn w-btn--outline w-btn--xs" onClick={exitPreview}>Exit preview</button>
          </div>
        )}
        {externalChange && (
          <div style={{ position: "sticky", top: 0, zIndex: 19, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 18px", background: "var(--warning-soft)", borderBottom: "1px solid var(--warning)", color: "var(--warning)", font: "500 12px var(--font-sans)" }}>
            <span>Werf data changed in another tab — reload to pick it up safely.</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="w-btn w-btn--outline w-btn--xs" onClick={() => window.location.reload()}>Reload</button>
              <button className="w-btn w-btn--ghost w-btn--xs" onClick={() => setUI({ externalChange: false })}>Dismiss</button>
            </div>
          </div>
        )}
        {view === "today" && <TodayView />}
        {view === "plan" && <PlanView />}
        {view === "dock" && <DockView />}
      </main>

      {toast && (
        <div className="w-toast" role="status">
          {toast.xp != null && toast.xp !== 0 && (
            <span style={{ fontFamily: "var(--font-mono)", color: toast.xp >= 0 ? "var(--starboard)" : "var(--port)", fontWeight: 600 }}>
              {toast.xp >= 0 ? "+" : ""}{toast.xp} XP
            </span>
          )}
          <span>{toast.msg}</span>
          {toast.undoId && (
            <button className="w-btn w-btn--outline w-btn--xs" onClick={() => runUndo(toast.undoId)}>
              Undo <Kbd>U</Kbd>
            </button>
          )}
        </div>
      )}

      {confetti > confettiShown && <Confetti onDone={() => setConfettiShown(confetti)} />}

      {levelUp && (
        <div role="status" aria-live="polite" style={{ position: "fixed", left: "50%", top: 28, transform: "translateX(-50%)", zIndex: 10002, background: "var(--bg-elev)", border: "1px solid var(--amber)", borderRadius: 999, padding: "10px 18px", font: "500 13px var(--font-sans)", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 12px 36px rgba(0,0,0,0.45)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: "var(--amber)", color: "#14100a", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>{levelUp.lvl}</span>
          <span>Level up — <strong>{levelUp.title}</strong></span>
        </div>
      )}

      {helpOpen && (
        <div onClick={() => setUI({ helpOpen: false })} style={{ position: "fixed", inset: 0, background: "rgba(6,8,12,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001 }}>
          <div onClick={(e) => e.stopPropagation()} className="w-card w-fade-in" style={{ padding: 24, minWidth: 340 }}>
            <div className="w-eyebrow" style={{ marginBottom: 14 }}>Keyboard</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {SHORTCUT_ROWS.map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
                  <span style={{ fontSize: 13 }}>{v}</span>
                  <Kbd>{k}</Kbd>
                </div>
              ))}
            </div>
            <button className="w-btn w-btn--outline w-btn--sm" style={{ marginTop: 18, width: "100%" }} onClick={() => setUI({ helpOpen: false })}>Close</button>
          </div>
        </div>
      )}

      <TaskFormModal />
      <StatsPanel />
      <Palette />
      <EndOfDayDialog />
      <FocusTunnel />
    </div>
  );
}
