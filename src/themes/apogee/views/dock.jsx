// views/dock.jsx — HANGAR: vehicle bays, past-missions filmstrip, STORES.
// Logic lifted from nightwatch/views/dock.jsx; Apogee composition only.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Stamp, EmptyState } from "../components.jsx";
import { SegColumn } from "../charts.jsx";
import { CaptureBar } from "../capture.jsx";
import { TaskRow, ChunksEditor } from "../taskrow.jsx";
import { patchTex } from "../texture.js";
import * as D from "../../../core/domain.js";
import {
  useStore, setUI, setCompletion, addTask, notify, updateTask,
  createProject, updateProject, deleteProject, shipProject, unshipProject,
  addChildToProject, detachFromProject, saveLaunchNote,
} from "../../../core/store.js";
import { registerActiveList } from "../../../core/keys.js";
import { aiExtendProject, aiImportFromScreenshot, aiLaunchNote, aiFailureMessage } from "../../../core/ai.js";
import { scoreTask } from "../../../core/enrich.js";

/* ── local primitives (mirror taskform StampPick / taskrow CompleteToggle) ─ */

function StampPick({ active, color, onClick, children, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={"ap-stamp ap-stamp--pick" + (active ? " ap-stamp--on" : "")}
      style={active && color ? { background: color, color: "var(--ink)", borderColor: "transparent" } : undefined}
    >
      {children}
    </button>
  );
}

function CompleteToggle({ done, onComplete, onReopen, label, title }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        done ? onReopen && onReopen() : onComplete && onComplete();
      }}
      title={title || (done ? "Reopen" : "Confirm nominal")}
      aria-label={label || (done ? "Reopen" : "Confirm nominal")}
      style={{
        width: 16,
        height: 16,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        border: "1px solid " + (done ? "var(--signal)" : "var(--line-strong)"),
        background: done ? "var(--signal)" : "transparent",
        color: done ? "var(--ink)" : "var(--fg-dim)",
        cursor: "pointer",
        font: "700 10px var(--t-mono)",
        lineHeight: 1,
      }}
    >
      {done ? "✓" : ""}
    </button>
  );
}

function IncludeToggle({ on, onToggle, label = "Include" }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle && onToggle();
      }}
      title={label}
      aria-label={label}
      style={{
        width: 16,
        height: 16,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        border: "1px solid " + (on ? "var(--signal)" : "var(--line-strong)"),
        background: on ? "var(--signal)" : "transparent",
        color: on ? "var(--ink)" : "var(--fg-dim)",
        cursor: "pointer",
        font: "700 10px var(--t-mono)",
        lineHeight: 1,
      }}
    >
      {on ? "✓" : ""}
    </button>
  );
}

function DifficultyPip({ d }) {
  const cfg = D.DIFFICULTY[d] || D.DIFFICULTY.medium;
  return (
    <span
      title={cfg.label}
      style={{
        width: 8,
        height: 8,
        background: cfg.tone,
        flexShrink: 0,
        display: "inline-block",
      }}
    />
  );
}

/* ── main view ─────────────────────────────────────────────── */

export function DockView() {
  const filter = useStore((s) => s.ui.dockFilter);
  const tab = filter.tab;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
      <div className="ap-stencil-row">
        <span className="ap-stencil ap-stencil--lit">HANGAR</span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Hangar section">
        <button
          type="button"
          className={"ap-chip" + (tab === "projects" ? " ap-chip--on" : "")}
          onClick={() => setUI({ dockFilter: { ...filter, tab: "projects" }, cursor: null })}
        >
          BAYS
        </button>
        <button
          type="button"
          className={"ap-chip" + (tab === "library" ? " ap-chip--on" : "")}
          onClick={() => setUI({ dockFilter: { ...filter, tab: "library" }, cursor: null })}
        >
          STORES
        </button>
      </div>

      {tab === "projects" ? <BaysTab /> : <StoresTab />}
      <LaunchNoteScreen />
    </div>
  );
}

/* ── deterministic launch-note prefill (verbatim from nightwatch) ─ */

function deterministicLaunchDraft(stats) {
  if (!stats) return "";
  return `Launched with ${stats.doneTasks}/${stats.tasks} tasks done and ${stats.xp} XP earned. ` +
    `Estimated ${stats.estHours}h${stats.actualMs ? `, actually focused ${D.fmtMs(stats.actualMs)}` : ""}. ` +
    `First task to launch: ${stats.spanDays} day${stats.spanDays === 1 ? "" : "s"}.`;
}

