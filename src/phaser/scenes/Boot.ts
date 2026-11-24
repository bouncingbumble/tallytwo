/**
 * Loads every image the scenes draw (from assets/manifest.ts, so Vite hashes the files), the
 * card atlas as a 13 x 4 spritesheet of 3x cells, and waits for the Rye font: Phaser rasterises a
 * Text once, so a font that lands late would leave the fallback glyphs on screen. Then hands
 * over to the director. Audio is not Phaser's: WebAudio.ts behind the AudioPort loads its own.
 */
import { MANIFEST } from "../../assets/manifest";
import type { AssetName } from "../../assets/names";
import { CELL_H, CELL_W } from "../../render/atlas";
import { ATLAS_KEY, BACK_KEY, cardFrames } from "../cards";
import { SHEET_KEY, buildCardSheet } from "../cardSheet";
import { C } from "../theme";
import { BaseScene } from "./base";

/** The art files are 3x the art's pixels (docs/ASSETS.md). */
export const ART_SCALE = 3;

/** Every image asset except the atlas and the back, by manifest name. */
export const IMAGE_NAMES = (Object.keys(MANIFEST) as AssetName[]).filter((n) => !n.startsWith("sfx_") && !n.startsWith("music_") && n !== "cards_atlas" && n !== "card_back");

/** Every texture key the art filter applies to (the card sheet holds the atlas and the back). */
export const ART_KEYS: readonly string[] = [SHEET_KEY, ...IMAGE_NAMES];

export class BootScene extends BaseScene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    this.setup();
    const bar = this.add.rectangle(this.W / 2 - 100, this.H / 2, 0, 6, C.amber).setOrigin(0, 0.5);
    this.add.rectangle(this.W / 2 - 100, this.H / 2, 200, 6).setOrigin(0, 0.5).setStrokeStyle(1, C.oakLight);
    this.load.on("progress", (p: number) => (bar.width = 200 * p));
    this.load.spritesheet(ATLAS_KEY, MANIFEST.cards_atlas, { frameWidth: CELL_W * ART_SCALE, frameHeight: CELL_H * ART_SCALE });
    this.load.image(BACK_KEY, MANIFEST.card_back);
    for (const name of IMAGE_NAMES) this.load.image(name, MANIFEST[name]);
  }

  async create(): Promise<void> {
    // the card sheet (cardSheet.ts); once built, the raw atlas and back are not drawn from again,
    // so their GPU copies go (~23 MB at 3744x1536)
    if (buildCardSheet(this, ATLAS_KEY, BACK_KEY, cardFrames())) {
      this.textures.remove(ATLAS_KEY);
      this.textures.remove(BACK_KEY);
    }
    try {
      await Promise.all([document.fonts.load('26px "Rye"'), document.fonts.load('15px "Rye"')]);
    } catch {
      // a font that will not load leaves Georgia, which is fine
    }
    this.game.events.emit("booted");
  }
}
