/**
 * The saloon's surfaces, painted on a whole-px grid so they sit with the pixel-art props:
 * striped wallpaper with a small diamond motif, a chair rail over plank wainscoting, and
 * floorboards. Seeded, so the same size always paints the same room (and painted() caches it).
 */

/** A small deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rect = (ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number): void => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

export interface WallPalette {
  paper: string;
  paperStripe: string;
  motif: string;
  trim: string;
  trimLight: string;
  trimDark: string;
  plank: readonly string[];
  seam: string;
  floor: readonly string[];
  floorSeam: string;
}

export const SALOON_WALL: WallPalette = {
  paper: "#4a1c17",
  paperStripe: "#561f19",
  motif: "#7a3a22",
  trim: "#6b4424",
  trimLight: "#8f6234",
  trimDark: "#2a170b",
  plank: ["#4f3019", "#55341b", "#4a2d17", "#5a381e"],
  seam: "#24140a",
  floor: ["#5c3a1e", "#634020", "#56361c", "#6a4523"],
  floorSeam: "#2a180b",
};

/** Striped wallpaper with a diamond in every other stripe, `stripe` px wide. */
export function wallpaper(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: WallPalette = SALOON_WALL, stripe = 12): void {
  rect(ctx, p.paper, x, y, w, h);
  for (let i = 0, sx = x; sx < x + w; i++, sx += stripe) {
    if (i % 2) rect(ctx, p.paperStripe, sx, y, stripe, h);
    else {
      // a 5-px diamond every 18 px down the plain stripe, offset on alternate stripes
      const cx = sx + Math.floor(stripe / 2);
      for (let dy = (i % 4 === 0 ? 6 : 15); dy < h; dy += 18) {
        const cy = y + dy;
        rect(ctx, p.motif, cx, cy - 2, 1, 5);
        rect(ctx, p.motif, cx - 1, cy - 1, 3, 3);
        rect(ctx, p.motif, cx - 2, cy, 5, 1);
      }
      rect(ctx, p.paperStripe, sx, y, 1, h);
    }
  }
}

/** A chair rail: a lit top edge, the moulding, a dark shadow line under it. */
export function chairRail(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, p: WallPalette = SALOON_WALL): number {
  rect(ctx, p.trimLight, x, y, w, 1);
  rect(ctx, p.trim, x, y + 1, w, 3);
  rect(ctx, p.trimDark, x, y + 4, w, 1);
  return 5;
}

/** Vertical wainscot planks, `plank` px wide, with seams, a sliver of light, grain and nails. */
export function wainscot(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: WallPalette = SALOON_WALL, plank = 14, seed = 7): void {
  const r = rng(seed);
  for (let px = x; px < x + w; px += plank) {
    const pw = Math.min(plank, x + w - px);
    rect(ctx, p.plank[Math.floor(r() * p.plank.length)], px, y, pw, h);
    rect(ctx, p.seam, px, y, 1, h);
    rect(ctx, "rgba(255,220,160,0.06)", px + 1, y, 1, h);
    // a few grain streaks
    for (let k = 0; k < 3; k++) {
      const gx = px + 3 + Math.floor(r() * Math.max(1, pw - 5));
      const gy = y + Math.floor(r() * Math.max(1, h - 10));
      rect(ctx, "rgba(0,0,0,0.18)", gx, gy, 1, 4 + Math.floor(r() * 10));
    }
    // nails near the top and bottom
    if (h > 14) {
      rect(ctx, "rgba(0,0,0,0.45)", px + Math.floor(pw / 2), y + 3, 1, 1);
      rect(ctx, "rgba(0,0,0,0.45)", px + Math.floor(pw / 2), y + h - 4, 1, 1);
    }
  }
}

/** Horizontal floorboards seen from above the skirting: rows `row` px tall, staggered seams. */
export function floorboards(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: WallPalette = SALOON_WALL, row = 6, seed = 11): void {
  const r = rng(seed);
  // the skirting board where wall meets floor
  rect(ctx, p.trimDark, x, y, w, 2);
  rect(ctx, p.trim, x, y + 2, w, 1);
  for (let ry = y + 3, i = 0; ry < y + h; ry += row, i++) {
    const rh = Math.min(row, y + h - ry);
    let bx = x - Math.floor(r() * 40);
    while (bx < x + w) {
      const bw = 34 + Math.floor(r() * 40);
      const sx = Math.max(x, bx);
      const ex = Math.min(x + w, bx + bw);
      if (ex > sx) {
        rect(ctx, p.floor[Math.floor(r() * p.floor.length)], sx, ry, ex - sx, rh);
        rect(ctx, "rgba(255,220,160,0.07)", sx, ry, ex - sx, 1);
        if (bx >= x) rect(ctx, p.floorSeam, bx, ry, 1, rh);
      }
      bx += bw;
    }
    rect(ctx, p.floorSeam, x, ry + rh - 1, w, 1);
  }
}

/** Warm light pooled round a wall lamp at (cx, cy). */
export function lampGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, alpha = 0.35): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, `rgba(240, 180, 87, ${alpha})`);
  g.addColorStop(1, "rgba(240, 180, 87, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

/** A whole room wall: paper above, a rail at `railY`, wainscot to `floorY`, boards below. */
export function saloonWall(ctx: CanvasRenderingContext2D, w: number, h: number, railY: number, floorY: number, p: WallPalette = SALOON_WALL): void {
  wallpaper(ctx, 0, 0, w, railY, p);
  const rail = chairRail(ctx, 0, railY, w, p);
  wainscot(ctx, 0, railY + rail, w, floorY - railY - rail, p);
  rect(ctx, "rgba(0,0,0,0.35)", 0, railY + rail, w, 2); // the rail's shadow on the planks
  floorboards(ctx, 0, floorY, w, h - floorY, p);
}
