/**
 * AudioPort on the Web Audio API (WEB bucket). One AudioContext, created on the first init() —
 * the title buttons call it from a trusted click, which is the gesture iOS wants — three
 * GainNode buses (music, sfx, ambience) into the destination, every SFX decoded eagerly, the
 * four loops decoded the first time they are wanted and started through musicLatch, so a
 * request that lands before its buffer exists still starts and a change of mind before then
 * still cancels. Every number is sfxTable's.
 *
 * Failure contract (port.ts): init() never rejects and is idempotent; a file that will not
 * fetch or decode is dropped with one console.warn; play() of an empty pool is a no-op.
 *
 * Graph: sfx source -> per-event gain (SFX gain) -> sfx bus; loop source -> per-loop gain
 * (MUSIC gain, faded) -> duck -> music bus (ambience: -> ambience bus); bus -> destination.
 * The buses carry the user's volume x on/off and nothing else.
 *
 * One music loop at a time, and a switch is never a crossfade (FADE): the playing loop fades
 * out, and the next one is scheduled to start — and fade in — on the Web Audio clock at the
 * moment the fade-out ends. "tension" is a switch too: while setTension(true) it plays in
 * place of "table", and the table comes back the same way.
 *
 * The constructor options exist so a test can inject fakes. The *Like interfaces are the
 * subset of the DOM types this file touches; a real AudioContext satisfies them as is.
 */
import { MANIFEST } from "../assets/manifest";
import type { AssetName } from "../assets/names";
import { createMusicLatch, type LatchCommand } from "./musicLatch";
import { pickVariant } from "./pool";
import type { AudioPort, Bus } from "./port";
import { DEAL_ROLL, DUCK, FADE, JITTER, MUSIC, type MusicLayer, type MusicTrack, SFX, SFX_EVENTS, type SfxEvent } from "./sfxTable";

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, startTime: number): unknown;
  linearRampToValueAtTime(value: number, endTime: number): unknown;
  setTargetAtTime(target: number, startTime: number, timeConstant: number): unknown;
  cancelScheduledValues(cancelTime: number): unknown;
}
export interface AudioNodeLike {
  connect(destination: AudioNodeLike): unknown;
}
export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}
export interface AudioBufferLike {
  readonly duration: number;
}
export interface BufferSourceLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  readonly playbackRate: AudioParamLike;
  start(when?: number): void;
  stop(when?: number): void;
}
export interface AudioContextLike {
  readonly currentTime: number;
  /** "suspended" | "running" | "closed", plus iOS Safari's "interrupted". */
  readonly state: string;
  readonly destination: AudioNodeLike;
  createGain(): GainNodeLike;
  createBufferSource(): BufferSourceLike;
  decodeAudioData(data: ArrayBuffer): Promise<AudioBufferLike>;
  resume(): Promise<void>;
  suspend(): Promise<void>;
}
export interface FetchResponseLike {
  readonly ok: boolean;
  readonly status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}
/** What this file needs from fetch; globalThis.fetch satisfies it. */
export type FetchLike = (url: string) => Promise<FetchResponseLike>;

export interface WebAudioOptions {
  createContext?: () => AudioContextLike;
  fetchFn?: FetchLike;
  urls?: Record<AssetName, string>;
}

interface Loop {
  source: BufferSourceLike;
  gain: GainNodeLike;
  /** Context time the source is scheduled to start; before it, the loop has never sounded. */
  startsAt: number;
}

/** The main music: one of these at a time. */
type MainTrack = Exclude<MusicLayer, "ambience">;

const FADE_OUT_S = FADE.outMs / 1000;
const FADE_IN_S = FADE.inMs / 1000;
/**
 * DUCK is written in the prototype's absolute terms (.30 -> .12, where .30 was the music
 * element's volume). Here each loop's own gain holds the .30, so the duck node carries the ratio.
 */
const DUCK_RATIO = DUCK.to / DUCK.from;
const swallow = (): void => {};

