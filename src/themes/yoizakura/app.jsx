// app.jsx — the three-pane house: index · sheet · paper pane.
// Every §7 ui flag has a surface. Index is the user's lists and tags,
// not a view mast. Composition is original; overlay logic is lifted.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon, Kbd, Lamp, Confetti, Meter, Hanko, MOD } from "./components.jsx";
import { PaneProvider, PaperPane, usePane } from "./pane.jsx";
import { useStore, setUI, runUndo, sel, exitPreview, todayLineup, createProject, getState } from "../../core/store.js";
import { SHORTCUT_ROWS } from "../../core/keys.js";
import * as D from "../../core/domain.js";
import { TodayView } from "./views/today.jsx";
import { PlanView } from "./views/plan.jsx";
import { DockView, ChronicleDialog } from "./views/dock.jsx";
import { ReviewOverlay } from "./views/review.jsx";
import { FocusTunnel } from "./views/focus.jsx";
import { Palette } from "./views/palette.jsx";
import { EndOfDayDialog } from "./views/endofday.jsx";
import { YZ_DOCK } from "./nav.js";

export { YZ_DOCK };

const INDEX_W_DEFAULT = 264;
const INDEX_W_MIN = 196;
const INDEX_W_MAX = 420;
const PANE_W_DEFAULT = 380;
const PANE_W_MIN = 300;
const PANE_W_MAX = 1200;
const SHEET_W_MIN = 340;
const BP_PANE = 1080;
const BP_INDEX = 900;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function ColResize({ label, value, min, max, invert = false, disabled = false, onChange, measure }) {
  const [drag, setDrag] = useState(false);
  const origin = useRef(null);

  useEffect(() => {
    if (!drag) return undefined;
    document.body.classList.add("yz-col-resizing");
    return () => document.body.classList.remove("yz-col-resizing");
  }, [drag]);

  const onPointerDown = (e) => {
    if (disabled) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    const startW = typeof measure === "function" ? measure() : value;
    origin.current = { x: e.clientX, w: startW };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(true);
  };
  const onPointerMove = (e) => {
    if (!origin.current) return;
    const next = origin.current.w + (invert ? -(e.clientX - origin.current.x) : (e.clientX - origin.current.x));
    onChange(Math.round(clamp(next, min, max)));
  };
  const onPointerUp = (e) => {
    if (!origin.current) return;
    origin.current = null;
    setDrag(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };
  const onKeyDown = (e) => {
    if (disabled) return;
    const step = e.shiftKey ? 36 : 12;
    const current = typeof measure === "function" ? measure() : value;
    let next = current;
    if (e.key === "ArrowLeft") next = current + (invert ? step : -step);
    else if (e.key === "ArrowRight") next = current + (invert ? -step : step);
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;
    else return;
    e.preventDefault();
    onChange(Math.round(clamp(next, min, max)));
  };

  return (
    <div
      className={"yz-col-resizer yz-col-resizer--" + (invert ? "pane" : "index") + (drag ? " is-drag" : "") + (disabled ? " is-off" : "")}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    />
  );
}

function patchDock(patch) {
  const filter = getState().ui.dockFilter;
  setUI({ view: "dock", statsOpen: false, cursor: null, dockFilter: { ...filter, ...patch } });
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error("[Yoizakura]", err, info?.componentStack); }
  render() {
    if (this.state.err) {
      return (
        <div className="yz-crash">
          <div className="yz-crash-card">
            <div className="yz-sec" style={{ color: "var(--port)", marginBottom: 8 }}>A paper screen tore.</div>
            <pre>{String((this.state.err && this.state.err.stack) || this.state.err)}</pre>
            <button type="button" className="yz-btn" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Index({ view }) {
  const tasks = useStore((s) => s.tasks);
  const plan = useStore((s) => s.plan);
  const projects = useStore((s) => s.projects);
  const meta = useStore((s) => s.meta);
  const energy = useStore((s) => s.ui.energy);
  const filter = useStore((s) => s.ui.dockFilter);
  const level = useStore(sel.level);
  const totalXP = useStore(sel.totalXP);
  const streak = useStore(sel.streak);
  const aiStatus = useStore((s) => s.ui.aiStatus);
  const aiDetail = useStore((s) => s.ui.aiDetail);
  const hour = meta.dayStartHour || 0;
  const todayIso = D.effectiveTodayIso(hour);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("other");
  const [indexOpen, setIndexOpen] = useState(false);

  const counts = useMemo(() => {
    const lineup = todayLineup(getState());
    const missed = D.getMissedWork(tasks, plan, hour);
    const today = lineup.filter((r) => !r.doneHere).length + missed.length;
    const monday = D.isoDate(D.mondayOf(D.effectiveToday(hour)));
    const sunday = D.isoDate(D.addDays(D.parseIsoDate(monday), 6));
    let week = 0;
    for (const e of plan || []) {
      if (e.date >= monday && e.date <= sunday) week += (e.items || []).filter((i) => !i.done).length;
    }
    const pending = tasks.filter((t) => !t.completed && t.recurring === "none");
    const inbox = pending.filter((t) => !t.projectId).length;
    const all = pending.length;
    const lists = projects.filter((p) => !p.completedAt);
    const sealed = projects.filter((p) => p.completedAt);
    const tasksById = new Map(tasks.map((t) => [t.id, t]));
    const listRows = lists.map((p) => {
      const kids = (p.childTaskIds || []).map((id) => tasksById.get(id)).filter(Boolean);
      const pendingN = kids.filter((t) => !t.completed).length;
      return { p, pendingN };
    });
    const tagMap = new Map();
    for (const t of pending) {
      for (const tag of t.tags || []) tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
    }
    const tags = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return { today, week, inbox, all, listRows, sealed, tags };
  }, [tasks, plan, projects, hour, energy, meta]);

  const dateLine = (() => {
    const d = D.parseIsoDate(todayIso);
    return d ? d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : todayIso;
  })();

  const smartOn = (id) => {
    if (id === "today") return view === "today";
    if (id === "week") return view === "plan";
    if (id === "inbox") return view === "dock" && filter.tab === "library" && filter.project === YZ_DOCK.inbox;
    if (id === "all") return view === "dock" && filter.tab === "library" && !filter.project && !filter.tag;
    return false;
  };

  const submitList = () => {
    if (!newName.trim()) return;
    const id = createProject({ title: newName.trim(), type: newType });
    setNewName("");
    setAdding(false);
    patchDock({ tab: "projects", project: id });
  };

  return (
    <aside className={"yz-index" + (indexOpen ? " yz-index--open" : "")}>
      <button type="button" className="yz-index-toggle" onClick={() => setIndexOpen((v) => !v)} aria-expanded={indexOpen}>
        <Icon name="house" size={14} /> Rooms
      </button>
      <div className="yz-mark">
        <div className="yz-mark-seal" aria-hidden><Icon name="blossom" size={16} /></div>
        <div className="yz-mark-text">
          <div className="yz-mark-name">Yoizakura</div>
          <div className="yz-mark-date">{dateLine}</div>
        </div>
      </div>

      <div className="yz-index-scroll">
        <div className="yz-index-sec">
          <button type="button" className={"yz-index-item" + (smartOn("today") ? " is-on" : "")}
            onClick={() => { setUI({ view: "today", cursor: null, statsOpen: false }); setIndexOpen(false); }}
            title="Today (1)">
            <span className="yz-idx-ico"><Icon name="today" size={14} /></span>
            <span className="yz-idx-name">Today</span>
            <span className="yz-idx-count">{counts.today}</span>
            <span className="yz-idx-key">1</span>
          </button>
          <button type="button" className={"yz-index-item" + (smartOn("week") ? " is-on" : "")}
            onClick={() => { setUI({ view: "plan", cursor: null, statsOpen: false }); setIndexOpen(false); }}
            title="Week (2)">
            <span className="yz-idx-ico"><Icon name="calendar" size={14} /></span>
            <span className="yz-idx-name">Week</span>
            <span className="yz-idx-count">{counts.week}</span>
            <span className="yz-idx-key">2</span>
          </button>
          <button type="button" className={"yz-index-item" + (smartOn("inbox") ? " is-on" : "")}
            onClick={() => { patchDock({ tab: "library", status: "pending", project: YZ_DOCK.inbox, tag: null, q: "" }); setIndexOpen(false); }}
            title="Inbox — pending, no list">
            <span className="yz-idx-ico"><Icon name="inbox" size={14} /></span>
            <span className="yz-idx-name">Inbox</span>
            <span className="yz-idx-count">{counts.inbox}</span>
          </button>
          <button type="button" className={"yz-index-item" + (smartOn("all") ? " is-on" : "")}
            onClick={() => { patchDock({ tab: "library", status: "pending", project: null, tag: null, q: "" }); setIndexOpen(false); }}
            title="All tasks (3)">
            <span className="yz-idx-ico"><Icon name="all" size={14} /></span>
            <span className="yz-idx-name">All tasks</span>
            <span className="yz-idx-count">{counts.all}</span>
            <span className="yz-idx-key">3</span>
          </button>
        </div>

        <div className="yz-index-sec">
          <div className="yz-index-sec-h"><h2 className="yz-sec yz-sec--dusk">Lists</h2></div>
          {counts.listRows.map(({ p, pendingN }) => (
            <button key={p.id} type="button"
              className={"yz-index-item" + (view === "dock" && filter.tab === "projects" && filter.project === p.id ? " is-on" : "")}
              onClick={() => { patchDock({ tab: "projects", project: p.id }); setIndexOpen(false); }}>
              <i className="yz-dot" style={{ background: p.color || "var(--fg-faint)" }} />
              <span className="yz-idx-name">{p.title}</span>
              <span className="yz-idx-count">{pendingN}</span>
            </button>
          ))}
          {adding ? (
            <div className="yz-index-new">
              <input className="yz-field yz-field--dusk" placeholder="List name" value={newName}
                onChange={(e) => setNewName(e.target.value)} autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitList();
                  if (e.key === "Escape") { setAdding(false); setNewName(""); }
                }} />
              <select className="yz-field yz-field--dusk" value={newType} onChange={(e) => setNewType(e.target.value)}>
                {D.PROJECT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="yz-btn yz-btn--sm yz-btn--dusk" onClick={submitList}>Add</button>
                <button type="button" className="yz-btn yz-btn--sm yz-btn--ghost" style={{ color: "var(--fg-dim)", borderColor: "var(--line)" }}
                  onClick={() => { setAdding(false); setNewName(""); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" className="yz-index-item yz-index-add"
              onClick={() => setAdding(true)}>
              <span className="yz-idx-ico"><Icon name="plus" size={14} /></span>
              <span className="yz-idx-name">+ New list</span>
            </button>
          )}
        </div>

        {counts.tags.length > 0 && (
          <div className="yz-index-sec">
            <div className="yz-index-sec-h"><h2 className="yz-sec yz-sec--dusk">Tags</h2></div>
            {counts.tags.map(([tag, n]) => (
              <button key={tag} type="button"
                className={"yz-index-item" + (view === "dock" && filter.tab === "library" && filter.tag === tag ? " is-on" : "")}
                onClick={() => { patchDock({ tab: "library", status: "pending", tag, project: null }); setIndexOpen(false); }}>
                <span className="yz-idx-ico" style={{ color: "var(--channel)" }}>#</span>
                <span className="yz-idx-name">{tag}</span>
                <span className="yz-idx-count">{n}</span>
              </button>
            ))}
          </div>
        )}

        <details className="yz-index-details">
          <summary>Sealed lists{counts.sealed.length ? ` · ${counts.sealed.length}` : ""}</summary>
          <button type="button" className="yz-index-item"
            onClick={() => { patchDock({ tab: "projects", project: YZ_DOCK.chronicle }); setIndexOpen(false); }}>
            <span className="yz-idx-ico"><Icon name="scroll" size={14} /></span>
            <span className="yz-idx-name">House chronicle</span>
          </button>
        </details>
      </div>

      <div className="yz-plaque">
        <div className="yz-plaque-lvl">
          <span className="yz-plaque-n">{level.lvl}</span>
          <span className="yz-plaque-title">{level.title}</span>
        </div>
        <Meter pct={level.pct} tone="var(--amber)" gold />
        <div className="yz-plaque-xp">
          {totalXP} XP{level.xpToNext > 0 ? ` · ${level.xpToNext} to next` : " · max"}
        </div>
        <div className="yz-plaque-meta">
          {streak > 0 ? <span className="yz-plaque-streak">{streak} days tended</span> : <span>the garden is new</span>}
        </div>
        <div className="yz-plaque-keys">
          <button type="button" className="yz-icon-btn" onClick={() => setUI({ helpOpen: true })} title="House rules (?)">
            <Kbd>?</Kbd>
          </button>
          <button type="button" className="yz-icon-btn" onClick={() => setUI({ paletteOpen: true })} title="The Caller">
            <Kbd>{MOD}K</Kbd>
          </button>
          <Lamp status={aiStatus} detail={aiDetail} />
        </div>
      </div>
    </aside>
  );
}

function Shell() {
  const view = useStore((s) => s.ui.view);
  const toast = useStore((s) => s.ui.toast);
  const confetti = useStore((s) => s.ui.confetti);
  const levelUp = useStore((s) => s.ui.levelUp);
  const helpOpen = useStore((s) => s.ui.helpOpen);
  const previewMode = useStore((s) => s.ui.previewMode);
  const externalChange = useStore((s) => s.ui.externalChange);
  const formOpen = useStore((s) => s.ui.formOpen);
  const { selectedTaskId } = usePane();
  const [confettiShown, setConfettiShown] = useState(0);
  const [vw, setVw] = useState(() => (typeof window === "undefined" ? 1440 : window.innerWidth));
  const [indexW, setIndexW] = useState(INDEX_W_DEFAULT);
  const [paneW, setPaneW] = useState(PANE_W_DEFAULT);
  const [panePinned, setPanePinned] = useState(false);
  const indexWRef = useRef(indexW);
  indexWRef.current = indexW;

  const panePinnedRef = useRef(panePinned);
  panePinnedRef.current = panePinned;

  useEffect(() => {
    const layout = () => {
      const nextVw = window.innerWidth;
      setVw(nextVw);
      if (nextVw <= BP_PANE) return;
      setIndexW((w) => clamp(w, INDEX_W_MIN, Math.min(INDEX_W_MAX, nextVw - SHEET_W_MIN - PANE_W_MIN)));
      if (panePinnedRef.current) {
        setPaneW((w) => clamp(w, PANE_W_MIN, Math.min(PANE_W_MAX, nextVw - indexWRef.current - SHEET_W_MIN)));
      }
    };
    layout();
    window.addEventListener("resize", layout);
    return () => window.removeEventListener("resize", layout);
  }, []);

  const onIndexW = useCallback((w) => {
    const nextVw = window.innerWidth;
    setIndexW(clamp(w, INDEX_W_MIN, Math.min(INDEX_W_MAX, nextVw - SHEET_W_MIN - PANE_W_MIN)));
  }, []);

  const measurePane = useCallback(() => {
    const el = document.querySelector(".yz-shell .yz-pane");
    return el ? Math.round(el.getBoundingClientRect().width) : paneW;
  }, [paneW]);

  const onPaneW = useCallback((w) => {
    setPanePinned(true);
    const nextVw = window.innerWidth;
    setPaneW(clamp(w, PANE_W_MIN, Math.min(PANE_W_MAX, nextVw - indexWRef.current - SHEET_W_MIN)));
  }, []);

  const paneOpen = !!(formOpen || selectedTaskId);
  const narrowPane = vw <= BP_PANE;
  const narrowIndex = vw <= BP_INDEX;
  const paneHandleOn = !narrowPane && (paneOpen || view !== "plan");
  const indexMax = Math.min(INDEX_W_MAX, Math.max(INDEX_W_MIN, vw - SHEET_W_MIN - PANE_W_MIN));
  const paneMax = Math.min(PANE_W_MAX, Math.max(PANE_W_MIN, vw - indexW - SHEET_W_MIN));

  return (
    <div
      className={"yz-shell" + (paneOpen ? " yz-shell--pane-open" : "") + (panePinned ? " yz-shell--pane-pinned" : "")}
      style={{ "--yz-index-w": indexW + "px", "--yz-pane-w": paneW + "px" }}
    >
      <Index view={view} />
      {!narrowIndex && (
        <ColResize
          label="Resize index column"
          value={indexW}
          min={INDEX_W_MIN}
          max={indexMax}
          onChange={onIndexW}
        />
      )}
      <main className="yz-sheet">
        {previewMode && (
          <div className="yz-banner yz-banner--preview">
            <span style={{ flex: 1 }}>A borrowed house — sample life is loaded.</span>
            <button type="button" className="yz-btn yz-btn--sm" style={{ background: "var(--ink)", color: "var(--amber)", borderColor: "var(--ink)" }} onClick={exitPreview}>
              Return home
            </button>
          </div>
        )}
        {externalChange && (
          <div className="yz-banner yz-banner--xtab">
            <span style={{ flex: 1 }}>Another window rearranged the house.</span>
            <button type="button" className="yz-btn yz-btn--sm" onClick={() => window.location.reload()}>Reload</button>
            <button type="button" className="yz-icon-btn" aria-label="Dismiss" onClick={() => setUI({ externalChange: false })}>
              <Icon name="close" size={12} />
            </button>
          </div>
        )}
        {view === "today" && <TodayView />}
        {view === "plan" && <PlanView />}
        {view === "dock" && <DockView />}
      </main>
      {paneHandleOn && (
        <ColResize
          label="Resize garden pane"
          value={paneW}
          min={PANE_W_MIN}
          max={paneMax}
          invert
          measure={measurePane}
          onChange={onPaneW}
        />
      )}
      <PaperPane view={view} />

      {toast && (
        <div className="yz-toast" role="status">
          {toast.xp != null && toast.xp !== 0 && (
            <span className={"yz-toast-xp" + (toast.xp < 0 ? " yz-toast-xp--port" : "")}>
              {toast.xp >= 0 ? "+" : ""}{toast.xp} XP
            </span>
          )}
          <span style={{ flex: 1 }}>{toast.msg}</span>
          {toast.undoId && (
            <button type="button" className="yz-btn yz-btn--sm yz-toast-undo" onClick={() => runUndo(toast.undoId)}>
              Undo <Kbd>U</Kbd>
            </button>
          )}
        </div>
      )}

      {confetti > confettiShown && <Confetti onDone={() => setConfettiShown(confetti)} />}

      {levelUp && (
        <div role="status" aria-live="polite" className="yz-levelup">
          <Hanko>{levelUp.lvl}</Hanko>
          <span>
            <span className="yz-sec" style={{ display: "flex" }}>A new rank</span>
            <span className="yz-display">{levelUp.title}</span>
          </span>
        </div>
      )}

      {helpOpen && (
        <div onClick={() => setUI({ helpOpen: false })} className="yz-backdrop" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div role="dialog" aria-label="House rules" onClick={(e) => e.stopPropagation()} className="yz-help fade-in">
            <h2 className="yz-sec" style={{ marginBottom: 14 }}>House rules</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {SHORTCUT_ROWS.map(([k, v]) => (
                <div key={k} className="yz-help-row">
                  <span>{v}</span>
                  <Kbd>{k}</Kbd>
                </div>
              ))}
            </div>
            <button type="button" className="yz-btn" style={{ marginTop: 18, width: "100%" }} onClick={() => setUI({ helpOpen: false })}>Close</button>
          </div>
        </div>
      )}

      <Palette />
      <ReviewOverlay />
      <EndOfDayDialog />
      <FocusTunnel />
      <ChronicleDialog />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PaneProvider>
        <Shell />
      </PaneProvider>
    </ErrorBoundary>
  );
}
