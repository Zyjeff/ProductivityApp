// dock.jsx — the drawing register. Projects as numbered sheets with
// progressively-inked body-plan sections; the FAIRED stamp contains
// Launch; the as-built register carries the frozen dimension tables.
// All state, handlers, and data flow identical to the core contract.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Stamp, StampPick, Eyebrow, EmptyState, GhostFoot, HLight, DifficultyPip, Rubber } from "../components.jsx";
import { SectionGauge } from "../charts.jsx";
import { GhostSheetNo } from "../drafting.jsx";
import { CaptureTray } from "../capture.jsx";
import { TaskRow, ChunksEditor } from "../taskrow.jsx";
import { vellumTex } from "../texture.js";
import * as D from "../../../core/domain.js";
import {
  useStore, getState, setUI, setCompletion, addTask, notify, updateTask,
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
  const launched = projects.filter((p) => p.completedAt).sort((a, b) => (b.shippedAt || 0) - (a.shippedAt || 0));

  return (
    <div className="lf-sheet">
      <div className="lf-head" style={{ marginBottom: 20 }}>
        <GhostSheetNo text={String(active.length).padStart(2, "0")} />
        <div className="w-stencil-row" style={{ marginBottom: 8 }}>
          <span className="w-stencil w-stencil--lit">The plan chest · sheets in hand</span>
        </div>
        <div className="lf-greeting-row">
          <h1 className="w-display lf-greeting">The drawing register.</h1>
          <div className="lf-count w-num">
            {active.length} IN HAND{ready.length ? <span style={{ color: "var(--starboard)" }}> · {ready.length} FAIRED</span> : null} · {launched.length} AS-BUILT
          </div>
        </div>
        <div style={{ marginBottom: 4 }}>
          <CaptureTray />
        </div>
      </div>

      <div className="lf-board">
        <div className="lf-work">
          <div className="lf-section-head">
            <div className="w-stencil-row" style={{ flex: 1 }}>
              <span className="w-stencil">{tab === "projects" ? "Sheets in hand" : "The file"}</span>
            </div>
            <div className="lf-tray-types" role="group" aria-label="Register section">
              <button className={tab === "projects" ? "on" : ""} onClick={() => setUI({ dockFilter: { ...filter, tab: "projects" }, cursor: null })}>Sheets</button>
              <button className={tab === "library" ? "on" : ""} onClick={() => setUI({ dockFilter: { ...filter, tab: "library" }, cursor: null })}>File</button>
            </div>
          </div>
          {tab === "projects" ? <SheetsTab /> : <FileTab />}
        </div>

        <aside className="lf-aux">
          <div className="lf-aux-section">
            <div className="w-stencil-row" style={{ marginBottom: 10 }}><span className="w-stencil">As-built register</span></div>
            {launched.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>Nothing built yet.</div>
            ) : (
              <AsBuiltRail launched={launched} />
            )}
          </div>
          <div className="lf-aux-section">
            <GhostFoot caption={launched.length ? `${launched.length} sheet${launched.length === 1 ? "" : "s"} gone to the yard` : "the yard awaits drawings"} />
          </div>
        </aside>
      </div>
      <BuildNoteDialog />
    </div>
  );
}

/* ── as-built register (rail) ──────────────────────────────── */

