// theme.js — which presentation is mounted. The only state the theme
// system owns is a persisted id string. Core never imports a theme;
// main.jsx resolves the id against the registry (presentation side).

import { useSyncExternalStore } from "react";

const KEY = "werf_theme";

let storageRef = null;
let current = null;
const listeners = new Set();

export function initTheme(storage, fallbackId) {
  storageRef = storage;
  try {
    current = storage.getItem(KEY) || fallbackId;
  } catch {
    current = fallbackId;
  }
}

export function getThemeId() { return current; }

export function setThemeId(id) {
  if (!id || id === current) return;
  current = id;
  try { storageRef?.setItem(KEY, id); } catch { /* private mode: switch still works, just won't persist */ }
  for (const fn of [...listeners]) {
    try { fn(); } catch (e) { console.error("werf: theme listener failed", e); }
  }
}

function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function useThemeId() {
  return useSyncExternalStore(subscribe, getThemeId);
}
