import React, { useMemo } from "react";
import { useStore, setUI, runUndo, sel, exitPreview } from "../../core/store.js";
import { SHORTCUT_ROWS } from "../../core/keys.js";
import { useThemeId, setThemeId } from "../../core/theme.js";
import { THEMES } from "../registry.js";

import TodayView from "./views/today.jsx";
import PlanView from "./views/plan.jsx";
import DockView from "./views/dock.jsx";
import LogbookPage from "./views/logbook.jsx";
import FocusTunnel from "./views/focus.jsx";
import Palette from "./views/palette.jsx";
import ReviewOverlay from "./views/review.jsx";
import EndOfDayDialog from "./views/endofday.jsx";
import TaskFormModal from "./taskform.jsx";
import CaptureBar from "./capture.jsx";
import { Starfield } from "./starfield.jsx";
import { Lamp } from "./components.jsx";

export default function App() {
  const view = useStore((s) => s.ui.view);
  const toast = useStore((s) => s.ui.toast);
  const confetti = useStore((s) => s.ui.confetti);
  const levelUp = useStore((s) => s.ui.levelUp);
  const helpOpen = useStore((s) => s.ui.helpOpen);
  const statsOpen = useStore((s) => s.ui.statsOpen);
  const formOpen = useStore((s) => s.ui.formOpen);
  const paletteOpen = useStore((s) => s.ui.paletteOpen);
  const focusTaskId = useStore((s) => s.ui.focusTaskId);
  const reviewWeek = useStore((s) => s.ui.reviewWeek);
  const endOfDayOpen = useStore((s) => s.ui.endOfDayOpen);
  const previewMode = useStore((s) => s.ui.previewMode);
  const externalChange = useStore((s) => s.ui.externalChange);
  const level = useStore(sel.level);
  const totalXP = useStore(sel.totalXP);
  const streak = useStore(sel.streak);
  const aiStatus = useStore((s) => s.ui.aiStatus);
  const aiDetail = useStore((s) => s.ui.aiDetail);

  const density = useMemo(() => {
    return Math.floor(30 + Math.min(120, (totalXP || 0) / 50) + (streak || 0) * 3);
  }, [totalXP, streak]);

  const nav = [
    { id: "today", label: "Session", key: "1" },
    { id: "plan", label: "Ephemeris", key: "2" },
    { id: "dock", label: "Bay", key: "3" },
    { id: "logbook", label: "Journal", key: "4" },
  ];

  return (
    <div className="mer-shell">
      <header className="mer-sky">
        <Starfield density={density} />
        <div className="mer-sky-content">
          <div className="mer-brand">
            <div className="mer-brand-mark">⊙</div>
            <span>MERIDIAN</span>
          </div>
          <div className="mer-gauges">
            <div className="mer-gauge">
              <span className="mer-gauge-label">Rank</span>
              <span className="mer-gauge-value accent">{level?.level ?? "—"} · {level?.title || "Observer"}</span>
            </div>
            <div className="mer-gauge">
              <span className="mer-gauge-label">Photons</span>
              <span className="mer-gauge-value">{totalXP ?? 0} XP</span>
            </div>
            <div className="mer-gauge">
              <span className="mer-gauge-label">Clear nights</span>
              <span className="mer-gauge-value">{streak > 0 ? streak + "d" : "—"}</span>
            </div>
            <div className="mer-gauge" title={aiDetail || ""}>
              <span className="mer-gauge-label">Seeing</span>
              <Lamp status={aiStatus || "unknown"} />
            </div>
          </div>
        </div>
      </header>

      {previewMode && (
        <div className="mer-banner">
          <span>Preview mode — sample data loaded</span>
          <button onClick={() => exitPreview()}>Exit preview</button>
        </div>
      )}
      {externalChange && (
        <div className="mer-banner">
          <span>Data changed in another tab</span>
          <button onClick={() => window.location.reload()}>Reload</button>
          <button onClick={() => setUI({ externalChange: false })}>Dismiss</button>
        </div>
      )}

      <main className="mer-deck">
        <div className="mer-deck-inner">
          {view === "today" && <TodayView />}
          {view === "plan" && <PlanView />}
          {view === "dock" && <DockView />}
        </div>
      </main>

      <footer className="mer-pedestal">
        {nav.map((n) => (
          <button
            key={n.id}
            className={"mer-nav-btn" + ((n.id === "logbook" ? statsOpen : view === n.id) ? " active" : "")}
            onClick={() => {
              if (n.id === "logbook") setUI({ statsOpen: !statsOpen, cursor: null });
              else setUI({ view: n.id, cursor: null, statsOpen: false });
            }}
          >
            <span className="icon">{n.key}</span>
            <span className="mer-nav-label">{n.label}</span>
          </button>
        ))}
      </footer>

      {toast && (
        <div className="mer-toast">
          <span>{toast.msg}</span>
          {toast.xp != null && <span className="mer-accent">+{toast.xp} XP</span>}
          {toast.undo && <button onClick={() => runUndo()}>Undo</button>}
        </div>
      )}

      {levelUp && (
        <div className="mer-banner" style={{ position: "fixed", top: 70, left: 0, right: 0, zIndex: 50, justifyContent: "center", fontSize: 16 }}>
          <span className="mer-serif">✦ Rank advanced — Level {levelUp.level}: {levelUp.title}</span>
        </div>
      )}

      {helpOpen && (
        <div className="mer-bezel" style={{ position: "fixed", inset: 40, zIndex: 60, overflow: "auto", padding: 24, background: "var(--plate)" }} onClick={() => setUI({ helpOpen: false })}>
          <h2 className="mer-serif" style={{ color: "var(--brass)" }}>Observer's Handbook</h2>
          <pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{(SHORTCUT_ROWS || []).map(r => Array.isArray(r) ? r.join("  ") : String(r)).join("\\n")}</pre>
          <button onClick={() => setUI({ helpOpen: false })}>Close</button>
        </div>
      )}

      {statsOpen && <LogbookPage />}
      {formOpen && <TaskFormModal />}
      {paletteOpen && <Palette />}
      {focusTaskId && <FocusTunnel />}
      {endOfDayOpen && <EndOfDayDialog />}
      {reviewWeek != null && <ReviewOverlay />}
    </div>
  );
}
