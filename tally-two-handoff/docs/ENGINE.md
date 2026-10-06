# Tally Two — engine and AI reference

> **Reconstructed on 2026-10-05** by reading `tally-web/src/engine/*.ts` and `tally-web/src/ai/*.ts` — the TypeScript re-creation of the handoff's engine, proven move-for-move identical to the prototype by `npm run verify:port` (600 games, 3,000 random hands, 0 mismatches). Signatures below are copied from those files; if they ever disagree, the `.ts` file wins. Two ranges are laid out to match `WEB-PLAN.md`'s references into the original: the AI turn recipe at lines 76-82 and the `clearPartitionCache()` guidance at lines 112-113.

Everything here is PURE: no DOM, no timers, no `Math.random`, no `console`. The engine imports nothing; the AI imports only the engine (plus one type from `assets/names.ts`). `tsconfig.core.json` type-checks both without the DOM lib, and `npm run sim` runs them under plain Node with `--experimental-strip-types`.

## Card encoding (`engine/cards.ts`)

A card is one integer `0..51`: **`value = rank * 4 + suit`**. Ranks `3 4 5 6 7 8 9 10 J Q K A 2` are `0..12` (Big Two order: 3 low, 2 high); suits `♦ ♣ ♥ ♠` are `0..3` (Hong Kong order: diamonds low, spades high). So the 3♦ is `0`, the 2♠ is `51`, and a single is beaten by any higher integer. String codes (`"3D"`, `"10S"`, `"2S"`) exist only at the JSON/test boundary.

| Export | Signature | Meaning |
| --- | --- | --- |
| `Card`, `Rank`, `Suit` | `type … = number` | a card value, a rank index, a suit index |
| `Rng` | `() => number` | a random source in [0, 1); the engine never calls `Math.random` itself |
| `RANKS`, `SUITS`, `SUIT_LETTERS`, `SUIT_NAMES`, `RANK_NAMES`, `RANK_PLURALS` | const tables | `"3"…"2"`, `"♦"…"♠"`, `"DCHS"`, `"Diamonds"…`, `"Three"…"Deuce"`, `"Threes"…"Deuces"` |
| `THREE_OF_DIAMONDS`, `RANK_ACE`, `RANK_TWO` | `0`, `11`, `12` | the three values the rules name |
| `rank(v)`, `suit(v)`, `card(r, s)` | `(v: Card) => Rank`, `(v: Card) => Suit`, `(r, s) => Card` | `v >> 2`, `v & 3`, `r * 4 + s` |
| `cardCode(v)`, `parseCard(code)`, `parseCards(codes)`, `cardName(v)` | `Card => string`, `string => Card` (throws on a non-code), `"3D 4C" => Card[]`, `Card => "Three of Diamonds"` | the string boundary |
| `mulberry32(seed)` | `(seed: number) => Rng` | small, fast, seedable PRNG; deterministic per seed |
| `makeDeck()`, `shuffle(arr, rng)` | `() => Card[]`, `<T>(arr: readonly T[], rng: Rng) => T[]` | the 52 cards in value order; Fisher-Yates over a copy, never mutating its input |

## Rules and scoring (`engine/rules.ts`, `engine/scoring.ts`)

| Export | Signature | Meaning |
| --- | --- | --- |
| `LaterRoundLead`, `RuleConfig` | `"winner" \| "loser" \| "threeD"`; `{ passLocksOut, straightWrap, flushSuitFirst, mustLeadWith3D: boolean; laterRoundLead: LaterRoundLead }` | every disputed table rule is a flag; the settings sheet exposes exactly these five |
| `DEFAULT_RULES` | `RuleConfig` | `passLocksOut: false, straightWrap: false, flushSuitFirst: true, mustLeadWith3D: true, laterRoundLead: "winner"` — the Hong Kong game as the prototype shipped it |
| `withRules(patch)` | `(patch: Partial<RuleConfig>) => RuleConfig` | `{ ...DEFAULT_RULES, ...patch }` |
| `cardPenalty(cardsLeft)` | `(n: number) => number` | `n`, doubled at 10 or more, tripled at 13 (never played) |
| `roundScore(counts)` | `(counts: readonly number[]) => number[]` | signed delta per seat: losers pay their penalty, the winner (0 cards) collects the pot; the deltas sum to zero |

