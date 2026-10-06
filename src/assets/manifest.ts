/**
 * The explicit import table: one line per asset name. A missing or misspelled FILE is a Vite
 * resolve error (dev and build both stop); a missing or misspelled KEY is a TS error against
 * Record<AssetName, string>. WEB bucket — PURE code names assets through assets/names.ts.
 *
 * Audio is AAC (.m4a): the kept pack is Ogg Vorbis, which iOS Safari cannot decode, so every
 * wired file was transcoded (docs/ASSETS.md records how). Loop lengths are in audio/sfxTable.ts.
 */
import type { AssetName, PortraitKey } from "./names";

import cards_atlas from "./cards/cards_atlas.png?url";
import cards_atlas_2x from "./cards/cards_atlas@2x.png?url";
import cards_atlas_3x from "./cards/cards_atlas@3x.png?url";
import card_back from "./cards/card_back.png?url";
import card_back_2x from "./cards/card_back@2x.png?url";
import card_back_3x from "./cards/card_back@3x.png?url";

import p_marshal from "./sprites/p_marshal.png?url";
import p_marshal_2x from "./sprites/p_marshal@2x.png?url";
import p_marshal_3x from "./sprites/p_marshal@3x.png?url";
import p_outlaw from "./sprites/p_outlaw.png?url";
import p_outlaw_2x from "./sprites/p_outlaw@2x.png?url";
import p_outlaw_3x from "./sprites/p_outlaw@3x.png?url";
import p_gambler from "./sprites/p_gambler.png?url";
import p_gambler_2x from "./sprites/p_gambler@2x.png?url";
import p_gambler_3x from "./sprites/p_gambler@3x.png?url";
import wood from "./sprites/wood.png?url";
import wood_2x from "./sprites/wood@2x.png?url";
import wood_3x from "./sprites/wood@3x.png?url";
import felt from "./sprites/felt.png?url";
import felt_2x from "./sprites/felt@2x.png?url";
import felt_3x from "./sprites/felt@3x.png?url";
import wanted from "./sprites/wanted.png?url";
import wanted_2x from "./sprites/wanted@2x.png?url";
import wanted_3x from "./sprites/wanted@3x.png?url";
import checker from "./sprites/checker.png?url";
import checker_2x from "./sprites/checker@2x.png?url";
import checker_3x from "./sprites/checker@3x.png?url";

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
import sfx_CardsMovingLoop03 from "./sfx/SFX_CardsMovingLoop03.m4a?url";

import music_ost_1 from "./music/ost_1.m4a?url";
import music_ost_3 from "./music/ost_3.m4a?url";
import music_ost_4 from "./music/ost_4.m4a?url";

export const MANIFEST = {
  cards_atlas,
  cards_atlas_2x,
  cards_atlas_3x,
  card_back,
  card_back_2x,
  card_back_3x,
  p_marshal,
  p_marshal_2x,
  p_marshal_3x,
  p_outlaw,
  p_outlaw_2x,
  p_outlaw_3x,
  p_gambler,
  p_gambler_2x,
  p_gambler_3x,
  wood,
  wood_2x,
  wood_3x,
  felt,
  felt_2x,
  felt_3x,
  wanted,
  wanted_2x,
  wanted_3x,
  checker,
  checker_2x,
  checker_3x,
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
  sfx_CardsMovingLoop03,
  music_ost_1,
  music_ost_3,
  music_ost_4,
} satisfies Record<AssetName, string>;

export const PORTRAITS: Record<PortraitKey, AssetName> = { p_marshal: "p_marshal", p_outlaw: "p_outlaw", p_gambler: "p_gambler" };


if (import.meta.env.DEV) {
  for (const k of Object.keys(MANIFEST)) {
    if (!MANIFEST[k as AssetName]) throw new Error(`asset ${k} resolved to nothing`);
  }
}