export class WebAudio implements AudioPort {
  private readonly createContext: () => AudioContextLike;
  private readonly fetchFn: FetchLike;
  private readonly urls: Record<AssetName, string>;

  private ctx: AudioContextLike | null = null;
  private initPromise: Promise<void> | null = null;
  private buses: Record<Bus, GainNodeLike> | null = null;
  private duckNode: GainNodeLike | null = null;
  /** Remembered from before init() so the buses are born at the user's levels. */
  private readonly busLevels: Record<Bus, number> = { music: 1, sfx: 1, ambience: 1 };
  private duckedAt = 0;

  private readonly pools = new Map<SfxEvent, AudioBufferLike[]>();
  private readonly last = new Map<SfxEvent, number>();
  private readonly sfxGains = new Map<SfxEvent, GainNodeLike>();

  private readonly buffers = new Map<MusicLayer, AudioBufferLike>();
  private readonly decoding = new Set<MusicLayer>();
  /** Loops whose file would not fetch or decode this session: never waited for again. */
  private readonly dropped = new Set<MusicLayer>();
  private readonly loops = new Map<MusicLayer, Loop>();
  private readonly main = createMusicLatch<MainTrack>();
  private readonly ambience = createMusicLatch<"ambience">();
  /** What the game asked for; with tension on, "table" plays as "tension". */
  private track: MusicTrack | null = null;
  private tensionOn = false;
  /** Context time the last music fade-out ends: no music loop starts before it. */
  private fadingUntil = 0;
  /** suspend() was asked for (hidden tab, landscape): play() must not wake the context until resume(). */
  private held = false;

  constructor(opts: WebAudioOptions = {}) {
    this.createContext = opts.createContext ?? (() => new AudioContext());
    // Wrapped, not passed bare: fetch called with a foreign `this` is an "Illegal invocation".
    this.fetchFn = opts.fetchFn ?? ((url) => fetch(url));
    this.urls = opts.urls ?? MANIFEST;
  }

  init(): Promise<void> {
    this.initPromise ??= this.boot().catch((e: unknown) => {
      console.warn(`audio: init failed, the game stays silent (${String(e)})`);
    });
    return this.initPromise;
  }

  play(event: SfxEvent): void {
    const ctx = this.ctx;
    const pool = this.pools.get(event);
    const into = this.sfxGains.get(event);
    if (!ctx || !pool?.length || !into) return; // before init() resolved, or a dropped pool: silent
    this.wake();
    const i = pickVariant(pool.length, this.last.get(event) ?? -1, Math.random);
    this.last.set(event, i);
    const source = ctx.createBufferSource();
    source.buffer = pool[i];
    source.playbackRate.value = 1 + (Math.random() * 2 - 1) * JITTER;
    source.connect(into);
    source.start();
    if (SFX[event].ducks) this.duck();
  }

  dealRoll(): void {
    this.play("shuffle");
    for (let k = 0; k < DEAL_ROLL.ticks; k++) setTimeout(() => this.play("deal"), DEAL_ROLL.first + k * DEAL_ROLL.every);
  }

  setMusic(track: MusicTrack | null): void {
    this.track = track;
    this.settleMain();
  }

  setTension(on: boolean): void {
    this.tensionOn = on;
    this.settleMain();
  }

  setBus(bus: Bus, gain: number): void {
    const level = Math.min(1, Math.max(0, gain));
    this.busLevels[bus] = level;
    if (this.buses) this.buses[bus].gain.value = level;
  }

  /** The music steps back under a slap and returns after the hold unless re-ducked (P:368-373). */
  duck(): void {
    const ctx = this.ctx;
    const node = this.duckNode;
    if (!ctx || !node) return;
    this.duckedAt = Date.now();
    node.gain.setTargetAtTime(DUCK_RATIO, ctx.currentTime, DUCK.attackS);
    setTimeout(() => {
      if (Date.now() - this.duckedAt >= DUCK.rearmMs) node.gain.setTargetAtTime(1, ctx.currentTime, DUCK.attackS);
    }, DUCK.holdMs);
  }

