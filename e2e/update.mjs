// The offline update gate (docs/OFFLINE_PLAN.md, D4): a deploy never swaps files under a match.
// Builds v1 (VITE_E2E=1), serves it, starts a match, builds v2 into the same dist/, and checks:
// v2 installs and waits, v1's caches stay, the page does not reload; back on the Title the
// "New version ready" line shows, and tapping it reloads into v2 with v1's caches gone.
//
//   npm run e2e:update            (Chromium; needs playwright, like e2e/play.mjs)
import { chromium } from "playwright";
import { execSync, spawn } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const base = "http://localhost:4180";
const cwd = fileURLToPath(new URL("..", import.meta.url));
const PROBE = `${cwd}public/zz-update-probe.json`;
const build = () => execSync("npx vite build", { cwd, stdio: "ignore", env: { ...process.env, VITE_E2E: "1", BASE_PATH: "/" } });
rmSync(PROBE, { force: true });
build();
const server = spawn("npx", ["vite", "preview", "--port", "4180", "--strictPort"], { cwd, stdio: "ignore" });
const done = (code) => {
  server.kill();
  rmSync(PROBE, { force: true });
  process.exit(code);
};
await new Promise((r) => setTimeout(r, 2000));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const keys = () => page.evaluate(() => caches.keys());
const waitingNow = () => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
const probe = () => page.evaluate(() => window.__tally.probe());
let navs = 0; page.on("framenavigated", (f) => { if (f === page.mainFrame()) navs++; });
await page.goto(base + "/");
await page.evaluate(() => navigator.serviceWorker.ready);
for (let i=0;i<50 && !(await page.evaluate(()=>!!navigator.serviceWorker.controller));i++) await sleep(100);
const v1 = await keys(); console.log("v1 caches", v1);
await page.evaluate(() => window.__tally.act({ type: "NEW_MATCH", seed: 3, rules: window.__tally.settings.rules }));
await sleep(1500);
writeFileSync(PROBE, '{"v":2}'); // any change makes a new build version
build();
await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
for (let i=0;i<100 && !(await waitingNow());i++) await sleep(100);
const mid = await keys();
const phase = await page.evaluate(() => window.__tally.game?.phase);
console.log("mid-match after deploy: waiting", await waitingNow(), "caches", mid, "phase", phase, "navs", navs);
const okMid = (await waitingNow()) && v1.every((c) => mid.includes(c)) && navs === 1 && phase === "playing";
// back to the title: the update line shows there
await page.evaluate(() => window.__tally.act({ type: "QUIT" }));
let t; for (let i=0;i<50;i++) { t = (await probe()).targets["title.update"]; if (t?.visible) break; await sleep(100); }
console.log("title.update", t);
const okLine = !!t?.visible && t.enabled;
await sleep(600);
const k = (await probe()).k;
const before = navs;
await page.mouse.click((t.x + t.w / 2) * k, (t.y + t.h / 2) * k);
for (let i=0;i<80 && navs===before;i++) await sleep(100);
await sleep(1500);
const after = await keys();
console.log("after tap: navs", navs, "waiting", await waitingNow(), "caches", after);
const okAfter = navs === before + 1 && !(await waitingNow()) && after.length === 2 && after.every((c) => !v1.includes(c));
console.log(okMid && okLine && okAfter ? "✓ update flow ok" : `✗ update flow FAILED mid=${okMid} line=${okLine} after=${okAfter}`);
await browser.close();
done(okMid && okLine && okAfter ? 0 : 1);
