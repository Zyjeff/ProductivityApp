// app.jsx — the Kuromi Note shell: status strip + dial pad on top,
// three surfaces below, and a rendered surface for every ui flag.

import React from "react";
import { Icon, Kbd, MOD } from "./components.jsx";
import { glyph, GLYPH_SKULL } from "./sprite.js";
import { statementBg } from "./texture.js";
import { useStore, setUI, runUndo, sel, exitPreview } from "../../core/store.js";
import { SHORTCUT_ROWS } from "../../core/keys.js";
import * as D from "../../core/domain.js";
import { TodayView } from "./views/today.jsx";
import { PlanView } from "./views/plan.jsx";
import { DockView } from "./views/dock.jsx";
import { DiaryPage } from "./views/logbook.jsx";
import { ReviewOverlay } from "./views/review.jsx";
import { FocusTunnel } from "./views/focus.jsx";
import { Palette } from "./views/palette.jsx";
import { EndOfDayDialog } from "./views/endofday.jsx";
import { TaskFormModal } from "./taskform.jsx";

const NAV = [
  { id: "today", label: "SCHEMES", word: "SCHEMES", icon: "skull", key: "1", title: "Today (1)" },
  { id: "plan", label: "MAP", word: "MAP", icon: "flag", key: "2", title: "Plan (2)" },
  { id: "dock", label: "BOSS RUSH", word: "BOSSES", icon: "target", key: "3", title: "Dock (3)" },
];

/* AI lamp — honest states only */
function Lamp({ status, detail }) {
  const cls =
    status === "ok" ? "is-ok" : status === "busy" ? "is-busy" : status === "off" ? "is-off" : "";
  const text =
    status === "ok" ? "IMP ONLINE" : status === "busy" ? "IMP SCHEMING" : status === "off" ? "IMP GONE" : "IMP?";
  return (
    <span className={"k-lamp " + cls} title={detail || "The AI imp that ghostwrites briefs and scores. Everything works without it."}>
      <span className="k-lamp-dot" />
      {text}
    </span>
  );
}

