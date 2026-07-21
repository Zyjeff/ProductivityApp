// chrome.jsx — CRT frame: 4-edge telemetry, channel nav, MET rail, RankUp, banners.

import React, { useState, useEffect } from "react";
import { useStore, setUI, runUndo, sel, exitPreview } from "../../core/store.js";
import { effectiveToday, LEVEL_THRESHOLDS } from "../../core/domain.js";
import { Kbd, Lamp, MOD } from "./components.jsx";

const ALT_MIN_KM = 160;
const ALT_MAX_KM = 35786;
const DAY_MS = 24 * 3600 * 1000;

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Log-linear map of lifetime XP onto LEO→GEO altitude (km). Monotonic, clamped. */
function altitudeKm(totalXP) {
  const xp0 = LEVEL_THRESHOLDS[0];
  const xp1 = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const xp = Math.max(xp0, Math.min(xp1, Number(totalXP) || 0));
  // log1p keeps XP=0 well-defined (LEVEL_THRESHOLDS[0] is 0)
  const denom = Math.log1p(xp1) - Math.log1p(xp0);
  const t = denom === 0 ? 0 : (Math.log1p(xp) - Math.log1p(xp0)) / denom;
  const clamped = Math.max(0, Math.min(1, t));
  return Math.round(ALT_MIN_KM + clamped * (ALT_MAX_KM - ALT_MIN_KM));
}

function metElapsed(now, dayStartHour) {
  const start = effectiveToday(dayStartHour);
  let diffMs = now.getTime() - start.getTime();
  if (diffMs < 0) diffMs = 0;
  const totalMin = Math.floor(diffMs / 60000);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return { diffMs, label: `+${pad2(hh)}:${pad2(mm)}` };
}

function dayProgressPct(now, dayStartHour) {
  const start = effectiveToday(dayStartHour);
  const raw = ((now.getTime() - start.getTime()) / DAY_MS) * 100;
  return Math.max(0, Math.min(100, raw));
}