/* ── LAUNCH NOTE full-screen re-tune ───────────────────────── */

function LaunchNoteScreen() {
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
    <div className="ap-screen" role="dialog" aria-label="LAUNCH NOTE">
      <div className="ap-screen-head">
        <div className="ap-screen-head-title">LAUNCH NOTE</div>
        <div style={{ flex: 1 }} />
        <button type="button" className="ap-icon-btn" onClick={() => setUI({ launchNoteFor: null })} aria-label="Close">
          <Icon name="close" size={13} />
        </button>
      </div>
      <div className="ap-screen-body" style={{ maxWidth: 520, margin: "0 auto", width: "100%" }}>
        <div className="ap-display" style={{ fontSize: 22, marginBottom: 12 }}>{project.title}</div>
        {stats && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
            <Stamp tone="var(--starboard)">{stats.doneTasks}/{stats.tasks} tasks</Stamp>
            <Stamp tone="var(--amber)">{stats.xp} XP</Stamp>
            <Stamp>{stats.estHours}h est{stats.actualMs ? ` · ${D.fmtMs(stats.actualMs)} focused` : ""}</Stamp>
            <Stamp>{stats.spanDays}d build</Stamp>
          </div>
        )}
        <textarea
          className="ap-field"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What shipped, and what did it take?"
          style={{ height: 120, marginBottom: 6 }}
        />
        <div className="ap-num" style={{ fontSize: 9.5, color: "var(--fg-faint)", marginBottom: 12, letterSpacing: "0.06em" }}>
          {drafting ? "GUIDANCE IS DRAFTING — EDIT FREELY, YOUR TEXT WINS…"
            : aiStatus === "off" ? "GUIDANCE OFFLINE — DETERMINISTIC DRAFT PREFILLED; MAKE IT YOURS."
            : "DRAFTED FOR YOU. EDIT, THEN LOG IT."}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="ap-btn ap-btn--primary" style={{ flex: 1 }} onClick={() => saveLaunchNote(projectId, note)}>
            <Icon name="check" size={12} /> Log it
          </button>
          <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setUI({ launchNoteFor: null })}>Skip</button>
        </div>
      </div>
    </div>
  );
}

/* ── BAYS tab ──────────────────────────────────────────────── */

