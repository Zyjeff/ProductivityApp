import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// Dev-only middleware serving the same /api/anthropic contract as the
// Netlify function, so AI features work under plain `npm run dev`.
// The key comes from .env (ANTHROPIC_API_KEY) or the process env and
// never reaches client code. Without a key the endpoint answers 503
// and the app shows its honest "AI off" state.
function anthropicDevProxy(env) {
  return {
    name: "anthropic-dev-proxy",
    configureServer(server) {
      server.middlewares.use("/api/anthropic", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end("Method Not Allowed");
        }
        const key = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
        if (!key) {
          res.statusCode = 503;
          res.setHeader("content-type", "application/json");
          return res.end(JSON.stringify({ error: "ANTHROPIC_API_KEY not set — add it to .env to enable AI in dev" }));
        }
        let body = "";
        req.on("data", (c) => { body += c; });
        req.on("end", async () => {
          try {
            const upstream = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
              },
              body,
            });
            const text = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader("content-type", upstream.headers.get("content-type") || "application/json");
            res.end(text);
          } catch (e) {
            res.statusCode = 502;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: String(e) }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Anchor at the project dir, not process.cwd() — the dev server may be
  // launched from anywhere and .env must still be found.
  const env = loadEnv(mode, HERE, "");
  return {
    plugins: [react(), anthropicDevProxy(env)],
  };
});
