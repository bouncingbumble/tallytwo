/**
 * The browser around the game, as plain observables: the fit of the 440-px logical canvas to
 * the viewport, the device pixel ratio, a hidden tab, an upright phone, the notch side and the
 * safe-area insets. WEB bucket.
 */
import { Value } from "../game/observable";
import { type FitScale, fitScale } from "../render/scale";
import { bridge } from "./bridge";
import { type NotchSide, notchSideFor } from "./notch";

export type { NotchSide };

/** A canvas at least this wide shows the title's corner decor. */
export const WIDE_W = 900;

export interface Fit extends FitScale {
  /** Viewport in CSS px. */
  vw: number;
  vh: number;
  /** window.devicePixelRatio, capped at 3 (a 4x backing store buys nothing and costs memory). */
  dpr: number;
}

function readFit(): Fit {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return { ...fitScale(vw, vh), vw, vh, dpr: Math.min(3, Math.max(1, window.devicePixelRatio || 1)) };
}

function angle(): number {
  const legacy = (window as { orientation?: unknown }).orientation;
  if (typeof legacy === "number") return legacy;
  return screen.orientation?.angle ?? 0;
}

/** The game is played sideways: held upright, the rotate gate shows. */
const PORTRAIT_BLOCK_QUERY = "(orientation: portrait)";
const upright = (): boolean => (typeof window.matchMedia === "function" ? window.matchMedia(PORTRAIT_BLOCK_QUERY).matches : false);

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The browser's env(safe-area-inset-*) in CSS px, read through a probe element. */
let probe: HTMLDivElement | null = null;
function envInsets(): Insets {
  if (!probe) {
    probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
      "padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  const px = (v: string): number => Math.max(0, parseFloat(v) || 0);
  return { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) };
}

/** The host's insets when a shell sent them, else the browser's; physical CSS px. */
const readInsets = (): Insets => bridge.insets ?? envInsets();

const sameInsets = (a: Insets, b: Insets): boolean => a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;

export const env = {
  fit: new Value<Fit>(readFit()),
  hidden: new Value<boolean>(document.hidden),
  upright: new Value<boolean>(upright()),
  notch: new Value<NotchSide>(notchSideFor(angle())),
  insets: new Value<Insets>({ top: 0, right: 0, bottom: 0, left: 0 }),
  shellPaused: new Value<boolean>(bridge.paused),
};

function refresh(): void {
  // the flags first, the fit last: the director decides what runs before it rebuilds at the new size
  env.upright.set(upright());
  env.notch.set(notchSideFor(angle()));
  const ins = readInsets();
  if (!sameInsets(ins, env.insets.get())) env.insets.set(ins);
  const f = readFit();
  const old = env.fit.get();
  if (f.vw !== old.vw || f.vh !== old.vh || f.dpr !== old.dpr) env.fit.set(f);
}

let installed = false;
/** Start listening. Called once from main.ts. */
export function installEnv(): void {
  if (installed) return;
  installed = true;
  env.insets.set(readInsets());
  window.addEventListener("resize", refresh);
  window.visualViewport?.addEventListener("resize", refresh);
  window.addEventListener("orientationchange", () => {
    refresh();
    // iOS updates innerWidth/innerHeight a beat after the event
    setTimeout(refresh, 250);
  });
  screen.orientation?.addEventListener?.("change", refresh);
  window.matchMedia?.(PORTRAIT_BLOCK_QUERY).addEventListener?.("change", refresh);
  document.addEventListener("visibilitychange", () => env.hidden.set(document.hidden));
  bridge.on("pause", () => env.shellPaused.set(true));
  bridge.on("resume", () => env.shellPaused.set(false));
  bridge.on("insets", refresh);
}
