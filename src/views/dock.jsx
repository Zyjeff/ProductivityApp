// dock.jsx — the dry dock. 1-Bit Harbor: projects are BERTHS (plates
// with dithered arc gauges — the view's signature), the launched fleet
// is the SHIP LOG manifest, the library is the same ledger language as
// Today. All state, handlers, and data flow identical to before.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Chip, Eyebrow, EmptyState, PageHeader, ProgressBar, Checkbox, DifficultyPip, Kbd } from "../components.jsx";
import { ChipChoice } from "../taskform.jsx";
import { TaskRow, ChunksEditor } from "../taskrow.jsx";
import { CaptureBar } from "../capture.jsx";
import { DitherArc } from "../dither.jsx";
import { plateTex } from "../texture.js";
import * as D from "../domain.js";
import {
  useStore, getState, setUI, setCompletion, addTask, notify,
  createProject, updateProject, deleteProject, shipProject, unshipProject,
  addChildToProject, detachFromProject, saveLaunchNote,
} from "../store.js";
import { registerActiveList } from "../keys.js";
import { aiExtendProject, aiImportFromScreenshot, aiLaunchNote, aiFailureMessage } from "../ai.js";
import { scoreTask } from "../enrich.js";

export function DockView() {
  const filter = useStore((s) => s.ui.dockFilter);
  const tab = filter.tab;
  return (
    <div className="w-view-pad" style={{ padding: "26px 34px 48px", maxWidth: 900, margin: "0 auto" }}>
      <PageHeader
        eyebrow="The dry dock"
        title={tab === "projects" ? "Projects" : "Library"}
        sub={tab === "projects" ? "BUILD IN THE YARD · THEN LAUNCH" : "EVERY TASK · FILTERABLE"}
        right={
          <div style={{ display: "inline-flex", background: "var(--well)", boxShadow: "inset 0 1px 0 rgba(0,0,0,0.5)", padding: 2, gap: 2 }}>
            <ChipChoice active={tab === "projects"} onClick={() => setUI({ dockFilter: { ...filter, tab: "projects" }, cursor: null })}>Projects</ChipChoice>
            <ChipChoice active={tab === "library"} onClick={() => setUI({ dockFilter: { ...filter, tab: "library" }, cursor: null })}>Library</ChipChoice>
          </div>
        }
      />
      <div style={{ marginBottom: 20 }}>
        <CaptureBar />
      </div>
      {tab === "projects" ? <ProjectsTab /> : <LibraryTab />}
      <LaunchNoteDialog />
    </div>
  );
}

/* ── ship log: the launch-note ritual ──────────────────────── */

