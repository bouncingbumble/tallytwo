// The offline build gate (docs/OFFLINE_PLAN.md): reads dist/sw.js's PLAN and checks it against
// dist/ independently of the plugin that wrote it.
//
//   node scripts/check-sw.mjs [base]      base defaults to $BASE_PATH, else "/"
//
// - every listed URL exists in dist/ and carries the base;
// - every shipped file is listed, except what precache.ts skips on purpose (sw.js, .woff,
//   the /assets dev page, source maps);
// - index.html is core; the music is all ost_*;
// - the total stays under the budget.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const BASE = (process.argv[2] ?? process.env.BASE_PATH ?? "/").replace(/\/?$/, "/");
const BUDGET = 16 * 1024 * 1024;
const SKIP = [/^sw\.js$/, /\.woff$/, /(^|\/)assetsPage-/, /\.map$/, /(^|\/)\.DS_Store$/];

const fails = [];
const fail = (m) => fails.push(m);

const swPath = join(DIST, "sw.js");
if (!existsSync(swPath)) {
  console.error("✗ dist/sw.js is missing: run `npm run build` first");
  process.exit(1);
}
const src = readFileSync(swPath, "utf8");
const m = src.match(/const PLAN = (\{[\s\S]*?\n\});/);
if (!m) {
  console.error("✗ dist/sw.js has no PLAN");
  process.exit(1);
}
const plan = JSON.parse(m[1]);

const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const shipped = walk(DIST).map((p) => relative(DIST, p).split("\\").join("/"));

if (plan.base !== BASE) fail(`PLAN.base is ${plan.base}, expected ${BASE}`);
if (plan.index !== BASE + "index.html" || !plan.core.includes(plan.index)) fail(`index.html is not core (${plan.index})`);

const listed = [...plan.core, ...plan.music];
let bytes = 0;
for (const url of listed) {
  if (!url.startsWith(BASE)) {
    fail(`${url} lacks the base ${BASE}`);
    continue;
  }
  const file = join(DIST, url.slice(BASE.length));
  if (!existsSync(file)) fail(`${url} is listed but not in dist/`);
  else bytes += statSync(file).size;
}
for (const url of plan.music) if (!/\/ost_[^/]*\.m4a$/.test(url)) fail(`${url} is in music but is not an ost_ loop`);

const set = new Set(listed);
for (const rel of shipped) if (!SKIP.some((re) => re.test(rel)) && !set.has(BASE + rel)) fail(`dist/${rel} ships but is not precached`);

if (bytes > BUDGET) fail(`precache is ${(bytes / 1048576).toFixed(1)} MB, over ${BUDGET / 1048576} MB`);

if (fails.length) {
  for (const f of fails.slice(0, 12)) console.error("✗ " + f);
  if (fails.length > 12) console.error(`✗ … and ${fails.length - 12} more`);
  process.exit(1);
}
console.log(`✓ sw.js ${plan.version}: ${plan.core.length} core + ${plan.music.length} music files, ${(bytes / 1048576).toFixed(1)} MB, base ${BASE}`);
