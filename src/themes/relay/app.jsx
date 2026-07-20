// app.jsx — Relay shell: top command bar, signal edge, every overlay.

import React from "react";
import { Icon, Kbd, Lamp, Confetti, RankRing, MOD } from "./components.jsx";
import { useStore, setUI, runUndo, sel, exitPreview, todayLineup } from "../../core/store.js";
import { SHORTCUT_ROWS } from "../../core/keys.js";
import { TodayView } from "./views/today.jsx";
import { PlanView } from "./views/plan.jsx";
import { DockView } from "./views/dock.jsx";
import { LedgerPage } from "./views/logbook.jsx";
import { ReviewOverlay } from "./views/review.jsx";
import { FocusTunnel } from "./views/focus.jsx";
import { Palette } from "./views/palette.jsx";
import { EndOfDayDialog } from "./views/endofday.jsx";
import { TaskFormModal } from "./taskform.jsx";

const NAV = [
  { id: "today", path: "/feed", key: "1", title: "Feed (1)" },
  { id: "plan", path: "/lattice", key: "2", title: "Lattice (2)" },
  { id: "dock", path: "/systems", key: "3", title: "Systems (3)" },
];

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <div className="r-crash">
          <div className="r-crash-card">
            <div className="r-display" style={{ fontSize: 18, marginBottom: 10 }}>SIGNAL FAULT</div>
            <pre>{String(this.state.err?.stack || this.state.err)}</pre>
            <button className="r-btn" style={{ marginTop: 14 }} onClick={() => window.location.reload()}>Reload deck</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Shell() {
  const view = useStore((s) => s.ui.view);
  const statsOpen = useStore((s) => s.ui.statsOpen);
  const helpOpen = useStore((s) => s.ui.helpOpen);
  const toast = useStore((s) => s.ui.toast);
  const confetti = useStore((s) => s.ui.confetti);
  const levelUp = useStore((s) => s.ui.levelUp);
  const previewMode = useStore((s) => s.ui.previewMode);
  const externalChange = useStore((s) => s.ui.externalChange);
  const aiStatus = useStore((s) => s.ui.aiStatus);
  const aiDetail = useStore((s) => s.ui.aiDetail);
  const level = useStore(sel.level);
  const totalXP = useStore(sel.totalXP);
  const streakRun = useStore(sel.streak);

  const slate = useStore((s) => {
    const rows = todayLineup(s);
    const total = rows.reduce((a, r) => a + (r.task.xp || 0), 0);
    const earned = rows.reduce((a, r) => a + (r.doneHere ? (r.task.xp || 0) : 0), 0);
    return { total, earned, empty: rows.length === 0 };
  });

  const [confettiShown, setConfettiShown] = React.useState(0);
  const [clock, setClock] = React.useState(() => new Date());
  React.useEffect(() => {
    const iv = setInterval(() => setClock(new Date()), 20000);
    return () => clearInterval(iv);
  }, []);
  const hh = String(clock.getHours()).padStart(2, "0");
  const mm = String(clock.getMinutes()).padStart(2, "0");

  const edgePct = slate.empty
    ? (slate.earned > 0 ? 100 : 0)
    : slate.total > 0 ? (slate.earned / slate.total) * 100 : 0;

  return (
    <div className="r-shell">
      <header className="r-cmd">
        <div className="r-brand">
          <span className="r-brand-mark" aria-hidden />
          <span>
            <span className="r-brand-name" style={{ display: "block" }}>RELAY</span>
            <span className="r-brand-sub">closed loop</span>
          </span>
        </div>

        <nav className="r-cmd-nav" aria-label="Main">
          {NAV.map((n) => (
            <button key={n.id}
              className={"r-cmd-slot" + (view === n.id && !statsOpen ? " r-cmd-slot--on" : "")}
              onClick={() => setUI({ view: n.id, cursor: null, statsOpen: false })}
              title={n.title}>
              <span className="r-path">{n.path}</span>
              <Kbd>{n.key}</Kbd>
            </button>
          ))}
          <button
            className={"r-cmd-slot" + (statsOpen ? " r-cmd-slot--on" : "")}
            onClick={() => setUI({ statsOpen: !statsOpen })}
            title="Ledger — rank, trophies, settings, data (4)">
            <span className="r-path">/ledger</span>
            <Kbd>4</Kbd>
          </button>
        </nav>

        <div className="r-cmd-meta">
          <div className="r-cmd-rank" title={`${level.title} · ${totalXP} XP · ${level.xpToNext > 0 ? level.xpToNext + " to go" : "MAX"}${streakRun > 0 ? ` · ${streakRun}-day lock` : ""}`}>
            <RankRing pct={level.pct} lvl={level.lvl} />
            <div className="r-cmd-rank-meta">
              <strong>{level.title}</strong>
              <span>{totalXP} XP{streakRun > 0 ? ` · ${streakRun}d` : ""}</span>
            </div>
          </div>
          <span className="r-cmd-clock">{hh}:{mm}</span>
          <button className="r-icon-btn" onClick={() => setUI({ helpOpen: true })} title="Standing orders (?)"><Kbd>?</Kbd></button>
          <button className="r-icon-btn" onClick={() => setUI({ paletteOpen: true })} title="Command palette"><Kbd>{MOD}K</Kbd></button>
          <Lamp status={aiStatus} detail={aiDetail} />
        </div>
      </header>

      <div className="r-signal-edge" aria-hidden>
        <div className="r-signal-edge-fill" style={{ width: edgePct + "%" }} />
      </div>

      <main className="r-stage">
        {previewMode && (
          <div className="r-banner" role="status">
            <Icon name="bolt" size={14} />
            <span style={{ flex: 1 }}><strong>Sandbox.</strong> Sample data — real grid snapshotted; restore on exit.</span>
            <button className="r-btn r-btn--sm" style={{ background: "var(--ink)", color: "var(--amber)" }} onClick={exitPreview}>Exit sandbox</button>
          </div>
        )}
        {externalChange && (
          <div className="r-banner r-banner--warn" role="alert">
            <Icon name="reset" size={14} />
            <span style={{ flex: 1 }}>Werf data changed in another tab — reload to pick it up safely.</span>
            <button className="r-btn r-btn--sm" style={{ background: "var(--ink)", color: "var(--warn)" }} onClick={() => window.location.reload()}>Reload</button>
            <button className="r-icon-btn" style={{ color: "var(--ink)" }} onClick={() => setUI({ externalChange: false })} aria-label="Dismiss"><Icon name="close" size={12} /></button>
          </div>
        )}

        {!statsOpen && view === "today" && <TodayView />}
        {!statsOpen && view === "plan" && <PlanView />}
        {!statsOpen && view === "dock" && <DockView />}
      </main>

      {toast && (
        <div className="r-toast" role="status">
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: toast.xp != null && toast.xp < 0 ? "var(--port)" : "var(--lime)", flexShrink: 0 }} />
          {toast.xp != null && toast.xp !== 0 && (
            <span className={"r-toast-xp" + (toast.xp < 0 ? " r-toast-xp--neg" : "")}>
              {toast.xp >= 0 ? "+" : ""}{toast.xp} XP
            </span>
          )}
          <span>{toast.msg}</span>
          {toast.undoId && (
            <button className="r-btn r-btn--sm r-btn--ghost" onClick={() => runUndo(toast.undoId)}>
              Rewind <Kbd>U</Kbd>
            </button>
          )}
        </div>
      )}

      {confetti > confettiShown && <Confetti onDone={() => setConfettiShown(confetti)} />}

      {levelUp && (
        <div role="status" aria-live="polite" className="r-levelup">
          <RankRing pct={100} lvl={levelUp.lvl} size={40} />
          <span>
            <span className="r-lab" style={{ color: "rgba(255,255,255,.7)", display: "block" }}>RANK UP</span>
            <span className="r-display" style={{ fontSize: 18 }}>{levelUp.title}</span>
          </span>
        </div>
      )}

      {helpOpen && (
        <div className="r-backdrop" onClick={() => setUI({ helpOpen: false })}>
          <div className="r-help" onClick={(e) => e.stopPropagation()}>
            <div className="r-lab r-lab--lit" style={{ marginBottom: 14 }}>Standing orders</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {SHORTCUT_ROWS.map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
                  <span style={{ fontSize: 13 }}>{v}</span>
                  <Kbd>{k}</Kbd>
                </div>
              ))}
            </div>
            <button className="r-btn r-btn--ghost r-btn--sm" style={{ marginTop: 18, width: "100%" }} onClick={() => setUI({ helpOpen: false })}>Close</button>
          </div>
        </div>
      )}

      <TaskFormModal />
      <LedgerPage />
      <ReviewOverlay />
      <Palette />
      <EndOfDayDialog />
      <FocusTunnel />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Shell />
    </ErrorBoundary>
  );
}
