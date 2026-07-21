// app.jsx — Apogee shell: CRT frame + stage + every §6 ui surface + ErrorBoundary.

import React from "react";
import { useStore, setUI } from "../../core/store.js";
import { SHORTCUT_ROWS } from "../../core/keys.js";
import { TheFrame, RankUp, Banners } from "./chrome.jsx";
import { Kbd, Confetti } from "./components.jsx";
import { TodayView } from "./views/today.jsx";
import { PlanView } from "./views/plan.jsx";
import { DockView } from "./views/dock.jsx";
import { LogbookScreen } from "./views/logbook.jsx";
import { Palette } from "./views/palette.jsx";
import { TaskFormScreen } from "./taskform.jsx";
import { FocusTunnel } from "./views/focus.jsx";
import { ReviewScreen } from "./views/review.jsx";
import { EndOfDayScreen } from "./views/endofday.jsx";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  render() {
    if (this.state.err) {
      return (
        <div className="ap-anomaly">
          <div className="ap-anomaly-title">ANOMALY</div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: 11,
              color: "var(--fg-dim)",
              fontFamily: "var(--t-mono)",
            }}
          >
            {String((this.state.err && this.state.err.stack) || this.state.err)}
          </pre>
          <button
            type="button"
            className="ap-btn ap-btn--primary"
            style={{ marginTop: 14 }}
            onClick={() => window.location.reload()}
          >
            Reset console
          </button>
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
  const confetti = useStore((s) => s.ui.confetti);
  const focusTaskId = useStore((s) => s.ui.focusTaskId);

  const [confettiShown, setConfettiShown] = React.useState(0);

  return (
    <>
      <TheFrame>
        <div className="ap-stage">
          <Banners />
          {!statsOpen && view === "today" && <TodayView />}
          {!statsOpen && view === "plan" && <PlanView />}
          {!statsOpen && view === "dock" && <DockView />}
          {statsOpen && <LogbookScreen />}
        </div>
      </TheFrame>

      <Palette />
      <TaskFormScreen />
      {focusTaskId && <FocusTunnel />}
      <ReviewScreen />
      <EndOfDayScreen />

      <RankUp />

      {confetti > confettiShown && (
        <Confetti onDone={() => setConfettiShown(confetti)} />
      )}

      {helpOpen && (
        <div className="ap-screen" onClick={() => setUI({ helpOpen: false })}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
          >
            <div className="ap-screen-head">
              <div className="ap-screen-head-title">STANDING ORDERS</div>
              <button
                type="button"
                className="ap-btn ap-btn--ghost ap-btn--sm"
                onClick={() => setUI({ helpOpen: false })}
              >
                Close
              </button>
            </div>
            <div className="ap-screen-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {SHORTCUT_ROWS.map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 24,
                    }}
                  >
                    <span>{v}</span>
                    <Kbd>{k}</Kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Shell />
    </ErrorBoundary>
  );
}
