// endofday.jsx — signing the diary: the day's loot, the loose ends
// (roll them forward or let them burn), a last confession.

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
    <div className="k-backdrop" style={{ zIndex: 84, alignItems: "center" }} onMouseDown={(e) => e.target === e.currentTarget && setUI({ endOfDayOpen: false })}>
      <div className="k-console" style={{ maxWidth: 450 }}>
        <div className="k-console-head">
          <span className="k-display"><Icon name="moon" size={10} /> SIGN THE DIARY</span>
          <button className="k-x" onClick={() => setUI({ endOfDayOpen: false })} aria-label="Close"><Icon name="x" size={10} /></button>
        </div>
        <div className="k-console-body">
          <div className="k-display" style={{ fontSize: 15, marginBottom: 16 }}>
            {completedToday.length > 0 ? "Another day, another crime spree." : "Closing out. Quietly."}
          </div>

          <div className="k-tiles k-mb" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="k-tile">
              <div className="k-lab">Pulled off</div>
              <div className="k-val">{completedToday.length}</div>
            </div>
            <div className="k-tile">
              <div className="k-lab">Chaos earned</div>
              <div className="k-val" style={{ color: "var(--amber-hot)" }}>{xpToday} XP</div>
            </div>
          </div>

          {completedToday.length > 0 && (
            <div className="k-mb">
              <div className="k-eyebrow is-green">IN THE BAG</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
                {completedToday.map((t) => (
                  <div key={t.id} className="k-eod-row" style={{ background: "var(--well)", borderRadius: 5, padding: "5px 9px" }}>
                    <Icon name="check" size={10} color="var(--starboard)" />
                    <span className="k-dim" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unfinished.length > 0 && (
            <div className="k-mb">
              <div className="k-rowline" style={{ marginBottom: 8 }}>
                <span className="k-eyebrow" style={{ color: "var(--warn)", marginBottom: 0, flex: 1 }}>LOOSE ENDS · {unfinished.length}</span>
                <label className="k-rowline k-dim" style={{ gap: 6, fontSize: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={rollForward} onChange={(e) => setRollForward(e.target.checked)} />
                  smuggle into the next working day
                </label>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 110, overflowY: "auto" }}>
                {unfinished.map((t) => (
                  <div key={t.id} className="k-dim k-sm" style={{ padding: "4px 9px", boxShadow: "inset 3px 0 0 var(--line-hi)", background: "var(--well)", borderRadius: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                ))}
              </div>
            </div>
          )}

          <div className="k-mb">
            <div className="k-eyebrow is-dim">LAST CONFESSION</div>
            {screenEntry.mobileHours != null ? (
              <div className="k-dim k-sm">
                {screenEntry.mobileHours}h on the phone · {screenEntry.xOpens || 0} X · {screenEntry.ytOpens || 0} YT. Noted. Forever.
              </div>
            ) : (
              <div className="k-rowline">
                <input
                  type="number" min="0" max="24" step="0.5" value={mobile} className="k-input k-mono"
                  onChange={(e) => setMobile(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && mobile) { patchScreenToday({ mobileHours: parseFloat(mobile) || 0 }); setMobile(""); } }}
                  placeholder="phone hours (optional)" style={{ flex: 1, padding: "5px 9px" }}
                />
                <button
                  className="k-btn is-sm" disabled={!mobile}
                  onClick={() => { patchScreenToday({ mobileHours: parseFloat(mobile) || 0 }); setMobile(""); }}
                >
                  CONFESS
                </button>
              </div>
            )}
          </div>

          <button
            className="k-btn is-primary is-wide"
            onClick={() => closeDay({ rollForward: rollForward && unfinished.length > 0 })}
          >
            <Icon name="moon" size={12} /> SIGN IT. DAY'S OVER.
          </button>
          <div className="k-mono-sm k-faint" style={{ marginTop: 10, textAlign: "center" }}>
            TOMORROW'S PAGE IS ALREADY WAITING.
          </div>
        </div>
      </div>
    </div>
  );
}
