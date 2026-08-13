// dock.jsx — The Satchel.
//
// DEPARTURE: projects are physical objects laid out on cloth — rolled
// scrolls tied with cord, grouped into provinces (their type) — not
// rows, not berth plates, not a seeded spatial basin. Progress is read
// off the cord knots, never a gauge. Arrivals hang on the memory cord.
//
// "Provinces" resolves the plan's CONFIRM item: the core does have
// categories (PROJECT_TYPES on projects, tags on tasks), so the
// grouping is real data, not decoration.
//
// All state, handlers and data flow are the core contract.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Seal, SealPick, Eyebrow, EmptyState, InkFoot, Bloom, DifficultyPip, Kbd } from "../components.jsx";
import { Knots } from "../charts.jsx";
import { CaptureNote } from "../capture.jsx";
import { WaypointRow, ChunksEditor } from "../taskrow.jsx";
import { plateFade, ghostWash } from "../texture.js";
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
  const arrived = projects.filter((p) => p.completedAt).sort((a, b) => (b.shippedAt || 0) - (a.shippedAt || 0));
  const ghostBg = useMemo(() => ghostWash("satchel", 300, 180), []);

  return (
    <div className="kz-pad">
      <div className="kz-head">
        <div className="kz-ghost" aria-hidden style={{ backgroundImage: ghostBg }}>荷</div>
        <div className="kz-label-row" style={{ marginBottom: 11 }}>
          <span className="kz-label kz-label--lit">The satchel · what you carry</span>
        </div>
        <div className="kz-greet">
          <h1 className="kz-brush">Everything you carry.</h1>
          <div className="kz-count">
            {active.length} journey{active.length === 1 ? "" : "s"}
            {ready.length ? <span style={{ color: "var(--sakura)" }}> · {ready.length} at the gate</span> : null} · {arrived.length} arrived
          </div>
        </div>
        <div style={{ marginBottom: 4 }}>
          <CaptureNote />
        </div>
      </div>

      <div className="kz-cols">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 15 }}>
            <div className="kz-label-row" style={{ flex: 1 }}>
              <span className="kz-label">{tab === "projects" ? "Journeys" : "Everything in the satchel"}</span>
            </div>
            <div className="kz-seg" role="group" aria-label="Satchel section">
              <button className={tab === "projects" ? "on" : ""} onClick={() => setUI({ dockFilter: { ...filter, tab: "projects" }, cursor: null })}>Journeys</button>
              <button className={tab === "library" ? "on" : ""} onClick={() => setUI({ dockFilter: { ...filter, tab: "library" }, cursor: null })}>Everything</button>
            </div>
          </div>
          {tab === "projects" ? <ScrollsTab /> : <LibraryTab />}
        </div>

        <aside className="kz-aside">
          <div>
            <div className="kz-label-row" style={{ marginBottom: 11 }}><span className="kz-label">Arrived · the memory cord</span></div>
            {arrived.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>Nowhere reached yet.</div>
            ) : (
              <MemoryCord arrived={arrived} />
            )}
          </div>
          <InkFoot caption={arrived.length ? `${arrived.length === 1 ? "one place" : arrived.length + " places"} reached` : "the road ahead"} />
        </aside>
      </div>
      <ArrivalNoteDialog />
    </div>
  );
}

/* ── the memory cord (arrived journeys) ────────────────────── */

