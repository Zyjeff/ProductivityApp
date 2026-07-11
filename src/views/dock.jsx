// dock.jsx — projects (the launch ritual) + the full task library.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Chip, Eyebrow, EmptyState, PageHeader, ProgressBar, ProgressRing, Checkbox, DifficultyPip } from "../components.jsx";
import { ChipChoice } from "../taskform.jsx";
import { TaskRow, ChunksEditor } from "../taskrow.jsx";
import { CaptureBar } from "../capture.jsx";
import * as D from "../domain.js";
import {
  useStore, getState, setUI, setCompletion, addTask, notify,
  createProject, updateProject, deleteProject, shipProject, unshipProject,
  addChildToProject, detachFromProject,
} from "../store.js";
import { registerActiveList } from "../keys.js";
import { aiExtendProject, aiImportFromScreenshot, aiFailureMessage } from "../ai.js";
import { scoreTask } from "../enrich.js";

const VIEW_PAD = "28px 36px 48px";

export function DockView() {
  const filter = useStore((s) => s.ui.dockFilter);
  const tab = filter.tab;
  return (
    <div className="w-view-pad" style={{ padding: VIEW_PAD, maxWidth: 860, margin: "0 auto" }}>
      <PageHeader
        eyebrow="The dock"
        title={tab === "projects" ? "Projects" : "Library"}
        sub={tab === "projects" ? "Build in the yard, then launch." : "Every task, filterable."}
        right={<CaptureBar />}
      />
      <div style={{ display: "flex", gap: 4, marginBottom: 18 }}>
        <ChipChoice active={tab === "projects"} onClick={() => setUI({ dockFilter: { ...filter, tab: "projects" }, cursor: null })}>Projects</ChipChoice>
        <ChipChoice active={tab === "library"} onClick={() => setUI({ dockFilter: { ...filter, tab: "library" }, cursor: null })}>Library</ChipChoice>
      </div>
      {tab === "projects" ? <ProjectsTab /> : <LibraryTab />}
    </div>
  );
}

/* ── projects ──────────────────────────────────────────────── */

