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

DOM/CSS sprites, no canvas. The card rule (`styles/cards.css`): `width: var(--cw); height: var(--ch)` with `--cw: 96px; --ch: 128px` always; `background-image: url(cards_atlas.png)` — one file, 3744x1536, three times the 1248x512 art; `background-size: calc(var(--cw) * 13) calc(var(--ch) * 4)`; `background-position` from `--col`/`--row` (`render/atlas.ts`: the engine and the atlas disagree on both axes, so the tables are pinned by `atlas.test.ts`); `image-rendering: auto`, pixelated only inside `.game.upscaled`.

- **One 3x file, smoothed; pixelated only when upscaled**: every sprite and the atlas ship as one PNG holding 3x the art's pixels, and the CSS draws it at the art size in CSS px (`docs/ASSETS.md` §7). The browser scales it — smoothed by default, since a phone draws the game at a factor k < 1 of its frame and nearest-neighbour would drop art pixels unevenly. When k ≥ 1 (desktop Chrome) the game root carries the `upscaled` class and one rule in `styles/sprites.css` (`.game.upscaled .sp / .card / .face / .felt / .table / .title::after`) switches the art to `image-rendering: pixelated`. Nothing cares about integer device scales any more. iOS Safari resamples pixelated backgrounds — moot now that nothing is drawn 1:1.
- **Integer scale / rest pose**: only `transform: translate()` with integer logical px at rest; `rotate(0)` at rest; animations may pass through fractional values but end on the integer pose. The one scale transform is the root's (`.game`, §10): the whole logical canvas scaled by k, so every integer below it lands on the same fractional device grid and nothing inside ever scales on its own. The prototype's resting `rotate(t*2.4deg)` and fractional `step`/`x0` (P:792-800) are the one thing not copied.
- **Fan**: `fanLayout(13, availW)` (`render/fanLayout.ts`) with the hand strip at `padding: 0 8px`, `availW` being the strip left of the 124-px side column, in logical px (`platform/useElementWidth`, §10): step `min(64, floor((availW − 96) / 12))`, so a 13-card hand shows 44 logical px of each card on an iPhone SE held sideways (canvas 782 wide, `availW = 624`), 58 on an iPhone 15 (954 wide) and 37 in a 1280x800 desktop window (704 wide); `FAN_STEP_MAX = 64` stops a wide strip from spreading the cards apart. The narrowest fan the art allows is `fanStepArt(96) = 22` (`scale.ts`), above the 20-px corner index; `scale.test.ts` pins the three steps above and `e2e/play.mjs` asserts ≥ 34 on every target.
- **Hand order** (`ui/Hand.tsx`): a fresh deal is sorted low to high, a rank's cards by suit (`selectors.sortHand`, value order; there is no sort setting — a `sortBy` left in storage by the old Sort button is ignored); from then on the player drags cards into any order, any time — there is no Sort button. The order is UI state per deal (reset on a new deal or a changed preference, filtered as cards are played), never engine state. Pointer events: a press becomes a drag after 6 px, the pressed card captures the pointer and follows it (`.card.drag`: no transition, z-index 99, lifted), the others slide to the slot nearest its left edge through the usual 0.16-s transform transition, and the click the browser sends after a drag is swallowed so it does not toggle the selection. `.hand` is `touch-action: none` so a finger along the fan drags rather than pans; cards keep `-webkit-touch-callout: none`. Rest positions stay whole px (the drag x is rounded and clamped to the strip).
- **Other sprites, one 3x file each**: wood tile 96 CSS px, felt tile 32, portraits 96x104 (the framed art at its native pixel size — Marshal Cobb 90x91, Lucky Pearl 77x88, Dusty Vane a mirrored palette swap of Lucky's (black hat, teal bandana, sunset sky, dark frame) — centred on a 96x104 canvas; the prototype's resampled 46/64 px is rejected; on the table badges they are drawn at 85 %), the WANTED face 61x71 at 2x on the poster — each a `url()` with its `background-size` in CSS px written in the rule that uses it (`base.css` body and `.title::after`; `table.css` `.table`, `.felt`, `.face.p_marshal` / `.face.p_outlaw` / `.face.p_gambler` / `.face.wanted`), so Vite resolves and hashes the file. Seat back chips are CSS rectangles. Nothing sets a texture from JavaScript.
- **The trick on the felt** (`ui/Pile.tsx`, `selectors.trickPlays`): the three opponents' badges sit along the felt's top edge; the four seats' latest plays in the current trick are staggered in three rows beneath (`TrickSlot`) so each can spread wider than a third of the felt — Dusty's (the middle seat) in the top row, the full width, centred under its badge; Marshal Cobb's and Lucky Pearl's in the middle row, half the width each, against the left and right edges under theirs; the human's own play in the bottom row, centred. Each slot's `top` comes from the area's measured height (`platform/useElementSize`, logical px): the bottom row flush with the bottom, the middle row halfway — on the 440-px canvas the three rows overlap by 41 px, the same on every device now that the canvas is scaled rather than squeezed (§10) — the latest play on top. The sign sits in the side column. A seat that plays again replaces its earlier play; a clear empties the felt (`GameState.trickStart` marks where the trick began). The play to beat is outlined in amber, earlier ones recede. Cards are absolutely positioned at integer x (`PILE_STEP` = 40 apart, squeezed to a minimum of 12 in a narrow slot, centred by whole pixels from the slot's measured width) and rest at `rotate(0)`; the prototype's alternating tilt happens on the way in only (`motion.css` `slap`). The hand's select lift is part of the inline transform (`translate(x, -14px)`), not an `!important` rule, so it cannot override the deal keyframes.
- **Plays**: the trick's cards are a fixed 72x96 CSS px on every device (`render/scale.ts` `PLAY_CARD_W/H`, `tokens.css` `--cw-small/--ch-small`, step `PILE_STEP` = 30) — three quarters of the hand's, by request (2026-10-07: "1.5x bigger" than the 48-px plays they replaced). That is a 0.75 downscale of the atlas; like everything else it is drawn smoothed (`image-rendering: auto`) and goes pixelated with the rest of the art only inside `.game.upscaled`. The portraits are likewise drawn at 85 % (82x88) on the badges.
- **Layout** (`styles/table.css`): the table is a phone held sideways — a grid of `felt + side / hand + side`: the felt (three portrait badges — 96x104 sprites at 82x88 — along its top edge over the three play rows of 72x96 cards), a 124-px side column (round and tally with the menu button, the sign, the status line, Play / Pass / Hint stacked at the bottom) and a 122-px hand row whose 128-px cards overhang the felt's edge by 6 px (the select lift rises over the felt; `.handwrap` is `z-index: 3`). Behind the hand sits a saloon (`ui/Saloon.tsx`, `styles/table.css` `.saloon`): a 900-px room of B-4 / B-6 props — plant, stool, piano, chair, barrel, the WHISKEY / BEER / RUM back bar with stools, a sconce, a hanging sign, a poker table, a fireplace — centred in the strip by a whole px from its measured width and clipped to it, so a 13-card fan hides it and the hand uncovers it from both ends as it is played down. The title (`ui/screens/TitleScreen.tsx`, `base.css` `.title`) is a saloon front from the same sheets: the SALOON sign over batwing doors that swing open in three sprite frames (`ui/Doors.tsx`, `motion.css` `frame-*`) when Deal me in is tapped, a barrel with an oil lamp, chips, a stool and a plant, the desert painting over the buttons, floorboards along the bottom, sconces and a chip pile in the corners of a frame at least 900 px wide. Every prop is a `.sp-<name>` class (`styles/sprites.css`: size + `url()` + `background-size` in CSS px), placed by whole px; `docs/ASSETS.md` §7 lists the cuts. Every px here is a logical px of the 440-px-tall canvas (§10): the vertical budget is 326 with the play rows fully overlapped, and the three play rows overlap by 41 px — the middle row's plays sit at the felt's edges, so only wide plays can collide. Side padding is `max(6px, var(--inset-*, env(safe-area-inset-*)))`, so the Dynamic Island insets narrow the fan rather than hide it; only the side column keeps clear of the home indicator (`--inset-left/right/bottom` on `.game` win over `env()` when a native shell sets them). The game root (`base.css` `.game`) is the logical canvas — `height: 440px`, `width: var(--logical-w)`, `transform: scale(var(--k))` from its top-left corner, both properties set by `platform/useFitScale.ts` — so it fills the viewport exactly with nothing of the body around it; `touch-action: manipulation; user-select: none`. The title's corner decor shows only on a `.game.wide` canvas (≥ 900 logical px). There is no orientation gate and none is wanted: held upright, the same layout shrinks to the width. `useElementWidth` measures the strips in logical px. Rye is self-hosted (`@fontsource/rye`): no FOUT on a cold cache, and it works offline.
- **Verification tooling**: `atlas.test.ts` asserts `spriteFor(0)` = (192, 0) 3♦, `spriteFor(51)` = (96, 128) 2♠, `spriteFor(45)` = (0, 384) A♣; `scale.test.ts` pins k and the fan step for the three targets. `e2e/play.mjs` scripts the device gates in Playwright's WebKit and Chromium (§10 and the README). The old `?dev=spike` checker-probe page, its checker sprite and `.checker-tile` rule are gone with the integer-scale rule they tested.

