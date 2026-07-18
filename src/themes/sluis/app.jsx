// app.jsx — the Sluis shell: a fixed bottom dock bar ("de wal") with
// the peil gauge, the global waterline edge, three views, and every
// overlay surface the core keyboard layer can open.

import React from "react";
import { Icon, Kbd, Lamp, Confetti, GateMark, PeilStaff, Waterline, MOD } from "./components.jsx";
import { useStore, setUI, runUndo, sel, exitPreview, todayLineup } from "../../core/store.js";
import { SHORTCUT_ROWS } from "../../core/keys.js";
import { TodayView } from "./views/today.jsx";
import { PlanView } from "./views/plan.jsx";
import { DockView } from "./views/dock.jsx";
import { PeilhuisSheet } from "./views/logbook.jsx";
import { ReviewOverlay } from "./views/review.jsx";
import { FocusTunnel } from "./views/focus.jsx";
import { Palette } from "./views/palette.jsx";
import { EndOfDayDialog } from "./views/endofday.jsx";
import { TaskFormDrawer } from "./taskform.jsx";

const NAV = [
  { id: "today", label: "Kolk", sub: "today", icon: "wave", key: "1" },
  { id: "plan", label: "Kanaal", sub: "plan", icon: "calendar", key: "2" },
  { id: "dock", label: "Haven", sub: "dock", icon: "anchor", key: "3" },
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
  // The waterline: earned slate XP ÷ the whole slate. Rises as vessels
  // lock through; full when the chamber is empty.
  const slate = useStore((s) => {
    const rows = todayLineup(s);
    const total = rows.reduce((a, r) => a + (r.task.xp || 0), 0);
    const earned = rows.reduce((a, r) => a + (r.doneHere ? (r.task.xp || 0) : 0), 0);
    return { total, earned, empty: rows.length === 0 };
  });
  const [confettiShown, setConfettiShown] = React.useState(0);

  const waterPct = slate.empty ? (slate.earned > 0 ? 100 : 0)
    : slate.total > 0 ? (slate.earned / slate.total) * 100 : 0;

  return (
    <div className="s-shell">
      <Waterline pct={waterPct} />

      <main className="s-stage">
        {previewMode && (
          <div className="s-banner" role="status">
            <Icon name="wave" size={15} />
            <span style={{ flex: 1, fontWeight: 500, fontSize: 13 }}>
              <strong>Oefenwater.</strong> Sample data — your real yard is snapshotted and comes back on exit.
            </span>
            <button className="s-btn s-btn--sm s-btn--ghost" style={{ borderColor: "var(--ink)", color: "var(--ink)" }} onClick={exitPreview}>Exit preview</button>
          </div>
        )}
        {externalChange && (
          <div className="s-banner s-banner--warn" role="alert">
            <Icon name="reset" size={15} />
            <span style={{ flex: 1, fontWeight: 500, fontSize: 13 }}>Werf data changed in another tab — reload to pick it up safely.</span>
            <button className="s-btn s-btn--sm s-btn--ghost" style={{ borderColor: "var(--ink)", color: "var(--ink)" }} onClick={() => window.location.reload()}>Reload</button>
            <button className="s-icon-btn" style={{ color: "var(--ink)" }} onClick={() => setUI({ externalChange: false })} aria-label="Dismiss"><Icon name="close" size={12} /></button>
          </div>
        )}
        {view === "today" && <TodayView />}
        {view === "plan" && <PlanView />}
        {view === "dock" && <DockView />}
      </main>

      <nav className="s-wal" aria-label="Main">
        <div className="s-brand">
          <span style={{ color: "var(--water)", display: "inline-flex" }}><GateMark open={waterPct >= 100} size={24} /></span>
          <span>
            <span className="s-brand-name" style={{ display: "block", lineHeight: 1.05 }}>WERF</span>
            <span className="s-brand-sub">de sluis</span>
          </span>
        </div>

        <div className="s-wal-nav">
          {NAV.map((n) => (
            <button key={n.id}
              className={"s-wal-slot" + (view === n.id && !statsOpen ? " s-wal-slot--active" : "")}
              onClick={() => setUI({ view: n.id, cursor: null, statsOpen: false })}
              title={`${n.label} — ${n.sub} (${n.key})`}>
              <Icon name={n.icon} size={14} />
              <span className="s-wal-label">{n.label}</span>
              <Kbd>{n.key}</Kbd>
            </button>
          ))}
          <button className={"s-wal-slot" + (statsOpen ? " s-wal-slot--active" : "")}
            onClick={() => setUI({ statsOpen: !statsOpen })}
            title="Peilhuis — the gauge house: record, settings, data (4)">
            <Icon name="stats" size={14} />
            <span className="s-wal-label">Peilhuis</span>
            <Kbd>4</Kbd>
          </button>
        </div>

        <div className="s-wal-peil">
          <PeilStaff pct={level.pct} />
          <span className="s-peil-meta" style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="s-display s-num" style={{ fontSize: 22, color: "var(--water-deep)", lineHeight: 1 }}>{level.lvl}</span>
            <span>
              <span className="s-stencil" style={{ display: "block", fontSize: 8 }}>{level.title}</span>
              <span className="s-num" style={{ fontSize: 9.5, color: "var(--fg-faint)" }}>
                {totalXP} XP · {level.xpToNext > 0 ? `${level.xpToNext} to go` : "max"}
              </span>
            </span>
          </span>
          {streakRun > 0 && (
            <span className="s-chip" style={{ color: "var(--amber-hot)", background: "var(--amber-ground)" }} title="Streak — consecutive days with locked-through work">
              <Icon name="flame" size={10} /> {streakRun}
            </span>
          )}
          <span className="s-wal-tools">
            <button className="s-icon-btn" onClick={() => setUI({ helpOpen: true })} title="Keyboard help (?)"><Kbd>?</Kbd></button>
            <button className="s-icon-btn" onClick={() => setUI({ paletteOpen: true })} title="Sein — command palette"><Kbd>{MOD}K</Kbd></button>
            <Lamp status={aiStatus} detail={aiDetail} />
          </span>
        </div>
      </nav>

      {toast && (
        <div className="s-buoy" role="status">
          <span className="s-buoy-dot" style={toast.xp != null && toast.xp < 0 ? { background: "var(--port)", boxShadow: "0 0 0 3px var(--port-ground)" } : undefined} />
          {toast.xp != null && toast.xp !== 0 && (
            <span className="s-num" style={{ color: toast.xp >= 0 ? "var(--starboard)" : "var(--port)", fontWeight: 700, fontSize: 12 }}>
              {toast.xp >= 0 ? "+" : ""}{toast.xp} XP
            </span>
          )}
          <span style={{ fontSize: 13 }}>{toast.msg}</span>
          {toast.undoId && (
            <button className="s-btn s-btn--sm s-btn--ghost" onClick={() => runUndo(toast.undoId)}>
              Vaar terug <Kbd>U</Kbd>
            </button>
          )}
        </div>
      )}

      {confetti > confettiShown && <Confetti onDone={() => setConfettiShown(confetti)} />}

      {levelUp && (
        <div role="status" aria-live="polite" className="s-levelup" style={{ background: "var(--amber)", color: "var(--ink)" }}>
          <GateMark open size={26} />
          <span className="s-display s-num" style={{ fontSize: 28, lineHeight: 1 }}>{levelUp.lvl}</span>
          <span>
            <span className="s-stencil" style={{ display: "block", color: "var(--amber-deep)" }}>De deuren gaan open — new rank</span>
            <span className="s-display" style={{ fontSize: 16 }}>{levelUp.title}</span>
          </span>
        </div>
      )}

      {helpOpen && (
        <div onClick={() => setUI({ helpOpen: false })} className="s-backdrop">
          <div onClick={(e) => e.stopPropagation()} className="s-sheet" style={{ maxWidth: 480 }}>
            <div className="s-sheet-grip" />
            <div className="s-sheet-body">
              <div className="s-stencil-row" style={{ marginBottom: 16 }}><span className="s-stencil s-stencil--lit">Seinboek — standing orders</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {SHORTCUT_ROWS.map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
                    <span style={{ fontSize: 13 }}>{v}</span>
                    <Kbd>{k}</Kbd>
                  </div>
                ))}
              </div>
              <button className="s-btn s-btn--ghost s-btn--sm" style={{ marginTop: 20, width: "100%" }} onClick={() => setUI({ helpOpen: false })}>Close</button>
            </div>
          </div>
        </div>
      )}

      <TaskFormDrawer />
      <PeilhuisSheet />
      <ReviewOverlay />
      <Palette />
      <EndOfDayDialog />
      <FocusTunnel />
    </div>
  );
}
