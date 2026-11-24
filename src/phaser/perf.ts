/**
 * `?perf=1`: a frame-time instrument for the real device (it works in a production build, not only
 * DEV). A DOM overlay — not drawn on the canvas, so it never dirties a frame itself — shows the
 * last second, and `window.__perf` hands the whole run to a script or the console:
 *
 *   __perf.report()   frames, drawn frames, fps, frame interval and main-thread work per frame
 *                     (p50/p95/p99/max), draw calls and texture uploads per drawn frame, long tasks,
 *                     live tweens at the peak, and how long frames keep being drawn once the
 *                     last tween has ended (render on demand going idle)
 *   __perf.reset()    start a new measurement window
 *
 * "work" is the time inside one game-loop callback (update + draw submission): the part of a
 * frame this code is responsible for. "interval" is the time between callbacks: what the player
 * sees, including the browser's own work and anything that blocked the main thread. A long task
 * is any main-thread task over 50 ms (PerformanceObserver where supported, else a frame gap).
 *
 * Draw calls and uploads are counted by wrapping the renderer's draw entry points and the GL
 * context's texImage2D / texSubImage2D, only when ?perf is on. Nothing here runs otherwise.
 */
import Phaser from "phaser";

export interface PerfReport {
  seconds: number;
  frames: number;
  drawn: number;
  fps: number;
  interval: Stats;
  work: Stats;
  drawCalls: Stats & { histogram: Record<number, number> };
  uploads: { total: number; bytes: number; maxPerFrame: number; inFramesOver16ms: number };
  longTasks: { count: number; maxMs: number; totalMs: number };
  /** Frames whose interval was over 1.5x the median: a visible hitch. */
  hitches: number;
  /** Main-thread time of each AI move computed on the spot (store.actAi; none when a worker thinks). */
  ai: Stats & { count: number };
  /** Main-thread time of each dispatched action, including every scene's re-render of it (store.act). */
  act: Stats & { count: number };
  /** Tweens alive at once across the running scenes: the most, and the mean over frames that had any. */
  tweens: { peak: number; mean: number };
  /**
   * After the last tween of a burst ended, how long (ms) frames went on being drawn: from that
   * frame to the last one drawn before the first skipped one. Render on demand's idle tail, one
   * sample per burst.
   */
  idleTail: Stats & { count: number };
}

