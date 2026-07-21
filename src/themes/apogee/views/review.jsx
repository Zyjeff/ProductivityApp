// views/review.jsx — POST-FLIGHT REPORT: week stats + GUIDANCE retro.
// Logic lifted from nightwatch review.jsx; presentation is Apogee.

import React, { useEffect, useMemo } from "react";
import { Icon, Meter, EmptyState } from "../components.jsx";
import { HourBars } from "../charts.jsx";
import * as D from "../../../core/domain.js";
import {
  useStore,
  setUI,
  closeReview,
  patchReview,
} from "../../../core/store.js";
import { generateReviewRetro } from "../../../core/enrich.js";

export function ReviewScreen() {
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

  // Narrow deps on purpose (nightwatch): only re-fire when week changes,
  // not when entry/stats churn mid-generation.
  useEffect(() => {
    if (stats.total > 0 && (!entry || (!entry.attempted && !entry.text))) {
      generateReviewRetro(week, stats);
    }
  }, [week]);

  const maxSplit = Math.max(1, ...stats.effortSplit.map((e) => e.hours));

  const hourRows = useMemo(
    () => stats.perDay.map((d) => ({ v: d.count })),
    [stats.perDay]
  );

  return (
    <div className="ap-screen" role="dialog" aria-label="POST-FLIGHT REPORT">
      <div className="ap-screen-head">
        <div className="ap-screen-head-title">POST-FLIGHT REPORT</div>
        <button
          type="button"
          className="ap-icon-btn"
          disabled={idx >= weeks.length - 1}
          style={{ opacity: idx >= weeks.length - 1 ? 0.3 : 1 }}
          onClick={() => setUI({ reviewWeek: weeks[idx + 1] })}
          title="Older week"
          aria-label="Older week"
        >
          <Icon name="chevron-l" size={13} />
        </button>
        <button
          type="button"
          className="ap-icon-btn"
          disabled={idx <= 0}
          style={{ opacity: idx <= 0 ? 0.3 : 1 }}
          onClick={() => setUI({ reviewWeek: weeks[idx - 1] })}
          title="Newer week"
          aria-label="Newer week"
        >
          <Icon name="chevron-r" size={13} />
        </button>
        <button
          type="button"
          className="ap-icon-btn"
          onClick={closeReview}
          aria-label="Close"
        >
          <Icon name="close" size={13} />
        </button>
      </div>

      <div className="ap-screen-body" style={{ maxWidth: 640, margin: "0 auto", width: "100%" }}>
        {/* Signal-red week banner */}
        <div
          className="ap-panel"
          style={{
            padding: "12px 16px 14px",
            marginBottom: 18,
            borderColor: "var(--signal)",
            background: "var(--signal-ground)",
          }}
        >
          <div className="ap-stencil ap-stencil--lit">THE WEEK</div>
          <div
            className="ap-display"
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--signal)",
              marginTop: 4,
            }}
          >
            {stats.label}
          </div>
        </div>

        {stats.total === 0 ? (
          <EmptyState
            title="static on the downlink"
            line="No completions or focus sessions this week."
            action={
              weeks.length > 1 && idx < weeks.length - 1 ? (
                <button
                  type="button"
                  className="ap-btn ap-btn--ghost ap-btn--sm"
                  onClick={() => setUI({ reviewWeek: weeks[idx + 1] })}
                >
                  <Icon name="chevron-l" size={12} /> jump older
                </button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="ap-tilewall" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 16 }}>
              {[
                { l: "Done", v: stats.total },
                { l: "XP", v: stats.xp },
                { l: "Focused", v: stats.focusMs ? D.fmtMs(stats.focusMs) : "—" },
                { l: "Launched", v: stats.launched.length || "—" },
              ].map((x) => (
                <div key={x.l} className="ap-tile">
                  <div className="ap-tile-label">{x.l}</div>
                  <div className="ap-tile-body ap-num" style={{ fontSize: 18, fontWeight: 600 }}>
                    {x.v}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 4 }}>
              <HourBars rows={hourRows} />
              <div
                className="ap-num"
                style={{
                  display: "flex",
                  gap: 0,
                  fontSize: 10,
                  color: "var(--fg-faint)",
                  marginTop: 4,
                  width: 140,
                  justifyContent: "space-between",
                }}
              >
                {stats.perDay.map((d, i) => (
                  <span key={d.iso || i} style={{ flex: 1, textAlign: "center" }}>
                    {d.label[0]}
                  </span>
                ))}
              </div>
            </div>

            <div
              className="ap-num"
              style={{
                display: "flex",
                gap: 14,
                fontSize: 10.5,
                color: "var(--fg-faint)",
                margin: "8px 0 16px",
                flexWrap: "wrap",
              }}
            >
              {stats.bestDay && (
                <span>
                  best: {stats.bestDay.label} ({stats.bestDay.count})
                </span>
              )}
              {stats.accuracy && (
                <span
                  style={{
                    color:
                      stats.accuracy.factor > 1.15
                        ? "var(--warn)"
                        : "var(--starboard)",
                  }}
                >
                  estimates ran {stats.accuracy.factor}× (n={stats.accuracy.n})
                </span>
              )}
              {stats.adriftNow > 0 && (
                <span style={{ color: "var(--warn)" }}>
                  {stats.adriftNow} adrift now
                </span>
              )}
            </div>

            {stats.launched.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="ap-stencil" style={{ marginBottom: 8 }}>
                  LAUNCHED
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {stats.launched.map((l) => (
                    <div
                      key={l.title}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        background: "var(--starboard-ground)",
                        boxShadow: "inset 3px 0 0 var(--starboard)",
                        fontSize: 12.5,
                        color: "var(--starboard)",
                      }}
                    >
                      <Icon name="launch" size={12} /> {l.title}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.effortSplit.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="ap-stencil" style={{ marginBottom: 8 }}>
                  EFFORT SPLIT
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {stats.effortSplit.map((e2) => (
                    <div
                      key={e2.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 11.5,
                      }}
                    >
                      <span
                        className="ap-truncate"
                        style={{
                          width: 130,
                          color: "var(--fg-dim)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {e2.title}
                      </span>
                      <div style={{ flex: 1 }}>
                        <Meter
                          pct={(e2.hours / maxSplit) * 100}
                          tone={e2.color}
                        />
                      </div>
                      <span
                        className="ap-num"
                        style={{
                          color: "var(--fg-faint)",
                          width: 42,
                          textAlign: "right",
                        }}
                      >
                        {e2.hours}h
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* GUIDANCE retro — stats above always render regardless of state */}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div className="ap-stencil">GUIDANCE</div>
                {entry?.text ? (
                  <button
                    type="button"
                    className="ap-icon-btn"
                    title="Rewrite"
                    onClick={() => {
                      patchReview(week, { text: null, attempted: false });
                      generateReviewRetro(week, stats);
                    }}
                  >
                    <Icon name="undo" size={11} />
                  </button>
                ) : null}
              </div>
              {entry?.text ? (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--fg)",
                    lineHeight: 1.65,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {entry.text}
                </div>
              ) : entry?.attempted && aiStatus !== "busy" ? (
                <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>
                  GUIDANCE OFFLINE — flying manual.{" "}
                  <button
                    type="button"
                    className="ap-btn ap-btn--ghost ap-btn--sm"
                    style={{ fontSize: 12, marginLeft: 4 }}
                    onClick={() => generateReviewRetro(week, stats)}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="ap-num" style={{ fontSize: 12, color: "var(--fg-faint)" }}>
                  compiling guidance…
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
