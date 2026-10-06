# Big Two: Saloon Edition — Build Plan (reconstructed summary)

> **A faithful summary, not the original.** The original was a claude.ai artifact titled "Big Two: Saloon Edition — Build Plan" — sections 0-10, milestones and the first five tasks — for the React Native app, and its HTML is not on this machine. This file was rebuilt on 2026-10-05 from what `docs/WEB-PLAN.md` quotes of it (`BUILD-PLAN.md:10`, the stack; `:92-99`, the audio wiring notes), from the constraints table in WEB-PLAN §1 and from the handoff's own code and docs. Section titles, their order and the milestone split are reconstructed and may not match the original's wording. Lines 10 and 92-99 are laid out to land where WEB-PLAN points.

## 0. What we are building

A single-player Big Two for a portrait phone: one human against three saloon regulars with distinct personalities, a wooden table with a felt centre, a WANTED poster at the end of every round, a running tally across rounds, settings, a how-to sheet, sound and music. Hong Kong rules, with every disputed rule exposed as a flag. Shipped first as the browser prototype (`reference/tally-two-saloon.html`), then as the React Native app this plan describes, now as the Vite web app (`docs/WEB-PLAN.md`).

## 1. Stack
Expo (managed), TypeScript, expo-router; React Native with plain `<Image>` sprites (Skia was spiked for the card atlas and dropped — plain images at an integer scale are crisp and simpler), react-native-reanimated for card motion, `@react-native-async-storage/async-storage` for settings, expo-audio for sound; native dependencies added with `npx expo install`. Strict TypeScript, ES2020 target, `moduleResolution: bundler`.

## 2. Rules

Big Two, four players, thirteen cards each. 3 low, 2 high; suits ♦ < ♣ < ♥ < ♠. Singles, pairs, triples and five-card hands (straight < flush < full house < four + kicker < straight flush); follow with the same number of cards and beat the table, or pass; three passes clear the table and the last player to play leads anything. Losers pay a point per card left (doubled at ten, tripled at thirteen); the winner collects the pot. Every disputed rule is a flag in `RuleConfig`: `passLocksOut`, `straightWrap`, `flushSuitFirst`, `mustLeadWith3D`, `laterRoundLead` (winner / loser / threeD). Defaults: off, off, on, on, winner — the Hong Kong game as the prototype shipped it.

## 3. Architecture

Four layers, each importing only downwards, and the first two are pure:

| Layer | Folder | Contents |
| --- | --- | --- |
| engine | `src/engine/` | `cards` (the integer encoding, `mulberry32`, `shuffle`), `rules`, `scoring`, `combos` (`classify`, `describe`), `compare` (`beats`), `state` (`GameState`, `publicView`), `reducer` (`deal`, `reduce`, `replay`) — zero imports, all pure |
| ai | `src/ai/` | `moves` (`genMoves`, `legalMoves`), `partition` (plays-to-empty, memoised), `evaluate` (`WEIGHTS`, control, card counting), `personalities` (the three regulars and their barks), `choose` (`chooseMove`) — imports only the engine |
| render | `src/render/` | `atlas` (card → atlas cell), `scale` (the iPhone matrix and the integer-scale rule), `CardFan` / `PlainImageFan` (the fan at integer positions), the spike screens |
| app | `app/`, `src/ui/` | expo-router screens: title, table, results, settings, how-to; the turn loop; audio; persistence |

The whole game is one plain JSON object. `reduce(state, action)` is pure, never mutates, never calls `Math.random` or the clock, and throws on an illegal PLAY or PASS, because the UI only dispatches what `legalMoves()` returned and the AI only returns such moves; a throw is a bug and it is reproducible from the seed and the action list. The AI sees the public view plus its own hand and draws every random decision from the `rng` it is handed.

## 4. State and persistence

