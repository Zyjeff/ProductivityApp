// views/dock.jsx — the tansu (DESIGN.md §5.3). Logic lifted from
// nightwatch/views/dock.jsx; composition is a chest of drawers, not
// berth plates. ChronicleDialog is mounted by App.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Stamp, StampPick, Eyebrow, EmptyState, Chip, BudButton, DifficultyPip, Kbd, MOD, Hanko } from "../components.jsx";
import { CaptureStrip } from "../capture.jsx";
import { TaskRow } from "../taskrow.jsx";
import { Enso } from "../garden.jsx";
import { woodGrain, REDUCED_MOTION } from "../texture.js";
import { usePane } from "../pane.jsx";
import * as D from "../../../core/domain.js";
import {
  useStore, getState, setUI, setCompletion, addTask, notify, updateTask,
  createProject, updateProject, deleteProject, shipProject, unshipProject,
  addChildToProject, detachFromProject, saveLaunchNote,
} from "../../../core/store.js";
import { registerActiveList } from "../../../core/keys.js";
import { aiExtendProject, aiImportFromScreenshot, aiLaunchNote, aiFailureMessage } from "../../../core/ai.js";
import { scoreTask } from "../../../core/enrich.js";
import { YZ_DOCK } from "../nav.js";

export function DockView() {
  const filter = useStore((s) => s.ui.dockFilter);
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const tab = filter.tab || "projects";
  const active = projects.filter((p) => !p.completedAt);
  const ready = active.filter((p) => (p.childTaskIds || []).length > 0 && D.progressOfProject(p, tasksById) === 100);
  const launched = projects.filter((p) => p.completedAt);

  return (
    <div className="yz-sheet-inner yzd-dock">
      <header className="yzd-head">
        <h2 className="yz-sec">The tansu</h2>
        <h1>Lists</h1>
        <div className="yzd-head-meta">
          {active.length} {active.length === 1 ? "drawer" : "drawers"}
          {ready.length ? <span className="yzd-ready-n"> · {ready.length} ready to seal</span> : null}
          {launched.length ? ` · ${launched.length} sealed` : null}
        </div>
      </header>

      <CaptureStrip />

      <div className="yzd-tabs yz-seg" role="tablist" aria-label="Lists section">
        <button type="button" className={tab === "projects" ? "is-on" : ""}
          onClick={() => setUI({ dockFilter: { ...filter, tab: "projects" }, cursor: null })}>Lists</button>
        <button type="button" className={tab === "library" ? "is-on" : ""}
          onClick={() => setUI({ dockFilter: { ...filter, tab: "library" }, cursor: null })}>All tasks</button>
      </div>

      {tab === "library" ? <LibraryTab /> : <ListsTab />}
    </div>
  );
}

function isRealProjectId(id) {
  return !!(id && !String(id).startsWith("__"));
}

function ListsTab() {
  const filter = useStore((s) => s.ui.dockFilter);
  const projects = useStore((s) => s.projects);
  const [typeFilter, setTypeFilter] = useState("All");
  const openId = isRealProjectId(filter.project) ? filter.project : null;
  const openProject = openId ? projects.find((p) => p.id === openId && !p.completedAt) : null;

  if (openProject) {
    return (
      <OpenDrawer
        projectId={openProject.id}
        onBack={() => setUI({ dockFilter: { ...getState().ui.dockFilter, project: null }, cursor: null })}
      />
    );
  }
  return (
    <Chest
      typeFilter={typeFilter}
      setTypeFilter={setTypeFilter}
      chronicleJump={filter.project === YZ_DOCK.chronicle}
      startAdding={filter.project === YZ_DOCK.newList}
    />
  );
}

