// views/palette.jsx — the Caller (DESIGN.md §5.8). Logic lifted from
// nightwatch/views/palette.jsx; composition is the left index awakened
// into a command panel, not a centered console.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Kbd, MOD, Chip } from "../components.jsx";
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
      return [{
        type: "quickadd",
        id: "quickadd",
        label: raw ? `Add: "${parsed.title || raw}"` : "Quick add — type a task, with !prio #tag @list 2h fri…",
        sub: parsed?.scheduleDate ? "scheduled " + parsed.scheduleDate : (raw ? "to the house" : null),
        chips: parsed?.chips || [],
        keepOpen: !raw,
        run: () => {
          if (!raw) return;
          const task = captureTask(raw, { mode: "task", parsed });
          if (task) {
            enrichCapturedTask(task.id, parsed?.chips.length ? parsed.title : raw, "task", {
              grammarUsed: !!parsed?.chips.length, hasHours: !!parsed?.hours,
            });
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
    <>
      <div className="yz-backdrop" style={{ zIndex: 10004 }} onClick={() => setUI({ paletteOpen: false })} />
      <div className="yz-caller yzd-caller fade-in" role="dialog" aria-label="The Caller" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span className="yz-sec yz-sec--dusk">The Caller</span>
          <div style={{ flex: 1 }} />
          <Kbd>{MOD}K</Kbd>
          <button type="button" className="yz-btn yz-btn--dusk yz-btn--sm" onClick={() => setUI({ paletteOpen: false })}>Close</button>
        </div>
        <div className="yzd-caller-prompt">
          <input ref={inputRef} className="yz-field yz-field--dusk" value={q} placeholder="Speak…" autoComplete="off"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              else if (e.key === "Enter" && items[idx]) { e.preventDefault(); runItem(items[idx]); }
            }} />
        </div>
        <div className="yzd-caller-list scrolly">
          {items.length === 0 && (
            <div className="yz-num" style={{ padding: "12px 8px", fontSize: 13, color: "var(--fg-faint)" }}>Nothing in the house matches.</div>
          )}
          {items.map((item, i) => (
            <button type="button" key={item.id} className={"yzd-caller-item" + (i === idx ? " is-on" : "")}
              onMouseEnter={() => setIdx(i)} onClick={() => runItem(item)}>
              <span style={{ color: "var(--sakura)", flexShrink: 0 }}>▸</span>
              <span className="yzd-item-lbl">{item.label}</span>
              {item.chips && item.chips.length > 0 && (
                <span className="yzd-chips">
                  {item.chips.map((c) => (
                    <Chip key={c.label} dusk>{c.label}</Chip>
                  ))}
                </span>
              )}
              {item.sub && <span className="yzd-item-sub">{item.sub}</span>}
              {item.keys && <Kbd>{item.keys}</Kbd>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
