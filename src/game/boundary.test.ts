/**
 * The bucket rules that tsconfig.core.json cannot express. Reads the sources with node:fs.
 *
 * (a) Nothing in game/, settings/ or audio/ escapes the PURE check: tsconfig.core.json compiles
 *     those folders without the DOM lib, excluding only tests and the two named WEB files, so a
 *     framework hook or a .tsx there would slip past it — there must be none. The stores
 *     (game/store.ts, settings/store.ts, audio/director.ts) are therefore PURE: time, sound,
 *     storage and the host arrive as ports.
 * (b) The scenes (phaser/**) reach the engine's reducer and the AI only through the store and
 *     selectors.ts — type-only imports are fine, because verbatimModuleSyntax erases them — and
 *     nothing anywhere imports React.
 */
/// <reference types="node" />
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const SRC = fileURLToPath(new URL("..", import.meta.url));

const walk = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
};
const rel = (file: string): string => relative(SRC, file).split("\\").join("/");

/* ---- (a) the PURE folders have nothing the core check skips ---- */

const WEB_FILES = new Set(["audio/WebAudio.ts", "assets/manifest.ts"]);

test("game/, settings/, audio/: no .tsx and no use*.ts (tsconfig.core.json would not check them)", () => {
  const escaped = ["game", "settings", "audio"]
    .flatMap((d) => walk(join(SRC, d)))
    .map(rel)
    .filter((r) => !/\.test\.tsx?$/.test(r) && !WEB_FILES.has(r) && (r.endsWith(".tsx") || /\/use[^/]*\.ts$/.test(r)));
  expect(escaped).toEqual([]);
});

test("the stores are in the PURE folders", () => {
  const files = ["game", "settings", "audio"].flatMap((d) => walk(join(SRC, d))).map(rel);
  expect(files).toEqual(expect.arrayContaining(["game/store.ts", "game/clock.ts", "settings/store.ts", "audio/director.ts"]));
});

test("nothing imports React", () => {
  const offenders = walk(SRC)
    .map(rel)
    .filter((r) => /from\s+["']react(-dom)?(\/|["'])/.test(readFileSync(join(SRC, r), "utf8")));
  expect(offenders).toEqual([]);
});

test("only platform/offline.ts touches navigator.serviceWorker (docs/OFFLINE_PLAN.md)", () => {
  const offenders = walk(SRC)
    .map(rel)
    .filter((r) => !/\.test\.tsx?$/.test(r) && r !== "platform/offline.ts" && /\bserviceWorker\b/.test(readFileSync(join(SRC, r), "utf8")));
  expect(offenders).toEqual([]);
});

/* ---- (b) phaser/** ---- */

const RULES_IMPORT = /^(\.\.\/)+(engine\/reducer$|ai(\/|$))/;
/** Every static `import … from` / `export … from` statement, either quote style. */
const IMPORT_RE = /\b(import|export)\s+([^;]*?)\s+from\s+["']([^"']+)["']/g;
/** Dynamic imports, either quote style. */
const DYNAMIC_RE = /import\(\s*["']([^"']+)["']\s*\)/g;

test("SCENES: src/phaser/** imports engine/reducer and ai only as `import type`", () => {
  const offenders: string[] = [];
  for (const file of walk(join(SRC, "phaser"))) {
    const text = readFileSync(file, "utf8");
    const r = rel(file);
    for (const m of text.matchAll(IMPORT_RE)) {
      const [, , clause, spec] = m;
      if (!RULES_IMPORT.test(spec) || clause.startsWith("type ")) continue;
      const line = text.slice(0, m.index).split("\n").length;
      offenders.push(`src/${r}:${line}: import from "${spec}" must be \`import type\` (scenes reach the engine through the store and selectors.ts)`);
    }
    for (const m of text.matchAll(DYNAMIC_RE)) {
      if (!RULES_IMPORT.test(m[1])) continue;
      const line = text.slice(0, m.index).split("\n").length;
      offenders.push(`src/${r}:${line}: dynamic import of "${m[1]}" from phaser/`);
    }
  }
  expect(offenders, offenders.join("\n")).toEqual([]);
});

test("the phaser/ walk sees the scenes (the rule is not vacuous)", () => {
  expect(walk(join(SRC, "phaser")).map(rel)).toEqual(expect.arrayContaining(["phaser/cards.ts", "phaser/table/Hand.ts", "phaser/scenes/Table.ts"]));
});