function MemoryCord({ arrived }) {
  const [openId, setOpenId] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {arrived.map((p) => {
        const open = openId === p.id;
        const stats = p.launchStats;
        return (
          <div key={p.id} style={{ padding: "8px 0", boxShadow: "inset 0 1px 0 var(--line-dim)" }}>
            <div onClick={() => setOpenId(open ? null : p.id)} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", userSelect: "none" }}>
              <span style={{ width: 7, height: 7, background: "var(--sakura)", flexShrink: 0, transform: "rotate(45deg)" }} />
              <span style={{ flex: 1, fontSize: 12.5, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
              {p.launchNote && <span title="Has a journal entry" style={{ fontSize: 8, color: "var(--sakura)" }}>●</span>}
              <Seal>{D.fmtDate(p.shippedAt || p.completedAt)}</Seal>
              {stats && <span className="kz-num" style={{ fontSize: 9.5, color: "var(--amber)" }}>+{stats.xp}</span>}
            </div>
            {open && (
              <div className="kz-fade-in kz-well" style={{ marginTop: 9, padding: "10px 11px" }}>
                {stats && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 9 }}>
                    <Seal kind="sakura">{stats.doneTasks}/{stats.tasks} waypoints</Seal>
                    <Seal kind="amber">{stats.xp} resolve</Seal>
                    <Seal>{stats.estHours}h planned{stats.actualMs ? ` · ${D.fmtMs(stats.actualMs)} walked` : ""}</Seal>
                    <Seal>{stats.spanDays}d on the road</Seal>
                  </div>
                )}
                {p.launchNote ? (
                  <div style={{ fontSize: 12, color: "var(--fg-dim)", lineHeight: 1.65, whiteSpace: "pre-wrap", marginBottom: 9 }}>{p.launchNote}</div>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--fg-faint)", fontStyle: "italic", marginBottom: 9 }}>Nothing written about this arrival yet.</div>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="kz-btn kz-btn--sm" onClick={() => setUI({ launchNoteFor: p.id })}>
                    <Icon name="edit" size={10} /> {p.launchNote ? "Edit entry" : "Write entry"}
                  </button>
                  <button className="kz-btn kz-btn--sm" onClick={() => unshipProject(p.id)} title="Back onto the road">Set out again</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── the arrival note ──────────────────────────────────────── */

function deterministicArrivalDraft(stats) {
  if (!stats) return "";
  return `Arrived with ${stats.doneTasks}/${stats.tasks} waypoints reached and ${stats.xp} resolve gathered. ` +
    `Planned ${stats.estHours}h${stats.actualMs ? `, actually walked ${D.fmtMs(stats.actualMs)}` : ""}. ` +
    `First step to arrival: ${stats.spanDays} day${stats.spanDays === 1 ? "" : "s"}.`;
}

function ArrivalNoteDialog() {
  const forId = useStore((s) => s.ui.launchNoteFor);
  if (!forId) return null;
  return <ArrivalNoteInner key={forId} projectId={forId} />;
}

function ArrivalNoteInner({ projectId }) {
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
    setNote(deterministicArrivalDraft(stats));
    aiLaunchNote(project, stats || {}).then((text) => {
      if (alive && text) setNote(text);
    }).catch(() => {}).finally(() => alive && setDrafting(false));
    return () => { alive = false; };
  }, [projectId]);

  if (!project) { setUI({ launchNoteFor: null }); return null; }

  return (
    <div className="kz-backdrop" onClick={() => setUI({ launchNoteFor: null })}
      style={{ zIndex: 10004, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="kz-sheet kz-fade-in" style={{ width: "100%", maxWidth: 480 }}>
        <div className="kz-sheet-head">
          <span className="kz-tape kz-tape--sakura"><Icon name="petal" size={10} /> An arrival</span>
          <div style={{ flex: 1 }} />
          <button className="kz-icon-btn" onClick={() => setUI({ launchNoteFor: null })} aria-label="Close"><Icon name="close" size={12} /></button>
        </div>
        <div style={{ padding: "16px 19px 19px" }}>
          <div className="kz-brush" style={{ fontSize: 21, marginBottom: 13 }}>{project.title}</div>
          {stats && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 13 }}>
              <Seal kind="sakura">{stats.doneTasks}/{stats.tasks} waypoints</Seal>
              <Seal kind="amber">{stats.xp} resolve</Seal>
              <Seal>{stats.estHours}h planned{stats.actualMs ? ` · ${D.fmtMs(stats.actualMs)} walked` : ""}</Seal>
              <Seal>{stats.spanDays}d on the road</Seal>
            </div>
          )}
          <textarea className="kz-field" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="What did you reach, and what did the road take?"
            style={{ height: 100, marginBottom: 7 }} />
          <div className="kz-label" style={{ marginBottom: 13 }}>
            {drafting ? "the oracle is drafting — write over it freely, your words win"
              : aiStatus === "off" ? "oracle silent — an honest draft is prefilled; make it yours"
              : "drafted for you. edit, then keep it."}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="kz-go kz-go--bloom" style={{ flex: 1 }} onClick={() => saveLaunchNote(projectId, note)}>
              <Icon name="check" size={12} /> Keep it
            </button>
            <button className="kz-btn" onClick={() => setUI({ launchNoteFor: null })}>Skip</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── scrolls on cloth, grouped by province ─────────────────── */

function ScrollsTab() {
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

  // Provinces = the real PROJECT_TYPES the core already stores.
  const provinces = useMemo(() => {
    const byType = new Map();
    for (const p of active) {
      const key = p.type || "other";
      if (!byType.has(key)) byType.set(key, []);
      byType.get(key).push(p);
    }
    return Array.from(byType.entries()).map(([id, list]) => ({
      id,
      label: D.PROJECT_TYPES.find((t) => t.id === id)?.label || "Other",
      list,
    }));
  }, [active]);

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
      if (!newTasks.length) { notify("The oracle marked nothing — the scroll is unchanged"); }
      else {
        for (const t of newTasks) addChildToProject(project.id, { ...t, desc: t.description });
        notify(`Marked ${newTasks.length} waypoint${newTasks.length > 1 ? "s" : ""}`);
        setAiQuery(""); setAiAddingTo(null);
      }
    } catch (e) { notify(aiFailureMessage(e.kind)); }
    setAiBusy(false);
  };

  const renderScroll = (p) => {
    const pct = D.progressOfProject(p, tasksById);
    const children = (p.childTaskIds || []).map((id) => tasksById.get(id)).filter(Boolean);
    const doneCount = children.filter((c) => c.completed).length;
    const isReady = pct === 100 && children.length > 0;
    const isOpen = expandedId === p.id;
    const typeLbl = D.PROJECT_TYPES.find((t) => t.id === p.type)?.label || "Other";
    return (
      <div key={p.id}
        className={"kz-scroll-obj kz-fade-in" + (isReady ? " kz-scroll-obj--ready" : "") + (isOpen ? " kz-scroll-obj--open" : "")}
        style={{ "--proj": p.color, "--u-fade": plateFade("scroll-" + p.id) }}>
        <span className="kz-scroll-cord" aria-hidden />
        {isReady && <span className="kz-tape kz-tape--sakura" style={{ position: "absolute", top: 10, right: 10, fontSize: 8 }}>At the gate</span>}

        <div onClick={() => setExpandedId(isOpen ? null : p.id)} style={{ cursor: "pointer" }}>
          <div className="kz-scroll-title">{p.title}</div>
          <div className="kz-scroll-meta">
            <Seal>{children.length === 0 ? "unmarked" : `${doneCount}/${children.length}`}</Seal>
            <Seal tone={p.color}>{typeLbl}</Seal>
            {pct === 100 && children.length > 0 && <Seal tone="var(--sakura)">complete</Seal>}
          </div>
          <Knots pct={pct} color={p.color} />
          <div className="kz-label" style={{ marginTop: 7 }}>{pct}% of the way</div>
        </div>

        {!isOpen && (
          <div style={{ display: "flex", gap: 6, marginTop: 11 }}>
            {isReady && (
              <button className="kz-go kz-go--sm kz-go--bloom" onClick={(e) => { e.stopPropagation(); shipProject(p.id); }}>
                <Icon name="petal" size={11} /> Arrive
              </button>
            )}
            <button className="kz-btn kz-btn--sm" onClick={(e) => { e.stopPropagation(); setExpandedId(p.id); }}>Unroll</button>
          </div>
        )}

        {isOpen && (
          <div className="kz-fade-in" style={{ marginTop: 14 }}>
            <ProjectDesc project={p} />
            <div style={{ marginTop: 13, background: "var(--well)", borderRadius: 2 }}>
              {children.map((t) => (
                <div key={t.id} className="kz-shrine" style={{ "--row-lamp": t.completed ? "var(--line-dim)" : p.color, background: "transparent" }}>
                  <Bloom square done={t.completed}
                    onComplete={() => setCompletion(t.id, { done: true })}
                    onReopen={() => setCompletion(t.id, { done: false })} />
                  <span className="kz-shrine-title"
                    style={{ color: t.completed ? "var(--fg-faint)" : "var(--fg)", textDecoration: t.completed ? "line-through" : "none" }}
                    onClick={() => setUI({ editingTaskId: t.id, formOpen: true })}>{t.title}</span>
                  <span className="kz-label">{t.xp}</span>
                  <button className="kz-icon-btn" onClick={() => detachFromProject(t.id)} title="Take it out of this journey" aria-label="Detach"><Icon name="close" size={11} /></button>
                </div>
              ))}
              {children.length === 0 && <div className="kz-label" style={{ padding: "11px 12px" }}>nothing marked on this scroll yet</div>}
            </div>

            {addingTaskTo === p.id ? (
              <div style={{ display: "flex", gap: 6, marginTop: 11, alignItems: "center", flexWrap: "wrap" }}>
                <input ref={taskRef} className="kz-field" placeholder="Waypoint name" value={newTaskName} style={{ flex: 1, minWidth: 160 }}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitTask(p.id); if (e.key === "Escape") { setAddingTaskTo(null); setNewTaskName(""); } }} />
                <button className="kz-go kz-go--sm" onClick={() => submitTask(p.id)} disabled={!newTaskName.trim()}>Mark</button>
                <button className="kz-btn kz-btn--sm" onClick={() => { setAddingTaskTo(null); setNewTaskName(""); }}>Done</button>
              </div>
            ) : aiAddingTo === p.id ? (
              <div style={{ marginTop: 11, display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea autoFocus value={aiQuery} disabled={aiBusy} className="kz-field"
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submitAiExtend(p); }
                    else if (e.key === "Escape" && !aiBusy) { setAiAddingTo(null); setAiQuery(""); }
                  }}
                  placeholder="Describe the stretch to add — e.g. 'the shopping and the two calls, plus a tidy-up'"
                  style={{ height: 54 }} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="kz-go kz-go--sm" disabled={!aiQuery.trim() || aiBusy} onClick={() => submitAiExtend(p)}>
                    {aiBusy ? "Marking…" : "Ask the oracle"}
                  </button>
                  <button className="kz-btn kz-btn--sm" disabled={aiBusy} onClick={() => { setAiAddingTo(null); setAiQuery(""); }}>Never mind</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6, marginTop: 11, flexWrap: "wrap" }}>
                <button className="kz-btn kz-btn--sm" onClick={() => { setAddingTaskTo(p.id); setNewTaskName(""); }}>
                  <Icon name="plus" size={10} /> Mark a waypoint
                </button>
                <button className="kz-btn kz-btn--sm" onClick={() => { setAiAddingTo(p.id); setAiQuery(""); }}>
                  <Icon name="wind" size={10} /> Ask the oracle
                </button>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 15, paddingTop: 13, boxShadow: "inset 0 1px 0 var(--line-dim)", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }} title="Cord colour">
                {D.PROJECT_PALETTE.map((c) => (
                  <button key={c} onClick={() => updateProject(p.id, { color: c })} aria-label={"Set colour " + c}
                    style={{
                      width: 13, height: 13, background: c, padding: 0, cursor: "pointer", borderRadius: 2,
                      border: p.color === c ? "2px solid var(--fg)" : "1px solid var(--line)",
                    }} />
                ))}
              </div>
              <div style={{ flex: 1 }} />
              <RenameButton project={p} />
              <button className="kz-btn kz-btn--sm kz-btn--port" onClick={() => deleteProject(p.id)}>Scatter</button>
              <button className="kz-btn kz-btn--sm" onClick={() => setExpandedId(null)}>Roll up</button>
              {isReady && (
                <button className="kz-go kz-go--sm kz-go--bloom" onClick={() => shipProject(p.id)}>
                  <Icon name="petal" size={11} /> Arrive
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 15, flexWrap: "wrap" }}>
        {activeAnyType && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <SealPick active={typeFilter === "All"} onClick={() => setTypeFilter("All")}>All provinces</SealPick>
            {D.PROJECT_TYPES.map((t) => (
              <SealPick key={t.id} active={typeFilter === t.id} onClick={() => setTypeFilter(t.id)}>{t.label}</SealPick>
            ))}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <button className="kz-go kz-go--sm" onClick={() => setAdding(true)}>
          <Icon name="plus" size={11} /> New journey
        </button>
      </div>

      {adding && (
        <div className="kz-card kz-fade-in" style={{ padding: 15, marginBottom: 15, display: "flex", flexDirection: "column", gap: 11 }}>
          <input ref={nameRef} className="kz-field" placeholder="Where are you going?" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitNew(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }} />
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {D.PROJECT_TYPES.map((t) => (
              <SealPick key={t.id} active={newType === t.id} onClick={() => setNewType(t.id)}>{t.label}</SealPick>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="kz-go kz-go--sm" onClick={submitNew} disabled={!newName.trim()}>Set out</button>
            <button className="kz-btn kz-btn--sm" onClick={() => { setAdding(false); setNewName(""); }}>Never mind</button>
          </div>
        </div>
      )}

      {active.length === 0 && !adding && (
        <EmptyState haiku={"Nothing rolled and tied —\nthe cloth is bare, the cord loose.\nName somewhere to go."}>
          {activeAnyType && typeFilter !== "All"
            ? <>No journeys in that province.</>
            : <>Nothing under way. Start a journey, or capture with the Journey note.</>}
        </EmptyState>
      )}

      {active.length > 0 && (
        <div className="kz-cloth" style={{ marginBottom: 28 }}>
          {typeFilter === "All" && provinces.length > 1 ? (
            provinces.map((prov) => (
              <div key={prov.id} className="kz-province">
                <div className="kz-province-name kz-label-row">
                  <span className="kz-label">{prov.label} · {prov.list.length}</span>
                </div>
                <div className="kz-bundles">{prov.list.map(renderScroll)}</div>
              </div>
            ))
          ) : (
            <div className="kz-bundles">{active.map(renderScroll)}</div>
          )}
        </div>
      )}
    </>
  );
}

function RenameButton({ project }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.title);
  if (!editing) return <button className="kz-btn kz-btn--sm" onClick={() => { setName(project.title); setEditing(true); }}>Rename</button>;
  const commit = () => { if (name.trim()) updateProject(project.id, { title: name.trim() }); setEditing(false); };
  return (
    <input autoFocus className="kz-bare" value={name} style={{ width: 170 }}
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
      return <button className="kz-link" style={{ color: "var(--fg-faint)" }} onClick={() => setEditing(true)}>+ why this journey</button>;
    }
    return (
      <div onClick={() => setEditing(true)} title="Click to edit" className="kz-well"
        style={{ padding: "9px 11px", fontSize: 12.5, color: "var(--fg-dim)", lineHeight: 1.55, cursor: "text", whiteSpace: "pre-wrap", borderRadius: 2 }}>
        {project.desc}
      </div>
    );
  }
  return (
    <textarea autoFocus className="kz-field" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); setDraft(project.desc || ""); setEditing(false); }
        else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
      }}
      placeholder="What this journey is, why it matters, what arriving looks like."
      style={{ height: 66 }} />
  );
}

