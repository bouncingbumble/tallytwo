# Assets

What ships under `src/assets/` and `public/`, how it is wired, and how it was made.

| Folder | Files |
| --- | --- |
| `src/assets/cards/` | `cards_atlas.png` (3744x1536: 13 x 4 cells of 96x128 art at 3x), `card_back.png` (288x384) |
| `src/assets/sprites/` | 27 PNGs: the table sprites (`wood`, `felt`, `wanted`, the three portraits) and 21 saloon props |
| `src/assets/sfx/` | 55 `.m4a` one-shots (~1 MB) |
| `src/assets/music/` | `ost_1.m4a` … `ost_5.m4a` (~12 MB) |
| `public/icons/` | `icon-192.png`, `icon-512.png` |
| `public/manifest.webmanifest` | the installable web app's manifest |

The font is `@fontsource/rye` from npm (OFL), bundled by Vite.

## Wiring

1. **Names.** `src/assets/names.ts` (PURE) declares `AssetName`, a closed union of every asset, identifier-shaped so each name is also a variable name (`sfx_DeckShuffle01`, `music_ost_1`, `cards_atlas`), and `PORTRAITS`, which maps a personality's portrait key to its sprite.
2. **URLs.** `src/assets/manifest.ts` (WEB) is an explicit import table: one `import x from "./….m4a?url"` line per asset and `MANIFEST satisfies Record<AssetName, string>`. A missing or misspelled file is a Vite resolve error; a missing key is a type error. Vite hashes every file.
3. **Images** are loaded by the Boot scene (`phaser/scenes/Boot.ts`); the card atlas as a 13 x 4 spritesheet, then copied into one power-of-two card sheet (`phaser/cardSheet.ts`). `phaser/art.ts` holds every sprite's art size in logical px; a scene draws the 3x file at that size.
4. **Sounds** are fetched and decoded by `audio/WebAudio.ts`, from the table in `audio/sfxTable.ts`.
5. `src/assets/manifest.test.ts` checks every name resolves to a file on disk, every portrait is wired, and the images listed there have their 3x pixel sizes with no `@2x`/`@3x` twins. `src/audio/sfxTable.test.ts` checks every sound file is a manifest key on disk.

The `/assets` page (`src/assetsPage.ts`, data in `src/assetCatalog.ts`) lists every asset with a preview and what it is for. In the dev server its Submit button appends notes to `~/Desktop/tally-two-asset-notes.txt`.

## Sound effects

Each event picks from its pool without repeating the last file (`audio/pool.ts`), with ±4 % pitch and ±1.5 dB level jitter. A seat's own cards are panned toward where it sits. Gains are the base level × 1.2, capped at 1.

| Event | Files | Gain | Ducks music | When |
| --- | --- | --- | --- | --- |
| `shuffle` | DeckShuffle 01/04/05 | 0.78 | | a deal, at 0 ms |
| `deal` | CardMoveFast 01/03/05/06/07/08/09 | 0.50 | | a deal, four ticks at 260 + k·110 ms |
| `select` | CardGrab 03/04 | 0.36 | | a card selected |
| `deselect` | CardGenericMove 01/05/07 | 0.36 | | a card put back down |
| `reorder` | CardGenericMovesLong 01/03/11 | 0.42 | | a dragged card dropped into a new place |
| `playSmall` | CardSlapFast 01/03/04/05/07/09 | 0.96 | yes | a play of one or two cards |
| `playFive` | CardSlide 01/03/05 | 0.66 | | a five-card play |
| `pass` | CardGrabSlide 01–07/11/13 | 0.54 | | a pass that leaves the trick standing |
| `trickClear` | CardsFalling 01/03/04/05 | 0.72 | | the pass that clears the trick |
| `yourTurn` | CardGrabSlideLong 01/03/04/05 | 0.36 | | an AI's move hands the turn to the player |
| `lastCard` | CardsImpact 02/04 | 0.66 | | a play leaves a hand on one card |
| `roundWin` | CardsImpact01 | 1.00 | yes | the play that empties a hand |
| `tally` | BuyCards 01–05 | 0.60 | | the round is scored |
| `finalRound` | DeckMoves 01/02/03 | 0.84 | | the match's last round is dealt |

The duck takes the music from 0.30 to 0.12 within 20 ms and back 300 ms after the last slap. A soft clipper on the master bus keeps stacked sounds from crackling.

## Music

One loop plays at a time. A switch fades the playing loop out over 1.5 s, then starts the next and fades it in over 2 s; never a crossfade.

| Loop | File | When | `loopEnd` (s) | Frames at 44.1 kHz | Beats |
| --- | --- | --- | --- | --- | --- |
| `table` | ost_1 — Saloon Stare Down | the round | 121.081088 | 5,339,676 | 224 at 111 bpm |
| `tension` | ost_3 — Ghost Town Blues | in place of `table` while any hand is at 3 cards or fewer | 109.714286 | 4,838,400 | 192 at 105 bpm |
| `results` | ost_4 — Dusty Trails | the poster after an AI's round or a lost match; How to play | 105.109478 | 4,635,328 | 240 at 137 bpm |
| `roundWon` | ost_2 — Sundown in the Prairie | the poster after the player's round | 112.207800 | 4,948,364 | 144 at 77 bpm |
| `matchWon` | ost_5 — Lonesome Rider | the final poster when the player took the match | 112.941179 | 4,980,706 | 160 at 85 bpm |