function BaysTab() {
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
  const [expandedMissionId, setExpandedMissionId] = useState(null);
  const nameRef = useRef(null);
  const taskRef = useRef(null);
  useEffect(() => { if (adding) nameRef.current?.focus(); }, [adding]);
  useEffect(() => { if (addingTaskTo) taskRef.current?.focus(); }, [addingTaskTo]);

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const active = useMemo(() => projects
    .filter((p) => !p.completedAt)
    .filter((p) => typeFilter === "All" || p.type === typeFilter)
    .sort((a, b) => D.progressOfProject(b, tasksById) - D.progressOfProject(a, tasksById)),
  [projects, typeFilter, tasksById]);
  const activeAnyType = projects.some((p) => !p.completedAt);
  const launched = useMemo(() => projects
    .filter((p) => p.completedAt)
    .sort((a, b) => (b.shippedAt || 0) - (a.shippedAt || 0)),
  [projects]);

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
      if (!newTasks.length) { notify("GUIDANCE returned no tasks — nothing was added"); }
      else {
        for (const t of newTasks) addChildToProject(project.id, { ...t, desc: t.description });
        notify(`Added ${newTasks.length} task${newTasks.length > 1 ? "s" : ""}`);
        setAiQuery(""); setAiAddingTo(null);
      }
    } catch (e) { notify(aiFailureMessage(e.kind)); }
    setAiBusy(false);
  };

  const missionDetail = expandedMissionId
    ? launched.find((p) => p.id === expandedMissionId)
    : null;

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
        <button type="button" className="ap-btn ap-btn--sm ap-btn--primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={11} /> New bay
        </button>
      </div>

      {adding && (
        <div className="ap-panel" style={{ padding: 14, marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            ref={nameRef}
            className="ap-field"
            placeholder="Vehicle name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNew();
              if (e.key === "Escape") { setAdding(false); setNewName(""); }
            }}
          />
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {D.PROJECT_TYPES.map((t) => (
              <StampPick key={t.id} active={newType === t.id} onClick={() => setNewType(t.id)}>{t.label}</StampPick>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="ap-btn ap-btn--sm ap-btn--primary" onClick={submitNew} disabled={!newName.trim()}>Create</button>
            <button type="button" className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => { setAdding(false); setNewName(""); }}>Cancel</button>
          </div>
        </div>
      )}

      {active.length === 0 && !adding && (
        <EmptyState
          title="PAD CLEAR"
          line={activeAnyType && typeFilter !== "All"
            ? `No ${D.PROJECT_TYPES.find((t) => t.id === typeFilter)?.label.toLowerCase() || ""} vehicles in hangar.`
            : "No vehicles in hangar. Create a bay, or manifest a VEHICLE."}
        />
      )}

      <div className="ap-bays" style={{ marginBottom: 28 }}>
        {active.map((p) => {
          const pct = D.progressOfProject(p, tasksById);
          const children = (p.childTaskIds || []).map((id) => tasksById.get(id)).filter(Boolean);
          const doneCount = children.filter((c) => c.completed).length;
          const isReady = pct === 100 && children.length > 0;
          const isOpen = expandedId === p.id;
          const typeLbl = D.PROJECT_TYPES.find((t) => t.id === p.type)?.label || "Other";
          const gaugeTone = isReady ? "#33ff99" : (p.color || "#ff2b1a");
          return (
            <div key={p.id} className="ap-bay" style={{ cursor: "default" }}>
              <div className="ap-bay-head" onClick={() => setExpandedId(isOpen ? null : p.id)} style={{ cursor: "pointer" }}>
                <SegColumn pct={pct} tone={gaugeTone} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div
                      className="ap-bay-patch"
                      style={{ backgroundImage: patchTex(p.id) }}
                      aria-hidden
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="ap-bay-title">{p.title}</div>
                      <div className="ap-bay-meta">
                        <Stamp>{typeLbl}</Stamp>
                        <Stamp>{children.length === 0 ? "NO TASKS" : `${doneCount}/${children.length} TASKS`}</Stamp>
                        {isReady && (
                          <Stamp tone="go for launch">GO FOR LAUNCH</Stamp>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {isReady && (
                  <button
                    type="button"
                    className="ap-btn ap-btn--primary ap-btn--sm"
                    onClick={(e) => { e.stopPropagation(); shipProject(p.id); }}
                  >
                    {/* gap: Icon has no "ship" case — use "launch" */}
                    <Icon name="launch" size={12} /> Launch
                  </button>
                )}
              </div>

              {isOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
                  <ProjectDesc project={p} />
                  <div className="ap-ledger" style={{ background: "var(--well)" }}>
                    {children.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          minHeight: 36,
                          padding: "6px 10px",
                          borderBottom: "1px solid var(--line)",
                        }}
                      >
                        <CompleteToggle
                          done={t.completed}
                          onComplete={() => setCompletion(t.id, { done: true })}
                          onReopen={() => setCompletion(t.id, { done: false })}
                        />
                        <span
                          style={{
                            flex: 1,
                            fontSize: 12.5,
                            color: t.completed ? "var(--fg-faint)" : "var(--fg)",
                            textDecoration: t.completed ? "line-through" : "none",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            cursor: "pointer",
                          }}
                          onClick={() => setUI({ editingTaskId: t.id, formOpen: true })}
                        >
                          {t.title}
                        </span>
                        {t.completed && <Stamp tone="nominal">NOMINAL</Stamp>}
                        <span className="ap-num" style={{ fontSize: 10, color: "var(--fg-faint)" }}>{t.xp} XP</span>
                        <button
                          type="button"
                          className="ap-icon-btn"
                          onClick={() => detachFromProject(t.id)}
                          title="Detach from bay"
                          aria-label="Detach"
                        >
                          <Icon name="close" size={11} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {addingTaskTo === p.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        ref={taskRef}
                        className="ap-field"
                        placeholder="Payload name"
                        value={newTaskName}
                        style={{ flex: 1 }}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitTask(p.id);
                          if (e.key === "Escape") { setAddingTaskTo(null); setNewTaskName(""); }
                        }}
                      />
                      <button type="button" className="ap-btn ap-btn--sm ap-btn--primary" onClick={() => submitTask(p.id)} disabled={!newTaskName.trim()}>Add</button>
                      <button type="button" className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => { setAddingTaskTo(null); setNewTaskName(""); }}>Done</button>
                    </div>
                  ) : aiAddingTo === p.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <textarea
                        autoFocus
                        value={aiQuery}
                        disabled={aiBusy}
                        className="ap-field"
                        onChange={(e) => setAiQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submitAiExtend(p); }
                          else if (e.key === "Escape" && !aiBusy) { setAiAddingTo(null); setAiQuery(""); }
                        }}
                        placeholder="Describe the payloads to add — e.g. 'API hookup and login screen, plus a polish pass'"
                        style={{ height: 52 }}
                      />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" className="ap-btn ap-btn--sm ap-btn--primary" disabled={!aiQuery.trim() || aiBusy} onClick={() => submitAiExtend(p)}>
                          {aiBusy ? "Generating…" : "Generate tasks"}
                        </button>
                        <button type="button" className="ap-btn ap-btn--sm ap-btn--ghost" disabled={aiBusy} onClick={() => { setAiAddingTo(null); setAiQuery(""); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => { setAddingTaskTo(p.id); setNewTaskName(""); }}>
                        <Icon name="plus" size={10} /> Add task
                      </button>
                      <button type="button" className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => { setAiAddingTo(p.id); setAiQuery(""); }}>
                        <Icon name="bolt" size={10} /> GUIDANCE add tasks
                      </button>
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 12, borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }} title="Bay color">
                      {D.PROJECT_PALETTE.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => updateProject(p.id, { color: c })}
                          aria-label={"Set color " + c}
                          style={{
                            width: 13,
                            height: 13,
                            background: c,
                            padding: 0,
                            cursor: "pointer",
                            border: p.color === c ? "2px solid var(--fg)" : "1px solid var(--line)",
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ flex: 1 }} />
                    <RenameButton project={p} />
                    <button type="button" className="ap-btn ap-btn--sm ap-btn--danger" onClick={() => deleteProject(p.id)}>Scrub bay</button>
                    {isReady && (
                      <button type="button" className="ap-btn ap-btn--sm ap-btn--primary" onClick={() => shipProject(p.id)}>
                        {/* gap: Icon has no "ship" case — use "launch" */}
                        <Icon name="launch" size={12} /> Launch
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* PAST MISSIONS filmstrip */}
      <div className="ap-stencil-row" style={{ marginBottom: 8 }}>
        <span className="ap-stencil">PAST MISSIONS</span>
      </div>
      {launched.length === 0 ? (
        <EmptyState title="NO MISSIONS FLOWN." line="The fleet is still in the hangar." />
      ) : (
        <>
          <div className="ap-filmstrip">
            {launched.map((p) => (
              <div
                key={p.id}
                className="ap-filmstrip-item"
                onClick={() => setExpandedMissionId(expandedMissionId === p.id ? null : p.id)}
                title={p.title}
              >
                <div
                  className="ap-bay-patch"
                  style={{ backgroundImage: patchTex(p.id), width: 48, height: 48 }}
                  aria-hidden
                />
                <div style={{
                  fontSize: 9,
                  color: "var(--fg-dim)",
                  textAlign: "center",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  width: "100%",
                }}>
                  {p.title}
                </div>
                <div className="ap-num" style={{ fontSize: 8.5, color: "var(--fg-faint)" }}>
                  {D.fmtDate(p.shippedAt || p.completedAt)}
                </div>
              </div>
            ))}
          </div>
          {missionDetail && (
            <div className="ap-panel" style={{ padding: 14, marginTop: 8 }}>
              <div className="ap-display" style={{ fontSize: 18, marginBottom: 10 }}>{missionDetail.title}</div>
              {missionDetail.launchStats && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                  <Stamp tone="var(--starboard)">{missionDetail.launchStats.doneTasks}/{missionDetail.launchStats.tasks} tasks</Stamp>
                  <Stamp tone="var(--amber)">{missionDetail.launchStats.xp} XP</Stamp>
                  <Stamp>
                    {missionDetail.launchStats.estHours}h est
                    {missionDetail.launchStats.actualMs ? ` · ${D.fmtMs(missionDetail.launchStats.actualMs)}` : ""}
                  </Stamp>
                  <Stamp>{missionDetail.launchStats.spanDays}d build</Stamp>
                </div>
              )}
              {missionDetail.launchNote ? (
                <div style={{ fontSize: 12, color: "var(--fg-dim)", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 8 }}>
                  {missionDetail.launchNote}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "var(--fg-faint)", fontStyle: "italic", marginBottom: 8 }}>
                  No entry yet.
                </div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => setUI({ launchNoteFor: missionDetail.id })}>
                  <Icon name="edit" size={10} /> {missionDetail.launchNote ? "Edit entry" : "Write entry"}
                </button>
                <button type="button" className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => unshipProject(missionDetail.id)} title="Return to hangar">
                  Unlaunch
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

function RenameButton({ project }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.title);
  if (!editing) {
    return (
      <button
        type="button"
        className="ap-btn ap-btn--sm ap-btn--ghost"
        onClick={() => { setName(project.title); setEditing(true); }}
      >
        Rename
      </button>
    );
  }
  const commit = () => {
    if (name.trim()) updateProject(project.id, { title: name.trim() });
    setEditing(false);
  };
  return (
    <input
      autoFocus
      className="ap-field"
      value={name}
      style={{ width: 180 }}
      onChange={(e) => setName(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
    />
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
        <button
          type="button"
          className="ap-btn ap-btn--ghost ap-btn--sm"
          style={{ alignSelf: "flex-start", textTransform: "none", letterSpacing: 0 }}
          onClick={() => setEditing(true)}
        >
          + add description
        </button>
      );
    }
    return (
      <div
        onClick={() => setEditing(true)}
        title="Click to edit"
        className="ap-panel ap-panel--well"
        style={{ padding: "8px 10px", fontSize: 12.5, color: "var(--fg-dim)", lineHeight: 1.5, cursor: "text", whiteSpace: "pre-wrap" }}
      >
        {project.desc}
      </div>
    );
  }
  return (
    <textarea
      autoFocus
      className="ap-field"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); setDraft(project.desc || ""); setEditing(false); }
        else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
      }}
      placeholder="What this vehicle is, why it matters, what done looks like."
      style={{ height: 64 }}
    />
  );
}