function AsBuiltRail({ launched }) {
  const [openId, setOpenId] = useState(null);
  return (
    <div className="lf-ledger">
      {launched.map((p) => {
        const open = openId === p.id;
        const stats = p.launchStats;
        return (
          <div key={p.id} className="lf-manifest-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div onClick={() => setOpenId(open ? null : p.id)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
              <Rubber tone="var(--port)" style={{ fontSize: 7.5, padding: "0 4px", flexShrink: 0 }}>As-built</Rubber>
              <span style={{ flex: 1, fontSize: 12.5, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
              {p.launchNote && <span title="Has a surveyor's remark" style={{ fontSize: 8, color: "var(--starboard)" }}>●</span>}
              <Stamp>{D.fmtDate(p.shippedAt || p.completedAt).toUpperCase()}</Stamp>
              {stats && <span className="w-num" style={{ fontSize: 9.5, color: "var(--amber)" }}>+{stats.xp}</span>}
            </div>
            {open && (
              <div className="lf-fade" style={{ marginTop: 8, padding: "10px 10px 10px 12px", background: "var(--well)", boxShadow: "inset 0 1px 2px rgba(33,28,18,0.14)" }}>
                {stats && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                    <Stamp kind="green">{stats.doneTasks}/{stats.tasks} tasks</Stamp>
                    <Stamp kind="amber">{stats.xp} XP</Stamp>
                    <Stamp>{stats.estHours}h est{stats.actualMs ? ` · ${D.fmtMs(stats.actualMs)}` : ""}</Stamp>
                    <Stamp>{stats.spanDays}d build</Stamp>
                  </div>
                )}
                {p.launchNote ? (
                  <div style={{ fontSize: 12, color: "var(--fg-dim)", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 8 }}>{p.launchNote}</div>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--fg-faint)", fontStyle: "italic", marginBottom: 8 }}>No surveyor's remark on this build yet.</div>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="lf-bezel lf-bezel--sm" onClick={() => setUI({ launchNoteFor: p.id })}>
                    <Icon name="edit" size={10} /> {p.launchNote ? "Edit remark" : "Write remark"}
                  </button>
                  <button className="lf-bezel lf-bezel--sm" onClick={() => unshipProject(p.id)} title="Return to the board">Back to the board</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── build-note console ────────────────────────────────────── */

function deterministicBuildDraft(stats) {
  if (!stats) return "";
  return `Built with ${stats.doneTasks}/${stats.tasks} tasks done and ${stats.xp} XP earned. ` +
    `Estimated ${stats.estHours}h${stats.actualMs ? `, actually focused ${D.fmtMs(stats.actualMs)}` : ""}. ` +
    `First line to launch: ${stats.spanDays} day${stats.spanDays === 1 ? "" : "s"}.`;
}

function BuildNoteDialog() {
  const forId = useStore((s) => s.ui.launchNoteFor);
  if (!forId) return null;
  return <BuildNoteInner key={forId} projectId={forId} />;
}

function BuildNoteInner({ projectId }) {
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
    setNote(deterministicBuildDraft(stats));
    aiLaunchNote(project, stats || {}).then((text) => {
      if (alive && text) setNote(text);
    }).catch(() => {}).finally(() => alive && setDrafting(false));
    return () => { alive = false; };
  }, [projectId]);

  if (!project) { setUI({ launchNoteFor: null }); return null; }

  return (
    <div className="lf-backdrop" onClick={() => setUI({ launchNoteFor: null })}
      style={{ zIndex: 10004, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="lf-console lf-fade" style={{ width: "100%", maxWidth: 470 }}>
        <div className="lf-console-head">
          <span className="w-tape w-tape--starboard"><Icon name="ship" size={10} /> Surveyor's remark</span>
          <div style={{ flex: 1 }} />
          <button className="lf-icon-btn" onClick={() => setUI({ launchNoteFor: null })} aria-label="Close"><Icon name="close" size={12} /></button>
        </div>
        <div style={{ padding: "16px 18px 18px" }}>
          <div className="w-display" style={{ fontSize: 21, marginBottom: 12 }}>{project.title}</div>
          {stats && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
              <Stamp kind="green">{stats.doneTasks}/{stats.tasks} tasks</Stamp>
              <Stamp kind="amber">{stats.xp} XP</Stamp>
              <Stamp>{stats.estHours}h est{stats.actualMs ? ` · ${D.fmtMs(stats.actualMs)} focused` : ""}</Stamp>
              <Stamp>{stats.spanDays}d build</Stamp>
            </div>
          )}
          <textarea className="lf-field" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="What was built, and what did it take?"
            style={{ height: 96, marginBottom: 6 }} />
          <div className="w-num" style={{ fontSize: 9.5, color: "var(--fg-faint)", marginBottom: 12 }}>
            {drafting ? "AI IS DRAFTING — EDIT FREELY, YOUR TEXT WINS…"
              : aiStatus === "off" ? "AI OFF — DETERMINISTIC DRAFT PREFILLED; MAKE IT YOURS."
              : "DRAFTED FOR YOU. EDIT, THEN FILE IT."}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="lf-switch lf-switch--launch" style={{ flex: 1 }} onClick={() => saveLaunchNote(projectId, note)}>
              <Icon name="check" size={12} /> File it
            </button>
            <button className="lf-bezel" onClick={() => setUI({ launchNoteFor: null })}>Skip</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── sheets in hand ────────────────────────────────────────── */

function SheetsTab() {
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
  useEffect(() => { if (adding) nameRef.current?.focus(); }, [adding]);
  useEffect(() => { if (addingTaskTo) taskRef.current?.focus(); }, [addingTaskTo]);

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const active = projects.filter((p) => !p.completedAt)
    .filter((p) => typeFilter === "All" || p.type === typeFilter)
    .sort((a, b) => D.progressOfProject(b, tasksById) - D.progressOfProject(a, tasksById));
  const activeAnyType = projects.some((p) => !p.completedAt);

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
      if (!newTasks.length) { notify("The AI returned no tasks — nothing was added"); }
      else {
        for (const t of newTasks) addChildToProject(project.id, { ...t, desc: t.description });
        notify(`Added ${newTasks.length} task${newTasks.length > 1 ? "s" : ""}`);
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
            <StampPick active={typeFilter === "All"} onClick={() => setTypeFilter("All")}>All</StampPick>
            {D.PROJECT_TYPES.map((t) => (
              <StampPick key={t.id} active={typeFilter === t.id} onClick={() => setTypeFilter(t.id)}>{t.label}</StampPick>
            ))}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <button className="lf-switch lf-switch--sm" onClick={() => setAdding(true)}>
          <Icon name="plus" size={11} /> New sheet
        </button>
      </div>

      {adding && (
        <div className="lf-plate lf-fade" style={{ padding: 14, marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <input ref={nameRef} className="lf-field" placeholder="Project name" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitNew(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }} />
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {D.PROJECT_TYPES.map((t) => (
              <StampPick key={t.id} active={newType === t.id} onClick={() => setNewType(t.id)}>{t.label}</StampPick>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="lf-switch lf-switch--sm" onClick={submitNew} disabled={!newName.trim()}>Open the sheet</button>
            <button className="lf-bezel lf-bezel--sm" onClick={() => { setAdding(false); setNewName(""); }}>Cancel</button>
          </div>
        </div>
      )}

      {active.length === 0 && !adding && (
        <EmptyState caption="an empty chest">
          {activeAnyType && typeFilter !== "All"
            ? <>No {D.PROJECT_TYPES.find((t) => t.id === typeFilter)?.label.toLowerCase()} sheets in hand.</>
            : <>No sheets in hand. Open one, or capture with the Sheet mode.</>}
        </EmptyState>
      )}

      <div style={{ marginBottom: 28 }}>
        {active.map((p, sheetIdx) => {
          const pct = D.progressOfProject(p, tasksById);
          const children = (p.childTaskIds || []).map((id) => tasksById.get(id)).filter(Boolean);
          const doneCount = children.filter((c) => c.completed).length;
          const isReady = pct === 100 && children.length > 0;
          const isOpen = expandedId === p.id;
          const typeLbl = D.PROJECT_TYPES.find((t) => t.id === p.type)?.label || "Other";
          return (
            <div key={p.id} className="lf-register lf-fade" style={{ "--u-fade": vellumTex("sheet-" + p.id) }}>
              {isReady && (
                <span className="lf-register-ready">
                  <Rubber tone="var(--starboard)" onClick={() => shipProject(p.id)} title="Send to the yard" style={{ fontSize: 8.5 }}>
                    Faired — ready to build
                  </Rubber>
                </span>
              )}
              <div className="lf-register-head" onClick={() => setExpandedId(isOpen ? null : p.id)}>
                <SectionGauge pct={pct} color={isReady ? "var(--starboard)" : p.color} frames={children.length} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="w-display lf-register-title">
                    <span className="w-num" style={{ fontSize: 11, color: "var(--fg-faint)", marginRight: 8 }}>SHT {String(sheetIdx + 1).padStart(2, "0")}</span>
                    {p.title}
                  </div>
                  <div className="lf-register-meta">
                    <Stamp>{children.length === 0 ? "NO LINES" : `${doneCount}/${children.length} LINES`}</Stamp>
                    <Stamp tone={p.color}>{typeLbl.toUpperCase()}</Stamp>
                    {p.desc && <Stamp>{p.desc.slice(0, 44).toUpperCase()}</Stamp>}
                  </div>
                </div>
                {isReady && (
                  <button className="lf-switch lf-switch--launch" onClick={(e) => { e.stopPropagation(); shipProject(p.id); }}>
                    <Icon name="ship" size={12} /> Launch
                  </button>
                )}
                <button className="lf-bezel" onClick={(e) => { e.stopPropagation(); setExpandedId(isOpen ? null : p.id); }}>
                  {isOpen ? "Roll up" : "Unroll"}
                </button>
              </div>

              {isOpen && (
                <div className="lf-fade" style={{ padding: "0 18px 16px" }}>
                  <SheetDesc project={p} />
                  <div className="lf-ledger" style={{ marginTop: 12, background: "var(--well)" }}>
                    {children.map((t) => (
                      <div key={t.id} className="lf-row" style={{ minHeight: 36, "--row-lamp": t.completed ? "var(--line-dim)" : p.color }}>
                        <HLight square done={t.completed}
                          onComplete={() => setCompletion(t.id, { done: true })}
                          onReopen={() => setCompletion(t.id, { done: false })} />
                        <span style={{ flex: 1, fontSize: 12.5, color: t.completed ? "var(--fg-faint)" : "var(--fg)", textDecoration: t.completed ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}
                          onClick={() => setUI({ editingTaskId: t.id, formOpen: true })}>{t.title}</span>
                        <span className="w-num" style={{ fontSize: 10, color: "var(--fg-faint)" }}>{t.xp} XP</span>
                        <button className="lf-icon-btn" onClick={() => detachFromProject(t.id)} title="Take off this sheet" aria-label="Detach"><Icon name="close" size={11} /></button>
                      </div>
                    ))}
                  </div>

                  {addingTaskTo === p.id ? (
                    <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}>
                      <input ref={taskRef} className="lf-field" placeholder="Task name" value={newTaskName} style={{ flex: 1 }}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") submitTask(p.id); if (e.key === "Escape") { setAddingTaskTo(null); setNewTaskName(""); } }} />
                      <button className="lf-switch lf-switch--sm" onClick={() => submitTask(p.id)} disabled={!newTaskName.trim()}>Add</button>
                      <button className="lf-bezel lf-bezel--sm" onClick={() => { setAddingTaskTo(null); setNewTaskName(""); }}>Done</button>
                    </div>
                  ) : aiAddingTo === p.id ? (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      <textarea autoFocus value={aiQuery} disabled={aiBusy} className="lf-field"
                        onChange={(e) => setAiQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submitAiExtend(p); }
                          else if (e.key === "Escape" && !aiBusy) { setAiAddingTo(null); setAiQuery(""); }
                        }}
                        placeholder="Describe the lines to add — e.g. 'API hookup and login screen, plus a polish pass'"
                        style={{ height: 52 }} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="lf-switch lf-switch--sm" disabled={!aiQuery.trim() || aiBusy} onClick={() => submitAiExtend(p)}>
                          {aiBusy ? "Drafting…" : "Draft the lines"}
                        </button>
                        <button className="lf-bezel lf-bezel--sm" disabled={aiBusy} onClick={() => { setAiAddingTo(null); setAiQuery(""); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <button className="lf-bezel lf-bezel--sm" onClick={() => { setAddingTaskTo(p.id); setNewTaskName(""); }}>
                        <Icon name="plus" size={10} /> Add line
                      </button>
                      <button className="lf-bezel lf-bezel--sm" onClick={() => { setAiAddingTo(p.id); setAiQuery(""); }}>
                        <Icon name="bolt" size={10} /> AI draft lines
                      </button>
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line-dim)", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }} title="Sheet ink color">
                      {D.PROJECT_PALETTE.map((c) => (
                        <button key={c} onClick={() => updateProject(p.id, { color: c })} aria-label={"Set color " + c}
                          style={{
                            width: 13, height: 13, background: c, padding: 0, cursor: "pointer",
                            border: p.color === c ? "2px solid var(--fg)" : "1px solid var(--line)",
                          }} />
                      ))}
                    </div>
                    <div style={{ flex: 1 }} />
                    <RenameButton project={p} />
                    <button className="lf-bezel lf-bezel--sm lf-bezel--port" onClick={() => deleteProject(p.id)}>Strike</button>
                    {isReady && (
                      <button className="lf-switch lf-switch--launch" onClick={() => shipProject(p.id)}>
                        <Icon name="ship" size={12} /> Launch
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function RenameButton({ project }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.title);
  if (!editing) return <button className="lf-bezel lf-bezel--sm" onClick={() => { setName(project.title); setEditing(true); }}>Retitle</button>;
  const commit = () => { if (name.trim()) updateProject(project.id, { title: name.trim() }); setEditing(false); };
  return (
    <input autoFocus className="lf-bare" value={name} style={{ width: 180 }}
      onChange={(e) => setName(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }} />
  );
}

function SheetDesc({ project }) {
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
      return <button className="lf-link" style={{ color: "var(--fg-faint)", textTransform: "none", letterSpacing: 0 }} onClick={() => setEditing(true)}>+ add title-block notes</button>;
    }
    return (
      <div onClick={() => setEditing(true)} title="Click to revise"
        style={{ padding: "8px 10px", background: "var(--well)", fontSize: 12.5, color: "var(--fg-dim)", lineHeight: 1.5, cursor: "text", whiteSpace: "pre-wrap", boxShadow: "inset 0 1px 2px rgba(33,28,18,0.14)" }}>
        {project.desc}
      </div>
    );
  }
  return (
    <textarea autoFocus className="lf-field" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); setDraft(project.desc || ""); setEditing(false); }
        else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
      }}
      placeholder="What this sheet draws, why it matters, what done looks like."
      style={{ height: 64 }} />
  );
}

/* ── the file (library) ────────────────────────────────────── */

function FileTab() {
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
  const [filingId, setFilingId] = useState(null);
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
      if (!result.length) { notify("No tasks found in that screenshot"); }
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
    notify(`Imported ${picks.length} task${picks.length > 1 ? "s" : ""}`);
    setParsed(null); setImportSel(new Set()); setImportMakeProject(false); setImportProjectName("");
  };

  // "File under…": assign a loose task to a sheet.
  const fileUnder = (taskId, projectId) => {
    updateTask(taskId, { projectId, projectIdChanged: true });
    const proj = projectsById.get(projectId);
    notify(`Filed under ${proj ? `"${proj.title}"` : "the sheet"}`);
    setFilingId(null);
  };

  let cursorIdx = cursor ? cursor.index : -1;

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {["pending", "recurring", "done", "all"].map((f) => (
            <StampPick key={f} active={filter.status === f} onClick={() => setF({ status: f })}>{f}</StampPick>
          ))}
        </div>
        {filter.status === "pending" && (
          <>
            <span style={{ width: 1, height: 14, background: "var(--line)" }} />
            <div style={{ display: "flex", gap: 4 }}>
              {[["priority", "priority"], ["energy", "energy"], ["xp", "XP"], ["newest", "newest"], ["oldest", "oldest"]].map(([id, lbl]) => (
                <StampPick key={id} active={filter.sort === id} onClick={() => setF({ sort: id })}>{lbl}</StampPick>
              ))}
            </div>
          </>
        )}
        <div style={{ flex: 1 }} />
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ""; }} />
        <button className="lf-bezel lf-bezel--sm" onClick={() => fileRef.current?.click()} disabled={importing}
          title="Trace tasks from a screenshot of another tool">
          {importing ? "Tracing…" : <><Icon name="camera" size={11} /> Trace a screenshot</>}
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <input className="lf-field lf-field--mono" placeholder="Search the file…" value={filter.q} onChange={(e) => setF({ q: e.target.value })} style={{ width: 200, padding: "6px 9px" }} />
        {projects.length > 0 && (
          <select className="lf-field" value={filter.project || ""} onChange={(e) => setF({ project: e.target.value || null })} style={{ width: 170, padding: "6px 9px" }}>
            <option value="">All sheets</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        )}
        {usedTags.map((t) => (
          <StampPick key={t} active={filter.tag === t} onClick={() => setF({ tag: filter.tag === t ? null : t })}>#{t}</StampPick>
        ))}
      </div>

      {parsed && (
        <div className="lf-plate lf-fade" style={{ padding: 14, marginBottom: 14 }}>
          <Eyebrow right={<button className="lf-icon-btn" onClick={() => setParsed(null)} aria-label="Discard"><Icon name="close" size={12} /></button>} lit>
            Trace preview · {parsed.length} found
          </Eyebrow>
          <div className="lf-scroll" style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto", marginBottom: 10 }}>
            {parsed.map((p, i) => {
              const on = importSel.has(i);
              return (
                <div key={i} onClick={() => setImportSel((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: on ? "var(--well)" : "transparent", opacity: on ? 1 : 0.5, cursor: "pointer", boxShadow: on ? "inset 3px 0 0 " + (D.DIFFICULTY[p.difficulty]?.tone || "var(--channel)") : "inset 3px 0 0 var(--line-dim)" }}>
                  <HLight square done={on} onComplete={() => {}} onReopen={() => {}} label="Include" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                    {p.description && <div style={{ fontSize: 11, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</div>}
                  </div>
                  <div className="w-num" style={{ display: "flex", gap: 6, fontSize: 9.5, color: "var(--fg-faint)", flexShrink: 0, alignItems: "center" }}>
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
              Group onto a sheet:
            </label>
            <input className="lf-field" value={importProjectName} onChange={(e) => setImportProjectName(e.target.value)}
              placeholder="Sheet name" disabled={!importMakeProject} style={{ maxWidth: 220, opacity: importMakeProject ? 1 : 0.5, padding: "6px 9px" }} />
            <div style={{ flex: 1 }} />
            <button className="lf-bezel lf-bezel--sm" onClick={() => setParsed(null)}>Cancel</button>
            <button className="lf-switch lf-switch--sm" disabled={importSel.size === 0} onClick={commitImport}>
              Import {importSel.size}
            </button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState caption="an empty file">Nothing matches.</EmptyState>
      ) : (
        <div className="lf-plate lf-plate--flush lf-ledger" style={{ marginBottom: 28 }}>
          {list.map((t, i) => {
            const chunks = D.getTaskChunks(t.id, plan);
            const isSplit = chunks.length > 1;
            const scheduled = D.getTaskScheduledDate(t.id, plan);
            const canFile = !t.projectId && !t.completed && t.recurring === "none" && activeProjects.length > 0;
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
                      {canFile && (
                        <div style={{ marginBottom: isSplit ? 8 : 0 }}>
                          {filingId === t.id ? (
                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                              <span className="w-stencil" style={{ fontSize: 8.5 }}>File under</span>
                              {activeProjects.map((p) => (
                                <StampPick key={p.id} color={p.color} onClick={() => fileUnder(t.id, p.id)}>{p.title}</StampPick>
                              ))}
                              <button className="lf-icon-btn" onClick={() => setFilingId(null)} aria-label="Cancel filing"><Icon name="close" size={10} /></button>
                            </div>
                          ) : (
                            <button className="lf-bezel lf-bezel--sm" onClick={() => setFilingId(t.id)} title="Assign to a sheet">
                              <Icon name="pen" size={10} /> File under…
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
