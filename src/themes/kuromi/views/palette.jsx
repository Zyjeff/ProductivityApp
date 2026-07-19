// palette.jsx — the whisper bubble. "Tell me what to do…" —
// commands, scheme search, and the `>` quick-add branch with the
// same capture grammar as the slab.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Kbd, MOD } from "../components.jsx";
import { glyph, GLYPH_SKULL } from "../sprite.js";
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
  const bubble = useMemo(() => glyph(GLYPH_SKULL, "#ff4d9e"), []);

  const items = useMemo(() => {
    const s = getState();
    if (q.startsWith(">")) {
      const raw = q.slice(1).trim();
      const parsed = raw ? parseQuickAdd(raw, { projects: s.projects }) : null;
      const chipStr = parsed?.chips.length ? "  ·  " + parsed.chips.map((c) => c.label).join("  ") : "";
      return [{
        type: "quickadd",
        id: "quickadd",
        label: raw ? `Stow scheme: "${parsed.title || raw}"${chipStr}` : "Quick add — type a scheme, with !urgent #mark @boss 2h fri…",
        sub: parsed?.scheduleDate ? "schemed for " + parsed.scheduleDate : "to the notebook",
        keepOpen: !raw,
        run: () => {
          if (!raw) return;
          const task = captureTask(raw, { mode: "task", parsed });
          if (task) {
            enrichCapturedTask(task.id, parsed?.chips.length ? parsed.title : raw, "task", { grammarUsed: !!parsed?.chips.length, hasHours: !!parsed?.hours });
            notify("Scheme stowed");
          }
        },
      }];
    }
    const commands = buildCommands().map((c) => ({ type: "cmd", id: c.id, label: c.label, keys: c.keys, run: c.run }));
    const needle = q.trim().toLowerCase();
    let out;
    if (!needle) {
      out = [
        { type: "hint", id: "hint-quickadd", label: "Quick add: start with >", sub: "e.g. > world domination fri 2h !urgent", keepOpen: true, run: () => setQ("> ") },
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
          sub: t.completed ? "pulled off" : "loose",
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
    <div className="k-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setUI({ paletteOpen: false })}>
      <div className="k-palette">
        <div className="k-palette-inputrow">
          <img src={bubble} alt="" style={{ height: 20, imageRendering: "pixelated" }} />
          <input
            ref={inputRef} value={q} placeholder="Tell me what to do…" autoComplete="off"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              else if (e.key === "Enter" && items[idx]) { e.preventDefault(); runItem(items[idx]); }
            }}
          />
        </div>
        <div className="k-palette-list">
          {items.length === 0 && (
            <div className="k-mono-sm k-faint" style={{ padding: "12px 16px" }}>NOTHING IN THE NOTEBOOK MATCHES.</div>
          )}
          {items.map((item, i) => (
            <div
              key={item.id}
              className={"k-palette-item" + (i === idx ? " is-active" : "")}
              onMouseEnter={() => setIdx(i)}
              onClick={() => runItem(item)}
            >
              <span style={{ color: "var(--amber)" }}>▸</span>
              <span className="k-palette-label" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
              {item.sub && <span className="k-palette-sub">{item.sub}</span>}
              {item.keys && <Kbd>{item.keys}</Kbd>}
            </div>
          ))}
        </div>
        <div className="k-palette-hint">
          <span><Kbd>↑↓</Kbd> pick</span>
          <span><Kbd>↵</Kbd> obey</span>
          <span><Kbd>Esc</Kbd> shoo</span>
          <span style={{ marginLeft: "auto" }}><Kbd>{MOD} K</Kbd> anytime</span>
        </div>
      </div>
    </div>
  );
}
