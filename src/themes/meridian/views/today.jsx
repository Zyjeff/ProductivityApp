import React, { useEffect, useMemo } from "react";
import { useStore, setUI, setCompletion, getState } from "../../../core/store.js";
import { todayLineup, sel } from "../../../core/store.js";
import { registerActiveList } from "../../../core/keys.js";
import * as D from "../../../core/domain.js";
import { ViewfinderFrame, EmptyState, ProgressRing, BrassPlaque } from "../components.jsx";
import CaptureBar from "../capture.jsx";

export default function TodayView() {
  const tasks = useStore((s) => s.tasks);
  const plan = useStore((s) => s.plan);
  const energy = useStore((s) => s.ui.energy);
  const cursor = useStore((s) => s.ui.cursor);
  const meta = useStore((s) => s.meta);
  const hour = meta?.dayStartHour || 0;

  const s = getState();
  const lineup = useMemo(() => todayLineup(s), [tasks, plan, energy, hour, meta]);

  useEffect(() => {
    const rows = (lineup || []).map((r) => ({
      taskId: r.taskId || r.id,
      chunkDate: r.chunkDate,
      done: !!r.done,
    }));
    registerActiveList("today", rows);
    return () => registerActiveList("today", []);
  }, [lineup]);

  const pending = (lineup || []).filter((r) => !r.done);
  const now = pending[0];
  const next = pending[1];
  const doneCount = (lineup || []).filter((r) => r.done).length;
  const total = (lineup || []).length;

  if (!lineup || lineup.length === 0) {
    return (
      <div>
        <CaptureBar />
        <EmptyState
          title="Clear skies, empty program"
          body="No targets lined up for this session. Capture a sighting or jump to the Ephemeris."
          action={<button className="mer-plate" style={{ padding: "8px 16px" }} onClick={() => setUI({ view: "plan" })}>Open Ephemeris</button>}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="mer-serif" style={{ fontSize: 24, color: "var(--star)" }}>Observing Session</div>
          <div className="mer-dim" style={{ fontSize: 13 }}>Program · {doneCount}/{total} resolved</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <ProgressRing pct={total ? (doneCount / total) * 100 : 0} size={40} />
        </div>
      </div>

      <CaptureBar />

      {now && (
        <ViewfinderFrame label="CURRENT TARGET — LOCKED">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div className="mer-serif" style={{ fontSize: 18, color: "var(--fg)", marginBottom: 4 }}>{now.title || now.task?.title || "Untitled"}</div>
              <div className="mer-dim" style={{ fontSize: 12 }}>
                {now.estimate ? `~${now.estimate}h` : ""} {now.projectName ? `· ${now.projectName}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="mer-plate"
                style={{ padding: "6px 12px", color: "var(--starboard)" }}
                onClick={() => setCompletion(now.taskId || now.id, true, now.chunkDate)}
              >
                Log plate
              </button>
              <button
                className="mer-plate"
                style={{ padding: "6px 12px" }}
                onClick={() => setUI({ focusTaskId: now.taskId || now.id })}
              >
                Lock mount
              </button>
            </div>
          </div>
          {next && (
            <div className="mer-faint" style={{ marginTop: 12, fontSize: 12 }}>
              Next up: {next.title || next.task?.title}
            </div>
          )}
        </ViewfinderFrame>
      )}

      <div>
        <div className="mer-gauge-label" style={{ marginBottom: 8 }}>OBSERVING PROGRAM</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {(lineup || []).map((row, i) => {
            const id = row.taskId || row.id;
            const isCursor = cursor === i || cursor === id;
            return (
              <div
                key={id + (row.chunkDate || "")}
                className="mer-plate"
                style={{
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  opacity: row.done ? 0.55 : 1,
                  borderColor: isCursor ? "var(--brass)" : "var(--line)",
                  background: isCursor ? "var(--amber-ground)" : "var(--plate)",
                }}
                onClick={() => setUI({ cursor: i })}
              >
                <span className="mer-mono" style={{ width: 20, color: "var(--fg-faint)", fontSize: 11 }}>{i + 1}</span>
                <span style={{ flex: 1, textDecoration: row.done ? "line-through" : "none" }}>
                  {row.title || row.task?.title || "—"}
                </span>
                {!row.done && (
                  <button
                    style={{ color: "var(--starboard)", fontSize: 12 }}
                    onClick={(e) => { e.stopPropagation(); setCompletion(id, true, row.chunkDate); }}
                  >
                    ✓
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
