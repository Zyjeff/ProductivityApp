// taskform.jsx — the long form, Kaze's writing desk. Behaviour is the
// core contract exactly: uncommitted step/tag text is committed on
// submit, the deterministic score follows difficulty until the user
// touches resolve, and promote-to-project ships the same flow.
//
// Recurring is a REAL core capability (recurring + history[]), so the
// Ritual chooser here is live — not decoration.

import React, { useEffect, useRef, useState } from "react";
import { Icon, Kbd, MOD, SealPick } from "./components.jsx";
import {
  DIFFICULTY, PRIORITIES, allKnownTags, TAGS_BUILTIN, isoDate, addDays,
  deterministicScore, getTaskChunks, getTaskScheduledDate, uid,
} from "../../core/domain.js";
import { useStore, getState, addTask, updateTask, setUI, notify, addCustomTag, promoteToProject } from "../../core/store.js";
import { enrichManualTask, scoreTask } from "../../core/enrich.js";

export function TaskFormModal() {
  const formOpen = useStore((s) => s.ui.formOpen);
  const editingTaskId = useStore((s) => s.ui.editingTaskId);
  if (!formOpen) return null;
  const task = editingTaskId ? getState().tasks.find((t) => t.id === editingTaskId) : null;
  return (
    <div onClick={() => setUI({ formOpen: false, editingTaskId: null })}
      className="kz-backdrop"
      style={{ zIndex: 10001, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px 16px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 570 }}>
        <TaskForm key={editingTaskId || "new"} initial={task} isEdit={!!task} onClose={() => setUI({ formOpen: false, editingTaskId: null })} />
      </div>
    </div>
  );
}

