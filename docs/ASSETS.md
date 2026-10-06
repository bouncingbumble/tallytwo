# Assets

What this build actually wires, and how it got here. The 47 slots are the original asset plan's; where this build deviates from it, the row says so.

**Counts.** 47 slots: **23 wired**, **18 deferred** (a kept candidate exists but the build uses the prototype's CSS or behaviour instead), **6 with nothing to wire**. 23 + 18 + 6 = 47. On disk under `src/assets/`: 6 card PNGs, 7 sprites at 1x/2x/3x (21 PNGs, §7), 34 SFX (`.m4a`, 33 one-shots + the ambience loop), 3 music loops (`.m4a`).

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
| 13 | music-tension | ost_3 ("Ghost Town Blues"), layered over ost_1 with a 2-s crossfade when any seat is at ≤ 3 cards | wired |
| 14 | music-results | ost_4 ("Dusty Trails") | wired |
| 15 | music-howto | ost_4 (ost_5 quarantined); playable because `init()` runs from the How to play button too and `setMusic` is latched | wired |
| 16 | persona-marshal-idle | `sprites/p_marshal.png` 96x104 canvas, the 90x91 framed portrait from B-4 at 1x | wired |
| 17 | persona-outlaw-idle | `sprites/p_outlaw.png` 96x104 canvas, the 43x52 framed portrait from B-6 at exactly 2x | wired |
| 18 | persona-gambler-idle | `sprites/p_gambler.png` 96x104 canvas, the 77x88 framed portrait from B-6 at 1x | wired |
| 19-21 | persona-{marshal,outlaw,gambler}-states | — ; substitutes: active glow, red count at ≤ 3, dim at 0, "passed" badge, barks (all CSS/state) | **nothing** |
| 22 | display-wood | `sprites/wood.png` 96x96 (A4-Walls 0,0,96,96) | wired |
| 23 | display-felt | `sprites/felt.png` 32x32 (B-4-derived, synthesised) | wired |
| 24 | display-wanted-poster | `sprites/wanted.png` 61x71 (B-4) | wired |
| 25 | display-title-backdrop | — (B-3 dropped by the triage; B-7 kept, uncropped); CSS gradients | deferred |
| 26 | display-splash-screen | — (B-7 kept); on the web the PWA splash is generated from the manifest colours | deferred |
| 27 | display-saloon-doors | — (B-12 kept); CSS doors (`styles/base.css` `.doors`) | deferred |
| 28 | display-lamp-lighting | — (B-8 dropped; B-6 kept) | deferred |
| 29 | display-signage | — (B-8 dropped; B-11 kept); CSS sign (`.sign`) | deferred |
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
| 45 | cards-faces | `cards/cards_atlas.png` 1248x512 + `@2x` + `@3x` | wired |
| 46 | cards-back | `cards/card_back.png` 96x128 + `@2x` + `@3x` (western reskin open) | wired |
| 47 | cards-reskin-source | — (the `.pxo` is gone; only the 52 face PNGs in Jorel's pack remain, and they are not in the handoff on disk) | **nothing** |

Wired: 1-8, 10, 11, 13-18, 22-24, 41, 43, 45, 46 (23). Deferred: 9, 25-40, 42 (18). Nothing: 12, 19, 20, 21, 44, 47 (6).

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

1. **Sprites**: `src/assets/sprites/{wood,felt,p_marshal,p_outlaw,p_gambler,wanted,checker}.png`, each with its `@2x` and `@3x` nearest-neighbour upscale (§7). The wood, felt and WANTED sprites were decoded from the prototype's embedded asset pack; the three portraits were re-cut from the B-4/B-6 tileset sheets at native pixel size (the prototype's 64x64 copies were resampled and had the frames clipped); the tileset sheets they were cut from are source material only and are not in this repo (every `ui-*` 9-slice slot is deferred).
2. **Cards**: `src/assets/cards/` (6 PNGs: atlas and back at @1x/@2x/@3x; the @2x/@3x are exact nearest-neighbour upscales).
3. **Audio**: the 34 SFX and 3 loops named in the tables above, as AAC `.m4a` (§4), in `src/assets/sfx/` and `src/assets/music/` (`ost_1.m4a`, `ost_3.m4a`, `ost_4.m4a`; the long Ogg names are dropped).
4. **Names, then URLs.** `src/assets/names.ts` (PURE) declares `AssetName` as a closed union, identifier-shaped so each name is also a variable name (`sfx_DeckShuffle01`, `music_ost_1`, `cards_atlas_2x`), plus `PortraitKey`. `src/assets/manifest.ts` (WEB) is an **explicit import table**, one `import x from "./….m4a?url"` line per asset, and `export const MANIFEST = { … } satisfies Record<AssetName, string>`. A missing or misspelled **file** is a Vite resolve error (`npm run dev` and `npm run build` both stop); a missing or misspelled **key** is TS2741. A DEV-only guard throws on the first asset whose URL resolved to nothing, so a bad URL surfaces on `npm run dev`, not only under `npm test`. `import.meta.glob` cannot do this (an eager `?url` glob is typed `Record<string, string>`, which satisfies anything), which is why the table is written out.
5. **Portraits**: `PORTRAITS: Record<PortraitKey, AssetName>`; `ai/getPersonality.ts` narrows `Personality.portrait` (a `string`) to `PortraitKey` at runtime and `manifest.test.ts` asserts every `PERSONALITIES[k].portrait` is a key of `PORTRAITS`, so a misspelled portrait key fails a test instead of drawing a blank seat.
6. **CSS, not variables**: every texture and portrait is an `image-set()` written in the rule that uses it — `styles/base.css` (`body`, `.checker-tile`), `styles/table.css` (`.table`, `.topbar`, `.felt`, `.face.p_marshal`, `.face.p_outlaw`, `.face.p_gambler`, `.face.wanted`) — and the atlas and card back are `image-set()`s in `styles/cards.css`; Vite resolves and hashes the `url()`s. Not in custom properties, because the bundler emits the `-webkit-image-set()` fallback (iOS ≤ 16) only inside a rule. Nothing sets a texture from JavaScript (the prototype's `:root` trick is retired): an inline `url()` would override the set with the 1x file and bring the blur back on iOS. `MANIFEST` still lists every file (1x, `_2x`, `_3x`) so `manifest.test.ts` proves they exist.
7. Vite emits hashed URLs; `.png`/`.m4a` are static assets by default. The PWA precache (`vite.config.ts`) includes them, with the per-file cap raised to 8 MB for the loops.

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

The 2,112-frame priming (encoder delay) is recorded in the file and Web Audio's `decodeAudioData` trims it, so a decoded buffer starts on the first real sample and `loopEnd` can be the measured duration. Budget: the 34 SFX together are about 0.66 MB (0.5 MB without the ambience loop); the three loops are about 6.7 MB; everything is precached by the service worker.

**Where AAC does not decode.** Playwright's Chromium (and any Chromium built without proprietary codecs) rejects every `.m4a` with `EncodingError: Unable to decode audio data`. The port's failure contract then does exactly what it says: one `console.warn` per file at `init()`, every event silent, the deal and the game unaffected (`e2e/play.mjs` plays full rounds that way). Real Chrome, Edge, Firefox and Safari all decode AAC-LC. If a codec-less browser ever matters, the Ogg masters (kept outside this repo) could be wired as a fallback chosen with `canPlayType`; it is not done because it would double the precache.

## 5. Loop lengths

Sample-accurate loop points (`src/audio/sfxTable.ts` `MUSIC[*].loopEnd`), from the asset manifest's measured durations and confirmed by `afinfo` on the AAC files:

| loop | `loopEnd` | frames at 44.1 kHz | channels | bit rate |
| --- | --- | --- | --- |
| ost_1 — Saloon Stare Down (table) | 119.081 s | 5,251,476 | 2 | 160 kb/s |
| ost_3 — Ghost Town Blues (tension) | 107.714 s | 4,750,200 | 2 | 160 kb/s |
| ost_4 — Dusty Trails (results, how-to) | 103.109 s | 4,547,128 | 2 | 160 kb/s |
| CardsMovingLoop03 (ambience) | 10.069 s | 444,049 | 1 | 128 kb/s |

The web port plays each with `source.loop = true; source.loopEnd = loopEnd`. The React Native port cannot set a loop end on an expo-audio player, so there the three loop files are trimmed to these lengths offline (`docs/PORTING.md`).

## 6. App icons

`public/icons/icon-512.png` and `icon-192.png` are composed, not drawn: a canvas tiled with `src/assets/sprites/wood.png` (96x96, nearest-neighbour), with `src/assets/cards/card_back.png` centred — at 512 the back is scaled x3 with nearest-neighbour to 288x384; at 192 the wood tiles at 1x (exactly 2x2 tiles) and the back is at 1x (96x128) — and a 2-px dark (`#120A04`) outline that follows the card's alpha mask. Both are axis-aligned (no rotation) so every art pixel stays crisp; 192 is not an integer factor of 512, so the two were composed separately rather than one being a downscale of the other. The script is a minimal PNG codec over numpy (Pillow was not installable offline); `sips -g pixelWidth -g pixelHeight` confirms 512x512 and 192x192. `index.html` uses the 192 as `apple-touch-icon` and favicon; the webmanifest lists both, the 512 also as `maskable`.

## 7. Sprites at 1x/2x/3x: why

The plan drew the wood, felt, portraits and WANTED face at integer multiples and trusted `image-rendering: pixelated` to keep them crisp. Measured in the iOS Simulator (real Safari; native-resolution screenshots; pixel histograms with Pillow), that is not true: a 1-px black/white checker (`checker.png`, values 0 and 255 only) drawn as a `pixelated` background at `background-size: 32px` came out as greys — `{170, 85, 142, 113}` dominant, barely any 0 or 255 — at dpr 2 **and** dpr 3. Safari resamples pixelated CSS backgrounds. The cards never had the problem because their `image-set()` lets the browser pick the @2x/@3x atlas and draw it 1:1 with no scaling at all.

So every sprite now ships the way the cards do: nearest-neighbour upscales made offline (Pillow `Image.NEAREST`, `scripts` in the session; the files are committed) and referenced through `image-set(url(x) 1x, url(x@2x) 2x, url(x@3x) 3x)`. After the change the same checker histogram is exactly `{0: 28800, 255: 28800}` at dpr 3. The files:

| sprite | 1x | @2x | @3x |
| --- | --- | --- |
| wood | 96x96 | 192x192 | 288x288 |
| felt | 32x32 | 64x64 | 96x96 |
| p_marshal / p_outlaw / p_gambler | 96x104 | 192x208 | 288x312 |
| wanted | 61x71 | 122x142 | 183x213 |
| checker | 32x32 | 64x64 | 96x96 |

A new sprite needs its two upscales, three `import … ?url` lines in `manifest.ts`, three names in `names.ts`, and one `image-set()` in the rule that draws it.

## 8. Sources not in this repo

- The tileset sheets the sprites were cut from, the 52 individual card faces and the card-back source: a deferred slot that needs a new crop needs the original art pack.
- The Ogg Vorbis masters (73 SFX + 5 loops): only the AAC twins of the wired files ship. Re-transcode from the masters with the recipe in §4.