export interface Stats {
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

declare global {
  interface Window {
    __perf?: { report(): PerfReport; reset(): void };
  }
}

export const perfEnabled = (): boolean => new URLSearchParams(location.search).get("perf") === "1";

function stats(xs: readonly number[]): Stats {
  if (!xs.length) return { p50: 0, p95: 0, p99: 0, max: 0, mean: 0 };
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const r = (n: number) => Math.round(n * 100) / 100;
  return { p50: r(q(0.5)), p95: r(q(0.95)), p99: r(q(0.99)), max: r(s[s.length - 1]), mean: r(s.reduce((a, b) => a + b, 0) / s.length) };
}

/** What the instrument can time besides frames. */
export interface PerfHooks {
  /** Wrapped in place: every call is timed. */
  store?: { actAi: (seat: number, difficulty: never) => void; act: (a: never) => void };
}

/** Install after renderOnDemand (it wraps whatever loop callback is current). */
export function installPerf(game: Phaser.Game, hooks: PerfHooks = {}): void {
  let t0 = performance.now();
  let intervals: number[] = [];
  let works: number[] = [];
  let calls: number[] = [];
  let aiTimes: number[] = [];
  let actTimes: number[] = [];
  let frames = 0;
  let drawn = 0;
  let uploads = 0;
  let uploadBytes = 0;
  let maxUploads = 0;
  let uploadsInSlow = 0;
  let longCount = 0;
  let longMax = 0;
  let longTotal = 0;
  let lastCb = 0;
  // per-frame counters
  let frameCalls = 0;
  let frameUploads = 0;
  let didDraw = false;
  // tweens and the idle tail
  let tweenPeak = 0;
  let tweenSum = 0;
  let tweenFrames = 0;
  let lastTweenAt = 0;
  let lastDrawnAt = 0;
  let tails: number[] = [];

  const reset = () => {
    t0 = performance.now();
    intervals = [];
    works = [];
    calls = [];
    aiTimes = [];
    actTimes = [];
    frames = drawn = uploads = uploadBytes = maxUploads = uploadsInSlow = 0;
    longCount = longMax = longTotal = 0;
    tweenPeak = tweenSum = tweenFrames = lastTweenAt = lastDrawnAt = 0;
    tails = [];
  };

  // draw calls
  // SAFETY: Phaser 4.2's WebGLRenderer has drawElements / drawInstancedArrays methods and a `gl`
  // field; each is checked with typeof before it is wrapped, so a renderer without them (Canvas)
  // is left alone. Perf mode only.
  const renderer = game.renderer as unknown as Record<string, unknown> & { gl?: WebGLRenderingContext };
  for (const name of ["drawElements", "drawInstancedArrays"]) {
    const fn = renderer[name];
    if (typeof fn !== "function") continue;
    renderer[name] = function (this: unknown, ...args: unknown[]) {
      frameCalls++;
      return (fn as (...a: unknown[]) => unknown).apply(this, args);
    };
  }
  // texture uploads (a canvas texture refresh, a Text re-raster, a first-use painted texture)
  const gl = renderer.gl as (WebGLRenderingContext & Record<string, unknown>) | undefined;
  if (gl) {
    for (const name of ["texImage2D", "texSubImage2D"]) {
      const fn = gl[name] as ((...a: unknown[]) => unknown) | undefined;
      if (typeof fn !== "function") continue;
      gl[name] = function (this: unknown, ...args: unknown[]) {
        frameUploads++;
        uploads++;
        const src = args.find((a) => typeof a === "object" && a !== null && "width" in (a as object)) as { width: number; height: number } | undefined;
        if (src) uploadBytes += src.width * src.height * 4;
        return fn.apply(this, args);
      };
    }
  }

  const store = hooks.store;
  if (store) {
    const actAi = store.actAi;
    store.actAi = (seat, difficulty) => {
      const s0 = performance.now();
      actAi(seat, difficulty);
      aiTimes.push(performance.now() - s0);
    };
    const act = store.act;
    store.act = (a) => {
      const s0 = performance.now();
      act(a);
      actTimes.push(performance.now() - s0);
    };
  }

  game.events.on(Phaser.Core.Events.PRE_RENDER, () => {
    didDraw = true;
  });

  const inner = game.loop.callback;
  game.loop.callback = (time: number, delta: number) => {
    const start = performance.now();
    if (lastCb) intervals.push(start - lastCb);
    lastCb = start;
    frameCalls = 0;
    frameUploads = 0;
    didDraw = false;
    inner(time, delta);
    const work = performance.now() - start;
    frames++;
    works.push(work);
    if (didDraw) {
      drawn++;
      calls.push(frameCalls);
    }
    maxUploads = Math.max(maxUploads, frameUploads);
    let live = 0;
    for (const sc of game.scene.getScenes(true)) live += sc.tweens.getTweens().length;
    const now = performance.now();
    if (live > 0) {
      tweenPeak = Math.max(tweenPeak, live);
      tweenSum += live;
      tweenFrames++;
      lastTweenAt = now;
    } else if (lastTweenAt && didDraw) {
      lastDrawnAt = now;
    } else if (lastTweenAt) {
      // the first frame not drawn since the burst's last tween: the tail ran to the last drawn one
      tails.push(Math.max(0, lastDrawnAt - lastTweenAt));
      lastTweenAt = 0;
    }
    if (frameUploads && work > 16) uploadsInSlow++;
    // a frame gap stands in for a long task where PerformanceObserver cannot see them (WebKit)
    if (!longTaskObserved && intervals.length && intervals[intervals.length - 1] > 50 && !document.hidden) {
      const gap = intervals[intervals.length - 1];
      longCount++;
      longMax = Math.max(longMax, gap);
      longTotal += gap;
    }
  };

  let longTaskObserved = false;
  try {
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        longCount++;
        longMax = Math.max(longMax, e.duration);
        longTotal += e.duration;
      }
    });
    po.observe({ type: "longtask", buffered: false });
    longTaskObserved = PerformanceObserver.supportedEntryTypes?.includes("longtask") ?? false;
  } catch {
    longTaskObserved = false;
  }
  // a hidden tab is not a hitch
  document.addEventListener("visibilitychange", () => {
    lastCb = 0;
  });

  const report = (): PerfReport => {
    const seconds = (performance.now() - t0) / 1000;
    const iv = stats(intervals);
    return {
      seconds: Math.round(seconds * 10) / 10,
      frames,
      drawn,
      fps: Math.round((frames / Math.max(seconds, 0.001)) * 10) / 10,
      interval: iv,
      work: stats(works),
      drawCalls: { ...stats(calls), histogram: calls.reduce<Record<number, number>>((h, c) => ((h[c] = (h[c] ?? 0) + 1), h), {}) },
      uploads: { total: uploads, bytes: uploadBytes, maxPerFrame: maxUploads, inFramesOver16ms: uploadsInSlow },
      longTasks: { count: longCount, maxMs: Math.round(longMax), totalMs: Math.round(longTotal) },
      hitches: intervals.filter((x) => x > iv.p50 * 1.5).length,
      ai: { ...stats(aiTimes), count: aiTimes.length },
      act: { ...stats(actTimes), count: actTimes.length },
      tweens: { peak: tweenPeak, mean: tweenFrames ? Math.round((tweenSum / tweenFrames) * 10) / 10 : 0 },
      idleTail: { ...stats(tails), count: tails.length },
    };
  };
  window.__perf = { report, reset };

  // the overlay: last-second numbers, twice a second
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;left:4px;top:4px;z-index:9999;pointer-events:none;font:11px/1.3 ui-monospace,Menlo,monospace;" +
    "color:#e8e2d0;background:rgba(0,0,0,.65);padding:4px 6px;border-radius:4px;white-space:pre";
  document.body.appendChild(box);
  let mark = { frames: 0, drawn: 0, i: 0, w: 0, c: 0, up: 0, t: performance.now() };
  setInterval(() => {
    const now = performance.now();
    const secs = (now - mark.t) / 1000;
    const iv = stats(intervals.slice(mark.i));
    const wk = stats(works.slice(mark.w));
    const dc = stats(calls.slice(mark.c));
    box.textContent =
      `fps ${((frames - mark.frames) / secs).toFixed(0)}  drawn ${((drawn - mark.drawn) / secs).toFixed(0)}/s\n` +
      `frame p95 ${iv.p95.toFixed(1)}  max ${iv.max.toFixed(1)} ms\n` +
      `work  p95 ${wk.p95.toFixed(2)}  max ${wk.max.toFixed(2)} ms\n` +
      `draws ${dc.max}  uploads ${uploads - mark.up}  long ${longCount}\n` +
      `tweens peak ${tweenPeak}  idle tail p95 ${stats(tails).p95.toFixed(0)} ms`;
    mark = { frames, drawn, i: intervals.length, w: works.length, c: calls.length, up: uploads, t: now };
  }, 500);
}
