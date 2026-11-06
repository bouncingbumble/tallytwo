// `defineConfig` comes from "vitest/config", not "vite": Vite's own UserConfig has no `test`
// key, and tsconfig.node.json type-checks this file under `tsc -b`.
// No PWA plugin: the build is a plain static dist/ for a webview shell or any static host.
import { appendFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/** Where the /assets page's Submit appends notes. */
const NOTES_FILE = join(homedir(), "Desktop", "tally-two-asset-notes.txt");

interface AssetNote {
  name: string;
  file: string;
  note: string;
}

const isNote = (v: unknown): v is AssetNote =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as AssetNote).name === "string" &&
  typeof (v as AssetNote).file === "string" &&
  typeof (v as AssetNote).note === "string";

/**
 * Dev-only: POST /__asset-notes with [{ name, file, note }] appends a timestamped section to
 * NOTES_FILE. A browser cannot write to the Desktop, so the dev server does it. `apply: "serve"`
 * keeps it out of `vite build` — dist/ stays a plain static site.
 */
function assetNotes(): Plugin {
  return {
    name: "tally-asset-notes",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__asset-notes", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("POST only");
          return;
        }
        let body = "";
        req.setEncoding("utf8");
        req.on("data", (chunk: string) => {
          body += chunk;
          if (body.length > 1_000_000) req.destroy();
        });
        req.on("end", async () => {
          try {
            const parsed: unknown = JSON.parse(body);
            if (!Array.isArray(parsed) || !parsed.every(isNote)) throw new Error("expected [{ name, file, note }]");
            const notes = parsed.filter((n) => n.note.trim() !== "");
            if (notes.length === 0) throw new Error("no notes to save");
            const stamp = new Date().toLocaleString();
            const header = `Tally Two asset notes — ${stamp}`;
            const lines = [header, "=".repeat(header.length)];
            for (const n of notes) {
              lines.push(`${n.name} (${n.file})`);
              for (const l of n.note.trim().split(/\r?\n/)) lines.push(`  ${l}`);
              lines.push("");
            }
            await appendFile(NOTES_FILE, lines.join("\n") + "\n", "utf8");
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ saved: notes.length, file: NOTES_FILE }));
          } catch (e) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
          }
        });
      });
    },
  };
}

/**
 * The public path the build is served under. GitHub Pages serves a project site from
 * /<repo>/, so the deploy workflow (.github/workflows/pages.yml) sets BASE_PATH=/tallytwo/;
 * the dev server, `vite preview` and a webview shell keep "/". Vite rewrites every imported
 * asset and index.html's links to it; the few hand-written URLs read import.meta.env.BASE_URL.
 */
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [react(), assetNotes()],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
