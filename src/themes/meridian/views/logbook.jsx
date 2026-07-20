import React from "react";
import { useStore, setUI, sel } from "../../../core/store.js";
import { useThemeId, setThemeId } from "../../../core/theme.js";
import { THEMES } from "../../registry.js";
import { ProgressRing } from "../components.jsx";

export default function LogbookPage() {
  const statsOpen = useStore((s) => s.ui.statsOpen);
  const level = useStore(sel.level);
  const totalXP = useStore(sel.totalXP);
  const streak = useStore(sel.streak);
  const id = useThemeId();

  if (!statsOpen) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "var(--ground)", overflow: "auto", padding: 24 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ fontFamily: "var(--t-display, Georgia, serif)", color: "var(--brass)", margin: 0 }}>
            Observation Journal
          </h1>
          <button
            onClick={() => setUI({ statsOpen: false })}
            style={{
              background: "var(--plate)", border: "1px solid var(--line)", color: "var(--fg-dim)",
              padding: "7px 14px", borderRadius: 6, cursor: "pointer"
            }}
          >
            Close
          </button>
        </div>

        <div style={{
          background: "var(--plate)", border: "1px solid var(--line)", borderRadius: 6,
          padding: 20, marginBottom: 20, display: "flex", gap: 24, alignItems: "center"
        }}>
          <ProgressRing pct={level?.pct || 0} size={56} />
          <div>
            <div style={{ fontFamily: "var(--t-display, Georgia, serif)", fontSize: 20 }}>
              Rank {level?.level ?? "—"} · {level?.title || "Observer"}
            </div>
            <div style={{ color: "var(--fg-dim)" }}>
              {totalXP ?? 0} photons · {streak > 0 ? streak + " clear nights" : "no streak"}
            </div>
          </div>
        </div>

        <div style={{
          background: "var(--plate)", border: "1px solid var(--line)", borderRadius: 6,
          padding: 16, marginBottom: 20
        }}>
          <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 12 }}>
            INSTRUMENT SUITE — THEME
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setThemeId(t.id)}
                style={{
                  textAlign: "left", padding: "10px 12px", borderRadius: 4, cursor: "pointer",
                  background: t.id === id ? "var(--amber-ground, #2b2008)" : "var(--well)",
                  border: "1px solid " + (t.id === id ? "var(--brass)" : "var(--line)"),
                  color: t.id === id ? "var(--amber)" : "var(--fg)",
                }}
              >
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>{t.tagline}</div>
              </button>
            ))}
          </div>
        </div>

        <p style={{ color: "var(--fg-dim)", fontSize: 13 }}>
          Full Journal sections (trophies, estimate calibration, screen-log, day-rollover, export/import, preview) follow FEATURE_PARITY S1–S8.
        </p>
      </div>
    </div>
  );
}
