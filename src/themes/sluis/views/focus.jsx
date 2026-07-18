// focus.jsx — "de kolk vult": one vessel in the chamber, the water
// rising in real time toward the estimate line. When elapsed reaches
// the estimate the gate leaves part — klaar om door te schutten.
// Timer chaining and the session ledger are lifted verbatim from the
// Nightwatch tunnel; only the presentation is Sluis's.

import React, { useEffect, useRef, useState } from "react";
import { Icon, Kbd, Chip, GateLeaf, KolkCanvas } from "../components.jsx";
import * as D from "../../../core/domain.js";
import { useStore, getState, setUI, setCompletion, saveFocusTime, logSession, todayLineup } from "../../../core/store.js";

function effectiveFocusMs(t, hour) {
  if (!t?.focusMs || !t.focusDate) return 0;
  if (t.focusDate !== D.effectiveTodayIso(hour)) return 0;
  return t.focusMs;
}

function nextFocusId(s, currentId) {
  const rows = todayLineup(s).filter((r) => !r.doneHere && r.task.id !== currentId);
  return rows[0]?.task.id || null;
}

export function FocusTunnel() {
  const focusTaskId = useStore((s) => s.ui.focusTaskId);
  if (!focusTaskId) return null;
  return <Tunnel key={focusTaskId} taskId={focusTaskId} />;
}

