/**
 * The saloon props and portraits at their art size in logical px (what sprites.css's .sp-* rules
 * said): an art pixel each, the doors at exactly 2x. Each file holds 3x those pixels.
 */
import type Phaser from "phaser";
import type { AssetName } from "../assets/names";

export const ART_SIZE: Partial<Record<AssetName, readonly [number, number]>> = {
  doors_closed: [186, 158],
  doors_ajar: [186, 158],
  doors_open: [186, 158],
  sign_saloon: [90, 56],
  sign_hanging: [93, 55],
  sign_backdoor: [46, 40],
  back_bar: [240, 144],
  barrel: [48, 69],
  lamp: [31, 60],
  chips: [31, 40],
  chips_pile: [94, 48],
  painting: [86, 94],
  sconce: [38, 46],
  sconce_silver: [38, 47],
  plant: [40, 78],
  stool: [31, 66],
  stool_grey: [33, 66],
  piano: [96, 94],
  poker_table: [228, 87],
  fireplace: [79, 129],
  chair: [44, 72],
  p_marshal: [96, 104],
  p_outlaw: [96, 104],
  p_gambler: [96, 104],
  wanted: [61, 71],
};

/** A prop at its art size (or `w` x `h`), top-left at (x, y). */
export function art(scene: Phaser.Scene, x: number, y: number, name: AssetName, w?: number, h?: number): Phaser.GameObjects.Image {
  const [aw, ah] = ART_SIZE[name] ?? [32, 32];
  return scene.add
    .image(x, y, name)
    .setOrigin(0, 0)
    .setDisplaySize(w ?? aw, h ?? ah);
}

/** A prop standing on a floor line: its bottom at `floorY`. */
export function standing(scene: Phaser.Scene, x: number, floorY: number, name: AssetName): Phaser.GameObjects.Image {
  const [, ah] = ART_SIZE[name] ?? [32, 32];
  return art(scene, x, floorY - ah, name);
}
