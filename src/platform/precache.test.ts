import { expect, test } from "vitest";
import { classify, fnv1a, fnv1aBytes, precachePlan, renderWorker, type DistFile } from "./precache";

const f = (path: string, hash = "h", size = 10): DistFile => ({ path, hash, size });

const DIST = [
  f("index.html"),
  f("sw.js"),
  f("manifest.webmanifest"),
  f("icons/icon-192.png"),
  f("icons/icon-512.png"),
  f("assets/index-Cj2GbNVG.js"),
  f("assets/index-Cj2GbNVG.css"),
  f("assets/assetsPage-EYMvA_cs.js"),
  f("assets/assetsPage-DNsXvNzZ.css"),
  f("assets/rye-latin-400-normal-CnIDrDaJ.woff2"),
  f("assets/rye-latin-400-normal-CPBiwIfN.woff"),
  f("assets/wood-GR4UtMgh.png"),
  f("assets/SFX_CardSlapFast01-D9zbEgvp.m4a"),
  f("assets/ost_1-B1vtP9Vx.m4a", "m", 2_300_000),
  f("assets/index-Cj2GbNVG.js.map"),
  f(".DS_Store"),
];

test("classify: core, music, skipped", () => {
  expect(classify("index.html")).toBe("core");
  expect(classify("assets/SFX_CardSlapFast01-D9zbEgvp.m4a")).toBe("core");
  expect(classify("assets/ost_3-D1RRFsig.m4a")).toBe("music");
  expect(classify("sw.js")).toBe("skip");
  expect(classify("assets/assetsPage-EYMvA_cs.js")).toBe("skip");
  expect(classify("assets/rye-latin-400-normal-CPBiwIfN.woff")).toBe("skip");
  expect(classify("assets/x.js.map")).toBe("skip");
});

test("the plan: base-prefixed, sorted, split, sized", () => {
  const p = precachePlan(DIST, "/tallytwo/");
  expect(p.music).toEqual(["/tallytwo/assets/ost_1-B1vtP9Vx.m4a"]);
  expect(p.core).toEqual([
    "/tallytwo/assets/SFX_CardSlapFast01-D9zbEgvp.m4a",
    "/tallytwo/assets/index-Cj2GbNVG.css",
    "/tallytwo/assets/index-Cj2GbNVG.js",
    "/tallytwo/assets/rye-latin-400-normal-CnIDrDaJ.woff2",
    "/tallytwo/assets/wood-GR4UtMgh.png",
    "/tallytwo/icons/icon-192.png",
    "/tallytwo/icons/icon-512.png",
    "/tallytwo/index.html",
    "/tallytwo/manifest.webmanifest",
  ]);
  expect(p.bytes).toBe(9 * 10 + 2_300_000);
  expect(precachePlan(DIST, "/").core).toContain("/index.html");
  expect(precachePlan(DIST, "/tallytwo").core).toContain("/tallytwo/index.html");
});

test("the version: stable for the same build, new for any changed file, base or order-free", () => {
  const v = precachePlan(DIST, "/").version;
  expect(precachePlan([...DIST].reverse(), "/").version).toBe(v);
  const changed = DIST.map((x) => (x.path === "index.html" ? { ...x, hash: "other" } : x));
  expect(precachePlan(changed, "/").version).not.toBe(v);
  expect(precachePlan(DIST, "/tallytwo/").version).not.toBe(v);
  // a skipped file does not move it
  const plusSkipped = [...DIST, f("assets/assetsPage-new.js", "zzz")];
  expect(precachePlan(plusSkipped, "/").version).toBe(v);
});

test("fnv1a: known vectors, and bytes agree with the string form for ASCII", () => {
  expect(fnv1a("")).toBe("811c9dc5");
  expect(fnv1a("a")).toBe("e40c292c");
  expect(fnv1aBytes(new TextEncoder().encode("foobar"))).toBe(fnv1a("foobar"));
});

test("renderWorker: PLAN first, then the body; refuses a plan without the index", () => {
  const p = precachePlan(DIST, "/tallytwo/");
  const src = renderWorker(p, "/tallytwo/", "BODY();");
  expect(src).toMatch(/^\/\/ Generated/);
  expect(src).toContain(`"index": "/tallytwo/index.html"`);
  expect(src.trimEnd().endsWith("BODY();")).toBe(true);
  expect(() => renderWorker(precachePlan([f("a.js")], "/"), "/", "")).toThrow(/index\.html/);
});
