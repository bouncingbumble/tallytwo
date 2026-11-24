// The device-mode gates, scripted, for the Phaser build. Plays rounds through the real canvas
// (taps on cards, Play, Pass, Next round) in WebKit at iPhone SE (667x375 @2, and 667x331 —
// Safari's toolbars showing, k = 0.75) and iPhone 15 (852x393 @3), sideways, and in Chromium at
// a 1280x800 @2 desktop window. A canvas has no DOM to query, so the game is read only through
// the DEV hook window.__tally: `game` (the engine state), `store`, and `probe()`, which reports
// the fit (k, logical width), the running scenes, the hand's card rects and every registered
// control's rect in logical px (src/phaser/probe.ts), and every visible text's size.
//
//   npm run dev                                     (in another terminal; port 5180)
//   npm i --no-save playwright && npx playwright install webkit chromium
//   node e2e/play.mjs http://localhost:5180 2       (rounds per device, default 2)
//
// Checks: the canvas fills the viewport; k = innerHeight / 440; 13 cards dealt and ?seed=3 gives
// seat 0 the 3♦ leftmost; a hand card is 96 x 128 logical px (96k x 128k CSS px); the 13-card fan
// steps >= 34 logical px and fits the strip; rest positions are whole logical px; a drag reorders
// the hand and selects nothing; every poster's deltas sum to zero and totals carry; settings from
// the title show no "Quit game"; a switch flips and the settings are written to localStorage; no
// console errors. Size floors (src/phaser/theme.ts) on every screen: no text under MIN_TEXT_PX and
// no registered control under MIN_TAP_PX, both in physical CSS px. Playwright's Chromium has no
// AAC decoder, so its "audio: ... dropped" warnings are reported but not counted.
import { chromium, webkit } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.argv[2] || "http://localhost:5180";
const ROUNDS = Number(process.argv[3]) || 2;
const OUT = new URL("./shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const LOGICAL_H = 440;
const MIN_TEXT_PX = 11;
const MIN_TAP_PX = 44;

const DEVICES = [
  { name: "se", viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, mobile: true },
  { name: "se-safari", viewport: { width: 667, height: 331 }, deviceScaleFactor: 2, mobile: true },
  { name: "i15", viewport: { width: 852, height: 393 }, deviceScaleFactor: 3, mobile: true },
  { name: "desktop", viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, mobile: false },
];
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
const note = (dev, msg, ok = true) => {
  findings.push({ dev, ok, msg });
  console.log(`${ok ? "  ok " : "FAIL "} [${dev}] ${msg}`);
};
const r2 = (n) => Math.round(n * 100) / 100;

const probe = (page) => page.evaluate(() => window.__tally?.probe?.());
const game = (page) =>
  page.evaluate(() => {
    const g = window.__tally?.game;
    return g ? { phase: g.phase, turn: g.turn, round: g.round, counts: g.players.map((p) => p.hand.length), totals: g.totals, history: g.history.length, seed: g.seed } : null;
  });

/** Wait until `id` is registered and visible; return its rect (logical px). */
async function waitTarget(page, id, timeout = 10000) {
  const t0 = Date.now();
  for (;;) {
    const p = await probe(page);
    const t = p?.targets?.[id];
    if (t && t.visible) return t;
    if (Date.now() - t0 > timeout) throw new Error(`target ${id} never appeared (scenes: ${p?.scenes})`);
    await sleep(100);
  }
}

/** Tap a registered control at its centre. */
async function tap(page, id, k) {
  await waitTarget(page, id);
  // a control created this frame takes input from the next one: give a freshly started scene a beat
  await sleep(600);
  const t = await waitTarget(page, id);
  await page.mouse.click((t.x + t.w / 2) * k, (t.y + t.h / 2) * k);
}

async function playRound(page, k, shots) {
  const t0 = Date.now();
  let shotMid = false;
  for (;;) {
    const g = await game(page);
    if (!g) throw new Error("no game (is this a dev build? window.__tally is DEV-only)");
    if (g.phase === "scored") return g;
    if (g.phase === "playing" && g.turn === 0) {
      // choose a move the way Hint would, then make it with taps on the canvas
      const move = await page.evaluate(() => {
        const v = window.__tally.store.view;
        return v.legal.length ? v.legal[0].cards : null;
      });
      const p = await probe(page);
      if (move && p.table) {
        await page.evaluate(() => window.__tally.store.setSelection([]));
        for (const c of move) {
          const r = p.table.hand.find((h) => h.value === c);
          // tap the card's visible strip: its left edge, which no later card covers
          await page.mouse.click((r.x + 10) * k, (r.y + 100) * k);
          await sleep(40);
        }
        await sleep(200);
        const sel = await page.evaluate(() => window.__tally.store.view.exact !== null);
        if (sel) {
          if (!shotMid && g.history > 3) {
            await page.screenshot({ path: `${shots}/table-midround.png` });
            shotMid = true;
          }
          await tap(page, "table.play", k);
          await sleep(150);
          continue;
        }
      }
      const pass = (await probe(page)).targets["table.pass"];
      if (pass?.enabled) {
        await tap(page, "table.pass", k);
        await sleep(150);
        continue;
      }
      await sleep(250);
      continue;
    }
    await sleep(150);
    if (Date.now() - t0 > 180000) throw new Error("round did not finish in 180 s");
  }
}

async function checkSizes(page, label, screen, k) {
  const p = await probe(page);
  const small = p.texts.filter((t) => t.px * k < MIN_TEXT_PX - 0.05);
  const taps = Object.entries(p.targets).filter(([, t]) => t.visible && (t.w * k < MIN_TAP_PX - 0.5 || t.h * k < MIN_TAP_PX - 0.5));
  note(label, `${screen}: no text under ${MIN_TEXT_PX} CSS px (${p.texts.length} texts)${small.length ? " :: " + small.slice(0, 6).map((t) => `"${t.text}" ${r2(t.px * k)}px`).join(" | ") : ""}`, small.length === 0);
  note(label, `${screen}: no control under ${MIN_TAP_PX}x${MIN_TAP_PX} CSS px${taps.length ? " :: " + taps.map(([id, t]) => `${id} ${r2(t.w * k)}x${r2(t.h * k)}`).join(" | ") : ""}`, taps.length === 0);
}

async function runDevice(browserType, dev, label) {
  const browser = await browserType.launch(browserType === chromium ? { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } : {});
  const ctx = await browser.newContext({
    viewport: dev.viewport,
    deviceScaleFactor: dev.deviceScaleFactor,
    ...(dev.mobile ? { isMobile: true, hasTouch: true, userAgent: UA } : {}),
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text());
  });
  const shots = `${OUT}${label}`;
  mkdirSync(shots, { recursive: true });

  await page.addInitScript(() => {
    localStorage.setItem("tallytwo.settings", JSON.stringify({ opts: { gameSpeed: "fast", hints: true } }));
  });
  await page.goto(`${base}/?seed=3`, { waitUntil: "networkidle" });
  await waitTarget(page, "title.deal", 20000);
  await sleep(300);
  await page.screenshot({ path: `${shots}/title.png` });
  note(label, "title screen rendered");

  const fit = await page.evaluate(() => {
    const c = document.querySelector("#root canvas");
    const r = c.getBoundingClientRect();
    return { w: r.width, h: r.height, x: r.left, y: r.top, inner: { w: innerWidth, h: innerHeight }, scroll: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight } };
  });
  const p0 = await probe(page);
  const k = fit.inner.h / LOGICAL_H;
  note(
    label,
    `canvas is the viewport: ${r2(fit.w)}x${r2(fit.h)} at ${fit.x},${fit.y} vs ${fit.inner.w}x${fit.inner.h}; k ${r2(p0.k)} (expected ${r2(k)}), ${r2(p0.logicalWidth)} logical px wide; nothing scrolls`,
    Math.abs(fit.w - fit.inner.w) <= 1 && Math.abs(fit.h - fit.inner.h) <= 1 && fit.x === 0 && fit.y === 0 && Math.abs(p0.k - k) < 1e-6 && fit.scroll.w <= fit.inner.w + 1 && fit.scroll.h <= fit.inner.h + 1,
  );
  await checkSizes(page, label, "title", k);

  await tap(page, "title.howto", k);
  await waitTarget(page, "howto.gotIt");
  await sleep(300);
  await page.screenshot({ path: `${shots}/howto.png` });
  await checkSizes(page, label, "how to play", k);
  await page.evaluate(() => window.__tally.sheet.set("none")); // "Got it" sits below the fold on a short canvas

  await tap(page, "title.deal", k);
  await waitTarget(page, "table.play");
  await sleep(2000);
  const p1 = await probe(page);
  const hand = p1.table.hand;
  note(label, `13 cards in hand (got ${hand.length})`, hand.length === 13);
  const g0 = await game(page);
  note(label, `seed 3: seat ${g0?.turn} leads; leftmost card is the 3♦`, g0?.turn === 0 && hand[0].value === 0);
  await page.screenshot({ path: `${shots}/table-dealt.png` });
  await checkSizes(page, label, "table", k);
  note(label, `hand card is 96 x 128 logical = ${r2(96 * k)}x${r2(128 * k)} CSS px`, hand.every((c) => c.w === 96 && c.h === 128));
  const step = hand[1].x - hand[0].x;
  const span = hand.at(-1).x + 96 - hand[0].x;
  const fan = p1.table.fan;
  note(label, `13-card fan: step ${step} logical px (>= 34), span ${span} <= strip ${fan.w}, inside ${fan.x}-${fan.x + fan.w}`, step >= 34 && span <= fan.w && hand[0].x >= fan.x && hand.at(-1).x + 96 <= fan.x + fan.w);
  note(label, `card rest positions are whole logical px (${hand.slice(0, 3).map((c) => c.x + "," + c.y).join(" | ")} ...)`, hand.every((c) => Number.isInteger(c.x) && Number.isInteger(c.y)));

  // drag the 3♦ (leftmost) to the right end of the fan, in screen px
  const c0 = hand[0];
  await page.mouse.move((c0.x + 16) * k, (c0.y + 64) * k);
  await page.mouse.down();
  await page.mouse.move((c0.x + 40) * k, (c0.y + 64) * k, { steps: 4 });
  await page.mouse.move((fan.x + fan.w - 20) * k, (c0.y + 64) * k, { steps: 12 });
  await page.mouse.up();
  await sleep(1200);
  const p2 = await probe(page);
  const sel = await page.evaluate(() => window.__tally.store.view.selection.length);
  note(label, `drag: the 3♦ dropped at the right end (rightmost now ${p2.table.hand.at(-1).value}); ${sel} selected; whole-px rest`, p2.table.hand.at(-1).value === 0 && sel === 0 && p2.table.hand.every((c) => Number.isInteger(c.x)));

  for (let r = 1; r <= ROUNDS; r++) {
    await playRound(page, k, shots);
    await waitTarget(page, "poster.next");
    const g = await game(page);
    const deltas = await page.evaluate(() => {
      const g = window.__tally.game;
      return g.totals.map((t, i) => t - (window.__prevTotals?.[i] ?? 0));
    });
    const sum = deltas.reduce((a, b) => a + b, 0);
    note(label, `round ${r} poster: deltas ${deltas.join("/")} sum ${sum}`, deltas.length === 4 && sum === 0);
    await page.evaluate(() => (window.__prevTotals = [...window.__tally.game.totals]));
    if (r === 1) {
      await sleep(700);
      await page.screenshot({ path: `${shots}/poster.png` });
      await checkSizes(page, label, "poster", k);
    }
    if (r < ROUNDS) {
      await tap(page, "poster.next", k);
      await sleep(2500);
      const g2 = await game(page);
      note(label, `round ${g2.round} dealt, totals ${g2.totals.join("/")} sum ${g2.totals.reduce((a, b) => a + b, 0)}`, g2.round === g.round + 1 && g2.totals.reduce((a, b) => a + b, 0) === 0);
    }
  }

  await tap(page, "poster.saddle", k);
  await waitTarget(page, "title.settings");
  await tap(page, "title.settings", k);
  await waitTarget(page, "settings.switch.Straights may wrap");
  await sleep(300);
  await page.screenshot({ path: `${shots}/settings.png` });
  await checkSizes(page, label, "settings", k);
  const p3 = await probe(page);
  note(label, "settings from the title shows no Quit game (Done instead)", !!p3.targets["settings.done"] && !p3.targets["settings.back"]);
  const before = await page.evaluate(() => window.__tally.settings.rules.straightWrap);
  await tap(page, "settings.switch.Straights may wrap", k);
  await sleep(200);
  const after = await page.evaluate(() => window.__tally.settings.rules.straightWrap);
  note(label, `first switch flips ${before} -> ${after}`, before !== after);
  await tap(page, "settings.switch.Straights may wrap", k);
  const stored = await page.evaluate(() => localStorage.getItem("tallytwo.settings"));
  note(label, `localStorage tallytwo.settings written (${stored ? stored.length : 0} chars)`, !!stored && stored.includes("straightWrap"));

  const codec = errors.filter((e) => /audio: .* (unavailable|dropped)|Unable to decode audio data/.test(e));
  const real = errors.filter((e) => !codec.includes(e) && !/\[vite\]|GL Driver|GPU stall|WebGL/.test(e));
  if (codec.length) note(label, `${codec.length} audio decode warnings (no AAC decoder in this browser build; events stay silent by design)`);
  note(label, `console errors/warnings: ${real.length}${real.length ? " :: " + real.slice(0, 5).join(" || ") : ""}`, real.length === 0);
  await browser.close();
}

const only = process.env.DEVICES ? process.env.DEVICES.split(",") : null;
for (const dev of DEVICES.filter((d) => d.mobile && (!only || only.includes(d.name)))) await runDevice(webkit, dev, `webkit-${dev.name}`);
for (const dev of DEVICES.filter((d) => !d.mobile && (!only || only.includes(d.name)))) await runDevice(chromium, dev, `chromium-${dev.name}`);

const fails = findings.filter((f) => !f.ok);
writeFileSync(`${OUT}findings.json`, JSON.stringify(findings, null, 2));
console.log(`\n${fails.length === 0 ? "✓" : "✗"} ${findings.length} checks, ${fails.length} failed. Screenshots in ${OUT}`);
process.exit(fails.length ? 1 : 0);
