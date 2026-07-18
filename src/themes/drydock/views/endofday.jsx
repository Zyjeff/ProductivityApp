// endofday.jsx — the close-day ritual: recap, roll-forward, screen log.

import React, { useMemo, useState } from "react";
import { Icon } from "../components.jsx";
import * as D from "../../../core/domain.js";
import { useStore, getState, setUI, closeDay, patchScreenToday } from "../../../core/store.js";

export function EndOfDayDialog() {
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
    <div onClick={() => setUI({ endOfDayOpen: false })}
      className="w-backdrop"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10004, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="w-console w-fade-in" style={{ width: "100%", maxWidth: 440 }}>
        <div className="w-console-head">
          <span className="w-tape"><Icon name="moon" size={10} /> End of day</span>
          <div style={{ flex: 1 }} />
          <button className="w-icon-btn" onClick={() => setUI({ endOfDayOpen: false })} aria-label="Close"><Icon name="close" size={12} /></button>
        </div>
        <div style={{ padding: "16px 20px 20px" }}>
        <div className="w-display" style={{ fontSize: 23, marginBottom: 16 }}>
          {completedToday.length > 0 ? "That's a wrap." : "Closing out."}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
          <div style={{ background: "var(--well)", boxShadow: "inset 0 1px 0 rgba(0,0,0,0.5)", padding: "12px 14px" }}>
            <div className="w-stencil" style={{ marginBottom: 6 }}>Completed</div>
            <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--t-mono)" }}>{completedToday.length}</div>
          </div>
          <div style={{ background: "var(--well)", boxShadow: "inset 0 1px 0 rgba(0,0,0,0.5)", padding: "12px 14px" }}>
            <div className="w-stencil" style={{ marginBottom: 6 }}>XP earned</div>
            <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--t-mono)", color: "var(--amber-hot)" }}>{xpToday}</div>
          </div>
        </div>

        {completedToday.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div className="w-stencil" style={{ marginBottom: 8 }}>Done today</div>
            <div className="w-scroll" style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
              {completedToday.map((t) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "var(--well)", fontSize: 12.5 }}>
                  <Icon name="check" size={11} />
                  <span style={{ flex: 1, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {unfinished.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div className="w-stencil">Unfinished · {unfinished.length}</div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--fg-dim)", cursor: "pointer" }}>
                <input type="checkbox" checked={rollForward} onChange={(e) => setRollForward(e.target.checked)} style={{ accentColor: "var(--amber)" }} />
                Roll to next working day
              </label>
            </div>
            <div className="w-scroll" style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 110, overflowY: "auto" }}>
              {unfinished.map((t) => (
                <div key={t.id} style={{ fontSize: 12.5, color: "var(--fg-dim)", padding: "4px 8px", boxShadow: "inset 3px 0 0 var(--line-dim)", background: "var(--well)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <div className="w-stencil" style={{ marginBottom: 8 }}>Screen time</div>
          {screenEntry.mobileHours != null ? (
            <div style={{ fontSize: 12.5, color: "var(--fg-dim)" }}>
              {screenEntry.mobileHours}h mobile · {screenEntry.xOpens || 0} X · {screenEntry.ytOpens || 0} YT
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <div className="w-well w-well--sm" style={{ flex: 1 }}>
                <input type="number" min="0" max="24" step="0.5" value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && mobile) { patchScreenToday({ mobileHours: parseFloat(mobile) || 0 }); setMobile(""); } }}
                  placeholder="Mobile hours (optional)" style={{ fontFamily: "var(--t-mono)" }} />
              </div>
              <button className="w-bezel w-bezel--sm" disabled={!mobile}
                onClick={() => { patchScreenToday({ mobileHours: parseFloat(mobile) || 0 }); setMobile(""); }}>Log</button>
            </div>
          )}
        </div>

        <button className="w-switch" style={{ width: "100%" }}
          onClick={() => closeDay({ rollForward: rollForward && unfinished.length > 0 })}>
          <Icon name="moon" size={13} /> Close the day
        </button>
        <div className="w-num" style={{ fontSize: 9.5, color: "var(--fg-faint)", marginTop: 10, textAlign: "center", letterSpacing: "0.08em" }}>
          THAT'S ENOUGH FOR TODAY.
        </div>
        </div>
      </div>
    </div>
  );
}