function TaskForm({ initial, isEdit, onClose }) {
  const s = getState();
  const projects = s.projects.filter((p) => !p.completedAt || p.id === initial?.projectId);
  const customTags = s.customTags;
  const chunks = initial ? getTaskChunks(initial.id, s.plan) : [];
  const isSplit = chunks.length > 1;
  const initialScheduled = initial ? getTaskScheduledDate(initial.id, s.plan) : "";

  const [title, setTitle] = useState(initial?.title || "");
  const [desc, setDesc] = useState(initial?.desc || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [tags, setTags] = useState(initial?.tags || []);
  const [subs, setSubs] = useState(() => (initial?.subtasks || []).map((x) => ({ k: x.id || uid(), title: x.title })));
  const [stIn, setStIn] = useState("");
  const [tagIn, setTagIn] = useState("");
  const [recurring, setRecurring] = useState(initial?.recurring || "none");
  const [priority, setPriority] = useState(initial?.priority || "medium");
  const [difficulty, setDifficulty] = useState(initial?.difficulty || "medium");
  const [scheduleDate, setScheduleDate] = useState(initialScheduled || "");
  const [projectId, setProjectId] = useState(initial?.projectId || "");
  const initialDeadline = initial?.deadlineAt ? isoDate(new Date(initial.deadlineAt)) : "";
  const [deadline, setDeadline] = useState(initialDeadline);
  const [hours, setHours] = useState(initial ? (initial.hours ?? DIFFICULTY[initial.difficulty]?.hours ?? 1.5) : DIFFICULTY.medium.hours);
  const [xp, setXp] = useState(initial ? (initial.xp ?? 20) : deterministicScore("medium").xp);
  const [scoreTouched, setScoreTouched] = useState(false);
  const titleRef = useRef(null);
  useEffect(() => { titleRef.current?.focus(); }, []);

  const applyDifficulty = (d) => {
    setDifficulty(d);
    if (!scoreTouched) {
      const det = deterministicScore(d, null);
      setHours(det.hours); setXp(det.xp);
    }
  };
  const applyHours = (raw) => {
    const h = Math.max(0.25, Math.min(24, parseFloat(raw) || 0));
    if (!h) return;
    setHours(h);
    if (!scoreTouched) setXp(deterministicScore(difficulty, h).xp);
  };

  const commitSubInput = (list) => {
    const v = stIn.trim();
    return v ? [...list, { k: uid(), title: v }] : list;
  };
  const commitTagInput = (list) => {
    const raw = tagIn.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (!raw || list.includes(raw)) return list;
    return [...list, raw];
  };

  const canSubmit = title.trim().length > 0;
  const submit = () => {
    if (!canSubmit) return;
    const finalSubs = commitSubInput(subs);
    const finalTags = commitTagInput(tags);
    for (const t of finalTags) {
      if (!TAGS_BUILTIN.includes(t) && !customTags.includes(t)) addCustomTag(t);
    }
    const payload = {
      title: title.trim(), desc, notes, tags: finalTags,
      subtasks: finalSubs.map((x) => x.title),
      recurring, priority, difficulty,
      xp: Math.round(xp), hours,
      deadlineAt: deadline ? (() => { const [y, m, d] = deadline.split("-").map(Number); return new Date(y, m - 1, d, 12).getTime(); })() : null,
    };
    if (isEdit) {
      const patch = { ...payload };
      if (scheduleDate !== (initialScheduled || "") && !isSplit) {
        patch.scheduleDate = scheduleDate || null;
        patch.scheduleDateChanged = true;
      }
      if ((projectId || "") !== (initial.projectId || "")) {
        patch.projectId = projectId || null;
        patch.projectIdChanged = true;
      }
      updateTask(initial.id, patch);
      notify("Kept");
    } else {
      const created = addTask({
        ...payload,
        projectId: projectId || null,
        scheduleDate: recurring === "none" ? (scheduleDate || null) : null,
      });
      if (created && !scoreTouched) enrichManualTask(created.id);
    }
    onClose();
  };

  const onFormKeys = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); }
  };

  const Label = ({ children }) => <div className="kz-label" style={{ marginBottom: 6 }}>{children}</div>;

  return (
    <div className="kz-sheet kz-fade-in" onKeyDown={onFormKeys}>
      <div className="kz-sheet-head">
        <span className="kz-tape">{isEdit ? "Redraw the waypoint" : "Mark a waypoint"}</span>
        <div style={{ flex: 1 }} />
        <button className="kz-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={13} /></button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 13, padding: 19 }}>
        <input ref={titleRef} className="kz-field" placeholder="What is worth walking to?"
          value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) submit(); }}
          style={{ fontSize: 15, padding: "10px 12px" }} />
        <textarea className="kz-field" placeholder="What it is (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} style={{ height: 52 }} />
        <textarea className="kz-field" placeholder="Notes — what's in the way, what you'll need" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ height: 40 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
          <div>
            <Label>Urgency</Label>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {Object.keys(PRIORITIES).map((k) => (
                <SealPick key={k} active={priority === k} color={PRIORITIES[k].dot} onClick={() => setPriority(k)}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: priority === k ? "var(--ink)" : PRIORITIES[k].dot, display: "inline-block" }} />
                  {PRIORITIES[k].label}
                </SealPick>
              ))}
            </div>
          </div>
          <div>
            <Label>Ritual</Label>
            <div style={{ display: "flex", gap: 5 }}>
              <SealPick active={recurring === "none"} onClick={() => setRecurring("none")} title="Walked once">Once</SealPick>
              <SealPick active={recurring === "daily"} onClick={() => setRecurring("daily")} title="Every day — a daily ritual">Daily</SealPick>
              <SealPick active={recurring === "weekly"} onClick={() => setRecurring("weekly")} title="Every week">Weekly</SealPick>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
          <div>
            <Label>How steep</Label>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {Object.keys(DIFFICULTY).map((k) => (
                <SealPick key={k} active={difficulty === k} color={DIFFICULTY[k].tone} onClick={() => applyDifficulty(k)}>{k}</SealPick>
              ))}
            </div>
          </div>
          <div>
            <Label>How far</Label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", opacity: isSplit ? 0.5 : 1, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--fg-dim)" }}>
                <span className="kz-label">h</span>
                <input type="number" min="0.25" max="24" step="0.25" value={hours} disabled={isSplit}
                  onChange={(e) => { applyHours(e.target.value); }}
                  className="kz-field kz-field--mono" style={{ width: 66, textAlign: "center" }} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--fg-dim)" }}>
                <span className="kz-label">resolve</span>
                <input type="number" min="5" max="200" step="5" value={xp} disabled={isSplit}
                  onChange={(e) => { setXp(Math.max(5, Math.min(200, parseInt(e.target.value, 10) || 0))); setScoreTouched(true); }}
                  className="kz-field kz-field--mono" style={{ width: 66, textAlign: "center" }} />
              </label>
              {isSplit && <span className="kz-label">per stretch — edit in the split list</span>}
            </div>
          </div>
        </div>

        {recurring === "none" && !isSplit && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
            <div>
              <Label>Set out {scheduleDate ? "" : "(the oracle decides)"}</Label>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
                  className="kz-field kz-field--mono" style={{ padding: "5px 7px", width: 136 }} />
                <button type="button" className="kz-btn kz-btn--sm" onClick={() => setScheduleDate(isoDate(new Date()))}>Today</button>
                <button type="button" className="kz-btn kz-btn--sm" onClick={() => setScheduleDate(isoDate(addDays(new Date(), 1)))}>Tomorrow</button>
                {scheduleDate && <button type="button" className="kz-btn kz-btn--sm" onClick={() => setScheduleDate("")} style={{ color: "var(--fg-faint)" }}>Clear</button>}
              </div>
            </div>
            <div>
              <Label>Must arrive by {deadline ? "(hard date)" : "(optional)"}</Label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                  className="kz-field kz-field--mono" style={{ padding: "5px 7px", width: 136 }} />
                {deadline && <button type="button" className="kz-btn kz-btn--sm" onClick={() => setDeadline("")} style={{ color: "var(--fg-faint)" }}>Clear</button>}
              </div>
            </div>
          </div>
        )}

        {projects.length > 0 && (
          <div>
            <Label>Part of a journey</Label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className="kz-field" style={{ fontSize: 13, maxWidth: 290 }}>
              <option value="">On its own</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}{p.completedAt ? " (arrived)" : ""}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <Label>Marks</Label>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            {allKnownTags(customTags).map((t) => (
              <SealPick key={t} active={tags.includes(t)} onClick={() => setTags((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t])}>{t}</SealPick>
            ))}
            {tags.filter((t) => !allKnownTags(customTags).includes(t)).map((t) => (
              <SealPick key={t} active onClick={() => setTags((p) => p.filter((x) => x !== t))}>{t}</SealPick>
            ))}
            <input className="kz-field kz-field--mono" placeholder="+ new mark" style={{ width: 110, fontSize: 11, padding: "4px 8px" }}
              value={tagIn} onChange={(e) => setTagIn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setTags(commitTagInput(tags));
                  setTagIn("");
                }
              }} />
          </div>
        </div>

        <div>
          <Label>Steps along the way</Label>
          <input className="kz-field" placeholder="Type a step + Enter" style={{ fontSize: 12 }}
            value={stIn} onChange={(e) => setStIn(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setSubs(commitSubInput(subs)); setStIn(""); } }} />
          {subs.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {subs.map((x) => (
                <div key={x.k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 4px" }}>
                  <span style={{ width: 11, height: 11, border: "1.5px solid var(--line)", borderRadius: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "var(--fg-dim)", flex: 1 }}>{x.title}</span>
                  <button className="kz-icon-btn" onClick={() => setSubs((p) => p.filter((y) => y.k !== x.k))} aria-label="Remove step"><Icon name="close" size={11} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
          <button className="kz-go" onClick={submit} disabled={!canSubmit} style={{ flex: 1, minWidth: 140 }}>
            {isEdit ? "Keep the changes" : "Mark it"}
          </button>
          {isEdit && !initial?.projectId && (
            <button
              className="kz-btn"
              disabled={subs.length === 0 && !stIn.trim()}
              title={subs.length === 0 && !stIn.trim()
                ? "Add at least one step first — the steps become the journey's waypoints"
                : "Turn this into a journey of its own; each step becomes a scored waypoint"}
              onClick={() => {
                const finalSubs = commitSubInput(subs);
                if (!finalSubs.length) return;
                updateTask(initial.id, { subtasks: finalSubs.map((x) => x.title) });
                const res = promoteToProject(initial.id);
                if (res) {
                  for (const cid of res.childIds) scoreTask(cid);
                  setUI({ formOpen: false, editingTaskId: null, view: "dock", dockFilter: { ...getState().ui.dockFilter, tab: "projects" } });
                }
              }}
            >
              <Icon name="satchel" size={12} /> Make it a journey
            </button>
          )}
          <button className="kz-btn" onClick={onClose}>Never mind</button>
        </div>
        <div className="kz-label" style={{ marginTop: -4 }}>
          <Kbd>{MOD}</Kbd> <Kbd>↵</Kbd> keep · <Kbd>Esc</Kbd> leave. Unfinished step and mark text comes along.
        </div>
      </div>
    </div>
  );
}