/* ── STORES tab ────────────────────────────────────────────── */

function StoresTab() {
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
  const [assigningId, setAssigningId] = useState(null);
  const fileRef = useRef(null);

  const hour = meta.dayStartHour || 0;
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const activeProjects = useMemo(() => projects.filter((p) => !p.completedAt), [projects]);
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

  const assignBay = (taskId, projectId) => {
    updateTask(taskId, { projectId, projectIdChanged: true });
    const proj = projectsById.get(projectId);
    notify(`Assigned to ${proj ? `"${proj.title}"` : "bay"}`);
    setAssigningId(null);
  };

  const closeImport = () => {
    setParsed(null);
    setImportSel(new Set());
    setImportMakeProject(false);
    setImportProjectName("");
  };

  let cursorIdx = cursor ? cursor.index : -1;

  return (
    <>
      {/* CaptureBar STORES-adjacent only (no scheduleToday) */}
      <div style={{ marginBottom: 12 }}>
        <CaptureBar />
      </div>

      {/* gap: no ap-stores* classes — compose from generic primitives */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {["pending", "recurring", "done", "all"].map((f) => (
            <StampPick key={f} active={filter.status === f} onClick={() => setF({ status: f })}>{f}</StampPick>
          ))}
        </div>
        {filter.status === "pending" && (
          <>
            <span style={{ width: 1, height: 14, background: "var(--line)" }} />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {[["priority", "priority"], ["energy", "energy"], ["xp", "XP"], ["newest", "newest"], ["oldest", "oldest"]].map(([id, lbl]) => (
                <StampPick key={id} active={filter.sort === id} onClick={() => setF({ sort: id })}>{lbl}</StampPick>
              ))}
            </div>
          </>
        )}
        <div style={{ flex: 1 }} />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ""; }}
        />
        <button
          type="button"
          className="ap-btn ap-btn--sm ap-btn--ghost"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          title="Import tasks from a screenshot of another tool"
        >
          {importing ? "Reading…" : <><Icon name="camera" size={11} /> Screenshot import</>}
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <input
          className="ap-field ap-field--mono"
          placeholder="Search…"
          value={filter.q}
          onChange={(e) => setF({ q: e.target.value })}
          style={{ width: 200, padding: "6px 9px" }}
        />
        {projects.length > 0 && (
          <select
            className="ap-field"
            value={filter.project || ""}
            onChange={(e) => setF({ project: e.target.value || null })}
            style={{ width: 170, padding: "6px 9px" }}
          >
            <option value="">All bays</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        )}
        {usedTags.map((t) => (
          <StampPick key={t} active={filter.tag === t} onClick={() => setF({ tag: filter.tag === t ? null : t })}>#{t}</StampPick>
        ))}
      </div>

      {/* Screenshot import preview — full-screen re-tune (not floating plate) */}
      {parsed && (
        <div className="ap-screen" role="dialog" aria-label="IMPORT PREVIEW">
          <div className="ap-screen-head">
            <div className="ap-screen-head-title">IMPORT PREVIEW · {parsed.length} found</div>
            <div style={{ flex: 1 }} />
            <button type="button" className="ap-icon-btn" onClick={closeImport} aria-label="Discard">
              <Icon name="close" size={13} />
            </button>
          </div>
          <div className="ap-screen-body" style={{ maxWidth: 640, margin: "0 auto", width: "100%" }}>
            <div className="ap-ledger" style={{ maxHeight: 360, overflowY: "auto", marginBottom: 14 }}>
              {parsed.map((p, i) => {
                const on = importSel.has(i);
                const tone = D.DIFFICULTY[p.difficulty]?.tone || "var(--channel)";
                return (
                  <div
                    key={i}
                    onClick={() => setImportSel((prev) => {
                      const n = new Set(prev);
                      n.has(i) ? n.delete(i) : n.add(i);
                      return n;
                    })}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      background: on ? "var(--well)" : "transparent",
                      opacity: on ? 1 : 0.5,
                      cursor: "pointer",
                      borderBottom: "1px solid var(--line)",
                      boxShadow: on ? "inset 3px 0 0 " + tone : "inset 3px 0 0 var(--line)",
                    }}
                  >
                    <IncludeToggle
                      on={on}
                      onToggle={() => setImportSel((prev) => {
                        const n = new Set(prev);
                        n.has(i) ? n.delete(i) : n.add(i);
                        return n;
                      })}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                      {p.description && (
                        <div style={{ fontSize: 11, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</div>
                      )}
                    </div>
                    <div className="ap-num" style={{ display: "flex", gap: 6, fontSize: 9.5, color: "var(--fg-faint)", flexShrink: 0, alignItems: "center" }}>
                      <DifficultyPip d={p.difficulty} />
                      <span>{p.hours}H · {p.xp}XP</span>
                      {p.completed && <span style={{ color: "var(--starboard)" }}>NOMINAL</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--fg-dim)", cursor: "pointer" }}>
                <input type="checkbox" checked={importMakeProject} onChange={() => setImportMakeProject((v) => !v)} />
                Group as vehicle:
              </label>
              <input
                className="ap-field"
                value={importProjectName}
                onChange={(e) => setImportProjectName(e.target.value)}
                placeholder="Vehicle name"
                disabled={!importMakeProject}
                style={{ maxWidth: 220, opacity: importMakeProject ? 1 : 0.5, padding: "6px 9px" }}
              />
              <div style={{ flex: 1 }} />
              <button type="button" className="ap-btn ap-btn--sm ap-btn--ghost" onClick={closeImport}>Cancel</button>
              <button type="button" className="ap-btn ap-btn--sm ap-btn--primary" disabled={importSel.size === 0} onClick={commitImport}>
                Import {importSel.size}
              </button>
            </div>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState title="STATIC ON THE DOWNLINK" line="Nothing matches these filters." />
      ) : (
        <div className="ap-ledger" style={{ marginBottom: 28 }}>
          {list.map((t, i) => {
            const chunks = D.getTaskChunks(t.id, plan);
            const isSplit = chunks.length > 1;
            const scheduled = D.getTaskScheduledDate(t.id, plan);
            const canAssign = !t.projectId && !t.completed && t.recurring === "none" && activeProjects.length > 0;
            return (
              <div key={t.id} style={{ position: "relative" }}>
                <TaskRow
                  task={t}
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
                      {canAssign && (
                        <div style={{ marginBottom: isSplit ? 8 : 0 }}>
                          {assigningId === t.id ? (
                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                              <span className="ap-stencil" style={{ fontSize: 8.5 }}>Assign to</span>
                              {activeProjects.map((p) => (
                                <StampPick key={p.id} color={p.color} onClick={() => assignBay(t.id, p.id)}>{p.title}</StampPick>
                              ))}
                              <button type="button" className="ap-icon-btn" onClick={() => setAssigningId(null)} aria-label="Cancel assign">
                                <Icon name="close" size={10} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="ap-btn ap-btn--sm ap-btn--ghost"
                              onClick={() => setAssigningId(t.id)}
                              title="Assign to a vehicle bay"
                            >
                              {/* gap: Icon has no "anchor" case — use "tag" for ASSIGN BAY */}
                              <Icon name="tag" size={10} /> ASSIGN BAY
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