  suspend(): void {
    this.held = true;
    const ctx = this.ctx;
    if (ctx) void ctx.suspend().catch(swallow);
  }

  resume(): void {
    this.held = false;
    this.wake();
  }

  /* ---- internals ---- */

  private async boot(): Promise<void> {
    const ctx = this.createContext();
    this.ctx = ctx;
    if (import.meta.env.DEV && typeof window !== "undefined") {
      // Installed here, not in the constructor: under StrictMode useMemo builds a second, discarded
      // instance, and the probe must belong to the one that owns the context. M5 gate 4 watches
      // `duck` step .30 -> .12 -> .30. The shape is platform/globals.d.ts's.
      const probe = () => this.probe();
      window.__music = {
        get gain() {
          return probe();
        },
      };
    }
    const bus = (level: number): GainNodeLike => {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(ctx.destination);
      return g;
    };
    this.buses = { music: bus(this.busLevels.music), sfx: bus(this.busLevels.sfx), ambience: bus(this.busLevels.ambience) };
    const duck = ctx.createGain();
    duck.gain.value = 1;
    duck.connect(this.buses.music);
    this.duckNode = duck;
    for (const e of SFX_EVENTS) {
      const g = ctx.createGain();
      g.gain.value = SFX[e].gain;
      g.connect(this.buses.sfx);
      this.sfxGains.set(e, g);
    }
    this.wake(); // still inside the click's call stack: the unlock

    // Every SFX file once; a failure drops that file and nothing else.
    const names = [...new Set(SFX_EVENTS.flatMap((e) => SFX[e].files))];
    const settled = await Promise.allSettled(names.map((n) => this.load(ctx, n)));
    const decoded = new Map<AssetName, AudioBufferLike>();
    settled.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value) decoded.set(names[i], r.value);
    });
    for (const e of SFX_EVENTS) this.pools.set(e, SFX[e].files.flatMap((f) => decoded.get(f) ?? []));

    // The loops: ambience always, plus whatever was asked for before init.
    this.apply(this.ambience.want("ambience"));
    this.kick();
  }

  /** fetch + decode one file; null (and one warning) when it cannot be had. Never rejects. */
  private async load(ctx: AudioContextLike, name: AssetName): Promise<AudioBufferLike | null> {
    try {
      const f = this.fetchFn;
      const res = await f(this.urls[name]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch (e) {
      console.warn(`audio: ${name} dropped (${String(e)})`);
      return null;
    }
  }

  /**
   * ctx.resume() whenever it is not running: cheap, idempotent, and what iOS needs after an
   * interruption. Not while held: a deal tick landing after suspend() must not bring the music
   * back in a hidden tab — only resume() clears the hold.
   */
  private wake(): void {
    const ctx = this.ctx;
    if (this.held || !ctx || ctx.state === "running") return;
    void ctx.resume().catch(swallow);
  }

  /** Start decoding a loop the first time it is wanted; the latch hears of it when it lands. */
  private ensure(layer: MusicLayer): void {
    const ctx = this.ctx;
    if (!ctx || this.buffers.has(layer) || this.decoding.has(layer)) return;
    this.decoding.add(layer);
    void this.load(ctx, MUSIC[layer].file)
      .then((buffer) => {
        if (!buffer) {
          // dropped: the latch never hears of it; a dropped tension track hands the table back
          this.dropped.add(layer);
          this.settleMain();
          return;
        }
        this.buffers.set(layer, buffer);
        this.apply(this.landed(layer));
      })
      .catch((e: unknown) => console.warn(`audio: ${layer} could not start (${String(e)})`));
  }

  /** Decodes wanted before init() had a context. */
  private kick(): void {
    const track = this.main.wanted;
    if (track) this.ensure(track);
    if (this.ambience.wanted) this.ensure("ambience");
    this.prefetch();
  }

  private landed(layer: MusicLayer): LatchCommand<MusicLayer>[] {
    if (layer === "ambience") return this.ambience.decoded("ambience");
    return this.main.decoded(layer);
  }

  /** The one main loop wanted now: the game's track, or "tension" standing in for "table" (unless its file was dropped). */
  private settleMain(): void {
    const want: MainTrack | null = this.track === "table" && this.tensionOn && !this.dropped.has("tension") ? "tension" : this.track;
    this.apply(this.main.want(want));
    if (want) this.ensure(want);
    this.prefetch();
  }

  /**
   * A round needs both halves of the table/tension switch: decode the partner before it is
   * wanted, so the first switch of a session is scheduled at the fade-out's end like every later
   * one instead of leaving a gap while the file lands. ensure() is idempotent.
   */
  private prefetch(): void {
    if (this.track !== "table") return;
    this.ensure("table");
    this.ensure("tension");
  }

  /** Stops first, so a start in the same batch is scheduled after the fade-out they begin. */
  private apply(cmds: readonly LatchCommand<MusicLayer>[]): void {
    for (const c of cmds) if (c.op === "stop") this.stopLoop(c.track);
    for (const c of cmds) if (c.op === "start") this.startLoop(c.track);
  }

  /**
   * A fresh source + gain per start, so an instance still fading out never shares a node with
   * the next. A music loop starts when the current fade-out ends (now, if nothing is fading)
   * and fades in from there; the ambience loop starts now.
   */
  private startLoop(layer: MusicLayer): void {
    const ctx = this.ctx;
    const buffer = this.buffers.get(layer);
    const into = layer === "ambience" ? this.buses?.ambience : this.duckNode;
    if (!ctx || !buffer || !into) return;
    const spec = MUSIC[layer];
    const now = ctx.currentTime;
    const at = layer === "ambience" ? now : Math.max(now, this.fadingUntil);
    const gain = ctx.createGain();
    gain.connect(into);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = Math.min(buffer.duration, spec.loopEnd);
    source.connect(gain);
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(spec.gain, at + FADE_IN_S);
    source.start(at);
    this.loops.set(layer, { source, gain, startsAt: at });
  }

  /**
   * A loop that has sounded fades out over FADE.outMs and holds the next music start until it
   * is silent; one that has not started yet (or starts this very quantum) is simply cancelled.
   * The level the fade starts from is computed from the schedule this file wrote — never read
   * back from the AudioParam, whose `.value` after cancelScheduledValues is the last rendered
   * value in Chrome and WebKit but the timeline's (now cancelled) value in Firefox, and the
   * default 1.0 for a node that has never rendered.
   */
  private stopLoop(layer: MusicLayer): void {
    const ctx = this.ctx;
    const loop = this.loops.get(layer);
    if (!ctx || !loop) return;
    this.loops.delete(layer);
    const now = ctx.currentTime;
    loop.gain.gain.cancelScheduledValues(now);
    if (now <= loop.startsAt) {
      loop.gain.gain.setValueAtTime(0, now);
      loop.source.stop(now);
      return;
    }
    const end = now + FADE_OUT_S;
    const level = MUSIC[layer].gain * Math.min(1, (now - loop.startsAt) / FADE_IN_S); // where the fade-in has got to
    loop.gain.gain.setValueAtTime(level, now);
    loop.gain.gain.linearRampToValueAtTime(0, end);
    loop.source.stop(end);
    if (layer !== "ambience") this.fadingUntil = Math.max(this.fadingUntil, end);
  }

  /** DEV probe: the music bus, the duck envelope in the prototype's terms (.30 at rest, .12 under a slap), what plays. */
  private probe(): { bus: number; duck: number; track: string | null; playing: string[] } {
    return {
      bus: this.buses?.music.gain.value ?? this.busLevels.music,
      duck: DUCK.from * (this.duckNode?.gain.value ?? 1),
      track: this.main.playing,
      playing: [...this.loops.keys()],
    };
  }
}
