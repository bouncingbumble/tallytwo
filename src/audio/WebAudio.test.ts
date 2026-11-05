/**
 * WebAudio against a fake context (gain nodes record their automation, sources their start/stop
 * and loop settings) and a fake fetch that can fail or hold a file: the failure contract, the
 * one decode pass, the latched setMusic, the sequential fades, the duck, the deal roll and the
 * tension switch.
 */
import { afterEach, expect, test, vi } from "vitest";
import { MANIFEST } from "../assets/manifest";
import type { AssetName } from "../assets/names";
import { DEAL_ROLL, DUCK, FADE, JITTER, MUSIC, SFX, SFX_EVENTS } from "./sfxTable";
import {
  type AudioContextLike,
  type AudioParamLike,
  type BufferSourceLike,
  type FetchLike,
  type FetchResponseLike,
  type GainNodeLike,
  WebAudio,
} from "./WebAudio";

/* ---- fakes ---- */

interface FakeParam extends AudioParamLike {
  targets: number[];
  ramps: number[];
  /** Every setValueAtTime value, in order. */
  sets: number[];
}
interface FakeBuffer {
  duration: number;
  url: string;
}
interface FakeGain extends GainNodeLike {
  gain: FakeParam;
  into: unknown;
}
interface FakeSource extends BufferSourceLike {
  buffer: FakeBuffer | null;
  into: unknown;
  starts: number;
  /** The context times start() was scheduled for. */
  startAts: number[];
  stops: number[];
}
interface FakeContext extends AudioContextLike {
  currentTime: number;
  state: string;
  gains: FakeGain[];
  sources: FakeSource[];
  resumes: number;
  suspends: number;
}

function fakeParam(value: number): FakeParam {
  const p: FakeParam = {
    value,
    targets: [],
    ramps: [],
    sets: [],
    setValueAtTime(v) {
      p.sets.push(v);
      p.value = v;
    },
    linearRampToValueAtTime(v) {
      p.ramps.push(v);
      p.value = v;
    },
    setTargetAtTime(t) {
      p.targets.push(t);
      p.value = t;
    },
    cancelScheduledValues() {},
  };
  return p;
}

function fakeContext(): FakeContext {
  const ctx: FakeContext = {
    currentTime: 0,
    state: "suspended",
    destination: { connect() {} },
    gains: [],
    sources: [],
    resumes: 0,
    suspends: 0,
    createGain() {
      const g: FakeGain = {
        gain: fakeParam(1),
        into: null,
        connect(d) {
          g.into = d;
        },
      };
      ctx.gains.push(g);
      return g;
    },
    createBufferSource() {
      const s: FakeSource = {
        buffer: null,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        playbackRate: fakeParam(1),
        into: null,
        starts: 0,
        startAts: [],
        stops: [],
        connect(d) {
          s.into = d;
        },
        start(when) {
          s.starts++;
          s.startAts.push(when ?? 0);
        },
        stop(when) {
          s.stops.push(when ?? 0);
        },
      };
      ctx.sources.push(s);
      return s;
    },
    decodeAudioData: (data) => Promise.resolve<FakeBuffer>({ duration: 600, url: (data as unknown as { url: string }).url }),
    resume() {
      ctx.state = "running";
      ctx.resumes++;
      return Promise.resolve();
    },
    suspend() {
      ctx.state = "suspended";
      ctx.suspends++;
      return Promise.resolve();
    },
  };
  return ctx;
}

/** Every asset at /fake/<name>, so the fake fetch and the assertions can key on names. */
const urls = Object.fromEntries((Object.keys(MANIFEST) as AssetName[]).map((k) => [k, `/fake/${k}`])) as Record<AssetName, string>;
const urlOf = (name: AssetName): string => urls[name];

const okResponse = (url: string): FetchResponseLike => ({ ok: true, status: 200, arrayBuffer: () => Promise.resolve({ url } as unknown as ArrayBuffer) });

