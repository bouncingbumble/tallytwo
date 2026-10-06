/**
 * The names of every asset the game can reference, as a closed union. PURE: pure code
 * (sfxTable.ts, getPersonality.ts) imports names from here and never from manifest.ts, which
 * is the WEB file that turns a name into a URL. A name missing from MANIFEST is a type error.
 *
 * Audio names are identifier-shaped (sfx_DeckShuffle01) so each one is also a variable name
 * in the import table.
 */
export type CardAssetName = "cards_atlas" | "cards_atlas_2x" | "cards_atlas_3x" | "card_back" | "card_back_2x" | "card_back_3x";

export type PortraitKey = "p_marshal" | "p_outlaw" | "p_gambler";

/**
 * Every sprite ships at 1x, 2x and 3x (nearest-neighbour upscales): iOS Safari ignores
 * image-rendering: pixelated on CSS backgrounds, so like the cards they are drawn via
 * image-set() with no scaling at all.
 */
export type SpriteBase = PortraitKey | "wood" | "felt" | "wanted" | "checker";
export type SpriteAssetName = SpriteBase | `${SpriteBase}_2x` | `${SpriteBase}_3x`;

export type SfxAssetName =
  | "sfx_DeckShuffle01"
  | "sfx_DeckShuffle04"
  | "sfx_DeckShuffle05"
  | "sfx_CardMoveFast01"
  | "sfx_CardMoveFast03"
  | "sfx_CardMoveFast05"
  | "sfx_CardMoveFast06"
  | "sfx_CardMoveFast07"
  | "sfx_CardMoveFast08"
  | "sfx_CardMoveFast09"
  | "sfx_CardGrab03"
  | "sfx_CardGrab04"
  | "sfx_CardSlapFast01"
  | "sfx_CardSlapFast03"
  | "sfx_CardSlapFast04"
  | "sfx_CardSlapFast05"
  | "sfx_CardSlapFast07"
  | "sfx_CardSlapFast09"
  | "sfx_CardSlide01"
  | "sfx_CardSlide03"
  | "sfx_CardSlide05"
  | "sfx_CardGrabSlide01"
  | "sfx_CardGrabSlide02"
  | "sfx_CardGrabSlide03"
  | "sfx_CardGrabSlide04"
  | "sfx_CardGrabSlide05"
  | "sfx_CardGrabSlide06"
  | "sfx_CardGrabSlide07"
  | "sfx_CardGrabSlide11"
  | "sfx_CardGrabSlide13"
  | "sfx_CardsFalling01"
  | "sfx_CardsFalling05"
  | "sfx_CardsImpact01"
  | "sfx_CardsMovingLoop03";

export type MusicAssetName = "music_ost_1" | "music_ost_3" | "music_ost_4";

export type AssetName = CardAssetName | SpriteAssetName | SfxAssetName | MusicAssetName;

export const PORTRAIT_KEYS: readonly PortraitKey[] = ["p_marshal", "p_outlaw", "p_gambler"];
