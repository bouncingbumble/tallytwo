// Screenshot diffs (docs/MOBILE_UX_PLAN.md §9): a few still screens (JPEG q85, so the committed
// baselines stay small; the tolerance covers the codec), captured under reduced motion
// so nothing is mid-animation, compared with the committed baselines in e2e/baselines/. A pixel
// counts as changed when a channel moved more than CHANNEL_TOL; a screen fails when more than
// MAX_CHANGED of its pixels changed. The comparison runs inside the browser (canvas pixels), so
// nothing beyond Playwright is needed. A changed screen's diff (changed pixels in red over a
// faded copy) lands in e2e/shots/visual/.
//
//   npm run dev                                         (port 5180)
//   node e2e/visual.mjs http://localhost:5180           compare
//   UPDATE=1 node e2e/visual.mjs http://localhost:5180  re-baseline after an intended change
//
// The baselines are Chromium's (SwiftShader) at dpr 1: compare on the same browser build, and
// re-baseline when Playwright's Chromium changes. The iPhone geometry is emulated in Chromium too,
// since WebKit's text rasterising differs from Chromium's by more than a tolerance should hide.
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const base = process.argv[2] || "http://localhost:5180";
const UPDATE = process.env.UPDATE === "1";
const BASE_DIR = new URL("./baselines/", import.meta.url).pathname;
const OUT = new URL("./shots/visual/", import.meta.url).pathname;
mkdirSync(BASE_DIR, { recursive: true });
mkdirSync(OUT, { recursive: true });

const CHANNEL_TOL = 40;
const MAX_CHANGED = 0.005;
const LOGICAL_H = 440;
const DEVICES = [
  { name: "i15", viewport: { width: 852, height: 393 }, mobile: true },
  { name: "desktop", viewport: { width: 1280, height: 800 }, mobile: false },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const probe = (page) => page.evaluate(() => window.__tally?.probe?.());
async function waitTarget(page, id) {
  for (let i = 0; i < 200; i++) {
    const t = (await probe(page))?.targets?.[id];
    if (t?.visible) return t;
    await sleep(100);
  }
  throw new Error(`target ${id} never appeared`);
}
async function tap(page, id, k) {
  const t = await waitTarget(page, id);
  await sleep(400);
  await page.mouse.click((t.x + t.w / 2) * k, (t.y + t.h / 2) * k);
}

/** The fraction of pixels that changed between two PNGs (base64), and a diff image, computed in the page. */
async function compare(page, a, b) {
  return page.evaluate(
    async ({ a, b, tol }) => {
      const load = (src) =>
        new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = "data:image/jpeg;base64," + src;
        });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { changed: 1, size: `${ia.width}x${ia.height} vs ${ib.width}x${ib.height}` };
      const w = ia.width;
      const h = ia.height;
      const px = (img) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, w, h);
      };
      const da = px(ia).data;
      const db = px(ib).data;
      const out = new ImageData(w, h);
      let changed = 0;
      for (let i = 0; i < da.length; i += 4) {
        const diff = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
        if (diff > tol) {
          changed++;
          out.data.set([255, 0, 0, 255], i);
        } else out.data.set([da[i] / 3, da[i + 1] / 3, da[i + 2] / 3, 255], i);
      }
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").putImageData(out, 0, 0);
      return { changed: changed / (w * h), diff: c.toDataURL("image/png").split(",")[1] };
    },
    { a, b, tol: CHANNEL_TOL },
  );
}

let failed = 0;
for (const dev of DEVICES) {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext({ viewport: dev.viewport, deviceScaleFactor: 1, ...(dev.mobile ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("tallytwo.settings", JSON.stringify({ opts: { gameSpeed: "slow", hints: true, motion: "reduced", swipeHintSeen: true } }));
  });
  await page.goto(`${base}/?seed=3`, { waitUntil: "networkidle" });
  const k = dev.viewport.height / LOGICAL_H;
  const shots = [];
  const shoot = async (name) => {
    await sleep(700);
    shots.push({ name: `${dev.name}-${name}`, png: (await page.screenshot({ type: "jpeg", quality: 85 })).toString("base64") });
  };

  await waitTarget(page, "title.deal");
  await shoot("title");
  await tap(page, "title.settings", k);
  await waitTarget(page, "settings.done");
  await shoot("settings");
  await page.evaluate(() => window.__tally.sheet.set("none"));
  await tap(page, "title.deal", k);
  await waitTarget(page, "table.play");
  await shoot("table-dealt");
  // the 3♦ (seat 0 leads holding it on ?seed=3) selected: the lift, the ring, the glow, the dimming
  await page.evaluate(() => window.__tally.store.setSelection([0]));
  await shoot("table-selected");

  for (const s of shots) {
    const file = `${BASE_DIR}${s.name}.jpg`;
    if (UPDATE || !existsSync(file)) {
      writeFileSync(file, Buffer.from(s.png, "base64"));
      console.log(`  new  ${s.name} -> e2e/baselines/${s.name}.jpg`);
      continue;
    }
    const r = await compare(page, readFileSync(file).toString("base64"), s.png);
    const ok = r.changed <= MAX_CHANGED;
    if (!ok) {
      failed++;
      writeFileSync(`${OUT}${s.name}-now.jpg`, Buffer.from(s.png, "base64"));
      if (r.diff) writeFileSync(`${OUT}${s.name}-diff.png`, Buffer.from(r.diff, "base64"));
    }
    console.log(`${ok ? "  ok " : "FAIL "} ${s.name}: ${(r.changed * 100).toFixed(2)}% of pixels changed (limit ${(MAX_CHANGED * 100).toFixed(1)}%)${r.size ? " :: " + r.size : ""}`);
  }
  await browser.close();
}
console.log(failed ? `\n✗ ${failed} screens changed; see e2e/shots/visual/ (UPDATE=1 to accept)` : "\n✓ screens match the baselines");
process.exit(failed ? 1 : 0);
