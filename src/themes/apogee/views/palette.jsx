// views/palette.jsx — UPLINK terminal command palette.
// Self-gates on ui.paletteOpen (app.jsx renders <Palette /> unconditionally).
// Results grow upward via .ap-terminal-list column-reverse; arrow keys inverted.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Kbd } from "../components.jsx";
import * as D from "../../../core/domain.js";
import {
  useStore, getState, setUI, captureTask, notify,
} from "../../../core/store.js";
import { enrichCapturedTask } from "../../../core/enrich.js";
import { buildCommands } from "../../../core/keys.js";

export function Palette() {
  const open = useStore((s) => s.ui.paletteOpen);
  if (!open) return null;
  return <PaletteInner />;
}

function PaletteInner() {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const items = useMemo(() => {
    const s = getState();
    if (q.startsWith(">")) {
      const raw = q.slice(1).trim();
      const parsed = raw ? D.parseQuickAdd(raw, { projects: s.projects }) : null;
      const chipStr = parsed?.chips.length
        ? "  ·  " + parsed.chips.map((c) => c.label).join("  ")
        : "";
      return [{
        type: "quickadd",
        id: "quickadd",
        label: raw
          ? `Manifest: "${parsed.title || raw}"${chipStr}`
          : "Quick add - type a task, with !prio #tag @vehicle 2h fri...",
        sub: parsed?.scheduleDate ? "moored " + parsed.scheduleDate : "to the yard",
        keepOpen: !raw,
        run: () => {
          if (!raw) return;
          const task = captureTask(raw, { mode: "task", parsed });
          if (task) {
            enrichCapturedTask(
              task.id,
              parsed?.chips.length ? parsed.title : raw,
              "task",
              { grammarUsed: !!parsed?.chips.length, hasHours: !!parsed?.hours },
            );
            notify("Task added");
          }
        },
      }];
    }
    const commands = buildCommands().map((c) => ({
      type: "cmd",
      id: c.id,
      label: c.label,
      keys: c.keys,
      run: c.run,
    }));
    const needle = q.trim().toLowerCase();
    if (!needle) {
      return [
        {
          type: "hint",
          id: "hint-quickadd",
          label: "Quick add: start with >",
          sub: "e.g. > invoice IGP fri 1h !high",
          keepOpen: true,
          run: () => setQ("> "),
        },
        ...commands.slice(0, 8),
      ];
    }
    const cmdHits = commands.filter((c) => c.label.toLowerCase().includes(needle));
    const taskHits = s.tasks
      .filter((t) => t.title.toLowerCase().includes(needle))
      .slice(0, 8)
      .map((t) => ({
        type: "task",
        id: "task-" + t.id,
        label: t.title,
        sub: t.completed ? "done" : "open",
        run: () => setUI({ editingTaskId: t.id, formOpen: true, paletteOpen: false }),
      }));
    return [...cmdHits.slice(0, 6), ...taskHits];
  }, [q]);

  useEffect(() => { setIdx(0); }, [q]);

  const runItem = (item) => {
    if (!item.keepOpen) setUI({ paletteOpen: false });
    item.run();
  };

  return (
    <div
      className="ap-screen"
      onClick={() => setUI({ paletteOpen: false })}
      role="dialog"
      aria-label="Uplink"
    >
      {/* gap: no max-width / margin-auto terminal shell in tokens; size the panel inline */}
      <div
        className="ap-terminal"
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          maxWidth: 640,
          width: "100%",
          margin: "40px auto 24px",
          maxHeight: "min(560px, calc(100vh - 80px))",
        }}
      >
        <div className="ap-terminal-list">
          {items.length === 0 && (
            <div className="ap-faint ap-mono" style={{ padding: "12px 14px", fontSize: 12 }}>
              Static on the downlink — no commands match.
            </div>
          )}
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={"ap-terminal-item" + (i === idx ? " ap-terminal-item--active" : "")}
              onMouseEnter={() => setIdx(i)}
              onClick={() => runItem(item)}
            >
              <span style={{ color: "var(--signal)" }}>▸</span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                {item.label}
              </span>
              {item.sub && (
                <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>{item.sub}</span>
              )}
              {item.keys && <Kbd>{item.keys}</Kbd>}
            </button>
          ))}
        </div>

        {/* gap: no terminal-hints row class; faint mono flex above prompt */}
        <div
          className="ap-mono ap-faint"
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            padding: "6px 14px",
            fontSize: 10,
            borderTop: "1px solid var(--line)",
            alignItems: "center",
          }}
        >
          <span><Kbd>Esc</Kbd> Close</span>
          <span><Kbd>↑↓</Kbd> Navigate</span>
          <span><Kbd>Enter</Kbd> Run</span>
        </div>

        <div className="ap-terminal-prompt">
          <span style={{ color: "var(--signal)" }}>UPLINK&gt;</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx((i) => Math.min(items.length - 1, i + 1));
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter" && items[idx]) {
                e.preventDefault();
                runItem(items[idx]);
              }
            }}
            placeholder="issue a command..."
            autoComplete="off"
          />
          <span className="ap-terminal-caret" aria-hidden />
        </div>
      </div>
    </div>
  );
}
