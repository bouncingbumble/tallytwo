// The end-to-end test: one round played through the real canvas, in headless Chromium, on two
// profiles — an iPhone SE held sideways (667x375, touch) and a 1280x800 desktop
// window. It starts its own Vite dev server, so nothing else needs to be running.
//
//   npm i --no-save playwright      (once; the Chromium build must match the installed Playwright)
//   npm run e2e
//
// A canvas has no DOM to query, so the game is read through the dev-only hook window.__tally
// (src/main.ts): `game` (the engine state), `store`, `settings`, `sheet`, `phaser` and `probe()`,
// which reports the fit, the running scenes, the hand's card rects, every registered control's
// rect (src/phaser/probe.ts) and every visible text's size, all in logical px.
//
// Per profile: the canvas fills the viewport at k = innerHeight / 440; no text under 11 CSS px
// and no control under 44x44 CSS px on the title, How to play, Settings, the table and the
// poster; Settings opened from the title shows Done (not Quit game) and a switch is saved to
// localStorage; a tap skips the deal; ?seed=3 deals seat 0 the 3♦ leftmost in a 13-card fan of
// 96x128 cards at whole logical px; a swipe paints a selection and a swipe from a selected card
// clears it; a flick plays the selected 3♦; a lost WebGL context pauses the table and a restored
// one draws again. The rest of the round is played through the store (no think delays), the
// poster's deltas sum to zero, and Next round deals round 2. No console errors or warnings
// (Playwright's Chromium cannot decode AAC, so "audio: ... dropped" warnings are not counted).
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const PORT = 5199;
const base = `http://localhost:${PORT}`;
const LOGICAL_H = 440;
const MIN_TEXT_PX = 11;
const MIN_TAP_PX = 44;
const PROFILES = [
  { name: "phone", viewport: { width: 667, height: 375 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  { name: "desktop", viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r2 = (n) => Math.round(n * 100) / 100;
const findings = [];
const note = (dev, msg, ok = true) => {
  findings.push({ dev, ok, msg });
  console.log(`${ok ? "  ok " : "FAIL "} [${dev}] ${msg}`);
};

const probe = (page) => page.evaluate(() => window.__tally.probe());
const game = (page) =>
  page.evaluate(() => {
    const g = window.__tally.game;
    return g && { phase: g.phase, turn: g.turn, round: g.round, counts: g.players.map((p) => p.hand.length), totals: g.totals, history: g.history.length };
  });
const sheet = (page) => page.evaluate(() => window.__tally.sheet.get());
const selection = (page) => page.evaluate(() => [...window.__tally.store.view.selection]);
/** Poll `read` until `ok(value)` or 3 s pass; return the last value. */
async function until(read, ok) {
  let v = await read();
  for (let i = 0; i < 60 && !ok(v); i++, v = await read()) await sleep(50);
  return v;
}

/** Wait until control `id` is registered, visible and enabled; return its rect (logical px). */
async function waitTarget(page, id, timeout = 15000) {
  const t0 = Date.now();
  for (;;) {
    const p = await probe(page);
    const t = p.targets[id];
    if (t?.visible && t.enabled) return t;
    if (Date.now() - t0 > timeout) throw new Error(`control ${id} never became live (scenes: ${p.scenes})`);
    await sleep(50);
  }
}

/** Tap a control at its centre, once it is live (a control takes input from the frame after it is made). */
async function tap(page, id, k) {
  await waitTarget(page, id);
  await sleep(150);
  const t = await waitTarget(page, id);
  await page.mouse.click((t.x + t.w / 2) * k, (t.y + t.h / 2) * k);
}

/**
 * Press at path[0] (logical px), move through the rest, release, as mouse events dispatched in one
 * synchronous run. A software-rendered frame here can take longer than GESTURE.holdMs, so moves
 * sent one by one from outside the page would be read as a hold. Returns the selection after
 * the move to path[readAt].
 */
const gesture = (page, k, path, readAt = -1) =>
  page.evaluate(
    ({ path, k, readAt }) => {
      const canvas = document.querySelector("#root canvas");
      const ev = (target, type, [x, y]) => target.dispatchEvent(new MouseEvent(type, { clientX: x * k, clientY: y * k, button: 0, buttons: type === "mouseup" ? 0 : 1, bubbles: true, cancelable: true }));
      let read = null;
      ev(canvas, "mousedown", path[0]);
      path.slice(1).forEach((pt, i) => {
        ev(canvas, "mousemove", pt);
        if (i + 1 === readAt) read = [...window.__tally.store.view.selection];
      });
      ev(window, "mouseup", path.at(-1));
      return read;
    },
    { path, k, readAt },
  );

async function checkSizes(page, dev, screen, k) {
  const p = await probe(page);
  const small = p.texts.filter((t) => t.px * k < MIN_TEXT_PX - 0.05);
  const taps = Object.entries(p.targets).filter(([, t]) => t.visible && (t.w * k < MIN_TAP_PX - 0.5 || t.h * k < MIN_TAP_PX - 0.5));
  note(dev, `${screen}: no text under ${MIN_TEXT_PX} CSS px${small.length ? " :: " + small.slice(0, 6).map((t) => `"${t.text}" ${r2(t.px * k)}px`).join(" | ") : ""}`, small.length === 0);
  note(dev, `${screen}: no control under ${MIN_TAP_PX}x${MIN_TAP_PX} CSS px${taps.length ? " :: " + taps.map(([id, t]) => `${id} ${r2(t.w * k)}x${r2(t.h * k)}`).join(" | ") : ""}`, taps.length === 0);
}

async function titleScreens(page, dev, k) {
  const fit = await page.evaluate(() => {
    const r = document.querySelector("#root canvas").getBoundingClientRect();
    return { w: r.width, h: r.height, x: r.left, y: r.top, iw: innerWidth, ih: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight };
  });
  const p = await probe(page);
  note(dev, `canvas is the viewport (${r2(fit.w)}x${r2(fit.h)}), k ${r2(p.k)}, nothing scrolls`, Math.abs(fit.w - fit.iw) <= 1 && Math.abs(fit.h - fit.ih) <= 1 && fit.x === 0 && fit.y === 0 && Math.abs(p.k - k) < 1e-6 && fit.sw <= fit.iw + 1 && fit.sh <= fit.ih + 1);
  await checkSizes(page, dev, "title", k);

  await tap(page, "title.howto", k);
  await waitTarget(page, "howto.close");
  await sleep(300);
  await checkSizes(page, dev, "how to play", k);
  await page.mouse.click(4 * k, (LOGICAL_H / 2) * k); // the dim outside the panel
  note(dev, "a tap on the dim closes How to play", (await until(() => sheet(page), (v) => v === "none")) === "none");

  await tap(page, "title.settings", k);
  await waitTarget(page, "settings.switch.Straights may wrap");
  await sleep(300);
  await checkSizes(page, dev, "settings", k);
  const targets = (await probe(page)).targets;
  note(dev, "Settings from the title shows Done, not Quit game", !!targets["settings.done"] && !targets["settings.back"]);
  const before = await page.evaluate(() => window.__tally.settings.rules.straightWrap);
  await tap(page, "settings.switch.Straights may wrap", k);
  const after = await until(() => page.evaluate(() => window.__tally.settings.rules.straightWrap), (v) => v !== before);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("tallytwo.settings") ?? "{}").rules?.straightWrap);
  note(dev, `a switch flips (${before} -> ${after}) and is saved to localStorage (${stored})`, before !== after && stored === after);
  await tap(page, "settings.switch.Straights may wrap", k);
  await tap(page, "settings.close", k);
  note(dev, "the ✕ closes Settings", (await until(() => sheet(page), (v) => v === "none")) === "none");
}

async function dealAndHand(page, dev, k) {
  await tap(page, "title.deal", k);
  for (let i = 0; i < 100 && !(await probe(page)).table?.dealing; i++) await sleep(20);
  const f = (await probe(page)).table.felt;
  await page.mouse.click((f.x + f.w / 2) * k, (f.y + f.h / 2) * k);
  const dealt = await until(() => probe(page), (q) => !q.table.dealing && q.targets["table.play"]?.visible);
  note(dev, "a tap finishes the deal", !dealt.table.dealing);
  await sleep(500); // the hand's last glide to rest
  const p = await probe(page);
  const hand = p.table.hand;
  const g = await game(page);
  note(dev, `seed 3: 13 cards, seat 0 leads with the 3♦ leftmost`, hand.length === 13 && g.turn === 0 && hand[0].value === 0);
  note(dev, "every hand card is 96x128 logical px at a whole-px rest", hand.every((c) => c.w === 96 && c.h === 128 && Number.isInteger(c.x) && Number.isInteger(c.y)));
  const step = hand[1].x - hand[0].x;
  const fan = p.table.fan;
  note(dev, `the fan steps ${step} logical px (>= 34) and fits its strip`, step >= 34 && hand[0].x >= fan.x && hand.at(-1).x + 96 <= fan.x + fan.w);
  await checkSizes(page, dev, "table", k);

  // a swipe across three cards selects three; sliding back one un-paints it
  const at = (i) => hand[i].x + 10;
  const y = hand[0].y + 100;
  const mid = await gesture(page, k, [[at(0), y], [at(2), y], [at(1), y]], 1);
  const sel = await until(() => selection(page), (s) => s.length === 2);
  note(dev, `a swipe selects ${mid.length} across three cards, ${sel.length} after sliding back`, mid.length === 3 && sel.length === 2);
  await gesture(page, k, [[at(0), y], [at(1), y]]);
  note(dev, "a swipe from a selected card deselects", (await until(() => selection(page), (s) => s.length === 0)).length === 0);

  // a flick: tap the 3♦ (a legal opening lead), then drag it up onto the felt
  await page.mouse.click(at(0) * k, y * k);
  await until(() => page.evaluate(() => window.__tally.store.view.exact !== null), Boolean);
  await sleep(300); // the selected card's lift
  const lifted = (await probe(page)).table.hand[0];
  await gesture(page, k, [[lifted.x + 10, lifted.y + 80], [lifted.x + 10, lifted.y + 20], [lifted.x + 10, lifted.y - 40]]);
  const g2 = await until(() => game(page), (g) => g.history > 0);
  note(dev, `a flick plays the selected 3♦ (${g2.counts[0]} cards left)`, g2.history > 0 && g2.counts[0] === 12);
}

/** A lost WebGL context pauses the table; on restore it unpauses and draws a real frame. */
async function contextLoss(page, dev) {
  const r = await page.evaluate(async () => {
    const ph = window.__tally.phaser;
    const ext = ph.renderer.gl?.getExtension("WEBGL_lose_context");
    if (!ext) return null;
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    ext.loseContext();
    await wait(300);
    const pausedWhileLost = window.__tally.store.view.paused;
    const drawn = new Promise((resolve) => {
      ph.events.once("postrender", () => {
        const c = document.createElement("canvas");
        c.width = 64;
        c.height = 32;
        const g = c.getContext("2d");
        g.drawImage(ph.canvas, 0, 0, 64, 32);
        const d = g.getImageData(0, 0, 64, 32).data;
        const lum = [];
        for (let i = 0; i < d.length; i += 4) lum.push(d[i] + d[i + 1] + d[i + 2]);
        const mean = lum.reduce((a, b) => a + b, 0) / lum.length;
        resolve(Math.sqrt(lum.reduce((a, b) => a + (b - mean) ** 2, 0) / lum.length));
      });
    });
    ext.restoreContext();
    const spread = await Promise.race([drawn, wait(3000).then(() => 0)]);
    await wait(200);
    return { pausedWhileLost, pausedAfter: window.__tally.store.view.paused, spread };
  });
  if (!r) return note(dev, "context loss: WEBGL_lose_context not available (skipped)");
  note(dev, `context loss: paused while lost, running and drawing after restore (spread ${Math.round(r.spread)})`, r.pausedWhileLost && !r.pausedAfter && r.spread > 10);
}

/** Play the rest of the round through the store: the human leads with its first legal move, the AIs move at once. */
async function finishRound(page, dev, k) {
  await page.evaluate(() => {
    const s = window.__tally.store;
    for (let i = 0; i < 600 && s.game?.phase === "playing"; i++) {
      const g = s.game;
      if (g.turn !== 0) s.actAi(g.turn, "medium");
      else {
        const legal = s.view.legal;
        s.act(legal.length ? { type: "PLAY", player: 0, cards: legal[0].cards } : { type: "PASS", player: 0 });
      }
    }
  });
  await waitTarget(page, "poster.next", 20000);
  const g = await game(page);
  const sum = g.totals.reduce((a, b) => a + b, 0);
  note(dev, `round 1 scored: deltas ${g.totals.join("/")} sum to ${sum}`, g.phase === "scored" && sum === 0);
  await sleep(300);
  await checkSizes(page, dev, "poster", k);
  await tap(page, "poster.next", k);
  const g2 = await until(() => game(page), (g) => g.round === 2);
  note(dev, `Next round deals round 2 (${g2.counts.join("/")} cards)`, g2.round === 2 && g2.counts.every((n) => n === 13));
}

async function runProfile(browser, { name, ...ctxOpts }) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text());
  });
  await page.addInitScript(() => localStorage.setItem("tallytwo.settings", JSON.stringify({ opts: { gameSpeed: "fast", hints: true, swipeHintSeen: true } })));
  await page.goto(`${base}/?seed=3`);
  await waitTarget(page, "title.deal", 30000);
  const k = ctxOpts.viewport.height / LOGICAL_H;
  try {
    await titleScreens(page, name, k);
    await dealAndHand(page, name, k);
    await contextLoss(page, name);
    await finishRound(page, name, k);
  } catch (e) {
    note(name, `threw: ${e.message}`, false);
  }
  const real = errors.filter((e) => !/audio: .* (unavailable|dropped)|Unable to decode audio data|\[vite\]|GL Driver|GPU stall|WebGL/.test(e));
  note(name, `no console errors or warnings${real.length ? " :: " + real.slice(0, 5).join(" || ") : ""}`, real.length === 0);
  await ctx.close();
}

const root = fileURLToPath(new URL("..", import.meta.url));
const server = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], { cwd: root, stdio: "ignore", detached: true });
const stop = () => {
  try {
    process.kill(-server.pid);
  } catch {}
};
process.on("exit", stop);
let ok = false;
for (let i = 0; i < 100 && !ok; i++) {
  ok = await fetch(base).then((r) => r.ok, () => false);
  if (!ok) await sleep(100);
}
if (!ok) {
  console.error(`the dev server did not come up on ${base}`);
  process.exit(1);
}

const t0 = Date.now();
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
// one profile at a time: two software-rendered canvases at once starve the main thread, and a
// swipe whose first move arrives after GESTURE.holdMs is read as a hold
for (const p of PROFILES) await runProfile(browser, p);
await browser.close();
const fails = findings.filter((f) => !f.ok).length;
console.log(`\n${fails ? "✗" : "✓"} ${findings.length} checks, ${fails} failed, in ${Math.round((Date.now() - t0) / 1000)} s`);
process.exit(fails ? 1 : 0);
