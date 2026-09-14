// capture.jsx — the command slab. Full-width well under the view
// header; Enter saves locally in the same tick, AI enriches after.
// Logic identical to the previous version — presentation only.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Kbd, AiDot } from "./components.jsx";
import { parseQuickAdd } from "../../core/domain.js";
import { useStore, captureTask, setUI, notify } from "../../core/store.js";
import { enrichCapturedTask, captureProject } from "../../core/enrich.js";
import { setCaptureFocus } from "../../core/keys.js";

const CHIP_TONE = {
  priority: "var(--port)", tag: "var(--fg-dim)", project: "var(--channel)",
  hours: "var(--amber-hot)", date: "var(--starboard)", deadline: "var(--warn)",
  recurring: "var(--channel)",
};

const MODES = [
  { id: "task", label: "Task", sub: "single action item", placeholder: "What deserves your attention?  Try: Write proposal 2h today" },
  { id: "subtasks", label: "Steps", sub: "task with concrete steps", placeholder: "Describe a multi-step task — AI adds the steps" },
  { id: "project", label: "Project", sub: "multi-task initiative", placeholder: "Describe a project — AI drafts its tasks" },
];

export function CaptureBar({ scheduleToday = false, autoRegister = true }) {
  const aiStatus = useStore((s) => s.ui.aiStatus);
  const aiDetail = useStore((s) => s.ui.aiDetail);
  const mode = useStore((s) => s.ui.captureMode);
  const projects = useStore((s) => s.projects);
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef(null);
  const wrapRef = useRef(null);

  const parsed = useMemo(
    () => (mode === "task" && text.trim() ? parseQuickAdd(text, { projects }) : null),
    [text, mode, projects]
  );
  const grammarActive = !!(parsed && parsed.chips.length);

  useEffect(() => {
    if (!autoRegister) return;
    setCaptureFocus(() => inputRef.current?.focus());
    return () => setCaptureFocus(null);
  }, [autoRegister]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false); };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const current = MODES.find((m) => m.id === mode) || MODES[0];

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    setText("");
    if (mode === "project") {
      captureProject(v);
      return;
    }
    const task = captureTask(v, { mode, scheduleToday, parsed });
    if (!task) return;
    enrichCapturedTask(task.id, grammarActive ? parsed.title : v, mode, {
      grammarUsed: grammarActive,
      hasHours: !!parsed?.hours,
    });
  };

  return <div className="f-capture" ref={wrapRef}>
    <div className="f-capture-top"><span className="f-kicker">A thought worth keeping</span><button className="w-link" onClick={()=>setUI({formOpen:true,editingTaskId:null})} aria-label="Open full task form">Open manuscript ↗</button></div>
    <div className="f-writing-line">
      <button className="f-capture-mode" type="button" onClick={()=>setMenuOpen(o=>!o)} aria-haspopup="listbox" aria-expanded={menuOpen} title="Capture mode">{current.label}<Icon name="chevron" size={12}/></button>
      <input ref={inputRef} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing)submit();else if(e.key==='Escape'){setText('');inputRef.current?.blur();}}} placeholder={mode==='task'?'What will you make of today?':current.placeholder} aria-label="Capture a task"/>
      <button className="f-capture-submit" title="Capture task" aria-label="Save capture" onClick={submit} disabled={!text.trim()}><span>↗</span></button>
    </div>
    <div className="f-capture-annotation">{grammarActive?<><span>{parsed.title||'(untitled)'}</span>{parsed.chips.map((c,i)=><span key={i} style={{color:CHIP_TONE[c.type]}}>↳ {c.label}</span>)}</>:<><span>Write naturally. <i>Design a cover 2h tomorrow #studio</i></span><span><AiDot status={aiStatus} detail={aiDetail}/> <Kbd>N</Kbd> to write · ↵ to keep</span></>}</div>
    {menuOpen&&<div role="listbox" className="f-capture-menu">{MODES.map(m=><button key={m.id} type="button" role="option" aria-selected={mode===m.id} onClick={()=>{setUI({captureMode:m.id});setMenuOpen(false);inputRef.current?.focus();}}><strong>{m.label}</strong><span>{m.sub}</span><span>{mode===m.id?'✓':'↗'}</span></button>)}</div>}
  </div>;
}
