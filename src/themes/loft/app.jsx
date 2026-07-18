// app.jsx — the Mould Loft shell: the T-square nav rail with the scale
// bar (level), three sheets, and every overlay. Same capabilities as
// the other shells, drawn on vellum.

import React from "react";
import { Icon, Kbd, Lamp, Confetti, MOD } from "./components.jsx";
import { blueprintBg, tex } from "./texture.js";
import { useStore, setUI, runUndo, sel, exitPreview } from "../../core/store.js";
import { SHORTCUT_ROWS } from "../../core/keys.js";
import { TodayView } from "./views/today.jsx";
import { PlanView } from "./views/plan.jsx";
import { DockView } from "./views/dock.jsx";
import { RecordPage } from "./views/logbook.jsx";
import { ReviewOverlay } from "./views/review.jsx";
import { FocusTunnel } from "./views/focus.jsx";
import { Palette } from "./views/palette.jsx";
import { EndOfDayDialog } from "./views/endofday.jsx";
import { TaskFormModal } from "./taskform.jsx";

function BrandMark() {
  const bg = React.useMemo(
    () => tex({ seed: "loft-mark", algo: "bayer", w: 30, h: 30, cell: 2, fg: "#1f4e77", grad: { from: 0.85, to: 0.1, dir: "down" } }),
    []
  );
  return (
    <div aria-hidden style={{
      width: 30, height: 30, flexShrink: 0,
      backgroundImage: bg, backgroundColor: "var(--plate)",
      border: "1px solid var(--fg)",
    }} />
  );
}

