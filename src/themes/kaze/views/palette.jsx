// palette.jsx — "Ask the wind." Same capabilities as the core
// contract: commands, task search, `>` quick add with the capture
// grammar, and the cursor-row commands.

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
        label: raw ? `Mark: "${parsed.title || raw}"${chipStr}` : "Mark a waypoint — type it, with !prio #tag @journey 2h fri daily…",
        sub: parsed?.scheduleDate ? "set for " + parsed.scheduleDate : "into the satchel",
        keepOpen: !raw,
        run: () => {
          if (!raw) return;
          const task = captureTask(raw, { mode: "task", parsed });
          if (task) {
            enrichCapturedTask(task.id, parsed?.chips.length ? parsed.title : raw, "task", { grammarUsed: !!parsed?.chips.length, hasHours: !!parsed?.hours });
            notify("Waypoint marked");
          }
        },
      }];
    }
    const commands = buildCommands().map((c) => ({ type: "cmd", id: c.id, label: c.label, keys: c.keys, run: c.run }));
    const needle = q.trim().toLowerCase();
    let out;
    if (!needle) {
      out = [
        { type: "hint", id: "hint-quickadd", label: "Mark something: start with >", sub: "e.g. > call the framer fri 1h !high", keepOpen: true, run: () => setQ("> ") },
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
          sub: t.completed ? "walked" : "ahead",
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
    <div className="kz-palette-backdrop" onClick={() => setUI({ paletteOpen: false })}>
      <div className="kz-palette kz-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="kz-palette-prompt">
          <span className="kz-note-brush" aria-hidden />
          <input ref={inputRef} value={q} placeholder="Ask the wind…" autoComplete="off"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              else if (e.key === "Enter" && items[idx]) { e.preventDefault(); runItem(items[idx]); }
            }} />
          <span className="kz-label">風</span>
        </div>
        <div className="kz-palette-list kz-scroll">
          {items.length === 0 && <div className="kz-label" style={{ padding: "13px 16px" }}>the wind carries nothing like that.</div>}
          {items.map((item, i) => (
            <button key={item.id} className={"kz-palette-item" + (i === idx ? " is-active" : "")}
              onMouseEnter={() => setIdx(i)} onClick={() => runItem(item)}>
              <span style={{ color: "var(--amber)" }}>›</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
              {item.sub && <span className="sub">{item.sub}</span>}
              {item.keys && <span className="kz-kbd">{item.keys}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
