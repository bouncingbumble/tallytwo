/**
 * The sound table against the asset table and the disk: every wired file resolves and exists,
 * every pool can round-robin, and the numbers are the prototype's (WEB-PLAN §3.7).
 */
/// <reference types="node" />
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { MANIFEST } from "../assets/manifest";
import type { AssetName } from "../assets/names";
import { CROSSFADE_MS, DEAL_ROLL, DUCK, JITTER, MUSIC, SFX, SFX_EVENTS, TENSION_THRESHOLD } from "./sfxTable";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
/** Under Vitest a ?url import is the root-relative dev URL ("/src/assets/...") or an /@fs/ absolute path. */
const onDisk = (url: string): string => {
  const clean = url.split(/[?#]/)[0];
  return clean.startsWith("/@fs/") ? clean.slice(4) : join(ROOT, clean.replace(/^\//, ""));
};

const MUSIC_LAYERS = Object.keys(MUSIC) as (keyof typeof MUSIC)[];
const WIRED: AssetName[] = [...SFX_EVENTS.flatMap((e) => SFX[e].files), ...MUSIC_LAYERS.map((l) => MUSIC[l].file)];

/** Named quarantined in WEB-PLAN §1 (the P-embedded files), bar CardSlide01/03/05, restored per §8 q2. */
const QUARANTINED = ["sfx_CardGrab01", "sfx_CardMoveFast04", "sfx_CardsFalling02", "sfx_DeckShuffle03", "sfx_CardSlideMultiple01"];

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

test("no quarantined file is wired", () => {
  for (const q of QUARANTINED) expect((WIRED as string[]).includes(q), q).toBe(false);
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

test("only playSmall and roundWin duck (P:366)", () => {
  expect(SFX_EVENTS.filter((e) => SFX[e].ducks).sort()).toEqual(["playSmall", "roundWin"]);
});

test("the numbers are the prototype's (P:364, P:368-373, P:386-390)", () => {
  expect(DUCK).toEqual({ to: 0.12, from: 0.3, attackS: 0.02, holdMs: 300, rearmMs: 280 });
  expect(DEAL_ROLL).toEqual({ first: 260, every: 110, ticks: 4 });
  expect(JITTER).toBe(0.04);
  expect(CROSSFADE_MS).toBe(2000);
  expect(TENSION_THRESHOLD).toBe(3);
});