function Tunnel({ taskId }) {
  const s = getState();
  const task = s.tasks.find((t) => t.id === taskId);
  const hour = s.meta.dayStartHour || 0;
  const project = task?.projectId ? s.projects.find((p) => p.id === task.projectId) : null;
  const nextId = nextFocusId(s, taskId);
  const nextTask = nextId ? s.tasks.find((t) => t.id === nextId) : null;
  const todayIso = D.effectiveTodayIso(hour);
  const hasChunkToday = (s.plan || []).some((e) => e.date === todayIso && e.items.some((i) => i.taskId === taskId));

  const [running, setRunning] = useState(true);
  const [elapsed, setElapsed] = useState(() => effectiveFocusMs(task, hour));
  const baseRef = useRef(effectiveFocusMs(task, hour));
  const startRef = useRef(null);
  const sessionSeedRef = useRef(effectiveFocusMs(task, hour));
  const latestRef = useRef(effectiveFocusMs(task, hour));
  useEffect(() => { latestRef.current = elapsed; }, [elapsed]);
  useEffect(() => () => {
    logSession(taskId, latestRef.current - sessionSeedRef.current);
  }, [taskId]);

  useEffect(() => {
    if (!running || !task) return;
    startRef.current = Date.now();
    const tick = setInterval(() => setElapsed(baseRef.current + (Date.now() - startRef.current)), 250);
    const save = setInterval(() => saveFocusTime(taskId, baseRef.current + (Date.now() - startRef.current)), 5000);
    return () => {
      clearInterval(tick); clearInterval(save);
      const cur = baseRef.current + (Date.now() - startRef.current);
      baseRef.current = cur;
      saveFocusTime(taskId, cur);
    };
  }, [running, taskId]);

  useEffect(() => {
    const h = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "Escape") { e.preventDefault(); setUI({ focusTaskId: null }); }
      else if (e.key === " ") { e.preventDefault(); setRunning((r) => !r); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // The chamber fills the flex area; the canvas takes its pixel height
  // (its own inline style wins over the stylesheet, so measure here).
  const kolkRef = useRef(null);
  const [kolkH, setKolkH] = useState(340);
  useEffect(() => {
    const el = kolkRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 0) setKolkH(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!task) { setUI({ focusTaskId: null }); return null; }

  const complete = () => {
    const advance = nextFocusId(getState(), taskId);
    setCompletion(taskId, { done: true, chunkDate: hasChunkToday ? todayIso : null });
    setUI({ focusTaskId: advance });
  };

  const sec = Math.floor(elapsed / 1000);
  const p2 = (n) => String(n).padStart(2, "0");
  const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
  const timeStr = hh > 0 ? `${hh}:${p2(mm)}:${p2(ss)}` : `${p2(mm)}:${p2(ss)}`;

  const hours = D.taskHours(task);
  const estimateMs = hours * 3600000;
  // A lock chamber is never dry: the 6% floor keeps the vessel afloat
  // from the first second; the % caption below uses the raw ratio.
  const rawPct = Math.min(1, elapsed / Math.max(estimateMs, elapsed, 60000));
  const fillPct = Math.max(0.06, rawPct);
  const gatesOpen = !!(estimateMs && elapsed >= estimateMs);
  const vessels = [{ x: 0.5, w: Math.min(0.5, 0.16 + hours * 0.05), done: false }];
  const ledger = hh > 0 ? `${hh}u ${p2(mm)}m` : mm > 0 ? `${mm}m ${p2(ss)}s` : `${ss}s`;

  return (
    <div className="s-tunnel" role="dialog" aria-label="Focus mode">
      {/* header — the vessel's papers */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 26px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="s-display" style={{ margin: 0, fontSize: 22, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {task.title}
          </h1>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {project && (
              <Chip tone={project.color}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: project.color, display: "inline-block" }} />
                {project.title}
              </Chip>
            )}
            <Chip>{task.difficulty}</Chip>
            <Chip>~{hours}h</Chip>
          </div>
        </div>
        <button className="s-icon-btn" onClick={() => setUI({ focusTaskId: null })} title="Verlaat de kolk" aria-label="Exit focus mode" style={{ width: 34, height: 34 }}>
          <Icon name="close" size={15} />
        </button>
      </div>

      {/* the chamber — water rises toward the estimate line */}
      <div className="s-tunnel-kolk" ref={kolkRef}>
        <KolkCanvas fillPct={fillPct} vessels={vessels} height={kolkH} animate={false} />
        <GateLeaf side="l" open={gatesOpen} />
        <GateLeaf side="r" open={gatesOpen} />
        <div className={"s-stencil" + (gatesOpen ? " s-stencil--lit" : "")}
          style={{ position: "absolute", left: "50%", bottom: 12, transform: "translateX(-50%)", zIndex: 4, padding: "4px 12px", borderRadius: 999, background: "rgba(255,255,255,.82)", backdropFilter: "blur(3px)", color: "var(--fg-dim)" }}>
          {gatesOpen ? "klaar om door te schutten" : `de kolk vult — ${Math.round(rawPct * 100)}% van ~${hours}h`}
        </div>
      </div>

      {/* timer, controls, ledger */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "18px 24px 22px", borderTop: "1px solid var(--line)", background: "var(--plate)" }}>
        <div style={{ textAlign: "center" }}>
          <div className="s-tunnel-timer">{timeStr}</div>
          <div className={"s-stencil" + (running ? " s-stencil--lit" : "")} style={{ marginTop: 8 }}>
            {running ? "In de kolk" : "Stil water"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          <button className="s-btn" onClick={() => setRunning((r) => !r)} style={{ minWidth: 132 }}>
            {running ? "Pauzeer" : "Hervat"} <Kbd>Space</Kbd>
          </button>
          <button className="s-btn s-btn--ghost" disabled={elapsed === 0}
            onClick={() => { baseRef.current = 0; startRef.current = Date.now(); setElapsed(0); saveFocusTime(taskId, 0); }}>
            <Icon name="reset" size={13} /> Reset
          </button>
          {nextTask && (
            <button className="s-btn s-btn--ghost" onClick={() => setUI({ focusTaskId: nextId })} title={`Daarna: ${nextTask.title}`}>
              Sla over <Icon name="chevronR" size={12} />
            </button>
          )}
          <button className="s-btn s-btn--amber" onClick={complete}>
            <Icon name="gate" size={13} /> Schut door
          </button>
        </div>
        {nextTask && (
          <div className="s-fade-in" style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--well)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "8px 14px", maxWidth: "100%" }}>
            <span className="s-stencil">Daarna</span>
            <span style={{ fontSize: 12.5, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nextTask.title}</span>
          </div>
        )}
        <div className="s-stencil" style={{ opacity: 0.8 }}>
          Focus vandaag voor dit vaartuig: <span className="s-num" style={{ color: "var(--fg-dim)" }}>{ledger}</span>
        </div>
      </div>
    </div>
  );
}
