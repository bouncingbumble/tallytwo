# Tally Two — decisions (reconstructed)

> **Reconstructed file.** The original `DECISIONS.md` was not on this machine; this copy was rebuilt on 2026-10-05 from the constraints table in `docs/WEB-PLAN.md` §1 (which cites it by line), from the handoff summary that came with the artifacts, from the prototype (`reference/tally-two-saloon.html`, cited as `P:<line>` in that file's own numbering) and from numbers measured here with `npm run sim`. Every statement carries its source in square brackets; `[inferred]` marks a reading of the code rather than a recorded decision.
> Sections are laid out so that WEB-PLAN's `DECISIONS.md:<line>` references land where they point: rules 9-23 (persistence at 20), cards 47-72, difficulty 74-92 (the numbers at 76-83), portrait phone 94-99, open questions 103-114 (card back 108-109, portrait states and 9-slices 110-111, match length 113-114), deliberately not done 116-121 (landscape at 121). Check those lines again if you reflow it.

The decisions date from September 2026 (the plan is dated Sep 22, 2026). They were taken for the React Native build and carried over unchanged into the Vite web build in `tally-web/`; §9 lists the defaults the web build took where this file left a question open.

## 1. The game and its rules
- **Big Two, four-handed**: one human (seat 0, "You") against three AI regulars — Marshal Cobb, Dusty Vane, Lucky Pearl. `[WEB-PLAN §1 row 1; P:694-698]`
- **Hong Kong rules** are the baseline: 3 low, 2 high; suits ♦ < ♣ < ♥ < ♠; five-card hands rank straight < flush < full house < four + kicker < straight flush; the 3♦ holder leads round 1; three passes clear the table. `[P:287-299; tally-web/src/engine/{combos,compare}.ts]`
- **Every disputed rule is a flag**, and the settings sheet exposes exactly these five and nothing else (`tally-web/src/engine/rules.ts`): `[WEB-PLAN §1 row 1]`

| flag | default | what it decides |
| --- | --- | --- |
| `passLocksOut` | off | pass and you are out until the trick clears; off: you may play again if it comes back round |
| `straightWrap` | off | A-2-3-4-5 and 2-3-4-5-6 count as straights, ranked below every other straight |
| `flushSuitFirst` | on | flushes compare by suit first, then highest card; off: highest card decides |
| `mustLeadWith3D` | on | the opening lead of a 3♦-led round must include the 3♦ |
| `laterRoundLead` | `"winner"` | who leads round 2 onwards: last round's winner, the biggest loser, or whoever holds the 3♦ (every round then starts like round 1) |
- **Persistence: settings only.** The game dies with the tab; nothing but `{ rules, opts }` is stored, under the single `localStorage` key `tallytwo.settings`. `[WEB-PLAN §1 row 4; P:1050-1056]`
- **Scoring**: losers pay one point per card left, doubled at ten or more, tripled at thirteen; the winner collects the pot, so every round's deltas sum to zero and totals run across rounds. `[P:562-566; engine/scoring.ts]`
- **Rules are read at the deal.** They live inside the game state once a match starts, so a rule change applies to the next game. (The prototype mutated them live, which only half-worked: `forced3D` is fixed at deal time.) `[WEB-PLAN §3.3, §8 q3]`
- **Seats are fixed**: seat order and names never change; seat 0 has no personality and no bark lines, so every bark path is AI-only. Match length is open — see §7. `[engine/reducer.ts DEFAULT_SEATS; WEB-PLAN §3.4]`

## 2. Engine shape

- **One pure reducer.** `reduce(state, action) => state` never mutates its input and never calls `Math.random` or the clock; everything that changes the game goes through it. `[engine/reducer.ts:1-9]`
- **Illegal actions throw.** The UI only dispatches moves that came from `legalMoves()` and the AI only returns such moves, so a throw is a bug, not a user error — and it is reproducible. `[engine/reducer.ts:5-9]`
- **A bug report is a seed and a list of moves.** `replay(seed, rules, actions)` rebuilds any round-1 position; `deal(seed, rules, seats, round, lastLeader, totals)` does the same for a later round. `[engine/reducer.ts:7-9]`
- **State is plain JSON**: no classes, Sets or functions inside `GameState`; the only derived structure (the Set of played cards) is rebuilt per call by `publicView()`. `[engine/state.ts:1-5]`
- **The AI sees only the public view plus its own hand**, and draws every random decision from the `rng` it is handed. `[ai/choose.ts:1-4]`
- **Two random streams per deal**: `mulberry32(seed)` shuffles, `mulberry32(seed ^ 0x9e3779b9)` drives the AI, so a round replays from its seed alone. Cosmetics (think time, barks, pitch jitter) use `Math.random`, so they can never change a decision. `[scripts/sim.mjs:20; WEB-PLAN §3.3]`
- **Move generation is structural**, not brute force, and its output order is part of the AI's behaviour (ties go to the first candidate found). `[ai/moves.ts:1-8]`
- **The "plays to empty" count is memoised at module level**; `clearPartitionCache()` runs on every new match and in test setup. `[ai/partition.ts]`

## 3. Rendering: no Skia, plain sprites

- **No Skia.** The Skia atlas path (`Atlas`/`RSXform` + Reanimated) was spiked and dropped: plain `<Image>` sprites at an integer scale are crisp and simpler. On the web this is DOM/CSS `background-position` sprites, no canvas. `[WEB-PLAN §2 render/*.tsx verdicts, §3.6]`
- **Integer scale or nothing.** The scale factor S (device pixels per art pixel) is always a whole number; a fractional S "looks like the browser is blurring it". `[render/scale.ts:5-9]`
- **Rest pose is integer and unrotated.** Cards sit at whole CSS px with `rotate(0)`; animations may pass through fractions but end there. The prototype's resting `rotate(t*2.4deg)` fan is the one thing not copied. `[render/fanLayout.ts; WEB-PLAN §3.6]`
- **Other sprites at integer multiples too**: wood tile 96 px, felt tile 32 px, portraits 64 px (the prototype's 46 px was rejected), poster face 61x71. `[WEB-PLAN §3.6]`
- **One source of truth per sprite.** The six display sprites (wood, felt, three portraits, WANTED face) are already-cropped PNGs; the tileset sheets are source material only. `[WEB-PLAN §1, §3.8]`
- **Chrome is CSS**, not 9-slice art: buttons, sheets, the felt rim, seat panels and the bark bubble are the prototype's CSS. §7 says what that leaves open. `[WEB-PLAN §4 slots 34-42]`
- **Font**: Rye (OFL) for the western headings, self-hosted on the web (`@fontsource/rye`) so there is no FOUT and it works offline. `[WEB-PLAN §3.6]`

## 4. Cards: 96x128 art, 48 px floor, 360 px fan
- **Source art is 96x128 px per card**, in a 13 x 4 atlas (`cards_atlas.png`, 1248x512) plus a card back, each at @1x/@2x/@3x (the @2x/@3x files are exact nearest-neighbour upscales). `[assets/cards; render/atlas.ts; WEB-PLAN §3.6]`
- **A card on screen is 96x128 CSS px, always.** On every iPhone (dpr 2 or 3) that is one art pixel = one device pixel x dpr, so the @2x/@3x atlas is blitted 1:1 with no resampling. `[render/scale.ts:5-9; WEB-PLAN §1 row 3]`
- **Legibility floor: 48 CSS px.** Below that a 96-px face is unreadable at arm's length; the hand never shrinks below it. `[render/scale.ts LEGIBLE_MIN_PT]`
- **The covered part of a fanned card must show its corner index: 20 art px.** `[render/scale.ts CORNER_INDEX_ART]`
- **13-card fan = 360 px wide**: step `floor(96 * 0.23) = 22`, span `96 + 12 * 22 = 360`, which fits every phone of 376 CSS px or more with 8-px gutters; the 375-px phones get step 21 / span 348. `[render/scale.ts fanStepArt, fanSpanArt; render/fanLayout.ts]`
- **The pile is one scale step smaller** (`S_small = max(1, dpr - 1)`: 48 CSS px on dpr 2, 64 on dpr 3) and is the first thing that shrinks; the hand never does. `[render/scale.ts smallCardScale; WEB-PLAN §3.6]`
- **The engine and the atlas disagree on both axes** (engine suits ♦ ♣ ♥ ♠ vs atlas rows ♦ ♠ ♥ ♣; engine ranks 3..K A 2 vs atlas columns A 2 3..K), so `ATLAS_ROW = [0,3,2,1]` and `ATLAS_COL = [2..12,0,1]` are pinned by a test. `[render/atlas.ts:4-8]`
- **Card back**: Jorel's red lattice; a western reskin is wanted but open (§7). `[WEB-PLAN §4 slot 46]`

The device matrix the numbers were checked against (portrait, CSS px): `[render/scale.ts DEVICES, reportFor]`

| Device | CSS px | dpr | S | card px | fan step | fan span |
| --- | --- | --- | --- | --- | --- | --- |
| iPhone SE (3rd gen) | 375 x 667 | 2 | 2 | 96 | 21 | 348 |
| iPhone 13 mini | 375 x 812 | 3 | 3 | 96 | 21 | 348 |
| iPhone 15 | 393 x 852 | 3 | 3 | 96 | 22 | 360 |
| iPhone 15 Plus | 430 x 932 | 3 | 3 | 96 | 22 | 360 |
| iPhone 15 Pro Max | 430 x 932 | 3 | 3 | 96 | 22 | 360 |
| iPhone 16 Pro | 402 x 874 | 3 | 3 | 96 | 22 | 360 |
| iPhone 16 Pro Max | 440 x 956 | 3 | 3 | 96 | 22 | 360 |

Three invariants hold on every row: whole device pixels, a 13-card fan that fits, a readable corner index. `[render/scale.ts reportFor; scale.test.ts]`

Vertical budget on the smallest phone (SE, 667 px): topbar ~40 + seats 124 + felt ≥ 126 + hand 150 + status 22 + controls ~58 = 520 — a calculation, confirmed on the device by the M2 gate. `[WEB-PLAN §3.6]`

If it ever fails, the fallback order is: pile at `S_small` (already), portraits 32 px under `max-height: 700px`, a shorter sign — never a fractional hand scale. `[WEB-PLAN §3.6]`

## 5. Difficulty: Hard is not measurably stronger than Medium
Measured with the simulation harness (`npm run sim`): AI-only games through the real reducer, seat 0 benchmarked against the other three. The original measurement was 600 games per matchup; the figures below are this machine's 300-game run (75 games per matchup, seeds 1000 and up). `[ai/choose.ts:11-12; sim run 2026-10-05]`

| Matchup | seat 0 wins | even odds |
| --- | --- | --- |
| Card sharp (hard) vs three Greenhorns (easy) | 48/75 = **64 %** | 25 % |
| Regular (medium) vs three Greenhorns (easy) | 47/75 = **63 %** | 25 % |
| Card sharp (hard) vs three Regulars (medium) | 25/75 = **33 %** | 25 % |
| all Regular | seat wins 20 / 18 / 22 / 15 | — |
Hard beats Greenhorns no more often than Medium does (64 % against 63 %), and against Regulars it is barely above even odds (33 %).

- **Why**: Hard differs from Medium only in fixed tuning (`WEIGHTS.hardControl`, `WEIGHTS.hardPass` instead of the personality's `control`/`passBias`) and in card counting (`unbeatable()` over the unseen cards). Card counting alone buys nothing without lookahead; the labels differ, the play does not. `[ai/choose.ts:6-12, :47-54, :77, :88]`
- **Decision: no lookahead work.** A real Hard would need search over the opponents' possible hands; that is out of scope for a solo project. `[WEB-PLAN §1 row 6]`
- **Ship the three labels anyway** — Greenhorn / Regular / Card sharp, the prototype's words — with the hint line "Card sharp plays the same as Regular for now" in the settings sheet. Dropping to two levels is the alternative (WEB-PLAN §8 q4). `[P:268; game/copy.ts]`
- **Easy is genuinely weaker**: a random legal move biased low, with a 12 % chance of passing for no reason when following. `[ai/choose.ts:41-45]`
- **Medium is where the personalities live**: `control` (how dearly 2s and aces are held), `noise` (chance of a random legal move) and `passBias` (chance of letting a trick go) differ per regular; Hard ignores all three. `[ai/personalities.ts]`
- **Everyone takes an out-in-one**, at every difficulty. `[ai/choose.ts:37-39]`
- **The win rates are printed, not asserted**: the Vitest sim asserts only 0 illegal actions and 0 stalls; the CLI prints the numbers so a tuning change is visible. `[scripts/sim.mjs; WEB-PLAN §6]`
- **Re-measure after touching `WEIGHTS`** (`npm run sim -- 1000`). `[ai/evaluate.ts:2-3]`

## 6. Target: a portrait phone, iPhone Safari first
- **Portrait phone is the design target**; iPhone Safari (dpr 2 and 3) is the only promised browser. Desktop gets the same phone-width column, centred, `max-width: 440px` (the largest iPhone). `[WEB-PLAN §1 row 2, §3.6]`
- **The seven-iPhone matrix in §4 is the verification set**; nothing is checked on Android or on tablets. `[render/scale.ts DEVICES]`
- **Landscape is not a layout.** The browser cannot lock orientation and iPhone landscape heights (375-430 CSS px) cannot hold the column, so landscape shows "Turn your phone to play" and pauses the AI; rotating back resumes. `[WEB-PLAN §3.6; game/copy.ts landscape]`
- **Add to Home Screen is part of the target**: `apple-mobile-web-app-*` tags, 192/512 icons, standalone display, portrait orientation in the webmanifest. `[tally-web/index.html; vite.config.ts]`
- **Touch first**: `touch-action: manipulation`, no text selection, big buttons; keyboard operability (Tab + Space on every switch) is kept because it is cheap. `[P:33-34, P:1058-1064]`

## 7. Open questions (as the handoff left them)

These were open when this file was written; §9 records the default the web build took for each.
1. **Difficulty labels** — three labels with a hint line, or two honest levels? (§5.) `[WEB-PLAN §8 q4]`
2. **Ogg on iPhone** — the kept audio pack is Ogg Vorbis only; whether iOS Safari's `decodeAudioData` accepts it decides the shipped format. `[WEB-PLAN §1 asset constraints, §8 q5]`
3. **Rules apply next game** — ship with the sheet note, or add a `SET_RULES` re-deal mid-match? `[WEB-PLAN §8 q3]`
4. **The `sfx-play-five` sound** — the later triage quarantined every `CardSlide*` file while the Stockroom ledger marks them LIVE; substitute, restore, or wire the ledger's pick? `[WEB-PLAN §8 q2]`
5. **Western card back.** The shipped back is Jorel's red lattice; a saloon-flavoured reskin was wanted, but the editable `.pxo` source is gone and only the 52 face PNGs remain, so a reskin means redrawing the back by hand. `[WEB-PLAN §4 slots 46-47]`
   Options: keep the lattice (the build's default), or draw a new 96x128 back and regenerate @2x/@3x by nearest-neighbour upscale.
6. **Portrait states and 9-slices.** No per-state portrait art exists (active / low / out / passed are CSS: amber glow, red count, dimming, a "passed" badge, barks) and no 9-slice chrome has been cut from the sheets (buttons, sheet panel, felt rim, seat panel, bark bubble are CSS).
   Options: keep CSS chrome as the prototype does (the build's default), or cut frames from B-4 / B-6 / B-11 / B-12 / B-13 when the look needs it. `[WEB-PLAN §4 slots 19-21, 34-42]`

7. **Match length.** The prototype is endless — "Next round" forever, totals running. Is a match a fixed number of rounds, a target score, or endless? Nothing here decides it. `[P:1021-1023]`
   The web build's default: endless, plus a `roundsPerMatch` setting (Endless / 5 / 10) and a "FINAL TALLY" poster naming the highest tally when it is reached (WEB-PLAN §3.4, §8 q1).

## 8. Deliberately not done
- **No persisted game.** Reloading mid-round starts over; only settings survive (§1). A persisted game would need a versioned state blob and a migration story — not worth it for a three-minute round. `[WEB-PLAN §1 row 7]`
- **No multiplayer, no network.** One human, three AIs, all local. `[inferred: nothing in the engine or the plan allows a second human]`
- **No knockout or elimination mode.** The "elimination marker" art slot has nothing to mark. `[WEB-PLAN §4 slot 32]`
- **No lookahead AI.** See §5. `[WEB-PLAN §1 row 6]`
- **No landscape layout**, on purpose: the overlay in §6 is the whole landscape story. Offline/installability is *not* decided here — see §9. `[WEB-PLAN §1 row 7, §3.6, §8 q6]`

## 9. Defaults the web build took

| Open question | Default taken | Where |
| --- | --- | --- |
| Match length (§7 q7) | **Endless**, plus a `roundsPerMatch` setting of Endless / 5 / 10; `matchOver(game, roundsPerMatch)` and a "FINAL TALLY" poster naming the seat with the highest tally (tie → the seat that won the last round) | `tally-web/src/game/selectors.ts`, `settings/settings.ts`; WEB-PLAN §3.4 |
| Difficulty labels (§7 q1) | **Three labels** — Greenhorn / Regular / Card sharp — with the hint "Card sharp plays the same as Regular for now" | `game/copy.ts`; WEB-PLAN §8 q4 |
| Ogg on iPhone (§7 q2) | **AAC `.m4a`** for the 37 wired files, transcoded with libsndfile + `afconvert` (iOS Safari cannot decode Vorbis; ffmpeg was not installed); gapless metadata confirmed with `afinfo` | `tally-web/docs/ASSETS.md` §4 |
| Rules apply next game (§7 q3) | **Yes** — rules are read at `NEW_MATCH` only; the sheet says "Rule changes apply to the next game" | `game/appReducer.ts`; `game/copy.ts` |
| `sfx-play-five` (§7 q4) | **CardSlide 01/03/05**, the ledger's LIVE pick, since the files exist; the plan's substitute is not used | `audio/sfxTable.ts`; `ASSETS.md` slot 5 |
| Western card back (§7 q5) | **Keep the lattice** | `ASSETS.md` slot 46 |
| Portrait states and 9-slices (§7 q6) | **CSS chrome**, as the prototype does | `ASSETS.md` slots 19-21, 34-42 |
| Online-only or installable-offline (not decided above) | **Installable-offline** via vite-plugin-pwa: standalone, portrait, everything precached including the three music loops | `tally-web/vite.config.ts`; WEB-PLAN §8 q6 |

## Sources

- `docs/WEB-PLAN.md` §1 (the constraints table, which cites the original `DECISIONS.md` by line), §3.3-3.6, §4, §8.
- `reference/tally-two-saloon.html` — the prototype's settings sheet (`P:256-282`), how-to text (`P:284-302`), scoring (`P:562-566`), seats (`P:690-712`), persistence (`P:1048-1056`).
- `tally-web/src/engine/*.ts`, `src/ai/*.ts`, `src/render/scale.ts` — doc comments that restate the decisions.
- `npm run sim -- 300` on 2026-10-05 (Node 24.15): the difficulty numbers in §5.
