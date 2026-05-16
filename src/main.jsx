import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// window.storage shim — the source app was built against a host-provided
// Promise-based KV API. Back it with localStorage for browser use.
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      const v = localStorage.getItem(key);
      return v == null ? null : { value: v };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
    },
  };
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
