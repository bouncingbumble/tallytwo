# Architecture

How Tally Two is put together and why. This is the long version of the README, and it records what the device checks found. `P:<line>` in doc comments cites a line of the original browser prototype the behaviour was copied from; that file is not in this repo, so read those as provenance, not links.

## 1. The one idea

The whole app is built around a pure function you meet in the first file you open:

```ts
reduce(state: GameState, action: Action): GameState        // src/engine/reducer.ts
```

It never mutates its input, never calls `Math.random` or the clock, and throws on an illegal PLAY or PASS. React's `useReducer` runs it unchanged. Two more reducers sit around it:

| Reducer | File | State | Actions |
| --- | --- | --- | --- |
| engine | `src/engine/reducer.ts` | `GameState` (plain JSON: seed, round, rules, phase, players, turn, leader, lastPlay, lastBy, passesInRow, forced3D, history, totals) | `DEAL`, `PLAY`, `PASS`, `SCORE_ROUND`, `NEXT_ROUND` |
| app | `src/game/appReducer.ts` | `AppState = { game: GameState \| null; dealId }` — `game === null` is the title screen | the engine's plus `NEW_MATCH { seed, rules }` and `QUIT`; no-op guards on the app-level actions, engine throws kept loud for PLAY/PASS |
| settings | `src/settings/SettingsProvider.tsx` | `Settings = { rules: RuleConfig; opts: Opts }` | `HYDRATE`, `SET_RULES`, `SET_OPTS` |

Everything else is `useState` for UI-only things (selection, open sheet, barks, doors, crash) and `useMemo` over `src/game/selectors.ts`. No state library.

## 2. Three buckets

Three buckets are all you need to hold in your head, and they are the three things the tooling actually enforces:

| Bucket | What goes there | The rule you feel | Enforced by |
| --- | --- | --- | --- |
| **PURE** | `engine/`, `ai/`, `render/*.ts`, `game/*.ts` (not the `.tsx`/`use*` files), `settings/{settings,storage}.ts`, `audio/{sfxTable,pool,musicLatch,port}.ts`, `assets/names.ts` | "If it needs `window`, `setTimeout`, `console`, `URLSearchParams` or `import.meta`, it does not go here." | `tsconfig.core.json` — those names are "Cannot find name". Inside the seven pure-bearing folders, every `.ts` file that is not `use*.ts`, not `*.test.ts` and not one of the two named WEB files (`audio/WebAudio.ts`, `assets/manifest.ts`) is PURE and is type-checked without the DOM lib. A new pure file is checked the moment it exists; a new hook is excluded by its `use` prefix. |
| **HOOKS** | `game/{GameProvider,useTurnLoop,useBarks,useGame}`, `settings/{SettingsProvider,useSettings}`, `audio/useAudio.ts` | "React + `setTimeout` only. Platform objects (`audio`, `storage`) **arrive as props**, never as imports. This copies to RN." | `boundary.test.ts` (a regex over these files) |
| **WEB** | `ui/**`, `styles/*`, `platform/*`, `audio/WebAudio.ts`, `assets/manifest.ts`, `App.tsx`, `main.tsx`, `dev/*` | "Anything goes, but no game rules: an `if` about the rules of the game belongs in `selectors.ts`." | `boundary.test.ts` (one rule: `ui/**` never imports `engine/reducer` or `ai/*` directly; types allowed) |

The finer eight-layer view. A file may import only from its own layer or a lower one:

| Layer | Folders | May import | Enforced by |
| --- | --- | --- | --- |
| 0 engine | `src/engine` | nothing | verbatim copy; `tsconfig.core.json` |
| 1 ai | `src/ai` | engine (plus one *type* from `assets/names.ts`: `getPersonality.ts` narrows `Personality.portrait` to `PortraitKey`) | verbatim copy; `tsconfig.core.json` |
| 2 geometry | `src/render/{atlas,scale,fanLayout}.ts` | engine types | `tsconfig.core.json` |
| 3 pure game | `src/game/*.ts` except `use*.ts` (`appReducer, cues, selectors, timing, seeds, copy`), `src/settings/{settings,storage}.ts`, `src/audio/{sfxTable,pool,musicLatch,port}.ts`, `src/assets/names.ts` | 0-2 | `tsconfig.core.json` |
| 4 hooks | `src/game/{GameProvider,useTurnLoop,useBarks,useGame}`, `src/settings/{SettingsProvider,useSettings}`, `src/audio/useAudio.ts` | 0-3 + `react` (never `react-dom`, never `window`/`document`/`localStorage`/`navigator`, never `./WebAudio`, `../platform`, `../assets/manifest`) | `boundary.test.ts`. They need `setTimeout`, which is why they sit outside `tsconfig.core.json`. |
| 5 platform | `src/platform/*`, `src/audio/WebAudio.ts`, `src/assets/manifest.ts` | 0-4 + DOM | — |
| 6 ui | `src/ui/**`, `src/styles/*` | 2-5 (`useGame`, `useSettings`, `selectors`, `copy`, `atlas`, `manifest`) — **never** `engine/reducer` or `ai/*` directly (types allowed) | `boundary.test.ts` fails on `from "../engine/reducer"` / `from "../ai` inside `src/ui` |
| 7 app | `main.tsx`, `App.tsx`, `dev/` | anything | — |

