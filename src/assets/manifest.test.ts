/**
 * The explicit import table at runtime: every name resolves to a URL whose file exists, the
 * sprites and cards the table needs are present, every AI portrait is wired, and the images are
 * the one-file-per-asset 3x cuts the art sizes (phaser/art.ts) assume.
 */
/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
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
/** A PNG's pixel size from its IHDR chunk: width and height are the two big-endian u32s after the 16-byte signature + length + type. */
const pngSize = (file: string): [number, number] => {
  const b = readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

const TABLE_SPRITES: SpriteAssetName[] = ["wood", "felt", "p_marshal", "p_outlaw", "p_gambler", "wanted"];
const CARD_FILES: CardAssetName[] = ["cards_atlas", "card_back"];
/** Each image is 3x its art size in logical px (phaser/art.ts); the doors are already a 2x cut. */
const PIXEL_SIZES: Partial<Record<AssetName, [number, number]>> = {
  cards_atlas: [3744, 1536],
  card_back: [288, 384],
  wood: [288, 288],
  felt: [96, 96],
  p_marshal: [288, 312],
  p_outlaw: [288, 312],
  p_gambler: [288, 312],
  wanted: [183, 213],
  doors_closed: [558, 474],
  doors_ajar: [558, 474],
  doors_open: [558, 474],
  back_bar: [720, 432],
  barrel: [144, 207],
};

test("every AssetName key maps to a non-empty string", () => {
  const entries = Object.entries(MANIFEST);
  expect(entries.length).toBeGreaterThan(0);
  for (const [k, v] of entries) expect(typeof v === "string" && v.length > 0, k).toBe(true);
});

test("the six table sprites are present", () => {
  for (const s of TABLE_SPRITES) expect(MANIFEST[s], s).toBeTruthy();
});

test("the two card files are present", () => {
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

test("the images ship as one 3x file each, no @2x/@3x twins", () => {
  for (const [k, size] of Object.entries(PIXEL_SIZES) as [AssetName, [number, number]][]) {
    expect(pngSize(onDisk(MANIFEST[k])), k).toEqual(size);
  }
  for (const [k, url] of Object.entries(MANIFEST) as [AssetName, string][]) {
    const file = onDisk(url);
    if (!file.endsWith(".png")) continue;
    for (const suffix of ["@2x", "@3x"]) expect(existsSync(file.replace(/\.png$/, `${suffix}.png`)), `${k}${suffix}`).toBe(false);
  }
});