## Combos and comparison (`engine/combos.ts`, `engine/compare.ts`)

| Export | Signature | Meaning |
| --- | --- | --- |
| `FiveCardType`, `ComboType`, `Combo` | `"straight" \| "flush" \| "fullhouse" \| "four" \| "straightflush"`; `"single" \| "pair" \| "triple" \| FiveCardType`; `{ type, key: number, cards: Card[] }` | a legal play; `cards` is always sorted ascending; a higher `key` beats a lower one of the same type |
| `classify(cards, rules)` | `(cards: readonly Card[], rules: RuleConfig) => Combo \| null` | the shape of a selection, or `null` for anything that is not a legal hand (two unmatched cards, four cards, a five-card nothing). Straight keys are `pos * 4 + suit(top)`; wrap straights (`straightWrap`) get `pos` −2 / −1 so they rank lowest; flush keys are `suit * 16 + rank(high)` under `flushSuitFirst`, else the high card |
| `describe(combo)` | `(combo: Combo \| null) => string` | "Full House, Kings over Fours" — the words on the wooden sign; `"—"` for null. **Collides with Vitest's `describe`**: tests import it as `describe as describeCombo` |
| `FIVE_CARD_ORDER` | `Record<FiveCardType, number>` | straight 0 < flush 1 < fullhouse 2 < four 3 < straightflush 4 |
| `beats(a, b)` | `(a: Combo, b: Combo \| null) => boolean` | anything beats an empty table; card counts must match; five-card hands by category first, then key; otherwise same type and higher key |

## State and phases (`engine/state.ts`)

The whole game is one plain JSON object — nothing in it is a class, a `Set` or a function — so it can be logged, copied, diffed and replayed. Phases: **`playing` → `roundover`** (a hand emptied; the turn stays on the winner) **→ `scored`** (`SCORE_ROUND` applied the deltas) **→ `playing`** (`NEXT_ROUND` dealt). There is no match phase; `round` and `totals` are all the state carries across deals, so "match over" is a selector in the app.

| Export | Signature | Meaning |
| --- | --- | --- |
| `Phase`, `PlayerKind`, `Player` | `"playing" \| "roundover" \| "scored"`; `"human" \| "ai"`; `{ name, kind, personality?: string, hand: Card[] (sorted), passed: boolean }` | `personality` is absent for the human; `passed` = has passed since the last play (or, with `passLocksOut`, since the trick started) |
| `PlayRecord` | `{ by: number; cards: Card[] }` | one entry per action in the round; a pass is a record with no cards |
| `GameState` | `{ seed, round, rules, phase, players, turn, leader, lastPlay: Combo \| null, lastBy: number \| null, passesInRow, forced3D, history: PlayRecord[], totals: number[] }` | `turn` = whose turn (stays on the winner after a round ends); `leader` = who led the current trick; `lastBy` survives a trick clear because that seat leads next; `forced3D` = this round's opening play must include the 3♦ |
| `PublicView` | `{ me, counts, lastPlay, passesInRow, played: Set<Card>, need3D }` | what an AI is allowed to see: public state plus its own seat index; `played` is rebuilt per call and never stored |
| `needThreeD(g)`, `publicView(g, me)` | `(g: GameState) => boolean`; `(g: GameState, me: number) => PublicView` | true until the round's first play when the lead is forced to hold the 3♦; the view for seat `me` |

## Reducer and actions (`engine/reducer.ts`)

