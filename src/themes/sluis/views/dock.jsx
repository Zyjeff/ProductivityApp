// dock.jsx — De Haven, Sluis cut: a top-down basin with every project
// a moored vessel at a seeded berth, the selected ship's berth panel
// below, the yard register with screenshot import and one-click
// Aanleggen, and the vaartregister of launched ships. All state,
// handlers, and data flow identical to the core contract (lifted from
// the Nightwatch dock, recomposed per the Sluis spec).

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Icon, Kbd, Chip, ChipPick, Meter, CompleteButton, DifficultyPip,
  Eyebrow, EmptyState, seededUnit, MOD,
} from "../components.jsx";
import { CaptureSlab } from "../capture.jsx";
import { TaskRow, ChunksEditor } from "../taskrow.jsx";
import * as D from "../../../core/domain.js";
import {
  useStore, setUI, setCompletion, addTask, notify, updateTask,
  createProject, updateProject, deleteProject, shipProject, unshipProject,
  addChildToProject, detachFromProject, saveLaunchNote,
} from "../../../core/store.js";
import { registerActiveList } from "../../../core/keys.js";
import { aiExtendProject, aiImportFromScreenshot, aiLaunchNote, aiFailureMessage } from "../../../core/ai.js";
import { scoreTask } from "../../../core/enrich.js";

export function DockView() {
  const filter = useStore((s) => s.ui.dockFilter);
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const tab = filter.tab;
  const active = projects.filter((p) => !p.completedAt);
  const ready = active.filter((p) => (p.childTaskIds || []).length > 0 && D.progressOfProject(p, tasksById) === 100);

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div className="s-stencil-row" style={{ marginBottom: 10 }}>
          <span className="s-stencil s-stencil--lit">De haven · schepen bouwen &amp; te water laten</span>
        </div>
        <h1 className="s-display" style={{ fontSize: 30, margin: "0 0 4px", letterSpacing: "-0.01em" }}>De haven.</h1>
        <div className="s-num" style={{ fontSize: 11, color: "var(--fg-dim)", marginBottom: 14 }}>
          {active.length} AANGEMELD
          {ready.length ? <span style={{ color: "var(--amber-deep)" }}> · {ready.length} KLAAR VOOR T WATER</span> : null}
          {" "}· {projects.filter((p) => p.completedAt).length} TE WATER
        </div>
        <div style={{ marginBottom: 12 }}>
          <CaptureSlab />
        </div>
        <div style={{ display: "flex", gap: 6 }} role="group" aria-label="Haven section">
          <ChipPick active={tab === "projects"} onClick={() => setUI({ dockFilter: { ...filter, tab: "projects" }, cursor: null })}>
            Schepen
          </ChipPick>
          <ChipPick active={tab === "library"} onClick={() => setUI({ dockFilter: { ...filter, tab: "library" }, cursor: null })}>
            Register
          </ChipPick>
        </div>
      </div>

      {tab === "projects" ? <SchepenTab /> : <RegisterTab />}
      <LaunchNoteDialog />
    </div>
  );
}

/* ── Schepen: the basin, the berth, the vaartregister ──────── */