function Chest({ typeFilter, setTypeFilter, chronicleJump, startAdding }) {
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("other");
  const nameRef = useRef(null);
  const chronicleRef = useRef(null);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  useEffect(() => { if (adding) nameRef.current?.focus(); }, [adding]);
  useEffect(() => { if (startAdding) setAdding(true); }, [startAdding]);
  useEffect(() => {
    if (!chronicleJump) return;
    chronicleRef.current?.scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth", block: "start" });
  }, [chronicleJump]);

  const active = projects.filter((p) => !p.completedAt)
    .filter((p) => typeFilter === "All" || p.type === typeFilter)
    .sort((a, b) => D.progressOfProject(b, tasksById) - D.progressOfProject(a, tasksById));
  const activeAnyType = projects.some((p) => !p.completedAt);
  const launched = projects.filter((p) => p.completedAt).sort((a, b) => (b.shippedAt || 0) - (a.shippedAt || 0));

  const submitNew = () => {
    if (!newName.trim()) return;
    const id = createProject({ title: newName.trim(), type: newType });
    setNewName(""); setAdding(false);
    setUI({ dockFilter: { ...getState().ui.dockFilter, tab: "projects", project: id }, cursor: null });
  };
  const cancelNew = () => {
    setAdding(false); setNewName("");
    const f = getState().ui.dockFilter;
    if (f.project === YZ_DOCK.newList) setUI({ dockFilter: { ...f, project: null } });
  };

  return (
    <>
      <div className="yzd-toolbar">
        {activeAnyType && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <StampPick active={typeFilter === "All"} onClick={() => setTypeFilter("All")}>All</StampPick>
            {D.PROJECT_TYPES.map((t) => (
              <StampPick key={t.id} active={typeFilter === t.id} onClick={() => setTypeFilter(t.id)}>{t.label}</StampPick>
            ))}
          </div>
        )}
        <div className="yzd-grow" />
        <button type="button" className="yz-btn yz-btn--sm" onClick={() => setAdding(true)}>
          <Icon name="plus" size={11} /> New drawer
        </button>
      </div>

      {adding && (
        <div className="yz-washi yzd-create fade-in">
          <input ref={nameRef} className="yz-field" placeholder="Drawer name" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitNew(); if (e.key === "Escape") cancelNew(); }} />
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {D.PROJECT_TYPES.map((t) => (
              <StampPick key={t.id} active={newType === t.id} onClick={() => setNewType(t.id)}>{t.label}</StampPick>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="yz-btn yz-btn--sm" onClick={submitNew} disabled={!newName.trim()}>Create</button>
            <button type="button" className="yz-btn yz-btn--ghost yz-btn--sm" onClick={cancelNew}>Cancel</button>
          </div>
        </div>
      )}

      <div className="yzd-chest-wrap" style={{ backgroundImage: woodGrain("tansu-frame") }}>
      {active.length === 0 && !adding && (
        <EmptyState caption="empty tansu">
          {activeAnyType && typeFilter !== "All"
            ? <>No {D.PROJECT_TYPES.find((t) => t.id === typeFilter)?.label.toLowerCase()} lists in the chest.</>
            : <>The tansu is empty. Add a drawer, or capture in List mode.</>}
        </EmptyState>
      )}

      <div className="yzd-chest">
        {active.map((p) => {
          const pct = D.progressOfProject(p, tasksById);
          const children = (p.childTaskIds || []).map((id) => tasksById.get(id)).filter(Boolean);
          const doneCount = children.filter((c) => c.completed).length;
          const isReady = pct === 100 && children.length > 0;
          return (
            <article
              key={p.id}
              className={"yzd-drawer fade-in" + (isReady ? " yzd-drawer--ready" : "")}
              style={{ "--yzd-ink": p.color || "transparent" }}
              role="button"
              tabIndex={0}
              onClick={() => setUI({ dockFilter: { ...getState().ui.dockFilter, tab: "projects", project: p.id }, cursor: null })}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setUI({ dockFilter: { ...getState().ui.dockFilter, tab: "projects", project: p.id }, cursor: null });
                }
              }}
            >
              {isReady && <span className="yzd-ready-glow">Ready to seal</span>}
              <div className="yzd-drawer-label" style={{ backgroundImage: woodGrain("drawer-" + p.id) }}>
                <i className="yz-dot" style={{ background: p.color || "var(--sumi-faint)" }} />
                <span className="yzd-drawer-name">{p.title}</span>
              </div>
              <div className="yzd-drawer-body">
                <div className="yzd-drawer-counts">
                  {children.length === 0 ? "No tasks" : `${doneCount}/${children.length} tasks`}
                </div>
                <Enso pct={pct} size={80} title={`${pct}%`} />
              </div>
              <div className="yzd-drawer-pull" aria-hidden />
              {isReady && (
                <button type="button" className="yz-btn yz-btn--gold yz-btn--sm"
                  onClick={(e) => { e.stopPropagation(); shipProject(p.id); }}>
                  Seal the list
                </button>
              )}
            </article>
          );
        })}
      </div>

      <HouseChronicle launched={launched} jump={chronicleJump} sectionRef={chronicleRef} />
      </div>
    </>
  );
}