| Action | Payload | Effect |
| --- | --- | --- |
| `DEAL` | `{ seed }` | start a new match at round 1 with the same seats and rules (the app uses `NEW_MATCH` → `deal()` instead; no phase guard) |
| `PLAY` | `{ player, cards }` | the seat on turn plays a legal combo; **throws** `IllegalActionError` on wrong phase, wrong seat, empty/duplicate/foreign cards, a non-hand, a hand that does not beat the table, or a 3♦-less opening lead |
| `PASS` | `{ player }` | the seat on turn passes; **throws** on wrong phase/seat or on an open lead; when nobody but the last player to play is still in, the trick clears and that seat leads |
| `SCORE_ROUND` | — | `roundover` → `scored`: `roundScore()` added to `totals`; **throws** outside `roundover` |
| `NEXT_ROUND` | `{ seed }` | deal round + 1 with the same rules and seats; who leads follows `laterRoundLead` (winner = the seat the turn stayed on; loser = most cards left; `threeD` = the 3♦ holder); no phase guard |

| Export | Signature | Meaning |
| --- | --- | --- |
| `Seat`, `DEFAULT_SEATS` | `{ name, kind, personality? }`; `readonly Seat[]` | seat 0 `{ name: "You", kind: "human" }` (no personality); then Marshal Cobb `"marshal"`, Dusty Vane `"outlaw"`, Lucky Pearl `"gambler"` |
| `deal(seed, rules, seats?, round?, lastLeader?, totals?)` | `(seed: number, rules: RuleConfig, seats = DEFAULT_SEATS, round = 1, lastLeader = 0, totals = [0,0,0,0]) => GameState` | shuffle with `mulberry32(seed)`, deal 13 each sorted ascending; round 1 (and every round under `laterRoundLead: "threeD"`) is led by the 3♦ holder, later rounds by `lastLeader`; `forced3D = useThreeD && mustLeadWith3D` |
| `IllegalActionError` | `class extends Error { action: Action }` | message `illegal PLAY: …`; carries the action |
| `reduce(state, action)` | `(state: GameState, action: Action) => GameState` | the pure reducer; never mutates its input; every change goes through here |
| `replay(seed, rules, actions, seats?)` | `(seed, rules, actions: readonly Action[], seats = DEFAULT_SEATS) => GameState` | rebuild a **round-1** position from the seed and the action list; for round 2+ use `deal(seed, rules, seats, round, lastLeader, totals)` and replay the history (the app's `selectors.replayLog`) |

Illegal PLAY and PASS throw on purpose: the UI only dispatches moves that came from `legalMoves()` and the AI only returns such moves, so a throw is a bug, not a user error, and it is reproducible from a seed and a list of moves. The app layer adds no-op guards for `NEXT_ROUND` and `SCORE_ROUND` (double taps) and catches engine throws in exactly one place (`tally-web/src/game/appReducer.ts` `tryReduce`).

## The AI turn recipe (`ai/aiTurn.ts`)
One AI move, as an `Action`. The provider keeps a seeded rng per deal and calls this inside the think timer; `aiTurn(game, seat, rng, difficulty)` is exactly these five lines:
```ts
const pub = publicView(game, seat);                                   // what the seat may see; `played` rebuilt here
const pers = getPersonality(game.players[seat].personality);          // narrows string | undefined; THROWS for seat 0
const move = chooseMove(pub, game.players[seat].hand, pers, game.rules, rng, difficulty);   // Combo | null
const action = move ? { type: "PLAY", player: seat, cards: move.cards.slice() } : { type: "PASS", player: seat };
game = reduce(game, action);                                          // never throws for a move chooseMove returned
```

`chooseMove` returns `null` (pass) only when following — never on an open lead — so the PASS branch never hits the reducer's "cannot pass on an open lead". `aiTurn` itself throws if `seat` is not an AI; callers check `player.kind === "ai"` first and never call it, or `getPersonality`, for seat 0.

## AI (`ai/*.ts`)

| Export | File | Signature | Meaning |
| --- | --- | --- | --- |
| `genMoves(hand, rules)` | `moves.ts` | `(hand: readonly Card[], rules: RuleConfig) => Combo[]` | every combo the hand can form, regardless of the table. Structural, not brute force: singles in hand order, then pairs and triples by rank, four-of-a-kind + kicker, full houses (one per triple/pair rank), flushes by suit, straights by window (capped at 48 per window). **The order is part of the AI's behaviour** — ties in `chooseMove` go to the first candidate found |
| `legalMoves(hand, lastPlay, rules, need3D)` | `moves.ts` | `(hand, lastPlay: Combo \| null, rules, need3D: boolean) => Combo[]` | `genMoves` filtered by `beats(m, lastPlay)`, then by "includes the 3♦" when `need3D`. Drives Play enablement, dimming and Hint in the app |
| `WEIGHTS` | `evaluate.ts` | `{ endgameAt: 2, hardControl: 4, perType: 3, keyW: 0.1, fiveBonus: 2.5, endgameSingle: 4, safeBonus: 2, hardPass: 0.55 }` | the heuristic knobs, each documented in the file; tuned against `npm run sim` — change one and re-run it |
| `controlSpend(move)` | `evaluate.ts` | `(move: Combo) => number` | 3 per 2, 1 per ace: how many control cards a move spends |
| `unseenList(pub, hand)` | `evaluate.ts` | `(pub: PublicView, hand: readonly Card[]) => Card[]` | every card neither played nor in my hand: what the opponents hold between them |
| `unbeatable(move, unseen)` | `evaluate.ts` | `(move: Combo, unseen: readonly Card[]) => boolean` | can nothing still out there beat this? Singles, pairs and triples only; five-card hands always `false` |
| `PersonalityKey`, `Barks`, `Personality` | `personalities.ts` | `"marshal" \| "outlaw" \| "gambler"`; `{ play, pass, win: string[] }`; `{ key, name, portrait: string, control, noise, passBias, barks }` | `portrait` is typed `string` (`"p_marshal"` etc.); `getPersonality` narrows it to `PortraitKey` |
| `PERSONALITIES`, `isPersonalityKey(k)` | `personalities.ts` | `Record<PersonalityKey, Personality>`; `(k: unknown) => k is PersonalityKey` | Marshal Cobb (control 9, noise 0, passBias 1.0), Dusty Vane (2, 0.05, 0.3), Lucky Pearl (5, 0.16, 0.7), each with its bark lines |
| `Difficulty` | `choose.ts` | `"easy" \| "medium" \| "hard"` | labels Greenhorn / Regular / Card sharp in the UI |
| `chooseMove(pub, hand, pers, rules, rng, difficulty)` | `choose.ts` | `(pub: PublicView, hand: readonly Card[], pers: Personality, rules: RuleConfig, rng: Rng, difficulty: Difficulty) => Combo \| null` | the whole AI, below. Synchronous; worst case under a millisecond |
| `getPersonality(key)` | `getPersonality.ts` | `(key: string \| undefined) => Personality & { portrait: PortraitKey }` | the strict-TS bridge from `Player.personality` to a real personality with a typed portrait; **throws** on `undefined` or an unknown key |
| `aiTurn(game, seat, rng, difficulty)` | `aiTurn.ts` | `(game: GameState, seat: number, rng: Rng, difficulty: Difficulty) => Action` | the recipe above |
| `partitionCount(hand, rules)`, `clearPartitionCache()` | `partition.ts` | `(hand: readonly Card[], rules: RuleConfig) => number`; `() => void` | "plays to empty" (below) and its cache reset |
| barrel | `index.ts` | re-exports all of the above | `import { aiTurn, legalMoves, … } from "../ai"` |

**`chooseMove`, in order.** No legal move → `null`. A move that empties the hand → take it, at every difficulty. **Easy**: sort moves by key then size, pick an index biased low (`abs(rng() − rng())`), and with 12 % chance pass for no reason when following. **Medium**: with probability `pers.noise` play a random legal move; otherwise take the cheapest `WEIGHTS.perType` moves of every shape and score each as `after × 10 + controlSpend × (endgame ? 1 : control) + key × keyW`, minus `fiveBonus` for five-card hands, plus `endgameSingle` for a single when an opponent is at ≤ `endgameAt` cards, where `after` is `partitionCount` of the remaining hand; then, when following, let the trick go with probability `passBias` if the best move would not shorten the hand, or with `0.6 × passBias` if it spends ≥ 3 control points early in a trick. **Hard**: the same with `WEIGHTS.hardControl`/`hardPass` instead of the personality's knobs, plus `safeBonus` for a move `unbeatable()` by the unseen cards. Rng call counts differ per path (easy 3, medium 1-3, hard 0-2), which is why nothing else may consume the AI rng.

## Partition cache (`ai/partition.ts`)
`partitionCount(hand, rules)` is a greedy partition of a hand into the fewest plays — largest combo first, cheapest among equals, at most 20 iterations — and the AI's core evaluation number. It is memoised at module level (a `Map` keyed by `hand.join(",") + "|" + straightWrap`, cleared when it passes 60,000 entries), because `chooseMove` asks for it once per candidate per turn.
`clearPartitionCache()`: call it on **every new match** (the app reducer does, in `NEW_MATCH`) and in every test file's `beforeEach`, because a hand's count depends on the `straightWrap` rule and a stale entry from a game with different rules would silently change the AI's choices;
it costs nothing (one `Map.clear()`) and the cache refills within a few turns. The prototype did the same when the straight-wrap switch flipped.

## The rng contract

- **Seeded per deal.** `deal(seed, …)` shuffles with `mulberry32(seed)`. The app gives the AI a second stream off the same seed, `mulberry32(seed ^ 0x9e3779b9)` (`tally-web/src/game/seeds.ts` `aiRngFor`; the same constant in `scripts/sim.mjs`), reseeded on every `NEW_MATCH` and `NEXT_ROUND`. So a round replays from its seed alone **and** from seed + history.
- **The AI rng is private.** Only `chooseMove` draws from it, inside `actAi`, inside the think timer. Any extra consumer changes AI decisions, because the number of draws per decision depends on the path taken.
- **Cosmetics use `Math.random`.** Think time (`thinkMs`), the bark chance and line, pitch jitter, the Hint button (`hintFor(game, legal, Math.random)` — the Marshal at Regular), and `newSeed()` itself. None of them can change a decision.
- **The engine never calls `Math.random` or the clock.** `grep -rE "Math.random|Date.now|process|window|document" src/engine src/ai` finds only the doc comment in `ai/choose.ts`.
- **Tests pass a fixed rng** (`mulberry32(n)` or `() => 0.5`) and get the same answer every time; `ai/sim.test.ts` carries a golden action list for seed 1000.

## Determinism and the gates

- `npm run sim -- N`: N AI-only games (seats marshal / outlaw / gambler / marshal, four difficulty mixes) through the real `reduce()`, which throws on any illegal action — "0 illegal actions, 0 stalls" is a proof, not a shadow implementation agreeing with itself. Also prints the difficulty numbers (`DECISIONS.md` §5).
- `npm run verify:port -- N`: the same seeds and the same shared rng stream through the prototype's engine (`reference/proto-oracle.cjs`) and through this one; every decision compared. 600 games: 0 mismatches.
- `engine.test.ts`: the handoff's 65 assertions (classification, comparison, antisymmetry over 4,000 random hands, the five-card category matrix, a replay round-trip, A-2-3-4-5 under `straightWrap`).
- Timing: a full AI round runs in about 4 ms under Vitest; `chooseMove` worst case 0.9 ms, so no worker.