function deterministicLaunchDraft(stats) {
  if (!stats) return "";
  return `Launched with ${stats.doneTasks}/${stats.tasks} tasks done and ${stats.xp} XP earned. ` +
    `Estimated ${stats.estHours}h${stats.actualMs ? `, actually focused ${D.fmtMs(stats.actualMs)}` : ""}. ` +
    `First task to launch: ${stats.spanDays} day${stats.spanDays === 1 ? "" : "s"}.`;
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
  }, [projectId]);

  if (!project) { setUI({ launchNoteFor: null }); return null; }

  return (
    <div className="w-backdrop" onClick={() => setUI({ launchNoteFor: null })}
      style={{ zIndex: 10004, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="w-console w-fade-in" style={{ width: "100%", maxWidth: 470 }}>
        <div className="w-console-head">
          <span className="w-tape w-tape--starboard"><Icon name="ship" size={10} /> Ship log entry</span>
          <div style={{ flex: 1 }} />
          <button className="w-icon-btn" onClick={() => setUI({ launchNoteFor: null })} aria-label="Close"><Icon name="close" size={12} /></button>
        </div>
        <div style={{ padding: "16px 18px 18px" }}>
          <div className="w-display" style={{ fontSize: 21, marginBottom: 12 }}>{project.title}</div>
          {stats && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
              <Chip kind="green">{stats.doneTasks}/{stats.tasks} tasks</Chip>
              <Chip kind="amber">{stats.xp} XP</Chip>
              <Chip>{stats.estHours}h est{stats.actualMs ? ` · ${D.fmtMs(stats.actualMs)} focused` : ""}</Chip>
              <Chip>{stats.spanDays}d build</Chip>
            </div>
          )}
          <div className="w-well" style={{ marginBottom: 6 }}>
            <textarea value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="What shipped, and what did it take?"
              style={{ height: 96 }} />
          </div>
          <div className="w-num" style={{ fontSize: 9.5, color: "var(--fg-faint)", marginBottom: 12 }}>
            {drafting ? "AI IS DRAFTING — EDIT FREELY, YOUR TEXT WINS…"
              : aiStatus === "off" ? "AI OFF — DETERMINISTIC DRAFT PREFILLED; MAKE IT YOURS."
              : "DRAFTED FOR YOU. EDIT, THEN LOG IT."}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="w-switch w-switch--launch" style={{ flex: 1 }} onClick={() => saveLaunchNote(projectId, note)}>
              <Icon name="check" size={12} /> Log it
            </button>
            <button className="w-bezel" onClick={() => setUI({ launchNoteFor: null })}>Skip</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── projects: the berths ──────────────────────────────────── */

function ProjectsTab() {
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const [expandedId, setExpandedId] = useState(null);
  const [showLaunched, setShowLaunched] = useState(true);
  const [openLogId, setOpenLogId] = useState(null);
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
  const launched = projects.filter((p) => p.completedAt)
    .sort((a, b) => (b.shippedAt || 0) - (a.shippedAt || 0));

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
            <ChipChoice active={typeFilter === "All"} onClick={() => setTypeFilter("All")}>All</ChipChoice>
            {D.PROJECT_TYPES.map((t) => (
              <ChipChoice key={t.id} active={typeFilter === t.id} onClick={() => setTypeFilter(t.id)}>{t.label}</ChipChoice>
            ))}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <button className="w-switch w-switch--sm" onClick={() => setAdding(true)}>
          <Icon name="plus" size={11} /> New project
        </button>
      </div>

      {adding && (
        <div className="w-plate w-fade-in" style={{ padding: 14, marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="w-well">
            <input ref={nameRef} placeholder="Project name" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitNew(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }} />
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {D.PROJECT_TYPES.map((t) => (
              <ChipChoice key={t.id} active={newType === t.id} onClick={() => setNewType(t.id)}>{t.label}</ChipChoice>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="w-switch w-switch--sm" onClick={submitNew} disabled={!newName.trim()}>Create</button>
            <button className="w-bezel w-bezel--sm" onClick={() => { setAdding(false); setNewName(""); }}>Cancel</button>
          </div>
        </div>
      )}

      {active.length === 0 && !adding && (
        <EmptyState>
          {activeAnyType && typeFilter !== "All"
            ? <>No {D.PROJECT_TYPES.find((t) => t.id === typeFilter)?.label.toLowerCase()} projects in the yard.</>
            : <>No projects in the yard. Create one, or capture with the Project mode.</>}
        </EmptyState>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {active.map((p) => {
          const pct = D.progressOfProject(p, tasksById);
          const children = (p.childTaskIds || []).map((id) => tasksById.get(id)).filter(Boolean);
          const doneCount = children.filter((c) => c.completed).length;
          const isReady = pct === 100 && children.length > 0;
          const isOpen = expandedId === p.id;
          const tone = isReady ? "var(--starboard)" : p.color;
          const typeLbl = D.PROJECT_TYPES.find((t) => t.id === p.type)?.label || "Other";
          return (
            <div key={p.id} className="w-plate"
              style={{ "--u-fade": plateTex("berth-" + p.id, p.color, 0.5) }}>
              <div onClick={() => setExpandedId(isOpen ? null : p.id)}
                style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 16px", cursor: "pointer", userSelect: "none" }}>
                <DitherArc pct={pct} size={54} tone={tone} label={`${pct}`} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="w-display" style={{ fontSize: 17, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                    {isReady
                      ? <span className="w-tape w-tape--starboard" style={{ fontSize: 8.5 }}>Ready to launch</span>
                      : <Chip>{typeLbl}</Chip>}
                    <span className="w-num" style={{ fontSize: 10, color: "var(--fg-faint)" }}>
                      {children.length === 0 ? "NO TASKS" : `${doneCount}/${children.length} TASKS`}
                    </span>
                  </div>
                </div>
                <span style={{ color: "var(--fg-faint)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform var(--fast)" }}>
                  <Icon name="chevron" size={14} />
                </span>
              </div>

              {isOpen && (
                <div className="w-fade-in" style={{ padding: "0 16px 16px" }}>
                  <ProjectDesc project={p} />
                  <div className="w-ledger" style={{ marginTop: 12, background: "var(--well)" }}>
                    {children.map((t) => (
                      <div key={t.id} className="w-ledger-row" style={{ minHeight: 36, "--row-lamp": t.completed ? "var(--line-dim)" : p.color }}>
                        <Checkbox checked={t.completed} onChange={() => setCompletion(t.id, { done: !t.completed })} />
                        <span style={{ flex: 1, fontSize: 12.5, color: t.completed ? "var(--fg-faint)" : "var(--fg)", textDecoration: t.completed ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}
                          onClick={() => setUI({ editingTaskId: t.id, formOpen: true })}>{t.title}</span>
                        <span className="w-num" style={{ fontSize: 10, color: "var(--fg-faint)" }}>{t.xp} XP</span>
                        <button className="w-icon-btn" onClick={() => detachFromProject(t.id)} title="Detach from project" aria-label="Detach"><Icon name="close" size={11} /></button>
                      </div>
                    ))}
                  </div>

                  {addingTaskTo === p.id ? (
                    <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}>
                      <div className="w-well w-well--sm" style={{ flex: 1 }}>
                        <input ref={taskRef} placeholder="Task name" value={newTaskName}
                          onChange={(e) => setNewTaskName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") submitTask(p.id); if (e.key === "Escape") { setAddingTaskTo(null); setNewTaskName(""); } }} />
                      </div>
                      <button className="w-switch w-switch--sm" onClick={() => submitTask(p.id)} disabled={!newTaskName.trim()}>Add</button>
                      <button className="w-bezel w-bezel--sm" onClick={() => { setAddingTaskTo(null); setNewTaskName(""); }}>Done</button>
                    </div>
                  ) : aiAddingTo === p.id ? (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div className="w-well">
                        <textarea autoFocus value={aiQuery} disabled={aiBusy}
                          onChange={(e) => setAiQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submitAiExtend(p); }
                            else if (e.key === "Escape" && !aiBusy) { setAiAddingTo(null); setAiQuery(""); }
                          }}
                          placeholder="Describe the tasks to add — e.g. 'API hookup and login screen, plus a polish pass'"
                          style={{ height: 52 }} />
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="w-switch w-switch--sm" disabled={!aiQuery.trim() || aiBusy} onClick={() => submitAiExtend(p)}>
                          {aiBusy ? "Generating…" : "Generate tasks"}
                        </button>
                        <button className="w-bezel w-bezel--sm" disabled={aiBusy} onClick={() => { setAiAddingTo(null); setAiQuery(""); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <button className="w-bezel w-bezel--sm" onClick={() => { setAddingTaskTo(p.id); setNewTaskName(""); }}>
                        <Icon name="plus" size={10} /> Add task
                      </button>
                      <button className="w-bezel w-bezel--sm" onClick={() => { setAiAddingTo(p.id); setAiQuery(""); }}>
                        <Icon name="bolt" size={10} /> AI add tasks
                      </button>
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, boxShadow: "inset 0 1px 0 var(--line-dim)", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }} title="Project color">
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
                    <button className="w-bezel w-bezel--sm w-bezel--port" onClick={() => deleteProject(p.id)}>Delete</button>
                    {isReady && (
                      <button className="w-switch w-switch--launch" onClick={() => shipProject(p.id)}>
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

      {launched.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <div className="w-stencil-row" style={{ marginBottom: 12 }}>
            <button className="w-stencil" onClick={() => setShowLaunched(!showLaunched)}
              style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: 0 }}>
              <span style={{ transform: showLaunched ? "rotate(180deg)" : "none", transition: "transform var(--fast)", display: "inline-flex" }}><Icon name="chevron" size={10} /></span>
              Ship log · {launched.length}
            </button>
          </div>
          {showLaunched && (
            <div className="w-plate w-plate--flush w-ledger">
              {launched.map((p) => {
                const open = openLogId === p.id;
                const stats = p.launchStats;
                return (
                  <div key={p.id} className="w-ledger-row" style={{ flexDirection: "column", alignItems: "stretch", "--row-lamp": "var(--starboard)" }}>
                    <div onClick={() => setOpenLogId(open ? null : p.id)}
                      style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
                      <Icon name="ship" size={13} />
                      <span style={{ fontSize: 13, color: "var(--fg)", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                      {p.launchNote && <span title="Has a log entry" style={{ fontSize: 8, color: "var(--starboard)" }}>●</span>}
                      <Chip>{D.PROJECT_TYPES.find((t) => t.id === p.type)?.label || "Other"}</Chip>
                      <span className="w-num" style={{ fontSize: 10, color: "var(--fg-faint)" }}>{D.fmtDate(p.shippedAt || p.completedAt).toUpperCase()}</span>
                      <span style={{ color: "var(--fg-faint)", transform: open ? "rotate(180deg)" : "none", transition: "transform var(--fast)", display: "inline-flex" }}>
                        <Icon name="chevron" size={12} />
                      </span>
                    </div>
                    {open && (
                      <div className="w-fade-in" style={{ margin: "8px -10px -8px -14px", padding: "10px 14px 12px 24px", background: "var(--well)", boxShadow: "inset 0 1px 0 var(--line-dim)" }}>
                        {stats && (
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: p.launchNote ? 10 : 8 }}>
                            <Chip kind="green">{stats.doneTasks}/{stats.tasks} tasks</Chip>
                            <Chip kind="amber">{stats.xp} XP</Chip>
                            <Chip>{stats.estHours}h est{stats.actualMs ? ` · ${D.fmtMs(stats.actualMs)} focused` : ""}</Chip>
                            <Chip>{stats.spanDays}d build</Chip>
                          </div>
                        )}
                        {p.launchNote ? (
                          <div style={{ fontSize: 12.5, color: "var(--fg-dim)", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 8 }}>{p.launchNote}</div>
                        ) : (
                          <div style={{ fontSize: 11.5, color: "var(--fg-faint)", fontStyle: "italic", marginBottom: 8 }}>No log entry for this launch yet.</div>
                        )}
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="w-bezel w-bezel--sm" onClick={() => setUI({ launchNoteFor: p.id })}>
                            <Icon name="edit" size={10} /> {p.launchNote ? "Edit entry" : "Write entry"}
                          </button>
                          <div style={{ flex: 1 }} />
                          <button className="w-bezel w-bezel--sm" onClick={() => unshipProject(p.id)} title="Back to the yard">Unlaunch</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function RenameButton({ project }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.title);
  if (!editing) return <button className="w-bezel w-bezel--sm" onClick={() => { setName(project.title); setEditing(true); }}>Rename</button>;
  const commit = () => { if (name.trim()) updateProject(project.id, { title: name.trim() }); setEditing(false); };
  return (
    <input autoFocus className="w-bare" value={name} style={{ width: 180 }}
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
      return <button className="w-link" style={{ color: "var(--fg-faint)", textTransform: "none", letterSpacing: 0 }} onClick={() => setEditing(true)}>+ add description</button>;
    }
    return (
      <div onClick={() => setEditing(true)} title="Click to edit"
        style={{ padding: "8px 10px", background: "var(--well)", fontSize: 12.5, color: "var(--fg-dim)", lineHeight: 1.5, cursor: "text", whiteSpace: "pre-wrap", boxShadow: "inset 0 1px 0 rgba(0,0,0,0.5)" }}>
        {project.desc}
      </div>
    );
  }
  return (
    <div className="w-well">
      <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); setDraft(project.desc || ""); setEditing(false); }
          else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
        }}
        placeholder="What this project is, why it matters, what done looks like."
        style={{ height: 64 }} />
    </div>
  );
}

/* ── library ───────────────────────────────────────────────── */

function LibraryTab() {
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
  const fileRef = useRef(null);

  const hour = meta.dayStartHour || 0;
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
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

  let cursorIdx = cursor ? cursor.index : -1;

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {["pending", "recurring", "done", "all"].map((f) => (
            <ChipChoice key={f} active={filter.status === f} onClick={() => setF({ status: f })}>{f}</ChipChoice>
          ))}
        </div>
        {filter.status === "pending" && (
          <>
            <span style={{ width: 1, height: 14, background: "var(--line)" }} />
            <div style={{ display: "flex", gap: 4 }}>
              {[["priority", "priority"], ["energy", "energy"], ["xp", "XP"], ["newest", "newest"], ["oldest", "oldest"]].map(([id, lbl]) => (
                <ChipChoice key={id} active={filter.sort === id} onClick={() => setF({ sort: id })}>{lbl}</ChipChoice>
              ))}
            </div>
          </>
        )}
        <div style={{ flex: 1 }} />
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ""; }} />
        <button className="w-bezel w-bezel--sm" onClick={() => fileRef.current?.click()} disabled={importing}
          title="Import tasks from a screenshot of another tool">
          {importing ? "Reading…" : <><Icon name="camera" size={11} /> Screenshot import</>}
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <div className="w-well w-well--sm" style={{ width: 200 }}>
          <input placeholder="Search…" value={filter.q} onChange={(e) => setF({ q: e.target.value })} />
        </div>
        {projects.length > 0 && (
          <div className="w-well w-well--sm" style={{ width: 170 }}>
            <select value={filter.project || ""} onChange={(e) => setF({ project: e.target.value || null })}>
              <option value="">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
        )}
        {usedTags.map((t) => (
          <ChipChoice key={t} active={filter.tag === t} onClick={() => setF({ tag: filter.tag === t ? null : t })}>#{t}</ChipChoice>
        ))}
      </div>

      {parsed && (
        <div className="w-plate w-fade-in" style={{ padding: 14, marginBottom: 14 }}>
          <Eyebrow right={<button className="w-icon-btn" onClick={() => setParsed(null)} aria-label="Discard"><Icon name="close" size={12} /></button>} lit>
            Import preview · {parsed.length} found
          </Eyebrow>
          <div className="w-scroll" style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto", marginBottom: 10 }}>
            {parsed.map((p, i) => {
              const on = importSel.has(i);
              return (
                <div key={i} onClick={() => setImportSel((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: on ? "var(--well)" : "transparent", opacity: on ? 1 : 0.5, cursor: "pointer", boxShadow: on ? "inset 3px 0 0 " + (D.DIFFICULTY[p.difficulty]?.tone || "var(--channel)") : "inset 3px 0 0 var(--line-dim)" }}>
                  <Checkbox checked={on} onChange={() => {}} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                    {p.description && <div style={{ fontSize: 11, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</div>}
                  </div>
                  <div className="w-num" style={{ display: "flex", gap: 6, fontSize: 9.5, color: "var(--fg-faint)", flexShrink: 0 }}>
                    <DifficultyPip d={p.difficulty} />
                    <span>{p.hours}H · {p.xp}XP</span>
                    {p.completed && <span style={{ color: "var(--starboard)" }}>DONE</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--fg-dim)" }}>
              <Checkbox checked={importMakeProject} onChange={() => setImportMakeProject((v) => !v)} />
              Group as project:
            </label>
            <div className="w-well w-well--sm" style={{ maxWidth: 220, opacity: importMakeProject ? 1 : 0.5 }}>
              <input value={importProjectName} onChange={(e) => setImportProjectName(e.target.value)}
                placeholder="Project name" disabled={!importMakeProject} />
            </div>
            <div style={{ flex: 1 }} />
            <button className="w-bezel w-bezel--sm" onClick={() => setParsed(null)}>Cancel</button>
            <button className="w-switch w-switch--sm" disabled={importSel.size === 0} onClick={commitImport}>
              Import {importSel.size}
            </button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState>Nothing matches.</EmptyState>
      ) : (
        <div className="w-plate w-plate--flush w-ledger">
          {list.map((t, i) => {
            const chunks = D.getTaskChunks(t.id, plan);
            const isSplit = chunks.length > 1;
            const scheduled = D.getTaskScheduledDate(t.id, plan);
            return (
              <TaskRow key={t.id} task={t}
                project={t.projectId ? projectsById.get(t.projectId) : null}
                doneHere={t.recurring !== "none" ? D.isRecurringDoneNow(t, hour) : t.completed}
                onToggleDone={(done) => setCompletion(t.id, { done })}
                splitBadge={isSplit ? `split · ${chunks.length}d` : scheduled ? D.fmtIsoShort(scheduled) : null}
                isCursor={cursorIdx === i}
                onHoverCursor={() => setUI({ cursor: { index: i } })}
                expanded={exp === t.id}
                onToggleExpand={() => setExp(exp === t.id ? null : t.id)}
                extraExpanded={isSplit ? <ChunksEditor task={t} chunks={chunks} dayStartHour={hour} /> : null}
                dayStartHour={hour}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
