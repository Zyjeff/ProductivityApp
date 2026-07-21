// views/focus.jsx — BURN tunnel: one payload, MET clock, engine plume.
// Timer engine + key listener + chunk-aware complete/advance lifted from
// nightwatch focus.jsx; presentation is Apogee ground-control.

import React, { useEffect, useRef, useState } from "react";
import { Icon, Kbd, Cell, DotNumeral } from "../components.jsx";
import { REDUCED_MOTION } from "../texture.js";
import * as D from "../../../core/domain.js";
import {
  useStore,
  getState,
  setUI,
  setCompletion,
  saveFocusTime,
  logSession,
  todayLineup,
} from "../../../core/store.js";

function effectiveFocusMs(t, hour) {
  if (!t?.focusMs || !t.focusDate) return 0;
  if (t.focusDate !== D.effectiveTodayIso(hour)) return 0;
  return t.focusMs;
}

function nextFocusId(s, currentId) {
  const rows = todayLineup(s).filter((r) => !r.doneHere && r.task.id !== currentId);
  return rows[0]?.task.id || null;
}

// ── Plume: the theme's ONE continuously-animating canvas ──────────
// Cadence: setInterval ~112ms (~9fps), not rAF. Rules from visual-toolkit:
// low-res + pixelated upscale, stepped ~9fps, sync first frame, stop on
// document.hidden, fully static under REDUCED_MOTION.
function Plume({ running }) {
  const canvasRef = useRef(null);
  const runningRef = useRef(running);
  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    // Low-res grid (tens of cells); CSS stretches with imageRendering:pixelated.
    const COLS = 48;
    const ROWS = 28;
    cv.width = COLS;
    cv.height = ROWS;

    // Red → white → cyan ramp (literal hex; not rampTex).
    const C_RED = [0xff, 0x2b, 0x1a];
    const C_WHT = [0xe8, 0xec, 0xee];
    const C_CYN = [0x4f, 0xd8, 0xeb];

    function lerp3(a, b, t) {
      return [
        (a[0] + (b[0] - a[0]) * t) | 0,
        (a[1] + (b[1] - a[1]) * t) | 0,
        (a[2] + (b[2] - a[2]) * t) | 0,
      ];
    }
    function rampColor(t) {
      // t 0 = hot/top (red), 0.5 = white, 1 = cool/bottom (cyan)
      if (t < 0.5) return lerp3(C_RED, C_WHT, t * 2);
      return lerp3(C_WHT, C_CYN, (t - 0.5) * 2);
    }

    let step = 0;
    function draw() {
      const hot = runningRef.current;
      // Paused: lower density / amplitude (cheap conditional; no loop restart).
      const densityScale = hot ? 1 : 0.28;
      const ampScale = hot ? 1 : 0.35;
      const flickerAmt = hot ? 0.22 : 0.06;

      ctx.fillStyle = "#030405";
      ctx.fillRect(0, 0, COLS, ROWS);

      const cx = (COLS - 1) * 0.5;
      for (let y = 0; y < ROWS; y++) {
        const ty = y / (ROWS - 1); // 0 top → 1 bottom
        // Denser/hotter near top, taper + cool toward bottom.
        const width = (2.5 + ty * 18) * ampScale;
        const baseDensity = (0.95 - ty * 0.72) * densityScale;
        const [r, g, b] = rampColor(ty);
        for (let x = 0; x < COLS; x++) {
          const dx = Math.abs(x - cx);
          if (dx > width) continue;
          const edge = 1 - dx / width;
          // Per-cell flicker from cheap hash of x/y/step (live frame, not tex cache).
          const n =
            ((Math.sin(x * 12.9898 + y * 78.233 + step * 0.37) * 43758.5453) % 1 + 1) % 1;
          const flicker = 1 - flickerAmt + n * flickerAmt * 2;
          const p = baseDensity * edge * edge * flicker;
          if (p < 0.12 + n * 0.18) continue;
          const a = Math.min(1, p * 1.15);
          ctx.fillStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
      step += 1;
    }

    // Rule 3: one synchronous first frame in the effect body (never blank on mount).
    draw();

    if (REDUCED_MOTION) {
      // Rule 4: fully static under reduced motion — no loop started.
      return undefined;
    }

    // Rule 2: stepped ~9fps via setInterval 112ms.
    let iv = null;
    const startLoop = () => {
      if (iv != null) return;
      iv = setInterval(draw, 112);
    };
    const stopLoop = () => {
      if (iv != null) {
        clearInterval(iv);
        iv = null;
      }
    };

    // Rule 4: pause under document.hidden; restart when visible again.
    const onVis = () => {
      if (document.hidden) stopLoop();
      else {
        draw();
        startLoop();
      }
    };
    if (!document.hidden) startLoop();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopLoop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        width: "100%",
        maxWidth: 360,
        height: 90,
        display: "block",
        imageRendering: "pixelated",
        opacity: running ? 0.95 : 0.55,
      }}
    />
  );
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
  const hasChunkToday = (s.plan || []).some(
    (e) => e.date === todayIso && e.items.some((i) => i.taskId === taskId)
  );

  const [running, setRunning] = useState(true);
  const [elapsed, setElapsed] = useState(() => effectiveFocusMs(task, hour));
  const baseRef = useRef(effectiveFocusMs(task, hour));
  const startRef = useRef(null);
  const sessionSeedRef = useRef(effectiveFocusMs(task, hour));
  const latestRef = useRef(effectiveFocusMs(task, hour));
  useEffect(() => {
    latestRef.current = elapsed;
  }, [elapsed]);
  useEffect(
    () => () => {
      logSession(taskId, latestRef.current - sessionSeedRef.current);
    },
    [taskId]
  );

  useEffect(() => {
    if (!running || !task) return;
    startRef.current = Date.now();
    const tick = setInterval(
      () => setElapsed(baseRef.current + (Date.now() - startRef.current)),
      250
    );
    const save = setInterval(
      () => saveFocusTime(taskId, baseRef.current + (Date.now() - startRef.current)),
      5000
    );
    return () => {
      clearInterval(tick);
      clearInterval(save);
      const cur = baseRef.current + (Date.now() - startRef.current);
      baseRef.current = cur;
      saveFocusTime(taskId, cur);
    };
  }, [running, taskId]);

  useEffect(() => {
    const h = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "Escape") {
        e.preventDefault();
        setUI({ focusTaskId: null });
      } else if (e.key === " ") {
        e.preventDefault();
        setRunning((r) => !r);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  if (!task) {
    setUI({ focusTaskId: null });
    return null;
  }

  const complete = () => {
    const advance = nextFocusId(getState(), taskId);
    setCompletion(taskId, { done: true, chunkDate: hasChunkToday ? todayIso : null });
    setUI({ focusTaskId: advance });
  };

  const sec = Math.floor(elapsed / 1000);
  const p2 = (n) => String(n).padStart(2, "0");
  const hh = Math.floor(sec / 3600);
  const mm = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  const timeStr = `${hh}:${p2(mm)}:${p2(ss)}`;

  return (
    <div className="ap-tunnel" role="dialog" aria-label="BURN">
      {/* Top row: EXIT · status · SKIP */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 28px",
        }}
      >
        <button
          type="button"
          className="ap-btn ap-btn--ghost"
          onClick={() => setUI({ focusTaskId: null })}
        >
          <Icon name="close" size={14} /> EXIT <Kbd>Esc</Kbd>
        </button>
        <span className="ap-stencil ap-stencil--lit">
          {running ? "BURNING" : "HOLD"}
        </span>
        {nextTask ? (
          <button
            type="button"
            className="ap-btn ap-btn--ghost ap-btn--sm"
            onClick={() => setUI({ focusTaskId: nextId })}
          >
            SKIP <Icon name="chevron-r" size={12} />
          </button>
        ) : (
          <span style={{ width: 72 }} />
        )}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: "72px 24px 16px",
          width: "100%",
          maxWidth: 720,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
            justifyContent: "center",
            color: "var(--fg-dim)",
            fontSize: 13,
          }}
        >
          {project && (
            <>
              <span style={{ color: project.color || "var(--channel)" }}>{project.title}</span>
              <span className="ap-faint">·</span>
            </>
          )}
          <span className="ap-stencil">{task.difficulty}</span>
          <span className="ap-faint">·</span>
          <span className="ap-num ap-muted">~{D.taskHours(task)}h</span>
        </div>

        <h1 className="ap-tunnel-title" style={{ marginBottom: 0 }}>
          {task.title}
        </h1>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Cell label="VEHICLE">{project ? project.title : "—"}</Cell>
          <Cell label="DIFF">{task.difficulty}</Cell>
          <Cell label="EST">~{D.taskHours(task)}h</Cell>
        </div>

        <DotNumeral size="xl">{timeStr}</DotNumeral>

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 4,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            className="ap-btn"
            onClick={() => setRunning((r) => !r)}
            style={{ minWidth: 140 }}
          >
            {running ? "HOLD" : "RESUME"} <Kbd>Space</Kbd>
          </button>
          <button
            type="button"
            className="ap-btn ap-btn--ghost"
            disabled={elapsed === 0}
            onClick={() => {
              baseRef.current = 0;
              startRef.current = Date.now();
              setElapsed(0);
              saveFocusTime(taskId, 0);
            }}
          >
            <Icon name="undo" size={13} /> RESET
          </button>
          <button
            type="button"
            className="ap-btn ap-btn--primary"
            title="Confirm nominal"
            onClick={complete}
          >
            <Icon name="check" size={13} /> CONFIRM NOMINAL
          </button>
        </div>

        {nextTask && (
          <div
            className="ap-panel ap-panel--well"
            style={{
              padding: "12px 18px",
              minWidth: 280,
              maxWidth: 420,
              textAlign: "left",
            }}
          >
            <div className="ap-stencil" style={{ marginBottom: 4 }}>
              UP NEXT
            </div>
            <div style={{ fontSize: 13, color: "var(--fg)" }} className="ap-truncate">
              {nextTask.title}
            </div>
          </div>
        )}
      </div>

      {/* Plume at the foot — only continuous animation in the theme */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          padding: "8px 24px 28px",
          flexShrink: 0,
        }}
      >
        <Plume running={running} />
      </div>
    </div>
  );
}
