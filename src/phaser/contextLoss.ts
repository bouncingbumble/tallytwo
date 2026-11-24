/**
 * A lost WebGL context (docs/MOBILE_UX_PLAN.md §8): iOS drops it when the app is backgrounded
 * under memory pressure, and a GPU reset drops it anywhere. Phaser 4 keeps every texture's source
 * (the art images; every painted() texture, the card sheet and each Text is a canvas) and on
 * `webglcontextrestored` re-creates the GPU textures from them, so nothing is baked again here.
 * What the game adds:
 *
 * - while the context is gone the table is paused (`glLost`, read by the director): the player
 *   cannot see the AI move;
 * - on restore, the art filters (viewport.ts applyArtFilter) are put back on the new textures and
 *   a frame is forced, since render on demand would otherwise wait for the next change to draw.
 */
import Phaser from "phaser";
import { Value } from "../game/observable";
import { ART_KEYS } from "./scenes/Boot";
import { markDirty } from "./onDemand";
import { applyArtFilter } from "./viewport";

/** True while the WebGL context is lost. */
export const glLost = new Value(false);

export function guardContext(game: Phaser.Game): void {
  const r = game.renderer;
  if (!(r instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
  r.on(Phaser.Renderer.Events.LOSE_WEBGL, () => glLost.set(true));
  r.on(Phaser.Renderer.Events.RESTORE_WEBGL, () => {
    applyArtFilter(game, ART_KEYS);
    glLost.set(false);
    markDirty();
  });
}
