// palette.jsx — "Issue a command…" — the Nightwatch command palette.
// Same capabilities as the core contract: commands, task search,
// `>` quick add with the capture grammar, cursor-row commands.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Kbd } from "../components.jsx";
import { parseQuickAdd } from "../../../core/domain.js";
import { useStore, getState, setUI, captureTask, notify } from "../../../core/store.js";
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
      const parsed = raw ? parseQuickAdd(raw, { projects: s.projects }) : null;
      const chipStr = parsed?.chips.length ? "  ·  " + parsed.chips.map((c) => c.label).join("  ") : "";
      return [{
        type: "quickadd",
        id: "quickadd",
        label: raw ? `Stow task: "${parsed.title || raw}"${chipStr}` : "Quick add — type a task, with !prio #tag @project 2h fri…",
        sub: parsed?.scheduleDate ? "moored " + parsed.scheduleDate : "to the yard",
        keepOpen: !raw,
        run: () => {
          if (!raw) return;
          const task = captureTask(raw, { mode: "task", parsed });
          if (task) {
            enrichCapturedTask(task.id, parsed?.chips.length ? parsed.title : raw, "task", { grammarUsed: !!parsed?.chips.length, hasHours: !!parsed?.hours });
            notify("Task added");
          }
        },
      }];
    }
    const commands = buildCommands().map((c) => ({ type: "cmd", id: c.id, label: c.label, keys: c.keys, run: c.run }));
    const needle = q.trim().toLowerCase();
    let out;
    if (!needle) {
      out = [
        { type: "hint", id: "hint-quickadd", label: "Quick add: start with >", sub: "e.g. > invoice IGP fri 1h !high", keepOpen: true, run: () => setQ("> ") },
        ...commands.slice(0, 8),
      ];
    } else {
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
      out = [...cmdHits.slice(0, 6), ...taskHits];
    }
    return out;
  }, [q]);

  useEffect(() => { setIdx(0); }, [q]);

  const runItem = (item) => {
    if (!item.keepOpen) setUI({ paletteOpen: false });
    item.run();
  };

  return (
    <div className="palette-backdrop" onClick={() => setUI({ paletteOpen: false })}>
      <div className="palette fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="palette-prompt">
          <span className="slab-caret" aria-hidden />
          <input ref={inputRef} value={q} placeholder="Issue a command…" autoComplete="off"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              else if (e.key === "Enter" && items[idx]) { e.preventDefault(); runItem(items[idx]); }
            }} />
          <span className="w-stencil" style={{ fontSize: 8.5 }}>Command</span>
        </div>
        <div className="palette-list scrolly">
          {items.length === 0 && <div className="w-num" style={{ padding: "12px 16px", fontSize: 11, color: "var(--fg-faint)" }}>NOTHING IN THE MANIFEST MATCHES.</div>}
          {items.map((item, i) => (
            <button key={item.id} className={"palette-item" + (i === idx ? " is-active" : "")}
              onMouseEnter={() => setIdx(i)} onClick={() => runItem(item)}>
              <span style={{ color: "var(--amber)" }}>▸</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
              {item.sub && <span className="sub">{item.sub}</span>}
              {item.keys && <span className="kbd">{item.keys}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
