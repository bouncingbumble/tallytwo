/**
 * The runtime twin of the explicit import table (WEB-PLAN §3.8): every name resolves to a URL
 * whose file exists, the sprites and cards the UI needs are present, and every AI portrait is
 * wired.
 */
/// <reference types="node" />
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { PERSONALITIES } from "../ai/personalities";
import type { AssetName, CardAssetName, SpriteAssetName } from "./names";
import { MANIFEST, PORTRAITS } from "./manifest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
/** Under Vitest a ?url import is the root-relative dev URL ("/src/assets/...") or an /@fs/ absolute path. */
const onDisk = (url: string): string => {
  const clean = url.split(/[?#]/)[0];
  return clean.startsWith("/@fs/") ? clean.slice(4) : join(ROOT, clean.replace(/^\//, ""));
};

const PROTO_SPRITES: SpriteAssetName[] = ["wood", "felt", "p_marshal", "p_outlaw", "p_gambler", "wanted"];
const CARD_FILES: CardAssetName[] = ["cards_atlas", "cards_atlas_2x", "cards_atlas_3x", "card_back", "card_back_2x", "card_back_3x"];

test("every AssetName key maps to a non-empty string", () => {
  const entries = Object.entries(MANIFEST);
  expect(entries.length).toBeGreaterThan(0);
  for (const [k, v] of entries) expect(typeof v === "string" && v.length > 0, k).toBe(true);
});

test("the six proto sprites (and the checker probe) are present", () => {
  for (const s of [...PROTO_SPRITES, "checker" as const]) expect(MANIFEST[s], s).toBeTruthy();
});

test("the six card files are present", () => {
  for (const c of CARD_FILES) expect(MANIFEST[c], c).toBeTruthy();
});

test("every personality's portrait is a PORTRAITS key that resolves", () => {
  for (const p of Object.values(PERSONALITIES)) {
    expect(p.portrait in PORTRAITS, p.key).toBe(true);
    expect(MANIFEST[PORTRAITS[p.portrait as keyof typeof PORTRAITS]], p.key).toBeTruthy();
  }
});

test("every value's file exists on disk", () => {
  for (const [k, url] of Object.entries(MANIFEST) as [AssetName, string][]) expect(existsSync(onDisk(url)), `${k} -> ${url}`).toBe(true);
});
