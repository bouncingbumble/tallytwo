// The frame-time benchmark (docs/PERF_PLAN.md Phase 0). Deals ?seed=17 at Card sharp on Fast,
// plays the human's side through the store (select each card, then Play; Pass when nothing is
// legal) and lets the three AIs answer, for ROUNDS rounds, then reads window.__perf.report()
// (src/phaser/perf.ts). Needs `?perf=1`, which works in a dev or a production build.
//
//   npm run dev -- --port 5190        (a dev build: the run drives the game through window.__tally)
//   node e2e/perf.mjs http://localhost:5190 [label] [rounds]
//   ONLY=webkit node e2e/perf.mjs ...  (one device)
//
// Gates (exit 1), chosen to be immune to a noisy machine: no AI move is computed on the main
// thread (the worker does it; ai.count is main-thread AI moves), and on the iPhone profile, where
// Phaser batches one texture per draw, a drawn frame stays under MAX_IOS_DRAWS draw calls (82 per
// frame before the card sheet and the baked saloon; ~45 after). Timings are reported, not gated.
//
// Writes e2e/perf/<label>.json and prints one line per device. Headless browsers draw with
// SwiftShader (no GPU), so treat "interval" as relative; "work", draw calls, uploads and long
// tasks are the comparable numbers. Real-device numbers come from the ?perf=1 overlay on the
// phone itself.
import { chromium, webkit } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.argv[2] || "http://localhost:5190";
const LABEL = process.argv[3] || "run";
const ROUNDS = Number(process.argv[4]) || 1;
const OUT = new URL("./perf/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const DEVICES = [
  { name: "chromium-desktop", type: chromium, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, mobile: false },
  { name: "webkit-i15", type: webkit, viewport: { width: 852, height: 393 }, deviceScaleFactor: 3, mobile: true },
];
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(dev) {
  const browser = await dev.type.launch(dev.type === chromium ? { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } : {});
  const ctx = await browser.newContext({ viewport: dev.viewport, deviceScaleFactor: dev.deviceScaleFactor, ...(dev.mobile ? { isMobile: true, hasTouch: true, userAgent: UA } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("tallytwo.settings", JSON.stringify({ opts: { gameSpeed: "fast", difficulty: "hard", hints: false } })));
  await page.goto(`${base}/?seed=17&perf=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__perf && window.__tally, null, { timeout: 20000 });
  await sleep(500);
  await page.evaluate(() => {
    window.__tally.act({ type: "NEW_MATCH", seed: 17, rules: window.__tally.settings.rules });
    window.__perf.reset();
  });
  for (let r = 0; r < ROUNDS; r++) {
    const t0 = Date.now();
    for (;;) {
      const state = await page.evaluate(() => {
        const g = window.__tally.game;
        return g ? { phase: g.phase, turn: g.turn, round: g.round } : null;
      });
      if (!state) throw new Error("no game");
      if (state.phase === "scored") break;
      if (state.phase === "playing" && state.turn === 0) {
        // select card by card (each a re-render, as a player's taps are), then play or pass
        const cards = await page.evaluate(() => window.__tally.store.view.legal[0]?.cards ?? null);
        if (cards) {
          for (const c of cards) {
            await page.evaluate((v) => window.__tally.store.toggleCard(v), c);
            await sleep(120);
          }
          await page.evaluate((cs) => window.__tally.act({ type: "PLAY", player: 0, cards: cs }), cards);
        } else {
          await page.evaluate(() => window.__tally.act({ type: "PASS", player: 0 }));
        }
        await sleep(300);
        continue;
      }
      await sleep(100);
      if (Date.now() - t0 > 240000) throw new Error("round did not finish in 240 s");
    }
    if (r < ROUNDS - 1) {
      await sleep(1500);
      await page.evaluate(() => window.__tally.act({ type: "NEXT_ROUND", seed: 1000 + window.__tally.game.round }));
    }
  }
  const report = await page.evaluate(() => window.__perf.report());
  await browser.close();
  return { report, errors };
}

const MAX_IOS_DRAWS = 60;
const results = {};
let failed = 0;
const gate = (ok, msg) => {
  console.log(`${ok ? "  ok " : "FAIL "} ${msg}`);
  if (!ok) failed++;
};
for (const dev of DEVICES.filter((d) => !process.env.ONLY || d.name.includes(process.env.ONLY))) {
  try {
    const { report: p, errors } = await run(dev);
    results[dev.name] = p;
    console.log(
      `${dev.name.padEnd(18)} ${p.seconds}s  fps ${p.fps}  drawn ${p.drawn}/${p.frames}  ` +
        `interval p95 ${p.interval.p95} max ${p.interval.max}  work p50 ${p.work.p50} p95 ${p.work.p95} p99 ${p.work.p99} max ${p.work.max}  ` +
        `draws p50 ${p.drawCalls.p50} max ${p.drawCalls.max}  uploads ${p.uploads.total} (${(p.uploads.bytes / 1e6).toFixed(1)} MB, ${p.uploads.inFramesOver16ms} in slow frames)  ` +
        `long ${p.longTasks.count} (max ${p.longTasks.maxMs} ms)  hitches ${p.hitches}  ai p50 ${p.ai.p50} max ${p.ai.max} (${p.ai.count})  act p50 ${p.act.p50} p95 ${p.act.p95} max ${p.act.max} (${p.act.count})` +
        (errors.length ? `  ERRORS ${errors.length}: ${errors[0]}` : ""),
    );
    gate(p.ai.count === 0, `[${dev.name}] no AI move computed on the main thread (${p.ai.count})`);
    gate(errors.length === 0, `[${dev.name}] no page errors (${errors.length})`);
    if (dev.mobile) gate(p.drawCalls.max <= MAX_IOS_DRAWS, `[${dev.name}] draw calls per frame ${p.drawCalls.max} <= ${MAX_IOS_DRAWS} (one texture per batch on iOS)`);
  } catch (e) {
    console.log(`${dev.name}: FAILED ${e.message}`);
    failed++;
  }
}
writeFileSync(`${OUT}${LABEL}.json`, JSON.stringify(results, null, 2));
console.log(`→ e2e/perf/${LABEL}.json`);
process.exit(failed ? 1 : 0);
