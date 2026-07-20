import React, { useEffect, useMemo } from "react";
import {
  useStore, setUI, setCompletion, todayLineup,
  ensureMorningBrief,
} from "../../../core/store.js";
import { registerActiveList } from "../../../core/keys.js";
import * as D from "../../../core/domain.js";
import { Kbd, EmptyState } from "../components.jsx";

/**
 * TodayView — Meridian Session
 * Composition: Conditions report → large Viewfinder for NOW → Observing Program list.
 * Signature: the framed target is the emotional center; stars above respond to progress.
 */
export function TodayView() {
  const s = useStore((state) => state);
  const tasks = s.tasks;
  const plan = s.plan;
  const energy = s.ui?.energy;
  const cursor = s.ui?.cursor;
  const todayIso = (D.todayIso && D.todayIso()) || new Date().toISOString().slice(0, 10);

  const lineup = useMemo(() => {
    try {
      return todayLineup(s) || [];
    } catch {
      return [];
    }
  }, [tasks, plan, energy, s.meta]);

  const kbRows = useMemo(() => {
    return lineup.map((r) => ({
      taskId: r.task?.id || r.id,
      chunkDate: r.chunkDate || todayIso,
      done: !!r.doneHere,
    }));
  }, [lineup, todayIso]);

  useEffect(() => {
    registerActiveList("today", kbRows);
    return () => registerActiveList("today", []);
  }, [kbRows]);

  useEffect(() => {
    try { ensureMorningBrief(); } catch {}
  }, []);

  const nowRow = lineup.find((r) => !r.doneHere) || null;
  const doneCount = lineup.filter((r) => r.doneHere).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "12px 16px", gap: 12, minHeight: 0 }}>
      {/* Conditions Report */}
      <div className="m-plate" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <span className="m-title" style={{ fontSize: 14, color: "var(--brass-hot)" }}>Conditions</span>
        <span className="m-mono" style={{ fontSize: 12, color: "var(--fg-dim)" }}>
          {doneCount}/{lineup.length} logged · Program {lineup.length ? "active" : "clear"}
        </span>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--fg-faint)" }}>
          n to acquire · j/k navigate · x complete
        </div>
      </div>

      {/* Signature: Viewfinder for the current target */}
      <div className="m-viewfinder" style={{ flex: "0 0 160px", display: "grid", placeItems: "center", position: "relative", flexShrink: 0 }}>
        <div className="m-reticle" />
        <div style={{ textAlign: "center", zIndex: 1, padding: 16, maxWidth: "90%" }}>
          <div className="m-mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--brass)", marginBottom: 6 }}>
            CURRENT TARGET
          </div>
          {nowRow ? (
            <>
              <div className="m-title" style={{ fontSize: 18, lineHeight: 1.3 }}>
                {nowRow.task?.title || nowRow.title || "Untitled"}
              </div>
              <div style={{ fontSize: 12, color: "var(--fg-dim)", marginTop: 6 }}>
                {nowRow.task?.estimate ? `${nowRow.task.estimate} · ` : ""}
                Press <Kbd>f</Kbd> to track · <Kbd>x</Kbd> to log plate
              </div>
            </>
          ) : (
            <>
              <div className="m-title" style={{ fontSize: 16, color: "var(--fg-dim)" }}>No target locked</div>
              <div style={{ fontSize: 12, color: "var(--fg-faint)", marginTop: 6 }}>
                Log a sighting or select from the program below
              </div>
            </>
          )}
        </div>
      </div>

      {/* Observing Program */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "baseline", marginBottom: 8, flexShrink: 0 }}>
          <span className="m-title" style={{ fontSize: 13, color: "var(--fg-dim)" }}>Observing Program</span>
          <span className="m-mono" style={{ fontSize: 11, color: "var(--fg-faint)", marginLeft: 8 }}>
            {lineup.length} targets
          </span>
        </div>
        <div className="m-plate" style={{ flex: 1, overflow: "auto", padding: 4 }}>
          {lineup.length === 0 ? (
            <EmptyState title="Clear skies, empty program">
              Dome is open. Press <Kbd>n</Kbd> to log the first sighting of the session.
            </EmptyState>
          ) : (
            lineup.map((r, i) => {
              const id = r.task?.id || r.id;
              const title = r.task?.title || r.title || "—";
              const done = !!r.doneHere;
              const isCursor = cursor && cursor.index === i;
              return (
                <div
                  key={String(id) + (r.chunkDate || "")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 4,
                    background: isCursor ? "var(--plate-hi)" : "transparent",
                    borderLeft: isCursor ? "2px solid var(--brass)" : "2px solid transparent",
                    opacity: done ? 0.55 : 1,
                  }}
                  onClick={() => setUI({ cursor: { index: i } })}
                >
                  <button
                    className="m-plaque"
                    style={{ padding: "2px 8px", fontSize: 11 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCompletion(id, { done: !done, chunkDate: r.chunkDate || todayIso });
                    }}
                  >
                    {done ? "✓" : "○"}
                  </button>
                  <span style={{ flex: 1, textDecoration: done ? "line-through" : "none" }}>{title}</span>
                  <span className="m-mono" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                    {r.task?.estimate || ""}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
