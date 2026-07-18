// endofday.jsx — Nachtsluiting: recap, roll-forward, screen log.
// Logic lifted from nightwatch/views/endofday.jsx — identical behavior
// to the core contract.

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

  const logMobile = () => {
    if (!mobile) return;
    patchScreenToday({ mobileHours: parseFloat(mobile) || 0 });
    setMobile("");
  };

  return (
    <div onClick={() => setUI({ endOfDayOpen: false })}
      className="s-backdrop" style={{ zIndex: 10004 }}>
      <div onClick={(e) => e.stopPropagation()} className="s-console" style={{ maxWidth: 480 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: "1px solid var(--line)" }}>
          <span className="s-stencil s-stencil--lit" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name="moon" size={11} /> Nachtsluiting
          </span>
          <div style={{ flex: 1 }} />
          <button className="s-icon-btn" onClick={() => setUI({ endOfDayOpen: false })} aria-label="Close">
            <Icon name="close" size={12} />
          </button>
        </div>
        <div className="s-console-body">
          <div className="s-display" style={{ fontSize: 23, marginBottom: 16 }}>
            {completedToday.length > 0 ? "Goed gevaren." : "Stil water vandaag."}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            <div className="s-gauge-tile">
              <div className="s-stencil" style={{ marginBottom: 6 }}>Geschut</div>
              <div className="s-num" style={{ fontSize: 22, fontWeight: 700 }}>{completedToday.length}</div>
            </div>
            <div className="s-gauge-tile">
              <div className="s-stencil" style={{ marginBottom: 6 }}>XP verdiend</div>
              <div className="s-num" style={{ fontSize: 22, fontWeight: 700, color: "var(--amber-hot)" }}>{xpToday}</div>
            </div>
          </div>

          {completedToday.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div className="s-stencil" style={{ marginBottom: 8 }}>In het vaartregister</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
                {completedToday.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "var(--well)", borderRadius: "var(--r-sm)", fontSize: 12.5 }}>
                    <Icon name="check" size={11} />
                    <span style={{ flex: 1, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unfinished.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                <div className="s-stencil">Nog in de kolk · {unfinished.length}</div>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--fg-dim)", cursor: "pointer" }}>
                  <input type="checkbox" checked={rollForward} onChange={(e) => setRollForward(e.target.checked)}
                    style={{ accentColor: "var(--water)" }} />
                  Sleep naar de eerstvolgende vaardag
                </label>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 110, overflowY: "auto" }}>
                {unfinished.map((t) => (
                  <div key={t.id} style={{ fontSize: 12.5, color: "var(--fg-dim)", padding: "4px 8px", borderLeft: "3px solid var(--line-strong)", background: "var(--well)", borderRadius: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <div className="s-stencil" style={{ marginBottom: 8 }}>Schermtijd</div>
            {screenEntry.mobileHours != null ? (
              <div style={{ fontSize: 12.5, color: "var(--fg-dim)" }}>
                {screenEntry.mobileHours}h mobiel · {screenEntry.xOpens || 0} X · {screenEntry.ytOpens || 0} YT
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <input type="number" min="0" max="24" step="0.5" value={mobile} className="s-field s-num"
                  onChange={(e) => setMobile(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") logMobile(); }}
                  placeholder="Mobiele uren (optioneel)" style={{ flex: 1 }} />
                <button className="s-btn s-btn--sm" disabled={!mobile} onClick={logMobile}>Log</button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="s-btn s-btn--amber" style={{ flex: 1 }}
              onClick={() => closeDay({ rollForward: rollForward && unfinished.length > 0 })}>
              <Icon name="moon" size={13} /> Sluit de sluis
            </button>
            <button className="s-btn s-btn--ghost" onClick={() => setUI({ endOfDayOpen: false })}>
              Nog niet
            </button>
          </div>
          <div className="s-num" style={{ fontSize: 9.5, color: "var(--fg-faint)", marginTop: 10, textAlign: "center", letterSpacing: "0.08em" }}>
            DE DEUREN ZIJN DICHT.
          </div>
        </div>
      </div>
    </div>
  );
}
