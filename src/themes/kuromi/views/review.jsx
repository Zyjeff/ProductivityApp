// review.jsx — THE REWIND: the week, judged. Stats always render;
// the imp's verdict is written once per week and cached.

import React, { useEffect, useMemo } from "react";
import { Icon, Kbd, Meter } from "../components.jsx";
import { WeekBars } from "../charts.jsx";
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

  return (
    <div className="k-backdrop" style={{ zIndex: 82 }} onMouseDown={(e) => e.target === e.currentTarget && closeReview()}>
      <div className="k-console is-wide" style={{ maxWidth: 660 }}>
        <div className="k-console-head">
          <span className="k-display">THE REWIND</span>
          <button className="k-x" disabled={idx >= weeks.length - 1} style={{ opacity: idx >= weeks.length - 1 ? 0.3 : 1 }}
            onClick={() => setUI({ reviewWeek: weeks[idx + 1] })} title="Older week" aria-label="Older week">
            ◂
          </button>
          <button className="k-x" disabled={idx <= 0} style={{ opacity: idx <= 0 ? 0.3 : 1 }}
            onClick={() => setUI({ reviewWeek: weeks[idx - 1] })} title="Newer week" aria-label="Newer week">
            ▸
          </button>
          <button className="k-x" onClick={closeReview} aria-label="Close"><Icon name="x" size={10} /></button>
        </div>
        <div className="k-console-body">
          <div className="k-statement k-mb" style={{ ...statementBg("kuromi-week-" + week), padding: "12px 16px 14px" }}>
            <div className="k-display" style={{ fontSize: 8, marginBottom: 6 }}>THE WEEK IN CRIMES</div>
            <div className="k-display" style={{ fontSize: 16 }}>{stats.label}</div>
          </div>

          {stats.total === 0 ? (
            <div style={{ padding: "26px 0", textAlign: "center" }} className="k-faint">
              A suspiciously clean week — nothing logged, no schemes, no mischief mode.
              {weeks.length > 1 && idx < weeks.length - 1 && (
                <div style={{ marginTop: 10 }}>
                  <button className="k-btn is-sm" onClick={() => setUI({ reviewWeek: weeks[idx + 1] })}>◂ OLDER WEEK</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="k-tiles k-mb" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                {[
                  { l: "Pulled off", v: stats.total },
                  { l: "Chaos", v: stats.xp + " XP" },
                  { l: "Mischief mode", v: stats.focusMs ? D.fmtMs(stats.focusMs) : "—" },
                  { l: "Bosses beaten", v: stats.launched.length || "—" },
                ].map((x) => (
                  <div key={x.l} className="k-tile">
                    <div className="k-lab">{x.l}</div>
                    <div className="k-val" style={{ fontSize: 12 }}>{x.v}</div>
                  </div>
                ))}
              </div>

              <div className="k-mb">
                <WeekBars
                  days={stats.perDay.map((d) => ({
                    label: d.label[0],
                    value: d.count,
                    title: `${d.iso}: ${d.count} pulled off · ${d.xp} XP${d.focusMs ? " · " + D.fmtMs(d.focusMs) : ""}`,
                    isToday: stats.bestDay ? d.iso === stats.bestDay.iso : false,
                  }))}
                  height={72}
                />
              </div>
              <div className="k-rowline k-mono-sm k-faint k-mb" style={{ gap: 14, flexWrap: "wrap" }}>
                {stats.bestDay && <span>best day: {stats.bestDay.label} ({stats.bestDay.count})</span>}
                {stats.accuracy && <span className={stats.accuracy.factor > 1.15 ? "k-warn" : "k-green"}>guesses ran {stats.accuracy.factor}× (n={stats.accuracy.n})</span>}
                {stats.adriftNow > 0 && <span className="k-warn">{stats.adriftNow} busted now</span>}
              </div>

              {stats.launched.length > 0 && (
                <div className="k-mb">
                  <div className="k-eyebrow is-green">BEATEN THIS WEEK</div>
                  {stats.launched.map((l) => (
                    <div key={l.title} className="k-rowline k-sm" style={{ padding: "6px 10px", background: "var(--starboard-ground)", borderRadius: 6, boxShadow: "inset 3px 0 0 var(--starboard)", color: "var(--starboard)", marginBottom: 4 }}>
                      <Icon name="star" size={11} /> {l.title}
                    </div>
                  ))}
                </div>
              )}

              {stats.effortSplit.length > 0 && (
                <div className="k-mb">
                  <div className="k-eyebrow">WHERE THE HOURS WENT</div>
                  {stats.effortSplit.map((e2) => (
                    <div key={e2.id} className="k-rowline k-sm" style={{ marginBottom: 6 }}>
                      <span className="k-dim" style={{ width: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e2.title}</span>
                      <div className="k-meter" style={{ flex: 1, height: 7 }}>
                        <div className="k-meter-fill" style={{ width: (e2.hours / maxSplit) * 100 + "%", background: e2.color }} />
                      </div>
                      <span className="k-mono-sm k-faint" style={{ width: 42, textAlign: "right" }}>{e2.hours}h</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ borderTop: "2px solid var(--line)", paddingTop: 14 }}>
                <div className="k-rowline">
                  <span className="k-eyebrow is-violet" style={{ marginBottom: 0, flex: 1 }}>THE VERDICT</span>
                  {entry?.text && (
                    <button className="k-mini-btn" title="Let the imp re-judge"
                      onClick={() => { patchReview(week, { text: null, attempted: false }); generateReviewRetro(week, stats); }}>
                      <Icon name="rewind" size={10} />
                    </button>
                  )}
                </div>
                <div className="k-mt">
                  {entry?.text ? (
                    <div style={{ fontSize: 13.5, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{entry.text}</div>
                  ) : entry?.attempted && aiStatus !== "busy" ? (
                    <div className="k-faint k-sm">
                      The imp is out — the numbers above convict you on their own.{" "}
                      <button className="k-btn is-sm is-ghost" onClick={() => generateReviewRetro(week, stats)}>poke it</button>
                    </div>
                  ) : (
                    <div className="k-mono-sm k-faint">the imp is deliberating…</div>
                  )}
                </div>
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
