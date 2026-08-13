// endofday.jsx — The Campfire. The day's recap set as three
// haiku-shaped lines built from REAL completions, resolve and walked
// time; the unfinished are carried to the next day the road is open.
// Behaviour is the core contract exactly.

import React, { useMemo, useState } from "react";
import { Icon, Kbd } from "../components.jsx";
import { leafBg } from "../texture.js";
import * as D from "../../../core/domain.js";
import { useStore, getState, setUI, closeDay, patchScreenToday } from "../../../core/store.js";

// Three lines, derived — never invented. The shape is haiku-ish; the
// numbers are the ledger's.
function campfireLines({ count, xp, focusMs, unfinished }) {
  const first = count === 0
    ? "Nothing reached today —"
    : count === 1
      ? "One waypoint behind you —"
      : `${count} waypoints behind you —`;
  const second = xp > 0
    ? `${xp} resolve gathered${focusMs ? `, ${D.fmtMs(focusMs)} walked` : ""}`
    : focusMs ? `${D.fmtMs(focusMs)} walked, nothing marked` : "the road stayed quiet";
  const third = unfinished === 0
    ? "the fire burns low."
    : unfinished === 1
      ? "one thing waits for morning."
      : `${unfinished} things wait for morning.`;
  return `${first}\n${second},\n${third}`;
}

export function CampfireDialog() {
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

  const { completedToday, xpToday, unfinished, focusToday } = useMemo(() => {
    const activity = D.activityByDay(s.tasks, s.plan, hour).get(todayIso) || new Set();
    const completedToday = s.tasks.filter((t) => activity.has(t.id));
    const entry = (s.plan || []).find((e) => e.date === todayIso);
    const byId = new Map(s.tasks.map((t) => [t.id, t]));
    const unfinished = (entry?.items || [])
      .filter((it) => !it.done)
      .map((it) => byId.get(it.taskId))
      .filter((t) => t && !t.completed);
    return {
      completedToday,
      xpToday: D.todayXP(s.tasks, s.plan, hour),
      unfinished,
      focusToday: D.focusMsByDay(s.sessions || []).get(todayIso) || 0,
    };
  }, []);

  const screenEntry = s.screen[todayIso] || { xOpens: 0, ytOpens: 0, mobileHours: null };
  const lines = campfireLines({
    count: completedToday.length, xp: xpToday, focusMs: focusToday, unfinished: unfinished.length,
  });

  return (
    <div onClick={() => setUI({ endOfDayOpen: false })}
      className="kz-backdrop"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10004, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="kz-sheet kz-fade-in" style={{ width: "100%", maxWidth: 460 }}>
        <div className="kz-sheet-head">
          <span className="kz-tape"><Icon name="fire" size={10} /> The campfire</span>
          <div style={{ flex: 1 }} />
          <button className="kz-icon-btn" onClick={() => setUI({ endOfDayOpen: false })} aria-label="Close"><Icon name="close" size={12} /></button>
        </div>
        <div style={{ padding: "17px 21px 21px" }}>
          {/* the day, as three lines */}
          <div className="kz-statement" style={{ ...leafBg("campfire-" + todayIso), marginBottom: 18 }}>
            <div className="kz-label" style={{ marginBottom: 7 }}>The day, in three lines</div>
            <div className="kz-haiku" style={{ color: "var(--ink)", fontSize: 15 }}>{lines}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            <div className="kz-well" style={{ padding: "12px 14px", borderRadius: 2 }}>
              <div className="kz-label" style={{ marginBottom: 6 }}>Reached</div>
              <div className="kz-brush kz-num" style={{ fontSize: 22 }}>{completedToday.length}</div>
            </div>
            <div className="kz-well" style={{ padding: "12px 14px", borderRadius: 2 }}>
              <div className="kz-label" style={{ marginBottom: 6 }}>Resolve</div>
              <div className="kz-brush kz-num" style={{ fontSize: 22, color: "var(--sakura)" }}>{xpToday}</div>
            </div>
          </div>

          {completedToday.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div className="kz-label" style={{ marginBottom: 8 }}>Behind you</div>
              <div className="kz-scroll" style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
                {completedToday.map((t) => (
                  <div key={t.id} className="kz-well" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 9px", fontSize: 12.5 }}>
                    <span style={{ color: "var(--sakura)", display: "inline-flex" }}><Icon name="check" size={11} /></span>
                    <span style={{ flex: 1, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unfinished.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 10, flexWrap: "wrap" }}>
                <div className="kz-label">Still ahead · {unfinished.length}</div>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--fg-dim)", cursor: "pointer" }}>
                  <input type="checkbox" checked={rollForward} onChange={(e) => setRollForward(e.target.checked)} />
                  Carry to the next day the road is open
                </label>
              </div>
              <div className="kz-scroll" style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 110, overflowY: "auto" }}>
                {unfinished.map((t) => (
                  <div key={t.id} className="kz-well" style={{ fontSize: 12.5, color: "var(--fg-dim)", padding: "4px 9px", borderLeft: "3px solid var(--line-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <div className="kz-label" style={{ marginBottom: 8 }}>Time on the glass</div>
            {screenEntry.mobileHours != null ? (
              <div style={{ fontSize: 12.5, color: "var(--fg-dim)" }}>
                {screenEntry.mobileHours}h · {screenEntry.xOpens || 0} X · {screenEntry.ytOpens || 0} YT
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <input type="number" min="0" max="24" step="0.5" value={mobile} className="kz-field kz-field--mono"
                  onChange={(e) => setMobile(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && mobile) { patchScreenToday({ mobileHours: parseFloat(mobile) || 0 }); setMobile(""); } }}
                  placeholder="Hours (optional)" style={{ flex: 1 }} />
                <button className="kz-btn kz-btn--sm" disabled={!mobile}
                  onClick={() => { patchScreenToday({ mobileHours: parseFloat(mobile) || 0 }); setMobile(""); }}>Log</button>
              </div>
            )}
          </div>

          <button className="kz-go" style={{ width: "100%" }}
            onClick={() => closeDay({ rollForward: rollForward && unfinished.length > 0 })}>
            <Icon name="fire" size={13} /> Bank the fire
          </button>
          <div className="kz-label" style={{ marginTop: 11, textAlign: "center" }}>
            the wind drops at dusk. that was enough.
          </div>
        </div>
      </div>
    </div>
  );
}
