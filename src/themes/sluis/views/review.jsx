// review.jsx — de Weekschouw: the weekly review console. Stats always
// render; the AI retro is written once per week and cached. Logic lifted
// from nightwatch/views/review.jsx — identical behavior to the core
// contract.

import React, { useEffect, useMemo } from "react";
import { Icon, Eyebrow, Kbd, Meter } from "../components.jsx";
import { statementBg } from "../texture.js";
import * as D from "../../../core/domain.js";
import { useStore, setUI, closeReview, patchReview } from "../../../core/store.js";
import { generateReviewRetro } from "../../../core/enrich.js";

export function ReviewOverlay() {
  const week = useStore((s) => s.ui.reviewWeek);
  if (!week) return null;
  return <Inner key={week} week={week} />;
}

function Inner({ week }) {
  const tasks = useStore((s) => s.tasks);
  const plan = useStore((s) => s.plan);
  const projects = useStore((s) => s.projects);
  const sessions = useStore((s) => s.sessions);
  const reviews = useStore((s) => s.reviews);
  const aiStatus = useStore((s) => s.ui.aiStatus);
  const meta = useStore((s) => s.meta);
  const hour = meta.dayStartHour || 0;

  const stats = useMemo(
    () => D.weeklyReviewData(tasks, plan, projects, sessions, week, hour),
    [tasks, plan, projects, sessions, week, hour]
  );
  const weeks = useMemo(() => {
    const all = D.reviewableWeeks(tasks, plan, hour);
    return all.includes(week) ? all : [week, ...all].sort().reverse();
  }, [tasks, plan, hour, week]);
  const idx = weeks.indexOf(week);
  const entry = reviews?.[week] || null;

  useEffect(() => {
    if (stats.total > 0 && (!entry || (!entry.attempted && !entry.text))) {
      generateReviewRetro(week, stats);
    }
  }, [week]);

  const maxSplit = Math.max(1, ...stats.effortSplit.map((e) => e.hours));
  const maxDay = Math.max(1, ...stats.perDay.map((d) => d.count));

  return (
    <div onClick={closeReview} className="s-backdrop" style={{ zIndex: 10002 }}>
      <div onClick={(e) => e.stopPropagation()} className="s-console">
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 18px", borderBottom: "1px solid var(--line)" }}>
          <span className="s-stencil s-stencil--lit" style={{ marginRight: 6 }}>Weekschouw</span>
          <div style={{ flex: 1 }} />
          <button className="s-icon-btn" disabled={idx >= weeks.length - 1} style={{ opacity: idx >= weeks.length - 1 ? 0.3 : 1 }}
            onClick={() => setUI({ reviewWeek: weeks[idx + 1] })} title="Oudere week" aria-label="Oudere week">
            <Icon name="chevron" size={13} />
          </button>
          <button className="s-icon-btn" disabled={idx <= 0} style={{ opacity: idx <= 0 ? 0.3 : 1 }}
            onClick={() => setUI({ reviewWeek: weeks[idx - 1] })} title="Nieuwere week" aria-label="Nieuwere week">
            <Icon name="chevronR" size={13} />
          </button>
          <button className="s-icon-btn" onClick={closeReview} aria-label="Close"><Icon name="close" size={13} /></button>
        </div>
        <div className="s-console-body">
          <div style={{ ...statementBg("sluis-week-" + week), color: "var(--ink)", borderRadius: "var(--r-md)", padding: "10px 16px 12px", marginBottom: 18 }}>
            <div className="s-stencil" style={{ color: "rgba(16,34,43,.65)" }}>De week</div>
            <div className="s-display" style={{ fontSize: 23 }}>{stats.label}</div>
          </div>

          {stats.total === 0 ? (
            <div style={{ padding: "28px 0", textAlign: "center", color: "var(--fg-faint)", fontSize: 13 }}>
              Niets gelogd deze week — geen schuttingen, geen focussessies.
              {weeks.length > 1 && idx < weeks.length - 1 && (
                <div style={{ marginTop: 10 }}>
                  <button className="s-btn s-btn--sm s-btn--ghost" onClick={() => setUI({ reviewWeek: weeks[idx + 1] })}>← Oudere week</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="s-gaugewall" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                {[
                  { l: "Geschut", v: stats.total },
                  { l: "XP", v: stats.xp },
                  { l: "Gefocust", v: stats.focusMs ? D.fmtMs(stats.focusMs) : "—" },
                  { l: "Te water", v: stats.launched.length || "—" },
                ].map((x) => (
                  <div key={x.l} className="s-gauge-tile" style={{ padding: "10px 12px" }}>
                    <div className="s-stencil" style={{ fontSize: 8.5, marginBottom: 4 }}>{x.l}</div>
                    <div className="s-gauge-val" style={{ fontSize: 18 }}>{x.v}</div>
                  </div>
                ))}
              </div>

              {/* De week in zeven schalen — per-day activity as a mini
                  cross-section of pounds; the best day wears amber. */}
              <div style={{ display: "flex", alignItems: "stretch", marginBottom: 4 }}>
                {stats.perDay.map((d, i) => {
                  const isBest = stats.bestDay ? d.iso === stats.bestDay.iso : false;
                  return (
                    <div key={d.iso} className="s-pound"
                      style={{
                        flex: "1 1 0", minWidth: 0, height: 64,
                        marginRight: i < 6 ? 7 : 0, cursor: "default",
                        borderColor: isBest ? "var(--amber)" : undefined,
                        boxShadow: isBest ? "0 0 0 3px var(--amber-ground)" : undefined,
                      }}
                      title={`${d.iso}: ${d.count} done · ${d.xp} XP${d.focusMs ? " · " + D.fmtMs(d.focusMs) : ""}`}>
                      <div className="s-pound-water" style={{ height: (d.count / maxDay) * 100 + "%" }} />
                      <div className="s-pound-label">{d.label[0]}</div>
                      {d.count > 0 && <div className="s-pound-cap">{d.count}</div>}
                    </div>
                  );
                })}
              </div>
              <div className="s-num" style={{ display: "flex", gap: 14, fontSize: 10.5, color: "var(--fg-faint)", margin: "8px 0 16px", flexWrap: "wrap" }}>
                {stats.bestDay && <span>best: {stats.bestDay.label} ({stats.bestDay.count})</span>}
                {stats.accuracy && <span style={{ color: stats.accuracy.factor > 1.15 ? "var(--warn)" : "var(--starboard)" }}>estimates ran {stats.accuracy.factor}× (n={stats.accuracy.n})</span>}
                {stats.adriftNow > 0 && <span style={{ color: "var(--warn)" }}>{stats.adriftNow} drijfwerk nu</span>}
              </div>

              {stats.launched.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <Eyebrow>Te water gelaten</Eyebrow>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {stats.launched.map((l) => (
                      <div key={l.title} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--starboard-ground)", borderLeft: "3px solid var(--starboard)", borderRadius: 4, fontSize: 12.5, color: "var(--starboard)" }}>
                        <Icon name="ship" size={12} /> {l.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.effortSplit.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <Eyebrow>Waar de uren bleven</Eyebrow>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {stats.effortSplit.map((e2) => (
                      <div key={e2.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                        <span style={{ width: 130, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e2.title}</span>
                        <div style={{ flex: 1 }}>
                          <Meter pct={(e2.hours / maxSplit) * 100} tone={e2.color} height={5} />
                        </div>
                        <span className="s-num" style={{ color: "var(--fg-faint)", width: 42, textAlign: "right" }}>{e2.hours}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                <Eyebrow right={entry?.text ? (
                  <button className="s-icon-btn" title="Herschrijf de retro"
                    onClick={() => { patchReview(week, { text: null, attempted: false }); generateReviewRetro(week, stats); }}>
                    <Icon name="reset" size={11} />
                  </button>
                ) : null}>De retro</Eyebrow>
                {entry?.text ? (
                  <div style={{ fontSize: 13, color: "var(--fg)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{entry.text}</div>
                ) : entry?.attempted && aiStatus !== "busy" ? (
                  <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>
                    AI staat uit — de cijfers hierboven staan op zichzelf.{" "}
                    <button style={{ color: "var(--water)", textDecoration: "underline", fontSize: 12 }} onClick={() => generateReviewRetro(week, stats)}>Retry</button>
                  </div>
                ) : (
                  <div className="s-num" style={{ fontSize: 12, color: "var(--fg-faint)" }}>de retro wordt geschreven…</div>
                )}
              </div>
            </>
          )}
          <div style={{ marginTop: 16, textAlign: "right" }}>
            <Kbd>Esc</Kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
