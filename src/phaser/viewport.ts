/**
 * The 440-px logical canvas on a Phaser canvas (what useFitScale + `.game { transform: scale(k) }`
 * did). The backing canvas is the viewport times the device pixel ratio, drawn at CSS size, so
 * nothing is blurred by the browser; every scene's camera zooms by Z = k * dpr from its top-left
 * corner, so every scene lays out in logical px and never sees k. Pointer worldX/worldY are
 * therefore logical px too.
 *
 * Crispness: the art is one 3x file per sprite, drawn smoothed while the game is downscaled
 * (k < 1, a phone) and NEAREST once it is upscaled (k >= 1, a desktop window) — the rule
 * `.game.upscaled` used to apply. Text is rasterised at Z so it is crisp at any zoom.
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

/** The art textures (every loaded image): smoothed when downscaled, nearest-neighbour when upscaled. */
export function applyArtFilter(game: Phaser.Game, keys: readonly string[]): void {
  const mode = fit().k >= 1 ? Phaser.Textures.FilterMode.NEAREST : Phaser.Textures.FilterMode.LINEAR;
  for (const key of keys) if (game.textures.exists(key)) game.textures.get(key).setFilter(mode);
}