function fakeFetch(opts: { fail?: string[]; hold?: string[] } = {}) {
  const calls: string[] = [];
  const held = new Map<string, (r: FetchResponseLike) => void>();
  const fetchFn: FetchLike = (url) => {
    calls.push(url);
    if (opts.fail?.includes(url)) return Promise.reject(new Error("404"));
    if (opts.hold?.includes(url)) return new Promise((resolve) => held.set(url, resolve));
    return Promise.resolve(okResponse(url));
  };
  /** Lets a held fetch through; the decode chain is microtasks only, so flush() settles it. */
  const land = (url: string): void => {
    const resolve = held.get(url);
    if (!resolve) throw new Error(`not held: ${url}`);
    held.delete(url);
    resolve(okResponse(url));
  };
  return { fetchFn, calls, land };
}

/** Drains the microtask chain behind a landed fetch (fetch -> arrayBuffer -> decode -> latch). */
async function flush(): Promise<void> {
  for (let i = 0; i < 32; i++) await Promise.resolve();
}

const sourcesOf = (ctx: FakeContext, name: AssetName): FakeSource[] => ctx.sources.filter((s) => s.buffer?.url === urlOf(name));
const gainOf = (s: FakeSource): FakeGain => s.into as FakeGain;
const targetsOf = (ctx: FakeContext): number[] => ctx.gains.flatMap((g) => g.gain.targets);
const SFX_FILES = [...new Set(SFX_EVENTS.flatMap((e) => SFX[e].files))];

function setup(opts: { fail?: string[]; hold?: string[] } = {}) {
  const ctx = fakeContext();
  const fetch = fakeFetch(opts);
  const audio = new WebAudio({ createContext: () => ctx, fetchFn: fetch.fetchFn, urls });
  return { ctx, fetch, audio };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/* ---- init and the failure contract ---- */

test("init resolves when one file fails; that event is silent, the others play, one warning names it", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const { ctx, audio } = setup({ fail: [urlOf("sfx_CardsImpact01")] });
  await expect(audio.init()).resolves.toBeUndefined();
  expect(warn).toHaveBeenCalledTimes(1);
  expect(String(warn.mock.calls[0][0])).toContain("sfx_CardsImpact01");

  let before = ctx.sources.length;
  audio.play("roundWin");
  expect(ctx.sources.length - before).toBe(0);

  before = ctx.sources.length;
  audio.play("playSmall");
  expect(ctx.sources.length - before).toBe(1);
  const played = ctx.sources[ctx.sources.length - 1];
  expect(played.starts).toBe(1);
  expect((SFX.playSmall.files as readonly string[]).includes(played.buffer!.url.replace("/fake/", ""))).toBe(true);
  expect(gainOf(played).gain.value).toBe(SFX.playSmall.gain);
});

test("init twice is one decode pass and the same promise", async () => {
  const { fetch, audio } = setup();
  const p1 = audio.init();
  const p2 = audio.init();
  expect(p2).toBe(p1);
  await p1;
  for (const f of SFX_FILES) expect(fetch.calls.filter((u) => u === urlOf(f)), f).toHaveLength(1);
  const after = fetch.calls.length;
  expect(audio.init()).toBe(p1);
  await audio.init();
  expect(fetch.calls.length).toBe(after);
});

test("init resolves when the context cannot be created; everything is then a no-op", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const fetch = fakeFetch();
  const audio = new WebAudio({
    createContext: () => {
      throw new Error("no AudioContext");
    },
    fetchFn: fetch.fetchFn,
    urls,
  });
  await expect(audio.init()).resolves.toBeUndefined();
  expect(warn).toHaveBeenCalledTimes(1);
  expect(fetch.calls).toHaveLength(0);
  expect(() => {
    audio.play("deal");
    audio.dealRoll();
    audio.setMusic("table");
    audio.setTension(true);
    audio.setBus("sfx", 0.5);
    audio.duck();
    audio.suspend();
    audio.resume();
  }).not.toThrow();
});

