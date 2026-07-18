// registry.js — the installed themes. Adding a theme is: create a
// folder under src/themes/ that default-exports { id, name, tagline,
// App, css }, then add one import + one array entry here. The first
// entry is the default. See THEMING.md.

import drydock from "./drydock/index.js";
import nightwatch from "./nightwatch/index.js";

export const THEMES = [drydock, nightwatch];

export function resolveTheme(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}
