/**
 * The §3.2 bucket rules that tsconfig.core.json cannot express: HOOKS files never touch a DOM
 * object or a web-only module (they copy to React Native unchanged), and ui/** reaches the
 * engine's reducer and the AI only through useGame() and selectors.ts — type-only imports are
 * fine, because verbatimModuleSyntax erases them. Reads the sources with node:fs.
 *
 * The HOOKS set is DERIVED, not listed: every `use*.ts` and `*.tsx` under game/, settings/ and
 * audio/ (minus tests and the two named WEB files) — the exact complement of what
 * tsconfig.core.json type-checks without the DOM lib, so the two gates partition the tree.
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

/* ---- (a) HOOKS files: the complement of tsconfig.core.json's exclude globs ---- */

const WEB_FILES = new Set(["audio/WebAudio.ts", "assets/manifest.ts"]);
const HOOKS_FILES = ["game", "settings", "audio"]
  .flatMap((d) => walk(join(SRC, d)))
  .map(rel)
  .filter((r) => !/\.test\.tsx?$/.test(r) && !WEB_FILES.has(r) && (r.endsWith(".tsx") || /\/use[^/]*\.ts$/.test(r)))
  .sort();

/** Module-name patterns with either quote style, so a single-quoted import cannot slip past. */
const Q = `["']`;
const FORBIDDEN: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bwindow\./, "window."],
  [/\bdocument\./, "document."],
  [/\blocalStorage\b/, "localStorage"],
  [/\bnavigator\./, "navigator."],
  [new RegExp(`from\\s+${Q}react-dom(/|${Q})`), "react-dom"],
  [new RegExp(`from\\s+${Q}[^"']*/WebAudio${Q}`), "WebAudio"],
  [new RegExp(`from\\s+${Q}[^"']*/platform(/|${Q})`), "platform/"],
  [new RegExp(`from\\s+${Q}[^"']*/assets/manifest${Q}`), "assets/manifest"],
  [new RegExp(`import\\(\\s*${Q}[^"']*/(WebAudio|platform|assets/manifest)`), "dynamic import of a web module"],
];

const offendingLines = (r: string): string[] => {
  const out: string[] = [];
  readFileSync(join(SRC, r), "utf8")
    .split("\n")
    .forEach((line, i) => {
      for (const [re, label] of FORBIDDEN) if (re.test(line)) out.push(`src/${r}:${i + 1}: ${label} — ${line.trim()}`);
    });
  return out;
};

test("the HOOKS set is derived and non-empty (the providers and every use* hook)", () => {
  expect(HOOKS_FILES).toEqual(expect.arrayContaining(["game/GameProvider.tsx", "game/useTurnLoop.ts", "game/useBarks.ts", "game/useGame.ts", "settings/SettingsProvider.tsx", "settings/useSettings.ts", "audio/useAudio.ts"]));
});

for (const r of HOOKS_FILES) {
  test(`HOOKS: src/${r} touches no DOM object and no web-only module`, () => {
    const offenders = offendingLines(r);
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
}

/* ---- (b) ui/** ---- */

const RULES_IMPORT = /^(\.\.\/)+(engine\/reducer$|ai(\/|$))/;
/** Every static `import … from` / `export … from` statement, either quote style. */
const IMPORT_RE = /\b(import|export)\s+([^;]*?)\s+from\s+["']([^"']+)["']/g;
/** Dynamic imports, either quote style. */
const DYNAMIC_RE = /import\(\s*["']([^"']+)["']\s*\)/g;

test("WEB: src/ui/** imports ../engine/reducer and ../ai only as `import type`", () => {
  const offenders: string[] = [];
  for (const file of walk(join(SRC, "ui"))) {
    const text = readFileSync(file, "utf8");
    const r = rel(file);
    for (const m of text.matchAll(IMPORT_RE)) {
      const [, , clause, spec] = m;
      if (!RULES_IMPORT.test(spec) || clause.startsWith("type ")) continue;
      const line = text.slice(0, m.index).split("\n").length;
      offenders.push(`src/${r}:${line}: import from "${spec}" must be \`import type\` (ui/ reaches the engine through useGame() and selectors.ts)`);
    }
    for (const m of text.matchAll(DYNAMIC_RE)) {
      if (!RULES_IMPORT.test(m[1])) continue;
      const line = text.slice(0, m.index).split("\n").length;
      offenders.push(`src/${r}:${line}: dynamic import of "${m[1]}" from ui/`);
    }
  }
  expect(offenders, offenders.join("\n")).toEqual([]);
});

test("the ui/ walk sees the components (the rule is not vacuous)", () => {
  expect(walk(join(SRC, "ui")).map(rel)).toEqual(expect.arrayContaining(["ui/Card.tsx", "ui/Hand.tsx", "ui/screens/TableScreen.tsx"]));
});
