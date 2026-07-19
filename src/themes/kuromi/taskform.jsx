// taskform.jsx — the scheme form in the Kuromi console chassis.
// Logic lifted from the shipped themes (core contract): uncommitted
// subtask/tag text commits on submit, deterministic score follows
// difficulty/hours until XP is touched, split tasks lock estimates,
// promote-to-project commits pending steps first then scores children.

import React, { useEffect, useRef, useState } from "react";
import { Icon, Kbd, MOD } from "./components.jsx";
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
    <div
      className="k-backdrop"
      style={{ zIndex: 70 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setUI({ formOpen: false, editingTaskId: null });
      }}
    >
      <TaskForm
        key={editingTaskId || "new"}
        initial={task}
        isEdit={!!task}
        onClose={() => setUI({ formOpen: false, editingTaskId: null })}
      />
    </div>
  );
}

function Label({ children }) {
  return <label className="k-field-label">{children}</label>;
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
      setHours(det.hours);
      setXp(det.xp);
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
      notify("Scheme rewritten");
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

  const pickBtn = (key, active, onClick, children, dot) => (
    <button key={key} type="button" className={"k-chip" + (active ? " is-on" : "")} onClick={onClick}>
      {dot && (
        <span
          style={{
            width: 7, height: 7, borderRadius: 2, display: "inline-block",
            background: active ? "var(--amber-hot)" : dot,
          }}
        />
      )}
      {children}
    </button>
  );

  return (
    <div className="k-console" onKeyDown={onFormKeys}>
      <div className="k-console-head">
        <span className="k-display">{isEdit ? "REWRITE THE SCHEME" : "NEW SCHEME"}</span>
        <button className="k-x" onClick={onClose} aria-label="Close (Esc)">
          <Icon name="x" size={10} />
        </button>
      </div>
      <div className="k-console-body">
        <input
          ref={titleRef}
          className="k-input"
          style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}
          placeholder="What are we pulling off?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) submit(); }}
        />
        <textarea
          className="k-textarea"
          style={{ minHeight: 48, marginBottom: 8 }}
          placeholder="The master plan, in full (optional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <textarea
          className="k-textarea"
          style={{ minHeight: 38, marginBottom: 13 }}
          placeholder="Diary margin — blockers, context, evil giggles"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="k-input-row">
          <div className="k-field">
            <Label>Heat</Label>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {Object.keys(PRIORITIES).map((k) =>
                pickBtn(k, priority === k, () => setPriority(k), PRIORITIES[k].label, PRIORITIES[k].dot)
              )}
            </div>
          </div>
          <div className="k-field">
            <Label>Repeats</Label>
            <div style={{ display: "flex", gap: 5 }}>
              {pickBtn("none", recurring === "none", () => setRecurring("none"), "once")}
              {pickBtn("daily", recurring === "daily", () => setRecurring("daily"), "daily")}
              {pickBtn("weekly", recurring === "weekly", () => setRecurring("weekly"), "weekly")}
            </div>
          </div>
        </div>

        <div className="k-input-row">
          <div className="k-field">
            <Label>Mischief level</Label>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {Object.keys(DIFFICULTY).map((k) =>
                pickBtn(k, difficulty === k, () => applyDifficulty(k), k, DIFFICULTY[k].tone)
              )}
            </div>
          </div>
          <div className="k-field">
            <Label>Payoff {isSplit && "(per part — edit the split scheme)"}</Label>
            <div className="k-rowline" style={{ opacity: isSplit ? 0.5 : 1 }}>
              <label className="k-rowline" style={{ gap: 5 }}>
                <span className="k-mono-sm k-faint">h</span>
                <input
                  type="number" min="0.25" max="24" step="0.25" value={hours} disabled={isSplit}
                  onChange={(e) => applyHours(e.target.value)}
                  className="k-input k-mono" style={{ width: 74, textAlign: "center", padding: "5px 6px" }}
                />
              </label>
              <label className="k-rowline" style={{ gap: 5 }}>
                <span className="k-mono-sm k-faint">XP</span>
                <input
                  type="number" min="5" max="200" step="5" value={xp} disabled={isSplit}
                  onChange={(e) => { setXp(Math.max(5, Math.min(200, parseInt(e.target.value, 10) || 0))); setScoreTouched(true); }}
                  className="k-input k-mono" style={{ width: 74, textAlign: "center", padding: "5px 6px" }}
                />
              </label>
            </div>
          </div>
        </div>

        {recurring === "none" && !isSplit && (
          <div className="k-input-row">
            <div className="k-field">
              <Label>Scheme date {scheduleDate ? "" : "(the planner decides)"}</Label>
              <div className="k-rowline" style={{ flexWrap: "wrap" }}>
                <input
                  type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
                  className="k-input k-mono" style={{ width: 148, padding: "5px 8px" }}
                />
                <button type="button" className="k-btn is-sm" onClick={() => setScheduleDate(isoDate(new Date()))}>today</button>
                <button type="button" className="k-btn is-sm" onClick={() => setScheduleDate(isoDate(addDays(new Date(), 1)))}>tomorrow</button>
                {scheduleDate && <button type="button" className="k-btn is-sm is-ghost" onClick={() => setScheduleDate("")}>clear</button>}
              </div>
            </div>
            <div className="k-field">
              <Label>Point of no return {deadline ? "(hard date)" : "(optional)"}</Label>
              <div className="k-rowline">
                <input
                  type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                  className="k-input k-mono" style={{ width: 148, padding: "5px 8px" }}
                />
                {deadline && <button type="button" className="k-btn is-sm is-ghost" onClick={() => setDeadline("")}>clear</button>}
              </div>
            </div>
          </div>
        )}

        {projects.length > 0 && (
          <div className="k-field">
            <Label>Boss fight</Label>
            <select
              value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className="k-select" style={{ maxWidth: 300 }}
            >
              <option value="">— freelance mischief —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}{p.completedAt ? " (beaten)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="k-field">
          <Label>Marks</Label>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            {allKnownTags(customTags).map((t) => (
              <button
                key={t} type="button"
                className={"k-chip is-violet" + (tags.includes(t) ? " is-on" : "")}
                onClick={() => setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}
              >
                #{t}
              </button>
            ))}
            {tags.filter((t) => !allKnownTags(customTags).includes(t)).map((t) => (
              <button
                key={t} type="button" className="k-chip is-violet is-on"
                onClick={() => setTags((p) => p.filter((x) => x !== t))}
              >
                #{t}
              </button>
            ))}
            <input
              className="k-input k-mono" placeholder="+ new mark" style={{ width: 118, padding: "4px 8px", fontSize: 13 }}
              value={tagIn} onChange={(e) => setTagIn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setTags(commitTagInput(tags));
                  setTagIn("");
                }
              }}
            />
          </div>
        </div>

        <div className="k-field">
          <Label>Steps of the scheme</Label>
          <input
            className="k-input" placeholder="Type a step + Enter" style={{ fontSize: 13 }}
            value={stIn} onChange={(e) => setStIn(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setSubs(commitSubInput(subs)); setStIn(""); } }}
          />
          {subs.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {subs.map((x) => (
                <div key={x.k} className="k-rowline" style={{ padding: "3px 4px" }}>
                  <span className="k-sub-dot" />
                  <span className="k-dim" style={{ fontSize: 13, flex: 1 }}>{x.title}</span>
                  <button className="k-mini-btn" onClick={() => setSubs((p) => p.filter((y) => y.k !== x.k))} aria-label="Remove step">
                    <Icon name="x" size={9} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="k-console-foot">
        <span className="k-mono-sm k-faint">
          <Kbd>{MOD}+↵</Kbd> commit · <Kbd>Esc</Kbd> bail
        </span>
        <span className="k-spacer" />
        {isEdit && !initial?.projectId && (
          <button
            className="k-btn is-danger"
            disabled={subs.length === 0 && !stIn.trim()}
            title={subs.length === 0 && !stIn.trim()
              ? "Add at least one step first — they become the boss's HP"
              : "Turn this scheme into a boss fight; each step becomes its own scored scheme"}
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
            MAKE IT A BOSS
          </button>
        )}
        <button className="k-btn" onClick={onClose}>NEVER MIND</button>
        <button className="k-btn is-primary" onClick={submit} disabled={!canSubmit}>
          {isEdit ? "REWRITE IT" : "STOW THE SCHEME"}
        </button>
      </div>
    </div>
  );
}