function Confetti({ onDone }) {
  React.useEffect(() => {
    const t = setTimeout(onDone, 1700);
    return () => clearTimeout(t);
  }, [onDone]);
  const pieces = React.useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        left: (i * 137.5) % 100,
        delay: (i % 10) * 0.06,
        color: ["#ff4d9e", "#ff85c0", "#b06bff", "#4df2a4", "#ffd23f"][i % 5],
        skull: i % 9 === 0,
      })),
    []
  );
  return (
    <div className="k-confetti" aria-hidden>
      {pieces.map((p, i) =>
        p.skull ? (
          <img
            key={i}
            src={glyph(GLYPH_SKULL, p.color)}
            style={{ position: "absolute", top: -14, left: p.left + "%", height: 14, imageRendering: "pixelated", animation: `k-fall 1.6s steps(20) ${p.delay}s forwards` }}
            alt=""
          />
        ) : (
          <i key={i} style={{ left: p.left + "%", background: p.color, animationDelay: p.delay + "s" }} />
        )
      )}
    </div>
  );
}

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
        <div className="k-crash">
          <div className="k-crash-card">
            <div className="k-display">THE HANDHELD GLITCHED</div>
            <pre>{String(this.state.err?.stack || this.state.err)}</pre>
            <button className="k-btn is-primary" onClick={() => window.location.reload()}>
              BLOW ON THE CARTRIDGE (RELOAD)
            </button>
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
  const totalXP = useStore(sel.totalXP);
  const streak = useStore(sel.streak);
  const level = useStore(sel.level);

  const [confettiShown, setConfettiShown] = React.useState(0);
  const [clock, setClock] = React.useState(() => new Date());
  React.useEffect(() => {
    const iv = setInterval(() => setClock(new Date()), 1000 * 20);
    return () => clearInterval(iv);
  }, []);
  const hh = String(clock.getHours()).padStart(2, "0");
  const mm = String(clock.getMinutes()).padStart(2, "0");

  const brandSkull = React.useMemo(() => glyph(GLYPH_SKULL, "#ff4d9e"), []);

  return (
    <div className="k-root">
      {/* status strip */}
      <header className="k-strip">
        <span className="k-strip-brand">
          <img src={brandSkull} alt="" />
          KUROMI NOTE
        </span>
        <span className="k-strip-cell">
          <span className="k-lab">SCORE</span>
          <span className="k-val is-pink">{totalXP}</span>
        </span>
        <span className="k-strip-cell">
          <span className="k-lab">COMBO</span>
          <span className="k-val is-green">{streak > 0 ? `×${streak}` : "—"}</span>
        </span>
        <span className="k-strip-cell">
          <span className="k-lab">RANK</span>
          <span className="k-val is-violet">{level.lvl}·{level.title.toUpperCase()}</span>
        </span>
        <span className="k-strip-spacer" />
        <span className="k-strip-clock">{hh}:{mm}</span>
        <Lamp status={aiStatus} detail={aiDetail} />
      </header>

      {/* dial pad */}
      <nav className="k-nav">
        <div className="k-nav-pad">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={"k-nav-btn" + (view === n.id && !statsOpen ? " is-on" : "")}
              onClick={() => setUI({ view: n.id, cursor: null })}
              title={n.title}
            >
              <span className="k-nav-ico"><Icon name={n.icon} size={13} /></span>
              <span className="k-nav-word">{n.word}</span>
              <span className="k-nav-key">{n.key}</span>
            </button>
          ))}
          <button
            className={"k-nav-btn" + (statsOpen ? " is-on" : "")}
            onClick={() => setUI({ statsOpen: !statsOpen })}
            title="Kuromi Note — the diary, settings, data (4)"
          >
            <span className="k-nav-ico"><Icon name="book" size={13} /></span>
            <span className="k-nav-word">DIARY</span>
            <span className="k-nav-key">4</span>
          </button>
        </div>
        <div className="k-nav-right">
          <button className="k-btn is-sm is-ghost" onClick={() => setUI({ helpOpen: true })} title="Keyboard help (?)">
            <Kbd>?</Kbd>
          </button>
          <button className="k-btn is-sm is-ghost" onClick={() => setUI({ paletteOpen: true })} title="Whisper a command">
            <Kbd>{MOD} K</Kbd>
          </button>
        </div>
      </nav>

      {/* banners — between chrome and stage */}
      {previewMode && (
        <div className="k-banner is-preview">
          <Icon name="eye" size={12} />
          <span>REHEARSAL MODE — this is demo mischief. Your real schemes are snapshotted and come back on exit.</span>
          <span className="k-spacer" />
          <button className="k-btn is-sm" onClick={exitPreview}>EXIT REHEARSAL</button>
        </div>
      )}
      {externalChange && (
        <div className="k-banner is-external">
          <Icon name="spark" size={12} />
          <span>Another tab scribbled in the diary — reload to pick it up safely.</span>
          <span className="k-spacer" />
          <button className="k-btn is-sm" onClick={() => window.location.reload()}>RELOAD</button>
          <button className="k-btn is-sm is-ghost" onClick={() => setUI({ externalChange: false })}>DISMISS</button>
        </div>
      )}

      {/* stage */}
      <main className="k-stage">
        {view === "today" && <TodayView />}
        {view === "plan" && <PlanView />}
        {view === "dock" && <DockView />}
      </main>

      {/* toast */}
      {toast && (
        <div className="k-toast" role="status">
          <img src={brandSkull} alt="" style={{ height: 18, imageRendering: "pixelated" }} />
          <span>{toast.msg}</span>
          {toast.xp != null && toast.xp !== 0 && (
            <span className={"k-toast-xp" + (toast.xp < 0 ? " is-neg" : "")}>
              {toast.xp >= 0 ? "+" : ""}{toast.xp} XP
            </span>
          )}
          {toast.undoId && (
            <button className="k-btn is-sm" onClick={() => runUndo(toast.undoId)}>
              UNDO <Kbd>U</Kbd>
            </button>
          )}
        </div>
      )}

      {confetti > confettiShown && <Confetti onDone={() => setConfettiShown(confetti)} />}

      {levelUp && (
        <div
          role="status"
          aria-live="polite"
          className="k-levelup k-statement"
          style={{ ...statementBg("kuromi-levelup-" + levelUp.lvl) }}
        >
          <div className="k-display">RANK UP — LV {level.lvl}</div>
          <div className="k-sub-line">{levelUp.title}! Obviously. You had help.</div>
        </div>
      )}

      {helpOpen && (
        <div className="k-backdrop" style={{ zIndex: 96, alignItems: "center" }} onMouseDown={(e) => e.target === e.currentTarget && setUI({ helpOpen: false })}>
          <div className="k-console" style={{ maxWidth: 400 }}>
            <div className="k-console-head">
              <span className="k-display">CHEAT SHEET</span>
              <button className="k-x" onClick={() => setUI({ helpOpen: false })} aria-label="Close">
                <Icon name="x" size={10} />
              </button>
            </div>
            <div className="k-console-body" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {SHORTCUT_ROWS.map(([keys, label]) => (
                <div key={keys} className="k-rowline">
                  <span style={{ flex: 1, fontSize: 13.5 }}>{label}</span>
                  <Kbd>{keys}</Kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <TaskFormModal />
      <DiaryPage />
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
