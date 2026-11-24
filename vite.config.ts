// `defineConfig` comes from "vitest/config", not "vite": Vite's own UserConfig has no `test`
// key, and tsconfig.node.json type-checks this file under `tsc -b`.
// No PWA plugin: dist/ is a static site plus one hand-written service worker (tally-offline).
import { appendFile, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import { defineConfig } from "vitest/config";
import { fnv1aBytes, precachePlan, renderWorker, type DistFile } from "./src/platform/precache.ts";

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

/** Offline precache budget: the build fails past it. */
const PRECACHE_BUDGET = 16 * 1024 * 1024;

async function walkDist(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walkDist(p)));
    else out.push(p);
  }
  return out;
}

/**
 * Build-only: once dist/ is written (public/ copied in), hash every file, ask precache.ts which
 * ones go offline, and write dist/sw.js = that plan + src/platform/sw.js.
 */
function offline(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "tally-offline",
    apply: "build",
    configResolved(c) {
      config = c;
    },
    async closeBundle() {
      const outDir = resolve(config.root, config.build.outDir);
      const files: DistFile[] = [];
      for (const p of await walkDist(outDir)) {
        const bytes = await readFile(p);
        files.push({ path: relative(outDir, p).split("\\").join("/"), hash: fnv1aBytes(bytes), size: bytes.length });
      }
      const plan = precachePlan(files, config.base);
      if (plan.bytes > PRECACHE_BUDGET) throw new Error(`offline: precache is ${plan.bytes} bytes, over the ${PRECACHE_BUDGET}-byte budget`);
      const body = await readFile(resolve(config.root, "src/platform/sw.js"), "utf8");
      await writeFile(join(outDir, "sw.js"), renderWorker(plan, config.base, body), "utf8");
      config.logger.info(`offline: sw.js ${plan.version}, ${plan.core.length} core + ${plan.music.length} music files, ${(plan.bytes / 1048576).toFixed(1)} MB`);
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
  plugins: [assetNotes(), offline()],
  // Phaser is one ~1.4 MB chunk (≈400 kB gzipped); a one-time download, and splitting it buys nothing.
  build: { chunkSizeWarningLimit: 1600 },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
