import React, { useEffect, useState } from "react";
import { useStore, setUI, runUndo, sel, exitPreview } from "../../core/store.js";
import { SHORTCUT_ROWS, MOD } from "../../core/keys.js";
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
import { Starfield } from "./starfield.jsx";
import { Icon, Kbd, Confetti } from "./components.jsx";

const NAV = [
  { id: "today", label: "Session", key: "1" },
  { id: "plan", label: "Ephemeris", key: "2" },
  { id: "dock", label: "Bay", key: "3" },
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
  const level = useStore(sel.level);
  const totalXP = useStore(sel.totalXP);
  const streak = useStore(sel.streak);
  const [confettiShown, setConfettiShown] = useState(0);

  useEffect(() => {
    if (confetti > confettiShown) setConfettiShown(confetti);
  }, [confetti, confettiShown]);

  const starDensity = Math.min(80, 20 + (streak || 0) * 3 + Math.floor((totalXP || 0) / 50));

  return (
    <div className="m-shell">
      {/* Persistent sky strip — signature */}
      <header className="m-sky">
        <Starfield density={starDensity} />
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 16, width: "100%" }}>
          <div className="m-title" style={{ fontSize: 18, color: "var(--brass-hot)" }}>Meridian</div>
          <div className="m-mono" style={{ fontSize: 12, color: "var(--fg-dim)" }}>
            Rank {level?.rank ?? level ?? "—"} · {totalXP ?? 0} ph · {streak ?? 0} clear
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <span className="m-mono" style={{ fontSize: 11, color: aiStatus === "ok" ? "var(--starboard)" : "var(--warn)" }}>
              {aiStatus === "ok" ? "Seeing good" : (aiStatus || "Offline")}
            </span>
            <button className="m-plaque" onClick={() => setUI({ helpOpen: true })} title="Observer handbook">
              ?
            </button>
          </div>
        </div>
      </header>

      {/* Main deck */}
      <main className="m-deck">
        {previewMode && (
          <div style={{ background: "var(--warn-ground)", color: "var(--warn)", padding: "6px 12px", textAlign: "center", fontSize: 12 }}>
            Preview mode — data not persisted. <button onClick={exitPreview}>Exit</button>
          </div>
        )}
        {externalChange && (
          <div style={{ background: "var(--port-ground)", color: "var(--port)", padding: "6px 12px", textAlign: "center", fontSize: 12 }}>
            External change detected. Reload recommended.
          </div>
        )}
        {view === "today" && <TodayView />}
        {view === "plan" && <PlanView />}
        {view === "dock" && <DockView />}
      </main>

      {/* Bottom instrument pedestal — reinvented nav */}
      <footer className="m-pedestal">
        {NAV.map((n) => (
          <button
            key={n.id}
            className="m-plaque"
            aria-current={view === n.id ? "page" : undefined}
            onClick={() => setUI({ view: n.id, cursor: null, statsOpen: false })}
          >
            <Kbd>{n.key}</Kbd> {n.label}
          </button>
        ))}
        <button
          className="m-plaque"
          aria-current={statsOpen ? "page" : undefined}
          onClick={() => setUI({ statsOpen: !statsOpen })}
        >
          <Kbd>4</Kbd> Journal
        </button>
        <div style={{ flex: 1 }} />
        <span className="m-mono" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
          n · log sighting
        </span>
      </footer>

      {/* Toast */}
      {toast && (
        <div className="m-toast">
          <span>{toast.xp ? `+${toast.xp} ph` : "✓"}</span>
          <span>{toast.msg}</span>
          {toast.undoId && (
            <button className="m-plaque" onClick={() => runUndo(toast.undoId)}>
              Reverse
            </button>
          )}
        </div>
      )}

      {/* Confetti as aurora */}
      {confetti > confettiShown - 1 && <Confetti />}

      {/* Level-up */}
      {levelUp && (
        <div style={{
          position: "fixed", inset: 0, display: "grid", placeItems: "center",
          background: "rgba(7,11,20,0.85)", zIndex: 60
        }}>
          <div className="m-plate" style={{ padding: 32, textAlign: "center", borderColor: "var(--brass)" }}>
            <div className="m-title" style={{ fontSize: 28, color: "var(--brass-hot)" }}>Nova</div>
            <div style={{ marginTop: 8 }}>Observer rank advanced</div>
            <button className="m-plaque" style={{ marginTop: 16 }} onClick={() => setUI({ levelUp: null })}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Help */}
      {helpOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(7,11,20,0.8)", zIndex: 55,
          display: "grid", placeItems: "center"
        }} onClick={() => setUI({ helpOpen: false })}>
          <div className="m-plate" style={{ padding: 24, maxWidth: 480, maxHeight: "80vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
            <div className="m-title" style={{ marginBottom: 12 }}>Observer's Handbook</div>
            {(SHORTCUT_ROWS || []).map((row, i) => (
              <div key={i} style={{ display: "flex", gap: 12, marginBottom: 6, fontSize: 13 }}>
                <span className="m-mono" style={{ color: "var(--brass)", minWidth: 80 }}>{row.keys || row[0]}</span>
                <span style={{ color: "var(--fg-dim)" }}>{row.desc || row[1]}</span>
              </div>
            ))}
            <button className="m-plaque" style={{ marginTop: 16 }} onClick={() => setUI({ helpOpen: false })}>Close</button>
          </div>
        </div>
      )}

      {/* Always-mounted overlays for keyboard / Esc cascade */}
      <TaskFormModal />
      <LogbookPage />
      <ReviewOverlay />
      <Palette />
      <EndOfDayDialog />
      <FocusTunnel />
    </div>
  );
}