`tsconfig.core.json`:

```json
{ "extends": "./tsconfig.app.json",
  "compilerOptions": { "lib": ["ES2023"], "types": [], "noEmit": true },
  "include": ["src/engine", "src/ai", "src/render", "src/game", "src/settings", "src/audio", "src/assets"],
  "exclude": ["**/*.test.ts", "**/*.tsx", "**/use*.ts", "src/audio/WebAudio.ts", "src/assets/manifest.ts"] }
```

`exclude` only filters what `include` matched; a file that an included file imports is still compiled. That is the point: if a PURE file ever imports `assets/manifest.ts`, tsc pulls it in and its `import … from "./cards/cards_atlas.png?url"` lines fail (no `vite/client` module declarations under `types: []`), so the leak is reported at the importer. Two traps the config sets on purpose, and where the code routes around them: `import.meta.glob` and the `*.png`/`*.m4a` module declarations exist only in `vite/client`, so a PURE file must never import from `assets/manifest.ts` (that is why `assets/names.ts` exists); `URLSearchParams` lives in `lib.dom`, so `?seed=` is parsed in `App.tsx`, not in `game/seeds.ts`.

The readability contract: **if a component contains an `if` about the rules of the game, it belongs in `selectors.ts`. If a reducer needs randomness or a sound, it belongs in `act()`.**

## 3. Data flow: engine → store → components

```
tap Card ──► toggleCard(v) ──► (ignored unless phase "playing" and turn 0, P:820) ──► selection (useState)
                                   │
                    selectors.ts (useMemo): legal [game], exact / live / canPass / status / sign [game, selection]
                                   │
Controls onPlay ──► act({type:"PLAY", player:0, cards: exact.cards})     <- only ever a Combo that came from legalMoves
                                   │
                      tryReduce ──► appReduce ──► engine.reduce ──► new GameState (fresh object, reducer.ts)
                                   │                  (throws → { crash } → setCrash → provider renders <CrashScreen/>, §5)
        ┌──────────────────────────┼──────────────────────────────┐
   context value changes      cueFor(before, a, next)        useTurnLoop effect re-runs
   Seats / Felt / Pile /      -> audio.play(...)             (game changed) -> ONE timer:
   Hand / Status / TopBar     -> barks.show(...) (AI only)   AI think | roundover->SCORE_ROUND (never the human)
   re-render from `game`                                              │
                                                                      ▼
                                    phase "scored", !matchOver -> <ResultsPoster/> -> "Next round": act(NEXT_ROUND{seed:newSeed(round+1)})
                                                                                      "Saddle up":  act(QUIT)
                                    phase "scored",  matchOver -> <ResultsPoster final/> -> "New match": act(NEW_MATCH{seed:newSeed(1), rules})
                                                                                            "Saddle up":  act(QUIT)
                                    any time      -> Menu (SettingsSheet) -> "Quit game": act(QUIT)
                                    useAudio: musicFor(game, sheet) / tensionFor(game) -> audio.setMusic / setTension   (no screen owns playback)
```

`act(QUIT)` sets `game` to `null`; the `useTurnLoop` effect's cleanup clears the pending AI timer on that change, so a quit during a think delay fires no further move, sound or bark.

### The store's public face (`src/game/useGame.ts`)

