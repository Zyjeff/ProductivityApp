// endofday.jsx — End of cycle bottom tray.

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
    <div className="r-backdrop" onClick={() => setUI({ endOfDayOpen: false })} style={{ background: "rgba(3,5,10,.45)" }}>
      <div className="r-eod-tray" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span className="r-lab r-lab--lit">End of cycle</span>
          <div style={{ flex: 1 }} />
          <button className="r-icon-btn" onClick={() => setUI({ endOfDayOpen: false })} aria-label="Close"><Icon name="close" size={12} /></button>
        </div>
        <div className="r-display" style={{ fontSize: 20, marginBottom: 12 }}>
          {completedToday.length > 0 ? "Cycle clean." : "Closing the loop."}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <div className="r-plate r-plate--flush">
            <div className="r-lab" style={{ marginBottom: 4 }}>Resolved</div>
            <div className="r-num" style={{ fontSize: 22, fontWeight: 600 }}>{completedToday.length}</div>
          </div>
          <div className="r-plate r-plate--flush">
            <div className="r-lab" style={{ marginBottom: 4 }}>Signal XP</div>
            <div className="r-num" style={{ fontSize: 22, fontWeight: 600, color: "var(--channel)" }}>{xpToday}</div>
          </div>
        </div>

        {completedToday.length > 0 && (
          <div style={{ marginBottom: 12, maxHeight: 100, overflowY: "auto" }}>
            {completedToday.map((t) => (
              <div key={t.id} style={{ fontSize: 12.5, color: "var(--fg-dim)", padding: "3px 0" }}>✓ {t.title}</div>
            ))}
          </div>
        )}

        {unfinished.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--fg-dim)", cursor: "pointer", marginBottom: 6 }}>
              <input type="checkbox" checked={rollForward} onChange={(e) => setRollForward(e.target.checked)} />
              Roll {unfinished.length} unfinished to next working day
            </label>
          </div>
        )}

        {screenEntry.mobileHours == null && (
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <input type="number" min="0" max="24" step="0.5" value={mobile} className="r-field"
              onChange={(e) => setMobile(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && mobile) { patchScreenToday({ mobileHours: parseFloat(mobile) || 0 }); setMobile(""); } }}
              placeholder="Mobile hours (optional)" style={{ flex: 1 }} />
            <button className="r-btn r-btn--sm r-btn--ghost" disabled={!mobile}
              onClick={() => { patchScreenToday({ mobileHours: parseFloat(mobile) || 0 }); setMobile(""); }}>Log</button>
          </div>
        )}

        <button className="r-btn" style={{ width: "100%" }}
          onClick={() => closeDay({ rollForward: rollForward && unfinished.length > 0 })}>
          <Icon name="moon" size={13} /> End of cycle
        </button>
        <div className="r-lab" style={{ marginTop: 10, textAlign: "center" }}>THE GRID NEVER SLEEPS — YOU CAN.</div>
      </div>
    </div>
  );
}