function SchepenTab() {
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const [expandedId, setExpandedId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [typeFilter, setTypeFilter] = useState("All");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("client");
  const [addingTaskTo, setAddingTaskTo] = useState(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [aiAddingTo, setAiAddingTo] = useState(null);
  const [aiQuery, setAiQuery] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const nameRef = useRef(null);
  const taskRef = useRef(null);
  const createRef = useRef(null);
  const berthRef = useRef(null);
  useEffect(() => { if (adding) nameRef.current?.focus(); }, [adding]);
  useEffect(() => { if (addingTaskTo) taskRef.current?.focus(); }, [addingTaskTo]);
  useEffect(() => {
    if (expandedId) setTimeout(() => berthRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 40);
  }, [expandedId]);

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const allActive = projects.filter((p) => !p.completedAt);
  const active = allActive
    .filter((p) => typeFilter === "All" || p.type === typeFilter)
    .sort((a, b) => D.progressOfProject(b, tasksById) - D.progressOfProject(a, tasksById));
  const activeAnyType = projects.some((p) => !p.completedAt);
  const expanded = expandedId ? allActive.find((p) => p.id === expandedId) || null : null;
  const launched = projects.filter((p) => p.completedAt).sort((a, b) => (b.shippedAt || 0) - (a.shippedAt || 0));

  const startCreate = () => {
    setAdding(true);
    setTimeout(() => createRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 40);
  };
  const submitNew = () => {
    if (!newName.trim()) return;
    const id = createProject({ title: newName.trim(), type: newType });
    setNewName(""); setAdding(false);
    setExpandedId(id); setAddingTaskTo(id);
  };
  const submitTask = (projectId) => {
    if (!newTaskName.trim()) return;
    const t = addChildToProject(projectId, { title: newTaskName.trim() });
    if (t) scoreTask(t.id);
    setNewTaskName("");
  };
  const submitAiExtend = async (project) => {
    const q = aiQuery.trim();
    if (!q || aiBusy) return;
    setAiBusy(true);
    try {
      const children = (project.childTaskIds || []).map((id) => tasksById.get(id)).filter(Boolean);
      const newTasks = await aiExtendProject(project, children, q);
      if (!newTasks.length) { notify("De AI gaf geen taken terug — er is niets toegevoegd"); }
      else {
        for (const t of newTasks) addChildToProject(project.id, { ...t, desc: t.description });
        notify(`${newTasks.length} taak${newTasks.length > 1 ? "s" : ""} toegevoegd`);
        setAiQuery(""); setAiAddingTo(null);
      }
    } catch (e) { notify(aiFailureMessage(e.kind)); }
    setAiBusy(false);
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {activeAnyType && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <ChipPick active={typeFilter === "All"} onClick={() => setTypeFilter("All")}>All</ChipPick>
            {D.PROJECT_TYPES.map((t) => (
              <ChipPick key={t.id} active={typeFilter === t.id} onClick={() => setTypeFilter(t.id)}>{t.label}</ChipPick>
            ))}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <button className="s-btn s-btn--sm" onClick={startCreate}>
          <Icon name="plus" size={11} /> Nieuw schip
        </button>
      </div>

      {adding && (
        <div ref={createRef} className="s-berth s-fade-in" style={{ marginTop: 0, marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <input ref={nameRef} className="s-field" placeholder="Naam van het schip" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitNew(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }} />
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {D.PROJECT_TYPES.map((t) => (
              <ChipPick key={t.id} active={newType === t.id} onClick={() => setNewType(t.id)}>{t.label}</ChipPick>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="s-btn s-btn--sm" onClick={submitNew} disabled={!newName.trim()}>Bouw het schip</button>
            <button className="s-btn s-btn--ghost s-btn--sm" onClick={() => { setAdding(false); setNewName(""); }}>Annuleer</button>
          </div>
        </div>
      )}

      <Basin projects={allActive} tasksById={tasksById} selectedId={expandedId}
        onSelect={(id) => setExpandedId(id)} onNew={startCreate} />

      {expanded && (
        <div ref={berthRef}>
          <BerthPanel project={expanded} tasksById={tasksById}
            addingTaskTo={addingTaskTo} setAddingTaskTo={setAddingTaskTo}
            newTaskName={newTaskName} setNewTaskName={setNewTaskName}
            aiAddingTo={aiAddingTo} setAiAddingTo={setAiAddingTo}
            aiQuery={aiQuery} setAiQuery={setAiQuery} aiBusy={aiBusy}
            taskRef={taskRef} submitTask={submitTask} submitAiExtend={submitAiExtend}
            onClose={() => setExpandedId(null)} />
        </div>
      )}

      {active.length === 0 && !adding ? (
        <EmptyState caption="stil water">
          {activeAnyType && typeFilter !== "All"
            ? <>Geen {D.PROJECT_TYPES.find((t) => t.id === typeFilter)?.label.toLowerCase()} schepen in de haven.</>
            : <>Stil water — geen schip aangemeld. Bouw een schip, of meld er een aan met de Schip-modus.</>}
        </EmptyState>
      ) : (
        <div className="s-register" style={{ marginTop: 14, marginBottom: 28 }}>
          {active.map((p, i) => {
            const pct = D.progressOfProject(p, tasksById);
            const children = (p.childTaskIds || []).map((id) => tasksById.get(id)).filter(Boolean);
            const doneCount = children.filter((c) => c.completed).length;
            const isReady = pct === 100 && children.length > 0;
            const isOpen = expandedId === p.id;
            const typeLbl = D.PROJECT_TYPES.find((t) => t.id === p.type)?.label || "Other";
            return (
              <div key={p.id} className="s-reg-row"
                style={{ padding: "11px 2px", borderTop: i ? "1px dashed var(--line)" : "none", cursor: "pointer" }}
                onClick={() => setExpandedId(isOpen ? null : p.id)}>
                <span style={{ width: 11, height: 11, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                    {isReady && <Chip tone="var(--amber-deep)">Klaar voor tewaterlating</Chip>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
                    <Chip>{children.length === 0 ? "GEEN TAKEN" : `${doneCount}/${children.length} TAKEN`}</Chip>
                    <Chip tone={p.color}>{typeLbl}</Chip>
                    {p.desc && <Chip>{p.desc.slice(0, 44)}</Chip>}
                  </div>
                  <div style={{ marginTop: 7, maxWidth: 420 }}>
                    <Meter pct={pct} tone={isReady ? "var(--amber)" : p.color} height={4} />
                  </div>
                </div>
                <span className="s-num" style={{ fontSize: 11, color: "var(--fg-dim)", flexShrink: 0 }}>{pct}%</span>
                {isReady && (
                  <button className="s-btn s-btn--amber s-btn--sm" style={{ flexShrink: 0 }}
                    onClick={(e) => { e.stopPropagation(); shipProject(p.id); }}>
                    <Icon name="ship" size={12} /> Te water laten
                  </button>
                )}
                <button className="s-btn s-btn--ghost s-btn--sm" style={{ flexShrink: 0 }}
                  onClick={(e) => { e.stopPropagation(); setExpandedId(isOpen ? null : p.id); }}>
                  <Icon name="chevron" size={11} /> {isOpen ? "Aan wal" : "Aan boord"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginBottom: 28 }}>
        <Eyebrow lit>Vaartregister · te water</Eyebrow>
        {launched.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--fg-faint)", padding: "4px 0 8px" }}>
            Nog geen schip te water gelaten — het water wacht.
          </div>
        ) : (
          <ShipLog launched={launched} />
        )}
      </div>
    </>
  );
}

/* ── De Haven: the top-down basin (signature) ──────────────── */

function Basin({ projects, tasksById, selectedId, onSelect, onNew }) {
  return (
    <div className="s-basin">
      <svg viewBox="0 0 1000 220" style={{ display: "block", width: "100%", height: "auto" }} role="list" aria-label="De haven — aangemeerde schepen">
        {/* water */}
        <rect x="6" y="6" width="988" height="208" rx="18" fill="var(--water-ground)" />
        {/* quay edges */}
        <line x1="26" y1="20" x2="974" y2="20" stroke="var(--line-strong)" strokeWidth="2" strokeDasharray="12 9" />
        <line x1="26" y1="200" x2="974" y2="200" stroke="var(--line-strong)" strokeWidth="2" strokeDasharray="12 9" />

        {projects.length === 0 && (
          <text x="500" y="116" textAnchor="middle" fill="var(--fg-faint)"
            style={{ fontFamily: "var(--t-mono)", fontSize: 13, letterSpacing: 2, textTransform: "uppercase" }}>
            stil water — geen schip aangemeerd
          </text>
        )}

        {projects.map((p) => {
          const children = (p.childTaskIds || []).map((id) => tasksById.get(id)).filter(Boolean);
          const pct = D.progressOfProject(p, tasksById);
          const isReady = pct === 100 && children.length > 0;
          const len = 64 + Math.min(children.length, 12) * 8;
          const lane = Math.floor(seededUnit(p.id, "lane") * 3) % 3;
          const cy = 58 + lane * 56 + (seededUnit(p.id, "jy") - 0.5) * 14;
          const cx = Math.max(26 + len / 2, Math.min(974 - len / 2, 70 + seededUnit(p.id, "x") * 860));
          const x0 = cx - len / 2;
          const sel = selectedId === p.id;
          return (
            <g key={p.id} role="listitem" tabIndex={0}
              className={"s-basin-ship" + (sel ? " s-basin-ship--sel" : "")}
              onClick={() => onSelect(p.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p.id); } }}>
              <title>{p.title} · {pct}%</title>
              {isReady && (
                <text x={cx} y={cy - 20} textAnchor="middle" fill="var(--amber-deep)"
                  stroke="rgba(255,255,255,.85)" strokeWidth="3" paintOrder="stroke"
                  style={{ fontFamily: "var(--t-mono)", fontSize: 10, fontWeight: 700, letterSpacing: 1.6 }}>
                  KLAAR VOOR T WATER
                </text>
              )}
              {/* hull, top-down */}
              <rect x={x0} y={cy - 11} width={len} height="22" rx="11"
                fill={p.color} stroke={isReady ? "var(--amber)" : "rgba(16,34,43,.18)"} strokeWidth={isReady ? 2.5 : 1} />
              {/* bow */}
              <path d={`M ${x0 + len - 3} ${cy - 8} L ${x0 + len + 11} ${cy} L ${x0 + len - 3} ${cy + 8} Z`} fill={p.color} />
              {/* bridge */}
              <circle cx={cx - len * 0.26} cy={cy} r="4.5" fill="rgba(255,255,255,.85)" />
              {/* progress under the hull */}
              <rect x={x0} y={cy + 17} width={len} height="4" rx="2" fill="rgba(255,255,255,.6)" />
              {pct > 0 && (
                <rect x={x0} y={cy + 17} width={Math.max(3, (len * pct) / 100)} height="4" rx="2"
                  fill={isReady ? "var(--amber)" : "var(--water-deep)"} />
              )}
            </g>
          );
        })}
      </svg>
      <button className="s-btn s-btn--ghost s-btn--sm" onClick={onNew}
        style={{ position: "absolute", right: 14, bottom: 12, background: "var(--plate)" }}>
        <Icon name="plus" size={11} /> Nieuw schip
      </button>
    </div>
  );
}

/* ── the berth: one expanded ship ──────────────────────────── */

function BerthPanel({
  project: p, tasksById, onClose,
  addingTaskTo, setAddingTaskTo, newTaskName, setNewTaskName,
  aiAddingTo, setAiAddingTo, aiQuery, setAiQuery, aiBusy,
  taskRef, submitTask, submitAiExtend,
}) {
  const pct = D.progressOfProject(p, tasksById);
  const children = (p.childTaskIds || []).map((id) => tasksById.get(id)).filter(Boolean);
  const doneCount = children.filter((c) => c.completed).length;
  const isReady = pct === 100 && children.length > 0;
  const typeLbl = D.PROJECT_TYPES.find((t) => t.id === p.type)?.label || "Other";

  return (
    <div className="s-berth s-fade-in">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ width: 13, height: 13, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
        <span className="s-display" style={{ fontSize: 20, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</span>
        <Chip tone={p.color}>{typeLbl}</Chip>
        <Chip>{children.length === 0 ? "GEEN TAKEN" : `${doneCount}/${children.length} TAKEN`}</Chip>
        <span className="s-num" style={{ fontSize: 11, color: "var(--fg-dim)" }}>{pct}%</span>
        {isReady && (
          <button className="s-btn s-btn--amber s-btn--sm" onClick={() => { shipProject(p.id); onClose(); }}>
            <Icon name="ship" size={12} /> Te water laten
          </button>
        )}
        <button className="s-icon-btn" onClick={onClose} aria-label="Sluit de ligplaats" title="Aan wal"><Icon name="close" size={12} /></button>
      </div>
      <div style={{ marginTop: 10, maxWidth: 520 }}>
        <Meter pct={pct} tone={isReady ? "var(--amber)" : p.color} height={6} />
      </div>

      <div style={{ marginTop: 12 }}>
        <ProjectDesc project={p} />
      </div>

      <div style={{ marginTop: 12, background: "var(--well)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
        {children.length === 0 && (
          <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--fg-faint)", fontStyle: "italic" }}>
            Nog geen lading — voeg de eerste taak toe.
          </div>
        )}
        {children.map((t, i) => (
          <div key={t.id} className="s-reg-row"
            style={{ padding: "8px 12px", borderTop: i ? "1px dashed var(--line)" : "none", minHeight: 38 }}>
            <CompleteButton done={t.completed} size={18}
              onComplete={() => setCompletion(t.id, { done: true })}
              onReopen={() => setCompletion(t.id, { done: false })} />
            <span onClick={() => setUI({ editingTaskId: t.id, formOpen: true })}
              style={{ flex: 1, fontSize: 12.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", color: t.completed ? "var(--fg-faint)" : "var(--fg)", textDecoration: t.completed ? "line-through" : "none" }}>
              {t.title}
            </span>
            <span className="s-num" style={{ fontSize: 10, color: "var(--fg-faint)", flexShrink: 0 }}>{t.xp} XP</span>
            <button className="s-icon-btn" onClick={() => detachFromProject(t.id)} title="Los van het schip" aria-label="Detach">
              <Icon name="close" size={11} />
            </button>
          </div>
        ))}
      </div>

      {addingTaskTo === p.id ? (
        <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}>
          <input ref={taskRef} className="s-field" placeholder="Taaknaam" value={newTaskName} style={{ flex: 1 }}
            onChange={(e) => setNewTaskName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitTask(p.id); if (e.key === "Escape") { setAddingTaskTo(null); setNewTaskName(""); } }} />
          <button className="s-btn s-btn--sm" onClick={() => submitTask(p.id)} disabled={!newTaskName.trim()}>Voeg toe</button>
          <button className="s-btn s-btn--ghost s-btn--sm" onClick={() => { setAddingTaskTo(null); setNewTaskName(""); }}>Klaar</button>
        </div>
      ) : aiAddingTo === p.id ? (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea autoFocus value={aiQuery} disabled={aiBusy} className="s-field"
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submitAiExtend(p); }
              else if (e.key === "Escape" && !aiBusy) { setAiAddingTo(null); setAiQuery(""); }
            }}
            placeholder="Beschrijf de taken — bijv. 'API-koppeling en loginscherm, plus een poetsronde'"
            style={{ minHeight: 52 }} />
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <button className="s-btn s-btn--sm" disabled={!aiQuery.trim() || aiBusy} onClick={() => submitAiExtend(p)}>
              {aiBusy ? "Genereren…" : "Genereer taken"}
            </button>
            <button className="s-btn s-btn--ghost s-btn--sm" disabled={aiBusy} onClick={() => { setAiAddingTo(null); setAiQuery(""); }}>Annuleer</button>
            <span className="s-stencil" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Kbd>{MOD}↵</Kbd> om te genereren
            </span>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button className="s-btn s-btn--ghost s-btn--sm" onClick={() => { setAddingTaskTo(p.id); setNewTaskName(""); }}>
            <Icon name="plus" size={10} /> Voeg taak toe
          </button>
          <button className="s-btn s-btn--ghost s-btn--sm" onClick={() => { setAiAddingTo(p.id); setAiQuery(""); }}>
            <Icon name="bolt" size={10} /> AI taken
          </button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px dashed var(--line)", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }} title="Kleur van het schip">
          {D.PROJECT_PALETTE.map((c) => (
            <button key={c} onClick={() => updateProject(p.id, { color: c })} aria-label={"Set color " + c}
              style={{
                width: 15, height: 15, borderRadius: "50%", background: c, padding: 0, cursor: "pointer",
                border: p.color === c ? "2px solid var(--ink)" : "1px solid var(--line-strong)",
              }} />
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <RenameButton project={p} />
        <button className="s-btn s-btn--ghost s-btn--sm" style={{ color: "var(--port)", borderColor: "var(--port)" }}
          onClick={() => deleteProject(p.id)}>
          Uit de vaart
        </button>
        {isReady && (
          <button className="s-btn s-btn--amber s-btn--sm" onClick={() => { shipProject(p.id); onClose(); }}>
            <Icon name="ship" size={12} /> Te water laten
          </button>
        )}
      </div>
    </div>
  );
}

function RenameButton({ project }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.title);
  if (!editing) {
    return (
      <button className="s-btn s-btn--ghost s-btn--sm" onClick={() => { setName(project.title); setEditing(true); }}>
        <Icon name="edit" size={10} /> Hernoem
      </button>
    );
  }
  const commit = () => { if (name.trim()) updateProject(project.id, { title: name.trim() }); setEditing(false); };
  return (
    <input autoFocus className="s-field" value={name} style={{ width: 200, padding: "5px 9px" }}
      onChange={(e) => setName(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }} />
  );
}

function ProjectDesc({ project }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.desc || "");
  useEffect(() => { setDraft(project.desc || ""); }, [project.desc]);
  const commit = () => {
    const next = draft.trim();
    if (next !== (project.desc || "")) updateProject(project.id, { desc: next });
    setEditing(false);
  };
  if (!editing) {
    if (!project.desc) {
      return (
        <button className="s-stencil" style={{ color: "var(--fg-faint)", letterSpacing: ".14em" }} onClick={() => setEditing(true)}>
          + voeg een beschrijving toe
        </button>
      );
    }
    return (
      <div onClick={() => setEditing(true)} title="Klik om te bewerken"
        style={{ padding: "9px 11px", background: "var(--well)", borderRadius: "var(--r-sm)", fontSize: 12.5, color: "var(--fg-dim)", lineHeight: 1.55, cursor: "text", whiteSpace: "pre-wrap" }}>
        {project.desc}
      </div>
    );
  }
  return (
    <textarea autoFocus className="s-field" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); setDraft(project.desc || ""); setEditing(false); }
        else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
      }}
      placeholder="Wat dit schip is, waarom het vaart, hoe 'klaar' eruitziet."
      style={{ minHeight: 64 }} />
  );
}

/* ── Vaartregister: the ship log ───────────────────────────── */

function ShipLog({ launched }) {
  const [openId, setOpenId] = useState(null);
  return (
    <div className="s-register">
      {launched.map((p, i) => {
        const open = openId === p.id;
        const stats = p.launchStats;
        return (
          <div key={p.id} style={{ borderTop: i ? "1px dashed var(--line)" : "none" }}>
            <div className="s-reg-row" onClick={() => setOpenId(open ? null : p.id)}
              style={{ padding: "10px 2px", cursor: "pointer", userSelect: "none" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--starboard)", flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
              {p.launchNote && <span title="Heeft een logregel" style={{ fontSize: 9, color: "var(--starboard)" }}>●</span>}
              <Chip>{D.fmtDate(p.shippedAt || p.completedAt)}</Chip>
              {stats && <span className="s-num" style={{ fontSize: 10, color: "var(--amber-deep)", flexShrink: 0 }}>+{stats.xp}</span>}
            </div>
            {open && (
              <div className="s-fade-in" style={{ margin: "2px 0 10px", padding: "10px 12px", background: "var(--well)", borderRadius: "var(--r-sm)" }}>
                {stats && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                    <Chip tone="var(--starboard)">{stats.doneTasks}/{stats.tasks} taken</Chip>
                    <Chip tone="var(--amber-deep)">{stats.xp} XP</Chip>
                    <Chip>{stats.estHours}h est{stats.actualMs ? ` · ${D.fmtMs(stats.actualMs)}` : ""}</Chip>
                    <Chip>{stats.spanDays}d bouw</Chip>
                  </div>
                )}
                {p.launchNote ? (
                  <div style={{ fontSize: 12, color: "var(--fg-dim)", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 8 }}>{p.launchNote}</div>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--fg-faint)", fontStyle: "italic", marginBottom: 8 }}>Nog geen logregel voor deze tewaterlating.</div>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="s-btn s-btn--ghost s-btn--sm" onClick={() => setUI({ launchNoteFor: p.id })}>
                    <Icon name="edit" size={10} /> {p.launchNote ? "Bewerk logregel" : "Schrijf logregel"}
                  </button>
                  <button className="s-btn s-btn--ghost s-btn--sm" onClick={() => unshipProject(p.id)} title="Terug naar de haven">
                    Terug naar de haven
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── launch-note console ───────────────────────────────────── */

function deterministicLaunchDraft(stats) {
  if (!stats) return "";
  return `Te water gelaten met ${stats.doneTasks}/${stats.tasks} taken klaar en ${stats.xp} XP verdiend. ` +
    `Geschat ${stats.estHours}h${stats.actualMs ? `, daadwerkelijk ${D.fmtMs(stats.actualMs)} gefocust` : ""}. ` +
    `Eerste taak tot tewaterlating: ${stats.spanDays} dag${stats.spanDays === 1 ? "" : "en"}.`;
}

function LaunchNoteDialog() {
  const forId = useStore((s) => s.ui.launchNoteFor);
  if (!forId) return null;
  return <LaunchNoteInner key={forId} projectId={forId} />;
}

function LaunchNoteInner({ projectId }) {
  const project = useStore((s) => s.projects.find((p) => p.id === projectId));
  const aiStatus = useStore((s) => s.ui.aiStatus);
  const [note, setNote] = useState(project?.launchNote || "");
  const [drafting, setDrafting] = useState(false);
  const stats = project?.launchStats;

  useEffect(() => {
    if (!project) return;
    if (project.launchNote) return;
    let alive = true;
    setDrafting(true);
    setNote(deterministicLaunchDraft(stats));
    aiLaunchNote(project, stats || {}).then((text) => {
      if (alive && text) setNote(text);
    }).catch(() => {}).finally(() => alive && setDrafting(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (!project) { setUI({ launchNoteFor: null }); return null; }

  return (
    <>
      <div className="s-backdrop" style={{ zIndex: 10004 }} onClick={() => setUI({ launchNoteFor: null })} />
      <div className="s-console" role="dialog" aria-label="Logregel — vaartregister" style={{ zIndex: 10005, width: "100%", maxWidth: 470 }}>
        <div className="s-console-body">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Chip tone="var(--water-deep)"><Icon name="ship" size={10} /> Logregel · vaartregister</Chip>
            <div style={{ flex: 1 }} />
            <button className="s-icon-btn" onClick={() => setUI({ launchNoteFor: null })} aria-label="Sluit"><Icon name="close" size={12} /></button>
          </div>
          <div className="s-display" style={{ fontSize: 21, marginBottom: 12 }}>{project.title}</div>
          {stats && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
              <Chip tone="var(--starboard)">{stats.doneTasks}/{stats.tasks} taken</Chip>
              <Chip tone="var(--amber-deep)">{stats.xp} XP</Chip>
              <Chip>{stats.estHours}h est{stats.actualMs ? ` · ${D.fmtMs(stats.actualMs)} gefocust` : ""}</Chip>
              <Chip>{stats.spanDays}d bouw</Chip>
            </div>
          )}
          <textarea className="s-field" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Wat is er te water gelaten, en wat kostte het?"
            style={{ minHeight: 96, marginBottom: 6 }} />
          <div className="s-num" style={{ fontSize: 9.5, color: "var(--fg-faint)", marginBottom: 12 }}>
            {drafting ? "AI SCHRIJFT MEE — BEWERK VRIJ, JOUW TEKST WINT…"
              : aiStatus === "off" ? "AI UIT — DETERMINISTISCH ONTWERP INGEVULD; MAAK ER IETS VAN."
              : "ONTWORPEN VOOR JE. BEWERK HET, LEG HET VAST."}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="s-btn" style={{ flex: 1 }} onClick={() => saveLaunchNote(projectId, note)}>
              <Icon name="check" size={12} /> Leg vast
            </button>
            <button className="s-btn s-btn--ghost" onClick={() => setUI({ launchNoteFor: null })}>Sla over</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Register: the yard library ────────────────────────────── */

function RegisterTab() {
  const tasks = useStore((s) => s.tasks);
  const plan = useStore((s) => s.plan);
  const projects = useStore((s) => s.projects);
  const filter = useStore((s) => s.ui.dockFilter);
  const cursor = useStore((s) => s.ui.cursor);
  const meta = useStore((s) => s.meta);
  const energy = useStore((s) => s.ui.energy);
  const [exp, setExp] = useState(null);
  const [importing, setImporting] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [importSel, setImportSel] = useState(new Set());
  const [importProjectName, setImportProjectName] = useState("");
  const [importMakeProject, setImportMakeProject] = useState(false);
  const [berthingId, setBerthingId] = useState(null);
  const fileRef = useRef(null);

  const hour = meta.dayStartHour || 0;
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const activeProjects = projects.filter((p) => !p.completedAt);
  const usedTags = useMemo(() => {
    const set = new Set();
    for (const t of tasks) for (const tag of t.tags || []) set.add(tag);
    return Array.from(set).sort();
  }, [tasks]);

  const setF = (patch) => setUI({ dockFilter: { ...filter, ...patch }, cursor: null });

  const list = useMemo(() => {
    let arr = tasks.filter((t) => {
      if (filter.status === "pending") return !t.completed;
      if (filter.status === "recurring") return t.recurring !== "none";
      if (filter.status === "done") return t.completed;
      return true;
    });
    if (filter.project) arr = arr.filter((t) => t.projectId === filter.project);
    if (filter.tag) arr = arr.filter((t) => (t.tags || []).includes(filter.tag));
    if (filter.q) {
      const q = filter.q.toLowerCase();
      arr = arr.filter((t) => t.title.toLowerCase().includes(q) || (t.desc || "").toLowerCase().includes(q));
    }
    if (filter.status !== "pending") return arr.slice().sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    if (filter.sort === "energy") return D.sortForEnergy(arr, energy);
    if (filter.sort === "xp") return arr.slice().sort((a, b) => (b.xp || 0) - (a.xp || 0));
    if (filter.sort === "newest") return arr.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (filter.sort === "oldest") return arr.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return arr.slice().sort((a, b) => D.PRIORITIES[a.priority || "medium"].order - D.PRIORITIES[b.priority || "medium"].order);
  }, [tasks, filter, energy]);

  const kbRows = useMemo(() => list.map((t) => ({ taskId: t.id, chunkDate: null, done: t.completed })), [list]);
  useEffect(() => { registerActiveList("library", kbRows); }, [kbRows]);

  const handleImportFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setImporting(true); setParsed(null);
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
      if (!m) throw Object.assign(new Error("bad file"), { kind: "parse" });
      const result = await aiImportFromScreenshot(m[2], m[1]);
      if (!result.length) { notify("Geen taken gevonden in die screenshot"); }
      else {
        setParsed(result);
        setImportSel(new Set(result.map((_, i) => i)));
        const hint = result.find((t) => t.projectHint)?.projectHint || "";
        setImportProjectName(hint);
        setImportMakeProject(!!hint);
      }
    } catch (e) {
      notify(aiFailureMessage(e.kind));
    }
    setImporting(false);
  };

  const commitImport = () => {
    const picks = (parsed || []).filter((_, i) => importSel.has(i));
    if (!picks.length) { setParsed(null); return; }
    let projectId = null;
    if (importMakeProject && importProjectName.trim()) {
      projectId = createProject({ title: importProjectName.trim(), type: "other" });
    }
    for (const p of picks) {
      addTask({
        title: p.title, desc: p.description, priority: p.priority, projectId,
        hours: p.hours, xp: p.xp, difficulty: p.difficulty, completed: p.completed,
      });
    }
    notify(`${picks.length} taak${picks.length > 1 ? "s" : ""} geïmporteerd`);
    setParsed(null); setImportSel(new Set()); setImportMakeProject(false); setImportProjectName("");
  };

  // One-click "Aanleggen": assign an unassigned task to an active project.
  const berthTask = (taskId, projectId) => {
    updateTask(taskId, { projectId, projectIdChanged: true });
    const proj = projectsById.get(projectId);
    notify(`Aangelegd bij ${proj ? `"${proj.title}"` : "het schip"}`);
    setBerthingId(null);
  };

  let cursorIdx = cursor ? cursor.index : -1;

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {["pending", "recurring", "done", "all"].map((f) => (
            <ChipPick key={f} active={filter.status === f} onClick={() => setF({ status: f })}>{f}</ChipPick>
          ))}
        </div>
        {filter.status === "pending" && (
          <select className="s-field" value={filter.sort} onChange={(e) => setF({ sort: e.target.value })}
            style={{ width: 150, padding: "5px 9px" }} aria-label="Sorteer register">
            {[["priority", "priority"], ["energy", "energy"], ["xp", "XP"], ["newest", "newest"], ["oldest", "oldest"]].map(([id, lbl]) => (
              <option key={id} value={id}>{lbl}</option>
            ))}
          </select>
        )}
        <div style={{ flex: 1 }} />
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ""; }} />
        <button className="s-btn s-btn--ghost s-btn--sm" onClick={() => fileRef.current?.click()} disabled={importing}
          title="Importeer taken van een screenshot van een andere tool">
          {importing ? "Lezen…" : <><Icon name="camera" size={11} /> Screenshot import</>}
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <input className="s-field" placeholder="Zoek…" value={filter.q} onChange={(e) => setF({ q: e.target.value })}
          style={{ width: 200, padding: "6px 10px" }} />
        {projects.length > 0 && (
          <select className="s-field" value={filter.project || ""} onChange={(e) => setF({ project: e.target.value || null })}
            style={{ width: 180, padding: "6px 10px" }} aria-label="Filter op schip">
            <option value="">Alle schepen</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        )}
        {usedTags.map((t) => (
          <ChipPick key={t} active={filter.tag === t} onClick={() => setF({ tag: filter.tag === t ? null : t })}>#{t}</ChipPick>
        ))}
      </div>

      {parsed && (
        <div className="s-berth s-fade-in" style={{ marginTop: 0, marginBottom: 14 }}>
          <Eyebrow right={<button className="s-icon-btn" onClick={() => setParsed(null)} aria-label="Verwerp"><Icon name="close" size={12} /></button>} lit>
            Importvoorbeeld · {parsed.length} gevonden
          </Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto", marginBottom: 10 }}>
            {parsed.map((p, i) => {
              const on = importSel.has(i);
              return (
                <div key={i} onClick={() => setImportSel((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", cursor: "pointer",
                    borderRadius: "var(--r-sm)", background: on ? "var(--well)" : "transparent", opacity: on ? 1 : 0.5,
                    boxShadow: "inset 3px 0 0 " + (on ? (D.DIFFICULTY[p.difficulty]?.tone || "var(--channel)") : "var(--line)"),
                  }}>
                  <CompleteButton done={on} size={18} onComplete={() => {}} onReopen={() => {}} label="Neem mee" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                    {p.description && <div style={{ fontSize: 11, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</div>}
                  </div>
                  <div className="s-num" style={{ display: "flex", gap: 6, fontSize: 9.5, color: "var(--fg-faint)", flexShrink: 0, alignItems: "center" }}>
                    <DifficultyPip d={p.difficulty} />
                    <span>{p.hours}H · {p.xp}XP</span>
                    {p.completed && <span style={{ color: "var(--starboard)" }}>DONE</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--fg-dim)", cursor: "pointer" }}>
              <input type="checkbox" checked={importMakeProject} onChange={() => setImportMakeProject((v) => !v)} />
              Groepeer als schip:
            </label>
            <input className="s-field" value={importProjectName} onChange={(e) => setImportProjectName(e.target.value)}
              placeholder="Naam van het schip" disabled={!importMakeProject}
              style={{ maxWidth: 220, opacity: importMakeProject ? 1 : 0.5, padding: "6px 10px" }} />
            <div style={{ flex: 1 }} />
            <button className="s-btn s-btn--ghost s-btn--sm" onClick={() => setParsed(null)}>Annuleer</button>
            <button className="s-btn s-btn--sm" disabled={importSel.size === 0} onClick={commitImport}>
              Importeer {importSel.size}
            </button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState caption="niets in het register">Niets gevonden in het register.</EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
          {list.map((t, i) => {
            const chunks = D.getTaskChunks(t.id, plan);
            const isSplit = chunks.length > 1;
            const scheduled = D.getTaskScheduledDate(t.id, plan);
            const canBerth = !t.projectId && !t.completed && t.recurring === "none" && activeProjects.length > 0;
            return (
              <div key={t.id} style={{ position: "relative" }}>
                <TaskRow task={t}
                  project={t.projectId ? projectsById.get(t.projectId) : null}
                  doneHere={t.recurring !== "none" ? D.isRecurringDoneNow(t, hour) : t.completed}
                  onToggleDone={(done) => setCompletion(t.id, { done })}
                  splitBadge={isSplit ? `split · ${chunks.length}d` : scheduled ? D.fmtIsoShort(scheduled) : null}
                  isCursor={cursorIdx === i}
                  onHoverCursor={() => setUI({ cursor: { index: i } })}
                  expanded={exp === t.id}
                  onToggleExpand={() => setExp(exp === t.id ? null : t.id)}
                  extraExpanded={
                    <>
                      {canBerth && (
                        <div style={{ marginBottom: isSplit ? 8 : 0 }}>
                          {berthingId === t.id ? (
                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                              <span className="s-stencil" style={{ fontSize: 8.5 }}>Leg aan bij</span>
                              {activeProjects.map((p) => (
                                <ChipPick key={p.id} color={p.color} onClick={() => berthTask(t.id, p.id)}>
                                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, flexShrink: 0, display: "inline-block" }} />
                                  {p.title}
                                </ChipPick>
                              ))}
                              <button className="s-icon-btn" onClick={() => setBerthingId(null)} aria-label="Annuleer aanleggen"><Icon name="close" size={10} /></button>
                            </div>
                          ) : (
                            <button className="s-btn s-btn--ghost s-btn--sm" onClick={() => setBerthingId(t.id)} title="Wijs toe aan een schip">
                              <Icon name="anchor" size={10} /> Aanleggen
                            </button>
                          )}
                        </div>
                      )}
                      {isSplit && <ChunksEditor task={t} chunks={chunks} dayStartHour={hour} />}
                    </>
                  }
                  dayStartHour={hour}
                />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
