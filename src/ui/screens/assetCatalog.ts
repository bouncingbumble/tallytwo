/**
 * What every asset is for, in five words or less — the data behind the /assets page.
 * `satisfies Record<AssetName, …>` makes a new asset in names.ts a type error here until it is
 * described; assetCatalog.test.ts holds the five-word limit. WEB bucket (imports manifest.ts).
 */
import type { AssetName } from "../../assets/names";
import { MANIFEST } from "../../assets/manifest";

export type AssetGroup = "Cards" | "Table & portraits" | "Saloon props" | "Sound effects" | "Music" | "App shell";
export const GROUPS: readonly AssetGroup[] = ["Cards", "Table & portraits", "Saloon props", "Sound effects", "Music", "App shell"];

export const ASSET_USES = {
  cards_atlas: "All 52 card faces",
  card_back: "Face-down card back",

  p_marshal: "Marshal Cobb's portrait",
  p_outlaw: "Dusty Vane's portrait",
  p_gambler: "Lucky Pearl's portrait",
  wood: "Wood wall background tile",
  felt: "Green table felt texture",
  wanted: "Your face on results poster",

  doors_closed: "Title doors, closed frame",
  doors_ajar: "Title doors, swinging frame",
  doors_open: "Title doors, open frame",
  sign_saloon: "Title screen SALOON sign",
  sign_hanging: "Hanging sign behind table",
  sign_backdoor: "Back-door sign behind table",
  back_bar: "Liquor cabinet behind table",
  barrel: "Barrel decor, title and table",
  lamp: "Oil lamp on title",
  chips: "Poker chips decor",
  chips_pile: "Chip pile, title corner",
  painting: "Desert painting, title menu",
  sconce: "Wall sconce decor",
  sconce_silver: "Silver sconce, title corner",
  plant: "Potted plant decor",
  stool: "Bar stool decor",
  stool_grey: "Grey stool behind table",
  piano: "Piano behind table",
  poker_table: "Poker table behind hand",
  fireplace: "Fireplace behind table",
  chair: "Chair behind table",

  sfx_DeckShuffle01: "Shuffle at the deal",
  sfx_DeckShuffle04: "Shuffle at the deal",
  sfx_DeckShuffle05: "Shuffle at the deal",
  sfx_CardMoveFast01: "Dealing cards to seats",
  sfx_CardMoveFast03: "Dealing cards to seats",
  sfx_CardMoveFast05: "Dealing cards to seats",
  sfx_CardMoveFast06: "Dealing cards to seats",
  sfx_CardMoveFast07: "Dealing cards to seats",
  sfx_CardMoveFast08: "Dealing cards to seats",
  sfx_CardMoveFast09: "Dealing cards to seats",
  sfx_CardGrab03: "Selecting a hand card",
  sfx_CardGrab04: "Selecting a hand card",
  sfx_CardSlapFast01: "Playing 1–3 cards",
  sfx_CardSlapFast03: "Playing 1–3 cards",
  sfx_CardSlapFast04: "Playing 1–3 cards",
  sfx_CardSlapFast05: "Playing 1–3 cards",
  sfx_CardSlapFast07: "Playing 1–3 cards",
  sfx_CardSlapFast09: "Playing 1–3 cards",
  sfx_CardSlide01: "Playing a five-card hand",
  sfx_CardSlide03: "Playing a five-card hand",
  sfx_CardSlide05: "Playing a five-card hand",
  sfx_CardGrabSlide01: "A player passes",
  sfx_CardGrabSlide02: "A player passes",
  sfx_CardGrabSlide03: "A player passes",
  sfx_CardGrabSlide04: "A player passes",
  sfx_CardGrabSlide05: "A player passes",
  sfx_CardGrabSlide06: "A player passes",
  sfx_CardGrabSlide07: "A player passes",
  sfx_CardGrabSlide11: "A player passes",
  sfx_CardGrabSlide13: "A player passes",
  sfx_CardsFalling01: "Trick cleared off table",
  sfx_CardsFalling05: "Trick cleared off table",
  sfx_CardsImpact01: "Round won, hand emptied",
  sfx_CardsImpact02: "Someone down to one card",
  sfx_CardsImpact04: "Someone down to one card",
  sfx_CardsFalling03: "Trick cleared off table",
  sfx_CardsFalling04: "Trick cleared off table",
  sfx_CardGenericMove01: "Deselecting a hand card",
  sfx_CardGenericMove05: "Deselecting a hand card",
  sfx_CardGenericMove07: "Deselecting a hand card",
  sfx_CardGenericMovesLong01: "Dragging a card into place",
  sfx_CardGenericMovesLong03: "Dragging a card into place",
  sfx_CardGenericMovesLong11: "Dragging a card into place",
  sfx_CardGrabSlideLong01: "Your turn comes round",
  sfx_CardGrabSlideLong03: "Your turn comes round",
  sfx_CardGrabSlideLong04: "Your turn comes round",
  sfx_CardGrabSlideLong05: "Your turn comes round",
  sfx_DeckMoves01: "Final round announced",
  sfx_DeckMoves02: "Final round announced",
  sfx_DeckMoves03: "Final round announced",
  sfx_BuyCards01: "Tally paid on poster",
  sfx_BuyCards02: "Tally paid on poster",
  sfx_BuyCards03: "Tally paid on poster",
  sfx_BuyCards04: "Tally paid on poster",
  sfx_BuyCards05: "Tally paid on poster",

  music_ost_1: "Main table music loop",
  music_ost_2: "You won the round",
  music_ost_5: "You won the match",
  music_ost_3: "Tension music near endgame",
  music_ost_4: "Results, match lost, how-to",
} satisfies Record<AssetName, string>;

