// keys.js — the command layer. One global keydown handler + a command
// registry that also feeds the Ctrl+K palette. Views expose their
// ordered, actionable rows through registerActiveList() so j/k/x/e/f/t/d
// operate on whatever list is on screen.

import { getState, setUI, setCompletion, deleteTask, pinTaskToDate, undoLast, notify } from "./store.js";
import { effectiveTodayIso, isoDate, addDays } from "./domain.js";
import { MOD } from "./components.jsx";

// The active view's list: { rows: [{ taskId, chunkDate?, done }], viewName }
let activeList = { rows: [], viewName: null };
export function registerActiveList(viewName, rows) {
  activeList = { rows, viewName };
  const cur = getState()?.ui.cursor;
  if (cur && cur.index >= rows.length) {
    setUI({ cursor: rows.length ? { index: rows.length - 1 } : null });
  }
}
export function getActiveRows() { return activeList.rows; }

function cursorRow() {
  const cur = getState().ui.cursor;
  if (!cur) return null;
  return activeList.rows[cur.index] || null;
}

function moveCursor(delta) {
  const rows = activeList.rows;
  if (!rows.length) return;
  const cur = getState().ui.cursor;
  const next = cur == null
    ? (delta > 0 ? 0 : rows.length - 1)
    : Math.max(0, Math.min(rows.length - 1, cur.index + delta));
  setUI({ cursor: { index: next } });
}

/* ── commands (palette + shortcuts share this table) ───────── */

export function buildCommands() {
  const s = getState();
  const row = cursorRow();
  const cmds = [
    { id: "view-today", label: "Go to Today", keys: "1", run: () => setUI({ view: "today", cursor: null }) },
    { id: "view-plan", label: "Go to Plan", keys: "2", run: () => setUI({ view: "plan", cursor: null }) },
    { id: "view-dock", label: "Go to Dock", keys: "3", run: () => setUI({ view: "dock", cursor: null }) },
    { id: "capture", label: "Capture a task", keys: "N", run: () => focusCapture() },
    { id: "new-full", label: "New task (full form)", keys: "Shift+N", run: () => setUI({ formOpen: true, editingTaskId: null }) },
    { id: "stats", label: s.ui.statsOpen ? "Close stats panel" : "Open stats panel", keys: "4", run: () => setUI({ statsOpen: !s.ui.statsOpen }) },
    { id: "undo", label: "Undo last action", keys: "U", run: () => undoLast() },
    { id: "close-day", label: "Close the day", run: () => setUI({ endOfDayOpen: true }) },
    { id: "help", label: "Keyboard help", keys: "?", run: () => setUI({ helpOpen: !s.ui.helpOpen }) },
  ];
  if (row) {
    const t = s.tasks.find((x) => x.id === row.taskId);
    if (t) {
      cmds.unshift(
        { id: "row-complete", label: `${row.done ? "Reopen" : "Complete"}: ${t.title.slice(0, 40)}`, keys: "X", run: () => setCompletion(row.taskId, { done: !row.done, chunkDate: row.chunkDate || null }) },
        { id: "row-edit", label: `Edit: ${t.title.slice(0, 40)}`, keys: "E", run: () => setUI({ editingTaskId: row.taskId, formOpen: true }) },
        { id: "row-focus", label: `Focus: ${t.title.slice(0, 40)}`, keys: "F", run: () => setUI({ focusTaskId: row.taskId }) },
        { id: "row-today", label: `Schedule today: ${t.title.slice(0, 40)}`, keys: "T", run: () => { pinTaskToDate(row.taskId, effectiveTodayIso(s.meta.dayStartHour)); notify("Scheduled for today"); } },
        { id: "row-tomorrow", label: `Schedule tomorrow: ${t.title.slice(0, 40)}`, run: () => { pinTaskToDate(row.taskId, isoDate(addDays(new Date(), 1))); notify("Scheduled for tomorrow"); } },
        { id: "row-delete", label: `Delete: ${t.title.slice(0, 40)}`, keys: "⌫", run: () => deleteTask(row.taskId) },
      );
    }
  }
  return cmds;
}

