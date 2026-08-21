// views/review.jsx — Sunday tea (DESIGN.md §5.6).
// Logic lifted from nightwatch/views/review.jsx (generate-once, cache,
// Rewrite, honest away-state, stats always render). Composition is a
// full-page tatami pinwheel — not a uniform grid, not a console card.

import React, { useEffect, useMemo } from "react";
import { Icon, Eyebrow, Kbd, Meter, Hanko } from "../components.jsx";
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
  const quiet = stats.total === 0;
  const dayBars = stats.perDay.map((d) => ({
    iso: d.iso,
    label: d.label[0],
    value: d.count,
    isBest: !!(stats.bestDay && d.iso === stats.bestDay.iso),
    title: `${d.iso}: ${d.count} done · ${d.xp} XP${d.focusMs ? " · " + D.fmtMs(d.focusMs) : ""}`,
  }));
  const barTop = Math.max(1, ...dayBars.map((d) => d.value));

  return (
    <div
      className="yz-overlay yzp-tea-page fade-in"
      role="dialog"
      aria-label="Sunday tea"
      onClick={closeReview}
    >
      <div className="yzp-tea" onClick={(e) => e.stopPropagation()}>
        <div className="yzp-tea-bar">
          <span className="yz-sec yz-sec--dusk">Sunday tea</span>
          <span className="yzp-tea-esc"><Kbd>Esc</Kbd></span>
          <button type="button" className="yz-icon-btn" onClick={closeReview} aria-label="Close">
            <Icon name="close" size={14} />
          </button>
        </div>

        <div className={"yzp-tatami" + (quiet ? " yzp-tatami--quiet" : "")}>
          <div
            className="yzp-mat yzp-mat--statement"
          >
            <h2 className="yz-sec">The week</h2>
            <div className="yzp-mat-banner">
              <h2 className="yz-display yzp-week-label">{stats.label}</h2>
              <div className="yzp-week-nav">
                <button
                  type="button"
                  className="yz-icon-btn"
                  disabled={idx >= weeks.length - 1}
                  style={{ opacity: idx >= weeks.length - 1 ? 0.3 : 1 }}
                  onClick={() => setUI({ reviewWeek: weeks[idx + 1] })}
                  title="Older week"
                  aria-label="Older week"
                >
                  <Icon name="chevronL" size={14} />
                </button>
                <button
                  type="button"
                  className="yz-icon-btn"
                  disabled={idx <= 0}
                  style={{ opacity: idx <= 0 ? 0.3 : 1 }}
                  onClick={() => setUI({ reviewWeek: weeks[idx - 1] })}
                  title="Newer week"
                  aria-label="Newer week"
                >
                  <Icon name="chevronR" size={14} />
                </button>
              </div>
            </div>
          </div>

          {quiet ? (
            <div className="yzp-mat yzp-mat--quiet">
              <Icon name="teacup" size={22} />
              <div className="yz-display" style={{ fontSize: 22, margin: "8px 0 6px" }}>a quiet week</div>
              <p>Nothing logged — no completions, no focus sessions.</p>
              {weeks.length > 1 && idx < weeks.length - 1 && (
                <button type="button" className="yz-btn yz-btn--sm" onClick={() => setUI({ reviewWeek: weeks[idx + 1] })}>
                  Older week
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="yzp-mat yzp-mat--tiles">
                {[
                  { l: "Done", v: stats.total },
                  { l: "XP", v: stats.xp },
                  { l: "Focus", v: stats.focusMs ? D.fmtMs(stats.focusMs) : "—" },
                  { l: "Seals", v: stats.launched.length || "—" },
                ].map((x) => (
                  <div key={x.l} className="yzp-tile">
                    <span className="yz-label yz-label--sumi">{x.l}</span>
                    <span className="yz-display yz-num yzp-tile-v">{x.v}</span>
                  </div>
                ))}
              </div>

              <div className="yzp-mat yzp-mat--days">
                <Eyebrow sumi>Ink of the week</Eyebrow>
                <div className="yzp-inkdays">
                  {dayBars.map((d) => (
                    <div key={d.iso} className={"yzp-inkday" + (d.isBest ? " yzp-inkday--best" : "")} title={d.title}>
                      <div className="yzp-inkday-well">
                        <i style={{ height: (d.value / barTop) * 100 + "%" }} />
                      </div>
                      <span>{d.label}</span>
                    </div>
                  ))}
                </div>
                <div className="yzp-inkdays-meta">
                  {stats.bestDay && <span>best: {stats.bestDay.label} ({stats.bestDay.count})</span>}
                </div>
              </div>

              <div className="yzp-mat yzp-mat--accuracy">
                <Eyebrow sumi>Estimates</Eyebrow>
                {stats.accuracy ? (
                  <div>
                    <div
                      className="yz-display yzp-acc-n"
                      style={{ color: stats.accuracy.factor > 1.15 ? "var(--amber-deep)" : "var(--starboard)" }}
                    >
                      {stats.accuracy.factor}×
                    </div>
                    <div className="yzp-mat-note">
                      {stats.accuracy.factor > 1.15 ? "ran long" : "held"} · n={stats.accuracy.n}
                    </div>
                  </div>
                ) : (
                  <div className="yzp-mat-note">not enough logged focus yet</div>
                )}
                <div className={"yzp-fallen-now" + (stats.adriftNow > 0 ? " yzp-fallen-now--on" : "")}>
                  <Icon name="leaf" size={12} />
                  {stats.adriftNow > 0
                    ? `${stats.adriftNow} fallen ${stats.adriftNow === 1 ? "leaf" : "leaves"} now`
                    : "no fallen leaves now"}
                </div>
              </div>

              <div className="yzp-mat yzp-mat--sealed">
                <Eyebrow sumi>Sealed lists</Eyebrow>
                {stats.launched.length > 0 ? (
                  <div className="yzp-sealed-list">
                    {stats.launched.map((l) => (
                      <div key={l.title} className="yzp-sealed-row">
                        <Hanko style={{ minWidth: 28, height: 28, fontSize: 9 }}>印</Hanko>
                        <span>{l.title}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="yzp-mat-note">none sealed this week</div>
                )}
              </div>

              <div className="yzp-mat yzp-mat--effort">
                <Eyebrow sumi>Hours by list</Eyebrow>
                {stats.effortSplit.length > 0 ? (
                  <div className="yzp-effort">
                    {stats.effortSplit.map((e2) => (
                      <div key={e2.id} className="yzp-effort-row">
                        <span className="yzp-effort-name">{e2.title}</span>
                        <Meter pct={(e2.hours / maxSplit) * 100} tone={e2.color} height={5} />
                        <span className="yz-num yzp-effort-h">{e2.hours}h</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="yzp-mat-note">no hours to split</div>
                )}
              </div>

              <div className="yzp-mat yzp-mat--retro">
                <Eyebrow sumi right={entry?.text ? (
                  <button
                    type="button"
                    className="yz-icon-btn"
                    title="Rewrite"
                    onClick={() => { patchReview(week, { text: null, attempted: false }); generateReviewRetro(week, stats); }}
                  >
                    <Icon name="reset" size={11} />
                  </button>
                ) : null}>
                  The Attendant
                </Eyebrow>
                {entry?.text ? (
                  <div className="yzp-retro-text">{entry.text}</div>
                ) : entry?.attempted && aiStatus !== "busy" ? (
                  <div className="yzp-mat-note">
                    The Attendant is away — the house runs itself.{" "}
                    <button type="button" className="yz-link" onClick={() => generateReviewRetro(week, stats)}>Retry</button>
                  </div>
                ) : (
                  <div className="yzp-mat-note">the Attendant is writing…</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