function HouseChronicle({ launched, jump, sectionRef }) {
  const [openId, setOpenId] = useState(null);
  return (
    <section ref={sectionRef} className={"yzd-chronicle" + (jump ? " is-jump" : "")}>
      <Eyebrow sumi>House chronicle</Eyebrow>
      {launched.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--sumi-faint)", marginTop: 8 }}>No lists sealed yet.</div>
      ) : launched.map((p) => {
        const open = openId === p.id;
        const stats = p.launchStats;
        return (
          <div key={p.id} className="yzd-chronic-row">
            <button type="button" className="yzd-chronic-head" onClick={() => setOpenId(open ? null : p.id)}>
              <Hanko title="Sealed">印</Hanko>
              <span className="yzd-chronic-title">{p.title}</span>
              {p.launchNote && <span title="Has an entry" style={{ fontSize: 8, color: "var(--starboard)" }}>●</span>}
              <Stamp>{D.fmtDate(p.shippedAt || p.completedAt)}</Stamp>
              {stats && <span className="yz-num" style={{ fontSize: 9.5, color: "var(--amber-deep)" }}>+{stats.xp}</span>}
            </button>
            {open && (
              <div className="yzd-chronic-body fade-in">
                {stats && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                    <Stamp kind="green">{stats.doneTasks}/{stats.tasks} tasks</Stamp>
                    <Stamp kind="amber">{stats.xp} XP</Stamp>
                    <Stamp>{stats.estHours}h est{stats.actualMs ? ` · ${D.fmtMs(stats.actualMs)}` : ""}</Stamp>
                    <Stamp>{stats.spanDays}d span</Stamp>
                  </div>
                )}
                {p.launchNote ? (
                  <div className="yzd-chronic-note">{p.launchNote}</div>
                ) : (
                  <div className="yzd-chronic-note" style={{ fontStyle: "italic" }}>No chronicle entry yet.</div>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" className="yz-btn yz-btn--ghost yz-btn--sm" onClick={() => setUI({ launchNoteFor: p.id })}>
                    <Icon name="edit" size={10} /> {p.launchNote ? "Edit entry" : "Write entry"}
                  </button>
                  <button type="button" className="yz-btn yz-btn--ghost yz-btn--sm" onClick={() => unshipProject(p.id)}>
                    Break the seal
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function OpenDrawer({ projectId, onBack }) {
  const project = useStore((s) => s.projects.find((p) => p.id === projectId));
  const tasks = useStore((s) => s.tasks);
  const [newTaskName, setNewTaskName] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const taskRef = useRef(null);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  useEffect(() => { taskRef.current?.focus(); }, [projectId]);

  if (!project || project.completedAt) return null;

  const pct = D.progressOfProject(project, tasksById);
  const children = (project.childTaskIds || []).map((id) => tasksById.get(id)).filter(Boolean);
  const isReady = pct === 100 && children.length > 0;
  const typeLbl = D.PROJECT_TYPES.find((t) => t.id === project.type)?.label || "Other";

  const submitTask = () => {
    if (!newTaskName.trim()) return;
    const t = addChildToProject(project.id, { title: newTaskName.trim() });
    if (t) scoreTask(t.id);
    setNewTaskName("");
  };
  const submitAiExtend = async () => {
    const q = aiQuery.trim();
    if (!q || aiBusy) return;
    setAiBusy(true);
    try {
      const kids = (project.childTaskIds || []).map((id) => tasksById.get(id)).filter(Boolean);
      const newTasks = await aiExtendProject(project, kids, q);
      if (!newTasks.length) { notify("The Attendant returned no tasks — nothing was added"); }
      else {
        for (const t of newTasks) addChildToProject(project.id, { ...t, desc: t.description });
        notify(`Added ${newTasks.length} task${newTasks.length > 1 ? "s" : ""}`);
        setAiQuery("");
      }
    } catch (e) { notify(aiFailureMessage(e.kind)); }
    setAiBusy(false);
  };

  return (
    <div className="yz-washi yzd-open fade-in">
      <div className="yzd-open-top">
        <button type="button" className="yz-link" onClick={onBack}>← Back to the chest</button>
        <Stamp>{typeLbl}</Stamp>
        {isReady && <Stamp kind="sakura">Ready to seal</Stamp>}
        <div style={{ flex: 1 }} />
        <Enso pct={pct} size={48} title={`${pct}%`} />
      </div>

      <RenameTitle project={project} />

      <ProjectDesc project={project} />

      <div className="yzd-ledger">
        {children.length === 0 && (
          <div className="yzd-lrow" style={{ color: "var(--sumi-faint)", fontSize: 12.5 }}>Nothing in this drawer.</div>
        )}
        {children.map((t) => (
          <div key={t.id} className="yzd-lrow">
            <BudButton square done={t.completed}
              onComplete={() => setCompletion(t.id, { done: true })}
              onReopen={() => setCompletion(t.id, { done: false })} />
            <button type="button"
              className={"yzd-lrow-title" + (t.completed ? " is-done" : "")}
              onClick={() => setUI({ editingTaskId: t.id, formOpen: true })}>{t.title}</button>
            <span className="yz-num" style={{ fontSize: 10, color: "var(--sumi-faint)" }}>{t.xp} XP</span>
            <button type="button" className="yz-icon-btn" onClick={() => detachFromProject(t.id)}
              title="Take out of the drawer" aria-label="Take out of the drawer">
              <Icon name="close" size={11} />
            </button>
          </div>
        ))}
      </div>

      <div className="yzd-add-row">
        <input ref={taskRef} className="yz-field" placeholder="Add a task — Enter keeps the drawer open"
          value={newTaskName}
          onChange={(e) => setNewTaskName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submitTask(); if (e.key === "Escape") setNewTaskName(""); }} />
        <button type="button" className="yz-btn yz-btn--sm" onClick={submitTask} disabled={!newTaskName.trim()}>Add</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 className="yz-sec">The Attendant</h2>
        <textarea value={aiQuery} disabled={aiBusy} className="yz-field"
          onChange={(e) => setAiQuery(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submitAiExtend(); }
          }}
          placeholder="Describe tasks to add — ⌘/Ctrl+Enter"
          style={{ height: 56, minHeight: 56 }} />
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button type="button" className="yz-btn yz-btn--sm" disabled={!aiQuery.trim() || aiBusy} onClick={submitAiExtend}>
            {aiBusy ? "Working…" : "Add tasks"}
          </button>
          <span className="yz-label yz-label--sumi"><Kbd>{MOD}</Kbd> <Kbd>↵</Kbd></span>
        </div>
      </div>

      <div className="yzd-foot">
        <div className="yz-swatches" title="Ink color">
          {D.PROJECT_PALETTE.map((c) => (
            <button type="button" key={c} className={"yz-swatch" + (project.color === c ? " is-on" : "")}
              onClick={() => updateProject(project.id, { color: c })}
              aria-label={"Set color " + c} style={{ background: c }} />
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button type="button" className="yz-btn yz-btn--port yz-btn--sm" onClick={() => deleteProject(project.id)}>
          Sweep away
        </button>
        {isReady && (
          <button type="button" className="yz-btn yz-btn--gold" onClick={() => shipProject(project.id)}>
            Seal the list
          </button>
        )}
      </div>
    </div>
  );
}

function RenameTitle({ project }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.title);
  const commit = () => { if (name.trim()) updateProject(project.id, { title: name.trim() }); setEditing(false); };
  if (!editing) {
    return (
      <button type="button" className="yzd-open-title yz-bare" onClick={() => { setName(project.title); setEditing(true); }}
        title="Click to rename" style={{ textAlign: "left", background: "none", border: "none", padding: 0, cursor: "text" }}>
        {project.title}
      </button>
    );
  }
  return (
    <div className="yzd-open-title">
      <input autoFocus className="yz-bare" value={name}
        onChange={(e) => setName(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }} />
    </div>
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
      return <button type="button" className="yz-link" onClick={() => setEditing(true)}>+ add description</button>;
    }
    return (
      <div className="yzd-desc" onClick={() => setEditing(true)} title="Click to edit">{project.desc}</div>
    );
  }
  return (
    <textarea autoFocus className="yz-field" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); setDraft(project.desc || ""); setEditing(false); }
        else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
      }}
      placeholder="What this list is, why it matters, what done looks like."
      style={{ height: 64, minHeight: 64 }} />
  );
}

/* ── All tasks ─────────────────────────────────────────────── */

function LibraryTab() {
  const tasks = useStore((s) => s.tasks);
  const plan = useStore((s) => s.plan);
  const projects = useStore((s) => s.projects);
  const filter = useStore((s) => s.ui.dockFilter);
  const cursor = useStore((s) => s.ui.cursor);
  const meta = useStore((s) => s.meta);
  const energy = useStore((s) => s.ui.energy);
  const { openTask } = usePane();
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
    if (filter.project === YZ_DOCK.inbox) arr = arr.filter((t) => !t.projectId);
    else if (filter.project && !String(filter.project).startsWith("__"))
      arr = arr.filter((t) => t.projectId === filter.project);
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
      if (!result.length) { notify("No tasks found in that photo"); }
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

  const berthTask = (taskId, projectId) => {
    updateTask(taskId, { projectId, projectIdChanged: true });
    const proj = projectsById.get(projectId);
    notify(`Put in ${proj ? `"${proj.title}"` : "a drawer"}`);
    setBerthingId(null);
  };

  const cursorIdx = cursor ? cursor.index : -1;

  return (
    <>
      <div className="yzd-filters">
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {["pending", "recurring", "done", "all"].map((f) => (
            <StampPick key={f} active={filter.status === f} onClick={() => setF({ status: f })}>{f[0].toUpperCase() + f.slice(1)}</StampPick>
          ))}
        </div>
        {filter.status === "pending" && (
          <>
            <span className="yzd-sep" />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {[["priority", "Priority"], ["energy", "Energy"], ["xp", "XP"], ["newest", "Newest"], ["oldest", "Oldest"]].map(([id, lbl]) => (
                <StampPick key={id} active={filter.sort === id} onClick={() => setF({ sort: id })}>{lbl}</StampPick>
              ))}
            </div>
          </>
        )}
        <div className="yzd-grow" />
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ""; }} />
        <button type="button" className="yz-btn yz-btn--ghost yz-btn--sm" onClick={() => fileRef.current?.click()} disabled={importing}
          title="Import tasks from a photo of another tool">
          {importing ? "Reading…" : <><Icon name="camera" size={11} /> Import from a photo</>}
        </button>
      </div>

      <div className="yzd-filters-2">
        <input className="yz-field" placeholder="Search…" value={filter.q || ""}
          onChange={(e) => setF({ q: e.target.value })} style={{ width: 200, padding: "6px 9px" }} />
        <select className="yz-field" value={filter.project || ""}
          onChange={(e) => setF({ project: e.target.value || null })} style={{ width: 180, padding: "6px 9px" }}>
          <option value="">All lists</option>
          <option value={YZ_DOCK.inbox}>No list</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        {usedTags.map((t) => (
          <Chip key={t} active={filter.tag === t} onClick={() => setF({ tag: filter.tag === t ? null : t })}>#{t}</Chip>
        ))}
      </div>

      {parsed && (
        <div className="yz-washi yzd-import fade-in">
          <Eyebrow sumi right={<button type="button" className="yz-icon-btn" onClick={() => setParsed(null)} aria-label="Discard"><Icon name="close" size={12} /></button>}>
            Import preview · {parsed.length} found
          </Eyebrow>
          <div className="yzd-import-list scrolly">
            {parsed.map((p, i) => {
              const on = importSel.has(i);
              return (
                <div key={i} className={"yzd-import-row" + (on ? " is-on" : "")} role="button" tabIndex={0}
                  onClick={() => setImportSel((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setImportSel((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; }); } }}>
                  <BudButton square done={on}
                    onComplete={() => setImportSel((prev) => { const n = new Set(prev); n.add(i); return n; })}
                    onReopen={() => setImportSel((prev) => { const n = new Set(prev); n.delete(i); return n; })}
                    label="Include" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                    {p.description && <div style={{ fontSize: 11, color: "var(--sumi-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</div>}
                  </div>
                  <div className="yz-num" style={{ display: "flex", gap: 6, fontSize: 9.5, color: "var(--sumi-faint)", flexShrink: 0, alignItems: "center" }}>
                    <DifficultyPip d={p.difficulty} />
                    <span>{p.hours}H · {p.xp}XP</span>
                    {p.completed && <span style={{ color: "var(--starboard)" }}>done</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--sumi-dim)", cursor: "pointer" }}>
              <input type="checkbox" checked={importMakeProject} onChange={() => setImportMakeProject((v) => !v)} />
              Group as a list:
            </label>
            <input className="yz-field" value={importProjectName} onChange={(e) => setImportProjectName(e.target.value)}
              placeholder="List name" disabled={!importMakeProject} style={{ maxWidth: 220, opacity: importMakeProject ? 1 : 0.5, padding: "6px 9px" }} />
            <div style={{ flex: 1 }} />
            <button type="button" className="yz-btn yz-btn--ghost yz-btn--sm" onClick={() => setParsed(null)}>Cancel</button>
            <button type="button" className="yz-btn yz-btn--sm" disabled={importSel.size === 0} onClick={commitImport}>
              Import {importSel.size}
            </button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState caption="nothing matches">Nothing matches.</EmptyState>
      ) : (
        <div className="yzd-lib">
          {list.map((t, i) => {
            const chunks = D.getTaskChunks(t.id, plan);
            const isSplit = chunks.length > 1;
            const scheduled = D.getTaskScheduledDate(t.id, plan);
            const canBerth = !t.projectId && !t.completed && t.recurring === "none" && activeProjects.length > 0;
            return (
              <div key={t.id} className="yzd-lib-item">
                <TaskRow task={t}
                  project={t.projectId ? projectsById.get(t.projectId) : null}
                  doneHere={t.recurring !== "none" ? D.isRecurringDoneNow(t, hour) : t.completed}
                  onToggleDone={(done) => setCompletion(t.id, { done })}
                  splitBadge={isSplit ? `split · ${chunks.length}d` : scheduled ? D.fmtIsoShort(scheduled) : null}
                  isCursor={cursorIdx === i}
                  onHoverCursor={() => setUI({ cursor: { index: i } })}
                  onOpen={openTask}
                  dayStartHour={hour}
                />
                {canBerth && (
                  <div className="yzd-put">
                    {berthingId === t.id ? (
                      <>
                        <span className="yz-label yz-label--sumi">Put in</span>
                        {activeProjects.map((p) => (
                          <StampPick key={p.id} color={p.color} onClick={() => berthTask(t.id, p.id)}>{p.title}</StampPick>
                        ))}
                        <button type="button" className="yz-icon-btn" onClick={() => setBerthingId(null)} aria-label="Cancel">
                          <Icon name="close" size={10} />
                        </button>
                      </>
                    ) : (
                      <button type="button" className="yz-btn yz-btn--ghost yz-btn--sm" onClick={() => setBerthingId(t.id)}>
                        <Icon name="drawer" size={10} /> Put in a drawer
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ── chronicle entry (mounted by App) ──────────────────────── */

function deterministicLaunchDraft(stats) {
  if (!stats) return "";
  return `Sealed with ${stats.doneTasks}/${stats.tasks} tasks done and ${stats.xp} XP earned. ` +
    `Estimated ${stats.estHours}h${stats.actualMs ? `, actually focused ${D.fmtMs(stats.actualMs)}` : ""}. ` +
    `First task to seal: ${stats.spanDays} day${stats.spanDays === 1 ? "" : "s"}.`;
}

export function ChronicleDialog() {
  const forId = useStore((s) => s.ui.launchNoteFor);
  if (!forId) return null;
  return <ChronicleInner key={forId} projectId={forId} />;
}

function ChronicleInner({ projectId }) {
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
    <div className="yz-backdrop" style={{ zIndex: 10004, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={() => setUI({ launchNoteFor: null })}>
      <div className="yz-washi fade-in" style={{ width: "100%", maxWidth: 470, padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <h2 className="yz-sec">Chronicle entry</h2>
          <div style={{ flex: 1 }} />
          <button type="button" className="yz-icon-btn" onClick={() => setUI({ launchNoteFor: null })} aria-label="Close">
            <Icon name="close" size={12} />
          </button>
        </div>
        <div className="yz-display" style={{ fontSize: 20, marginBottom: 10 }}>{project.title}</div>
        {stats && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
            <Stamp kind="green">{stats.doneTasks}/{stats.tasks} tasks</Stamp>
            <Stamp kind="amber">{stats.xp} XP</Stamp>
            <Stamp>{stats.estHours}h est{stats.actualMs ? ` · ${D.fmtMs(stats.actualMs)} focused` : ""}</Stamp>
            <Stamp>{stats.spanDays}d span</Stamp>
          </div>
        )}
        <textarea className="yz-field" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="What was sealed, and what did it take?" style={{ height: 96, minHeight: 96, marginBottom: 8 }} />
        <div className="yz-label yz-label--sumi" style={{ marginBottom: 12 }}>
          {drafting ? "The Attendant is drafting — your text wins…"
            : aiStatus === "off" ? "The Attendant is away — a deterministic draft is prefilled."
            : "Drafted for you. Edit, then log it."}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="yz-btn" style={{ flex: 1 }} onClick={() => saveLaunchNote(projectId, note)}>Log it</button>
          <button type="button" className="yz-btn yz-btn--ghost" onClick={() => setUI({ launchNoteFor: null })}>Skip</button>
        </div>
      </div>
    </div>
  );
}
