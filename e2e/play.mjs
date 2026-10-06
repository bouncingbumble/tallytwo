// The device-mode gates, scripted. Plays rounds through the real UI
// (Hint -> Play, or Pass) in WebKit at iPhone SE (667x375 @2) and iPhone 15 (852x393 @3), sideways,
// geometry, then once in Chromium, reading the game only through the DEV hook window.__tally.
//
//   npm run dev                                     (in another terminal)
//   npm i --no-save playwright && npx playwright install webkit chromium
//   node e2e/play.mjs http://localhost:5173 2       (rounds per device, default 2)
//
// Checks: 13 cards dealt; ?seed=3 gives seat 0 the 3♦; every card's rest transform is a whole
// CSS px; cards are 96x128; the 13-card fan steps >= 34 px and fits the strip; nothing scrolls;
// every poster's deltas sum to zero and totals carry; settings from the title show no
// "Quit game"; a switch flips; localStorage is written; ?dev=spike renders; no console errors.
// Playwright's Chromium has no AAC decoder, so its "audio: ... dropped" warnings are reported
// but not counted (the port degrades to silent events by design; real Chrome decodes AAC).
import { chromium, webkit } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.argv[2] || "http://localhost:5173";
const ROUNDS = Number(process.argv[3]) || 2;
const OUT = new URL("./shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const DEVICES = [
  // held sideways: the game is landscape-only
  { name: "se", viewport: { width: 667, height: 375 }, deviceScaleFactor: 2 },
  { name: "i15", viewport: { width: 852, height: 393 }, deviceScaleFactor: 3 },
];
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const note = (dev, msg, ok = true) => {
  findings.push({ dev, ok, msg });
  console.log(`${ok ? "  ok " : "FAIL "} [${dev}] ${msg}`);
};

const game = (page) =>
  page.evaluate(() => {
    const g = window.__tally?.game;
    return g ? { phase: g.phase, turn: g.turn, round: g.round, counts: g.players.map((p) => p.hand.length), totals: g.totals, history: g.history.length, seed: g.seed } : null;
  });

async function playRound(page, shots) {
  const t0 = Date.now();
  let shotMid = false;
  for (;;) {
    const g = await game(page);
    if (!g) throw new Error("no game (is this a dev build? window.__tally is DEV-only)");
    if (g.phase === "scored") return g;
    if (g.phase === "playing" && g.turn === 0) {
      const hint = page.locator(".controls button", { hasText: "Hint" });
      const play = page.locator(".controls button", { hasText: "Play" });
      const pass = page.locator(".controls button", { hasText: "Pass" });
      if (await hint.isEnabled()) {
        await hint.click();
        await sleep(60);
        if (await play.isEnabled()) {
          if (!shotMid && g.history > 3) {
            await page.screenshot({ path: `${shots}/table-midround.png` });
            shotMid = true;
          }
          await play.click();
          await sleep(120);
          continue;
        }
      }
      if (await pass.isEnabled()) {
        await pass.click();
        await sleep(120);
        continue;
      }
      await sleep(250);
      continue;
    }
    await sleep(150);
    if (Date.now() - t0 > 120000) throw new Error("round did not finish in 120 s");
  }
}

