// endofday.jsx — Close the amado (DESIGN.md §5.7).
// Logic lifted from nightwatch/views/endofday.jsx (recap memo, roll-forward
// toggle, mobile-hours capture, closeDay({rollForward})). Composition is a
// washi console between two visible shutter panels that slide shut, then
// the sign-off THE HOUSE SLEEPS.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../components.jsx";
import { REDUCED_MOTION, woodGrain } from "../texture.js";
import * as D from "../../../core/domain.js";
import { useStore, getState, setUI, closeDay, patchScreenToday } from "../../../core/store.js";

const SHUTTER_TEX = woodGrain("amado-shutter");
const SHUT_MS = REDUCED_MOTION ? 0 : 720;
const SLEEP_MS = REDUCED_MOTION ? 900 : 1600;

export function EndOfDayDialog() {
  const open = useStore((s) => s.ui.endOfDayOpen);
  const [hold, setHold] = useState(false);
  if (!open && !hold) return null;
  return <Inner setHold={setHold} />;
}

function Inner({ setHold }) {
  const s = getState();
  const hour = s.meta.dayStartHour || 0;
  const todayIso = D.effectiveTodayIso(hour);
  const [rollForward, setRollForward] = useState(true);
  const [mobile, setMobile] = useState("");
  const [phase, setPhase] = useState("idle");
  const timers = useRef([]);
  useEffect(() => () => { timers.current.forEach((id) => clearTimeout(id)); }, []);

  const { completedToday, xpToday, unfinished } = useMemo(() => {
    const activity = D.activityByDay(s.tasks, s.plan, hour).get(todayIso) || new Set();
    const completedToday = s.tasks.filter((t) => activity.has(t.id));
    const entry = (s.plan || []).find((e) => e.date === todayIso);
    const byId = new Map(s.tasks.map((t) => [t.id, t]));
    const unfinished = (entry?.items || [])
      .filter((it) => !it.done)
      .map((it) => byId.get(it.taskId))
      .filter((t) => t && !t.completed);
    return { completedToday, xpToday: D.todayXP(s.tasks, s.plan, hour), unfinished };
  }, []);

  const screenEntry = s.screen[todayIso] || { xOpens: 0, ytOpens: 0, mobileHours: null };

  const shutTheHouse = () => {
    setHold(true);
    setPhase("shutting");
    timers.current.push(window.setTimeout(() => {
      closeDay({ rollForward: rollForward && unfinished.length > 0 });
      setPhase("sleeps");
      timers.current.push(window.setTimeout(() => {
        setHold(false);
        setPhase("idle");
      }, SLEEP_MS));
    }, SHUT_MS));
  };

  const busy = phase !== "idle";
  const cls = "yzt-amado"
    + (phase === "shutting" || phase === "sleeps" ? " yzt-amado--shut" : "")
    + (phase === "sleeps" ? " yzt-amado--sleeps" : "");

  return (
    <div
      className={cls}
      role="dialog"
      aria-label="Close the amado"
      onClick={() => { if (!busy) setUI({ endOfDayOpen: false }); }}
    >
      <div
        className="yzt-amado-shutter yzt-amado-shutter--l"
        style={{ backgroundImage: SHUTTER_TEX }}
        aria-hidden
      />
      <div
        className="yzt-amado-shutter yzt-amado-shutter--r"
        style={{ backgroundImage: SHUTTER_TEX }}
        aria-hidden
      />

      <div className="yzt-amado-sleeps yz-display" aria-live="polite">
        THE HOUSE SLEEPS.
      </div>

      <div className="yzt-amado-console yz-washi fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="yzt-amado-head">
          <h2 className="yz-sec">Close the amado</h2>
          <div style={{ flex: 1 }} />
          <button type="button" className="yz-icon-btn" onClick={() => setUI({ endOfDayOpen: false })} aria-label="Close">
            <Icon name="close" size={12} />
          </button>
        </div>

        <div className="yzt-amado-body">
          <div className="yz-display yzt-amado-lead">
            {completedToday.length > 0 ? "The lanterns dim." : "Closing the house."}
          </div>

          <div className="yzt-amado-tiles">
            <div className="yzt-amado-tile">
              <div className="yz-sec">Completed</div>
              <div className="yz-display yz-num yzt-amado-n">{completedToday.length}</div>
            </div>
            <div className="yzt-amado-tile">
              <div className="yz-sec">XP earned</div>
              <div className="yz-display yz-num yzt-amado-n" style={{ color: "var(--amber-deep)" }}>{xpToday}</div>
            </div>
          </div>

          {completedToday.length > 0 && (
            <div className="yzt-amado-block">
              <h3 className="yz-sec" style={{ marginBottom: 8 }}>In the books</h3>
              <div className="yzt-amado-list">
                {completedToday.map((t) => (
                  <div key={t.id} className="yzt-amado-row">
                    <Icon name="blossom" size={11} />
                    <span>{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unfinished.length > 0 && (
            <div className="yzt-amado-block">
              <div className="yzt-amado-unfin-head">
                <div className="yz-sec">Unfinished · {unfinished.length}</div>
                <label className="yzt-amado-toggle">
                  <input type="checkbox" checked={rollForward} onChange={(e) => setRollForward(e.target.checked)} />
                  Carry to the next open day
                </label>
              </div>
              <div className="yzt-amado-list">
                {unfinished.map((t) => (
                  <div key={t.id} className="yzt-amado-row yzt-amado-row--dim">{t.title}</div>
                ))}
              </div>
            </div>
          )}

          {screenEntry.mobileHours == null && (
            <div className="yzt-amado-block">
              <h3 className="yz-sec" style={{ marginBottom: 8 }}>Mobile hours</h3>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="number" min="0" max="24" step="0.5" value={mobile}
                  className="yz-field yz-field--mono"
                  onChange={(e) => setMobile(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && mobile) { patchScreenToday({ mobileHours: parseFloat(mobile) || 0 }); setMobile(""); } }}
                  placeholder="Hours (optional)" style={{ flex: 1 }} />
                <button type="button" className="yz-btn yz-btn--sm" disabled={!mobile}
                  onClick={() => { patchScreenToday({ mobileHours: parseFloat(mobile) || 0 }); setMobile(""); }}>Log</button>
              </div>
            </div>
          )}

          <button type="button" className="yz-btn yz-btn--ink" style={{ width: "100%" }}
            disabled={busy}
            onClick={shutTheHouse}>
            <Icon name="lantern" size={13} /> Close the amado
          </button>
        </div>
      </div>
    </div>
  );
}
