// taskform.jsx — the inscription desk. A right drawer where vessels are
// registered or amended. Logic lifted verbatim from Nightwatch: score
// follows difficulty/hours until XP is touched (then AI refinement is
// skipped on create), uncommitted step/tag text is committed on submit,
// scheduleDate/projectId changes are flagged on edit, split tasks lock
// the estimate fields, promote-to-project commits pending steps first,
// scores the children and jumps to the Haven. Cmd/Ctrl+Enter submits
// from any field, Enter on the title submits, Esc cancels (core keys).

import React, { useEffect, useRef, useState } from "react";
import { Icon, Kbd, MOD, ChipPick } from "./components.jsx";
import {
  DIFFICULTY, PRIORITIES, allKnownTags, TAGS_BUILTIN, isoDate, addDays,
  deterministicScore, getTaskChunks, getTaskScheduledDate, uid,
} from "../../core/domain.js";
import { useStore, getState, addTask, updateTask, setUI, notify, addCustomTag, promoteToProject } from "../../core/store.js";
import { enrichManualTask, scoreTask } from "../../core/enrich.js";

export function TaskFormDrawer() {
  const formOpen = useStore((s) => s.ui.formOpen);
  const editingTaskId = useStore((s) => s.ui.editingTaskId);
  if (!formOpen) return null;
  const task = editingTaskId ? getState().tasks.find((t) => t.id === editingTaskId) : null;
  const close = () => setUI({ formOpen: false, editingTaskId: null });
  return (
    <>
      <div className="s-backdrop" onClick={close} />
      <div className="s-drawer" role="dialog" aria-modal="true" aria-label={task ? "Inscriptie" : "Nieuw vaartuig"}>
        <TaskForm key={editingTaskId || "new"} initial={task} isEdit={!!task} onClose={close} />
      </div>
    </>
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

  const Label = ({ children }) => <div className="s-stencil" style={{ marginBottom: 6 }}>{children}</div>;

  return (
    <div onKeyDown={onFormKeys} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "16px 24px 14px", borderBottom: "1px solid var(--line)", flexShrink: 0,
      }}>
        <Icon name="gate" size={16} />
        <div style={{ minWidth: 0 }}>
          <div className="s-stencil">De inscriptiedesk</div>
          <div className="s-display" style={{ fontSize: 20, marginTop: 2 }}>
            {isEdit ? "Inscriptie" : "Nieuw vaartuig"}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="s-icon-btn" onClick={onClose} aria-label="Sluiten"><Icon name="close" size={13} /></button>
      </div>

      <div className="s-drawer-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input ref={titleRef} className="s-field" placeholder="Wat moet er gebeuren?"
          value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) submit(); }}
          style={{ fontSize: 15, padding: "10px 12px" }} />
        <textarea className="s-field" placeholder="Beschrijving (optioneel)" value={desc} onChange={(e) => setDesc(e.target.value)} style={{ minHeight: 52 }} />
        <textarea className="s-field" placeholder="Notities — context, blokkades, verwijzingen" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 40 }} />

        <div>
          <Label>Prioriteit</Label>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {Object.keys(PRIORITIES).map((k) => (
              <ChipPick key={k} active={priority === k} color={PRIORITIES[k].dot} onClick={() => setPriority(k)}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: priority === k ? "#fff" : PRIORITIES[k].dot, display: "inline-block" }} />
                {PRIORITIES[k].label}
              </ChipPick>
            ))}
          </div>
        </div>

        <div>
          <Label>Herhaling</Label>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <ChipPick active={recurring === "none"} onClick={() => setRecurring("none")}>Once</ChipPick>
            <ChipPick active={recurring === "daily"} onClick={() => setRecurring("daily")}>Daily</ChipPick>
            <ChipPick active={recurring === "weekly"} onClick={() => setRecurring("weekly")}>Weekly</ChipPick>
          </div>
        </div>

        <div>
          <Label>Moeilijkheid</Label>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {Object.keys(DIFFICULTY).map((k) => (
              <ChipPick key={k} active={difficulty === k} color={DIFFICULTY[k].tone} onClick={() => applyDifficulty(k)}>{k}</ChipPick>
            ))}
          </div>
        </div>

        <div>
          <Label>Raming</Label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", opacity: isSplit ? 0.5 : 1 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--fg-dim)" }}>
              <span className="s-num" style={{ fontSize: 11 }}>h</span>
              <input type="number" min="0.25" max="24" step="0.25" value={hours} disabled={isSplit}
                onChange={(e) => { applyHours(e.target.value); }}
                className="s-field s-num" style={{ width: 68, textAlign: "center" }} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--fg-dim)" }}>
              <span className="s-num" style={{ fontSize: 11 }}>XP</span>
              <input type="number" min="5" max="200" step="5" value={xp} disabled={isSplit}
                onChange={(e) => { setXp(Math.max(5, Math.min(200, parseInt(e.target.value, 10) || 0))); setScoreTouched(true); }}
                className="s-field s-num" style={{ width: 68, textAlign: "center" }} />
            </label>
            {isSplit && <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>per chunk — wijzig in de chunklijst</span>}
          </div>
        </div>

        {recurring === "none" && !isSplit && (
          <div>
            <Label>Vaardag {scheduleDate ? "" : "(planner beslist)"}</Label>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
                className="s-field s-num" style={{ padding: "5px 7px", width: 140 }} />
              <button type="button" className="s-btn s-btn--ghost s-btn--sm" onClick={() => setScheduleDate(isoDate(new Date()))}>Vandaag</button>
              <button type="button" className="s-btn s-btn--ghost s-btn--sm" onClick={() => setScheduleDate(isoDate(addDays(new Date(), 1)))}>Morgen</button>
              {scheduleDate && <button type="button" className="s-btn s-btn--ghost s-btn--sm" onClick={() => setScheduleDate("")} style={{ color: "var(--fg-faint)" }}>Wis</button>}
            </div>
          </div>
        )}

        <div>
          <Label>Deadline {deadline ? "(harde datum)" : "(optioneel)"}</Label>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
              className="s-field s-num" style={{ padding: "5px 7px", width: 140 }} />
            {deadline && <button type="button" className="s-btn s-btn--ghost s-btn--sm" onClick={() => setDeadline("")} style={{ color: "var(--fg-faint)" }}>Wis</button>}
          </div>
        </div>

        {projects.length > 0 && (
          <div>
            <Label>Aanleggen bij schip (project)</Label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className="s-field" style={{ fontSize: 13, maxWidth: 280 }}>
              <option value="">Geen schip</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}{p.completedAt ? " (te water gelaten)" : ""}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <Label>Tags</Label>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            {allKnownTags(customTags).map((t) => (
              <ChipPick key={t} active={tags.includes(t)} onClick={() => setTags((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t])}>{t}</ChipPick>
            ))}
            {tags.filter((t) => !allKnownTags(customTags).includes(t)).map((t) => (
              <ChipPick key={t} active onClick={() => setTags((p) => p.filter((x) => x !== t))}>{t}</ChipPick>
            ))}
            <input className="s-field s-num" placeholder="+ nieuwe tag" style={{ width: 110, fontSize: 11, padding: "4px 8px" }}
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
          <Label>Lading (stappen)</Label>
          <input className="s-field" placeholder="Typ een stap + Enter" style={{ fontSize: 12 }}
            value={stIn} onChange={(e) => setStIn(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setSubs(commitSubInput(subs)); setStIn(""); } }} />
          {subs.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {subs.map((x) => (
                <div key={x.k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 4px" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, border: "1.5px solid var(--line-strong)", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "var(--fg-dim)", flex: 1 }}>{x.title}</span>
                  <button className="s-icon-btn" onClick={() => setSubs((p) => p.filter((y) => y.k !== x.k))} aria-label="Stap verwijderen"><Icon name="close" size={11} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {isEdit && !initial?.projectId && (
          <div style={{
            padding: "12px 14px", borderRadius: "var(--r-md)",
            background: "var(--amber-ground)", border: "1px solid var(--amber)",
          }}>
            <div className="s-stencil" style={{ color: "var(--amber-deep)" }}>Bouw om tot schip</div>
            <div style={{ fontSize: 12, color: "var(--fg-dim)", margin: "6px 0 10px", lineHeight: 1.5 }}>
              Dit vaartuig wordt een schip in de haven; elke stap wordt een eigen beoordeeld vaartuig.
            </div>
            <button
              className="s-btn s-btn--amber s-btn--sm"
              disabled={subs.length === 0 && !stIn.trim()}
              title={subs.length === 0 && !stIn.trim()
                ? "Voeg eerst minstens één stap toe — zij worden de taken van het project"
                : "Bouw deze taak om tot een project; elke stap wordt een eigen beoordeelde taak"}
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
              <Icon name="ship" size={12} /> Bouw om tot schip
            </button>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--line)", padding: "12px 24px 14px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="s-btn" onClick={submit} disabled={!canSubmit} style={{ flex: 1 }}>
            {isEdit ? "Bijschrijven" : "Vaarwater maken"}
          </button>
          <button className="s-btn s-btn--ghost" onClick={onClose}>Annuleer</button>
        </div>
        <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 8 }}>
          <Kbd>{MOD}</Kbd> <Kbd>↵</Kbd> bijschrijven · <Kbd>Esc</Kbd> annuleren. Lopende stap-/tag-tekst wordt automatisch meegenomen.
        </div>
      </div>
    </div>
  );
}