All at gain 0.30. The title is silent. `loopEnd` is the master's frame count / 44100, so each loop wraps on the sample at a whole number of beats; the web player sets `source.loop = true; source.loopEnd = loopEnd`. The table and tension loops stay decoded once loaded; a poster loop is released when it is no longer wanted.

## Audio format: AAC

iOS Safari cannot decode Ogg Vorbis in Web Audio, so every file is AAC-LC in an `.m4a` container, encoded on macOS with `afconvert`.

**Music**, from the composer's 16-bit / 44.1 kHz WAV masters ("Wild West Music Volume 1", each track's `(Loopable).wav`):

```sh
afconvert -f m4af -d aac -b 160000 -s 2 -q 127 "OST 1 - Saloon Stare Down (Loopable).wav" ost_1.m4a   # likewise 2-5
```

`-s 2` is constrained VBR at a 160 kb/s average. `afinfo`'s valid frames equal the WAV's frame count, and the 2,112-frame encoder priming is recorded in the file and trimmed by `decodeAudioData`, so the decoded buffer starts on the first real sample.

**Sound effects**, from the Ogg Vorbis pack (decoded to 16-bit WAV with libsndfile, through the Python `soundfile` package):

```sh
venv/bin/python -c 'import pathlib, soundfile as sf
for src in pathlib.Path("wired").glob("*.ogg"):
    data, rate = sf.read(src); sf.write(f"wav/{src.stem}.wav", data, rate, subtype="PCM_16")'
for f in wav/SFX_*.wav; do afconvert -f m4af -d aac -b 128000 -q 127 -s 0 "$f" "m4a/sfx/$(basename "${f%.wav}").m4a"; done
```

Chromium builds without proprietary codecs (Playwright's among them) cannot decode AAC. The audio port then logs one warning per file and every event is silent; the game is unaffected.

## Images: one 3x file per sprite

Every sprite and the card atlas ship as one PNG holding 3x the art's pixels. The game draws at Z = k × dpr device px per logical px (`docs/ARCHITECTURE.md`, Geometry): while Z ≤ 3 the art is shrunk from 3x with linear filtering (the cards from a mipmapped sheet); above that it is enlarged with Phaser's smoothPixelArt shader, which keeps art pixels square and even at any ratio.

| Sprite | Art size (logical px) | File (px) | Source |
| --- | --- | --- | --- |
| `wood` | 96x96 | 288x288 | wall tile |
| `felt` | 32x32 | 96x96 | synthesised from B-4 |
| `wanted` | 61x71 | 183x213 | B-4 |
| `p_marshal` | 96x104 | 288x312 | B-4, the 90x91 framed portrait |
| `p_gambler` | 96x104 | 288x312 | B-6, the 77x88 framed portrait |
| `p_outlaw` | 96x104 | 288x312 | Lucky Pearl's B-6 portrait, mirrored and recoloured (black hat and vest, teal bandana, sunset sky) |
| `doors_closed` / `doors_ajar` / `doors_open` | 186x158 | 558x474 | B-4 (290, 488) / (386, 488) / (482, 488): 93x79 art drawn at 2x |
| `sign_saloon` | 90x56 | 270x168 | B-4 (387, 19) |
| `sign_hanging` | 93x55 | 279x165 | B-4 (578, 116) |
| `sign_backdoor` | 46x40 | 138x120 | B-6 (529, 148) |
| `back_bar` | 240x144 | 720x432 | B-6 (0, 0) |
| `barrel` | 48x69 | 144x207 | B-6 (720, 218) |
| `lamp` | 31x60 | 93x180 | B-4 (251, 692) |
| `chips` / `chips_pile` | 31x40 / 94x48 | 3x | B-6 (729, 425) / B-4 (674, 673) |
| `painting` | 86x94 | 258x282 | B-6 (3, 384) |
| `sconce` / `sconce_silver` | 38x46 / 38x47 | 3x | B-6 (484, 385) / (436, 384) |
| `plant` | 40x78 | 120x234 | B-6 (197, 690) |
| `stool` / `stool_grey` | 31x66 / 33x66 | 3x | B-4 (633, 606) / (728, 606) |
| `piano` | 96x94 | 288x282 | B-6 (576, 290) |
| `poker_table` | 228x87 | 684x261 | B-6 (340, 290) |
| `fireplace` | 79x129 | 237x387 | B-6 (393, 10) |
| `chair` | 44x72 | 132x216 | B-4 (387, 201) |

The props were cut from the 768x768 B-4 and B-6 tileset sheets by their alpha bounding boxes (the coordinates above) and upscaled 3x nearest-neighbour. A new sprite needs a 3x file, an import line in `manifest.ts`, a name in `names.ts`, and its art size in `phaser/art.ts`.

## App icons

`public/icons/icon-512.png` and `icon-192.png` are composed from the art by `scripts/make-icons.py` (Pillow): the wood tile repeated at 2x art pixels and darkened a little, Dusty Vane's framed portrait (`p_outlaw.png`) centred at 4x with a soft shadow and a 2-px `#120A04` outline following its alpha, all nearest-neighbour. The 192 is the 512 box-filtered down (the portrait has no whole scale at 192). The portrait's face sits inside the maskable icon's safe circle; only the frame's corners are trimmed by a round mask.

## Sources not in this repo

- The B-4 and B-6 tileset sheets, the 52 individual card faces and the card-back source.
- The Ogg Vorbis SFX pack and the WAV music masters.