test("play before init is a no-op", () => {
  const { ctx, audio } = setup();
  audio.play("deal");
  expect(ctx.sources).toHaveLength(0);
});

/* ---- play: pools, jitter, wake ---- */

test("a play picks from the event's pool with true pitch jitter and never repeats the last file", async () => {
  const { ctx, audio } = setup();
  await audio.init();
  const rates: number[] = [];
  let last: string | undefined;
  for (let k = 0; k < 40; k++) {
    audio.play("select");
    const s = ctx.sources[ctx.sources.length - 1];
    expect((SFX.select.files as readonly string[]).includes(s.buffer!.url.replace("/fake/", ""))).toBe(true);
    expect(s.buffer!.url).not.toBe(last);
    last = s.buffer!.url;
    rates.push(s.playbackRate.value);
  }
  for (const r of rates) {
    expect(r).toBeGreaterThanOrEqual(1 - JITTER);
    expect(r).toBeLessThanOrEqual(1 + JITTER);
  }
  expect(new Set(rates).size).toBeGreaterThan(1);
});

test("play resumes a context that is not running; resume() is idempotent once it runs", async () => {
  const { ctx, audio } = setup();
  await audio.init(); // boot wakes the context once
  expect(ctx.state).toBe("running");
  const resumes = ctx.resumes;
  audio.resume();
  expect(ctx.resumes).toBe(resumes);
  ctx.state = "interrupted";
  audio.play("deal");
  expect(ctx.resumes).toBe(resumes + 1);
  expect(ctx.state).toBe("running");
  audio.suspend();
  expect(ctx.suspends).toBe(1);
  expect(ctx.state).toBe("suspended");
  audio.resume();
  expect(ctx.state).toBe("running");
});

/* ---- buses ---- */

test("setBus before init sets the bus's birth level; after init it sets the node, clamped to 0..1", async () => {
  const { ctx, audio } = setup();
  audio.setBus("sfx", 0.37);
  await audio.init();
  const buses = ctx.gains.filter((g) => g.into === ctx.destination);
  expect(buses).toHaveLength(2);
  const sfx = buses.find((g) => g.gain.value === 0.37)!;
  expect(sfx).toBeTruthy();
  audio.setBus("sfx", 2);
  expect(sfx.gain.value).toBe(1);
  audio.setBus("sfx", -1);
  expect(sfx.gain.value).toBe(0);
});

/* ---- music: the latch at the port ---- */

test("setMusic before the decode lands starts exactly one looping source after it lands", async () => {
  const { ctx, fetch, audio } = setup({ hold: [urlOf("music_ost_1")] });
  await audio.init();
  audio.setMusic("table");
  audio.setMusic("table");
  expect(sourcesOf(ctx, "music_ost_1")).toHaveLength(0);
  fetch.land(urlOf("music_ost_1"));
  await flush();
  const loops = sourcesOf(ctx, "music_ost_1");
  expect(loops).toHaveLength(1);
  const [loop] = loops;
  expect(loop.starts).toBe(1);
  expect(loop.loop).toBe(true);
  expect(loop.loopStart).toBe(0);
  expect(loop.loopEnd).toBe(MUSIC.table.loopEnd);
  expect(gainOf(loop).gain.ramps).toEqual([MUSIC.table.gain]);
  audio.setMusic("table");
  expect(sourcesOf(ctx, "music_ost_1")).toHaveLength(1);
});

test("setMusic(null) before the decode lands starts none", async () => {
  const { ctx, fetch, audio } = setup({ hold: [urlOf("music_ost_1")] });
  await audio.init();
  audio.setMusic("table");
  audio.setMusic(null);
  fetch.land(urlOf("music_ost_1"));
  await flush();
  expect(sourcesOf(ctx, "music_ost_1")).toHaveLength(0);
});

