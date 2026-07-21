// views/endofday.jsx — DEBRIEF: recap, roll-forward, screen log, secure.
// Logic lifted from nightwatch endofday.jsx; presentation is Apogee.

import React, { useMemo, useState } from "react";
import { Icon, Cell } from "../components.jsx";
import * as D from "../../../core/domain.js";
import {
  useStore,
  getState,
  setUI,
  closeDay,
  patchScreenToday,
} from "../../../core/store.js";

export function EndOfDayScreen() {
  const open = useStore((s) => s.ui.endOfDayOpen);
  if (!open) return null;
  return <Inner />;
}

function Inner() {
  const s = getState();
  const hour = s.meta.dayStartHour || 0;
  const todayIso = D.effectiveTodayIso(hour);
  const [rollForward, setRollForward] = useState(true);
  const [mobile, setMobile] = useState("");

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

  return (
    <div className="ap-screen" role="dialog" aria-label="DEBRIEF">
      <div className="ap-screen-head">
        <div className="ap-screen-head-title">DEBRIEF</div>
        <button
          type="button"
          className="ap-icon-btn"
          onClick={() => setUI({ endOfDayOpen: false })}
          aria-label="Close"
        >
          <Icon name="close" size={13} />
        </button>
      </div>

      <div className="ap-screen-body" style={{ maxWidth: 520, margin: "0 auto", width: "100%" }}>
        {/* Recap stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <Cell label="COMPLETED">{completedToday.length}</Cell>
          <Cell label="XP EARNED">
            <span style={{ color: "var(--signal)" }}>{xpToday}</span>
          </Cell>
        </div>

        {completedToday.length > 0 && (
          <div className="ap-mb-md" style={{ marginBottom: 18 }}>
            <div className="ap-stencil" style={{ marginBottom: 8 }}>
              NOMINAL RETURNS
            </div>
            <div
              className="ap-ledger"
              style={{ maxHeight: 140, overflowY: "auto" }}
            >
              {completedToday.map((t) => (
                <div key={t.id} className="ap-lrow">
                  <Icon name="check" size={11} />
                  <span className="ap-lrow-title ap-truncate" style={{ flex: 1, color: "var(--fg-dim)" }}>
                    {t.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {unfinished.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div className="ap-stencil">
                UNFINISHED · {unfinished.length}
              </div>
              <button
                type="button"
                className={"ap-chip" + (rollForward ? " ap-chip--on" : "")}
                onClick={() => setRollForward((v) => !v)}
                aria-pressed={rollForward}
              >
                ROLL TO NEXT WINDOW
              </button>
            </div>
            <div
              className="ap-ledger"
              style={{ maxHeight: 110, overflowY: "auto" }}
            >
              {unfinished.map((t) => (
                <div
                  key={t.id}
                  className="ap-lrow"
                  style={{ color: "var(--fg-dim)" }}
                >
                  <span className="ap-lrow-title ap-truncate">{t.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mobile-hours capture when unlogged */}
        <div style={{ marginBottom: 18 }}>
          <div className="ap-stencil" style={{ marginBottom: 8 }}>
            DOWNLINK USAGE
          </div>
          {screenEntry.mobileHours != null ? (
            <div className="ap-num" style={{ fontSize: 12.5, color: "var(--fg-dim)" }}>
              {screenEntry.mobileHours}h mobile · {screenEntry.xOpens || 0} X ·{" "}
              {screenEntry.ytOpens || 0} YT
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={mobile}
                className="ap-field ap-field--mono"
                onChange={(e) => setMobile(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && mobile) {
                    patchScreenToday({ mobileHours: parseFloat(mobile) || 0 });
                    setMobile("");
                  }
                }}
                placeholder="Mobile hours (optional)"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="ap-btn ap-btn--sm"
                disabled={!mobile}
                onClick={() => {
                  patchScreenToday({ mobileHours: parseFloat(mobile) || 0 });
                  setMobile("");
                }}
              >
                Log
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="ap-btn ap-btn--primary ap-w-full"
          style={{ width: "100%" }}
          onClick={() =>
            closeDay({ rollForward: rollForward && unfinished.length > 0 })
          }
        >
          DEBRIEF &amp; SECURE
        </button>

        <div
          className="ap-num ap-text-center"
          style={{
            fontSize: 10,
            color: "var(--fg-faint)",
            marginTop: 14,
            letterSpacing: "0.1em",
            textAlign: "center",
          }}
        >
          MISSION COMPLETE — GROUND SECURED.
        </div>
      </div>
    </div>
  );
}
