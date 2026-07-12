import React from "react";
import { createRoot } from "react-dom/client";
import "./tokens.css";
import { initStore } from "./store.js";
import App from "./app.jsx";

// Error boundary: a render crash falls back to a recovery card instead
// of unmounting (the data is already safe in localStorage).
class Boundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("[Werf]", error, info?.componentStack); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 520, background: "var(--plate)", border: "1px solid var(--port)", borderRadius: 10, padding: "20px 22px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--port)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Werf hit a snag</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Something threw during render.</div>
            <div style={{ fontSize: 12, fontFamily: "var(--t-mono)", color: "var(--fg-dim)", background: "var(--well)", padding: "8px 10px", borderRadius: 6, marginBottom: 14, wordBreak: "break-word" }}>
              {String(this.state.error?.message || this.state.error)}
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-dim)", marginBottom: 14 }}>
              Your data is saved locally — nothing is lost. Reload to get back to it.
            </div>
            <button className="w-switch" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

initStore(window.localStorage);

createRoot(document.getElementById("root")).render(
  <Boundary>
    <App />
  </Boundary>
);