const NAV = [
  { id: "today", label: "Today", icon: "today", key: "1" },
  { id: "plan", label: "Offsets", icon: "calendar", key: "2" },
  { id: "dock", label: "Register", icon: "anchor", key: "3" },
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
  const [confettiShown, setConfettiShown] = React.useState(0);

  return (
    <div className="lf-shell">
      <aside className="lf-side">
        <div className="lf-brand">
          <BrandMark />
          <div className="lf-brand-text">
            <div className="w-display lf-brand-name">WERF</div>
            <div className="w-stencil" style={{ fontSize: 8, marginTop: 3 }}>the mould loft</div>
          </div>
        </div>
        <div className="lf-side-sub w-num">DRAWING OFFICE · EST. 2026</div>

        <nav className="lf-nav">
          {NAV.map((n) => (
            <button key={n.id}
              className={"lf-slot" + (view === n.id && !statsOpen ? " lf-slot--active" : "")}
              onClick={() => setUI({ view: n.id, cursor: null, statsOpen: false })}
              title={`${n.label} (${n.key})`}>
              <span className="lf-slot-glyph"><Icon name={n.icon} size={14} /></span>
              <span className="lf-slot-label">{n.label}</span>
              <span className="lf-slot-key">{n.key}</span>
            </button>
          ))}
          <button className={"lf-slot" + (statsOpen ? " lf-slot--active" : "")} onClick={() => setUI({ statsOpen: !statsOpen })} title="The record — grades, settings, data (4)">
            <span className="lf-slot-glyph"><Icon name="stats" size={14} /></span>
            <span className="lf-slot-label">Record</span>
            <span className="lf-slot-key">4</span>
          </button>
        </nav>

        <div className="lf-side-foot">
          <div className="w-stencil-row" style={{ marginBottom: 2 }}><span className="w-stencil">Grade</span></div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <span className="w-display w-num" style={{ fontSize: 24, color: "var(--amber)" }}>{level.lvl}</span>
            <span className="w-stencil" style={{ color: "var(--fg-dim)" }}>{level.title}</span>
          </div>
          <div className="lf-scale" title={`${Math.round(level.pct)}% to the next grade`}>
            <div className="lf-scale-fill" style={{ width: Math.min(100, level.pct) + "%" }} />
          </div>
          <div className="w-num" style={{ fontSize: 9.5, color: "var(--fg-faint)", display: "flex", justifyContent: "space-between" }}>
            <span>{totalXP} XP</span>
            <span>{level.xpToNext > 0 ? `${level.xpToNext} TO GO` : "MAX"}</span>
          </div>
          {streakRun > 0 && (
            <div className="w-num" style={{ marginTop: 8, fontSize: 10, color: "var(--amber)", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="flame" size={11} /> REV {streakRun} — {streakRun}-DAY STREAK
            </div>
          )}
          <div className="lf-side-keys">
            <button className="lf-icon-btn" style={{ padding: 0 }} onClick={() => setUI({ helpOpen: true })} title="Drafting conventions (?)">
              <Kbd>?</Kbd>
            </button>
            <button className="lf-icon-btn" style={{ padding: 0 }} onClick={() => setUI({ paletteOpen: true })} title="Call out a dimension">
              <Kbd>{MOD}K</Kbd>
            </button>
            <span style={{ marginLeft: "auto" }}><Lamp status={aiStatus} detail={aiDetail} /></span>
          </div>
        </div>
      </aside>

      <main className="lf-deck">
        {previewMode && (
          <div style={{ position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 12, padding: "7px 18px", background: "var(--amber)", color: "var(--ink)" }}>
            <span className="w-stencil" style={{ color: "var(--ink)" }}>Tracing paper</span>
            <span style={{ font: "500 12px var(--t-body)", flex: 1 }}>Sample data overlaid — your real file is snapshotted and comes back when you lift the trace.</span>
            <button className="lf-bezel lf-bezel--sm" style={{ borderColor: "var(--ink)", color: "var(--ink)", background: "transparent" }} onClick={exitPreview}>Lift the trace</button>
          </div>
        )}
        {externalChange && (
          <div style={{ position: "sticky", top: 0, zIndex: 19, display: "flex", alignItems: "center", gap: 12, padding: "7px 18px", background: "var(--warn)", color: "var(--ink)" }}>
            <span className="w-stencil" style={{ color: "var(--ink)" }}>Another hand</span>
            <span style={{ font: "500 12px var(--t-body)", flex: 1 }}>Another hand is on this sheet (data changed in another tab) — reload to take the latest revision.</span>
            <button className="lf-bezel lf-bezel--sm" style={{ borderColor: "var(--ink)", color: "var(--ink)", background: "transparent" }} onClick={() => window.location.reload()}>Take latest revision</button>
            <button className="lf-icon-btn" style={{ color: "var(--ink)" }} onClick={() => setUI({ externalChange: false })} aria-label="Dismiss"><Icon name="close" size={12} /></button>
          </div>
        )}
        {view === "today" && <TodayView />}
        {view === "plan" && <PlanView />}
        {view === "dock" && <DockView />}
      </main>

      {toast && (
        <div className="lf-ticker" role="status">
          <span className={"lf-ticker-lead" + (toast.xp != null && toast.xp < 0 ? " lf-ticker-lead--port" : "")}>
            <Icon name={toast.xp != null && toast.xp !== 0 ? "bolt" : "check"} size={13} />
          </span>
          {toast.xp != null && toast.xp !== 0 && (
            <span className="w-num" style={{ color: toast.xp >= 0 ? "var(--starboard)" : "var(--port)", fontWeight: 600, fontSize: 12 }}>
              {toast.xp >= 0 ? "+" : ""}{toast.xp} XP
            </span>
          )}
          <span style={{ padding: "10px 0" }}>{toast.msg}</span>
          {toast.undoId && (
            <button className="lf-bezel lf-bezel--sm" onClick={() => runUndo(toast.undoId)}>
              Undo <Kbd>U</Kbd>
            </button>
          )}
        </div>
      )}

      {confetti > confettiShown && <Confetti onDone={() => setConfettiShown(confetti)} />}

      {levelUp && (
        <div role="status" aria-live="polite" className="lf-statement lf-fade" style={{ ...blueprintBg("lf-levelup-" + levelUp.lvl), position: "fixed", left: "50%", top: 26, transform: "translateX(-50%)", zIndex: 10002, padding: "10px 20px 12px", display: "flex", alignItems: "center", gap: 12 }}>
          <span className="w-display w-num" style={{ fontSize: 26, lineHeight: 1 }}>{levelUp.lvl}</span>
          <span>
            <span className="w-stencil" style={{ display: "block" }}>Re-graded</span>
            <span className="w-display" style={{ fontSize: 15 }}>{levelUp.title}</span>
          </span>
        </div>
      )}

      {helpOpen && (
        <div onClick={() => setUI({ helpOpen: false })} className="lf-backdrop" style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10003 }}>
          <div onClick={(e) => e.stopPropagation()} className="lf-console lf-fade" style={{ padding: 22, minWidth: 350 }}>
            <div style={{ marginBottom: 16 }}><span className="w-tape">Drafting conventions</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {SHORTCUT_ROWS.map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
                  <span style={{ fontSize: 13 }}>{v}</span>
                  <Kbd>{k}</Kbd>
                </div>
              ))}
            </div>
            <button className="lf-bezel lf-bezel--sm" style={{ marginTop: 18, width: "100%", justifyContent: "center" }} onClick={() => setUI({ helpOpen: false })}>Close</button>
          </div>
        </div>
      )}

      <TaskFormModal />
      <RecordPage />
      <ReviewOverlay />
      <Palette />
      <EndOfDayDialog />
      <FocusTunnel />
    </div>
  );
}
