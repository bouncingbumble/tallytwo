/**
 * WebAudio against a fake context (gain nodes record their automation, sources their start/stop
 * and loop settings) and a fake fetch that can fail or hold a file: the failure contract, the
 * one decode pass, the latched setMusic, the duck, the deal roll and the tension layer.
 */
import { afterEach, expect, test, vi } from "vitest";
import { MANIFEST } from "../assets/manifest";
import type { AssetName } from "../assets/names";
import { CROSSFADE_MS, DEAL_ROLL, DUCK, JITTER, MUSIC, SFX, SFX_EVENTS } from "./sfxTable";
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
    setValueAtTime(v) {
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
        stops: [],
        connect(d) {
          s.into = d;
        },
        start() {
          s.starts++;
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
  expect(buses).toHaveLength(3);
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

test("stopping a loop fades it out over the crossfade and schedules its stop", async () => {
  const { ctx, audio } = setup();
  await audio.init();
  audio.setMusic("table");
  await flush();
  const [loop] = sourcesOf(ctx, "music_ost_1");
  audio.setMusic(null);
  expect(gainOf(loop).gain.ramps).toEqual([MUSIC.table.gain, 0]);
  expect(loop.stops).toEqual([ctx.currentTime + CROSSFADE_MS / 1000]);
  audio.setMusic("table");
  const again = sourcesOf(ctx, "music_ost_1");
  expect(again).toHaveLength(2);
  expect(again[1].stops).toEqual([]);
});

test("the ambience loop starts after init on its own bus and keeps running", async () => {
  const { ctx, audio } = setup();
  await audio.init();
  await flush();
  const [amb] = sourcesOf(ctx, "sfx_CardsMovingLoop03");
  expect(amb).toBeTruthy();
  expect(amb.loop).toBe(true);
  expect(amb.loopEnd).toBe(MUSIC.ambience.loopEnd);
  expect(gainOf(amb).gain.ramps).toEqual([MUSIC.ambience.gain]);
  expect((gainOf(amb).into as FakeGain).into).toBe(ctx.destination);
  audio.setMusic("results");
  audio.setMusic(null);
  expect(amb.stops).toEqual([]);
});

/* ---- tension ---- */

test("the tension layer fades in over table, and out when off or when the track is not table", async () => {
  const { ctx, audio } = setup();
  await audio.init();
  audio.setTension(true); // nothing wanted yet: no layer
  await flush();
  expect(sourcesOf(ctx, "music_ost_3")).toHaveLength(0);

  audio.setMusic("table");
  await flush();
  const [tension] = sourcesOf(ctx, "music_ost_3");
  expect(tension).toBeTruthy();
  expect(tension.loop).toBe(true);
  expect(gainOf(tension).gain.ramps).toEqual([MUSIC.tension.gain]);

  audio.setTension(false);
  expect(gainOf(tension).gain.ramps).toEqual([MUSIC.tension.gain, 0]);
  expect(tension.stops).toEqual([ctx.currentTime + CROSSFADE_MS / 1000]);

  audio.setTension(true);
  expect(sourcesOf(ctx, "music_ost_3")).toHaveLength(2);
  audio.setMusic("results");
  await flush();
  expect(sourcesOf(ctx, "music_ost_3")[1].stops).toHaveLength(1);
  expect(sourcesOf(ctx, "music_ost_1")[0].stops).toHaveLength(1);
  expect(sourcesOf(ctx, "music_ost_4")).toHaveLength(1);
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
