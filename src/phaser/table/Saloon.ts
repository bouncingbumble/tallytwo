/**
 * The saloon behind the hand: a wall, a floor and a 900-px room of props, centred in the hand
 * strip by a whole px and clipped to it, so the fan covers it at thirteen cards and uncovers it
 * from both ends as the hand is played down. Furniture stands on the floor line (4 px up); the
 * back bar, the signs and the sconce hang from the top. The whole strip is one painted texture.
 */
import type Phaser from "phaser";
import type { AssetName } from "../../assets/names";
import type { Rect } from "../../render/tableLayout";
import { ART_SIZE } from "../art";
import { drawArt, insetStroke, painted, roundRect } from "../paint";

export const ROOM_W = 900;

/** [prop, left in the room, top (a number) or "floor" (bottom 4) or a bottom offset {b}]. */
const PROPS: readonly [AssetName, number, number | "floor" | { b: number }][] = [
  ["plant", 8, "floor"],
  ["stool_grey", 56, "floor"],
  ["piano", 92, "floor"],
  ["sign_backdoor", 194, 2],
  ["chair", 196, "floor"],
  ["barrel", 246, "floor"],
  ["chips", 282, "floor"],
  ["back_bar", 300, 0],
  ["stool", 330, "floor"],
  ["stool", 480, "floor"],
  ["sconce", 548, 4],
  ["sign_hanging", 622, 0],
  ["poker_table", 560, "floor"],
  ["fireplace", 800, { b: -4 }],
  ["chair", 852, "floor"],
];

export function drawSaloon(scene: Phaser.Scene, r: Rect): void {
  // ONE painted texture: the wall and floor, every prop (baked in sharp, drawArt), and the rim.
  // It was a background, ~15 prop Images and a rim: up to 17 draw calls a frame where Phaser
  // batches one texture per draw (iOS, Android), for a strip that never changes. It is cached
  // by size like every painted texture, so the title's table prewarm paints it before the deal.
  const left = Math.floor((r.w - ROOM_W) / 2);
  painted(scene, "saloon-baked", r.x, r.y, r.w, r.h, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#2b1a0d");
    g.addColorStop(0.76, "#1e1209");
    g.addColorStop(0.76, "#120b06");
    g.addColorStop(1, "#0d0804");
    ctx.fillStyle = g;
    roundRect(ctx, 0, 0, w, h, 6);
    ctx.fill();
    // the props, clipped to the strip's rounded box as the per-prop crops did
    ctx.save();
    roundRect(ctx, 0, 0, w, h, 6);
    ctx.clip();
    for (const [name, lx, place] of PROPS) {
      const [pw, ph] = ART_SIZE[name] ?? [32, 32];
      const x = left + lx;
      const y = place === "floor" ? h - 4 - ph : typeof place === "number" ? place : h - place.b - ph;
      if (x + pw <= 0 || x >= w || y + ph <= 0 || y >= h) continue;
      drawArt(scene, ctx, name, x, y, pw, ph);
    }
    ctx.restore();
    insetStroke(ctx, w, h, 6, 2, "#120a04");
  });
}
