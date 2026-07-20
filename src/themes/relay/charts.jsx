// charts.jsx — small meters and bars for Relay (div-based, no rAF).

import React from "react";

export function WeekBars({ days, data, height = 28, threshold }) {
  const series = days || data || [];
  const max = Math.max(1, threshold || 0, ...series.map((d) => d.value || 0));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height }} title="Activity">
      {series.map((d, i) => (
        <div key={i} title={d.title || d.label}
          style={{
            flex: 1,
            height: Math.max(2, ((d.value || 0) / max) * height),
            background: d.isToday ? "var(--channel)" : ((d.value || 0) > (threshold || Infinity) ? "var(--port)" : "var(--plate-hi)"),
            borderRadius: 2,
            opacity: d.value ? 1 : 0.35,
          }} />
      ))}
    </div>
  );
}

export function Spark({ data = [], width = 72, height = 22, color = "var(--channel)" }) {
  if (!data.length) return null;
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => {
    const x = data.length <= 1 ? 0 : (i / (data.length - 1)) * width;
    const y = height - (v / max) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} />
    </svg>
  );
}

// Nightwatch-compatible single meter row used in logbook calibration
export function CalRow({ label, pct = 0, tone = "var(--channel)", value, last, days }) {
  if (days) {
    const max = Math.max(1, ...days.map((d) => d.value || 0));
    return (
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {days.map((d, i) => (
          <div key={i} title={d.title || `${d.label}: ${d.value}`}
            style={{ flex: 1, height: 6, borderRadius: 2, background: "var(--well)", overflow: "hidden" }}>
            <div style={{
              width: `${((d.value || 0) / max) * 100}%`, height: "100%",
              background: d.isToday ? "var(--channel)" : "var(--fg-faint)",
            }} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "7px 0",
      borderBottom: last ? "none" : "1px solid var(--line)",
    }}>
      <span className="r-lab" style={{ width: 110, flexShrink: 0 }}>{label}</span>
      <div className="r-meter" style={{ flex: 1, height: 5 }}>
        <div className="r-meter-fill" style={{ width: Math.max(0, Math.min(100, pct)) + "%", backgroundColor: tone }} />
      </div>
      <span className="r-num" style={{ fontSize: 11, color: "var(--fg-dim)", minWidth: 48, textAlign: "right" }}>{value}</span>
    </div>
  );
}
