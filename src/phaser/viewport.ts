/**
 * The 440-px logical canvas on a Phaser canvas (what useFitScale + `.game { transform: scale(k) }`
 * did). The backing canvas is the viewport times the device pixel ratio, drawn at CSS size, so
 * nothing is blurred by the browser; every scene's camera zooms by Z = k * dpr from its top-left
 * corner, so every scene lays out in logical px and never sees k. Pointer worldX/worldY are
 * therefore logical px too.
 *
 * Crispness (docs/PERF_PLAN.md Phase 3):
 * - The art is one 3x file per sprite, so a texel is 1/3 of an art pixel and an art pixel covers
 *   Z device px. While Z <= 3 the art is being shrunk from 3x: plain LINEAR is a clean resample
 *   (and the card sheet has mipmaps for strong shrinking). Once Z > 3 the art is being enlarged:
 *   LINEAR would blur it and NEAREST at a fractional ratio makes some art pixels a device px
 *   wider than others (and shimmer as they move), so the texture gets Phaser 4's smoothPixelArt
 *   shader instead — square, even art pixels at any ratio, anti-aliased only between them.
 *   `?pixels=nearest|linear|smooth` overrides it for side-by-side comparison.
 * - Every quad whose transform chain has no rotation is snapped to whole device px
 *   (installCrispVertices), so art and text edges land on pixel boundaries instead of straddling
 *   them; a card mid-flight (rotated) is left unsnapped so it never wobbles. `?snap=0` turns it off.
 * - Text is rasterised at Z so it is crisp at any zoom.
 */
import Phaser from "phaser";
import { env, type Fit } from "../platform/env";

/** The current fit. */
export const fit = (): Fit => env.fit.get();

/** Device px per logical px. */
export const zoomOf = (f: Fit = fit()): number => f.k * f.dpr;

/** The resolution text and painted textures are rasterised at: Z, rounded up to a quarter, capped. */
export const resolution = (): number => Math.min(6, Math.max(1, Math.ceil(zoomOf() * 4) / 4));

/** The canvas width in logical px, floored. */
export const logicalW = (): number => Math.floor(fit().logicalWidth);

/** Size the backing canvas to the viewport at the device pixel ratio. */
export function sizeGame(game: Phaser.Game): void {
  const f = fit();
  game.scale.setZoom(1 / f.dpr);
  game.scale.resize(Math.round(f.vw * f.dpr), Math.round(f.vh * f.dpr));
}

/** A camera that maps logical px to the whole canvas. */
export function fitCamera(cam: Phaser.Cameras.Scene2D.Camera, game: Phaser.Game): void {
  cam.setViewport(0, 0, game.scale.width, game.scale.height);
  cam.setOrigin(0, 0);
  cam.setZoom(zoomOf());
  cam.setScroll(0, 0);
  cam.setRoundPixels(false);
}

/** Texels per art pixel in every art file (docs/ASSETS.md §7). */
const ART_TEXELS = 3;

export type PixelMode = "smooth" | "linear" | "nearest";

/** `?pixels=` (a comparison switch), else the rule above. */
export function pixelMode(f: Fit = fit()): PixelMode {
  const q = typeof location !== "undefined" ? new URLSearchParams(location.search).get("pixels") : null;
  if (q === "smooth" || q === "linear" || q === "nearest") return q;
  return zoomOf(f) > ART_TEXELS ? "smooth" : "linear";
}

/** The art textures (every loaded image and the card sheet): see the file comment. */
export function applyArtFilter(game: Phaser.Game, keys: readonly string[]): void {
  const mode = pixelMode();
  for (const key of keys) {
    if (!game.textures.exists(key)) continue;
    const tex = game.textures.get(key);
    tex.setSmoothPixelArt(mode === "smooth");
    tex.setFilter(mode === "nearest" ? Phaser.Textures.FilterMode.NEAREST : Phaser.Textures.FilterMode.LINEAR);
  }
}

/** The round-trip of a GameObject that willRoundVertices reads. */
interface Roundable {
  vertexRoundMode: string;
  rotation?: number;
  parentContainer?: Roundable | null;
}

/**
 * Snap unrotated quads to device px. Phaser 4 rounds a quad's corners (in device px) when the
 * object's `willRoundVertices` says so; its default ('safeAuto') only does it when the whole
 * transform, camera included, is a pure translation and camera.roundPixels is on — never here,
 * where every camera zooms by Z. This takes over 'safeAuto' (the default every object has): round when nothing from the
 * object up through its containers is rotated. Any other mode an object sets is left to Phaser.
 */
export function installCrispVertices(): void {
  if (typeof location !== "undefined" && new URLSearchParams(location.search).get("snap") === "0") return;
  // SAFETY: Phaser 4.2's GameObject.prototype has willRoundVertices(camera, onlyTranslated) and
  // each instance a string vertexRoundMode (default 'safeAuto'); the renderers call it per quad.
  const proto = Phaser.GameObjects.GameObject.prototype as unknown as { willRoundVertices: (this: Roundable, camera: unknown, onlyTranslated: boolean) => boolean };
  const original = proto.willRoundVertices;
  proto.willRoundVertices = function (this: Roundable, camera: unknown, onlyTranslated: boolean): boolean {
    if (this.vertexRoundMode !== "safeAuto") return original.call(this, camera, onlyTranslated);
    return !rotatedChain(this);
  };
}

/** Whether `obj` or any container above it is rotated. */
function rotatedChain(obj: Roundable): boolean {
  for (let o: Roundable | null | undefined = obj; o; o = o.parentContainer) if (o.rotation) return true;
  return false;
}
