/**
 * The names of every asset the game can reference, as a closed union. PURE: pure code
 * (sfxTable.ts, getPersonality.ts) imports names from here and never from manifest.ts, which
 * is the WEB file that turns a name into a URL. A name missing from MANIFEST is a type error.
 *
 * Audio names are identifier-shaped (sfx_DeckShuffle01) so each one is also a variable name
 * in the import table.
 */
export type CardAssetName = "cards_atlas" | "card_back";

export type PortraitKey = "p_marshal" | "p_outlaw" | "p_gambler";

/**
 * One file per sprite, at 3x the art's pixels (docs/ASSETS.md §7): the CSS draws it at the
 * art size in CSS px and lets the browser scale, smoothed by default and pixelated only when
 * the whole game is upscaled (styles/sprites.css `.game.upscaled`).
 */
/** The table and the poster. */
export type TableSpriteBase = PortraitKey | "wood" | "felt" | "wanted";
/**
 * The saloon props cut from the B-4 / B-6 tileset sheets (docs/ASSETS.md §7): the title's
 * batwing doors (three swing frames, drawn at exactly 2x), its sign and furniture, and the bar
 * behind the hand. Art pixel = CSS pixel, so each is placed by whole px in the CSS that draws it.
 */
export type SaloonSpriteBase =
  | "doors_closed"
  | "doors_ajar"
  | "doors_open"
  | "sign_saloon"
  | "sign_hanging"
  | "sign_backdoor"
  | "back_bar"
  | "barrel"
  | "lamp"
  | "chips"
  | "chips_pile"
  | "painting"
  | "sconce"
  | "sconce_silver"
  | "plant"
  | "stool"
  | "stool_grey"
  | "piano"
  | "poker_table"
  | "fireplace"
  | "chair";
export type SpriteBase = TableSpriteBase | SaloonSpriteBase;
export type SpriteAssetName = SpriteBase;

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
