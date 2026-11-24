/**
 * The sound table against the asset table and the disk: every wired file resolves and exists,
 * every pool can round-robin, and the gains and ducks are in range.
 */
/// <reference types="node" />
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { MANIFEST } from "../assets/manifest";
import type { AssetName } from "../assets/names";
import { MUSIC, SFX, SFX_EVENTS } from "./sfxTable";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
/** Under Vitest a ?url import is the root-relative dev URL ("/src/assets/...") or an /@fs/ absolute path. */
const onDisk = (url: string): string => {
  const clean = url.split(/[?#]/)[0];
  return clean.startsWith("/@fs/") ? clean.slice(4) : join(ROOT, clean.replace(/^\//, ""));
};

const MUSIC_LAYERS = Object.keys(MUSIC) as (keyof typeof MUSIC)[];
const WIRED: AssetName[] = [...SFX_EVENTS.flatMap((e) => SFX[e].files), ...MUSIC_LAYERS.map((l) => MUSIC[l].file)];

test("every event has at least two files, except roundWin's single impact", () => {
  for (const e of SFX_EVENTS) expect(SFX[e].files.length, e).toBeGreaterThanOrEqual(e === "roundWin" ? 1 : 2);
  expect(SFX.roundWin.files).toHaveLength(1);
});

test("no event wires the same file twice", () => {
  for (const e of SFX_EVENTS) expect(new Set(SFX[e].files).size, e).toBe(SFX[e].files.length);
});

test("every SFX and MUSIC file is a MANIFEST key and exists on disk", () => {
  for (const name of WIRED) {
    expect(name in MANIFEST, name).toBe(true);
    const url = MANIFEST[name];
    expect(typeof url === "string" && url.length > 0, name).toBe(true);
    expect(existsSync(onDisk(url)), `${name} -> ${url}`).toBe(true);
  }
});

test("gains are within (0, 1]", () => {
  for (const e of SFX_EVENTS) {
    expect(SFX[e].gain, e).toBeGreaterThan(0);
    expect(SFX[e].gain, e).toBeLessThanOrEqual(1);
  }
  for (const l of MUSIC_LAYERS) {
    expect(MUSIC[l].gain, l).toBeGreaterThan(0);
    expect(MUSIC[l].gain, l).toBeLessThanOrEqual(1);
  }
});

test("loop ends are positive seconds", () => {
  for (const l of MUSIC_LAYERS) expect(MUSIC[l].loopEnd, l).toBeGreaterThan(0);
});

test("only playSmall and roundWin duck", () => {
  expect(SFX_EVENTS.filter((e) => SFX[e].ducks).sort()).toEqual(["playSmall", "roundWin"]);
});

