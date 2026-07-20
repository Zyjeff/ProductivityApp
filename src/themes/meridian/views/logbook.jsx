import React from "react";
import { useStore, setUI } from "../../core/store.js";
import { useThemeId, setThemeId } from "../../core/theme.js";
import { THEMES } from "../../registry.js";
import { ProgressRing } from "../components.jsx";
import { sel } from "../../core/store.js";

export default function LogbookPage() {
  const level = useStore(sel.level);
  const totalXP = useStore(sel.totalXP);
  const streak = useStore(sel.streak);
  const id = useThemeId();

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "var(--ground)", overflow: "auto", padding: 24 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 className="mer-serif" style={{ color: "var(--brass)", margin: 0 }}>Observation Journal</h1>
          <button className="mer-plate" style={{ padding: "8px 14px" }} onClick={() => setUI({ statsOpen: false })}>Close</button>
        </div>

        <div className="mer-plate" style={{ padding: 20, marginBottom: 20, display: "flex", gap: 24, alignItems: "center" }}>
          <ProgressRing pct={level?.pct || 0} size={56} />
          <div>
            <div className="mer-serif" style={{ fontSize: 20 }}>Rank {level?.level ?? "—"} · {level?.title || "Observer"}</div>
            <div className="mer-dim">{totalXP ?? 0} photons · {streak > 0 ? streak + " clear nights" : "no streak"}</div>
          </div>
        </div>

        <div className="mer-plate" style={{ padding: 16, marginBottom: 20 }}>
          <div className="mer-gauge-label" style={{ marginBottom: 12 }}>INSTRUMENT SUITE — THEME</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setThemeId(t.id)}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 4,
                  background: t.id === id ? "var(--amber-ground)" : "var(--well)",
                  border: "1px solid " + (t.id === id ? "var(--brass)" : "var(--line)"),
                  color: t.id === id ? "var(--amber)" : "var(--fg)",
                }}
              >
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <div className="mer-faint" style={{ fontSize: 12 }}>{t.tagline}</div>
              </button>
            ))}
          </div>
        </div>

        <p className="mer-dim" style={{ fontSize: 13 }}>
          Full Journal sections: trophies, estimate calibration (60d), screen-log 7-day, day-rollover, export/import, preview mode, migration — implement per S1–S8.
        </p>
      </div>
    </div>
  );
}