export type AssetKind = "image" | "audio" | "font";

export interface AssetRow {
  name: string;
  /** Path in the repo, for finding the file. */
  file: string;
  /** URL to preview it; null when there is nothing to preview (the font). */
  url: string | null;
  kind: AssetKind;
  group: AssetGroup;
  use: string;
}

const CARD_NAMES = new Set<string>(["cards_atlas", "card_back"]);
const TABLE_NAMES = new Set<string>(["p_marshal", "p_outlaw", "p_gambler", "wood", "felt", "wanted"]);

function describe(name: AssetName): AssetRow {
  const url = MANIFEST[name];
  const use = ASSET_USES[name];
  if (name.startsWith("sfx_")) {
    return { name, url, use, kind: "audio", group: "Sound effects", file: `src/assets/sfx/${name.replace(/^sfx_/, "SFX_")}.m4a` };
  }
  if (name.startsWith("music_")) {
    return { name, url, use, kind: "audio", group: "Music", file: `src/assets/music/${name.replace(/^music_/, "")}.m4a` };
  }
  if (CARD_NAMES.has(name)) return { name, url, use, kind: "image", group: "Cards", file: `src/assets/cards/${name}.png` };
  const group: AssetGroup = TABLE_NAMES.has(name) ? "Table & portraits" : "Saloon props";
  return { name, url, use, kind: "image", group, file: `src/assets/sprites/${name}.png` };
}

/** Assets outside the manifest: the public/ icons index.html links and the npm font. */
const SHELL_ROWS: AssetRow[] = [
  { name: "icon-192", file: "public/icons/icon-192.png", url: "/icons/icon-192.png", kind: "image", group: "App shell", use: "Favicon and home-screen icon" },
  { name: "icon-512", file: "public/icons/icon-512.png", url: "/icons/icon-512.png", kind: "image", group: "App shell", use: "Large icon for app shells" },
  { name: "Rye", file: "@fontsource/rye (npm)", url: null, kind: "font", group: "App shell", use: "Western display font" },
];

export const ASSET_ROWS: readonly AssetRow[] = [
  ...(Object.keys(ASSET_USES) as AssetName[]).map(describe),
  ...SHELL_ROWS,
];