`useReducer` over the engine's reducer, with a thin app reducer around it for new-match / quit, plus a settings reducer. Settings (`{ rules, opts }`) persist under one key, `tallytwo.settings`, through an async storage port; the game itself does not persist — it dies with the app. A seed fixes the deal **and** the AI's random stream (a second `mulberry32` off the same seed), so any round replays from its seed alone; cosmetics (think time, barks, pitch jitter) use `Math.random` so they can never change a decision. Rules are read at the deal; a rule change applies to the next game.

## 5. AI and difficulty

Three regulars, one tuning of the same heuristics each: Marshal Cobb (control 9, no noise, always lets a trick go when taking it would not shorten the hand), Dusty Vane (control 2, 5 % noise, pass bias 0.3), Lucky Pearl (control 5, 16 % noise, pass bias 0.7), each with play / pass / win bark lines. Difficulty: **easy** a random legal move biased low; **medium** the heuristics flavoured by the personality; **hard** fixed tuning plus card counting over the unseen cards. The heuristic: take an out-in-one; otherwise score the cheapest few moves of every shape by plays-to-empty after the move, control cards spent and key, with a bonus for five-card hands and a penalty for feeding cheap singles in the endgame. Measured over 600 games per matchup: Hard is **not** stronger than Medium — card counting alone buys nothing without lookahead — so ship the three labels with a hint line and do no lookahead work.

## 6. Rendering and crispness

Card art is 96x128 pixels; a card on screen is 96x128 points, always. On every iPhone (scale 2 or 3) that is one art pixel = one device pixel x scale, so the @2x/@3x atlas is drawn 1:1 with no resampling. The scale factor S must be an integer, or the art looks blurred. Rest pose: integer positions, zero rotation; animations may pass through fractions but end on the integer pose; never a scale transform on an ancestor. Legibility floor 48 points; the fanned card's 20-px corner index must stay visible; a 13-card fan is 360 points wide (step 22) and fits every phone from 376 points up, with step 21 / 348 on the 375-point phones. The pile sits one scale step below the hand. Verified against seven iPhones (SE 3rd gen, 13 mini, 15, 15 Plus, 15 Pro Max, 16 Pro, 16 Pro Max) by `scripts/verify-scale.mjs`; a checkerboard probe (`checker.png`) plus a half-pixel-shifted twin proves crispness on the device: top crisp, twin grey.

## 7. Assets

The asset map assigns every art and sound need to a numbered slot (47 of them) with ranked candidates from the pack: cards (atlas + back at three scales), the six display sprites (wood tile from A4-Walls, felt, three 64x64 portraits from B-4/B-6, the WANTED face from B-4), the title backdrop and splash (B-3 / B-7), signage and lighting (B-8 / B-11), 9-slice chrome (B-12 / B-13), icons (B-11), and sound pools per event. Only cropped sprites ship; the sheets are source material. The card back's western reskin is open; the `.pxo` source is gone. Audio: Ogg Vorbis only, 46 SFX in round-robin pools plus three loops after the triage (`ASSET-DECISIONS.md`).

## 8. Audio

- **Three buses**: music, sfx and ambience, each with its own gain; the two settings switches (Saloon piano, Card sounds) set a bus to zero instead of touching players, and per-bus volume sliders multiply in.
- **Round-robin pools**: every event has several variants, picked at random without an immediate repeat (the pool remembers its last index);
  **pitch jitter**: each play is detuned by up to ±4 % — true pitch, not tempo — so repeats never sound mechanical.
- **Ducking**: a 1-3 card slap and the round-win sting step the music back from 0.30 to 0.12 within 20 ms; it returns after 300 ms unless re-ducked within 280 ms.
- **Silent mode**: the game plays in iOS silent mode (`playsInSilentMode: true`): it is a game, and the player chose sound in settings.
- **The OGG-loop rule**: loops ship as Ogg Vorbis (or a gapless AAC transcode), never MP3, because MP3 encoder padding breaks gapless looping;
  loop points are sample-accurate — `loopEnd` from the manifest's measured durations (ost_1 119.081 s, ost_3 107.714 s, ost_4 103.109 s, the ambience bed 10.069 s) —
  and where a player cannot set a loop end, the loop files are trimmed to those lengths offline so `loop = true` is seamless.