async function runDevice(browserType, dev, label) {
  const browser = await browserType.launch();
  const ctx = await browser.newContext({ viewport: dev.viewport, deviceScaleFactor: dev.deviceScaleFactor, isMobile: true, hasTouch: true, userAgent: UA });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text());
  });
  const shots = `${OUT}${label}`;
  mkdirSync(shots, { recursive: true });

  // The table is deliberately slow at 1x (BASE_TIME_SCALE); run the gates at 4x, fast pace.
  await page.addInitScript(() => {
    localStorage.setItem("tallytwo.settings", JSON.stringify({ opts: { speed: "fast", speedMultiplier: 4 } }));
  });

  await page.goto(`${base}/?seed=3`, { waitUntil: "networkidle" });
  await page.waitForSelector(".title", { timeout: 15000 });
  await page.screenshot({ path: `${shots}/title.png` });
  note(label, "title screen rendered");

  await page.getByRole("button", { name: "How to play" }).click();
  await page.waitForSelector(".howto");
  await page.screenshot({ path: `${shots}/howto.png` });
  await page.getByRole("button", { name: "Got it" }).click();

  await page.getByRole("button", { name: "Deal me in" }).click();
  await page.waitForSelector(".table", { timeout: 10000 });
  await sleep(1400);
  const cards = await page.locator(".hand .card").count();
  note(label, `13 cards in hand (got ${cards})`, cards === 13);
  const g0 = await game(page);
  const first = await page.locator(".hand .card").first().getAttribute("aria-label");
  note(label, `seed 3: seat ${g0?.turn} leads; leftmost card is the 3♦`, g0?.turn === 0 && first === "Three of Diamonds");
  await page.screenshot({ path: `${shots}/table-dealt.png` });

  const rest = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".hand .card")];
    const xs = els.map((el) => {
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return { x: m.e, y: m.f };
    });
    const lefts = els.map((el) => el.getBoundingClientRect().left);
    const rights = els.map((el) => el.getBoundingClientRect().right);
    const hand = document.querySelector(".hand").getBoundingClientRect();
    const c = document.querySelector(".controls").getBoundingClientRect();
    const step = els.length > 1 ? xs[1].x - xs[0].x : 0;
    return { xs, step, span: Math.max(...rights) - Math.min(...lefts), handW: hand.width, handBottom: hand.bottom, w: els[0]?.getBoundingClientRect().width, h: els[0]?.getBoundingClientRect().height, bottom: c.bottom, scroll: document.documentElement.scrollHeight, inner: innerHeight };
  });
  note(label, `card rest transforms are whole CSS px (${rest.xs.slice(0, 3).map((p) => p.x + "," + p.y).join(" | ")} ...)`, rest.xs.every((p) => Number.isInteger(p.x) && Number.isInteger(p.y)));
  note(label, `card is 96x128 CSS px (got ${rest.w}x${rest.h})`, rest.w === 96 && rest.h === 128);
  note(label, `13-card fan: step ${rest.step} px (>= 34 sideways), span ${rest.span} <= strip ${Math.round(rest.handW)}`, rest.step >= 34 && rest.span <= rest.handW + 0.5);
  note(label, `fits: hand bottom ${Math.round(rest.handBottom)}, buttons bottom ${Math.round(rest.bottom)} <= ${rest.inner}, scrollHeight ${rest.scroll}`, rest.handBottom <= rest.inner + 0.5 && rest.bottom <= rest.inner + 0.5 && rest.scroll <= rest.inner + 1);

  for (let r = 1; r <= ROUNDS; r++) {
    await playRound(page, shots);
    await page.waitForSelector(".poster", { timeout: 10000 });
    const deltas = await page.evaluate(() => [...document.querySelectorAll(".poster tbody tr")].map((tr) => Number(tr.children[2].textContent.replace("+", ""))));
    const sum = deltas.reduce((a, b) => a + b, 0);
    note(label, `round ${r} poster: deltas ${deltas.join("/")} sum ${sum}`, deltas.length === 4 && sum === 0);
    if (r === 1) {
      await sleep(700); // let the poster's entry animation finish before the shot
      await page.screenshot({ path: `${shots}/poster.png` });
    }
    if (r < ROUNDS) {
      await page.getByRole("button", { name: "Next round" }).click();
      await page.waitForSelector(".poster", { state: "detached" });
      await sleep(1200);
      const g = await game(page);
      note(label, `round ${g.round} dealt, totals ${g.totals.join("/")} sum ${g.totals.reduce((a, b) => a + b, 0)}`, g.round === r + 1 && g.totals.reduce((a, b) => a + b, 0) === 0);
    }
  }

  await page.getByRole("button", { name: "Saddle up" }).click();
  await page.waitForSelector(".title");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.waitForSelector(".sheet");
  await page.screenshot({ path: `${shots}/settings.png` });
  note(label, "settings from the title shows no Quit game", (await page.getByRole("button", { name: "Quit game" }).count()) === 0);
  const sw = page.locator('[role="switch"]').first();
  const before = await sw.getAttribute("aria-checked");
  await sw.click();
  const after = await sw.getAttribute("aria-checked");
  note(label, `first switch flips ${before} -> ${after}`, before !== after);
  await sw.click();
  await page.getByRole("button", { name: "Done" }).click();
  const stored = await page.evaluate(() => localStorage.getItem("tallytwo.settings"));
  note(label, `localStorage tallytwo.settings written (${stored ? stored.length : 0} chars)`, !!stored);

  await page.goto(`${base}/?dev=spike`, { waitUntil: "networkidle" });
  await sleep(500);
  await page.screenshot({ path: `${shots}/spike.png` });
  note(label, "spike page rendered");

  const codec = errors.filter((e) => /audio: .* unavailable|Unable to decode audio data/.test(e));
  const real = errors.filter((e) => !codec.includes(e) && !/\[vite\]|HMR|React DevTools/.test(e));
  if (codec.length) note(label, `${codec.length} audio decode warnings (no AAC decoder in this browser build; events stay silent by design)`);
  note(label, `console errors/warnings: ${real.length}${real.length ? " :: " + real.slice(0, 5).join(" || ") : ""}`, real.length === 0);
  await browser.close();
}

for (const dev of DEVICES) await runDevice(webkit, dev, `webkit-${dev.name}`);
await runDevice(chromium, DEVICES[1], "chromium-i15");

const fails = findings.filter((f) => !f.ok);
writeFileSync(`${OUT}findings.json`, JSON.stringify(findings, null, 2));
console.log(`\n${fails.length === 0 ? "✓" : "✗"} ${findings.length} checks, ${fails.length} failed. Screenshots in ${OUT}`);
process.exit(fails.length ? 1 : 0);
