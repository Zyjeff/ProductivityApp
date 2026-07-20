// dock.jsx — BOSS RUSH, Kuromi cut: every project is a boss fight
// with a draining HP bar; at 0 HP the FINISH 'EM button appears.
// Beaten bosses hang in the HALL OF FAME (the ship log). The Vault
// is the scheme library — status filters, sorts, marks, search, the
// scan-import trick, and one-click "GIVE IT A BOSS" assignment.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, EmptyState, GhostFoot, Kbd, MOD, PriorityDot, SkullBox, Tag, GLYPH_SKULL, GLYPH_STAR } from "../components.jsx";
import { HPBar } from "../charts.jsx";
import { GhostSkull } from "../chrome.jsx";
import { CaptureSlab } from "../capture.jsx";
import { TaskRow, ChunksEditor } from "../taskrow.jsx";
import { glyph } from "../sprite.js";
import * as D from "../../../core/domain.js";
import {
  useStore, getState, setUI, setCompletion, addTask, notify, updateTask,
  createProject, updateProject, deleteProject, shipProject, unshipProject,
  addChildToProject, detachFromProject, saveLaunchNote,
} from "../../../core/store.js";
import { registerActiveList } from "../../../core/keys.js";
import { aiExtendProject, aiImportFromScreenshot, aiLaunchNote, aiFailureMessage } from "../../../core/ai.js";
import { scoreTask } from "../../../core/enrich.js";

const typeLabel = (id) => D.PROJECT_TYPES.find((t) => t.id === id)?.label || "Other";

export function DockView() {
  const filter = useStore((s) => s.ui.dockFilter);
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const tab = filter.tab;
  const active = projects.filter((p) => !p.completedAt);
  const ready = active.filter((p) => (p.childTaskIds || []).length > 0 && D.progressOfProject(p, tasksById) === 100);
  const beaten = projects.filter((p) => p.completedAt).sort((a, b) => (b.shippedAt || 0) - (a.shippedAt || 0));

  return (
    <div className="k-wrap">
      <div className="k-pagehead k-ghostwrap">
        <div className="k-ghost"><GhostSkull size={104} /></div>
        <div className="k-title">BOSS RUSH <span className="k-accent">— drain their HP</span></div>
        <div className="k-sub">
          {active.length} boss{active.length === 1 ? "" : "es"} standing
          {ready.length ? <span className="k-green"> · {ready.length} finishable</span> : null} · {beaten.length} beaten
        </div>
        <div className="k-mt">
          <CaptureSlab placeholder="name the next big score…" />
        </div>
      </div>

      <div className="k-grid k-grid-today">
        <div className="k-col">
          <div className="k-rowline">
            <span className="k-eyebrow" style={{ marginBottom: 0, flex: 1 }}>
              {tab === "projects" ? "THE ARENA" : "THE VAULT"}
            </span>
            <div className="k-slab-types" role="group" aria-label="Dock section" style={{ margin: 0, width: 230 }}>
              <button className={tab === "projects" ? "is-on" : ""} onClick={() => setUI({ dockFilter: { ...filter, tab: "projects" }, cursor: null })}>BOSSES</button>
              <button className={tab === "library" ? "is-on" : ""} onClick={() => setUI({ dockFilter: { ...filter, tab: "library" }, cursor: null })}>THE VAULT</button>
            </div>
          </div>
          {tab === "projects" ? <BossRush /> : <Vault />}
        </div>

        <aside className="k-col">
          <div className="k-plate k-plate-pad">
            <div className="k-eyebrow">HALL OF FAME</div>
            {beaten.length === 0 ? (
              <div className="k-faint k-sm">No trophies yet. Go beat something.</div>
            ) : (
              <HallOfFame beaten={beaten} />
            )}
          </div>
          <div className="k-rowline" style={{ justifyContent: "center", opacity: 0.6 }}>
            <GhostFoot rows={GLYPH_STAR} color="#37234e" size={30} />
            <span className="k-mono-sm k-faint">{beaten.length ? `${beaten.length} notch${beaten.length > 1 ? "es" : ""} on the hood` : "the pedestal waits"}</span>
          </div>
        </aside>
      </div>
      <LaunchNoteDialog />
    </div>
  );
}

