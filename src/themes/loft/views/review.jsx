// review.jsx — the weekly survey. Figures always render; the written
// survey is drafted once per week and cached. Identical behavior to
// the core contract.

import React, { useEffect, useMemo } from "react";
import { Icon, Eyebrow, Kbd } from "../components.jsx";
import { WeekBars } from "../charts.jsx";
import { blueprintBg } from "../texture.js";
import * as D from "../../../core/domain.js";
import { useStore, getState, setUI, closeReview, patchReview } from "../../../core/store.js";
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

  return (
    <div onClick={closeReview} className="lf-backdrop" style={{ zIndex: 10002, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px 16px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} className="lf-console lf-fade" style={{ width: "100%", maxWidth: 640 }}>
        <div className="lf-console-head">
          <span className="w-stencil w-stencil--lit">Weekly survey</span>
          <div style={{ flex: 1 }} />
          <button className="lf-icon-btn" disabled={idx >= weeks.length - 1} style={{ opacity: idx >= weeks.length - 1 ? 0.3 : 1 }}
            onClick={() => setUI({ reviewWeek: weeks[idx + 1] })} title="Older week" aria-label="Older week">
            <Icon name="chevron" size={13} />
          </button>
          <button className="lf-icon-btn" disabled={idx <= 0} style={{ opacity: idx <= 0 ? 0.3 : 1 }}
            onClick={() => setUI({ reviewWeek: weeks[idx - 1] })} title="Newer week" aria-label="Newer week">
            <Icon name="chevronR" size={13} />
          </button>
          <button className="lf-icon-btn" onClick={closeReview} aria-label="Close"><Icon name="close" size={13} /></button>
        </div>
        <div style={{ padding: "18px 22px 22px" }}>
          <div className="lf-statement" style={{ ...blueprintBg("lf-week-" + week), padding: "10px 16px 12px", marginBottom: 18 }}>
            <div className="w-stencil">The week surveyed</div>
            <div className="w-display" style={{ fontSize: 23 }}>{stats.label}</div>
          </div>

          {stats.total === 0 ? (
            <div style={{ padding: "28px 0", textAlign: "center", color: "var(--fg-faint)", fontSize: 13 }}>
              Nothing on record this week — no completions, no light-table sessions.
              {weeks.length > 1 && idx < weeks.length - 1 && (
                <div style={{ marginTop: 10 }}>
                  <button className="lf-bezel lf-bezel--sm" onClick={() => setUI({ reviewWeek: weeks[idx + 1] })}>← Older week</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                {[
                  { l: "Inked", v: stats.total },
                  { l: "XP", v: stats.xp },
                  { l: "Focused", v: stats.focusMs ? D.fmtMs(stats.focusMs) : "—" },
                  { l: "As-built", v: stats.launched.length || "—" },
                ].map((x) => (
                  <div key={x.l} style={{ background: "var(--well)", boxShadow: "inset 0 1px 2px rgba(33,28,18,0.14)", padding: "10px 12px" }}>
                    <div className="w-stencil" style={{ fontSize: 8.5, marginBottom: 4 }}>{x.l}</div>
                    <div className="w-display w-num" style={{ fontSize: 18, fontWeight: 600 }}>{x.v}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 4 }}>
                <WeekBars data={stats.perDay.map((d) => ({
                  label: d.label[0],
                  value: d.count,
                  title: `${d.iso}: ${d.count} done · ${d.xp} XP${d.focusMs ? " · " + D.fmtMs(d.focusMs) : ""}`,
                  isToday: stats.bestDay ? d.iso === stats.bestDay.iso : false,
                }))} />
              </div>
              <div className="w-num" style={{ display: "flex", gap: 14, fontSize: 10.5, color: "var(--fg-faint)", margin: "8px 0 16px", flexWrap: "wrap" }}>
                {stats.bestDay && <span>best: {stats.bestDay.label} ({stats.bestDay.count})</span>}
                {stats.accuracy && <span style={{ color: stats.accuracy.factor > 1.15 ? "var(--warn)" : "var(--starboard)" }}>estimates ran {stats.accuracy.factor}× (n={stats.accuracy.n})</span>}
                {stats.adriftNow > 0 && <span style={{ color: "var(--port)" }}>{stats.adriftNow} off datum now</span>}
              </div>

              {stats.launched.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <Eyebrow>Sent to the yard</Eyebrow>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {stats.launched.map((l) => (
                      <div key={l.title} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--starboard-ground)", boxShadow: "inset 3px 0 0 var(--starboard)", fontSize: 12.5, color: "var(--starboard)" }}>
                        <Icon name="ship" size={12} /> {l.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.effortSplit.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <Eyebrow>Where the hours went</Eyebrow>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {stats.effortSplit.map((e2) => (
                      <div key={e2.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                        <span style={{ width: 130, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e2.title}</span>
                        <div className="lf-meter" style={{ flex: 1, height: 5 }}>
                          <div className="lf-fill" style={{ width: (e2.hours / maxSplit) * 100 + "%", backgroundColor: e2.color }} />
                        </div>
                        <span className="w-num" style={{ color: "var(--fg-faint)", width: 42, textAlign: "right" }}>{e2.hours}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ borderTop: "1px solid var(--line-dim)", paddingTop: 14 }}>
                <Eyebrow right={entry?.text ? (
                  <button className="lf-icon-btn" title="Redraft the survey"
                    onClick={() => { patchReview(week, { text: null, attempted: false }); generateReviewRetro(week, stats); }}>
                    <Icon name="reset" size={11} />
                  </button>
                ) : null}>The surveyor's notes</Eyebrow>
                {entry?.text ? (
                  <div style={{ fontSize: 13, color: "var(--fg)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{entry.text}</div>
                ) : entry?.attempted && aiStatus !== "busy" ? (
                  <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>
                    AI is off — the figures above stand on their own.{" "}
                    <button className="lf-link" style={{ fontSize: 12 }} onClick={() => generateReviewRetro(week, stats)}>Retry</button>
                  </div>
                ) : (
                  <div className="w-num" style={{ fontSize: 12, color: "var(--fg-faint)" }}>writing the survey…</div>
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