| Value | Definition | Source |
| --- | --- | --- |
| `game`, `dealId` | the app state; `dealId` bumps on every deal and keys the deal animation | `appReducer.ts` |
| `legal` | `legalMoves(hand, lastPlay, rules, needThreeD(game))` on the human's turn, else `[]`; **memoised on `[game]` only** | `selectors.legalFor` |
| `exact` | the legal move whose cards equal the selection; Play enabled iff non-null | `selectors.exactMove` (P:830) |
| `live` | union of cards of every legal move containing the whole selection; the others get `.dim`; `null` with nothing selected | `selectors.liveCards` (P:805-811) |
| `canPass` | `lastPlay !== null \|\| legal.length === 0`, on the human's turn — passing on your own lead throws in the engine | `selectors.canPass` (P:832) |
| `status` | the exact strings of P:837-843 through `copy.ts`, with a tone | `selectors.statusFor` |
| `sign` | the plaque: `describe(lastPlay)`, "Fresh lead", "Waiting on the opening play" | `selectors.signFor` (P:872-887) |
| `act(a)` | dispatch; illegal engine actions become `crash`, never a throw | `GameProvider` |
| `actAi(seat, difficulty)` | one AI move from the provider's seeded rng (`aiTurn`) | `GameProvider` |
| `toggleCard(v)`, `setSelection(cards)` | selection, guarded by `selectors.canToggle` | `GameProvider` |
| `barks` | `{ id, seat, text }[]`, AI-only, each alive for `BARK_MS` | `useBarks` |
| `audio` | the injected `AudioPort`, re-exposed so `useAudio` never imports `WebAudio` | prop of `GameProvider` |
| `crash` | the `CrashReport` being shown, or `null` | `GameProvider` |

### The turn loop (`src/game/useTurnLoop.ts`)

One effect, one timer, keyed on the `game` object. Every branch returns `clearTimeout`. Every wait below is `paced()` first — multiplied by `BASE_TIME_SCALE` (4: the prototype played too fast to follow) and divided by the Game speed setting (`opts.speedMultiplier`, 1x–4x) — and then capped under reduce motion:

- `phase === "roundover"` → `SCORE_ROUND` after `ROUND_OVER_MS.human` (800) or `.ai` (900) — the turn stays on the winner.
- human's turn → no timer. The player is never passed for them, even with no legal move: the status line says "Nothing here beats that — you'll have to pass." and the Pass button is the only way on.
- AI's turn → `actAi(seat, opts.difficulty)` after `thinkMs(opts.speed, Math.random()) + (history.length === 0 ? FIRST_STEP_MS : 0)`, clamped to 260 ms under reduce motion. `chooseMove` runs **inside** the timeout, inside the provider, so StrictMode's mount/cleanup/mount never consumes the AI rng twice.
- `paused` (a hidden tab) → no timer at all; the effect re-runs when `paused` flips back.

`chooseMove` is synchronous, worst case under a millisecond, so there is no worker. A crash inside `actAi` leaves `game` unchanged, so no timer is re-armed and the crash screen is the only thing that happens.

## 4. Timing

Every millisecond lives in `src/game/timing.ts`; nothing else in `src/` may hold a timing number. All values are the prototype's.

| Constant | Value | Prototype |
| --- | --- | --- |
| `BASE_TIME_SCALE` / `paced(ms, multiplier)` | every table wait is the prototype's ms × 4 ÷ the Game speed setting (`SpeedMultiplier` = 1 \| 2 \| 3 \| 4) | new |
| `SPEED` | `{ fast: [280, 520], normal: [650, 1250], slow: [1100, 1900] }` ms, uniform (before pacing) | P:917 |
| `thinkMs(speed, r)` | `lo + r * (hi - lo)`; `r` is `Math.random()` in the game, a fixed value in tests | P:918-921 |
| `REDUCED_MOTION_MAX_MS` / `clampMotion` | `min(ms, 260)` when reduce motion is on | P:922 |
| `ROUND_OVER_MS` | `{ ai: 900, human: 800 }` | P:943, P:966 |
| `FIRST_STEP_MS` | 700 | P:1037 |
| `DOORS_MS` | `{ normal: 620, reduced: 60 }` | P:1228 |
| `DEAL_STAGGER_MS` | 32 per card | P:775 |
| `SLAP_STAGGER_MS` | 40 per card | P:883 |
| `BARK_MS` / `BARK_CHANCE` | 2000 / 0.55 | P:894-899 |
| `SELECT_MS` | 160 (the select lift) | P:151 |

Audio timings live next to the sounds in `src/audio/sfxTable.ts`: `DUCK` (to 0.12 within 20 ms, back to 0.30 after 300 ms unless re-ducked within 280 ms; P:369-374), `DEAL_ROLL` (shuffle at 0, four deal ticks at 260 + k·110 ms; P:388-391), `FADE` (a track switch is a 1.5-s fade-out, then a 2-s fade-in — never a crossfade), `JITTER` (±4 % true pitch).

