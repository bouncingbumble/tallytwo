# Tally Two — asset decisions (derived from the Stockroom ledger)

> **Derived, not original.** This file was generated on 2026-10-05 from the Stockroom asset ledger page (`reference/tally-two-stockroom.html`, read through `reference/stockroom-extract.cjs`, never directly: its line 256 is 89 KB), with the 47-slot list taken from `docs/WEB-PLAN.md` §4. The original `ASSET-DECISIONS.md` (the plan's `AD`, "copied verbatim from the session so line refs hold") was not on this machine. **Only the slot list is line-aligned with the original**: slot *n* is on line 208 + *n* (lines 209-255), so WEB-PLAN's `AD:209`…`AD:255` references work. The original's KEPT (`AD:8-125`) and QUARANTINED (`AD:127-206`) listings cannot be reproduced from the ledger; §4 says what is known about them and §5 maps every `AD:` range WEB-PLAN cites to a section here.

## 1. The rule
Rule: a slot takes its rank-1 candidate unless that file is quarantined, then the next kept candidate; a slot with no kept candidate is "nothing", and the prototype's CSS or behaviour substitutes.

## 2. Verdicts per group (the ledger)

The ledger lists 196 entries: 14 tileset sheets, 6 card PNGs, 5 music loops, 110 SFX in 15 groups, 5 archives/duplicates and the 56 files of Jorel's card pack (which the extract skips). Verdict vocabulary: **KEEP**, **KEEP-IF-GROWS** (keep only if a feature that needs it lands), **DELETE**. Status words inside a reason: **LIVE** = wired in the prototype, **NEXT** = assigned to a slot but not yet wired, **SPARE** = reserve material. Reasons are the ledger's, lightly trimmed.

### Cards — atlas & back (6 files, all KEEP)

| File | Size | Verdict | Reason |
| --- | --- | --- | --- |
| `cards_atlas.png` 1248x512, `@2x` 2496x1024, `@3x` 3744x1536 | 54 / 73 / 108 KB | KEEP | the canonical card assets: 52-card atlas at @1x/@2x/@3x, wired into the prototype and the RN plan's plain `<Image>` path; one art pixel = one point on every iPhone |
| `card_back.png` 96x128, `@2x` 192x256, `@3x` 288x384 | 2 / 3 / 3 KB | KEEP | the card back at the same three scales |

### Art sheets — tilesets (14 sheets, 768x768 unless noted)

LIVE: A4-Walls (wood), B-4 (felt + Marshal Cobb + WANTED), B-6 (Lucky Pearl + Dusty Vane). None of the sheets is in the handoff on disk.

| Sheet | Size | Verdict | Reason |
| --- | --- | --- | --- |
| `A4-Walls.png` (768x720) | 697 KB | KEEP — LIVE | wood plank tile (0,0,96,96) for ground, top bar and table backing; also button/panel fill and a splash-background option. Only the wood/log third of the sheet is on-theme |
| `B-4.png` | 852 KB | KEEP — LIVE | felt colour source, Marshal Cobb portrait, the WANTED results poster; also chips at icon scale, batwing doors, the oak table rim for the felt-frame 9-slice, an app-icon motif |
| `B-6.png` | 645 KB | KEEP — LIVE | Lucky Pearl and Dusty Vane portraits; also the best alternate felt tables, gilt frames for the active-seat state, chandelier/sconce lighting |
| `B-11.png` | 677 KB | KEEP — NEXT | tally/stake icons (chips, coins, gold bars, cash, pocket watch), the hanging SALOON sign, two more WANTED posters, the four-aces fan (menu icon, app-icon motif, slider knob); rated the highest-value icon sheet |
| `B-12.png` | 768 KB | KEEP — NEXT | settings/how-to frame dressing, the cleanest cut-out batwing door for the title, the closest 9-slice raw material (rope, jail bars, frames; slider-track motifs); gravestones if knockout mode lands |
| `B-13.png` | 884 KB | KEEP | SPARE by the asset map, but its large seamless plank wall/floor sections with corner trim are the best sheet-panel and 9-slice source in the pack; ranked in the sheet-panel, button, opponent-panel and wood-surface slots |
| `B-3.png` | 795 KB | KEEP — NEXT | title-backdrop building fronts with baked SALOON/BANK/SHERIFF signage; the rank-1 splash/launch-screen source |
| `B-7.png` | 612 KB | KEEP — NEXT | the larger saloon front, title hero and splash option; sheriff star and small props crop into icon glyphs and app-icon motifs |
| `B-8.png` | 589 KB | KEEP — NEXT | lit lanterns with baked glow, SALOON/BANK/TRAIL/JAIL signposts, the x3 wanted posters (scoreboard); the most game-ready 9-slice/button raw material |
| `B-1.png` | 1,027 KB | KEEP-IF-GROWS — SPARE | desert overworld terrain for a mode the game does not have; a rank-4 far-layer option for the title backdrop; the largest tileset |
| `B-10.png` | 853 KB | KEEP-IF-GROWS — SPARE | domestic interiors; its felt tables and framed portraits are alternate raw material for the felt and persona slots; the surviving version of the B-9/B-10 pair |
| `B-2.png` | 701 KB | KEEP-IF-GROWS — SPARE | desert flora/rock props; crisp icon-scale extractions (tumbleweed, cactus) but nothing assigned |
| `B-5.png` | 742 KB | KEEP-IF-GROWS — SPARE | gun cases, stocked shelves and counters only matter if a cosmetics shop ever lands |
| `B-9.png` | 822 KB | DELETE | SPARE and superseded: the redraw B-10 replaced; everything useful on it exists on B-10. Keeping both duplicates 841 KB for zero coverage |

### Music loops (5 files, all KEEP in the ledger)

| File | Size | Verdict | Reason |
| --- | --- | --- | --- |
| `ost_1_-_saloon_stare_down_loop.ogg` | 2,953 KB | KEEP — LIVE | table music; seam-repaired and tuned against the 300 ms ducking — load this full-quality file, not the prototype's q2 re-encode |
| `ost_2_-_sundown_in_the_prairie_loop.ogg` | 2,415 KB | KEEP — NEXT | assigned to the title screen |
| `ost_3_-_ghost_town_blues_loop.ogg` | 2,280 KB | KEEP — NEXT | assigned as the ≤ 3-cards tension layer |
| `ost_4_-_dusty_trails_loop.ogg` | 2,197 KB | KEEP — NEXT | assigned to results / how-to-play |
| `ost_5_-_lonesome_rider_loop.ogg` | 2,346 KB | KEEP — NEXT | assigned to results / how-to-play (alternate) |

### SFX (110 files in 15 groups; one verdict per group)

| Group | Files | Verdict | Status / reason |
| --- | --- | --- | --- |
| `SFX_DeckShuffle` | 01-07 (7) | KEEP | LIVE — round-start shuffle, before the deal |
| `SFX_CardMoveFast` | 01-09 (9) | KEEP | LIVE — the deal flurry (four ticks) |
| `SFX_CardGrab` | 01-04 (4) | KEEP | LIVE — card selected / deselected in hand, the highest-frequency sound in the game |
| `SFX_CardSlapFast` | 01-09 (9) | KEEP | LIVE — playing 1-3 cards; the music-duck trigger |
| `SFX_CardSlide` | 01-07 (7) | KEEP | LIVE — playing a 5-card hand |
| `SFX_CardGrabSlide` | 01-14 (14) | KEEP | LIVE — pass |
| `SFX_CardsFalling` | 01-10 (10) | KEEP | LIVE — the trick clears after three passes |
| `SFX_CardsImpact` | 01-05 (5) | KEEP | LIVE — round won, under the WANTED poster |
| `SFX_CardsMovingLoop` | 01-03 (3) | KEEP | NEXT — the only loopable SFX; assigned as the −14 dB saloon ambience bed |
| `SFX_CardGenericMove` | 01-15 (15) | KEEP | SPARE — the named fold-in reserve if the deal/select pools start sounding mechanical over 13-card hands; 15 variants of cheap insurance (~200 KB) |
| `SFX_CardGenericMovesLong` | 01-12 (12) | KEEP | SPARE — the same reserve role for the longer pools (trick clear, 5-card play); ~155 KB |
| `SFX_CardGrabSlideLong` | 01-06 (6) | KEEP | SPARE — named reserve for the pass pool; ~58 KB |
| `SFX_CardSlideMultiple` | 01 (1) | KEEP | SPARE — a single variant that folds into the CardSlide pool for 5-card plays; 15 KB |
| `SFX_DeckMoves` | 01-03 (3) | KEEP-IF-GROWS | SPARE — no deck-pickup action exists, but it is the only credible alternate for the shuffle pool (~48 KB); keep only if you expect to touch the shuffle sound |
| `SFX_BuyCards` | 01-05 (5) | DELETE | SPARE with no plausible trigger: Big Two has no buy, draw or deck-pickup action, and unlike the generic-move spares it cannot extend any existing pool (~65 KB) |

### Archives & duplicates (nothing here is referenced by the build)

| Item | Size | Verdict | Reason |
| --- | --- | --- | --- |
| `checker.png` 32x32 | 109 bytes | KEEP | the CrispnessProbe checkerboard; the scale-verification test depends on it |
| `west.rar` | 10.8 MB | DELETE | duplicates the already-extracted tilesets |
| `Wild West Music Volume 1.rar` | 199 MB | DELETE | mp3/ogg/wav masters of the 5 shipped loops; the shipped OGGs are seam-repaired and loop-verified — the rar's versions are worse for the game (MP3 padding breaks gapless looping). The biggest single win in the repo |
| `Handoff.MD.rtf` | 7 KB | DELETE | an RTF copy of handoff notes superseded by the maintained markdown docs |
| `CardGamesVolumeIISFX/` (110 WAV masters) | 24 MB | DELETE | the WAV sources of the already-shipped OGGs, which are cleaned and level-matched; archive outside the repo if you want the masters |

### Jorel's card pack (56 entries, skipped by the extract)

The sheet, the back, the source and the 52 face PNGs (four suits of 13). The ledger groups them as `jorel-loose`, `jorel-diamonds`, `jorel-clubs`, `jorel-hearts`, `jorel-spades`. WEB-PLAN records that after the later triage "only the 52 PNGs in `Jorel's Card Pack/*` remain" — the editable `.pxo` source is gone — so the pack is the only reskin source (slot 47). None of it is in the handoff on disk.

## 3. Slot summary

**23 wired by default** (slots 1-8, 10, 11, 13-18, 22-24, 41, 43, 45, 46), **18 deferred** — a kept candidate exists but the build uses the prototype's CSS or behaviour (9, 25-40, 42) — and **6 with nothing to wire** (12, 19, 20, 21, 44, 47). 23 + 18 + 6 = 47. The web build's own wiring, file by file, is `tally-web/docs/ASSETS.md`.

## 4. What the original triage decided (as far as WEB-PLAN quotes it)

The original `ASSET-DECISIONS.md` was a stricter, later pass than the ledger. What WEB-PLAN preserves of it:

- **Counts after the triage: 46 SFX, 3 loops, 9 sheets** (`WEB-PLAN §2` "Docs": "`H/README.md:58` and `manifest.json:1745` still say 110 SFX / 5 loops / 14 sheets; after the triage it is 46 / 3 / 9"). Only `.ogg` audio survived — zero `.mp3`/`.m4a` (`AD:70-118`).
- **Kept and named by WEB-PLAN**: DeckShuffle 01/04/05; CardMoveFast 01/03/05/06/07/08/09; CardGrab 03/04; CardSlapFast 01/03/04/05/07/09; CardGenericMovesLong 05/06/07 (`AD:81-83`); CardGrabSlide 01-07/11/13; CardsFalling 01/05; CardsImpact01; CardGenericMove 01/03/06/08/10 (kept, unused); CardsMovingLoop03; CardGrabSlideLong06 ("the only rank-3 survivor" for the 5-card slot); ost_1, ost_3, ost_4 (`AD:70-72`); the six card PNGs (`AD:119-124`); `checker.png` (`AD:125`); the 52 Jorel PNGs (`AD:9-60`). That is 40 of the 46 SFX; the other six are not recoverable from the plan.
- **Quarantined and named**: ost_2 (`AD:140`), ost_5 (`AD:141`); every `CardSlide*` and `CardSlideMultiple01` (`AD:180-187`); the seven files that the prototype embeds — CardGrab01 (`:163`), CardMoveFast04 (`:176`), CardSlide01/03/05 (`:180, :182, :184`), CardsFalling02 (`:188`), DeckShuffle03 (`:203`) — "verified by hashing the blobs in `P:326` against the files on disk". The quarantine list ran `AD:142-205` (64 SFX = 110 − 46). WEB-PLAN also calls B-3 and B-8 "gone", so the triage dropped two sheets the ledger marks KEEP — NEXT.
- **Where this build departs from that triage**: `sfx-play-five` wires CardSlide 01/03/05, the ledger's LIVE pick, because the files exist on disk and sound right; the triage's substitute (CardGenericMovesLong 05/06/07) is not used. Recorded as a deviation in `tally-web/docs/ASSETS.md` slot 5; WEB-PLAN §8 q2 is the open question.
- **What is on disk now** (`assets/audio/`): 73 `.ogg` SFX (CardGenericMovesLong 05-07, CardGrab 01-04, CardGrabSlide 01-14, CardGrabSlideLong06, CardMoveFast 01-09, CardsFalling 01-10, CardsImpact 01-05, CardSlapFast 01-09, CardSlide 01-07, CardSlideMultiple01, CardsMovingLoop 01-03, DeckShuffle 01-07) and all 5 loops — a reconstruction that is neither the ledger's keep set nor the triage's; plus the 37 AAC twins the web build wires under `m4a/`.

## 5. Reading WEB-PLAN's `AD:` references against this file

| WEB-PLAN cites | Original meaning | Here |
| --- | --- | --- |
| `AD:6` | the rule | §1, line 6 |
| `AD:8-125` | KEPT listing | §2 (ledger verdicts) and §4 (the kept files WEB-PLAN names) |
| `AD:9-60` | the 52 Jorel PNGs | §2 "Jorel's card pack" |
| `AD:70-72`, `AD:70-118` | the three kept loops; "only `.ogg` survived" | §2 "Music loops", §4 |
| `AD:81-83` | CardGenericMovesLong 05/06/07 | §4 |
| `AD:119-124`, `AD:125` | the six card PNGs; checker.png | §2 "Cards", "Archives & duplicates" |
| `AD:127-206`, `AD:142-205` | QUARANTINED listing; the quarantined SFX | §4 |
| `AD:140`, `AD:141` | ost_2, ost_5 quarantined | §4 |
| `AD:163, 176, 180, 182, 184, 188, 203`, `AD:180-187` | the seven prototype-embedded files; every CardSlide | §4 |
| `AD:208-255`, `AD:209`…`AD:255`, `AD:242-251`, `AD:252` | the 47 slots | §6 below — **line-aligned**: slot *n* at line 208 + *n* |

## 6. The 47 slots
One line per slot — `n. slot-id — rank-1 candidate (from the sheet or group named) → what the web build wires; status`. Ranks and candidates are WEB-PLAN §4's; the wiring is this build's.
1. `sfx-shuffle` — DeckShuffle 01/04/05 → wired (`sfx_DeckShuffle01/04/05`, gain 0.65); wired M5
2. `sfx-deal` — CardMoveFast 01/03/05/06/07/08/09 → wired (gain 0.42); wired M5
3. `sfx-select` — CardGrab 03/04 → wired (gain 0.30); wired M5
4. `sfx-play-small` — CardSlapFast 01/03/04/05/07/09 → wired (gain 0.80, ducks the music); wired M5
5. `sfx-play-five` — rank-1 CardSlide 01/03/05 (quarantined by the triage, LIVE in the ledger) → **wired as CardSlide 01/03/05** (gain 0.55); the triage's substitute CardGenericMovesLong 05/06/07 is not used; wired M5, deviation
6. `sfx-pass` — CardGrabSlide 01-07/11/13 → wired (gain 0.45); wired M5
7. `sfx-trick-clear` — CardsFalling 01/05 → wired (gain 0.60); wired M5
8. `sfx-round-win` — CardsImpact01 → wired (gain 0.85, ducks); wired M5
9. `sfx-reserve-pool` — CardGenericMove 01/03/06/08/10 kept, unused → not copied; deferred
10. `ambience-saloon` — CardsMovingLoop03 at −14 dB → wired on its own bus, `loopEnd` 10.069 s; wired M6
11. `music-table` — ost_1 → wired (`music_ost_1`, 0.30, `loopEnd` 119.081 s); wired M5
12. `music-title` — ost_2 (quarantined), ost_5 (quarantined) → nothing; the title is silent before the first gesture anyway; **nothing**
13. `music-tension` — ost_3 → wired as a layer over the table loop, 2-s crossfade at ≤ 3 cards (`loopEnd` 107.714 s); wired M6
14. `music-results` — ost_4 → wired (`loopEnd` 103.109 s); wired M6
15. `music-howto` — ost_4 (ost_5 quarantined) → wired; playable because `init()` runs from the How to play button and `setMusic` is latched; wired M6
16. `persona-marshal-idle` — B-4 crop → `sprites/p_marshal.png` 64x64; wired M2
17. `persona-outlaw-idle` — B-6 crop → `sprites/p_outlaw.png` 64x64; wired M2
18. `persona-gambler-idle` — B-6 crop → `sprites/p_gambler.png` 64x64; wired M2
19. `persona-marshal-states` — no candidate → nothing; substitutes: active glow, red count at ≤ 3, dim at 0, "passed" badge, barks; **nothing**
20. `persona-outlaw-states` — no candidate → nothing; same substitutes; **nothing**
21. `persona-gambler-states` — no candidate → nothing; same substitutes; **nothing**
22. `display-wood` — A4-Walls (0,0,96,96) → `sprites/wood.png` 96x96; wired M2
23. `display-felt` — B-4-derived, synthesised → `sprites/felt.png` 32x32; wired M2
24. `display-wanted-poster` — B-4 crop → `sprites/wanted.png` 61x71; wired M4
25. `display-title-backdrop` — B-3 (dropped by the triage), B-7 kept uncropped → CSS gradients; deferred
26. `display-splash-screen` — B-7 kept → the PWA splash from manifest colours; deferred
27. `display-saloon-doors` — B-12 kept → CSS doors; deferred
28. `display-lamp-lighting` — B-8 (dropped), B-6 kept → none; deferred
29. `display-signage` — B-8 (dropped), B-11 kept → CSS sign; deferred
30. `display-scoreboard` — B-8 (dropped), B-4 kept → the CSS poster table; deferred
31. `display-tally-icons` — B-11 kept → none; deferred
32. `display-elimination-marker` — no knockout mode exists → none; deferred
33. `settings-howto-frames` — B-12 kept → CSS sheet; deferred
34. `ui-9slices` — B-12 / B-13 / B-8 raw material → CSS; deferred
35. `ui-button-9slice` — → CSS `.btn`; deferred
36. `ui-sheet-panel` — → CSS `.sheet`; deferred
37. `ui-opponent-panel` — → CSS `.opp`; deferred
38. `ui-felt-frame` — B-4 oak rim → CSS inset rim; deferred
39. `ui-bark-bubble` — → CSS `.bark`; deferred
40. `ui-form-controls` — → CSS `.sw` / `select`; deferred
41. `ui-volume-sliders` — B-11 knob / B-12 track motifs → CSS `<input type="range">` (new, not in the prototype), sheet art deferred; wired M6
42. `ui-menu-icon` — B-11 four-aces fan → "☰" text; deferred
43. `ui-app-icon` — B-11 motif → composed from `wood.png` + `card_back.png` (`public/icons/icon-192.png`, `icon-512.png`), not cut from B-11; wired M6
44. `ui-font-rye` — no candidate in the pack → `@fontsource/rye` (npm, OFL); **nothing** (substitute)
45. `cards-faces` — `cards_atlas.png` + @2x + @3x → wired; wired M0
46. `cards-back` — `card_back.png` + @2x + @3x → wired (western reskin open); wired M2
47. `cards-reskin-source` — the `.pxo` is gone; only the 52 Jorel PNGs remain, not on disk here → **nothing**

## 7. How to regenerate the ledger view

```sh
cd tally-two-handoff
node reference/stockroom-extract.cjs reference/tally-two-saloon.html reference/tally-two-stockroom.html /tmp/stockroom-out
```

It decodes the prototype's embedded pack to `/tmp/stockroom-out` (eight images and the sixteen low-quality SFX re-encodes it inlines — never wire those), then prints every ledger entry as `name  dims  size  VERDICT — reason` grouped as above, followed by the `GROUPS` table (group id, name, note, recommendation). The ledger's own constants are `ASSETS` and `GROUPS`.