- **Cues**: table music ost_1 at 0.30; a tension layer (ost_3) crossfaded in over 2 s when any seat is down to 3 cards; ost_4 on the results poster and the how-to sheet; a −14 dB ambience bed; a deal roll of one shuffle and four deal ticks (260 + k·110 ms); the title is silent (nothing can play before the first gesture).
- **Lifecycle**: audio is initialised on the first user gesture (Deal me in, How to play, Settings); `init()` never rejects and is never awaited — a file that cannot be decoded gives a silent event, never a stalled deal; suspend on background, resume on foreground and on the next tap.

## 9. Screens and flow

Title (name, saloon doors, Deal me in / How to play / Settings) → the doors swing (620 ms, 60 under reduce motion) → the table: top bar (round, your tally, menu), three opponent seats (portrait, name, card-back chips and count; active glow, red count at ≤ 3, dimmed at 0, "passed" badge, bark bubble), the felt (wooden sign naming the last play, the pile), the fanned hand (tap to select, dimming of cards that cannot complete a legal play), the status line, and Pass / Sort / Hint / Play. AI seats think for 280-1,900 ms depending on pace; auto-pass after 850 ms when nothing beats the table; a round ends into the WANTED poster (winner's face, reward, the Player / Cards / Round / Tally table, Next round / Saddle up). The in-game menu is the settings sheet with Quit game / Back to table; the how-to sheet has sample cards. Rules apply to the next game.

## 10. Testing and verification

`scripts/test-engine.mjs` — 65 assertions over classification, comparison, antisymmetry on random hands, the five-card category matrix and a replay round-trip. `scripts/sim.mjs` — N AI-only games through the real reducer: 0 illegal actions and 0 stalls is the gate; win rates per matchup are printed for tuning. `scripts/verify-scale.mjs` — the seven-device matrix and its three invariants. Manual device checks: the checkerboard probe at scale 2 and 3, whole-pixel card positions at rest, a 13-card fan within 360 points, the iPhone SE vertical budget, the audio unlock and interruption cases.

## Milestones

| Milestone | Deliverable | Gate |
| --- | --- | --- |
| M0 | Expo project; engine + AI moved in; three real cards drawn from the atlas | `tsc` clean; `npm run sim -- 200` passes; the three cards read 3♦ 2♠ A♣ |
| M1 | an ugly playable round: seats as text, the pile, a tappable hand, Pass / Play, scoring, next round | full rounds against the AI; same seed → same deal and same first plays |
| M2 | the crisp table: wood, felt, portraits, sign, pile, fanned hand, controls at integer scale | the checker probe crisp on SE (scale 2) and a scale-3 phone; fan ≤ 360 pt; SE column fits |
| M3 | interaction and motion parity with the prototype: dimming, auto-pass, Hint, Sort, barks, deal / slap / nudge / lift animations, reduce motion | side-by-side with the prototype; five rounds with no errors |
| M4 | title, doors, poster, settings sheet (persisted), how-to, quit | settings survive a restart; rule changes apply at the next deal; Tab/Space-class accessibility on switches |
| M5 | audio: pools, pitch jitter, ducking, table music, the deal roll | a deal plays one shuffle and four ticks; no immediate repeats; the duck is audible; loops have no seam |
| M6 | polish: tension and results music, ambience, volume sliders, the app icon, build and install | a full 5-round match with sound on a real iPhone, no console errors |

## First five tasks

1. Create the Expo (managed) TypeScript project with expo-router; copy `src/engine` and `src/ai` in unchanged and make `tsc` pass under strict settings.
2. Port `scripts/test-engine.mjs` and `scripts/sim.mjs` to run against the copied files; both green before any UI.
3. Draw three cards from `cards_atlas@3x.png` with a plain `<Image>` at an integer scale and confirm them by eye (3♦, 2♠, A♣ — the atlas and the engine disagree on both axes).
4. Build the turn loop: one timer, cleared on every state change; AI think delays per pace; auto-pass; round over → poster.
5. Wire settings persistence through the async storage port and prove a rule change applies at the next deal.