## 5. How a crash becomes a screen

React error boundaries only catch errors thrown during render, lifecycle methods and constructors — never in event handlers or `setTimeout` callbacks — and every `act()` call happens in exactly those two places (a button handler, or the turn-loop timer). So the crash path does not use a boundary at all:

1. `act(a)` calls `tryReduce(state, a)` (`src/game/appReducer.ts`), **the one place an engine throw is caught**. It is pure, so it is unit-tested directly.
2. On a throw it returns `{ crash: CrashReport }` where `CrashReport = { error, action } & GameLog` and `GameLog = { seed, rules, round, leader, totals, history, final }` (`selectors.gameLog`). Nothing is dispatched: `game` is unchanged, no timer is re-armed.
3. The provider stores the report in state and **renders `<CrashScreen/>` instead of its children**. Same data, same buttons, no class component, no throw-in-render idiom.
4. `ui/CrashScreen.tsx` shows the seed, rules, round, leader, totals, the action that threw and the history, with "Copy game log" (`serializeLog`) and "Saddle up" (clear `crash`, dispatch `QUIT` → title; settings live in the outer provider and survive).
5. The copied log is the `GameLog` shape that `selectors.replayLog(log)` rebuilds — `deal(seed, rules, seats, round, leader, totals)` then the history as actions — so a bug report is one paste into a scratch test: `expect(JSON.stringify(replayLog(log))).toBe(JSON.stringify(log.final))`. This works for round 2+ too, which the engine's own `replay()` (round 1 only) cannot do.

Why no-op guards for app-level actions but throws for PLAY/PASS: "Next round" and "Score" can be double-tapped and must not unmount the tree; PLAY/PASS are gated by `legalMoves` and `canPass`, so a throw there is a real bug and must end up on screen with enough data to replay it. The cosmetic layer (`cueFor` → sounds and barks) runs inside the same `try` in `act()`, so a throw there also reaches the screen instead of dying silently in a click handler.

`ui/ErrorBoundary.tsx` is a separate, last-resort net for **render** bugs — a missing `PORTRAITS` key, an undefined sprite URL, a typo in a selector — which carry no report. It is about 15 lines, the only class component in the codebase (`getDerivedStateFromError` has no hook equivalent), and renders just `error.message` + "Saddle up" (reset → remounts `GameProvider` at `INITIAL`). It never sees engine throws, because `tryReduce` has already turned those into a `CrashScreen`. `dev/DevHook.tsx` (DEV builds only) exposes `window.__tally = { act, game }` so an illegal PLAY can be forced from the console without editing code.

## 6. Reference stability

The thing a learner cannot debug by reading: **every value in an effect's dependency array must keep its identity between renders unless `game` changed.** A value that changes identity for any other reason clears and re-arms the pending timer, which looks like "the AI hesitates".

Concretely:

- `useBarks` returns `{ list, show }` with `show = useCallback(…, [])` — it only calls `setList` with a functional update and arms one `setTimeout` per bark — and `act` depends on `barks.show`, not `barks`. Otherwise every bark expiry would recreate `act` → `actAi` → the turn-loop effect mid-think.
- `legal` is `useMemo` on `[game]` **only**: it never reads the selection, so a card tap never recomputes the legal moves.
- The `audio` port is created once in `App.tsx` with `useMemo`; `storage` is a module constant.
- `opts.*` read by the loop are primitives (`speed`, `speedMultiplier`, `difficulty`, `reduceMotion`).
- The AI rng is a `useRef`, reseeded on `NEW_MATCH`/`NEXT_ROUND` with `aiRngFor(seed)`; it never appears in a dependency array and never leaves the provider.

`appReduce` is pure, so calling it once more inside `act()` to learn `next` is free. StrictMode double-invokes reducers in dev; because sounds and barks live in `act()`, nothing fires twice.

## 7. Match over

The engine has no match concept (`state.ts`: phases are `playing | roundover | scored`; only `round` and `totals` carry across deals), and `DECISIONS.md` leaves the length open, so this is the plan's own definition, in `src/game/selectors.ts`:

```ts
export const ROUNDS_PER_MATCH = 8;                                                     // a match is exactly eight rounds; not a setting
export const matchOver = (g: GameState | null): boolean =>
  !!g && g.phase === "scored" && g.round >= ROUNDS_PER_MATCH;
export function matchWinner(g: GameState): number {        // highest tally; a tie goes to the seat that won the LAST round
  const best = Math.max(...g.totals);
  const tied = g.totals.flatMap((t, i) => (t === best ? [i] : []));
  return tied.length === 1 ? tied[0] : tied.includes(g.turn) ? g.turn : tied[0];      // turn stays on the round winner after SCORE_ROUND
}
```

A match is exactly `ROUNDS_PER_MATCH` = 8 rounds (`game/selectors.ts`; the prototype's Endless / 5 / 10 setting is gone — 2026-10-07: "8 rounds per match no more, no less"). The **round** poster (`ResultsPoster`) shows the round winner: `wanted.png` for seat 0 else the portrait, the reward line `$N reward for an empty hand`, the Player / Cards / Round / Tally table, buttons Next round / Saddle up. The **final** poster, when `matchOver(game)`, reuses the component: heading "FINAL TALLY", face and name from `matchWinner(game)`, `$N over M rounds`, rows sorted by tally, buttons "New match" (`act(NEW_MATCH{ seed: newSeed(1), rules })`, doors stay open) and "Saddle up"; no "Next round".

## 8. Audio: who decides what plays

- One table, `src/audio/sfxTable.ts`: `SfxEvent → { files, gain, ducks }` plus the four loops (`table` ost_1, `tension` ost_3 in its place while any seat is low, `results` ost_4, `ambience` CardsMovingLoop03 at −14 dB) with sample-accurate `loopEnd`s. PURE: it names assets through `assets/names.ts`. One music loop plays at a time: `WebAudio` fades the playing loop out over `FADE.outMs` and schedules the next to start, and fade in over `FADE.inMs`, on the audio clock at the moment the fade-out ends — a switch is never a crossfade, and a loop stopped before it has sounded is cancelled outright. The level a fade-out starts from is computed from the schedule (`gain × fade-in progress`), never read back from the `AudioParam` (Firefox returns the cancelled timeline's value, and an unrendered node returns 1.0). Wanting the table also prefetches the tension loop, so a session's first tension switch is scheduled like every later one instead of waiting on a 2 MB decode. `tensionFor` holds its value through `roundover` by counting the winner's final play in place of their empty hand, so a round's end is one switch, to the results track.
- Per-action sounds (`play`, `dealRoll`, `select`) are fired from `act()` / `toggleCard` via `cueFor(before, action, next)` (`src/game/cues.ts`, tested row by row). Barks are AI-only — seat 0 has no personality and no lines — so a human round win yields `roundWin` and no bark.
- Per-state music is decided in exactly one hook, `src/audio/useAudio.ts`, called once from `App.tsx` with `{ sheet, paused }`: `audio.setMusic(opts.music ? musicFor(game, sheet) : null)`, `audio.setTension(tensionFor(game))` (any seat at ≤ 3 cards, the same threshold as the `.low` seat state), `audio.setBus(bus, on ? volume : 0)`, `paused ? suspend() : resume()`. No screen or sheet owns playback; `ui/` reaches the port only through `useGame().audio`.
- `setMusic` is desired state, not fire-and-forget (`src/audio/musicLatch.ts`, PURE, tested): music decodes lazily, so the first `setMusic("results")` on a fresh cache lands seconds before the buffer exists; the latch starts the loop when the decode lands iff that track is still wanted.
- `AudioPort` (`src/audio/port.ts`) is the interface; `WebAudio.ts` is the web implementation (an `AudioContext`, three `GainNode` buses, `Promise.allSettled` decoding, `ctx.resume()` whenever the context is not running). `init()` never rejects and is never awaited: a device that cannot decode a file gets a silent event, never a stalled deal.
- The iOS unlock: `audio.init()` runs from all three title buttons (Deal me in, How to play, Settings), and `App.tsx` installs one `document` `pointerdown` listener that calls `audio.resume()`, so the next tap after a phone call, Siri or the lock screen is the gesture Safari wants.

## 9. Rendering and crispness

DOM/CSS sprites, no canvas. The card rule (`styles/cards.css`): `width: var(--cw); height: var(--ch)` with `--cw: 96px; --ch: 128px` always; `background-image: image-set(atlas 1x, atlas@2x 2x, atlas@3x 3x)`; `background-size: calc(var(--cw) * 13) calc(var(--ch) * 4)`; `background-position` from `--col`/`--row` (`render/atlas.ts`: the engine and the atlas disagree on both axes, so the tables are pinned by `atlas.test.ts`); `image-rendering: pixelated`.

- **DPR**: at dpr 2/3 the browser blits a pre-upscaled atlas 1:1 into device pixels, no resampling. `pixelated` is the fallback for fractional desktop dpr (accepted softness; iPhone Safari is the only promised target). **This is the only thing that works on iOS Safari**: measured in the iOS Simulator (real Safari, native-resolution screenshots, pixel histograms), a 1-px checker drawn as a `pixelated` background scaled by `background-size` came out as greys (85/170/113/142) at dpr 2 and 3 — Safari resamples `image-rendering: pixelated` backgrounds. The same tile through `image-set()` of nearest-neighbour @2x/@3x files came out as exactly two values, 0 and 255. So every sprite ships at 1x/2x/3x (`docs/ASSETS.md` §7).
- **Integer scale / rest pose**: only `transform: translate()` with integer CSS px at rest; `rotate(0)` at rest; animations may pass through fractional values but end on the integer pose; never `transform: scale()` on an ancestor. The prototype's resting `rotate(t*2.4deg)` and fractional `step`/`x0` (P:792-800) are the one thing not copied.
- **Fan**: `fanLayout(13, availW)` (`render/fanLayout.ts`) with the hand strip at `padding: 0 8px`, `availW` being the strip left of the 124-px side column: step `min(64, floor((availW − 96) / 12))`, so a 13-card hand shows 34 px of each card on an iPhone SE held sideways (`availW = 509`, span 504) and 41 px on an iPhone 15 (588, inside the Dynamic Island insets); `FAN_STEP_MAX = 64` stops a wide strip from spreading the cards apart. The narrowest fan the art allows is `fanStepArt(96) = 22` (`scale.ts`), above the 20-px corner index; `reportFor` asserts every iPhone in the matrix stays ≥ 34.
- **Hand order** (`ui/Hand.tsx`): a fresh deal is sorted low to high, a rank's cards by suit (`selectors.sortHand`, value order; there is no sort setting — a `sortBy` left in storage by the old Sort button is ignored); from then on the player drags cards into any order, any time — there is no Sort button. The order is UI state per deal (reset on a new deal or a changed preference, filtered as cards are played), never engine state. Pointer events: a press becomes a drag after 6 px, the pressed card captures the pointer and follows it (`.card.drag`: no transition, z-index 99, lifted), the others slide to the slot nearest its left edge through the usual 0.16-s transform transition, and the click the browser sends after a drag is swallowed so it does not toggle the selection. `.hand` is `touch-action: none` so a finger along the fan drags rather than pans; cards keep `-webkit-touch-callout: none`. Rest positions stay whole px (the drag x is rounded and clamped to the strip).
- **Other sprites, drawn 1:1 from `image-set()`**: wood tile 96 CSS px, felt tile 32, portraits 96x104 (the framed art at its native pixel size — Marshal Cobb 90x91, Lucky Pearl 77x88, Dusty Vane a mirrored palette swap of Lucky's (black hat, teal bandana, sunset sky, dark frame) — centred on a 96x104 canvas; the prototype's resampled 46/64 px is rejected; on the table badges they are drawn at 85 %, smoothed), the WANTED face 61x71 at 2x on the poster, the checker 32 — each an `image-set(1x, @2x, @3x)` written in the rule that uses it (`base.css` body and `.checker-tile`; `table.css` `.table`, `.felt`, `.face.p_marshal` / `.face.p_outlaw` / `.face.p_gambler` / `.face.wanted`). Not in custom properties: the bundler adds the `-webkit-image-set()` fallback for iOS ≤ 16 only inside a rule. Seat back chips are CSS rectangles. Nothing sets a texture from JavaScript: an inline `url()` would override the set with the 1x file.
- **The trick on the felt** (`ui/Pile.tsx`, `selectors.trickPlays`): the three opponents' badges sit along the felt's top edge; the four seats' latest plays in the current trick are staggered in three rows beneath (`TrickSlot`) so each can spread wider than a third of the felt — Dusty's (the middle seat) in the top row, the full width, centred under its badge; Marshal Cobb's and Lucky Pearl's in the middle row, half the width each, against the left and right edges under theirs; the human's own play in the bottom row, centred. Each slot's `top` comes from the area's measured height (`platform/useElementSize`): the bottom row flush with the bottom, the middle row halfway, so the rows sit apart where the felt is tall (the 440-px frame at dpr 2: 1 px of overlap) and overlap where it is short (an iPhone SE: 34 px; an iPhone 15: 57 — `reportFor().playRowOverlapPt`), the latest play on top. The sign sits in the side column. A seat that plays again replaces its earlier play; a clear empties the felt (`GameState.trickStart` marks where the trick began). The play to beat is outlined in amber, earlier ones recede. Cards are absolutely positioned at integer x (`PILE_STEP` = 40 apart, squeezed to a minimum of 12 in a narrow slot, centred by whole pixels from the slot's measured width) and rest at `rotate(0)`; the prototype's alternating tilt happens on the way in only (`motion.css` `slap`). The hand's select lift is part of the inline transform (`translate(x, -14px)`), not an `!important` rule, so it cannot override the deal keyframes.
- **Plays**: the trick's cards are a fixed 72x96 CSS px on every device (`render/scale.ts` `PLAY_CARD_W/H`, `tokens.css` `--cw-small/--ch-small`, step `PILE_STEP` = 30) — three quarters of the hand's, by request (2026-10-07: "1.5x bigger" than the 48-px plays they replaced). That is a 0.75 downscale of the atlas, not an integer device scale, so `.card.small` is `image-rendering: auto` (smoothed) rather than pixelated; the hand keeps its crisp 1:1 cards. The portraits are likewise drawn at 85 % (82x88, smoothed) on the badges. `--dpr` is still set on `:root` by `platform/useDevice.ts` for the Spike.
- **Layout** (`styles/table.css`): the table is a phone held sideways — a grid of `felt + side / hand + side`: the felt (three portrait badges — 96x104 sprites at 82x88 — along its top edge over the three play rows of 72x96 cards), a 124-px side column (round and tally with the menu button, the sign, the status line, Play / Pass / Hint stacked at the bottom) and a 122-px hand row whose 128-px cards overhang the felt's edge by 6 px (the select lift rises over the felt; `.handwrap` is `z-index: 3`). Behind the hand sits a saloon (`ui/Saloon.tsx`, `styles/table.css` `.saloon`): a 900-px room of B-4 / B-6 props — plant, stool, piano, chair, barrel, the WHISKEY / BEER / RUM back bar with stools, a sconce, a hanging sign, a poker table, a fireplace — centred in the strip by a whole px from its measured width and clipped to it, so a 13-card fan hides it and the hand uncovers it from both ends as it is played down. The title (`ui/screens/TitleScreen.tsx`, `base.css` `.title`) is a saloon front from the same sheets: the SALOON sign over batwing doors that swing open in three sprite frames (`ui/Doors.tsx`, `motion.css` `frame-*`) when Deal me in is tapped, a barrel with an oil lamp, chips, a stool and a plant, the desert painting over the buttons, floorboards along the bottom, sconces and a chip pile in the corners of a frame at least 900 px wide. Every prop is a `.sp-<name>` class (`styles/sprites.css`: size + `image-set()`), placed by whole px; `docs/ASSETS.md` §7 lists the cuts. The vertical budget on a 375-px-tall phone is 326 CSS px with the play rows fully overlapped (`render/scale.ts` `reportFor`, asserted for every iPhone in `DEVICES`); the three play rows overlap by 41 px in a 440-px frame and 74 px on a 375-px phone — the middle row's plays sit at the felt's edges, so only wide plays can collide. Side padding is `max(6px, env(safe-area-inset-*))`, so the Dynamic Island insets narrow the fan rather than hide it; only the side column keeps clear of the home indicator. The game root (`base.css` `.game`) is `max-width: 956px; max-height: 440px` — the largest iPhone sideways — centred on the wood on a desktop, `touch-action: manipulation; user-select: none`. There is no orientation gate yet: held upright, the same layout squeezes. `useDevice` measures the dpr, `useElementWidth` the strips. Rye is self-hosted (`@fontsource/rye`): no FOUT on a cold cache, and it works offline.
- **Verification tooling**: `dev/Spike.tsx` (`?dev=spike`) shows dpr and S, a checker tile (`--checker`, an image-set at `background-size: 32px`) plus a twin shifted by `0.5px / dpr`. The pass condition is a pixel histogram of a native-resolution screenshot of the top tile: exactly two values, 0 and 255 (the twin is a diagnostic; WebKit snaps it to a whole device pixel, so it reads crisp too). `atlas.test.ts` asserts `spriteFor(0)` = (192, 0) 3♦, `spriteFor(51)` = (96, 128) 2♠, `spriteFor(45)` = (0, 384) A♣. `e2e/play.mjs` scripts the rest of the device gates in Playwright's WebKit and Chromium (see the README).

### Installability

`vite.config.ts` registers `VitePWA({ registerType: "autoUpdate", … })` with a standalone, landscape webmanifest and a Workbox precache of `js,css,html,png,ogg,m4a,woff2,webmanifest` up to 8 MB per file (the music loops are 2.1-2.4 MB each as AAC). So the default is **installable-offline**: Add to Home Screen gives an icon that works on the train. `index.html` carries the `apple-mobile-web-app-*` tags iOS reads; the webmanifest alone is not enough there. Icons: `public/icons/icon-192.png` (apple-touch-icon and favicon) and `icon-512.png` (also declared `maskable`; note a circular mask clips the card's corners — the card is 288x384 centred, so its corners sit 240 px from the centre, outside the 205-px safe zone).

## 10. Measured sideways

The game is a phone held sideways; the SE (667x375 CSS px, dpr 2) is the shortest target and the 13 mini / iPhone 15 (dpr 3, 64x85.33 plays) the tightest. Measured in Playwright's WebKit with `?seed=3` dealt and a trick in progress (2026-10-06, `e2e/play.mjs` and a `getBoundingClientRect` pass), with no safe-area insets (Playwright reports none; on a Dynamic Island phone the side padding grows to the inset and the fan narrows — `scale.ts` `reportFor` keeps it ≥ 34 px per card):

| Region | iPhone SE 667x375 @2 | iPhone 15 852x393 @3 | 956x440 frame @2 (desktop) |
| --- | --- | --- | --- |
| felt | y 2-249 (247 tall), 525 wide | 2-267 (265), 710 wide | 182-494 (312), 814 wide |
| badges | 106 tall, 166 wide each (names wrap to two lines) | 106, 227 wide | 106, 262 wide |
| play rows (top / middle / bottom) | 131 px area: 0 / 32 / 65 (66-px slots: 34 px overlap) | 149: 0 / 30 / 61.67 (87.33-px slots) | 196: 0 / 65 / 130 (1 px overlap) |
| hand | y 251-373, 509 wide: step 34, span 504 | 269-391, 694 wide: step 49, span 684 | 496-618, 798 wide: step 58 |
| side column | 124 wide; buttons bottom 373 | buttons bottom 391 | buttons bottom 618 |
| **fits** | `scrollHeight` 375 of 375 | 393 of 393 | the frame is 440 tall, centred |

Device checks recorded (2026-10-06):

- `?dev=spike` in the iOS Simulator (iPhone 17 Pro, dpr 3, and iPhone SE 3rd gen, dpr 2): `dpr 3 · S 3 · card 96x128 CSS px = 288x384 device px · 56 fps`; the checker tile's native-resolution histogram is exactly `{0: 28800, 255: 28800}` after the image-set change (it was greys before it).
- Playwright WebKit 18.4 at SE @2 and iPhone 15 @3 sideways, and Chromium @3: 13 cards dealt; `?seed=3` gives seat 0 the 3♦; every `.card` rest `transform` a whole CSS px; cards 96x128; the 13-card fan steps 34 px (SE) / 49 px (852 wide) and fits the strip; the hand and the buttons fit with no scroll; two full rounds played through the UI per browser with zero-sum posters and carried totals; settings from the title show no "Quit game"; a switch flips; `tallytwo.settings` written; no console errors in WebKit. Playwright's Chromium build has no AAC decoder, so its run logs one "unavailable" warning per audio file and plays silently — the failure contract working as specified.
- Trick cards rest at integer x with an identity rotation (a pair at 355 and 395 in the frame: step 40); the dpr-3 bottom row rests at `top: 61.67px`, a whole number of device pixels.
- The Settings sheet (560 wide) starts at the top of the overlay and scrolls; `<select>` computes to 16 px (no iOS focus-zoom); the poster is a two-column sheet 620 px wide.
- Not yet run on hardware: the lock-screen audio interruption (M5 gate 9), Add to Home Screen + Airplane mode (M6 gate 4), and the safe-area insets of a Dynamic Island phone held sideways. These need a physical iPhone. There is no orientation gate yet: held upright, the same layout squeezes.

Fallback order if a future layout change breaks the 375-px total: the play rows overlap further (they already overlap on the phones), a shorter side column, then a smaller portrait canvas at an integer scale; never a fractional hand or portrait scale.