/* ── hall of fame (ship log) ─────────────────────────────────── */

function HallOfFame({ beaten }) {
  const [openId, setOpenId] = useState(null);
  return (
    <div>
      {beaten.map((p) => {
        const open = openId === p.id;
        const stats = p.launchStats;
        return (
          <div key={p.id} className="k-beaten" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div className="k-rowline" onClick={() => setOpenId(open ? null : p.id)} style={{ cursor: "pointer", userSelect: "none" }}>
              <img src={glyph(GLYPH_SKULL, "#4df2a4")} alt="" style={{ height: 16, imageRendering: "pixelated" }} />
              <span className="k-boss-title" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
              {p.launchNote && <span title="Has a diary entry" className="k-green" style={{ fontSize: 9 }}>●</span>}
              <span className="k-mono-sm k-faint">{D.fmtDate(p.shippedAt || p.completedAt).toUpperCase()}</span>
              {stats && <span className="k-mono-sm k-pink">+{stats.xp}</span>}
            </div>
            {open && (
              <div style={{ marginTop: 9, padding: "10px 11px", background: "var(--well)", borderRadius: 6 }}>
                {stats && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                    <span className="k-chip is-green is-on">{stats.doneTasks}/{stats.tasks} schemes</span>
                    <span className="k-chip is-on">{stats.xp} XP</span>
                    <span className="k-chip">{stats.estHours}h est{stats.actualMs ? ` · ${D.fmtMs(stats.actualMs)} actual` : ""}</span>
                    <span className="k-chip">{stats.spanDays}d spree</span>
                  </div>
                )}
                {p.launchNote ? (
                  <div className="k-dim" style={{ fontSize: 12.5, lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 8 }}>{p.launchNote}</div>
                ) : (
                  <div className="k-faint" style={{ fontSize: 11.5, fontStyle: "italic", marginBottom: 8 }}>No diary entry for this win yet.</div>
                )}
                <div className="k-rowline">
                  <button className="k-btn is-sm" onClick={() => setUI({ launchNoteFor: p.id })}>
                    <Icon name="pen" size={10} /> {p.launchNote ? "EDIT ENTRY" : "WRITE ENTRY"}
                  </button>
                  <button className="k-btn is-sm is-ghost" onClick={() => unshipProject(p.id)} title="Back to the arena">RESURRECT</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── launch-note console ─────────────────────────────────────── */

function deterministicLaunchDraft(stats) {
  if (!stats) return "";
  return `Beaten with ${stats.doneTasks}/${stats.tasks} schemes pulled off and ${stats.xp} XP of chaos. ` +
    `Estimated ${stats.estHours}h${stats.actualMs ? `, actually took ${D.fmtMs(stats.actualMs)}` : ""}. ` +
    `First scheme to final blow: ${stats.spanDays} day${stats.spanDays === 1 ? "" : "s"}.`;
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
    <div className="k-backdrop" style={{ zIndex: 85, alignItems: "center" }} onMouseDown={(e) => e.target === e.currentTarget && setUI({ launchNoteFor: null })}>
      <div className="k-console" style={{ maxWidth: 480 }}>
        <div className="k-console-head">
          <span className="k-display"><Icon name="star" size={10} /> VICTORY ENTRY</span>
          <button className="k-x" onClick={() => setUI({ launchNoteFor: null })} aria-label="Close"><Icon name="x" size={10} /></button>
        </div>
        <div className="k-console-body">
          <div className="k-display" style={{ fontSize: 15, marginBottom: 12 }}>{project.title}</div>
          {stats && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
              <span className="k-chip is-green is-on">{stats.doneTasks}/{stats.tasks} schemes</span>
              <span className="k-chip is-on">{stats.xp} XP</span>
              <span className="k-chip">{stats.estHours}h est{stats.actualMs ? ` · ${D.fmtMs(stats.actualMs)} in mischief mode` : ""}</span>
              <span className="k-chip">{stats.spanDays}d spree</span>
            </div>
          )}
          <textarea
            className="k-textarea" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Dear diary: how did the mighty fall?"
            style={{ height: 96, marginBottom: 6 }}
          />
          <div className="k-mono-sm k-faint" style={{ marginBottom: 12 }}>
            {drafting ? "THE IMP IS GLOATING FOR YOU — EDIT FREELY, YOUR WORDS WIN…"
              : aiStatus === "off" ? "IMP OFFLINE — DETERMINISTIC BRAG PREFILLED; MAKE IT YOURS."
              : "BRAGGED FOR YOU. EDIT, THEN INK IT."}
          </div>
          <div className="k-rowline">
            <button className="k-btn is-green" style={{ flex: 1 }} onClick={() => saveLaunchNote(projectId, note)}>
              <Icon name="check" size={11} /> INK IT IN THE DIARY
            </button>
            <button className="k-btn" onClick={() => setUI({ launchNoteFor: null })}>SKIP</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── boss rush ───────────────────────────────────────────────── */

function BossRush() {
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
    taskRef.current?.focus();
  };
  const submitAiExtend = async (project) => {
    const q = aiQuery.trim();
    if (!q || aiBusy) return;
    setAiBusy(true);
    try {
      const children = (project.childTaskIds || []).map((id) => tasksById.get(id)).filter(Boolean);
      const newTasks = await aiExtendProject(project, children, q);
      if (!newTasks.length) { notify("The imp returned nothing — no schemes added"); }
      else {
        for (const t of newTasks) addChildToProject(project.id, { ...t, desc: t.description });
        notify(`Summoned ${newTasks.length} scheme${newTasks.length > 1 ? "s" : ""}`);
        setAiQuery(""); setAiAddingTo(null);
      }
    } catch (e) { notify(aiFailureMessage(e.kind)); }
    setAiBusy(false);
  };

  return (
    <>
      <div className="k-rowline" style={{ flexWrap: "wrap", marginBottom: 4 }}>
        {activeAnyType && (
          <>
            <button className={"k-chip" + (typeFilter === "All" ? " is-on" : "")} onClick={() => setTypeFilter("All")}>all</button>
            {D.PROJECT_TYPES.map((t) => (
              <button key={t.id} className={"k-chip" + (typeFilter === t.id ? " is-on" : "")} onClick={() => setTypeFilter(t.id)}>{t.label.toLowerCase()}</button>
            ))}
          </>
        )}
        <span className="k-spacer" />
        <button className="k-btn is-primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={11} /> SUMMON A BOSS
        </button>
      </div>

      {adding && (
        <div className="k-plate is-hi k-plate-pad">
          <div className="k-eyebrow">NEW BIG SCORE</div>
          <input
            ref={nameRef} className="k-input" placeholder="Boss name" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitNew(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
            style={{ marginBottom: 9 }}
          />
          <div className="k-rowline" style={{ flexWrap: "wrap", marginBottom: 10 }}>
            {D.PROJECT_TYPES.map((t) => (
              <button key={t.id} className={"k-chip" + (newType === t.id ? " is-on" : "")} onClick={() => setNewType(t.id)}>{t.label}</button>
            ))}
          </div>
          <div className="k-rowline">
            <button className="k-btn is-primary" onClick={submitNew} disabled={!newName.trim()}>SUMMON</button>
            <button className="k-btn" onClick={() => { setAdding(false); setNewName(""); }}>NEVER MIND</button>
          </div>
        </div>
      )}

      {active.length === 0 && !adding && (
        <EmptyState
          title="THE ARENA IS EMPTY"
          sub={activeAnyType && typeFilter !== "All"
            ? `No ${typeLabel(typeFilter).toLowerCase()} bosses standing. Cowards.`
            : "No bosses to fight. Summon one, or whisper a BIG SCORE into the slot."}
        />
      )}

      <div style={{ marginBottom: 28 }}>
        {active.map((p) => {
          const pct = D.progressOfProject(p, tasksById);
          const children = (p.childTaskIds || []).map((id) => tasksById.get(id)).filter(Boolean);
          const doneCount = children.filter((c) => c.completed).length;
          const isReady = pct === 100 && children.length > 0;
          const isOpen = expandedId === p.id;
          return (
            <div key={p.id} className="k-boss" style={isReady ? { borderColor: "var(--starboard)" } : {}}>
              <div className="k-boss-head" onClick={() => setExpandedId(isOpen ? null : p.id)}>
                <span className="k-boss-medal" style={{ borderColor: p.color }}>
                  <img src={glyph(GLYPH_SKULL, p.color || "#ff4d9e")} alt="" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="k-boss-title">{p.title}</div>
                  <div className="k-boss-meta">
                    <span>{children.length === 0 ? "NO HP YET" : `${doneCount}/${children.length} SCHEMES`}</span>
                    <span style={{ color: p.color }}>{typeLabel(p.type).toUpperCase()}</span>
                    {p.desc && <span className="k-faint">{p.desc.slice(0, 44)}</span>}
                    {isReady && <span className="k-green">BEATABLE!</span>}
                  </div>
                </div>
                {isReady && (
                  <button className="k-btn is-green" onClick={(e) => { e.stopPropagation(); shipProject(p.id); }}>
                    <Icon name="star" size={11} /> FINISH 'EM
                  </button>
                )}
                <button className="k-btn is-sm" onClick={(e) => { e.stopPropagation(); setExpandedId(isOpen ? null : p.id); }}>
                  {isOpen ? "FOLD" : "SIZE UP"}
                </button>
              </div>
              <div className="k-boss-hp">
                <div className="k-hp-line">
                  <span>BOSS HP</span>
                  <span className="k-pct">{children.length === 0 ? "—" : `${pct}% DRAINED`}</span>
                </div>
                <HPBar pct={children.length === 0 ? 100 : 100 - pct} />
              </div>

              {isOpen && (
                <div className="k-boss-body">
                  <ProjectDesc project={p} />
                  <div style={{ marginTop: 12, background: "var(--well)", borderRadius: 7, padding: "6px 8px" }}>
                    {children.length === 0 && (
                      <div className="k-mono-sm k-faint" style={{ padding: 8 }}>No schemes yet — a boss without HP is just a poster.</div>
                    )}
                    {children.map((t) => (
                      <div key={t.id} className="k-rowline" style={{ padding: "5px 2px" }}>
                        <SkullBox done={t.completed} onClick={() => setCompletion(t.id, { done: !t.completed })} title={t.completed ? "reopen" : "pull it off"} />
                        <span
                          style={{ flex: 1, fontSize: 13, color: t.completed ? "var(--fg-faint)" : "var(--fg)", textDecoration: t.completed ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}
                          onClick={() => setUI({ editingTaskId: t.id, formOpen: true })}
                        >
                          {t.title}
                        </span>
                        <span className="k-mono-sm k-faint">{t.xp} XP</span>
                        <button className="k-mini-btn" onClick={() => detachFromProject(t.id)} title="Cut loose from the boss" aria-label="Cut loose">
                          <Icon name="x" size={9} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {addingTaskTo === p.id ? (
                    <div className="k-rowline k-mt">
                      <input
                        ref={taskRef} className="k-input" placeholder="Scheme name" value={newTaskName} style={{ flex: 1 }}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") submitTask(p.id); if (e.key === "Escape") { setAddingTaskTo(null); setNewTaskName(""); } }}
                      />
                      <button className="k-btn is-sm is-primary" onClick={() => submitTask(p.id)} disabled={!newTaskName.trim()}>ADD</button>
                      <button className="k-btn is-sm" onClick={() => { setAddingTaskTo(null); setNewTaskName(""); }}>DONE</button>
                    </div>
                  ) : aiAddingTo === p.id ? (
                    <div className="k-mt" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <textarea
                        autoFocus value={aiQuery} disabled={aiBusy} className="k-textarea"
                        onChange={(e) => setAiQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submitAiExtend(p); }
                          else if (e.key === "Escape" && !aiBusy) { setAiAddingTo(null); setAiQuery(""); }
                        }}
                        placeholder="Tell the imp what this boss needs — e.g. 'API hookup and login screen, plus a polish pass'"
                        style={{ height: 52 }}
                      />
                      <div className="k-rowline">
                        <button className="k-btn is-sm is-primary" disabled={!aiQuery.trim() || aiBusy} onClick={() => submitAiExtend(p)}>
                          {aiBusy ? "THE IMP IS SCHEMING…" : "SUMMON SCHEMES"}
                        </button>
                        <button className="k-btn is-sm" disabled={aiBusy} onClick={() => { setAiAddingTo(null); setAiQuery(""); }}>CANCEL</button>
                      </div>
                    </div>
                  ) : (
                    <div className="k-rowline k-mt">
                      <button className="k-btn is-sm" onClick={() => { setAddingTaskTo(p.id); setNewTaskName(""); }}>
                        <Icon name="plus" size={10} /> ADD SCHEME
                      </button>
                      <button className="k-btn is-sm" onClick={() => { setAiAddingTo(p.id); setAiQuery(""); }}>
                        <Icon name="bolt" size={10} /> IMP, ADD SCHEMES
                      </button>
                    </div>
                  )}

                  <div className="k-rowline k-mt" style={{ paddingTop: 12, background: "var(--dither-baseline) repeat-x top", flexWrap: "wrap" }}>
                    <div className="k-rowline" style={{ gap: 4 }} title="Boss color">
                      {D.PROJECT_PALETTE.map((c) => (
                        <button
                          key={c} onClick={() => updateProject(p.id, { color: c })} aria-label={"Set color " + c}
                          style={{
                            width: 14, height: 14, background: c, padding: 0, cursor: "pointer", borderRadius: 3,
                            border: p.color === c ? "2px solid var(--fg)" : "1px solid var(--line)",
                          }}
                        />
                      ))}
                    </div>
                    <span className="k-spacer" />
                    <RenameButton project={p} />
                    <button className="k-btn is-sm is-danger" onClick={() => deleteProject(p.id)}>SCUTTLE</button>
                    {isReady && (
                      <button className="k-btn is-green" onClick={() => shipProject(p.id)}>
                        <Icon name="star" size={11} /> FINISH 'EM
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
  if (!editing) return <button className="k-btn is-sm" onClick={() => { setName(project.title); setEditing(true); }}>RENAME</button>;
  const commit = () => { if (name.trim()) updateProject(project.id, { title: name.trim() }); setEditing(false); };
  return (
    <input
      autoFocus className="k-input" value={name} style={{ width: 190, padding: "4px 9px" }}
      onChange={(e) => setName(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
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
      return <button className="k-btn is-sm is-ghost k-faint" onClick={() => setEditing(true)}>+ what's this boss about?</button>;
    }
    return (
      <div
        onClick={() => setEditing(true)} title="Click to edit"
        className="k-dim"
        style={{ padding: "8px 10px", background: "var(--well)", borderRadius: 6, fontSize: 12.5, lineHeight: 1.5, cursor: "text", whiteSpace: "pre-wrap" }}
      >
        {project.desc}
      </div>
    );
  }
  return (
    <textarea
      autoFocus className="k-textarea" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); setDraft(project.desc || ""); setEditing(false); }
        else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
      }}
      placeholder="What this boss is, why it must fall, what beaten looks like."
      style={{ height: 64 }}
    />
  );
}

/* ── the vault (library) ─────────────────────────────────────── */

function Vault() {
  const tasks = useStore((s) => s.tasks);
  const plan = useStore((s) => s.plan);
  const projects = useStore((s) => s.projects);
  const filter = useStore((s) => s.ui.dockFilter);
  const cursor = useStore((s) => s.ui.cursor);
  const meta = useStore((s) => s.meta);
  const energy = useStore((s) => s.ui.energy);
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
      if (!result.length) { notify("No schemes found in that screenshot"); }
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
    notify(`Stole ${picks.length} scheme${picks.length > 1 ? "s" : ""} fair and square`);
    setParsed(null); setImportSel(new Set()); setImportMakeProject(false); setImportProjectName("");
  };

  const berthTask = (taskId, projectId) => {
    updateTask(taskId, { projectId, projectIdChanged: true });
    const proj = projectsById.get(projectId);
    notify(`Handed to ${proj ? `"${proj.title}"` : "the boss"}`);
    setBerthingId(null);
  };

  let cursorIdx = cursor ? cursor.index : -1;

  return (
    <>
      <div className="k-rowline" style={{ flexWrap: "wrap", gap: 6 }}>
        {["pending", "recurring", "done", "all"].map((f) => (
          <button key={f} className={"k-chip" + (filter.status === f ? " is-on" : "")} onClick={() => setF({ status: f })}>{f}</button>
        ))}
        {filter.status === "pending" && (
          <>
            <span style={{ width: 1, height: 15, background: "var(--line-hi)" }} />
            {[["priority", "heat"], ["energy", "mood"], ["xp", "XP"], ["newest", "newest"], ["oldest", "oldest"]].map(([id, lbl]) => (
              <button key={id} className={"k-chip is-green" + (filter.sort === id ? " is-on" : "")} onClick={() => setF({ sort: id })}>{lbl}</button>
            ))}
          </>
        )}
        <span className="k-spacer" />
        <input
          ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ""; }}
        />
        <button
          className="k-btn is-sm" onClick={() => fileRef.current?.click()} disabled={importing}
          title="Steal schemes from a screenshot of another app"
        >
          {importing ? "THE IMP IS READING…" : <><Icon name="eye" size={11} /> SCAN A SCREENSHOT</>}
        </button>
      </div>

      <div className="k-rowline" style={{ flexWrap: "wrap", gap: 6 }}>
        <input
          className="k-input k-mono" placeholder="Search the vault…" value={filter.q}
          onChange={(e) => setF({ q: e.target.value })} style={{ width: 200, padding: "5px 10px" }}
        />
        {projects.length > 0 && (
          <select className="k-select" value={filter.project || ""} onChange={(e) => setF({ project: e.target.value || null })} style={{ width: 170, padding: "5px 9px" }}>
            <option value="">All bosses</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        )}
        {usedTags.map((t) => (
          <button key={t} className={"k-chip is-violet" + (filter.tag === t ? " is-on" : "")} onClick={() => setF({ tag: filter.tag === t ? null : t })}>#{t}</button>
        ))}
      </div>

      {parsed && (
        <div className="k-plate is-hi k-plate-pad">
          <div className="k-rowline">
            <span className="k-eyebrow" style={{ marginBottom: 0, flex: 1 }}>STOLEN GOODS · {parsed.length} FOUND</span>
            <button className="k-mini-btn" onClick={() => setParsed(null)} aria-label="Discard"><Icon name="x" size={10} /></button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto", margin: "10px 0" }}>
            {parsed.map((p, i) => {
              const on = importSel.has(i);
              return (
                <div
                  key={i}
                  onClick={() => setImportSel((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 6,
                    background: on ? "var(--well)" : "transparent", opacity: on ? 1 : 0.5, cursor: "pointer",
                    boxShadow: on ? "inset 3px 0 0 " + (D.DIFFICULTY[p.difficulty]?.tone || "var(--channel)") : "inset 3px 0 0 var(--line)",
                  }}
                >
                  <span className={"k-row-check" + (on ? " is-done" : "")} style={{ width: 17, height: 17 }}><Icon name="check" size={9} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                    {p.description && <div className="k-faint" style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</div>}
                  </div>
                  <div className="k-mono-sm k-faint" style={{ display: "flex", gap: 7, flexShrink: 0, alignItems: "center" }}>
                    <span style={{ color: D.DIFFICULTY[p.difficulty]?.tone }}>{(p.difficulty || "?").toUpperCase()}</span>
                    <span>{p.hours}H · {p.xp}XP</span>
                    {p.completed && <span className="k-green">DONE</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="k-rowline" style={{ flexWrap: "wrap" }}>
            <label className="k-rowline k-dim" style={{ gap: 6, fontSize: 12.5, cursor: "pointer" }}>
              <input type="checkbox" checked={importMakeProject} onChange={() => setImportMakeProject((v) => !v)} />
              group as a boss:
            </label>
            <input
              className="k-input" value={importProjectName} onChange={(e) => setImportProjectName(e.target.value)}
              placeholder="Boss name" disabled={!importMakeProject} style={{ maxWidth: 210, opacity: importMakeProject ? 1 : 0.5, padding: "5px 9px" }}
            />
            <span className="k-spacer" />
            <button className="k-btn is-sm" onClick={() => setParsed(null)}>DROP IT</button>
            <button className="k-btn is-sm is-primary" disabled={importSel.size === 0} onClick={commitImport}>
              STOW {importSel.size}
            </button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState title="THE VAULT ECHOES" sub="Nothing matches. The perfect crime leaves no evidence." />
      ) : (
        <div style={{ marginBottom: 28 }}>
          {list.map((t, i) => {
            const chunks = D.getTaskChunks(t.id, plan);
            const isSplit = chunks.length > 1;
            const scheduled = D.getTaskScheduledDate(t.id, plan);
            const canBerth = !t.projectId && !t.completed && t.recurring === "none" && activeProjects.length > 0;
            return (
              <TaskRow
                key={t.id}
                task={t}
                doneHere={t.recurring !== "none" ? D.isRecurringDoneNow(t, hour) : t.completed}
                recurringRow={t.recurring !== "none"}
                badge={isSplit ? `split · ${chunks.length}d` : scheduled ? D.fmtIsoShort(scheduled) : null}
                cursor={cursorIdx === i}
                globalIdx={i}
              >
                {canBerth && (
                  <div style={{ margin: "-2px 0 6px", padding: "8px 12px", background: "var(--rail)", border: "2px solid var(--line)", borderTop: "none", borderRadius: "0 0 7px 7px" }}>
                    {berthingId === t.id ? (
                      <div className="k-rowline" style={{ flexWrap: "wrap", gap: 5 }}>
                        <span className="k-mono-sm k-faint">hand it to:</span>
                        {activeProjects.map((p) => (
                          <button key={p.id} className="k-chip" style={{ borderColor: p.color }} onClick={() => berthTask(t.id, p.id)}>{p.title}</button>
                        ))}
                        <button className="k-mini-btn" onClick={() => setBerthingId(null)} aria-label="Cancel"><Icon name="x" size={9} /></button>
                      </div>
                    ) : (
                      <button className="k-btn is-sm" onClick={() => setBerthingId(t.id)} title="Assign to a boss fight">
                        <Icon name="target" size={10} /> GIVE IT A BOSS
                      </button>
                    )}
                  </div>
                )}
              </TaskRow>
            );
          })}
        </div>
      )}
    </>
  );
}
