// taskform.jsx — the full task form in the Nightwatch console chassis.
// All behavior identical to the core contract: uncommitted subtask/tag
// text is committed on submit, deterministic score follows difficulty
// until touched, promote-to-project ships the same flow.

import React, { useEffect, useRef, useState } from "react";
import { Icon, Kbd, MOD, StampPick, ResolveBtn } from "./components.jsx";
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
      className="r-backdrop" style={{ zIndex: 90 }}>
      <div onClick={(e) => e.stopPropagation()} className="r-sheet-left">
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
      notify("Saved");
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

  const Label = ({ children }) => <div className="r-lab" style={{ marginBottom: 6 }}>{children}</div>;

  return (
    <div className="fade-in" onKeyDown={onFormKeys}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span className="r-lab r-lab--lit">{isEdit ? "Edit packet" : "New packet"}</span>
        <div style={{ flex: 1 }} />
        <button className="r-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={13} /></button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input ref={titleRef} className="r-field" placeholder="What needs doing?"
          value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) submit(); }}
          style={{ fontSize: 15, padding: "10px 12px" }} />
        <textarea className="r-field" placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} style={{ height: 52 }} />
        <textarea className="r-field" placeholder="Notes — context, blockers, references" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ height: 40 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <Label>Priority</Label>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {Object.keys(PRIORITIES).map((k) => (
                <StampPick key={k} active={priority === k} color={PRIORITIES[k].dot} onClick={() => setPriority(k)}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: priority === k ? "var(--ink)" : PRIORITIES[k].dot, display: "inline-block" }} />
                  {PRIORITIES[k].label}
                </StampPick>
              ))}
            </div>
          </div>
          <div>
            <Label>Repeats</Label>
            <div style={{ display: "flex", gap: 5 }}>
              <StampPick active={recurring === "none"} onClick={() => setRecurring("none")}>Once</StampPick>
              <StampPick active={recurring === "daily"} onClick={() => setRecurring("daily")}>Daily</StampPick>
              <StampPick active={recurring === "weekly"} onClick={() => setRecurring("weekly")}>Weekly</StampPick>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <Label>Difficulty</Label>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {Object.keys(DIFFICULTY).map((k) => (
                <StampPick key={k} active={difficulty === k} color={DIFFICULTY[k].tone} onClick={() => applyDifficulty(k)}>{k}</StampPick>
              ))}
            </div>
          </div>
          <div>
            <Label>Estimate</Label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", opacity: isSplit ? 0.5 : 1 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--fg-dim)" }}>
                <span className="r-num" style={{ fontSize: 11 }}>h</span>
                <input type="number" min="0.25" max="24" step="0.25" value={hours} disabled={isSplit}
                  onChange={(e) => { applyHours(e.target.value); }}
                  className="r-field field--mono" style={{ width: 68, textAlign: "center" }} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--fg-dim)" }}>
                <span className="r-num" style={{ fontSize: 11 }}>XP</span>
                <input type="number" min="5" max="200" step="5" value={xp} disabled={isSplit}
                  onChange={(e) => { setXp(Math.max(5, Math.min(200, parseInt(e.target.value, 10) || 0))); setScoreTouched(true); }}
                  className="r-field field--mono" style={{ width: 68, textAlign: "center" }} />
              </label>
              {isSplit && <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>per-chunk — edit in the chunk list</span>}
            </div>
          </div>
        </div>

        {recurring === "none" && !isSplit && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <Label>Moored {scheduleDate ? "" : "(planner decides)"}</Label>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
                  className="r-field field--mono" style={{ padding: "5px 7px", width: 140 }} />
                <button type="button" className="r-btn r-btn--sm bezel--sm" onClick={() => setScheduleDate(isoDate(new Date()))}>Today</button>
                <button type="button" className="r-btn r-btn--sm bezel--sm" onClick={() => setScheduleDate(isoDate(addDays(new Date(), 1)))}>Tomorrow</button>
                {scheduleDate && <button type="button" className="r-btn r-btn--sm bezel--sm" onClick={() => setScheduleDate("")} style={{ color: "var(--fg-faint)" }}>Clear</button>}
              </div>
            </div>
            <div>
              <Label>Deadline {deadline ? "(hard date)" : "(optional)"}</Label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                  className="r-field field--mono" style={{ padding: "5px 7px", width: 140 }} />
                {deadline && <button type="button" className="r-btn r-btn--sm bezel--sm" onClick={() => setDeadline("")} style={{ color: "var(--fg-faint)" }}>Clear</button>}
              </div>
            </div>
          </div>
        )}

        {projects.length > 0 && (
          <div>
            <Label>System (project)</Label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className="r-field" style={{ fontSize: 13, maxWidth: 280 }}>
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}{p.completedAt ? " (launched)" : ""}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <Label>Tags</Label>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            {allKnownTags(customTags).map((t) => (
              <StampPick key={t} active={tags.includes(t)} onClick={() => setTags((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t])}>{t}</StampPick>
            ))}
            {tags.filter((t) => !allKnownTags(customTags).includes(t)).map((t) => (
              <StampPick key={t} active onClick={() => setTags((p) => p.filter((x) => x !== t))}>{t}</StampPick>
            ))}
            <input className="r-field field--mono" placeholder="+ new tag" style={{ width: 110, fontSize: 11, padding: "4px 8px" }}
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
          <Label>Steps</Label>
          <input className="r-field" placeholder="Type a step + Enter" style={{ fontSize: 12 }}
            value={stIn} onChange={(e) => setStIn(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setSubs(commitSubInput(subs)); setStIn(""); } }} />
          {subs.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {subs.map((x) => (
                <div key={x.k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 4px" }}>
                  <span style={{ width: 12, height: 12, border: "1.5px solid var(--line)", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "var(--fg-dim)", flex: 1 }}>{x.title}</span>
                  <button className="r-icon-btn" onClick={() => setSubs((p) => p.filter((y) => y.k !== x.k))} aria-label="Remove step"><Icon name="close" size={11} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
          <button className="r-btn" onClick={submit} disabled={!canSubmit} style={{ flex: 1 }}>
            {isEdit ? "Save changes" : "Route packet"}
          </button>
          {isEdit && !initial?.projectId && (
            <button
              className="r-btn r-btn--sm"
              disabled={subs.length === 0 && !stIn.trim()}
              title={subs.length === 0 && !stIn.trim()
                ? "Add at least one step first — they become the project's tasks"
                : "Turn this task into a project; each step becomes its own scored task"}
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
              <Icon name="ship" size={12} /> Promote to system
            </button>
          )}
          <button className="r-btn r-btn--sm" onClick={onClose}>Cancel</button>
        </div>
        <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: -4 }}>
          <Kbd>{MOD}</Kbd> <Kbd>↵</Kbd> submit · <Kbd>Esc</Kbd> cancel. Unfinished step/tag text is included automatically.
        </div>
      </div>
    </div>
  );
}
