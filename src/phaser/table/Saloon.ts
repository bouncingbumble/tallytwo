/**
 * The saloon behind the hand: a wall, a floor and a 900-px room of props, centred in the hand
 * strip by a whole px and clipped to it, so the fan covers it at thirteen cards and uncovers it
 * from both ends as the hand is played down. Furniture stands on the floor line (4 px up); the
 * back bar, the signs and the sconce hang from the top. Clipping is each prop's own crop, in
 * texture pixels, so no mask is needed.
 */
import type Phaser from "phaser";
import type { AssetName } from "../../assets/names";
import type { Rect } from "../../render/tableLayout";
import { ART_SIZE } from "../art";
import { insetStroke, painted, roundRect } from "../paint";

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
  painted(scene, "saloon", r.x, r.y, r.w, r.h, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#2b1a0d");
    g.addColorStop(0.76, "#1e1209");
    g.addColorStop(0.76, "#120b06");
    g.addColorStop(1, "#0d0804");
    ctx.fillStyle = g;
    roundRect(ctx, 0, 0, w, h, 6);
    ctx.fill();
  });
  const left = r.x + Math.floor((r.w - ROOM_W) / 2);
  const bottom = r.y + r.h;
  for (const [name, lx, place] of PROPS) {
    const [w, h] = ART_SIZE[name] ?? [32, 32];
    const x = left + lx;
    const y = place === "floor" ? bottom - 4 - h : typeof place === "number" ? r.y + place : bottom - place.b - h;
    // the part inside the strip
    const x0 = Math.max(x, r.x);
    const x1 = Math.min(x + w, r.x + r.w);
    const y0 = Math.max(y, r.y);
    const y1 = Math.min(y + h, r.y + r.h);
    if (x1 <= x0 || y1 <= y0) continue;
    const img = scene.add.image(x, y, name).setOrigin(0, 0).setDisplaySize(w, h);
    const sx = img.frame.width / w;
    const sy = img.frame.height / h;
    img.setCrop((x0 - x) * sx, (y0 - y) * sy, (x1 - x0) * sx, (y1 - y0) * sy);
  }
  painted(scene, "saloon-rim", r.x, r.y, r.w, r.h, (ctx, w, h) => insetStroke(ctx, w, h, 6, 2, "#120a04"));
}
