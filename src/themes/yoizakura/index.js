// Yoizakura — evening blossoms. A Japanese house at dusk, its veranda
// open to a garden that grows with real work.

import App from "./app.jsx";
import base from "./css/base.css?inline";
import today from "./css/today.css?inline";
import plan from "./css/plan.css?inline";
import dock from "./css/dock.css?inline";

export default {
  id: "yoizakura",
  name: "Yoizakura",
  tagline: "Evening blossoms — the house in order, the garden in bloom.",
  App,
  css: [base, today, plan, dock].join("\n"),
};