// On views with a capture bar, N focuses it; anywhere else (e.g. Plan),
// N falls back to opening the full task form — never a dead key.
const DEFAULT_CAPTURE_FOCUS = () => setUI({ formOpen: true, editingTaskId: null });
let captureFocusFn = DEFAULT_CAPTURE_FOCUS;
export function setCaptureFocus(fn) { captureFocusFn = fn || DEFAULT_CAPTURE_FOCUS; }
function focusCapture() { captureFocusFn(); }

/* ── global handler ────────────────────────────────────────── */

export function installKeyboard() {
  const handler = (e) => {
    const s = getState();
    if (!s) return;
    const tag = (e.target.tagName || "").toLowerCase();
    const inField = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;

    // Palette toggle works everywhere.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setUI({ paletteOpen: !s.ui.paletteOpen });
      return;
    }
    if (e.key === "Escape") {
      if (s.ui.paletteOpen) { setUI({ paletteOpen: false }); return; }
      if (s.ui.helpOpen) { setUI({ helpOpen: false }); return; }
      if (s.ui.formOpen) { setUI({ formOpen: false, editingTaskId: null }); return; }
      if (s.ui.endOfDayOpen) { setUI({ endOfDayOpen: false }); return; }
      if (s.ui.statsOpen) { setUI({ statsOpen: false }); return; }
      if (!inField && s.ui.cursor) { setUI({ cursor: null }); return; }
      return;
    }
    if (inField) return;
    if (s.ui.paletteOpen || s.ui.formOpen || s.ui.focusTaskId || s.ui.endOfDayOpen) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const k = e.key;
    if (k === "?" || (e.shiftKey && k === "/")) { e.preventDefault(); setUI({ helpOpen: !s.ui.helpOpen }); return; }
    if (k === "1") { e.preventDefault(); setUI({ view: "today", cursor: null }); return; }
    if (k === "2") { e.preventDefault(); setUI({ view: "plan", cursor: null }); return; }
    if (k === "3") { e.preventDefault(); setUI({ view: "dock", cursor: null }); return; }
    if (k === "4") { e.preventDefault(); setUI({ statsOpen: !s.ui.statsOpen }); return; }
    if (k === "n") { e.preventDefault(); focusCapture(); return; }
    if (k === "N") { e.preventDefault(); setUI({ formOpen: true, editingTaskId: null }); return; }
    if (k === "u" || k === "U") { e.preventDefault(); undoLast(); return; }

    if (k === "j" || k === "ArrowDown") { e.preventDefault(); moveCursor(1); return; }
    if (k === "k" || k === "ArrowUp") { e.preventDefault(); moveCursor(-1); return; }

    const row = cursorRow();
    if (!row) return;
    if (k === "x" || k === "X" || k === "Enter") {
      e.preventDefault();
      setCompletion(row.taskId, { done: !row.done, chunkDate: row.chunkDate || null });
      return;
    }
    if (k === "e" || k === "E") { e.preventDefault(); setUI({ editingTaskId: row.taskId, formOpen: true }); return; }
    if (k === "f" || k === "F") { e.preventDefault(); setUI({ focusTaskId: row.taskId }); return; }
    if (k === "t" || k === "T") {
      e.preventDefault();
      pinTaskToDate(row.taskId, effectiveTodayIso(getState().meta.dayStartHour));
      notify("Scheduled for today");
      return;
    }
    if (k === "Delete" || k === "Backspace") { e.preventDefault(); deleteTask(row.taskId); return; }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}

export const SHORTCUT_ROWS = [
  ["N", "Capture (instant)"],
  ["Shift+N", "New task, full form"],
  ["1 / 2 / 3", "Today · Plan · Dock"],
  ["4", "Stats panel"],
  [`${MOD}+K`, "Command palette"],
  ["J / K", "Move cursor down / up"],
  ["X or Enter", "Complete / reopen at cursor"],
  ["E", "Edit at cursor"],
  ["F", "Focus tunnel at cursor"],
  ["T", "Schedule today at cursor"],
  ["Del", "Delete at cursor (undoable)"],
  ["U", "Undo last action"],
  ["Esc", "Close / clear cursor"],
  ["?", "This help"],
];
