/**
 * The explicit import table: one line per asset name. A missing or misspelled FILE is a Vite
 * resolve error (dev and build both stop); a missing or misspelled KEY is a TS error against
 * Record<AssetName, string>. WEB bucket — PURE code names assets through assets/names.ts.
 *
 * Every image is one file at 3x the art's pixels (docs/ASSETS.md §3): the CSS that draws it
 * sets the art size in CSS px and the browser scales.
 *
 * Audio is AAC (.m4a): the kept pack is Ogg Vorbis, which iOS Safari cannot decode, so every
 * wired file was transcoded (docs/ASSETS.md records how). Loop lengths are in audio/sfxTable.ts.
 */
import type { AssetName, PortraitKey } from "./names";

import cards_atlas from "./cards/cards_atlas.png?url";
import card_back from "./cards/card_back.png?url";

import p_marshal from "./sprites/p_marshal.png?url";
import p_outlaw from "./sprites/p_outlaw.png?url";
import p_gambler from "./sprites/p_gambler.png?url";
import wood from "./sprites/wood.png?url";
import felt from "./sprites/felt.png?url";
import wanted from "./sprites/wanted.png?url";

import doors_closed from "./sprites/doors_closed.png?url";
import doors_ajar from "./sprites/doors_ajar.png?url";
import doors_open from "./sprites/doors_open.png?url";
import sign_saloon from "./sprites/sign_saloon.png?url";
import sign_hanging from "./sprites/sign_hanging.png?url";
import sign_backdoor from "./sprites/sign_backdoor.png?url";
import back_bar from "./sprites/back_bar.png?url";
import barrel from "./sprites/barrel.png?url";
import lamp from "./sprites/lamp.png?url";
import chips from "./sprites/chips.png?url";
import chips_pile from "./sprites/chips_pile.png?url";
import painting from "./sprites/painting.png?url";
import sconce from "./sprites/sconce.png?url";
import sconce_silver from "./sprites/sconce_silver.png?url";
import plant from "./sprites/plant.png?url";
import stool from "./sprites/stool.png?url";
import stool_grey from "./sprites/stool_grey.png?url";
import piano from "./sprites/piano.png?url";
import poker_table from "./sprites/poker_table.png?url";
import fireplace from "./sprites/fireplace.png?url";
import chair from "./sprites/chair.png?url";

import sfx_DeckShuffle01 from "./sfx/SFX_DeckShuffle01.m4a?url";
import sfx_DeckShuffle04 from "./sfx/SFX_DeckShuffle04.m4a?url";
import sfx_DeckShuffle05 from "./sfx/SFX_DeckShuffle05.m4a?url";
import sfx_CardMoveFast01 from "./sfx/SFX_CardMoveFast01.m4a?url";
import sfx_CardMoveFast03 from "./sfx/SFX_CardMoveFast03.m4a?url";
import sfx_CardMoveFast05 from "./sfx/SFX_CardMoveFast05.m4a?url";
import sfx_CardMoveFast06 from "./sfx/SFX_CardMoveFast06.m4a?url";
import sfx_CardMoveFast07 from "./sfx/SFX_CardMoveFast07.m4a?url";
import sfx_CardMoveFast08 from "./sfx/SFX_CardMoveFast08.m4a?url";
import sfx_CardMoveFast09 from "./sfx/SFX_CardMoveFast09.m4a?url";
import sfx_CardGrab03 from "./sfx/SFX_CardGrab03.m4a?url";
import sfx_CardGrab04 from "./sfx/SFX_CardGrab04.m4a?url";
import sfx_CardSlapFast01 from "./sfx/SFX_CardSlapFast01.m4a?url";
import sfx_CardSlapFast03 from "./sfx/SFX_CardSlapFast03.m4a?url";
import sfx_CardSlapFast04 from "./sfx/SFX_CardSlapFast04.m4a?url";
import sfx_CardSlapFast05 from "./sfx/SFX_CardSlapFast05.m4a?url";
import sfx_CardSlapFast07 from "./sfx/SFX_CardSlapFast07.m4a?url";
import sfx_CardSlapFast09 from "./sfx/SFX_CardSlapFast09.m4a?url";
import sfx_CardSlide01 from "./sfx/SFX_CardSlide01.m4a?url";
import sfx_CardSlide03 from "./sfx/SFX_CardSlide03.m4a?url";
import sfx_CardSlide05 from "./sfx/SFX_CardSlide05.m4a?url";
import sfx_CardGrabSlide01 from "./sfx/SFX_CardGrabSlide01.m4a?url";
import sfx_CardGrabSlide02 from "./sfx/SFX_CardGrabSlide02.m4a?url";
import sfx_CardGrabSlide03 from "./sfx/SFX_CardGrabSlide03.m4a?url";
import sfx_CardGrabSlide04 from "./sfx/SFX_CardGrabSlide04.m4a?url";
import sfx_CardGrabSlide05 from "./sfx/SFX_CardGrabSlide05.m4a?url";
import sfx_CardGrabSlide06 from "./sfx/SFX_CardGrabSlide06.m4a?url";
import sfx_CardGrabSlide07 from "./sfx/SFX_CardGrabSlide07.m4a?url";
import sfx_CardGrabSlide11 from "./sfx/SFX_CardGrabSlide11.m4a?url";
import sfx_CardGrabSlide13 from "./sfx/SFX_CardGrabSlide13.m4a?url";
import sfx_CardsFalling01 from "./sfx/SFX_CardsFalling01.m4a?url";
import sfx_CardsFalling05 from "./sfx/SFX_CardsFalling05.m4a?url";
import sfx_CardsImpact01 from "./sfx/SFX_CardsImpact01.m4a?url";
import sfx_CardsImpact02 from "./sfx/SFX_CardsImpact02.m4a?url";
import sfx_CardsImpact04 from "./sfx/SFX_CardsImpact04.m4a?url";
import sfx_CardsFalling03 from "./sfx/SFX_CardsFalling03.m4a?url";
import sfx_CardsFalling04 from "./sfx/SFX_CardsFalling04.m4a?url";
import sfx_CardGenericMove01 from "./sfx/SFX_CardGenericMove01.m4a?url";
import sfx_CardGenericMove05 from "./sfx/SFX_CardGenericMove05.m4a?url";
import sfx_CardGenericMove07 from "./sfx/SFX_CardGenericMove07.m4a?url";
import sfx_CardGenericMovesLong01 from "./sfx/SFX_CardGenericMovesLong01.m4a?url";
import sfx_CardGenericMovesLong03 from "./sfx/SFX_CardGenericMovesLong03.m4a?url";
import sfx_CardGenericMovesLong11 from "./sfx/SFX_CardGenericMovesLong11.m4a?url";
import sfx_CardGrabSlideLong01 from "./sfx/SFX_CardGrabSlideLong01.m4a?url";
import sfx_CardGrabSlideLong03 from "./sfx/SFX_CardGrabSlideLong03.m4a?url";
import sfx_CardGrabSlideLong04 from "./sfx/SFX_CardGrabSlideLong04.m4a?url";
import sfx_CardGrabSlideLong05 from "./sfx/SFX_CardGrabSlideLong05.m4a?url";
import sfx_DeckMoves01 from "./sfx/SFX_DeckMoves01.m4a?url";
import sfx_DeckMoves02 from "./sfx/SFX_DeckMoves02.m4a?url";
import sfx_DeckMoves03 from "./sfx/SFX_DeckMoves03.m4a?url";
import sfx_BuyCards01 from "./sfx/SFX_BuyCards01.m4a?url";
import sfx_BuyCards02 from "./sfx/SFX_BuyCards02.m4a?url";
import sfx_BuyCards03 from "./sfx/SFX_BuyCards03.m4a?url";
import sfx_BuyCards04 from "./sfx/SFX_BuyCards04.m4a?url";
import sfx_BuyCards05 from "./sfx/SFX_BuyCards05.m4a?url";

