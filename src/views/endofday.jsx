// endofday.jsx — the close-day ritual: recap, roll-forward, screen log.

import React, { useMemo, useState } from "react";
import { Icon } from "../components.jsx";
import * as D from "../domain.js";
import { useStore, getState, setUI, closeDay, patchScreenToday } from "../store.js";

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
      style={{ position: "fixed", inset: 0, background: "rgba(6,8,12,0.72)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10004, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="w-card w-fade-in" style={{ width: "100%", maxWidth: 440, padding: 24 }}>
        <div className="w-eyebrow" style={{ marginBottom: 4 }}>End of day</div>
        <div className="w-display" style={{ fontSize: 22, fontWeight: 600, marginBottom: 16 }}>
          {completedToday.length > 0 ? "That's a wrap." : "Closing out."}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
          <div style={{ background: "var(--bg-soft)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
            <div className="w-stat-label" style={{ marginBottom: 6 }}>Completed</div>
            <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{completedToday.length}</div>
          </div>
          <div style={{ background: "var(--bg-soft)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
            <div className="w-stat-label" style={{ marginBottom: 6 }}>XP earned</div>
            <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--amber-strong)" }}>{xpToday}</div>
          </div>
        </div>

        {completedToday.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div className="w-eyebrow" style={{ marginBottom: 8 }}>Done today</div>
            <div className="w-scroll" style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
              {completedToday.map((t) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: "var(--r-sm)", background: "var(--bg-soft)", fontSize: 12.5 }}>
                  <Icon name="check" size={11} />
                  <span style={{ flex: 1, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {unfinished.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div className="w-eyebrow">Unfinished · {unfinished.length}</div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-muted)", cursor: "pointer" }}>
                <input type="checkbox" checked={rollForward} onChange={(e) => setRollForward(e.target.checked)} style={{ accentColor: "var(--amber)" }} />
                Roll to next working day
              </label>
            </div>
            <div className="w-scroll" style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 110, overflowY: "auto" }}>
              {unfinished.map((t) => (
                <div key={t.id} style={{ fontSize: 12.5, color: "var(--text-muted)", padding: "4px 8px", borderRadius: "var(--r-sm)", border: "1px dashed var(--border)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <div className="w-eyebrow" style={{ marginBottom: 8 }}>Screen time</div>
          {screenEntry.mobileHours != null ? (
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              {screenEntry.mobileHours}h mobile · {screenEntry.xOpens || 0} X · {screenEntry.ytOpens || 0} YT
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <input type="number" min="0" max="24" step="0.5" value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && mobile) { patchScreenToday({ mobileHours: parseFloat(mobile) || 0 }); setMobile(""); } }}
                placeholder="Mobile hours (optional)" className="w-input w-input--sm" style={{ flex: 1, fontFamily: "var(--font-mono)" }} />
              <button className="w-btn w-btn--outline w-btn--sm" disabled={!mobile}
                onClick={() => { patchScreenToday({ mobileHours: parseFloat(mobile) || 0 }); setMobile(""); }}>Log</button>
            </div>
          )}
        </div>

        <button className="w-btn w-btn--primary" style={{ width: "100%" }}
          onClick={() => closeDay({ rollForward: rollForward && unfinished.length > 0 })}>
          <Icon name="moon" size={13} /> Close the day
        </button>
        <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 10, textAlign: "center" }}>
          That's enough for today.
        </div>
      </div>
    </div>
  );
}
