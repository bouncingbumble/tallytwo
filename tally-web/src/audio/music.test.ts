/**
 * createMusicLatch: the "setMusic before decode" state machine (WEB-PLAN §3.7), driven with
 * the commands it returns and no AudioContext.
 */
import { expect, test } from "vitest";
import { createMusicLatch, type LatchCommand } from "./musicLatch";
import type { MusicTrack } from "./sfxTable";

const start = (track: MusicTrack): LatchCommand<MusicTrack> => ({ op: "start", track });
const stop = (track: MusicTrack): LatchCommand<MusicTrack> => ({ op: "stop", track });

test("want then decode starts exactly once", () => {
  const l = createMusicLatch<MusicTrack>();
  expect(l.want("results")).toEqual([]);
  expect(l.decoded("results")).toEqual([start("results")]);
  expect(l.playing).toBe("results");
  expect(l.want("results")).toEqual([]);
});

test("want, then null, then decode starts nothing", () => {
  const l = createMusicLatch<MusicTrack>();
  expect(l.want("results")).toEqual([]);
  expect(l.want(null)).toEqual([]);
  expect(l.decoded("results")).toEqual([]);
  expect(l.playing).toBeNull();
  expect(l.isDecoded("results")).toBe(true);
});

test("a decode nobody wanted starts nothing", () => {
  const l = createMusicLatch<MusicTrack>();
  expect(l.decoded("table")).toEqual([]);
  expect(l.playing).toBeNull();
});

test("wanting the same track twice before the decode starts it once", () => {
  const l = createMusicLatch<MusicTrack>();
  expect(l.want("results")).toEqual([]);
  expect(l.want("results")).toEqual([]);
  expect(l.decoded("results")).toEqual([start("results")]);
  expect(l.decoded("results")).toEqual([]);
});

test("switching tracks stops the old one now and starts the new one when it lands", () => {
  const l = createMusicLatch<MusicTrack>();
  l.want("table");
  expect(l.decoded("table")).toEqual([start("table")]);
  expect(l.want("results")).toEqual([stop("table")]);
  expect(l.playing).toBeNull();
  expect(l.wanted).toBe("results");
  expect(l.decoded("results")).toEqual([start("results")]);
});

test("a change of mind before either decode lands starts only the final choice", () => {
  const l = createMusicLatch<MusicTrack>();
  l.want("table");
  l.want("results");
  expect(l.decoded("table")).toEqual([]);
  expect(l.decoded("results")).toEqual([start("results")]);
});

test("a decoded track wanted again after silence starts at once", () => {
  const l = createMusicLatch<MusicTrack>();
  l.want("table");
  l.decoded("table");
  expect(l.want(null)).toEqual([stop("table")]);
  expect(l.want("table")).toEqual([start("table")]);
});