export function TheFrame({ children }) {
  const view = useStore((s) => s.ui.view);
  const statsOpen = useStore((s) => s.ui.statsOpen);
  const toast = useStore((s) => s.ui.toast);
  const aiStatus = useStore((s) => s.ui.aiStatus);
  const aiDetail = useStore((s) => s.ui.aiDetail);
  const dayStartHour = useStore(sel.dayStartHour);
  const totalXP = useStore(sel.totalXP);
  const level = useStore(sel.level);
  const streak = useStore(sel.streak);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(iv);
  }, []);

  const utcHH = pad2(now.getUTCHours());
  const utcMM = pad2(now.getUTCMinutes());
  const met = metElapsed(now, dayStartHour);
  const metPct = dayProgressPct(now, dayStartHour);
  const alt = altitudeKm(totalXP);
  const altTitle = `${level.title} · ${totalXP} XP · ${level.xpToNext} to next`;

  return (
    <div className="ap-shell">
      <div className="ap-frame">
        <div className="ap-reg-corner ap-reg-corner--tl" />
        <div className="ap-reg-corner ap-reg-corner--tr" />
        <div className="ap-reg-corner ap-reg-corner--bl" />
        <div className="ap-reg-corner ap-reg-corner--br" />

        <div className="ap-edge-top">
          <div className="ap-tcell ap-tcell--wordmark">WERF/APOGEE</div>
          <div className="ap-tcell">
            <span>UTC</span>
            <span className="ap-num">{utcHH}:{utcMM}</span>
          </div>
          <div className="ap-tcell">
            <span>MET</span>
            <span className="ap-num">{met.label}</span>
          </div>
          <div className="ap-tcell ap-tcell--signal" title={altTitle}>
            <span>ALT</span>
            <span className="ap-num">{alt} KM · L{level.lvl} {level.title} · {totalXP} XP</span>
          </div>
          {streak > 0 && (
            <div className="ap-tcell ap-tcell--opt">
              L-STREAK {streak}D
            </div>
          )}
          <div className="ap-tcell">
            <Lamp status={aiStatus} detail={aiDetail} />
            <span>COMMS</span>
          </div>
        </div>

        <div className="ap-edge-right">
          <button
            type="button"
            className={"ap-navchan" + (view === "today" && !statsOpen ? " ap-navchan--active" : "")}
            title="Pad (1)"
            onClick={() => setUI({ view: "today", cursor: null, statsOpen: false })}
          >
            01 PAD
          </button>
          <button
            type="button"
            className={"ap-navchan" + (view === "plan" && !statsOpen ? " ap-navchan--active" : "")}
            title="Trajectory (2)"
            onClick={() => setUI({ view: "plan", cursor: null, statsOpen: false })}
          >
            02 TRAJECTORY
          </button>
          <button
            type="button"
            className={"ap-navchan" + (view === "dock" && !statsOpen ? " ap-navchan--active" : "")}
            title="Hangar (3)"
            onClick={() => setUI({ view: "dock", cursor: null, statsOpen: false })}
          >
            03 HANGAR
          </button>
          <button
            type="button"
            className={"ap-navchan" + (statsOpen ? " ap-navchan--active" : "")}
            title="Flight log (4)"
            onClick={() => setUI({ statsOpen: !statsOpen })}
          >
            04 FLIGHT LOG
          </button>
        </div>

        <div className="ap-edge-left" aria-hidden="true">
          <div className="ap-metrail">
            <div className="ap-metrail-ticks" />
            <div className="ap-metrail-fill" style={{ height: metPct + "%" }} />
          </div>
        </div>

        <div className="ap-edge-bottom">
          <span>THE PAD NEVER SLEEPS</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Kbd>?</Kbd>
            <span>HELP</span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Kbd>{MOD}+K</Kbd>
            <span>UPLINK</span>
          </span>
          <div className="ap-telemetry">
            {toast ? (
              <>
                <span>{toast.msg}</span>
                {toast.xp != null && toast.xp !== 0 && (
                  <span
                    style={{
                      color: toast.xp < 0 ? "var(--port)" : "var(--starboard)",
                      fontWeight: 600,
                    }}
                  >
                    {toast.xp > 0 ? "+" : ""}
                    {toast.xp} XP
                  </span>
                )}
                {toast.undoId && (
                  <button
                    type="button"
                    className="ap-telemetry-abort"
                    onClick={() => runUndo(toast.undoId)}
                  >
                    ABORT <Kbd>U</Kbd>
                  </button>
                )}
              </>
            ) : (
              <span style={{ color: "var(--fg-faint)" }}>TELEMETRY NOMINAL</span>
            )}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

export function RankUp() {
  const levelUp = useStore((s) => s.ui.levelUp);
  if (!levelUp) return null;
  return (
    <div
      className="ap-rankup"
      role="status"
      aria-live="polite"
      style={{
        borderColor: "var(--flare)",
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10010,
        minWidth: 280,
      }}
    >
      <div className="ap-rankup-label" style={{ color: "var(--flare)" }}>
        RANK UP
      </div>
      <div
        className="ap-rankup-num"
        style={{
          color: "var(--flare)",
          textShadow: "0 0 8px rgba(255,46,154,0.35), 0 0 40px rgba(255,46,154,0.25)",
        }}
      >
        {levelUp.lvl}
      </div>
      <div className="ap-rankup-sub">{levelUp.title}</div>
    </div>
  );
}

export function Banners() {
  const previewMode = useStore((s) => s.ui.previewMode);
  const externalChange = useStore((s) => s.ui.externalChange);
  if (!previewMode && !externalChange) return null;
  return (
    <>
      {previewMode && (
        <div className="ap-banner ap-banner--sim" role="status">
          <span style={{ flex: 1 }}>SIMULATION RUNNING — real telemetry snapshotted.</span>
          <button type="button" className="ap-btn ap-btn--sm" onClick={exitPreview}>
            End simulation
          </button>
        </div>
      )}
      {externalChange && (
        <div className="ap-banner ap-banner--conflict" role="alert">
          <span style={{ flex: 1 }}>Ground station conflict — another console wrote telemetry.</span>
          <button
            type="button"
            className="ap-btn ap-btn--sm"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
          <button
            type="button"
            className="ap-btn ap-btn--ghost ap-btn--sm"
            onClick={() => setUI({ externalChange: false })}
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