test("a later setMusic before either decode lands starts only the final choice", async () => {
  const { ctx, fetch, audio } = setup({ hold: [urlOf("music_ost_1"), urlOf("music_ost_4")] });
  await audio.init();
  audio.setMusic("table");
  audio.setMusic("results");
  fetch.land(urlOf("music_ost_1"));
  await flush();
  expect(sourcesOf(ctx, "music_ost_1")).toHaveLength(0);
  fetch.land(urlOf("music_ost_4"));
  await flush();
  expect(sourcesOf(ctx, "music_ost_4")).toHaveLength(1);
});

test("setMusic before init is remembered and decoded once there is a context", async () => {
  const { ctx, fetch, audio } = setup();
  audio.setMusic("results");
  expect(fetch.calls).toHaveLength(0);
  await audio.init();
  await flush();
  expect(fetch.calls.filter((u) => u === urlOf("music_ost_4"))).toHaveLength(1);
  expect(sourcesOf(ctx, "music_ost_4")).toHaveLength(1);
});

const OUT_S = FADE.outMs / 1000;

test("stopping a loop fades it out over FADE.outMs and schedules its stop; the next loop waits for the fade-out", async () => {
  const { ctx, audio } = setup();
  await audio.init();
  audio.setMusic("table");
  await flush();
  const [loop] = sourcesOf(ctx, "music_ost_1");
  expect(loop.startAts).toEqual([0]); // nothing was fading: at once
  ctx.currentTime = 5;
  audio.setMusic(null);
  expect(gainOf(loop).gain.ramps).toEqual([MUSIC.table.gain, 0]);
  expect(gainOf(loop).gain.sets.at(-1)).toBe(MUSIC.table.gain); // the fade-out starts from the level the schedule reached, not from the param
  expect(loop.stops).toEqual([ctx.currentTime + OUT_S]);
  audio.setMusic("table");
  const again = sourcesOf(ctx, "music_ost_1");
  expect(again).toHaveLength(2);
  expect(again[1].startAts).toEqual([ctx.currentTime + OUT_S]); // after the old one is silent, never over it
  expect(gainOf(again[1]).gain.ramps).toEqual([MUSIC.table.gain]);
  expect(again[1].stops).toEqual([]);
});

test("a loop stopped mid-fade-in fades out from where its fade-in had got to; one stopped in its starting quantum is cancelled", async () => {
  const { ctx, audio } = setup();
  await audio.init();
  audio.setMusic("table");
  await flush();
  const [loop] = sourcesOf(ctx, "music_ost_1");
  ctx.currentTime = FADE.inMs / 1000 / 2; // halfway up the 2-s fade-in
  audio.setMusic(null);
  expect(gainOf(loop).gain.sets.at(-1)).toBeCloseTo(MUSIC.table.gain / 2, 6);
  expect(gainOf(loop).gain.ramps).toEqual([MUSIC.table.gain, 0]);
  // same quantum: table and tension both decoded, nothing fading; the table is cancelled outright and tension starts at once
  ctx.currentTime = 10;
  audio.setMusic("table");
  await flush();
  audio.setTension(true);
  await flush();
  const tables = sourcesOf(ctx, "music_ost_1");
  expect(tables[1].startAts).toEqual([10]);
  expect(tables[1].stops).toEqual([10]);
  expect(gainOf(tables[1]).gain.ramps).toEqual([MUSIC.table.gain]); // no fade-out ramp was added
  expect(sourcesOf(ctx, "music_ost_3")[0].startAts).toEqual([10]);
});

test("wanting the table prefetches the tension loop, so the first switch of a session leaves no gap", async () => {
  const { ctx, fetch, audio } = setup({ hold: [urlOf("music_ost_3")] });
  await audio.init();
  audio.setMusic("table");
  await flush();
  expect(fetch.calls.filter((u) => u === urlOf("music_ost_3"))).toHaveLength(1); // before any setTension(true)
  fetch.land(urlOf("music_ost_3"));
  await flush();
  ctx.currentTime = 10;
  audio.setTension(true);
  await flush();
  expect(sourcesOf(ctx, "music_ost_3")[0].startAts).toEqual([10 + OUT_S]); // scheduled, not waited for
  expect(fetch.calls.filter((u) => u === urlOf("music_ost_3"))).toHaveLength(1);
});

