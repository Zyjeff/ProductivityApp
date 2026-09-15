// registry.js — the installed themes. Adding a theme is: create a
// folder under src/themes/ that default-exports { id, name, tagline,
// App, css }, then add one import + one array entry here. The first
// entry is the default. See THEMING.md.

import drydock from "./drydock/index.js";
import nightwatch from "./nightwatch/index.js";
import loft from "./loft/index.js";
import sluis from "./sluis/index.js";
import kuromi from "./kuromi/index.js";
import relay from "./relay/index.js";
import apogee from "./apogee/index.js";
import kaze from "./kaze/index.js";
import yoizakura from "./yoizakura/index.js";
import folioLegacy from "./folio-legacy/index.js";
import folio from "./folio/index.js";
import verdant from "./verdant/index.js";
import verdantEnchanted from "./verdant-enchanted/index.js";

export const THEMES = [drydock, nightwatch, loft, sluis, kuromi, relay, apogee, kaze, yoizakura, folioLegacy, folio, verdant, verdantEnchanted];

export function resolveTheme(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}