function ProjectsTab() {
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const [expandedId, setExpandedId] = useState(null);
  const [showLaunched, setShowLaunched] = useState(false);
  const [adding, setAdding] = useState(false);
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
    .sort((a, b) => D.progressOfProject(b, tasksById) - D.progressOfProject(a, tasksById));
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
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="w-btn w-btn--primary w-btn--sm" onClick={() => setAdding(true)}>
          <Icon name="plus" size={12} /> New project
        </button>
      </div>

      {adding && (
        <div className="w-card w-fade-in" style={{ padding: 14, marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <input ref={nameRef} className="w-input" placeholder="Project name" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitNew(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }} />
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {D.PROJECT_TYPES.map((t) => (
              <ChipChoice key={t.id} active={newType === t.id} onClick={() => setNewType(t.id)}>{t.label}</ChipChoice>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="w-btn w-btn--primary" onClick={submitNew} disabled={!newName.trim()}>Create</button>
            <button className="w-btn w-btn--ghost" onClick={() => { setAdding(false); setNewName(""); }}>Cancel</button>
          </div>
        </div>
      )}

      {active.length === 0 && !adding && (
        <EmptyState dashed>No projects in the yard. Create one, or capture with the Project mode.</EmptyState>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {active.map((p) => {
          const pct = D.progressOfProject(p, tasksById);
          const children = (p.childTaskIds || []).map((id) => tasksById.get(id)).filter(Boolean);
          const doneCount = children.filter((c) => c.completed).length;
          const isReady = pct === 100 && children.length > 0;
          const isOpen = expandedId === p.id;
          const tone = isReady ? "var(--starboard)" : p.color;
          const typeLbl = D.PROJECT_TYPES.find((t) => t.id === p.type)?.label || "Other";
          return (
            <div key={p.id} className="w-card" style={{
              borderColor: isReady ? "var(--starboard)" : isOpen ? "var(--border-strong)" : "var(--border)",
              background: isReady ? "var(--starboard-soft)" : "var(--bg-elev)",
            }}>
              <div onClick={() => setExpandedId(isOpen ? null : p.id)}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", cursor: "pointer", userSelect: "none" }}>
                <ProgressRing pct={pct} size={36} stroke={3} tone={tone} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <Chip>{typeLbl}</Chip>
                    <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                      {children.length === 0 ? "no tasks" : `${doneCount}/${children.length} tasks`}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", color: tone, minWidth: 40, textAlign: "right" }}>{pct}%</span>
                <span style={{ color: "var(--text-faint)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform var(--t-fast)" }}>
                  <Icon name="chevron" size={14} />
                </span>
              </div>

              {isOpen && (
                <div className="w-fade-in" style={{ borderTop: "1px solid var(--border)", padding: "12px 16px 14px" }}>
                  <ProgressBar pct={pct} tone={tone} height={3} />
                  <ProjectDesc project={p} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 12 }}>
                    {children.map((t) => (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 4px" }}>
                        <Checkbox checked={t.completed} onChange={() => setCompletion(t.id, { done: !t.completed })} />
                        <span style={{ flex: 1, fontSize: 13, color: t.completed ? "var(--text-faint)" : "var(--text)", textDecoration: t.completed ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}
                          onClick={() => setUI({ editingTaskId: t.id, formOpen: true })}>{t.title}</span>
                        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>{t.xp} XP</span>
                        <button className="w-icon-btn" onClick={() => detachFromProject(t.id)} title="Detach from project" aria-label="Detach"><Icon name="close" size={11} /></button>
                      </div>
                    ))}
                  </div>

                  {addingTaskTo === p.id ? (
                    <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}>
                      <input ref={taskRef} className="w-input w-input--sm" placeholder="Task name" value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") submitTask(p.id); if (e.key === "Escape") { setAddingTaskTo(null); setNewTaskName(""); } }}
                        style={{ flex: 1 }} />
                      <button className="w-btn w-btn--primary w-btn--sm" onClick={() => submitTask(p.id)} disabled={!newTaskName.trim()}>Add</button>
                      <button className="w-btn w-btn--ghost w-btn--sm" onClick={() => { setAddingTaskTo(null); setNewTaskName(""); }}>Done</button>
                    </div>
                  ) : aiAddingTo === p.id ? (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      <textarea autoFocus className="w-textarea" value={aiQuery} disabled={aiBusy}
                        onChange={(e) => setAiQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submitAiExtend(p); }
                          else if (e.key === "Escape" && !aiBusy) { setAiAddingTo(null); setAiQuery(""); }
                        }}
                        placeholder="Describe the tasks to add — e.g. 'API hookup and login screen, plus a polish pass'"
                        style={{ height: 52, fontSize: 13 }} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="w-btn w-btn--primary w-btn--sm" disabled={!aiQuery.trim() || aiBusy} onClick={() => submitAiExtend(p)}>
                          {aiBusy ? "Generating…" : "Generate tasks"}
                        </button>
                        <button className="w-btn w-btn--ghost w-btn--sm" disabled={aiBusy} onClick={() => { setAiAddingTo(null); setAiQuery(""); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                      <button className="w-btn w-btn--ghost w-btn--sm" onClick={() => { setAddingTaskTo(p.id); setNewTaskName(""); }}>
                        <Icon name="plus" size={11} /> Add task
                      </button>
                      <button className="w-btn w-btn--ghost w-btn--sm" onClick={() => { setAiAddingTo(p.id); setAiQuery(""); }}>
                        <Icon name="bolt" size={11} /> AI add tasks
                      </button>
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }} title="Project color">
                      {D.PROJECT_PALETTE.map((c) => (
                        <button key={c} onClick={() => updateProject(p.id, { color: c })} aria-label={"Set color " + c}
                          style={{
                            width: 15, height: 15, borderRadius: "50%", background: c, padding: 0, cursor: "pointer",
                            border: p.color === c ? "2px solid var(--text)" : "1px solid var(--border)",
                            transform: p.color === c ? "scale(1.12)" : "none",
                          }} />
                      ))}
                    </div>
                    <div style={{ flex: 1 }} />
                    <RenameButton project={p} />
                    <button className="w-btn w-btn--ghost w-btn--sm" style={{ color: "var(--port)" }} onClick={() => deleteProject(p.id)}>Delete</button>
                    {isReady && (
                      <button className="w-btn w-btn--launch" onClick={() => shipProject(p.id)}>
                        <Icon name="ship" size={13} /> Launch
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
        <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <button className="w-btn w-btn--ghost w-btn--sm" style={{ padding: "4px 0", marginBottom: showLaunched ? 12 : 0 }} onClick={() => setShowLaunched(!showLaunched)}>
            <span style={{ transform: showLaunched ? "rotate(180deg)" : "none", transition: "transform var(--t-fast)", display: "inline-flex" }}><Icon name="chevron" size={12} /></span>
            <span className="w-eyebrow" style={{ marginLeft: 4 }}>Launched fleet</span>
            <Chip kind="green" style={{ marginLeft: 6 }}>{launched.length}</Chip>
          </button>
          {showLaunched && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {launched.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>
                  <Icon name="ship" size={13} />
                  <span style={{ fontSize: 13, color: "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                  <Chip>{D.PROJECT_TYPES.find((t) => t.id === p.type)?.label || "Other"}</Chip>
                  <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>{D.fmtDate(p.shippedAt || p.completedAt)}</span>
                  <button className="w-icon-btn" onClick={() => unshipProject(p.id)} title="Back to the yard" aria-label="Unlaunch"><Icon name="chevronR" size={11} /></button>
                </div>
              ))}
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
  if (!editing) return <button className="w-btn w-btn--ghost w-btn--sm" onClick={() => { setName(project.title); setEditing(true); }}>Rename</button>;
  const commit = () => { if (name.trim()) updateProject(project.id, { title: name.trim() }); setEditing(false); };
  return (
    <input autoFocus className="w-input w-input--sm" value={name} style={{ width: 180 }}
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
      return <button className="w-btn w-btn--ghost w-btn--xs" style={{ marginTop: 12, padding: "2px 0", color: "var(--text-faint)", fontStyle: "italic" }} onClick={() => setEditing(true)}>+ add description</button>;
    }
    return (
      <div onClick={() => setEditing(true)} title="Click to edit"
        style={{ marginTop: 12, padding: "8px 10px", background: "var(--bg-soft)", border: "1px dashed var(--border)", borderRadius: "var(--r-sm)", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, cursor: "text", whiteSpace: "pre-wrap" }}>
        {project.desc}
      </div>
    );
  }
  return (
    <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); setDraft(project.desc || ""); setEditing(false); }
        else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
      }}
      className="w-textarea" placeholder="What this project is, why it matters, what done looks like."
      style={{ marginTop: 12, height: 64, fontSize: 12.5 }} />
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
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {["pending", "recurring", "done", "all"].map((f) => (
            <ChipChoice key={f} active={filter.status === f} onClick={() => setF({ status: f })}>{f}</ChipChoice>
          ))}
        </div>
        {filter.status === "pending" && (
          <>
            <div style={{ height: 14, width: 1, background: "var(--border)" }} />
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
        <button className="w-btn w-btn--outline w-btn--sm" onClick={() => fileRef.current?.click()} disabled={importing}
          title="Import tasks from a screenshot of another tool">
          {importing ? "Reading…" : <><Icon name="camera" size={12} /> Screenshot import</>}
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <input className="w-input w-input--sm" placeholder="Search…" value={filter.q}
          onChange={(e) => setF({ q: e.target.value })} style={{ width: 200 }} />
        {projects.length > 0 && (
          <select className="w-input w-input--sm" value={filter.project || ""} onChange={(e) => setF({ project: e.target.value || null })} style={{ width: 170 }}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        )}
        {usedTags.map((t) => (
          <ChipChoice key={t} active={filter.tag === t} onClick={() => setF({ tag: filter.tag === t ? null : t })}>#{t}</ChipChoice>
        ))}
      </div>

      {parsed && (
        <div className="w-card w-fade-in" style={{ padding: 14, marginBottom: 14, borderColor: "var(--amber)" }}>
          <Eyebrow right={<button className="w-icon-btn" onClick={() => setParsed(null)} aria-label="Discard"><Icon name="close" size={12} /></button>}>
            Import preview · {parsed.length} found
          </Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto", marginBottom: 10 }} className="w-scroll">
            {parsed.map((p, i) => {
              const on = importSel.has(i);
              return (
                <div key={i} onClick={() => setImportSel((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: on ? "var(--bg-soft)" : "transparent", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", opacity: on ? 1 : 0.5, cursor: "pointer" }}>
                  <Checkbox checked={on} onChange={() => {}} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                    {p.description && <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6, fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                    <DifficultyPip d={p.difficulty} />
                    <span>{p.hours}h · {p.xp}XP</span>
                    {p.completed && <span style={{ color: "var(--starboard)" }}>done</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
              <Checkbox checked={importMakeProject} onChange={() => setImportMakeProject((v) => !v)} />
              Group as project:
            </label>
            <input className="w-input w-input--sm" value={importProjectName} onChange={(e) => setImportProjectName(e.target.value)}
              placeholder="Project name" disabled={!importMakeProject} style={{ maxWidth: 220 }} />
            <div style={{ flex: 1 }} />
            <button className="w-btn w-btn--ghost w-btn--sm" onClick={() => setParsed(null)}>Cancel</button>
            <button className="w-btn w-btn--primary w-btn--sm" disabled={importSel.size === 0} onClick={commitImport}>
              Import {importSel.size}
            </button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState>Nothing matches.</EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {list.map((t, i) => {
            const chunks = D.getTaskChunks(t.id, plan);
            const isSplit = chunks.length > 1;
            const scheduled = D.getTaskScheduledDate(t.id, plan);
            return (
              <TaskRow key={t.id} task={t}
                project={t.projectId ? projectsById.get(t.projectId) : null}
                doneHere={t.recurring !== "none" ? D.isRecurringDoneNow(t, hour) : t.completed}
                onToggleDone={(done) => setCompletion(t.id, { done })}
                splitBadge={isSplit ? `split · ${chunks.length} days` : scheduled ? D.fmtIsoShort(scheduled) : null}
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