test("a track switch is a fade-out then a fade-in, never a crossfade; a loop stopped before it sounded is cancelled", async () => {
  const { ctx, fetch, audio } = setup({ hold: [urlOf("music_ost_4")] });
  await audio.init();
  audio.setMusic("table");
  await flush();
  const [table] = sourcesOf(ctx, "music_ost_1");
  ctx.currentTime = 10;
  audio.setMusic("results"); // the table fades out now; the results loop is still decoding
  expect(table.stops).toEqual([10 + OUT_S]);
  fetch.land(urlOf("music_ost_4"));
  await flush();
  const [results] = sourcesOf(ctx, "music_ost_4");
  expect(results.startAts).toEqual([10 + OUT_S]); // scheduled for the moment the table is silent
  expect(gainOf(results).gain.ramps).toEqual([MUSIC.results.gain]);
  // a change of mind before it has sounded: cancelled outright, and the table comes straight back
  ctx.currentTime = 10.5;
  audio.setMusic("table");
  expect(results.stops).toEqual([10.5]);
  expect(gainOf(results).gain.ramps).toEqual([MUSIC.results.gain]); // no fade-out ramp
  const again = sourcesOf(ctx, "music_ost_1");
  expect(again).toHaveLength(2);
  expect(again[1].startAts).toEqual([10 + OUT_S]); // still not before the first table's fade-out ends
});

test("there is no ambience loop: init starts no music on its own, and the two buses are music and sfx", async () => {
  const { ctx, audio } = setup();
  await audio.init();
  await flush();
  expect(ctx.sources.filter((s) => s.loop)).toHaveLength(0);
  expect(ctx.gains.filter((g) => g.into === ctx.destination)).toHaveLength(2);
});

test("the human's round win and match win each have their own loop", async () => {
  const { ctx, audio } = setup();
  await audio.init();
  audio.setMusic("roundWon");
  await flush();
  expect(sourcesOf(ctx, "music_ost_2")).toHaveLength(1);
  expect(sourcesOf(ctx, "music_ost_2")[0].loopEnd).toBe(MUSIC.roundWon.loopEnd);
  ctx.currentTime = 10;
  audio.setMusic("matchWon");
  await flush();
  expect(sourcesOf(ctx, "music_ost_2")[0].stops).toEqual([10 + OUT_S]);
  expect(sourcesOf(ctx, "music_ost_5")[0].startAts).toEqual([10 + OUT_S]);
});

/* ---- tension ---- */

test("tension switches the table loop for the tension loop (fade out, then in) and back; it never plays over results", async () => {
  const { ctx, audio } = setup();
  await audio.init();
  audio.setTension(true); // nothing wanted yet: no music
  await flush();
  expect(sourcesOf(ctx, "music_ost_3")).toHaveLength(0);
  expect(sourcesOf(ctx, "music_ost_1")).toHaveLength(0);

  audio.setMusic("table"); // with tension on, "table" plays as the tension loop
  await flush();
  expect(sourcesOf(ctx, "music_ost_1")).toHaveLength(0);
  const [tension] = sourcesOf(ctx, "music_ost_3");
  expect(tension).toBeTruthy();
  expect(tension.loop).toBe(true);
  expect(tension.startAts).toEqual([0]);
  expect(gainOf(tension).gain.ramps).toEqual([MUSIC.tension.gain]);

  ctx.currentTime = 20;
  audio.setTension(false); // the tension loop fades out; the table loop starts when it is silent
  await flush();
  expect(gainOf(tension).gain.ramps).toEqual([MUSIC.tension.gain, 0]);
  expect(tension.stops).toEqual([20 + OUT_S]);
  const [table] = sourcesOf(ctx, "music_ost_1");
  expect(table.startAts).toEqual([20 + OUT_S]);

  ctx.currentTime = 40;
  audio.setTension(true);
  await flush();
  expect(table.stops).toEqual([40 + OUT_S]);
  expect(sourcesOf(ctx, "music_ost_3")[1].startAts).toEqual([40 + OUT_S]);

  ctx.currentTime = 60;
  audio.setMusic("results"); // tension stays on, but it only ever stands in for the table
  await flush();
  expect(sourcesOf(ctx, "music_ost_3")[1].stops).toEqual([60 + OUT_S]);
  expect(sourcesOf(ctx, "music_ost_4")).toHaveLength(1);
  expect(sourcesOf(ctx, "music_ost_4")[0].startAts).toEqual([60 + OUT_S]);
  expect(sourcesOf(ctx, "music_ost_3")).toHaveLength(2);
});

