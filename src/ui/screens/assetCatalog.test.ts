/** The /assets page's catalog: every manifest asset is listed once, each with a use of five words or less. */
import { expect, test } from "vitest";
import { MANIFEST } from "../../assets/manifest";
import { ASSET_ROWS, GROUPS } from "./assetCatalog";

test("every manifest asset has exactly one row", () => {
  const names = ASSET_ROWS.map((r) => r.name);
  expect(new Set(names).size).toBe(names.length);
  for (const k of Object.keys(MANIFEST)) expect(names).toContain(k);
});

test("every use is five words or less", () => {
  for (const r of ASSET_ROWS) {
    const words = r.use.trim().split(/\s+/);
    expect(words.length, `${r.name}: "${r.use}"`).toBeGreaterThan(0);
    expect(words.length, `${r.name}: "${r.use}"`).toBeLessThanOrEqual(5);
  }
});

test("every row is in a listed group", () => {
  for (const r of ASSET_ROWS) expect(GROUPS).toContain(r.group);
});
