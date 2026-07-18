// palette.jsx — "Het sein" — the Sluis command palette. A bottom sheet
// rising from the wal: signal a command, search the register, or quick-add
// a vessel with the capture grammar (`>` mode). Logic lifted from the
// Nightwatch palette: buildCommands() inside the memo so cursor-row
// commands appear, fuzzy label filter, task-title search → editor, the
// captureTask + enrichCapturedTask sequence, arrow nav + hover sync,
// Enter runs, keepOpen stays. Esc is handled by the core keyboard layer.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Kbd, Chip } from "../components.jsx";
import { parseQuickAdd } from "../../../core/domain.js";
import { useStore, getState, setUI, captureTask, notify } from "../../../core/store.js";
import { enrichCapturedTask } from "../../../core/enrich.js";
import { buildCommands } from "../../../core/keys.js";

// Grammar-chip tones for the `> ` preview strip (capture grammar types).
const CHIP_TONES = {
  priority: "var(--amber-hot)",
  project: "var(--water)",
  tag: "var(--channel)",
  date: "var(--water-deep)",
  deadline: "var(--port)",
  recurring: "var(--starboard)",
};

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
        label: raw ? `Vang vaartuig: "${parsed.title || raw}"` : "Vang een vaartuig — typ tekst, met !prio #tag @schip 2h fri…",
        sub: parsed?.scheduleDate ? "vaart " + parsed.scheduleDate : "naar de werf",
        chips: parsed?.chips || [],
        keepOpen: !raw,
        run: () => {
          if (!raw) return;
          const task = captureTask(raw, { mode: "task", parsed });
          if (task) {
            enrichCapturedTask(task.id, parsed?.chips.length ? parsed.title : raw, "task", { grammarUsed: !!parsed?.chips.length, hasHours: !!parsed?.hours });
            notify("Vaartuig aangemeld");
          }
        },
      }];
    }
    const commands = buildCommands().map((c) => ({ type: "cmd", id: c.id, label: c.label, keys: c.keys, run: c.run }));
    const needle = q.trim().toLowerCase();
    let out;
    if (!needle) {
      out = [
        { type: "hint", id: "hint-quickadd", label: "Snelvangst: begin met >", sub: "bijv. > factuur IGP fri 1h !high", keepOpen: true, run: () => setQ("> ") },
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
          sub: t.completed ? "doorgeschut" : "open",
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

  const chips = items[0]?.type === "quickadd" ? items[0].chips : null;

  return (
    <div className="s-backdrop" onClick={() => setUI({ paletteOpen: false })}>
      <div className="s-sheet" style={{ maxWidth: 560 }} role="dialog" aria-label="Sein — command palette"
        onClick={(e) => e.stopPropagation()}>
        <div className="s-sheet-grip" />

        <div style={{ padding: "6px 18px 0", flexShrink: 0 }}>
          <div className="s-capture">
            <span style={{ color: "var(--water)", display: "inline-flex", flexShrink: 0 }} aria-hidden>
              <Icon name="gate" size={15} />
            </span>
            <input ref={inputRef} value={q} placeholder="Geef een sein…" autoComplete="off"
              aria-label="Geef een sein"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
                else if (e.key === "Enter" && items[idx]) { e.preventDefault(); runItem(items[idx]); }
              }} />
            <span className="s-stencil" style={{ fontSize: 8.5, flexShrink: 0 }}>Sein</span>
          </div>
          {chips && chips.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, padding: "0 4px" }}>
              {chips.map((c, i) => <Chip key={c.type + i} tone={CHIP_TONES[c.type]}>{c.label}</Chip>)}
            </div>
          )}
        </div>

        <div style={{ overflowY: "auto", padding: "10px 12px 6px", display: "flex", flexDirection: "column", gap: 2 }}>
          {items.length === 0 && (
            <div className="s-num" style={{ padding: "12px 16px", fontSize: 11, color: "var(--fg-faint)" }}>
              STIL WATER — NIETS PAST BIJ DIT SEIN.
            </div>
          )}
          {items.map((item, i) => (
            <button key={item.id} type="button"
              onMouseEnter={() => setIdx(i)} onClick={() => runItem(item)}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                padding: "8px 10px", borderRadius: 10, fontSize: 13, lineHeight: 1.35,
                background: i === idx ? "var(--water-ground)" : "transparent",
                color: i === idx ? "var(--water-deep)" : "var(--fg)",
                transition: "background var(--fast)",
              }}>
              <span style={{ flexShrink: 0, display: "inline-flex", color: item.type === "task" ? "var(--fg-faint)" : "var(--water)" }} aria-hidden>
                {item.type === "quickadd" ? <Icon name="plus" size={13} />
                  : item.type === "task" ? <Icon name="edit" size={12} />
                  : "▸"}
              </span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.label}
              </span>
              {item.sub && <span style={{ fontSize: 11, color: "var(--fg-faint)", flexShrink: 0 }}>{item.sub}</span>}
              {item.keys && <Kbd>{item.keys}</Kbd>}
            </button>
          ))}
        </div>

        <button type="button"
          onClick={() => { setQ("> "); inputRef.current?.focus(); }}
          style={{
            flexShrink: 0, width: "100%", padding: "9px 18px 13px",
            borderTop: "1px solid var(--line)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            color: "var(--fg-faint)", fontSize: 11.5,
            transition: "color var(--fast)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--water-deep)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--fg-faint)"; }}>
          <span className="s-stencil" style={{ fontSize: 8.5 }}>Tip</span>
          <span>{"> gevolgd door tekst vangt een vaartuig"}</span>
          <Kbd>{">"}</Kbd>
        </button>
      </div>
    </div>
  );
}
