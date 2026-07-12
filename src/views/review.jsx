// review.jsx — the Weekly Review overlay (F2). Stats always render
// (derived live); the AI retro is written once per week and cached in
// the reviews slice — this is the app's browsable memory.

import React, { useEffect, useMemo } from "react";
import { Icon, Eyebrow, Kbd } from "../components.jsx";
import * as D from "../domain.js";
import { useStore, getState, setUI, closeReview, patchReview } from "../store.js";
import { generateReviewRetro } from "../enrich.js";

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

  const maxCount = Math.max(1, ...stats.perDay.map((d) => d.count));
  const maxSplit = Math.max(1, ...stats.effortSplit.map((e) => e.hours));

  return (
    <div onClick={closeReview} style={{ position: "fixed", inset: 0, zIndex: 10002, background: "rgba(6,8,12,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px 16px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} className="w-card w-fade-in" style={{ width: "100%", maxWidth: 640, padding: "22px 24px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span className="w-eyebrow" style={{ color: "var(--amber-strong)" }}>Weekly review</span>
          <div style={{ flex: 1 }} />
          <button className="w-icon-btn" disabled={idx >= weeks.length - 1} style={{ opacity: idx >= weeks.length - 1 ? 0.3 : 1 }}
            onClick={() => setUI({ reviewWeek: weeks[idx + 1] })} title="Older week" aria-label="Older week">
            <Icon name="chevron" size={13} />
          </button>
          <button className="w-icon-btn" disabled={idx <= 0} style={{ opacity: idx <= 0 ? 0.3 : 1 }}
            onClick={() => setUI({ reviewWeek: weeks[idx - 1] })} title="Newer week" aria-label="Newer week">
            <Icon name="chevronR" size={13} />
          </button>
          <button className="w-icon-btn" onClick={closeReview} aria-label="Close"><Icon name="close" size={13} /></button>
        </div>
        <div className="w-display" style={{ fontSize: 22, fontWeight: 600, marginBottom: 16 }}>{stats.label}</div>

        {stats.total === 0 ? (
          <div style={{ padding: "28px 0", textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>
            Nothing logged this week — no completions, no focus sessions.
            {weeks.length > 1 && idx < weeks.length - 1 && (
              <div style={{ marginTop: 10 }}>
                <button className="w-btn w-btn--ghost w-btn--sm" onClick={() => setUI({ reviewWeek: weeks[idx + 1] })}>← Older week</button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
              {[
                { l: "Done", v: stats.total },
                { l: "XP", v: stats.xp },
                { l: "Focused", v: stats.focusMs ? D.fmtMs(stats.focusMs) : "—" },
                { l: "Launched", v: stats.launched.length || "—" },
              ].map((x) => (
                <div key={x.l} style={{ background: "var(--bg-soft)", borderRadius: "var(--r-md)", padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 4 }}>{x.l}</div>
                  <div className="w-display" style={{ fontSize: 18, fontWeight: 600 }}>{x.v}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 5, alignItems: "flex-end", height: 64, marginBottom: 4 }}>
              {stats.perDay.map((d) => (
                <div key={d.iso} title={`${d.iso}: ${d.count} done · ${d.xp} XP${d.focusMs ? " · " + D.fmtMs(d.focusMs) : ""}`}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-faint)", minHeight: 12 }}>{d.count || ""}</div>
                  <div style={{ width: "100%", height: 40, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <div style={{
                      width: "100%", height: d.count ? Math.max(4, Math.round((d.count / maxCount) * 38)) : 2,
                      background: stats.bestDay && d.iso === stats.bestDay.iso ? "var(--amber)" : d.count ? "var(--border-strong)" : "var(--border)",
                      borderRadius: "2px 2px 0 0",
                    }} />
                  </div>
                  <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>{d.label[0]}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--text-faint)", marginBottom: 16, flexWrap: "wrap" }}>
              {stats.bestDay && <span>best: {stats.bestDay.label} ({stats.bestDay.count})</span>}
              {stats.accuracy && <span style={{ color: stats.accuracy.factor > 1.15 ? "var(--warning)" : "var(--starboard)" }}>estimates ran {stats.accuracy.factor}× (n={stats.accuracy.n})</span>}
              {stats.adriftNow > 0 && <span style={{ color: "var(--warning)" }}>{stats.adriftNow} adrift now</span>}
            </div>

            {stats.launched.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Eyebrow>Launched</Eyebrow>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {stats.launched.map((l) => (
                    <div key={l.title} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--starboard-soft)", border: "1px solid var(--starboard)", borderRadius: "var(--r-sm)", fontSize: 12.5, color: "var(--starboard)" }}>
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
                      <span style={{ width: 130, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e2.title}</span>
                      <div style={{ flex: 1, height: 5, background: "var(--bg-muted)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: (e2.hours / maxSplit) * 100 + "%", background: e2.color, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)", width: 42, textAlign: "right" }}>{e2.hours}h</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <Eyebrow right={entry?.text ? (
                <button className="w-icon-btn" title="Rewrite the retro"
                  onClick={() => { patchReview(week, { text: null, attempted: false }); generateReviewRetro(week, stats); }}>
                  <Icon name="reset" size={11} />
                </button>
              ) : null}>The retro</Eyebrow>
              {entry?.text ? (
                <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{entry.text}</div>
              ) : entry?.attempted && aiStatus !== "busy" ? (
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                  AI is off — the numbers above stand on their own.{" "}
                  <button className="w-link" style={{ fontSize: 12 }} onClick={() => generateReviewRetro(week, stats)}>Retry</button>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>writing the retro…</div>
              )}
            </div>
          </>
        )}
        <div style={{ marginTop: 16, textAlign: "right" }}>
          <Kbd>Esc</Kbd>
        </div>
      </div>
    </div>
  );
}