import music_ost_1 from "./music/ost_1.m4a?url";
import music_ost_2 from "./music/ost_2.m4a?url";
import music_ost_3 from "./music/ost_3.m4a?url";
import music_ost_4 from "./music/ost_4.m4a?url";
import music_ost_5 from "./music/ost_5.m4a?url";

export const MANIFEST = {
  cards_atlas,
  card_back,
  p_marshal,
  p_outlaw,
  p_gambler,
  wood,
  felt,
  wanted,
  doors_closed,
  doors_ajar,
  doors_open,
  sign_saloon,
  sign_hanging,
  sign_backdoor,
  back_bar,
  barrel,
  lamp,
  chips,
  chips_pile,
  painting,
  sconce,
  sconce_silver,
  plant,
  stool,
  stool_grey,
  piano,
  poker_table,
  fireplace,
  chair,
  sfx_DeckShuffle01,
  sfx_DeckShuffle04,
  sfx_DeckShuffle05,
  sfx_CardMoveFast01,
  sfx_CardMoveFast03,
  sfx_CardMoveFast05,
  sfx_CardMoveFast06,
  sfx_CardMoveFast07,
  sfx_CardMoveFast08,
  sfx_CardMoveFast09,
  sfx_CardGrab03,
  sfx_CardGrab04,
  sfx_CardSlapFast01,
  sfx_CardSlapFast03,
  sfx_CardSlapFast04,
  sfx_CardSlapFast05,
  sfx_CardSlapFast07,
  sfx_CardSlapFast09,
  sfx_CardSlide01,
  sfx_CardSlide03,
  sfx_CardSlide05,
  sfx_CardGrabSlide01,
  sfx_CardGrabSlide02,
  sfx_CardGrabSlide03,
  sfx_CardGrabSlide04,
  sfx_CardGrabSlide05,
  sfx_CardGrabSlide06,
  sfx_CardGrabSlide07,
  sfx_CardGrabSlide11,
  sfx_CardGrabSlide13,
  sfx_CardsFalling01,
  sfx_CardsFalling05,
  sfx_CardsImpact01,
  sfx_CardsImpact02,
  sfx_CardsImpact04,
  sfx_CardsFalling03,
  sfx_CardsFalling04,
  sfx_CardGenericMove01,
  sfx_CardGenericMove05,
  sfx_CardGenericMove07,
  sfx_CardGenericMovesLong01,
  sfx_CardGenericMovesLong03,
  sfx_CardGenericMovesLong11,
  sfx_CardGrabSlideLong01,
  sfx_CardGrabSlideLong03,
  sfx_CardGrabSlideLong04,
  sfx_CardGrabSlideLong05,
  sfx_DeckMoves01,
  sfx_DeckMoves02,
  sfx_DeckMoves03,
  sfx_BuyCards01,
  sfx_BuyCards02,
  sfx_BuyCards03,
  sfx_BuyCards04,
  sfx_BuyCards05,
  music_ost_1,
  music_ost_2,
  music_ost_3,
  music_ost_4,
  music_ost_5,
} satisfies Record<AssetName, string>;

export const PORTRAITS: Record<PortraitKey, AssetName> = { p_marshal: "p_marshal", p_outlaw: "p_outlaw", p_gambler: "p_gambler" };


if (import.meta.env.DEV) {
  for (const k of Object.keys(MANIFEST)) {
    if (!MANIFEST[k as AssetName]) throw new Error(`asset ${k} resolved to nothing`);
  }
}