### Shipping

`vite build` emits a plain static `dist/` (`index.html`, hashed `assets/`, `icons/`) for a webview shell or any static host; there is no service worker, no precache and no webmanifest (the PWA layer was dropped, so nothing caches the 2.1-2.4 MB music loops on the device — the shell owns offline, if it wants it). `index.html` keeps the `apple-mobile-web-app-*` tags and the icons, which a shell may use: `public/icons/icon-192.png` (apple-touch-icon and favicon) and `icon-512.png` (note a circular mask clips the card's corners — the card is 288x384 centred, so its corners sit 240 px from the centre, outside the 205-px safe zone).

## 10. The logical canvas

The game is designed once, on a fixed logical canvas, and scaled to whatever is showing it — a phone held sideways (iPhone Safari first) or a desktop Chrome window. The rules (`render/scale.ts` `LOGICAL_H`, `fitScale`; `platform/useFitScale.ts`; `base.css` `.game`):

- The canvas is **440 logical px tall** (the largest iPhone sideways, 956x440, is the 1:1 case) and `viewportWidth / k` wide, where **k = viewportHeight / 440**. No letterbox, no cap: on an iPhone SE (667x375) k = 0.852 and the canvas is 782 wide; on an iPhone 15 (852x393) k = 0.893, 954 wide; in a 1280x800 window k = 1.818, 704 wide — a desktop grows everything and gets a *narrower* canvas, which is what fills the screen.
- It is applied as `transform: scale(k)` with `transform-origin: 0 0` on `.game`, whose logical width and height are set explicitly (`--logical-w`, `height: 440px`), so the scaled box is exactly the viewport. Not CSS `zoom` (viewport units misbehave under it) and no rem tricks: every number in the CSS and the layout code stays a plain px.
- `useFitScale` is a `useSyncExternalStore` over `resize` and `visualViewport` `resize`; it hands `{ k, logicalWidth }` to `App.tsx`, which writes `--k` and `--logical-w` on `.game` and toggles `.upscaled` (k ≥ 1: the sprites may draw pixelated; downscaled pixel art is smoothed) and `.wide` (≥ 900 logical px: the title's corner decor). `ScaleContext` carries k down.
- **Every DOM measurement becomes logical px**: `useElementSize` / `useElementWidth` divide `getBoundingClientRect` by k and floor; the hand's drag (`ui/Hand.tsx`) divides pointer x by k at the press origin and on every move. The fan, the trick rows and the saloon room lay out from those numbers and never see k. Rest transforms stay whole logical px.
- The safe-area insets enter through `table.css` as `var(--inset-*, env(safe-area-inset-*))`: a native shell sets `--inset-left/right/bottom` on `.game`; a plain browser falls back to `env()`.

What `e2e/play.mjs` asserts (2026-10-07; WebKit at iPhone SE 667x375 @2 and iPhone 15 852x393 @3, mobile contexts, and Chromium at a 1280x800 @2 desktop window; `?seed=3`, two rounds each):

| Check | SE @2 | i15 @3 | desktop @2 |
| --- | --- | --- | --- |
| `.game` rect = viewport (±1 px), `--k` as computed | 667x375, k 0.852, 782.6 wide | 852x393, k 0.893, 953.9 wide, `.wide` | 1280x800, k 1.818, 704 wide, `.upscaled` |
| hand card = 96k x 128k (±0.5 px) | 81.82x109.09 | 85.75x114.33 | 174.55x232.73 |
| 13-card fan: step ≥ 34 logical px, span ≤ strip (both rects scaled) | step 44, 531.8 ≤ 532.3 | step 58, 707.4 ≤ 710.9 | step 37, 981.8 ≤ 992.7 |
| rest transforms whole logical px; nothing scrolls | yes; 667x375 of 667x375 | yes; 852x393 | yes; 1280x800 |

Plus, per browser: 13 cards dealt and the 3♦ leftmost; a `page.mouse` drag in screen px drops the 3♦ at the right end of the fan with nothing selected; the hand and the buttons fit; zero-sum posters and carried totals over two rounds; settings from the title show no "Quit game"; a switch flips; `tallytwo.settings` written; no console errors (Playwright's Chromium has no AAC decoder, so its "unavailable" audio warnings are reported, not counted). 52 checks, 0 failed.

Not yet run on hardware: the lock-screen audio interruption, Add to Home Screen + Airplane mode, and the safe-area insets of a Dynamic Island phone held sideways. These need a physical iPhone.

## 11. Shell bridge

The web app can run inside a WKWebView, an Android WebView or an iframe and talk to that host through one small postMessage protocol; `docs/SHELL.md` is the contract and the embed recipes. The pieces, all WEB bucket under `src/platform/`:

- `bridgeProtocol.ts` — PURE in spirit (no DOM; `bridgeProtocol.test.ts` runs under node): the envelope `{ tally: 1, type, payload, id? }`, the outbound types (`ready`, `score`, `matchOver`, `haptic`, and the requests `settings:get` / `settings:set`), the inbound ones (`pause`, `resume`, `settings`, `insets`), `encode()`, and `decode()`, which validates every inbound message — wrong `tally`, unknown type, malformed payload → `null`; a string is `JSON.parse`d inside a try, never evaluated.
- `bridge.ts` — detects the host once at module load (`window.webkit.messageHandlers.tally` → `ios`, `window.TallyBridge` → `android`, `window.parent !== window` → `iframe`, else `null`) and delivers: JSON strings to the native handlers, a structured object to `parent.postMessage(msg, "*")`. Inbound arrives through `window.tallyReceive(json)` (native) or a `message` event whose `source` is the parent (iframe); both go through `decode()`. `request()` carries an id and resolves on the `settings` reply with that id or rejects after the timeout; the last `pause`/`resume` and `insets` are remembered so a hook that mounts late still sees them. With no host nothing is installed and `send` is a no-op: standalone, the app is unchanged. `createBridge(win)` takes the window as a parameter so `bridge.test.ts` drives it with fakes.
- `bridgeStorage.ts` — a `StoragePort` that asks the host (`settings:get`, 1500 ms) and writes through (`settings:set`), falling back to `webStorage` when the host does not answer, and staying on the fallback after a first timeout. Safari partitions an iframe's localStorage and a WKWebView's data goes with the app cache, so a native host must own the blob. `App.tsx` picks `bridge.host ? bridgeStorage : webStorage` in one line.
- `useBridge.ts` — `useBridgePause()` (folded into `paused` in `Screens` beside `usePageVisibility()`), `useBridgeInsets(ref)` (sets `--inset-top/right/bottom/left` on the `.game` element as `calc(<px> / var(--k))`, since the host reports physical px and table.css consumes them inside the scaled canvas as `var(--inset-left, env(safe-area-inset-left))`) and `useBridgeReady()` (`ready` once per page, StrictMode's double effect absorbed by a module flag).
- The game's side: `GameProvider` takes a `shell?: ShellPort` prop (`useGame.ts`: `haptic(kind)`, `score(round, totals)`, `matchOver(winner, totals)`) next to `audio`, defaulting to a no-op, so the HOOKS bucket still imports nothing from `platform/`; `App.tsx` passes `bridgeShell` from `bridge.ts`. The events fire inside `act()`'s cosmetic `try`, after the `r.next !== state` guard, so each transition reports once: `haptic("deal")` on a deal roll, `haptic("slap" | "win")` on a PLAY that reduced (`win` when `next.phase === "roundover"`), `score` on SCORE_ROUND, `matchOver` when `matchOver(next)` (§7) is true. No game logic changed; `boundary.test.ts` still partitions the tree.
- Webview hygiene: `styles/shell.css` (`overscroll-behavior: none`, `-webkit-touch-callout: none` on html/body — no rubber-banding, pull-to-refresh or long-press callouts) and `maximum-scale=1, user-scalable=no` on the viewport meta in `index.html` (no pinch-zoom; double-tap zoom was already off through body's `touch-action: manipulation`). These apply standalone too.
