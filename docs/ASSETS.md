# Assets

What this build actually wires, and how it got here. The 47 slots are the original asset plan's; where this build deviates from it, the row says so.

**Counts.** 47 slots: **27 wired**, **14 deferred** (a kept candidate exists but the build uses the prototype's CSS or behaviour instead), **6 with nothing to wire**. 27 + 14 + 6 = 47. On disk under `src/assets/`: 2 card PNGs, 27 sprite PNGs (one 3x file each, §7 — the 6 table sprites plus 21 saloon props cut from the B-4 / B-6 sheets on 2026-10-06), 34 SFX (`.m4a`, 33 one-shots + the ambience loop), 3 music loops (`.m4a`).

## 1. The 47 slots

| # | slot | this build wires | status |
| --- | --- | --- |
| 1 | sfx-shuffle | DeckShuffle 01/04/05 (`sfx_DeckShuffle01/04/05`) | wired |
| 2 | sfx-deal | CardMoveFast 01/03/05/06/07/08/09 | wired |
| 3 | sfx-select | CardGrab 03/04 | wired |
| 4 | sfx-play-small | CardSlapFast 01/03/04/05/07/09 | wired |
| 5 | sfx-play-five | **CardSlide 01/03/05** — the Stockroom ledger marks the `CardSlide` group LIVE and the files are on disk, so the build wires the rank-1 candidate. The plan's substitute, CardGenericMovesLong 05/06/07, is not used. (A later triage had quarantined every `CardSlide*`; the files on disk are fine.) | wired, **deviation from the plan** |
| 6 | sfx-pass | CardGrabSlide 01/02/03/04/05/06/07/11/13 | wired |
| 7 | sfx-trick-clear | CardsFalling 01/05 | wired |
| 8 | sfx-round-win | CardsImpact01 | wired |
| 9 | sfx-reserve-pool | — (CardGenericMove 01/03/06/08/10 kept by the triage, unused; not copied into `src/assets`) | deferred |
| 10 | ambience-saloon | CardsMovingLoop03 at −14 dB on its own bus, `loopEnd` 10.069 s | wired |
| 11 | music-table | ost_1 ("Saloon Stare Down") at 0.30 | wired |
| 12 | music-title | — (ost_2 and ost_5 quarantined; the title is silent before the first gesture anyway) | **nothing** |
| 13 | music-tension | ost_3 ("Ghost Town Blues"), in place of ost_1 while any seat is at ≤ 3 cards — the table loop fades out (1.5 s), then ost_3 fades in (2 s), and back the same way; never the two at once | wired |
| 14 | music-results | ost_4 ("Dusty Trails") | wired |
| 15 | music-howto | ost_4 (ost_5 quarantined); playable because `init()` runs from the How to play button too and `setMusic` is latched | wired |
| 16 | persona-marshal-idle | `sprites/p_marshal.png` 96x104 canvas, the 90x91 framed portrait from B-4 at 1x | wired |
| 17 | persona-outlaw-idle | `sprites/p_outlaw.png` 96x104 canvas: a palette swap of Lucky Pearl's portrait (B-6, 77x88), mirrored — black hat and vest, teal bandana, a sunset sky, a dark weathered frame (HSL remaps by hue band; the script is in the session scratchpad). The pack has no third saloon face: its only other people are the B-9 sepia photo (24 px) and the B-8 WANTED faces. Replaced the blurry 2x 43x52 portrait (2026-10-07: "not a great character", and a Jack of Spades was "not a saloon character") | wired |
| 18 | persona-gambler-idle | `sprites/p_gambler.png` 96x104 canvas, the 77x88 framed portrait from B-6 at 1x | wired |
| 19-21 | persona-{marshal,outlaw,gambler}-states | — ; substitutes: active glow, red count at ≤ 3, dim at 0, "passed" badge, barks (all CSS/state) | **nothing** |
| 22 | display-wood | `sprites/wood.png` 96x96 (A4-Walls 0,0,96,96) | wired |
| 23 | display-felt | `sprites/felt.png` 32x32 (B-4-derived, synthesised) | wired |
| 24 | display-wanted-poster | `sprites/wanted.png` 61x71 (B-4) | wired |
| 25 | display-title-backdrop | the title's saloon front and the room behind the hand, built from B-4 / B-6 props (§7): `back_bar`, `barrel`, `piano`, `poker_table`, `fireplace`, `chair`, `stool`, `stool_grey`, `plant`, `chips`, `chips_pile`, `painting` | wired |
| 26 | display-splash-screen | — (B-7 kept); there is no PWA splash any more, a shell draws its own | deferred |
| 27 | display-saloon-doors | `doors_closed` / `doors_ajar` / `doors_open` — the B-4 batwing pairs (93x79 art, drawn at exactly 2x) as three swing frames (`ui/Doors.tsx`) | wired |
| 28 | display-lamp-lighting | `lamp` (B-4 oil lamp), `sconce` / `sconce_silver` (B-6 wall sconces) | wired |
| 29 | display-signage | `sign_saloon` (B-4 red board), `sign_hanging` (B-4 hanging board), `sign_backdoor` (B-6); the in-game sign stays CSS (`.sign`) | wired |
| 30 | display-scoreboard | — (B-8 dropped; B-4 kept); the CSS poster table | deferred |
| 31 | display-tally-icons | — (B-11 kept) | deferred |
| 32 | display-elimination-marker | — (no knockout mode exists) | deferred |
| 33 | settings-howto-frames | — (B-12 kept); CSS sheet (`.sheet`) | deferred |
| 34 | ui-9slices | CSS | deferred |
| 35 | ui-button-9slice | CSS `.btn` | deferred |
| 36 | ui-sheet-panel | CSS `.sheet` | deferred |
| 37 | ui-opponent-panel | CSS `.opp` | deferred |
| 38 | ui-felt-frame | CSS inset rim on `.felt` | deferred |
| 39 | ui-bark-bubble | CSS `.bark` | deferred |
| 40 | ui-form-controls | CSS `.sw` / `select` | deferred |
| 41 | ui-volume-sliders | CSS `<input type="range">` (not in the prototype); sheet art deferred | wired |
| 42 | ui-menu-icon | "☰" text | deferred |
| 43 | ui-app-icon | `public/icons/icon-192.png`, `icon-512.png` — composed from `sprites/wood.png` and `cards/card_back.png` (§5), not cut from B-11 | wired |
| 44 | ui-font-rye | `@fontsource/rye` (npm, OFL) — not an asset from the pack | **nothing** (substitute) |
| 45 | cards-faces | `cards/cards_atlas.png` 3744x1536 (the 1248x512 art at 3x, drawn at 96x128 a cell) | wired |
| 46 | cards-back | `cards/card_back.png` 288x384 (96x128 art at 3x; western reskin open) | wired |
| 47 | cards-reskin-source | — (the `.pxo` is gone; only the 52 face PNGs in Jorel's pack remain, and they are not in the handoff on disk) | **nothing** |

Wired: 1-8, 10, 11, 13-18, 22-25, 27-29, 41, 43, 45, 46 (27). Deferred: 9, 26, 30-40, 42 (14). Nothing: 12, 19, 20, 21, 44, 47 (6).

## 2. The sound table (`src/audio/sfxTable.ts`)

| event | files | gain | ducks | fired by |
| --- | --- | --- | --- |
| `shuffle` | DeckShuffle 01/04/05 | 0.65 | no | `dealRoll()` at 0 ms |
| `deal` | CardMoveFast 01/03/05/06/07/08/09 | 0.42 | no | `dealRoll()` four ticks at 260 + k·110 ms |
| `select` | CardGrab 03/04 | 0.30 | no | `toggleCard` |
| `playSmall` | CardSlapFast 01/03/04/05/07/09 | 0.80 | yes | PLAY of 1-3 cards |
| `playFive` | CardSlide 01/03/05 | 0.55 | no | PLAY of 5 cards |
| `pass` | CardGrabSlide 01-07/11/13 | 0.45 | no | PASS |
| `trickClear` | CardsFalling 01/05 | 0.60 | no | the PASS that clears the table |
| `roundWin` | CardsImpact01 | 0.85 | yes | the PLAY that empties a hand |

Round-robin without an immediate repeat (`pool.ts` `pickVariant`), ±4 % true-pitch jitter per play, `DUCK` = to 0.12 within 20 ms, back to 0.30 after 300 ms unless re-ducked within 280 ms. The two settings switches set a bus to 0; the volume sliders multiply in.

| loop | file | gain | `loopEnd` (s) |
| --- | --- | --- |
| `table` | `music_ost_1` | 0.30 | 119.081 |
| `tension` | `music_ost_3` | 0.30 | 107.714 |
| `results` | `music_ost_4` | 0.30 | 103.109 |
| `ambience` | `sfx_CardsMovingLoop03` | −14 dB (0.1995) | 10.069 |

## 3. The pipeline

1. **Sprites**: `src/assets/sprites/<name>.png`, **one file per sprite** holding 3x the art's pixels (`wood.png` is 288x288 for a 96-px tile, `p_marshal.png` 288x312 for 96x104, the doors 558x474 for their 186x158 box; §7 has the table). The wood, felt and WANTED sprites were decoded from the prototype's embedded asset pack; the three portraits were re-cut from the B-4/B-6 tileset sheets at native pixel size (the prototype's 64x64 copies were resampled and had the frames clipped); the tileset sheets they were cut from are source material only and are not in this repo (every `ui-*` 9-slice slot is deferred). The 3x files are the nearest-neighbour upscales made on 2026-10-06 (Pillow `Image.NEAREST`); the 1x and 2x twins that used to sit beside them are gone.
2. **Cards**: `src/assets/cards/` (2 PNGs: `cards_atlas.png` 3744x1536 and `card_back.png` 288x384, the 1248x512 / 96x128 art at 3x).
3. **Audio**: the 34 SFX and 3 loops named in the tables above, as AAC `.m4a` (§4), in `src/assets/sfx/` and `src/assets/music/` (`ost_1.m4a`, `ost_3.m4a`, `ost_4.m4a`; the long Ogg names are dropped).
4. **Names, then URLs.** `src/assets/names.ts` (PURE) declares `AssetName` as a closed union, identifier-shaped so each name is also a variable name (`sfx_DeckShuffle01`, `music_ost_1`, `cards_atlas`), plus `PortraitKey`. `src/assets/manifest.ts` (WEB) is an **explicit import table**, one `import x from "./….m4a?url"` line per asset, and `export const MANIFEST = { … } satisfies Record<AssetName, string>`. A missing or misspelled **file** is a Vite resolve error (`npm run dev` and `npm run build` both stop); a missing or misspelled **key** is TS2741. A DEV-only guard throws on the first asset whose URL resolved to nothing, so a bad URL surfaces on `npm run dev`, not only under `npm test`. `import.meta.glob` cannot do this (an eager `?url` glob is typed `Record<string, string>`, which satisfies anything), which is why the table is written out.
5. **Portraits**: `PORTRAITS: Record<PortraitKey, AssetName>`; `ai/getPersonality.ts` narrows `Personality.portrait` (a `string`) to `PortraitKey` at runtime and `manifest.test.ts` asserts every `PERSONALITIES[k].portrait` is a key of `PORTRAITS`, so a misspelled portrait key fails a test instead of drawing a blank seat.
6. **CSS, not variables**: every texture and portrait is a `url()` plus a `background-size` in CSS px (the art size, a third of the file) written in the rule that uses it — `styles/base.css` (`body`, `.title::after`), `styles/table.css` (`.table`, `.felt`, `.face.p_marshal`, `.face.p_outlaw`, `.face.p_gambler`, `.face.wanted`), `styles/sprites.css` (one `.sp-<name>` class per prop) — and the atlas and card back are `url()`s in `styles/cards.css`; Vite resolves and hashes them. Nothing sets a texture from JavaScript (the prototype's `:root` trick is retired). `MANIFEST` lists every file so `manifest.test.ts` proves it exists and is the 3x size the CSS assumes, with no `@2x`/`@3x` twin left behind.
7. Vite emits hashed URLs; `.png`/`.m4a` are static assets by default. `dist/` is a plain static site (no service worker, no precache, no webmanifest): a webview shell or a static host serves it.

## 4. Audio format: AAC, not Ogg

**Decision.** The kept pack is Ogg Vorbis only (46 SFX + 3 loops after the triage; no `.mp3`/`.m4a` survived). iOS Safari cannot decode Vorbis in Web Audio (`decodeAudioData` rejects it) and the target is iPhone Safari, so every wired file was transcoded to AAC in an `.m4a` container before any audio name was written — `names.ts`, `sfxTable.ts` and `manifest.ts` say `.m4a` from their first line and nothing was renamed later. The plan's step −1 probe (`probe.html`) was therefore never needed; the plan's fallback (`ffmpeg … -c:a aac -b:a 160k`) could not be used either because ffmpeg is not installed on the build machine.

**The transcode, exactly as done** (macOS; libsndfile decodes the Vorbis, `afconvert` encodes the AAC):

```sh
# 1. decode Ogg Vorbis to 16-bit WAV with libsndfile, via the python `soundfile` wheel in a venv
python3 -m venv venv && venv/bin/pip install soundfile
venv/bin/python - <<'EOF'
import pathlib, soundfile as sf
for src in pathlib.Path("wired").glob("*.ogg"):          # the 37 wired files (34 SFX incl. the ambience loop, 3 music loops)
    data, rate = sf.read(src)                             # float frames, native sample rate (44.1 kHz)
    sf.write(f"wav/{src.stem}.wav", data, rate, subtype="PCM_16")
EOF

# 2. encode with afconvert: AAC-LC in an .m4a (m4af) container, max quality, no sample-rate conversion
for f in wav/SFX_*.wav; do afconvert -f m4af -d aac -b 128000 -q 127 -s 0 "$f" "m4a/sfx/$(basename "${f%.wav}").m4a"; done   # SFX at 128 kb/s
for f in wav/ost_*.wav; do   afconvert -f m4af -d aac -b 160000 -q 127 -s 0 "$f" "m4a/music/$(basename "${f%.wav}").m4a"; done # music at 160 kb/s

# 3. confirm the gapless metadata (priming + remainder) is present, so loopEnd lands on the sample
afinfo m4a/music/ost_1.m4a | grep -E "valid frames|estimated duration"
```

`-f m4af` = MPEG-4 audio file, `-d aac` = AAC-LC, `-b` = bit rate in bits per second, `-q 127` = highest encoder quality, `-s 0` = constant bit rate. The music loops were renamed from `ost_1_-_saloon_stare_down_loop.ogg` etc. to `ost_1.m4a` etc. The 37 results are what `src/assets/{sfx,music}/` holds.

`afinfo` on the results (2026-10-05):

| file | valid frames | priming | duration (s) | AAC bytes | Ogg source bytes |
| --- | --- | --- | --- | --- |
| `music/ost_1.m4a` | 5,251,476 | 2,112 | 119.081088 | 2,407,749 | 3,023,451 |
| `music/ost_3.m4a` | 4,750,200 | 2,112 | 107.714286 | 2,179,995 | 2,334,758 |
| `music/ost_4.m4a` | 4,547,128 | 2,112 | 103.109478 | 2,084,274 | 2,250,129 |
| `sfx/SFX_CardsMovingLoop03.m4a` | 444,049 | 2,112 | 10.069138 | 166,087 | ~119 KB |

The 2,112-frame priming (encoder delay) is recorded in the file and Web Audio's `decodeAudioData` trims it, so a decoded buffer starts on the first real sample and `loopEnd` can be the measured duration. Budget: the 34 SFX together are about 0.66 MB (0.5 MB without the ambience loop); the three loops are about 6.7 MB, fetched on demand (there is no service worker).

**Where AAC does not decode.** Playwright's Chromium (and any Chromium built without proprietary codecs) rejects every `.m4a` with `EncodingError: Unable to decode audio data`. The port's failure contract then does exactly what it says: one `console.warn` per file at `init()`, every event silent, the deal and the game unaffected (`e2e/play.mjs` plays full rounds that way). Real Chrome, Edge, Firefox and Safari all decode AAC-LC. If a codec-less browser ever matters, the Ogg masters (kept outside this repo) could be wired as a fallback chosen with `canPlayType`; it is not done because it would double the audio on disk.

## 5. Loop lengths

Sample-accurate loop points (`src/audio/sfxTable.ts` `MUSIC[*].loopEnd`), from the asset manifest's measured durations and confirmed by `afinfo` on the AAC files:

| loop | `loopEnd` | frames at 44.1 kHz | channels | bit rate |
| --- | --- | --- | --- |
| ost_1 — Saloon Stare Down (table) | 119.081 s | 5,251,476 | 2 | 160 kb/s |
| ost_3 — Ghost Town Blues (tension) | 107.714 s | 4,750,200 | 2 | 160 kb/s |
| ost_4 — Dusty Trails (results, how-to) | 103.109 s | 4,547,128 | 2 | 160 kb/s |
| CardsMovingLoop03 (ambience) | 10.069 s | 444,049 | 1 | 128 kb/s |

The web port plays each with `source.loop = true; source.loopEnd = loopEnd`. A player that cannot set a loop end would need the loop files trimmed to these lengths offline.

## 6. App icons

`public/icons/icon-512.png` and `icon-192.png` are still composed, not drawn: a canvas tiled with the 96x96 wood art (nearest-neighbour), with the 96x128 card-back art centred — at 512 the back is scaled x3 with nearest-neighbour to 288x384; at 192 the wood tiles at 1x (exactly 2x2 tiles) and the back is at 1x (96x128) — and a 2-px dark (`#120A04`) outline that follows the card's alpha mask. Both are axis-aligned (no rotation) so every art pixel stays crisp; 192 is not an integer factor of 512, so the two were composed separately rather than one being a downscale of the other. The script is a minimal PNG codec over numpy (Pillow was not installable offline); `sips -g pixelWidth -g pixelHeight` confirms 512x512 and 192x192. They were made from the 1x files, which no longer ship: to recompose, downscale the 3x `wood.png` / `card_back.png` by 3 with nearest-neighbour first (exact, since they are nearest-neighbour upscales). `index.html` uses the 192 as `apple-touch-icon` and favicon; there is no webmanifest any more, so the 512 is there for a shell to pick up.

## 7. One 3x file per sprite, drawn smoothed; pixelated only when the game is upscaled

The game is drawn at a factor k of its 956x440 frame: k < 1 on a phone, k > 1 on desktop Chrome. At k < 1 nearest-neighbour drops art pixels unevenly and at a fractional k > 1 it doubles some and not others, so no integer device scale is ever on offer and the pipeline stopped caring about one. Every sprite and the card atlas ship as **one PNG** holding 3x the art's pixels (the former `@3x` nearest-neighbour upscale, now under the plain name; the 1x and 2x twins are deleted). The CSS sets `background-size` to the art size in CSS px — `.sp-barrel { width: 48px; height: 69px; background-size: 48px 69px }` — and the browser scales the file down to it, smoothed (`image-rendering: auto`), so the result is a clean resample of 3x source rather than a blur of 1x. When the game is upscaled (k ≥ 1; stream A's scaler toggles `upscaled` on `.game`) one rule in `styles/sprites.css` flips the art to `image-rendering: pixelated`: `.game.upscaled .sp, .card, .face, .felt, .table, .title::after`.

History, in one sentence: iOS Safari resamples `pixelated` backgrounds (measured with a checker tile in the Simulator, 2026-10-05) — moot now that nothing is drawn 1:1, and the checker probe and `?dev=spike` page are gone. The table sprites:

| sprite | art (CSS px) | file |
| --- | --- | --- |
| wood | 96x96 | 288x288 |
| felt | 32x32 | 96x96 |
| p_marshal / p_outlaw / p_gambler | 96x104 | 288x312 |
| wanted | 61x71 | 183x213 |

The saloon props (`styles/sprites.css`, one class per sprite), cut on 2026-10-06 from the B-4 and B-6 tileset sheets (768x768 each, kept in the Stockroom artifact, not in this repo) by their alpha bounding boxes:

| sprite | sheet (x, y) | CSS px | note |
| --- | --- | --- | --- |
| doors_closed / doors_ajar / doors_open | B-4 (290, 488) / (386, 488) / (482, 488) | 186x158 | 93x79 art at exactly 2x, like Dusty's portrait; the title's swing frames (the file is 558x474, 3x the box) |
| sign_saloon | B-4 (387, 19) | 90x56 | the red board |
| sign_hanging | B-4 (578, 116) | 93x55 | the hanging board |
| sign_backdoor | B-6 (529, 148) | 46x40 | |
| back_bar | B-6 (0, 0) | 240x144 | the WHISKEY / BEER / RUM cabinet; the counter below it is not cut |
| barrel | B-6 (720, 218) | 48x69 | the SALOON barrel |
| lamp | B-4 (251, 692) | 31x60 | brass oil lamp |
| chips / chips_pile | B-6 (729, 425) / B-4 (674, 673) | 31x40 / 94x48 | |
| painting | B-6 (3, 384) | 86x94 | the desert, gilt frame |
| sconce / sconce_silver | B-6 (484, 385) / (436, 384) | 38x46 / 38x47 | |
| plant | B-6 (197, 690) | 40x78 | |
| stool / stool_grey | B-4 (633, 606) / (728, 606) | 31x66 / 33x66 | |
| piano | B-6 (576, 290) | 96x94 | |
| poker_table | B-6 (340, 290) | 228x87 | |
| fireplace | B-6 (393, 10) | 79x129 | |
| chair | B-4 (387, 201) | 44x72 | |

Each file is 3x the CSS px column (nearest-neighbour). A new sprite needs one file at 3x its art, one `import … ?url` line in `manifest.ts`, a name in `names.ts` (`SaloonSpriteBase` or `TableSpriteBase`), a size row in `manifest.test.ts` if it is one the layout leans on, and one `url()` + `background-size` in the rule that draws it — for a prop, a `.sp-<name>` class in `styles/sprites.css`.

## 8. Sources not in this repo

- The tileset sheets the sprites were cut from (B-4 and B-6, in the Stockroom artifact's `p/art/tilesets/`), the 52 individual card faces and the card-back source: a deferred slot that needs a new crop needs the original art pack.
- The Ogg Vorbis masters (73 SFX + 5 loops): only the AAC twins of the wired files ship. Re-transcode from the masters with the recipe in §4.
