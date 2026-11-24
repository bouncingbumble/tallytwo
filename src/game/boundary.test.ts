/**
 * The layering rules that tsconfig.core.json cannot express. Reads the sources with node:fs.
 *
 * (a) The stores (game/store.ts, settings/store.ts, audio/director.ts) live in folders that
 *     tsconfig.core.json compiles without the DOM lib, so they stay PURE: time, sound, storage and
 *     the host arrive as ports. Only platform/offline.ts touches the service worker.
 * (b) The scenes (phaser/**) reach the engine's reducer and the AI only through the store and
 *     selectors.ts — type-only imports are fine, because verbatimModuleSyntax erases them; their
 *     durations come from game/timing.ts; and they never make a card face see-through.
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
    else if (name.endsWith(".ts")) out.push(p);
  }
  return out;
};
const rel = (file: string): string => relative(SRC, file).split("\\").join("/");

/* ---- (a) the PURE folders ---- */

test("the stores are in the PURE folders", () => {
  const files = ["game", "settings", "audio"].flatMap((d) => walk(join(SRC, d))).map(rel);
  expect(files).toEqual(expect.arrayContaining(["game/store.ts", "game/clock.ts", "settings/store.ts", "audio/director.ts"]));
});

test("only platform/offline.ts touches navigator.serviceWorker", () => {
  const offenders = walk(SRC)
    .map(rel)
    .filter((r) => !r.endsWith(".test.ts") && r !== "platform/offline.ts" && /\bserviceWorker\b/.test(readFileSync(join(SRC, r), "utf8")));
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

/**
 * Every presentation duration is a token in game/timing.ts (MOTION, EASE, DOORS_FRAMES_MS, ...),
 * so motion can be tuned in one place and reduced motion reaches
 * all of it. A number written straight into a tween or a scene timer is the thing this stops.
 */
const TIMING_LITERAL = [/\b(duration|delay|hold|repeatDelay)\s*:\s*\d/, /\b(after|delayedCall)\(\s*\d/];

test("SCENES: no tween or timer duration written as a number literal (use game/timing.ts)", () => {
  const offenders: string[] = [];
  for (const file of walk(join(SRC, "phaser"))) {
    const r = rel(file);
    if (r.endsWith(".test.ts")) continue;
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (TIMING_LITERAL.some((re) => re.test(line))) offenders.push(`src/${r}:${i + 1}: ${line.trim()}`);
      });
  }
  expect(offenders, offenders.join("\n")).toEqual([]);
});

/**
 * A card face is never made see-through: the cards overlap, so a
 * translucent face shows the card under it. A card is dimmed by tint (cards.ts); a card fading in
 * or out fades its whole container, never `.face` alone.
 */
const FACE_ALPHA = [/\.face\.setAlpha\(/, /\.face\.alpha\s*=[^=]/, /targets:\s*[^,}]*\.face\b[^}]*\balpha\s*:/];

test("SCENES: nothing writes a card face's alpha", () => {
  const offenders: string[] = [];
  for (const file of walk(join(SRC, "phaser"))) {
    const r = rel(file);
    if (r.endsWith(".test.ts")) continue;
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (FACE_ALPHA.some((re) => re.test(line))) offenders.push(`src/${r}:${i + 1}: ${line.trim()}`);
      });
  }
  expect(offenders, offenders.join("\n")).toEqual([]);
});

test("the phaser/ walk sees the scenes (the rule is not vacuous)", () => {
  expect(walk(join(SRC, "phaser")).map(rel)).toEqual(expect.arrayContaining(["phaser/cards.ts", "phaser/table/Hand.ts", "phaser/scenes/Table.ts"]));
});
