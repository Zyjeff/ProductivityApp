// today.jsx — the home surface. Capture lands HERE (pinned to today),
// the lineup is keyboard-first, missed work is triaged inline, and the
// day closes with a ritual.

import React, { useEffect, useMemo, useState } from "react";
import { Icon, Eyebrow, EmptyState, PageHeader, Sparkline, BarStrip, ProgressRing } from "../components.jsx";
import { CaptureBar } from "../capture.jsx";
import { TaskRow, ChunksEditor } from "../taskrow.jsx";
import * as D from "../domain.js";
import {
  useStore, getState, setUI, setCompletion, todayLineup, sel,
  pinTaskToDate, dismissChunk, moveChunkDate, patchScreenToday, reopenDay,
  enterPreview,
} from "../store.js";
import { registerActiveList } from "../keys.js";

const VIEW_PAD = "28px 36px 48px";

export function TodayView() {
  const tasks = useStore((s) => s.tasks);
  const plan = useStore((s) => s.plan);
  const projects = useStore((s) => s.projects);
  const screen = useStore((s) => s.screen);
  const meta = useStore((s) => s.meta);
  const energy = useStore((s) => s.ui.energy);
  const cursor = useStore((s) => s.ui.cursor);
  const [exp, setExp] = useState(null);

  const hour = meta.dayStartHour || 0;
  const todayIso = D.effectiveTodayIso(hour);
  const s = getState();
  const lineup = useMemo(() => todayLineup(s), [tasks, plan, energy, hour]);
  const missed = useMemo(() => D.getMissedWork(tasks, plan, hour), [tasks, plan, hour]);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  // Keyboard cursor list = missed rows then lineup rows.
  const kbRows = useMemo(() => [
    ...missed.map((m) => ({ taskId: m.taskId, chunkDate: m.date, done: false })),
    ...lineup.map((r) => ({ taskId: r.task.id, chunkDate: r.chunk ? todayIso : null, done: r.doneHere, recurring: r.recurringRow })),
  ], [missed, lineup, todayIso]);
  useEffect(() => { registerActiveList("today", kbRows); }, [kbRows]);

  const stats = useMemo(() => {
    const xpMap = D.xpByDay(tasks, plan, hour);
    const activity = D.activityByDay(tasks, plan, hour);
    const anchor = D.effectiveToday(hour);
    const days14 = [];
    for (let i = 13; i >= 0; i--) days14.push(D.isoDate(D.addDays(anchor, -i)));
    const xp14 = days14.map((d) => xpMap.get(d) || 0);
    const done14 = days14.map((d) => activity.get(d)?.size || 0);
    const trend = (a, b) => {
      const sa = a.reduce((x, y) => x + y, 0), sb = b.reduce((x, y) => x + y, 0);
      return sa === 0 ? null : Math.round(((sb - sa) / sa) * 100);
    };
    const monday = D.mondayOf(anchor);
    const week = [];
    for (let i = 0; i < 7; i++) {
      const iso = D.isoDate(D.addDays(monday, i));
      week.push({ label: "MTWTFSS"[i], value: activity.get(iso)?.size || 0, title: `${iso}: ${activity.get(iso)?.size || 0} tasks`, isToday: iso === todayIso });
    }
    return {
      todayXP: D.todayXP(tasks, plan, hour),
      streakRun: D.streak(tasks, plan, hour),
      doneToday: activity.get(todayIso)?.size || 0,
      xpTrend: trend(xp14.slice(0, 7), xp14.slice(7)),
      doneTrend: trend(done14.slice(0, 7), done14.slice(7)),
      xp7: xp14.slice(7),
      week,
      weekActiveIdx: week.findIndex((w) => w.isToday),
    };
  }, [tasks, plan, hour, todayIso]);

  const pending = tasks.filter((t) => !t.completed && t.recurring === "none");
  const readyToShip = projects.filter((p) => !p.completedAt && (p.childTaskIds || []).length > 0 && D.progressOfProject(p, tasksById) === 100);
  const planDone = lineup.filter((r) => r.doneHere).length;

  const hourNow = new Date().getHours();
  const allDone = lineup.length > 0 && planDone === lineup.length;
  const greeting = allDone ? "All clear. Solid day."
    : lineup.length === 0 && pending.length === 0 ? "Empty yard. Capture something."
    : hourNow < 5 ? "Late shift."
    : hourNow < 12 ? "Morning. Let's launch."
    : hourNow < 14 ? "Midday. Keep moving."
    : hourNow < 18 ? "Back at it."
    : hourNow < 22 ? "Evening push."
    : "Still at the yard.";

  const entry = screen[todayIso] || { xOpens: 0, ytOpens: 0, mobileHours: null };
  const dayClosed = meta.dayClosed && meta.dayClosed.date === todayIso ? meta.dayClosed : null;

  // Upcoming preview (next day with work).
  const upcoming = (plan || []).filter((e) => e.date > todayIso && e.items.length).sort((a, b) => a.date.localeCompare(b.date))[0];

  let cursorIdx = cursor ? cursor.index : -1;

  return (
    <div className="w-view-pad" style={{ padding: VIEW_PAD, maxWidth: 1140, margin: "0 auto" }}>
      {dayClosed && (
        <div className="w-fade-in" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", marginBottom: 18, background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: 12.5, color: "var(--text-muted)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon name="moon" size={13} /> Day closed at {new Date(dayClosed.closedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
          <button className="w-link" onClick={reopenDay}>Reopen</button>
        </div>
      )}

      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        title={greeting}
        sub={`${pending.length} in the yard · ${lineup.length} lined up today${readyToShip.length ? ` · ${readyToShip.length} ready to launch` : ""}`}
        right={<CaptureBar scheduleToday />}
      />

      {/* momentum strip */}
      <div className="w-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10, marginBottom: 22 }}>
        <div className="w-stat">
          <div className="w-stat-top">
            <div className="w-stat-label">Today's XP</div>
            <div className="w-stat-value">{stats.todayXP}</div>
            {stats.xpTrend != null && (
              <div className={"w-stat-trend w-stat-trend--" + (stats.xpTrend > 0 ? "up" : stats.xpTrend < 0 ? "down" : "flat")}>
                {stats.xpTrend > 0 ? "↑" : stats.xpTrend < 0 ? "↓" : "·"} {Math.abs(stats.xpTrend)}% vs last week
              </div>
            )}
          </div>
          <div className="w-stat-bottom"><Sparkline data={stats.xp7} /></div>
        </div>
        <div className="w-stat">
          <div className="w-stat-top">
            <div className="w-stat-label">Streak</div>
            <div className="w-stat-value" style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              {stats.streakRun}<span style={{ fontSize: 13, color: "var(--text-faint)", fontWeight: 500 }}>days</span>
            </div>
            <div className="w-stat-trend w-stat-trend--flat">
              <Icon name="flame" size={11} /> {stats.streakRun === 0 ? "launch something today" : stats.doneToday > 0 ? "secured today" : "complete 1 to keep it"}
            </div>
          </div>
          <div className="w-stat-bottom" style={{ padding: "0 14px 10px" }}>
            <BarStrip data={stats.week} activeIndex={stats.weekActiveIdx} height={38} />
          </div>
        </div>
        <div className="w-stat">
          <div className="w-stat-top">
            <div className="w-stat-label">Done today</div>
            <div className="w-stat-value">{stats.doneToday}</div>
            {stats.doneTrend != null && (
              <div className={"w-stat-trend w-stat-trend--" + (stats.doneTrend > 0 ? "up" : stats.doneTrend < 0 ? "down" : "flat")}>
                {stats.doneTrend > 0 ? "↑" : stats.doneTrend < 0 ? "↓" : "·"} {Math.abs(stats.doneTrend)}% vs last week
              </div>
            )}
          </div>
          <div className="w-stat-bottom" style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: "0 16px 12px", gap: 10 }}>
            {["epic", "hard", "medium", "easy"].map((d) => {
              const count = pending.filter((t) => t.difficulty === d).length;
              return count > 0 ? (
                <span key={d} title={`${count} ${d} pending`} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: 1.5, background: D.DIFFICULTY[d].tone, display: "inline-block" }} /> {count}
                </span>
              ) : null;
            })}
          </div>
        </div>
        <div className="w-stat">
          <div className="w-stat-top">
            <div className="w-stat-label">Lined up</div>
            <div className="w-stat-value">{planDone}<span style={{ fontSize: 15, color: "var(--text-faint)" }}> / {lineup.length}</span></div>
            <div className="w-stat-trend w-stat-trend--flat">{lineup.reduce((s2, r) => s2 + (r.task.xp || 0), 0)} XP on the slate</div>
          </div>
          <div className="w-stat-bottom" style={{ padding: "8px 16px 14px", display: "flex", alignItems: "flex-end" }}>
            <div style={{ height: 4, background: "var(--bg-muted)", borderRadius: 999, overflow: "hidden", width: "100%" }}>
              <div style={{ height: "100%", width: (lineup.length ? (planDone / lineup.length) * 100 : 0) + "%", background: "var(--starboard)", borderRadius: 999, transition: "width 320ms" }} />
            </div>
          </div>
        </div>
      </div>

      <div className="w-today-grid" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 22, alignItems: "start" }}>
        <div>
          {/* missed work triage */}
          {missed.length > 0 && (
            <div className="w-fade-in" style={{ marginBottom: 16, border: "1px solid var(--warning)", borderRadius: "var(--r-md)", background: "var(--warning-soft)", padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Icon name="bolt" size={12} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--warning)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Adrift</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{missed.length} past item{missed.length === 1 ? "" : "s"}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {missed.map(({ date, taskId, task, item }, i) => {
                  const project = task.projectId ? projectsById.get(task.projectId) : null;
                  const daysAgo = Math.max(1, Math.round((D.parseIsoDate(todayIso) - D.parseIsoDate(date)) / 86400000));
                  return (
                    <div key={`${date}-${taskId}`}
                      className={cursorIdx === i ? "w-row--cursor" : ""}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", borderLeft: "3px solid " + (project?.color || "var(--warning)") }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 2, fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                          <span>{daysAgo}d adrift</span>
                          {project && <><span>·</span><span style={{ color: project.color }}>{project.title}</span></>}
                          {item.hours && <><span>·</span><span>{item.hours}h chunk</span></>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button className="w-btn w-btn--ghost w-btn--sm" onClick={() => moveChunkDate(taskId, date, todayIso)} title="Reschedule to today">Today</button>
                        <button className="w-btn w-btn--ghost w-btn--sm" style={{ color: "var(--starboard)" }} onClick={() => setCompletion(taskId, { done: true, chunkDate: date })} title="It actually got done — mark it">Done</button>
                        <button className="w-icon-btn" onClick={() => dismissChunk(taskId, date)} title="Remove from plan (undoable)" aria-label="Dismiss"><Icon name="close" size={11} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <span className="w-section-title">Today's lineup</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <EnergyToggle />
              {stats.doneToday > 0 && !dayClosed && (
                <button className="w-link" onClick={() => setUI({ endOfDayOpen: true })}>Close day →</button>
              )}
            </div>
          </div>

          {lineup.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {lineup.map((r, i) => {
                const globalIdx = missed.length + i;
                const chunks = r.chunk ? D.getTaskChunks(r.task.id, plan) : [];
                return (
                  <TaskRow key={r.task.id}
                    task={r.task}
                    project={r.task.projectId ? projectsById.get(r.task.projectId) : null}
                    doneHere={r.doneHere}
                    onToggleDone={(done) => setCompletion(r.task.id, { done, chunkDate: r.chunk ? todayIso : null })}
                    chunkNote={r.chunkNote} chunkLabel={r.chunkLabel}
                    isCursor={cursorIdx === globalIdx}
                    onHoverCursor={() => setUI({ cursor: { index: globalIdx } })}
                    expanded={exp === r.task.id}
                    onToggleExpand={() => setExp(exp === r.task.id ? null : r.task.id)}
                    extraExpanded={chunks.length > 1 ? <ChunksEditor task={r.task} chunks={chunks} dayStartHour={hour} /> : null}
                    dayStartHour={hour}
                  />
                );
              })}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                <span>{planDone}/{lineup.length} done</span>
                <span>j/k to move · x to complete · f to focus</span>
              </div>
            </div>
          ) : (
            <EmptyState dashed>
              {pending.length === 0 ? (
                <>
                  <div style={{ fontWeight: 500, color: "var(--text)", marginBottom: 8 }}>Nothing in the yard.</div>
                  <div>Type in the capture bar above — it lands right here, scheduled for today.</div>
                  {tasks.length === 0 && projects.length === 0 && (
                    <div style={{ marginTop: 14 }}>
                      <button className="w-btn w-btn--outline w-btn--sm" onClick={enterPreview}>
                        <Icon name="bolt" size={11} /> Try with sample data
                      </button>
                      <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 8 }}>
                        Loads a demo yard so you can poke around — your (empty) data is snapshotted and restored on exit.
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 500, color: "var(--text)", marginBottom: 8 }}>Nothing lined up for today.</div>
                  <div style={{ marginBottom: 12 }}>
                    {upcoming
                      ? <>Next planned day: {D.fmtIsoShort(upcoming.date)} · {upcoming.items.length} task{upcoming.items.length > 1 ? "s" : ""}.</>
                      : <>{pending.length} task{pending.length > 1 ? "s" : ""} waiting in the yard.</>}
                  </div>
                  <button className="w-btn w-btn--outline w-btn--sm" onClick={() => setUI({ view: "plan" })}>Open the plan</button>
                </>
              )}
            </EmptyState>
          )}
        </div>

        {/* rail */}
        <div className="w-today-rail" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {readyToShip.length > 0 && (
            <div className="w-card" style={{ padding: 14, borderColor: "var(--starboard)", background: "var(--starboard-soft)" }}>
              <Eyebrow right={<button className="w-link" onClick={() => setUI({ view: "dock" })}>Dock →</button>}>Ready to launch</Eyebrow>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {readyToShip.slice(0, 4).map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <ProgressRing pct={100} size={24} stroke={2.5} tone="var(--starboard)" />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                    <button className="w-btn w-btn--launch w-btn--xs" onClick={() => setUI({ view: "dock" })}>Launch</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {upcoming && (
            <div className="w-card" style={{ padding: 14 }}>
              <Eyebrow right={<button className="w-link" onClick={() => setUI({ view: "plan" })}>Plan →</button>}>Next up · {D.fmtIsoShort(upcoming.date)}</Eyebrow>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {upcoming.items.slice(0, 4).map((it) => {
                  const t = tasksById.get(it.taskId);
                  if (!t) return null;
                  return (
                    <div key={it.taskId} style={{ fontSize: 12.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.title}{it.note ? <span style={{ color: "var(--text-faint)", fontStyle: "italic" }}> — {it.note}</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="w-card" style={{ padding: 14 }}>
            <Eyebrow right={<button className="w-link" onClick={() => setUI({ statsOpen: true })}>History →</button>}>Screen log</Eyebrow>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              {[{ label: "X opens", key: "xOpens" }, { label: "YT opens", key: "ytOpens" }].map((item) => {
                const count = entry[item.key] || 0;
                return (
                  <div key={item.key} style={{ background: "var(--bg-soft)", borderRadius: "var(--r-md)", padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{item.label}</span>
                      <span style={{ fontSize: 18, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text)" }}>{count}</span>
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button className="w-btn w-btn--outline w-btn--xs" style={{ flex: 1 }} onClick={() => patchScreenToday({ [item.key]: count + 1 })}>+1</button>
                      {count > 0 && <button className="w-btn w-btn--ghost w-btn--xs" onClick={() => patchScreenToday({ [item.key]: Math.max(0, count - 1) })}>−</button>}
                    </div>
                  </div>
                );
              })}
            </div>
            <MobileHoursInput entry={entry} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileHoursInput({ entry }) {
  const [v, setV] = useState("");
  if (entry.mobileHours != null) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        <span>{entry.mobileHours}h on mobile today</span>
        <button className="w-link" style={{ fontSize: 11 }} onClick={() => patchScreenToday({ mobileHours: null })}>clear</button>
      </div>
    );
  }
  const log = () => { if (v) { patchScreenToday({ mobileHours: parseFloat(v) || 0 }); setV(""); } };
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <input type="number" min="0" max="24" step="0.5" placeholder="Mobile hours"
        value={v} onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") log(); }}
        className="w-input w-input--sm" style={{ flex: 1, fontFamily: "var(--font-mono)" }} />
      <button className="w-btn w-btn--outline w-btn--sm" disabled={!v} onClick={log}>Log</button>
    </div>
  );
}

export function EnergyToggle() {
  const energy = useStore((s) => s.ui.energy);
  const opts = [
    { id: "low", label: "Easy", title: "Surface easy tasks first" },
    { id: "normal", label: "Auto", title: "Sort by priority" },
    { id: "high", label: "Hard", title: "Surface hard tasks first" },
  ];
  return (
    <div style={{ display: "inline-flex", background: "var(--bg-soft)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 2 }} role="group" aria-label="Energy mode">
      {opts.map((o) => (
        <button key={o.id} type="button" title={o.title} aria-pressed={energy === o.id}
          onClick={() => setUI({ energy: o.id })}
          style={{
            background: energy === o.id ? "var(--bg-elev)" : "transparent",
            border: "none", cursor: "pointer",
            color: energy === o.id ? "var(--text)" : "var(--text-muted)",
            font: "500 12px var(--font-sans)", padding: "4px 10px", borderRadius: 4,
          }}>{o.label}</button>
      ))}
    </div>
  );
}
