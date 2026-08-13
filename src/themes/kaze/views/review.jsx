// review.jsx — The Hot Spring. Steam-softened frame, reflective copy.
// Stats always render; the retro is written once per week and cached.
// Behaviour is the core contract exactly.

import React, { useEffect, useMemo } from "react";
import { Icon, Eyebrow, Kbd, Seal } from "../components.jsx";
import { DayBars } from "../charts.jsx";
import { leafBg } from "../texture.js";
import * as D from "../../../core/domain.js";
import { useStore, setUI, closeReview, patchReview } from "../../../core/store.js";
import { generateReviewRetro } from "../../../core/enrich.js";

export function HotSpring() {
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
    <div onClick={closeReview} className="kz-backdrop"
      style={{ zIndex: 10002, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px 16px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} className="kz-sheet kz-fade-in" style={{ width: "100%", maxWidth: 640 }}>
        <div className="kz-sheet-head">
          <span className="kz-tape"><Icon name="spring" size={10} /> The hot spring</span>
          <div style={{ flex: 1 }} />
          <button className="kz-icon-btn" disabled={idx >= weeks.length - 1} style={{ opacity: idx >= weeks.length - 1 ? 0.3 : 1 }}
            onClick={() => setUI({ reviewWeek: weeks[idx + 1] })} title="Further back" aria-label="Older week">
            <Icon name="chevronL" size={13} />
          </button>
          <button className="kz-icon-btn" disabled={idx <= 0} style={{ opacity: idx <= 0 ? 0.3 : 1 }}
            onClick={() => setUI({ reviewWeek: weeks[idx - 1] })} title="Nearer" aria-label="Newer week">
            <Icon name="chevronR" size={13} />
          </button>
          <button className="kz-icon-btn" onClick={closeReview} aria-label="Close"><Icon name="close" size={13} /></button>
        </div>
        <div style={{ padding: "19px 23px 23px" }}>
          <div className="kz-statement" style={{ ...leafBg("kz-week-" + week), padding: "11px 17px 13px", marginBottom: 18 }}>
            <div className="kz-label">The road behind</div>
            <div className="kz-brush" style={{ fontSize: 22 }}>{stats.label}</div>
          </div>

          {stats.total === 0 ? (
            <div style={{ padding: "28px 0", textAlign: "center", color: "var(--fg-faint)", fontSize: 13 }}>
              <div className="kz-haiku" style={{ marginBottom: 14 }}>{"Still water, no steps —\nnothing reached, nothing walked here.\nThe week passed quietly."}</div>
              {weeks.length > 1 && idx < weeks.length - 1 && (
                <button className="kz-btn kz-btn--sm" onClick={() => setUI({ reviewWeek: weeks[idx + 1] })}>← Further back</button>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 17 }}>
                {[
                  { l: "Reached", v: stats.total },
                  { l: "Resolve", v: stats.xp },
                  { l: "Walked", v: stats.focusMs ? D.fmtMs(stats.focusMs) : "—" },
                  { l: "Arrived", v: stats.launched.length || "—" },
                ].map((x) => (
                  <div key={x.l} className="kz-well" style={{ padding: "10px 12px", borderRadius: 2 }}>
                    <div className="kz-label" style={{ marginBottom: 4 }}>{x.l}</div>
                    <div className="kz-brush kz-num" style={{ fontSize: 18 }}>{x.v}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 4 }}>
                <DayBars data={stats.perDay.map((d) => ({
                  label: d.label[0],
                  value: d.count,
                  title: `${d.iso}: ${d.count} reached · ${d.xp} resolve${d.focusMs ? " · " + D.fmtMs(d.focusMs) : ""}`,
                  isToday: stats.bestDay ? d.iso === stats.bestDay.iso : false,
                }))} />
              </div>
              <div className="kz-label" style={{ display: "flex", gap: 14, margin: "10px 0 17px", flexWrap: "wrap" }}>
                {stats.bestDay && <span>strongest: {stats.bestDay.label} ({stats.bestDay.count})</span>}
                {stats.accuracy && <span style={{ color: stats.accuracy.factor > 1.15 ? "var(--warn)" : "var(--sakura)" }}>the road ran {stats.accuracy.factor}× your guess (n={stats.accuracy.n})</span>}
                {stats.adriftNow > 0 && <span style={{ color: "var(--warn)" }}>{stats.adriftNow} weathered now</span>}
              </div>

              {stats.launched.length > 0 && (
                <div style={{ marginBottom: 17 }}>
                  <Eyebrow>Places reached</Eyebrow>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {stats.launched.map((l) => (
                      <div key={l.title} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 11px", background: "var(--sakura-ground)", borderLeft: "3px solid var(--sakura)", fontSize: 12.5, color: "var(--sakura)" }}>
                        <Icon name="petal" size={12} /> {l.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.effortSplit.length > 0 && (
                <div style={{ marginBottom: 17 }}>
                  <Eyebrow>Where the hours went</Eyebrow>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {stats.effortSplit.map((e2) => (
                      <div key={e2.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                        <span style={{ width: 128, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e2.title}</span>
                        <div className="kz-meter" style={{ flex: 1 }}>
                          <div className="kz-meter-fill" style={{ width: (e2.hours / maxSplit) * 100 + "%", backgroundColor: e2.color }} />
                        </div>
                        <span className="kz-num" style={{ color: "var(--fg-faint)", width: 42, textAlign: "right" }}>{e2.hours}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ borderTop: "1px solid var(--line-dim)", paddingTop: 15 }}>
                <Eyebrow right={entry?.text ? (
                  <button className="kz-icon-btn" title="Think it through again"
                    onClick={() => { patchReview(week, { text: null, attempted: false }); generateReviewRetro(week, stats); }}>
                    <Icon name="reset" size={11} />
                  </button>
                ) : null}>What the water says</Eyebrow>
                {entry?.text ? (
                  <div style={{ fontSize: 13, color: "var(--fg)", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{entry.text}</div>
                ) : entry?.attempted && aiStatus !== "busy" ? (
                  <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>
                    The oracle is silent — the numbers above stand on their own.{" "}
                    <button className="kz-link" onClick={() => generateReviewRetro(week, stats)}>Ask again</button>
                  </div>
                ) : (
                  <div className="kz-label">the water is still settling…</div>
                )}
              </div>
            </>
          )}
          <div style={{ marginTop: 17, textAlign: "right" }}>
            <Kbd>Esc</Kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
