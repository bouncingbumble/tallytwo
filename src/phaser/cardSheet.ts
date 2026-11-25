/**
 * The card sheet: every texture a card is drawn from, in ONE power-of-two canvas texture, built
 * once at boot from the loaded atlas.
 *
 * Why one texture. On iOS and Android Phaser batches one texture per draw (autoMobileTextures),
 * so a card drawn as shadow + face + ring from three textures cost up to three draw calls, and a
 * hand + trick ~80 per frame. From one sheet the cards are one batch.
 *
 * Why a gutter. Each face cell is copied with PAD transparent texels round it and GUTTER more
 * between neighbours: linear filtering and mipmaps never pull a neighbouring card into an edge,
 * and the card's own edge is inside its quad, so a rotated card (a deal, a play in flight) is
 * anti-aliased by the texture filter — which is what lets the game run without MSAA.
 *
 * Why power of two. WebGL 1 only mipmaps POT textures; the 3744x1536 atlas cannot have mipmaps,
 * so a 72x96 play card, drawn from ~2x its size on a phone, would shimmer. 4096x2048 can.
 *
 * Frames: `face-<card>`, `back`, and per card size `shadow-WxH`, `shadow-deep-WxH`,
 * `ring-in-WxH`, `ring-out-WxH`. Every frame carries its pad: draw it with sheetImage().
 */
import type Phaser from "phaser";
import { ATLAS_COLS, ATLAS_ROWS, CELL_H, CELL_W } from "../render/atlas";
import { PLAY_CARD_H, PLAY_CARD_W } from "../render/scale";
import { CARD_H, CARD_W } from "../render/fanLayout";

export const SHEET_KEY = "cardsheet";
export const SHEET_W = 4096;
export const SHEET_H = 2048;
/** The atlas and the back are 3x the card art. */
const ART = 3;
/** Transparent texels round each face inside its frame: one art px. */
export const FACE_PAD = ART;
/** Transparent texels between frames (beyond each frame's own pad). */
const GUTTER = 8;

/** A painted frame: `draw` paints a w x h logical box at `res` texels per logical px, with `pad` logical px round it. */
export interface PaintedFrame {
  key: string;
  w: number;
  h: number;
  pad: number;
  res: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

/** Where a frame's pad puts its box: the logical pad to offset by and the full display size. */
export interface FrameGeom {
  pad: number;
}

const geom = new Map<string, FrameGeom>();

/** The card sizes the game draws: the hand's and the trick's (the how-to sheet uses the trick's). */
export const CARD_SIZES: readonly (readonly [number, number])[] = [
  [CARD_W, CARD_H],
  [PLAY_CARD_W, PLAY_CARD_H],
];

/**
 * Build (or rebuild) the sheet from the loaded atlas + back textures and the painted frames.
 * Returns false when the source images are missing (the caller then keeps the old textures).
 */
export function buildCardSheet(scene: Phaser.Scene, atlasKey: string, backKey: string, painted: readonly PaintedFrame[]): boolean {
  const tm = scene.textures;
  if (!tm.exists(atlasKey) || !tm.exists(backKey)) return false;
  const atlas = tm.get(atlasKey).getSourceImage() as CanvasImageSource;
  const back = tm.get(backKey).getSourceImage() as CanvasImageSource;
  if (tm.exists(SHEET_KEY)) tm.remove(SHEET_KEY);
  const tex = tm.createCanvas(SHEET_KEY, SHEET_W, SHEET_H);
  if (!tex) return false;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, SHEET_W, SHEET_H);
  ctx.imageSmoothingEnabled = false;
  geom.clear();

  const cw = CELL_W * ART;
  const ch = CELL_H * ART;
  const fw = cw + 2 * FACE_PAD;
  const fh = ch + 2 * FACE_PAD;
  const pitchX = fw + GUTTER;
  const pitchY = fh + GUTTER;
  // the 52 faces, frame `face-<atlas index>`, in the atlas's own grid order
  for (let row = 0; row < ATLAS_ROWS; row++) {
    for (let col = 0; col < ATLAS_COLS; col++) {
      const x = GUTTER / 2 + col * pitchX;
      const y = GUTTER / 2 + row * pitchY;
      ctx.drawImage(atlas, col * cw, row * ch, cw, ch, x + FACE_PAD, y + FACE_PAD, cw, ch);
      tex.add(`face-${row * ATLAS_COLS + col}`, 0, x, y, fw, fh);
    }
  }
  // a shelf below the faces: the back, then the painted frames
  let x = GUTTER / 2;
  let y = GUTTER / 2 + ATLAS_ROWS * pitchY;
  let shelfH = 0;
  const place = (w: number, h: number): [number, number] => {
    if (x + w > SHEET_W) {
      x = GUTTER / 2;
      y += shelfH + GUTTER;
      shelfH = 0;
    }
    if (y + h > SHEET_H) throw new Error(`card sheet: no room for a ${w}x${h} frame`);
    const at: [number, number] = [x, y];
    x += w + GUTTER;
    shelfH = Math.max(shelfH, h);
    return at;
  };
  {
    const [bx, by] = place(fw, fh);
    ctx.drawImage(back, 0, 0, cw, ch, bx + FACE_PAD, by + FACE_PAD, cw, ch);
    tex.add("back", 0, bx, by, fw, fh);
  }
  ctx.imageSmoothingEnabled = true;
  for (const f of painted) {
    const W = Math.ceil((f.w + 2 * f.pad) * f.res);
    const H = Math.ceil((f.h + 2 * f.pad) * f.res);
    const [px, py] = place(W, H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, W, H);
    ctx.clip();
    ctx.translate(px, py);
    ctx.scale(f.res, f.res);
    ctx.translate(f.pad, f.pad);
    f.draw(ctx, f.w, f.h);
    ctx.restore();
    tex.add(f.key, 0, px, py, W, H);
    geom.set(f.key, { pad: f.pad });
  }
  tex.refresh();
  return true;
}

/** True once the sheet exists (CardView falls back to the separate textures before that). */
export const hasSheet = (scene: Phaser.Scene): boolean => scene.textures.exists(SHEET_KEY);

/**
 * An Image of sheet frame `frame` whose BOX (the frame minus its pad) is `w` x `h` logical px with
 * its top-left at (x, y). Faces carry FACE_PAD texels of an art-px-sized cell; painted frames
 * carry the logical pad they were painted with.
 */
export function sheetImage(scene: Phaser.Scene, frame: string, x: number, y: number, w: number, h: number): Phaser.GameObjects.Image {
  const painted = geom.get(frame);
  let padX: number;
  let padY: number;
  if (painted) {
    padX = padY = painted.pad;
  } else {
    // a face or the back: the pad is FACE_PAD texels of a (CELL_W * ART)-texel-wide cell drawn w wide
    padX = (FACE_PAD * w) / (CELL_W * ART);
    padY = (FACE_PAD * h) / (CELL_H * ART);
  }
  return scene.add
    .image(x - padX, y - padY, SHEET_KEY, frame)
    .setOrigin(0, 0)
    .setDisplaySize(w + 2 * padX, h + 2 * padY);
}