test("a tension file that will not decode hands the table back instead of leaving the low-card stretch silent", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const { ctx, audio } = setup({ fail: [urlOf("music_ost_3")] });
  await audio.init();
  audio.setTension(true);
  audio.setMusic("table");
  await flush();
  expect(sourcesOf(ctx, "music_ost_3")).toHaveLength(0);
  expect(sourcesOf(ctx, "music_ost_1")).toHaveLength(1); // the table, not silence
  expect(warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes("music_ost_3"))).toHaveLength(1);
  audio.setTension(false);
  audio.setTension(true);
  await flush();
  expect(sourcesOf(ctx, "music_ost_1")).toHaveLength(1); // still the same table loop: no switch, no re-fetch
});

/* ---- duck and deal roll ---- */

test("playSmall ducks the music and deal does not; the duck lifts after the hold unless re-armed", async () => {
  vi.useFakeTimers();
  const { ctx, audio } = setup();
  await audio.init();
  audio.play("deal");
  expect(targetsOf(ctx)).toEqual([]);
  audio.play("playSmall");
  expect(targetsOf(ctx)).toEqual([DUCK.to / DUCK.from]);
  vi.advanceTimersByTime(DUCK.holdMs - 1);
  expect(targetsOf(ctx)).toEqual([DUCK.to / DUCK.from]);
  vi.advanceTimersByTime(1);
  expect(targetsOf(ctx)).toEqual([DUCK.to / DUCK.from, 1]);

  // Re-duck within the rearm window: the first hold expires without lifting, the second lifts.
  audio.play("playSmall");
  vi.advanceTimersByTime(100);
  audio.play("roundWin");
  vi.advanceTimersByTime(200);
  expect(targetsOf(ctx).slice(2)).toEqual([DUCK.to / DUCK.from, DUCK.to / DUCK.from]);
  vi.advanceTimersByTime(100);
  expect(targetsOf(ctx).slice(2)).toEqual([DUCK.to / DUCK.from, DUCK.to / DUCK.from, 1]);
});

test("dealRoll plays a shuffle now and the deal ticks on the prototype's schedule", async () => {
  vi.useFakeTimers();
  const { ctx, audio } = setup();
  await audio.init();
  const before = ctx.sources.length;
  audio.dealRoll();
  expect(ctx.sources.length - before).toBe(1);
  expect((SFX.shuffle.files as readonly string[]).includes(ctx.sources[before].buffer!.url.replace("/fake/", ""))).toBe(true);
  vi.advanceTimersByTime(DEAL_ROLL.first - 1);
  expect(ctx.sources.length - before).toBe(1);
  vi.advanceTimersByTime(1);
  expect(ctx.sources.length - before).toBe(2);
  vi.advanceTimersByTime((DEAL_ROLL.ticks - 1) * DEAL_ROLL.every);
  expect(ctx.sources.length - before).toBe(1 + DEAL_ROLL.ticks);
  for (const s of ctx.sources.slice(before + 1)) expect((SFX.deal.files as readonly string[]).includes(s.buffer!.url.replace("/fake/", ""))).toBe(true);
  vi.runAllTimers();
  expect(ctx.sources.length - before).toBe(1 + DEAL_ROLL.ticks);
});