/* ── everything in the satchel (the library) ───────────────── */

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
  const [assigningId, setAssigningId] = useState(null);
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
      if (!result.length) { notify("Nothing readable in that picture"); }
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
    notify(`Took in ${picks.length} waypoint${picks.length > 1 ? "s" : ""}`);
    setParsed(null); setImportSel(new Set()); setImportMakeProject(false); setImportProjectName("");
  };

  const assignTask = (taskId, projectId) => {
    updateTask(taskId, { projectId, projectIdChanged: true });
    const proj = projectsById.get(projectId);
    notify(`Tied to ${proj ? `"${proj.title}"` : "the journey"}`);
    setAssigningId(null);
  };

  const cursorIdx = cursor ? cursor.index : -1;

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 11, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {["pending", "recurring", "done", "all"].map((f) => (
            <SealPick key={f} active={filter.status === f} onClick={() => setF({ status: f })}>
              {f === "recurring" ? "rituals" : f === "pending" ? "ahead" : f === "done" ? "walked" : "all"}
            </SealPick>
          ))}
        </div>
        {filter.status === "pending" && (
          <>
            <span style={{ width: 1, height: 14, background: "var(--line)" }} />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {[["priority", "priority"], ["energy", "energy"], ["xp", "resolve"], ["newest", "newest"], ["oldest", "oldest"]].map(([id, lbl]) => (
                <SealPick key={id} active={filter.sort === id} onClick={() => setF({ sort: id })}>{lbl}</SealPick>
              ))}
            </div>
          </>
        )}
        <div style={{ flex: 1 }} />
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ""; }} />
        <button className="kz-btn kz-btn--sm" onClick={() => fileRef.current?.click()} disabled={importing}
          title="Read waypoints out of a picture from another tool">
          {importing ? "Reading…" : <><Icon name="camera" size={11} /> Read a picture</>}
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 15, flexWrap: "wrap" }}>
        <input className="kz-field kz-field--mono" placeholder="Search…" value={filter.q} onChange={(e) => setF({ q: e.target.value })} style={{ width: 190, padding: "6px 9px" }} />
        {projects.length > 0 && (
          <select className="kz-field" value={filter.project || ""} onChange={(e) => setF({ project: e.target.value || null })} style={{ width: 170, padding: "6px 9px" }}>
            <option value="">All journeys</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        )}
        {usedTags.map((t) => (
          <SealPick key={t} active={filter.tag === t} onClick={() => setF({ tag: filter.tag === t ? null : t })}>#{t}</SealPick>
        ))}
      </div>

      {parsed && (
        <div className="kz-card kz-fade-in" style={{ padding: 15, marginBottom: 15 }}>
          <Eyebrow lit right={<button className="kz-icon-btn" onClick={() => setParsed(null)} aria-label="Discard"><Icon name="close" size={12} /></button>}>
            Read from the picture · {parsed.length} found
          </Eyebrow>
          <div className="kz-scroll" style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto", marginBottom: 11 }}>
            {parsed.map((p, i) => {
              const on = importSel.has(i);
              return (
                <div key={i} onClick={() => setImportSel((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: on ? "var(--well)" : "transparent", opacity: on ? 1 : 0.5, cursor: "pointer", borderLeft: "3px solid " + (on ? (D.DIFFICULTY[p.difficulty]?.tone || "var(--road-lit)") : "var(--line-dim)") }}>
                  <Bloom square done={on} onComplete={() => {}} onReopen={() => {}} label="Include" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                    {p.description && <div style={{ fontSize: 11, color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</div>}
                  </div>
                  <div className="kz-label" style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    <DifficultyPip d={p.difficulty} />
                    <span>{p.hours}h · {p.xp}</span>
                    {p.completed && <span style={{ color: "var(--sakura)" }}>done</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--fg-dim)", cursor: "pointer" }}>
              <input type="checkbox" checked={importMakeProject} onChange={() => setImportMakeProject((v) => !v)} />
              Tie them into one journey:
            </label>
            <input className="kz-field" value={importProjectName} onChange={(e) => setImportProjectName(e.target.value)}
              placeholder="Journey name" disabled={!importMakeProject} style={{ maxWidth: 210, opacity: importMakeProject ? 1 : 0.5, padding: "6px 9px" }} />
            <div style={{ flex: 1 }} />
            <button className="kz-btn kz-btn--sm" onClick={() => setParsed(null)}>Never mind</button>
            <button className="kz-go kz-go--sm" disabled={importSel.size === 0} onClick={commitImport}>
              Take in {importSel.size}
            </button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState haiku={"The satchel is bare —\nnothing here matches the search.\nLoosen the cord."}>Nothing matches.</EmptyState>
      ) : (
        <div className="kz-road" style={{ marginBottom: 28 }}>
          {list.map((t, i) => {
            const chunks = D.getTaskChunks(t.id, plan);
            const isSplit = chunks.length > 1;
            const scheduled = D.getTaskScheduledDate(t.id, plan);
            const canAssign = !t.projectId && !t.completed && t.recurring === "none" && activeProjects.length > 0;
            const done = t.recurring !== "none" ? D.isRecurringDoneNow(t, hour) : t.completed;
            return (
              <div key={t.id} className={"kz-station" + (done ? " kz-station--done" : "") + (cursorIdx === i ? " kz-station--here" : "")}>
                <WaypointRow task={t}
                  project={t.projectId ? projectsById.get(t.projectId) : null}
                  doneHere={done}
                  onToggleDone={(d) => setCompletion(t.id, { done: d })}
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
                              <span className="kz-label">Tie to</span>
                              {activeProjects.map((p) => (
                                <SealPick key={p.id} color={p.color} onClick={() => assignTask(t.id, p.id)}>{p.title}</SealPick>
                              ))}
                              <button className="kz-icon-btn" onClick={() => setAssigningId(null)} aria-label="Cancel"><Icon name="close" size={10} /></button>
                            </div>
                          ) : (
                            <button className="kz-btn kz-btn--sm" onClick={() => setAssigningId(t.id)} title="Tie to a journey">
                              <Icon name="satchel" size={10} /> Tie to a journey
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
