# Tally Two — Vite + React implementation plan

Sep 22, 2026 · @Jordan

Build Tally Two as a Vite + React web app around the untouched engine and AI, in seven milestones with an executable gate each, structured so the later React Native port copies everything except the UI. The repo copy of this plan is `tally-two-handoff/docs/WEB-PLAN.md`.

Path shorthands used throughout:

| Short | Path |
| --- | --- |
| `H` | `/Users/jordanboudreau/Desktop/Tally Two/tally-two-handoff` (the handoff package; the source of every file we copy) |
| `P` | `H/reference/tally-two-saloon.html` (the browser prototype; behaviour spec, 1283 lines, line 326 is a 2.38 MB data-URI blob) |
| `W` | `/Users/jordanboudreau/Desktop/Tally Two/tally-web` (the new Vite project; today an untouched `react` JS hello-world from an aborted scaffold — M0 replaces it with `react-ts`) |
| `SP` | the session scratchpad where the verification probes (`SP/satprobe`, `SP/vitest-probe`, `SP/satcheck`) were run. Ephemeral: cited only as evidence for claims already recorded here; nothing in the build depends on it |
| `AD` | `H/docs/ASSET-DECISIONS.md` (the asset triage, copied verbatim from the session so line refs hold: KEPT `:8-125`, QUARANTINED `:127-206`, 47 slots `:208-255`) |

`file:line` means a line in that file. Everything below was checked against the files on disk on 2026-09-21 (Node v22.17.1; create-vite 9.2.1, Vitest 5.0.1, vite-plugin-pwa 1.3.0 and @fontsource/rye 5.3.0 as published on npm that day; TypeScript **\~6.0.2** is the create-vite 9.2.1 react-ts template's pin, `template-react-ts/package.json` — npm `latest` is 7.x, so `npm view typescript version` printing `7.0.2` is expected and not a mismatch).

## 1. Goals and constraints

### Goals, in priority order

1. **Understand first.** You are learning React. The whole app is built around one idea you meet in the first file you open: a pure `(state, action) => state` function (`H/src/engine/reducer.ts:102`). React's `useReducer` runs that function unchanged; a second, 25-line reducer wraps it; a third runs settings. No state library.
2. **Full single-player game.** Title → deal → 13-card hand → AI opponents with think delays → WANTED poster → next round, with settings, how-to, sound and music. The prototype `P` already does most of this; we rebuild it on the real engine.
3. **React Native port later.** Every file that is not DOM/CSS is written so it copies into the RN app unchanged; the boundary is enforced by the compiler and a small test, not by memory (§3.2, §7).

### Constraints carried over from `H/docs/DECISIONS.md`

| Constraint | Where it is settled | What it means for this build |
| --- | --- | --- |
| Big Two, 1 human + 3 AI, Hong Kong rules; every disputed rule is a flag | `DECISIONS.md:9-23`; `H/src/engine/rules.ts:11-30` | Rules UI = the five flags in `rules.ts`; nothing else |
| Portrait phone, iPhone Safari is the target | `DECISIONS.md:94-99`; `H/docs/SKIA-SPIKE.md:3` | Game root is a phone-width column even on desktop; landscape gets a "turn your phone" overlay, not a layout (§3.6) |
| Cards: 96x128 source art, 48 px legibility floor, 13-card fan = 360 px wide | `DECISIONS.md:47-72`; `H/src/render/scale.ts:106,119,134` | Cards are **96x128 CSS px, always**; on every iPhone (dpr 2/3) that is 1 art px = 1 device px x dpr, the same rule as the RN spike (`SKIA-SPIKE.md:24-32`) |
| Persistence: settings only, game dies with the tab | `DECISIONS.md:20` | `localStorage` key `tallytwo.settings` only (`P:1049`) |
| Pure reducer, illegal actions throw, seed + actions replays | `H/src/engine/reducer.ts:1-17` | The UI only dispatches moves that came from `legalMoves()`; a throw is a bug and shows the seed + action log (§3.3) |
| Hard is not measurably stronger than Medium | `DECISIONS.md:74-92`; `H/src/ai/choose.ts:46,51,81` | Ship the three labels from `P:267` with a hint line; no lookahead work |
| Open: match length, western card back, portrait states, 9-slices | `DECISIONS.md:103-114` | Default endless match with a `roundsPerMatch` setting and a specified match-over flow (§3.4, M4); CSS chrome as the prototype does (`DECISIONS.md:110-111`); see §8 |
| Deliberately not done: no landscape layout, no persisted game | `DECISIONS.md:116-121` | Offline/installability is **not** settled there — §8 question 6; this plan's default is installable-offline (§3.1, M6) |

### Constraints from the asset triage (`AD`)

- Only `.ogg` audio survived (`AD:70-118`: 46 SFX + 3 loops, zero `.mp3`/`.m4a`); Ogg playback in iOS Safari is unverified → the go/no-go probe runs **today, in step -1** (§5), because it needs nothing from the Vite project and its answer decides what M5 wires (`.ogg` or `.m4a`) and the 36 audio names in `names.ts`.
- Six display sprites (wood, felt, three portraits, WANTED face) existed only inside the prototype's data-URI blob at `P:326`; nothing in `H/assets` matched (`find` over the whole `Tally Two` folder, `_trash` excluded, returned nothing). **Done 2026-09-22 (step -1a):** they were decoded and saved to `H/assets/proto/` (wood 96x96, felt 32x32, three portraits 64x64, wanted 61x71). If ever lost, re-decode from `P:326` (§3.8 step 0).
- Seven of the sixteen SFX embedded in `P` are quarantined (`AD:163, 176, 180, 182, 184, 188, 203` — CardGrab01, CardMoveFast04, CardSlide01/03/05, CardsFalling02, DeckShuffle03; verified by hashing the blobs in `P:326` against the files on disk). Never extract audio from `P`; wire the kept files listed in §3.7.

## 2. What we already have

Verdicts: **verbatim** = copy, never edit; **adapt** = copy, small mechanical change; **replace** = write a web equivalent, do not copy; **spec-only** = read for behaviour/numbers, copy nothing.

### `H/src/engine/` (531 lines, zero external imports, all pure)

| File | Lines | Verdict | Why |
| --- | --- | --- | --- |
| `engine/cards.ts` | 70 | verbatim | Card encoding `value = rank*4 + suit` (`:4-6`), `mulberry32` (`:53-61`), `shuffle` (`:63-70`), name tables (`:16-23`). No imports at all. |
| `engine/rules.ts` | 33 | verbatim | `RuleConfig` (`:11-22`), `DEFAULT_RULES` (`:24-30`), `withRules` (`:32-33`). Plain data. |
| `engine/scoring.ts` | 19 | verbatim | `cardPenalty` (`:9-12`), `roundScore` (`:15-19`); deltas sum to zero. |
| `engine/combos.ts` | 110 | verbatim | `classify` (`:48-78`), `describe` (`:81-110`). One wrinkle: the export is literally named `describe`, which collides with Vitest's global; alias it in tests (`import { describe as describeCombo }`). |
| `engine/compare.ts` | 29 | verbatim | `beats` (`:20-29`), `FIVE_CARD_ORDER` (`:12-18`). |
| `engine/state.ts` | 78 | verbatim | `GameState` is declared and exported **here** (`:31-51`) — `reducer.ts` imports it (`reducer.ts:23`) and does not re-export it, so app code imports the type from `../engine/state`. Plain JSON (`:3-5`); `PublicView.played` is a `Set` rebuilt per call (`:62, 73`) so it is never stored in React state. No match-over phase (`:12`: `playing \| roundover \| scored`) and no match concept at all — `round` and `totals` (`:34, :50`) are all it carries, so "match over" is a selector over `game` + a setting (§3.4). `history` is `PlayRecord[]` (`:25-29`), not `Action[]`. `Player.personality` is optional and absent for the human (`:18-19`). |
| `engine/reducer.ts` | 192 | verbatim | `reduce(state, action)` (`:102`) is already the `useReducer` signature. Throws on illegal PLAY/PASS (`:110-123, 143-145`) and on SCORE\_ROUND outside `roundover` (`:166`); DEAL and NEXT\_ROUND have **no phase guard** (`:104-107, 174-183`) — the app reducer adds one (§3.3). `deal(seed, rules, seats, round, lastLeader, totals)` (`:45-52`) is what a round-2+ replay needs; `replay` (`:188-192`) only rebuilds round 1 (§3.3, §6). `DEFAULT_SEATS` (`:38-42`): seat 0 is `{ name: "You", kind: "human" }` with no personality. |

Verified: `tsc` strict + `moduleResolution: bundler` over `src/engine` + `src/ai` exits 0 under the handoff's own config (`H/tsconfig.json`: strict, ES2020), **and** under TypeScript 6.0.2 with the create-vite 9.2.1 react-ts template's exact options (`erasableSyntaxOnly`, `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`, target es2023) — exit 0 both with the DOM lib and with a no-DOM "core" variant; `grep` finds no `enum`/`namespace`/parameter properties, and every type-only import already uses `import type` / `type` modifiers. Vitest runs a full AI round in 4 ms; `grep` for `Math.random|Date.now|process|window|document` finds only a comment at `H/src/ai/choose.ts:5`.

### `H/src/ai/` (380 lines, imports only `../engine`)

| File | Lines | Verdict | Why |
| --- | --- | --- | --- |
| `ai/choose.ts` | 89 | verbatim | `chooseMove(pub, hand, pers, rules, rng, difficulty) → Combo \| null` (`:22-29`). Sync, worst case 0.9 ms. Returns `null` only when following (`:42, :80-86`), so PASS never hits `reducer.ts:145`. |
| `ai/moves.ts` | 111 | verbatim | `legalMoves(hand, lastPlay, rules, need3D)` (`:102-111`) drives Play enablement, dimming and Hint. Uses `??=` (`:56-57`); the template's es2023 target emits it natively and lower targets are downlevelled (the handoff compiles it at ES2020, `H/tsconfig.json:4`), so there is nothing to configure. |
| `ai/partition.ts` | 49 | verbatim | Module-level memo (`:16`); call `clearPartitionCache()` (`:49`) on every new match and in test `beforeEach`. |
| `ai/evaluate.ts` | 64 | verbatim | `WEIGHTS` with per-knob docs (`:9-26`). |
| `ai/personalities.ts` | 67 | verbatim | Names, tuning, bark lines (`:27-67`); bark lines are keyed by personality (`barks: { play, pass, win }`, `:20-24`, marshal's at `:35-39`), so **seat 0 has no bark lines** — every bark path must be AI-only (§3.4). `portrait` is typed **`string`** (`:16`, doc comment `:15`); the three literal values `"p_marshal"`, `"p_outlaw"`, `"p_gambler"` appear only at `:31, :44, :57`, so nothing type-checks a portrait key — `src/assets/names.ts` declares the `PortraitKey` union and `manifest.test.ts` asserts every `PERSONALITIES[k].portrait` is in `PORTRAITS` (§3.8). The union that does exist is `PersonalityKey = "marshal" \| "outlaw" \| "gambler"` (`:10`). `Player.personality` is `string \| undefined` (`state.ts:19`) but `PERSONALITIES` is `Record<PersonalityKey, …>` (`:27`), so strict TS needs a `getPersonality(key)` helper. |

### `H/src/render/`

| File | Lines | Verdict | Why |
| --- | --- | --- | --- |
| `render/atlas.ts` | 40 | verbatim | `ATLAS_ROW = [0,3,2,1]` (`:15`), `ATLAS_COL = [2..12,0,1]` (`:18`), `spriteFor` (`:26-33`). Engine and atlas disagree in both axes (`:3-6`); the failure is silent (right play, wrong card) so `atlas.test.ts` pins three rects. |
| `render/scale.ts` | 174 | adapt | Pure, zero imports (`:9-10`). Only doc comments are RN/Skia-flavoured — six lines: `:1` ("Skia table"), `:4` ("React Native lays out in points"), `:9` ("No React Native imports"), `:18` (`PixelRatio.get()`), `:25` (`<Group transform=…>`), `:53` ("looks like "Skia is broken"") → reword to "CSS px" / "devicePixelRatio" / "the game root" / "looks like the browser is blurring". The four that name an RN/Skia API (`:1, :4, :18, :25`) are the ones a reader would trip over; `:9` and `:53` are just stale. Math unchanged: `fanSpanArt(96) = 360`, step 22 (`:134-137`). |
| `render/CardFan.tsx` | 113 | replace | Skia `Atlas`/RSXform + Reanimated (`:10-13`). Its fan maths (`:38-41`: step/span/x0, integer) and rest-pose rules (`:61-66`: integer position, zero rotation at rest) and `TrickPile` step `floor(96*0.42) = 40` (`:94`) become numbers in `render/fanLayout.ts`. |
| `render/PlainImageFan.tsx` | 104 | replace | `react-native` + Reanimated (`:16-19`), CJS `require` of a stale path (`:29`). Its `CardSprite` (`:31-45`) is exactly the DOM `background-position` card; its integer-step rule (`:57-59`) is kept. |
| `render/SpikeScreen.tsx` | 120 | replace | RN + Skia + Reanimated (`:9-11`). Becomes `dev/Spike.tsx` (`?dev=spike`), simpler on the web (no worklets). |
| `render/CrispnessProbe.tsx` | 59 | replace | Skia `Image` (`:13`). Becomes a CSS `background: url(checker.png) repeat` div plus a half-pixel-shifted twin. |

These four `.tsx` files are the **only** `tsc` errors in the handoff (`react-native`, `@shopify/react-native-skia`, `react-native-reanimated` not found). They are not copied.

### `H/scripts/`

| File | Lines | Verdict | Why |
| --- | --- | --- | --- |
| `scripts/test-engine.mjs` | 201 | adapt → `src/engine/engine.test.ts` | 65 `check`/`ok` calls become `test`/`expect`. Delete `:198-201` (`process.exit` fails the file under Vitest — verified). `:18` imports `legalMoves, genMoves` from `src/ai/moves.ts`, so engine tests need `src/ai`. Keep the replay assertion (`:172-173`) as a `JSON.stringify` compare. |
| `scripts/sim.mjs` | 108 | verbatim (CLI) + adapt (`src/ai/sim.test.ts`) | It is a gate runner with `process.argv`/`process.exit` (`:19, :108`), kept unchanged as `npm run sim`. Its `playGame`/`run` (`:23-73`) are also ported to a 200-game Vitest test asserting 0 errors / 0 stalls (`:106-108`) plus a golden action list for seed 1000. AI rng = `mulberry32(seed ^ 0x9e3779b9)` (`:24`). |
| `scripts/verify-scale.mjs` | 121 | adapt → `src/render/scale.test.ts` | The seven-iPhone `DEVICES` table (`:16-24`) and three invariants (`:49-51`) become `expect()`s. It imports `fixedWidthScale` (`:11`) and never calls it — add odd-leftover cases. |
| `scripts/register-resolver.mjs`, `scripts/ts-resolve.mjs` | 3, 13 | verbatim (CLI only) | Node module-hook plumbing so plain Node can resolve extensionless `.ts` imports. Required for `npm run sim`; irrelevant to Vite/Vitest, which resolve `.ts` natively. `register-resolver.mjs:3` resolves against cwd, so always run via `npm run`. |

### `H/reference/`

| File | Verdict | Why |
| --- | --- | --- |
| `reference/tally-two-saloon.html` (`P`) | spec-only, with CSS **adapt** | Its engine/AI copy (`P:393-678`) is the same algorithm as `src/` but its state layer mutates in place (`applyPlay` `P:719-727`) — DELETED, `src/engine` is the truth. Its CSS (`P:6-216`) is split into `src/styles/*.css` with only `url()` values and card sizes changed. Its DOM, turn loop, timings, copy and audio numbers are the behaviour spec (§3, §5). Its in-page tests (`P:1080-1212`) are replaced by Vitest. Its `AST.img` object at `P:326` is also the recovery copy of the six proto sprites (§3.8). |
| `reference/README.md` | spec-only | States the prototype's card sizes are CSS px, not the point scale (`:28-29`). |

### Docs

`H/docs/ENGINE.md` (accurate; the AI turn recipe at `:76-82`, `clearPartitionCache` at `:112-113`), `DECISIONS.md`, `ASSET-MAP.md` (crop provenance `:45-47, 57-59`), `SKIA-SPIKE.md` (device matrix `:24-32`), `BUILD-PLAN.md` (audio wiring notes `:92-99`: the three buses at `:92`, round-robin + pitch jitter `:93-94`, ducking `:95`, silent mode `:96`, the OGG-loop rule `:97-99`), `assets/manifest.json` (loop durations `:1749-1756`, ambience gain `:1617-1618` — use as data, its paths are stale). `H/README.md:58` and `manifest.json:1745` still say 110 SFX / 5 loops / 14 sheets; after the triage it is 46 / 3 / 9. `docs/ASSETS.md` in the new project becomes the truth.

### The existing `W` scaffold

`W/package.json`: vite ^8.3.0, react ^19.2.8, oxlint; **no typescript, no vitest, no `node_modules`, no git**; `W/src/main.jsx`, `App.jsx` are the Vite hello-world. Verdict: **delete and re-scaffold** with the `react-ts` template (M0) — cheaper than converting `.jsx` and hand-writing the tsconfig trio.

What the current template actually gives you (create-vite 9.2.1 `template-react-ts`, read from the copy in `~/.npm/_npx/*/node_modules/create-vite` and from unpkg): `typescript ~6.0.2`, `vite ^8.3.0`, `@vitejs/plugin-react ^6.1.1`, `oxlint ^1.81.0` with `_oxlintrc.json` (react/rules-of-hooks), `@types/node ^24`; `tsconfig.app.json` with target es2023, `types: ["vite/client"]`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`; `tsconfig.node.json` (`module: nodenext`, `types: ["node"]`) that type-checks `vite.config.ts` as part of `tsc -b`; starter files `src/App.css`, `src/index.css`, `src/assets/{hero.png,react.svg,vite.svg}`, `public/{favicon.svg,icons.svg}`. The scaffolder is interactive even with `--template` given: it asks **"Which linter to use?"** (answer Oxlint, the default; `--eslint` is the other path) and **"Install with npm and start now?"** (answer No, or pass `--no-immediate`, because we add Vitest and pin versions before the first `npm run dev`). There is no rolldown prompt in 9.2.1 (`grep message:` over its `dist/index.js` finds exactly five prompts: project name, package name, variant, linter, install-and-start).

## 3. Target architecture

### 3.1 Folder tree

Every folder carries its **bucket** in the trailing comment — PURE, HOOKS or WEB — which is the whole import rule (§3.2).

```
tally-web/
  index.html                  <!DOCTYPE html>, viewport "width=device-width, initial-scale=1, viewport-fit=cover",
                              theme-color #241408, <title>Tally Two</title>,
                              <link rel="apple-touch-icon" href="/icons/icon-192.png">,
                              <meta name="apple-mobile-web-app-capable" content="yes">,
                              <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
                              (P:1 has no doctype and no viewport; 100dvh at P:38 and env(safe-area-inset-*) at P:79/160 need them;
                               the three apple-* tags are what iOS reads for Add to Home Screen — the webmanifest alone is not enough)
  package.json                deps: react, react-dom, @fontsource/rye
                              devDeps: vite, @vitejs/plugin-react, typescript, vitest, oxlint, @types/react, @types/react-dom, @types/node,
                                       vite-plugin-pwa (M6, see §8 q6)
                              scripts: see §3.9
  tsconfig.json / tsconfig.app.json / tsconfig.node.json   react-ts template AS-IS (TS ~6.0, target es2023,
                              erasableSyntaxOnly / verbatimModuleSyntax / noUnusedLocals / noUnusedParameters on — the verbatim
                              files pass all of these, verified §2; noUncheckedIndexedAccess stays OFF as in H/tsconfig.json:12)
  tsconfig.core.json          the "pure files only" config: lib ["ES2023"], types [] → window/document/localStorage/setTimeout/console/
                              URLSearchParams/import.meta.glob/"*.png" modules are type errors; folder includes + a naming rule (§3.2)
  vite.config.ts              import { defineConfig } from "vitest/config"   ← NOT from "vite": Vite's UserConfig has no `test` key and
                              tsconfig.node.json type-checks this file under `tsc -b`, so the "vite" import fails the build before any app code exists
                              plugins:[react(), VitePWA({...}) (M6)]; test:{ environment:"node", include:["src/**/*.test.ts"] }
  scripts/                    sim.mjs, register-resolver.mjs, ts-resolve.mjs — VERBATIM from H/scripts
  public/
    icons/icon-192.png, icon-512.png                             (M6; the webmanifest is generated by vite-plugin-pwa)
                              (the Ogg go/no-go probe is NOT here: it is H/assets/audio/probe.html, written and run in step -1, §5)
  docs/
    ARCHITECTURE.md  ASSETS.md  PORTING.md                    (M6; ASSETS.md = the 47 slots, §4)

  src/
    main.tsx                  createRoot + <StrictMode><App/></StrictMode>; imports @fontsource/rye and styles/*.css          WEB
    App.tsx                   const audio = useMemo(() => new WebAudio(), []); const storage = webStorage;                     WEB
                              seed = Number(new URLSearchParams(location.search).get("seed")) || newSeed(1)  (query parsing lives HERE)
                              <SettingsProvider storage={storage}><ErrorBoundary (M6)><GameProvider audio={audio}><Screens/>…
                              Screens: useState sheet ("none" | "settings" | "howto"); calls useAudio({ sheet, paused }) once (§3.7);
                              switches on game === null (title) / crash (CrashScreen) / else table; ?dev=spike → dev/Spike
                              paused = usePageVisibility() || useLandscapeShort()
                              one document "pointerdown" listener → audio.resume() when the context is not running (§3.7, iOS interruptions)
    vite-env.d.ts             template

    engine/                   VERBATIM: cards.ts rules.ts scoring.ts combos.ts compare.ts state.ts reducer.ts                 PURE
      engine.test.ts          port of H/scripts/test-engine.mjs (65 assertions)                                              (M0b)
    ai/                       VERBATIM: moves.ts partition.ts evaluate.ts personalities.ts choose.ts                          PURE
      index.ts                barrel
      getPersonality.ts       (key: string | undefined) => Personality & { portrait: PortraitKey }   (narrows the string, §3.8; THROWS on
                              undefined — callers guard with player.kind === "ai" first, never call it for seat 0)
      aiTurn.ts               pure: (game, seat, rng, difficulty) => Action   — the ENGINE.md:76-82 recipe
      sim.test.ts             200 seeded games, 0 throws / 0 stalls, golden list for seed 1000                                (M0b)

    render/                   pure geometry, no React                                                                        PURE
      atlas.ts                VERBATIM
      scale.ts                VERBATIM except six doc comments (:1, :4, :9, :18, :25, :53)
      fanLayout.ts            NEW: fanLayout(n, availW, cardW=96) → { step, x0, xs } integer only; PILE_STEP = 40; SELECT_LIFT = 14
      atlas.test.ts scale.test.ts fanLayout.test.ts

    game/                     THE STORE. React hooks + pure helpers. No DOM. Copies to RN unchanged.            PURE (.ts) / HOOKS (.tsx, use*)
      appReducer.ts           AppState = { game: GameState | null; dealId: number }; wraps reduce(); NEW_MATCH / QUIT; no-op guards;
                              tryReduce(state, a) → { next } | { crash }   (the one place an engine throw is caught, §3.3)
      GameProvider.tsx        props { audio: AudioPort }; useReducer(appReduce) + selection + aiRng ref + crash state + act()/actAi()/toggleCard()
                              + barks; renders <CrashScreen/> instead of children while crash !== null (no throw-in-render, §3.3)
      useGame.ts              { game, dealId, selection, legal, exact, live, canPass, status, sign, act, actAi, toggleCard, barks, audio, crash }
                              (`audio` is the injected port, re-exposed so useAudio and the sheets never import WebAudio)
      useTurnLoop.ts          the two effects: AI think / auto-pass timer, and roundover → SCORE_ROUND; calls actAi(seat, difficulty)
      useBarks.ts             barks as state; returns { list: Bark[], show(seat, kind) } with `show` stable (useCallback [], §3.3)
      cues.ts                 pure: cueFor(before, action, next) → { sfx: SfxEvent[]; bark?: { seat; kind } }   (bark only for AI seats)
      selectors.ts            pure: legalFor, exactMove, liveCards, canPass, statusFor, signFor, sortHand, hintFor,
                              matchOver(game, roundsPerMatch), matchWinner(game), musicFor(game, sheet), tensionFor(game),
                              historyToActions, gameLog(game) → GameLog, replayLog(log) → GameState
      copy.ts                 every user-facing string
      timing.ts               every ms number (§3.5)
      seeds.ts                newSeed(round), aiRngFor(seed)   — no query parsing here (URLSearchParams is a DOM type; App.tsx owns it)
      appReducer.test.ts cues.test.ts selectors.test.ts timing.test.ts boundary.test.ts GameProvider.test.ts

    settings/
      settings.ts             Settings = { rules: RuleConfig; opts: Opts }; type Opts; DEFAULTS; parseSettings(json); KEY = "tallytwo.settings"   PURE
      storage.ts              interface StoragePort { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> }   PURE
      SettingsProvider.tsx    useReducer(settingsReduce); starts from DEFAULTS, hydrates from the StoragePort prop in a useEffect; exposes `loaded`   HOOKS
      useSettings.ts                                                                                                                  HOOKS
      settings.test.ts

    audio/
      sfxTable.ts             ONE table: SfxEvent → { files: AssetName[], gain, ducks } + MUSIC, DUCK, JITTER, DEAL_ROLL, TENSION_THRESHOLD,
                              CROSSFADE_MS, AMBIENCE_DB   (imports AssetName from ../assets/names, never from manifest)               PURE
      pool.ts                 pickVariant(n, last, rand) — round-robin without immediate repeat; n === 0 is the caller's guard          PURE
      musicLatch.ts           createMusicLatch(): want(track) / decoded(track) → the start/stop commands; "setMusic before decode"      PURE
                              is desired-state, not fire-and-forget (§3.7)
      port.ts                 interface AudioPort { init(): Promise<void>  /* never rejects, never awaited by the UI */; play; dealRoll;
                              setMusic /* latched */; setTension; duck; setBus; suspend; resume }                                     PURE
      WebAudio.ts             the web implementation (AudioContext, 3 GainNode buses, decode with Promise.allSettled, loops, duck, crossfade,
                              ctx.resume() whenever ctx.state !== "running")                                                          WEB
      useAudio.ts             THE music/bus state machine, one hook: reads useGame().audio + game, useSettings().opts and the { sheet, paused }
                              args; effects call setMusic(musicFor(game, sheet)), setTension(tensionFor(game)), setBus(...), suspend/resume.
                              Never constructs WebAudio. Sheets and screens never touch playback.                                     HOOKS
      sfxTable.test.ts pool.test.ts music.test.ts

    platform/                 the only place DOM globals are touched outside ui/, App.tsx and audio/WebAudio.ts                       WEB
      webStorage.ts           StoragePort over localStorage: Promise.resolve inside try/catch (P:1047-1055)
      usePageVisibility.ts    document.hidden → boolean
      useLandscapeShort.ts    matchMedia("(orientation: landscape) and (max-height: 500px)") → boolean
      useDevice.ts            devicePixelRatio + ResizeObserver on the game root → Device; sets --dpr on :root

    ui/                       PRESENTATIONAL. Reads useGame()/useSettings(), calls act(). No game rules inside.                      WEB
      Card.tsx Hand.tsx Pile.tsx Sign.tsx Felt.tsx Seat.tsx Bark.tsx TopBar.tsx StatusLine.tsx Controls.tsx
      Switch.tsx Overlay.tsx Doors.tsx
      CrashScreen.tsx         (M1b) props { report: CrashReport; onReset }: seed/round/leader/totals/action/history, "Copy game log", "Saddle up"
      ErrorBoundary.tsx       (M6) the ~15-line last-resort net for RENDER bugs: error.message + "Saddle up"; the only class component
      screens/TitleScreen.tsx TableScreen.tsx ResultsPoster.tsx SettingsSheet.tsx HowToSheet.tsx
    styles/                   the prototype CSS split at its own section banners                                                     WEB
      tokens.css (P:6-19 + --cw:96px --ch:128px)  base.css (P:26-40)  buttons.css (P:65-75)  table.css (P:78-132)
      cards.css (P:135-154)  overlays.css (P:163-205)  motion.css (keyframes + reduced motion, P:128-132,153-154,215-216)
      responsive.css (two blocks, §3.6: @media (max-height: 700px) portrait rules; @media (orientation: landscape) and (max-height: 500px)
                      overlay rules. The card resizes at P:207-213 are DROPPED)

    assets/
      names.ts      PURE: type AssetName = "cards_atlas" | … (the ~45 literals); type PortraitKey = "p_marshal" | "p_outlaw" | "p_gambler"   PURE
      cards/      cards_atlas.png @2x @3x, card_back.png @2x @3x        ← H/assets/cards (AD:119-124)
      sprites/    wood.png felt.png p_marshal.png p_outlaw.png p_gambler.png wanted.png   ← H/assets/proto (rescued from P:326 in step -1a)
      sprites/    checker.png                                              ← H/assets/checker.png (AD:125)
      sfx/        only the audio files sfxTable.ts references (§3.7)       ← H/assets/audio/sfx (.ogg, or .m4a if the step -1 probe failed)
      music/      ost_1, ost_3, ost_4 loops                                ← H/assets/audio/music (AD:70-72)
      manifest.ts   WEB: ~45 explicit `import x from "./….png?url"` lines + `export const MANIFEST = { cards_atlas, … } satisfies Record<AssetName, string>`
                    (a missing file is a Vite build error, a missing/misspelled key is a TS error) + PORTRAITS: Record<PortraitKey, AssetName>
                    + a DEV-only guard that throws on the first undefined value (§3.8)
      manifest.test.ts

    dev/Spike.tsx             ?dev=spike diagnostics: dpr, S, checker probe + half-pixel twin, 13-card fan, fps                     WEB
    dev/DevHook.tsx           DEV only, mounted inside GameProvider: window.__tally = { act, get game() }  (M1b gate 4)              WEB
```

### 3.2 Module boundaries and the import rule

Three buckets are all you need to hold in your head, and they are the three things the tooling actually enforces:

| Bucket | What goes there | The rule you feel | Enforced by |
| --- | --- | --- | --- |
| **PURE** | `engine/`, `ai/`, `render/*.ts`, `game/*.ts` (not the `.tsx`/`use*` files), `settings/{settings,storage}.ts`, `audio/{sfxTable,pool,musicLatch,port}.ts`, `assets/names.ts` | "If it needs `window`, `setTimeout`, `console`, `URLSearchParams` or `import.meta`, it does not go here." | `tsconfig.core.json` — those names are "Cannot find name". **The rule, so no file is forgotten:** inside the seven pure-bearing folders, every `.ts` file that is not `use*.ts`, not `*.test.ts` and not one of the two named WEB files (`audio/WebAudio.ts`, `assets/manifest.ts`) is PURE and is type-checked without DOM. A new pure file is checked the moment it exists; a new hook is excluded by its `use` prefix. |
| **HOOKS** | `game/{GameProvider,useTurnLoop,useBarks,useGame}`, `settings/{SettingsProvider,useSettings}`, `audio/useAudio.ts` | "React + `setTimeout` only. Platform objects (`audio`, `storage`) **arrive as props**, never as imports. This copies to RN." | `boundary.test.ts` (a regex over these files) |
| **WEB** | `ui/**`, `styles/*`, `platform/*`, `audio/WebAudio.ts`, `assets/manifest.ts`, `App.tsx`, `main.tsx`, `dev/*` | "Anything goes, but no game rules: an `if` about the rules of the game belongs in `selectors.ts`." | `boundary.test.ts` (one rule: `ui/**` never imports `engine/reducer` or `ai/*` directly; types allowed) |

The finer eight-layer table below is kept for `docs/ARCHITECTURE.md`; a file may import only from its own layer or a lower one.

| Layer | Folders | May import | Enforced by |
| --- | --- | --- | --- |
| 0 engine | `src/engine` | nothing | verbatim copy; `tsconfig.core.json` |
| 1 ai | `src/ai` | engine | verbatim copy; `tsconfig.core.json` |
| 2 geometry | `src/render/{atlas,scale,fanLayout}.ts` | nothing | `tsconfig.core.json` |
| 3 pure game | `src/game/*.ts` except `use*.ts` (`appReducer, cues, selectors, timing, seeds, copy`), `src/settings/{settings,storage}.ts`, `src/audio/{sfxTable,pool,musicLatch,port}.ts`, `src/assets/names.ts` | 0-2 | `tsconfig.core.json` |
| 4 hooks | `src/game/{GameProvider,useTurnLoop,useBarks,useGame}.tsx`, `src/settings/{SettingsProvider,useSettings}.tsx`, `src/audio/useAudio.ts` | 0-3 + `react` (never `react-dom`, never `window`/`document`/`localStorage`/`navigator`, never `./WebAudio`, `../platform`, `../assets/manifest`) | `boundary.test.ts`. They need `setTimeout`, which is why they sit outside `tsconfig.core.json`. |
| 5 platform | `src/platform/*`, `src/audio/WebAudio.ts`, `src/assets/manifest.ts` | 0-4 + DOM | — |
| 6 ui | `src/ui/**`, `src/styles/*` | 2-5 (`useGame`, `selectors`, `copy`, `atlas`, `manifest`, settings); **never** `engine/reducer` or `ai/*` directly (types allowed) | `boundary.test.ts` fails on `from "../engine/reducer"` / `from "../ai` inside `src/ui` |
| 7 app | `main.tsx`, `App.tsx`, `dev/` | anything | — |

`tsconfig.core.json` — folder includes plus the naming rule above, so nothing is listed file by file and a forgotten file cannot slip past the check:

```json
{ "extends": "./tsconfig.app.json",
  "compilerOptions": { "lib": ["ES2023"], "types": [], "noEmit": true },
  "include": ["src/engine", "src/ai", "src/render", "src/game", "src/settings", "src/audio", "src/assets"],
  "exclude": ["**/*.test.ts", "**/*.tsx", "**/use*.ts", "src/audio/WebAudio.ts", "src/assets/manifest.ts"] }
```

`exclude` only filters what `include` matched, and a file that an included file imports is still compiled — which is exactly right: if a PURE file ever imports `assets/manifest.ts`, tsc pulls it in and its `import … from "./cards/cards_atlas.png?url"` lines fail (no `vite/client` module declarations under `types: []`), so the leak is reported at the importer. The three plain-`.ts` hooks (`useGame.ts`, `useSettings.ts`, `useAudio.ts`) are excluded by the `use*` pattern; `render/` is pure-only, so nothing there is excluded.

Two traps this config sets on purpose, and where the plan routes around them: `import.meta.glob` and the `*.png`/`*.ogg` module declarations exist only in `vite/client`, so a PURE file must never import from `assets/manifest.ts` (that is why `names.ts` exists); `URLSearchParams` lives in `lib.dom`, so `?seed=` is parsed in `App.tsx`, not in `seeds.ts`.

The readability contract: **if a component contains an `if` about the rules of the game, it belongs in `selectors.ts`. If a reducer needs randomness or a sound, it belongs in `act()`.**

### 3.3 State management

One `useReducer` for the game, one for settings, `useState` for UI-only things (selection, open sheet, barks, doors, crash). No library.

```ts
// src/game/appReducer.ts (whole file)                                   PURE
import { type Action, deal, reduce, DEFAULT_SEATS } from "../engine/reducer";   // reducer.ts:25-30, :45, :102, :38
import type { GameState } from "../engine/state";                               // state.ts:31 — reducer.ts does NOT re-export it (reducer.ts:23)
import type { RuleConfig } from "../engine/rules";
import { clearPartitionCache } from "../ai";

export type AppState = { game: GameState | null; dealId: number };   // game === null <=> title screen
export const INITIAL: AppState = { game: null, dealId: 0 };
export type AppAction = Action | { type: "NEW_MATCH"; seed: number; rules: RuleConfig } | { type: "QUIT" };

export function appReduce(s: AppState, a: AppAction): AppState {
  switch (a.type) {
    case "NEW_MATCH": clearPartitionCache();                                   // ENGINE.md:112-113
                      return { game: deal(a.seed, a.rules, DEFAULT_SEATS), dealId: s.dealId + 1 };   // reducer.ts:45-52
    case "QUIT":      return { game: null, dealId: s.dealId };
    case "DEAL":      return s;                                                // never used by the app (no phase guard in the engine, reducer.ts:104-107)
    case "NEXT_ROUND":
      if (!s.game || s.game.phase !== "scored") return s;                      // engine has no guard (reducer.ts:174-183); a double-tap is a no-op
      return { game: reduce(s.game, a), dealId: s.dealId + 1 };
    case "SCORE_ROUND":
      if (!s.game || s.game.phase !== "roundover") return s;                   // reducer.ts:166 would throw
      return { ...s, game: reduce(s.game, a) };
    default:                                                                   // PLAY / PASS: engine-illegal moves STAY loud (reducer.ts:110-123, 143-145)
      if (!s.game) return s;
      return { ...s, game: reduce(s.game, a) };
  }
}

/** The ONE place an engine throw is caught. Pure, so it is unit-tested directly (GameProvider.test.ts, §6). */
export type CrashReport = { error: Error; action: AppAction } & GameLog;      // GameLog from selectors.ts: seed, rules, round, leader, totals, history, final
export function tryReduce(s: AppState, a: AppAction): { next: AppState; crash?: undefined } | { next?: undefined; crash: CrashReport } {
  try { return { next: appReduce(s, a) }; }
  catch (e) { return { crash: { error: e as Error, action: a, ...gameLog(s.game!) } }; }   // reduce() is only reached with a game, so `s.game` is non-null here
}
```

Why no-op guards for app-level actions but throws for PLAY/PASS: "Next round" and "Score" can be double-tapped and must not unmount the tree; PLAY/PASS are gated by `legalMoves` (`H/src/ai/moves.ts:102-111`) and `canPass` (`P:831`), so a throw there is a real bug and must end up on screen with enough data to replay it.

**How a throw reaches the screen.** React error boundaries only catch errors thrown during render, lifecycle methods and constructors — never in event handlers or `setTimeout` callbacks — and every `act()` call happens in exactly those two places (a button handler, or the turn-loop timer). So the crash path does not use a boundary at all: `act()` calls `tryReduce`, and when it returns a `crash`, the provider stores it in state and **renders `<CrashScreen/>` instead of its children**. Same data, same buttons, no class component, no throw-in-render idiom, and no milestone where the rethrow exists without something to catch it:

```ts
// src/game/GameProvider.tsx (the interesting parts)                     HOOKS: react + setTimeout only; `audio` arrives as a prop
export function GameProvider({ audio, children }: { audio: AudioPort; children: ReactNode }) {
  const [state, dispatch] = useReducer(appReduce, INITIAL);
  const [selection, setSelection] = useState<Card[]>([]);
  const [crash, setCrash] = useState<CrashReport | null>(null);
  const aiRng = useRef<Rng>(() => Math.random());
  const barks = useBarks();                                                   // { list, show }; `show` keeps its identity for the provider's lifetime

  const act = useCallback((a: AppAction) => {
    const before = state.game;
    if (a.type === "NEW_MATCH" || a.type === "NEXT_ROUND") aiRng.current = aiRngFor(a.seed);   // reseed per deal
    const r = tryReduce(state, a);                                            // pure, so this pre-call is free
    if (r.crash) { setCrash(r.crash); return; }                               // nothing dispatched: `game` is unchanged, no timer is re-armed
    dispatch(a);
    if (a.type === "PLAY" || a.type === "PASS" || a.type === "NEW_MATCH" || a.type === "NEXT_ROUND") setSelection([]);
    try {                                                                     // the cosmetic layer: a throw here must ALSO reach the screen,
      const cue = cueFor(before, a, r.next.game);                             // not die silently in a click handler / timer callback
      for (const e of cue.sfx) audio.play(e);
      if (cue.bark && Math.random() < BARK_CHANCE) barks.show(cue.bark.seat, cue.bark.kind);   // Math.random, never aiRng; cue.bark is AI-only (§3.4)
    } catch (e) { setCrash({ error: e as Error, action: a, ...gameLog(before ?? r.next.game!) }); }
  }, [state, audio, barks.show]);                                             // barks.show, not barks: a new bark must not recreate act()

  const actAi = useCallback((seat: number, difficulty: Difficulty) => {         // the rng ref never leaves the provider
    if (state.game) act(aiTurn(state.game, seat, aiRng.current, difficulty));
  }, [state.game, act]);

  const toggleCard = useCallback((v: Card) => {
    const g = state.game;
    if (!g || g.phase !== "playing" || g.turn !== 0) return;                   // P:818-819: taps during AI turns / roundover do nothing, no sound
    setSelection(s => s.includes(v) ? s.filter(c => c !== v) : [...s, v]);
    audio.play("select");                                                      // P:821
  }, [state.game, audio]);

  if (crash) return <CrashScreen report={crash} onReset={() => { setCrash(null); dispatch({ type: "QUIT" }); }} />;
  …
}
```

`ui/CrashScreen.tsx` (M1b) renders the `CrashReport` (seed, rules, round, leader, totals, the action that threw, and the history) with a "Copy game log" button and a "Saddle up" button; "Saddle up" clears `crash` and dispatches `QUIT`, i.e. the title screen (settings live in the outer `SettingsProvider` and survive). The copied log is the `GameLog` shape that `replayLog()` in `selectors.ts` rebuilds (see "Copied game log" below), so a bug report is one paste into a scratch test. `dev/DevHook.tsx` (DEV builds only) exposes `window.__tally = { act, game }` so the M1b gate can force an illegal PLAY from the console without editing code.

`ui/ErrorBoundary.tsx` (M6) is a separate, last-resort net for **render** bugs — a missing `PORTRAITS` key, an undefined sprite URL, a typo in a selector — which carry no `report`. It is \~15 lines, the only class component in the codebase (`getDerivedStateFromError` has no hook equivalent), and it always renders just `error.message` + "Saddle up" (reset its own state → remounts `GameProvider` at `INITIAL`). It never sees engine throws, because `tryReduce` has already turned those into a `CrashScreen`.

`appReduce` is pure, so calling it once more inside `act()` to learn `next` is free. StrictMode double-invokes reducers in dev; because sounds and barks live in `act()`, nothing fires twice.

Derived values (all from `selectors.ts`; `legal` is `useMemo` on `[game]` **only** — it never reads the selection, and it is a dependency of the turn-loop effect (§3.5), so memoizing it on the selection would re-arm the auto-pass timer on every card tap; the rest are `useMemo` on `[game, selection]`):

| Value | Definition | Source |
| --- | --- | --- |
| `legal` | `legalMoves(hand, lastPlay, rules, publicView(game, 0).need3D)` on the human's turn only | `moves.ts:102-111`; `ENGINE.md:95-96` |
| `exact` | the legal move whose cards equal the selection; Play enabled iff non-null | `P:829-830` |
| `live` | union of cards of every legal move containing the whole selection; others get `.dim` | `P:801-816` |
| `canPass` | `lastPlay !== null \|\| legal.length === 0` | `P:831`; passing on your own lead throws at `reducer.ts:145` |
| `status` | the exact strings of `P:836-842` via `copy.ts` |  |
| `sign` | plaque text from `describe(lastPlay)` (`combos.ts:81`), "Fresh lead", "Cards are down.", "Table's clear — N leads." | `P:872-886` |

In **M1a**, before `selectors.ts` exists, the provider computes `legal = legalMoves(hand, lastPlay, rules, need3D)` and `exact` inline (\~10 lines; Play enablement needs `exact`, the auto-pass branch of `useTurnLoop` needs `legal`), and `useGame()` returns `{ game, dealId, selection, legal, exact, act, actAi, toggleCard, audio }`. **M1b** moves those ten lines into `selectors.ts` and adds `live`, `canPass`, `status`, `sign`, `barks` and `crash` to the value.

**Copied game log.** `replay(seed, rules, actions)` (`reducer.ts:188-192`) always starts from `deal(seed, rules)`, i.e. round 1, `lastLeader = 0`, totals zero — so it cannot rebuild a round-2+ position, and `history` is `PlayRecord[]` (`state.ts:25-29`), not `Action[]`. `selectors.ts` therefore carries:

```ts
export type GameLog = { seed: number; rules: RuleConfig; round: number; leader: number; totals: number[]; history: PlayRecord[]; final: GameState };
export const historyToActions = (h: PlayRecord[]): Action[] => h.map(r => r.cards.length ? { type: "PLAY", player: r.by, cards: r.cards } : { type: "PASS", player: r.by });
export function gameLog(g: GameState): GameLog {           // `leader` = who led the round: the first record's author, or g.leader before any play
  return { seed: g.seed, rules: g.rules, round: g.round, leader: g.history[0]?.by ?? g.leader, totals: g.totals, history: g.history, final: g };
}
export function replayLog(log: GameLog): GameState {        // deal(seed, rules, seats, round, lastLeader, totals): reducer.ts:45-52, :62-65
  let g = deal(log.seed, log.rules, DEFAULT_SEATS, log.round, log.leader, log.totals);
  for (const a of historyToActions(log.history)) g = reduce(g, a);
  return g;
}
```

`totals` in the log are the deal-time totals as long as `phase !== "scored"` (SCORE\_ROUND is the only writer, `reducer.ts:169`); "Copy game log" is offered from the in-game menu and the crash screen, both of which exist only in `playing`/`roundover`, so that holds. `selectors.test.ts` asserts `JSON.stringify(replayLog(gameLog(g))) === JSON.stringify(g)` for a round-1 position and a round-2 position reached through `NEXT_ROUND` under each `laterRoundLead` value.

**Settings.** The shape is written down once, in `settings/settings.ts`, because eight of its fields are read across the plan and the prototype's blob is what a returning user already has in `localStorage`:

```ts
// src/settings/settings.ts                                             PURE
export type Opts = {
  difficulty: "easy" | "medium" | "hard";     // P:685 "medium"; labels Greenhorn / Regular / Card sharp (P:267)
  speed: "fast" | "normal" | "slow";          // P:685 "normal"; SPEED table in timing.ts
  music: boolean;                             // P:685 true;  "Saloon piano" (P:270) → music bus on/off
  sfx: boolean;                               // P:685 true;  "Card sounds" (P:271)  → sfx bus on/off
  autoPass: boolean;                          // P:685 true
  reduceMotion: boolean;                      // P:685 false
  sortBy: "rank" | "suit";                    // P:685 "rank"
  roundsPerMatch: 0 | 5 | 10;                 // NEW: 0 = Endless (the prototype's behaviour); see matchOver, §3.4
  volume: { music: number; sfx: number; ambience: number };   // NEW (M6 sliders): 0-1 multipliers over the sfxTable.ts constants; DEFAULT 1/1/1
};
export type Settings = { rules: RuleConfig; opts: Opts };
export const DEFAULTS: Settings = { rules: DEFAULT_RULES, opts: { difficulty: "medium", speed: "normal", music: true, sfx: true,
  autoPass: true, reduceMotion: false, sortBy: "rank", roundsPerMatch: 0, volume: { music: 1, sfx: 1, ambience: 1 } } };
export const KEY = "tallytwo.settings";                                          // P:1049 / P:1054
```

`parseSettings(raw)` merges `{ rules, opts }` field by field over `DEFAULTS` (unknown keys dropped, wrong types replaced), so an old or corrupt blob cannot break boot. In particular it **must accept the prototype's exact blob** — `{ rules: {...}, opts: { difficulty: "medium", speed: "normal", music: true, sfx: true, autoPass: true, reduceMotion: false, sortBy: "rank" } }` (`P:685`, saved by `saveOpts` at `P:1053-1055` under the same key) — and fill `roundsPerMatch` and `volume` from `DEFAULTS`; that blob is the "old shapes merge" fixture in `settings.test.ts`. The port is **async from day one** — `get(key): Promise<string | null>`, `set(key, value): Promise<void>` — because the RN replacement, `@react-native-async-storage/async-storage`, has an async API (`getItem`/`setItem` return promises), and the handoff targets an Expo managed app (`H/package.json:16` says to add the native deps with `npx expo install`; `BUILD-PLAN.md:10`: "Expo (managed), TypeScript, expo-router"); a synchronous MMKV port would need a development build, and that is a choice for the port, not something the handoff dictates. `SettingsProvider` starts from `DEFAULTS` and hydrates in an effect:

```ts
useEffect(() => { let live = true;
  storage.get(KEY).then(raw => { if (live) dispatch({ type: "HYDRATE", settings: parseSettings(raw) }); });
  return () => { live = false; }; }, [storage]);
```

and exposes `loaded`; `TitleScreen` renders its controls only once `loaded` is true, so a switch never flips under the user's thumb. On the web `platform/webStorage.ts` is `localStorage` wrapped in `Promise.resolve` inside `try/catch`, so hydration resolves in the same tick. **Rules are read at NEW\_MATCH only** — they live inside `GameState` (`state.ts:35`) and `NEXT_ROUND` reuses `state.rules` (`reducer.ts:180`). The sheet says "Rule changes apply to the next game". (The prototype's live mutation at `P:1258-1267` only half-works: `forced3D` is fixed at deal.)

AI rng: seeded `mulberry32(seed ^ 0x9e3779b9)` (`sim.mjs:24`) in a `useRef`, reseeded on every deal, so a game replays from its seed alone AND from seed + history (`reducer.ts:10-13`). Cosmetics (barks, think time, jitter) use `Math.random`, because any extra consumer of the AI rng changes AI decisions (rng call counts differ per path: easy 3, medium 1-3, hard 0-2). The ref is private to the provider: `useTurnLoop` calls `actAi(seat, difficulty)`, `hintFor` uses `Math.random` (§3.5), and nothing else needs it.

**Reference stability** (the thing a learner cannot debug by reading): every value in an effect's dependency array must keep its identity between renders unless `game` changed. Concretely: `useBarks` returns `{ list, show }` with `show = useCallback((seat, kind) => …, [])` (it only calls `setList` with a functional update and arms one `setTimeout` per bark for `BARK_MS`), and `act` depends on `barks.show`, not `barks` — otherwise every bark expiry would recreate `act` → `actAi` → the turn-loop effect, which would clear and re-arm a pending AI timer mid-think. `legal` is memoized on `[game]` for the same reason (above). The `audio` prop is created once in `App.tsx` with `useMemo`.

### 3.4 Data flow: engine → store → components

```
tap Card ──► toggleCard(v) ──► (ignored unless phase "playing" and turn 0, P:818-819) ──► selection (useState)
                                   │
                    selectors.ts (useMemo): legal [game], exact / live / canPass / status / sign [game, selection]
                                   │
Controls onPlay ──► act({type:"PLAY", player:0, cards: exact.cards})     <- only ever a Combo that came from legalMoves
                                   │
                      tryReduce ──► appReduce ──► engine.reduce ──► new GameState (fresh object, reducer.ts:94-100)
                                   │                  (throws → { crash } → setCrash → provider renders <CrashScreen/>, §3.3)
        ┌──────────────────────────┼──────────────────────────────┐
   context value changes      cueFor(before, a, next)        useTurnLoop effect re-runs
   Seats / Felt / Pile /      -> audio.play(...)             (game changed) -> ONE timer:
   Hand / Status / TopBar     -> barks.show(...) (AI only)   AI think | auto-pass | roundover->SCORE_ROUND
   re-render from `game`                                              │
                                                                      ▼
                                    phase "scored", !matchOver -> <ResultsPoster/> -> "Next round": act(NEXT_ROUND{seed:newSeed(round+1)})
                                                                                      "Saddle up":  act(QUIT)
                                    phase "scored",  matchOver -> <ResultsPoster final/> -> "New match": act(NEW_MATCH{seed:newSeed(1), rules})
                                                                                            "Saddle up":  act(QUIT)
                                    any time      -> Menu (SettingsSheet) -> "Quit game": act(QUIT)   (P:277, P:1251, quitToTitle P:1038-1044)
                                    useAudio: musicFor(game, sheet) / tensionFor(game) -> audio.setMusic / setTension   (§3.7; no screen owns playback)
```

`act(QUIT)` sets `game` to `null`; the `useTurnLoop` effect's cleanup clears the pending AI timer on that change, so a quit during a think delay fires no further move, sound or bark.

**Match over** (the engine has no match concept, `state.ts:12, :31-51`; `DECISIONS.md:113-114` leaves the length open, so this is the plan's own definition, §8 q1):

```ts
// selectors.ts                                                         PURE
export const matchOver = (g: GameState, roundsPerMatch: number) =>            // roundsPerMatch comes from settings.opts, not from GameState
  g.phase === "scored" && roundsPerMatch > 0 && g.round >= roundsPerMatch;    // 0 = Endless: never true
export function matchWinner(g: GameState): number {                          // seat with the highest tally; tie → the seat that won the LAST round
  const best = Math.max(...g.totals);
  const tied = g.totals.flatMap((t, i) => t === best ? [i] : []);
  return tied.length === 1 ? tied[0] : tied.includes(g.turn) ? g.turn : tied[0];   // turn stays on the round winner after SCORE_ROUND (reducer.ts:134-137, :166-172)
}
```

The **round** poster (`P:994-1026`) shows the round winner: face = `wanted.png` for seat 0 else the portrait (`P:999`), name (`P:1001`), the reward line `$N reward for an empty hand` (`P:1002-1004`), the Player/Cards/Round/Tally table (`P:1007-1018`), buttons Next round / Saddle up (`P:1020-1025`). The **final** poster (`matchOver(game, opts.roundsPerMatch)`) reuses the component with `final`: heading "FINAL TALLY" instead of "WANTED"; face/name = `matchWinner(game)` (not the round winner); the reward line replaced by `$N over M rounds` (`N = totals[winner]`, `M = game.round`); the same table with rows **sorted by tally, descending**; buttons **"New match"** — the same handler as the title's Deal me in, `act({ type: "NEW_MATCH", seed: newSeed(1), rules: settings.rules })`, doors stay open — and **"Saddle up"** (`QUIT`); "Next round" is not rendered. `selectors.test.ts` covers `matchOver` for Endless / 5 / 10 (`round 5, scored` → false / true / false) and `matchWinner` for a clear leader and a tie.

`cueFor(before, action, next)` table (unit-tested). **Barks are AI-only**: `bark` is set only when `before.players[action.player].kind === "ai"` (the prototype's guard is `P:890` `if(pi === 0) return;`); seat 0 has no personality (`reducer.ts:39`, `state.ts:18-19`) and no bark lines, so a human round win — the most common end-of-round path — yields `bark: undefined`. `useBarks.show` guards a second time and returns if the seat has no personality.

| action | condition | sfx | bark |
| --- | --- | --- | --- |
| PLAY | `cards.length >= 5` | `playFive` (`P:939, 962`) | `{seat, "play"}` if AI |
| PLAY | 1-3 cards | `playSmall` (ducks, `P:366`) | same |
| PLAY | `next.phase === "roundover"` | + `roundWin` (`P:992`, ducks) | `{seat, "win"}` if AI; **undefined for the human** |
| PASS | `before.lastPlay !== null && next.lastPlay === null` (trick cleared; read from the engine's outcome, `reducer.ts:152-160`) | `trickClear` (`P:947, 975`) | `{seat, "pass"}` if AI |
| PASS | otherwise | `pass` | same |
| NEW\_MATCH / NEXT\_ROUND | — | `dealRoll` (`P:1035`) | — |
| (toggleCard) | only when the guard above passes | `select` (`P:821`) | — |

`cues.test.ts` has one row per line above plus the explicit human case: human PLAY that ends the round → `sfx` is `[playSmall | playFive, roundWin]`, `bark` is `undefined`.

### 3.5 AI turn loop with think delays

```ts
// src/game/useTurnLoop.ts — copied unchanged to RN later                HOOKS
// INVARIANT: every value in the deps array below must keep its identity between renders unless `game` changed.
// (act/actAi depend on state + barks.show + audio; legal is memoized on [game]; opts.* are primitives.) A value that
// changes identity for any other reason clears and re-arms the pending timer, which looks like "the AI hesitates".
export function useTurnLoop(paused: boolean) {                 // paused = usePageVisibility() || useLandscapeShort(), computed in App.tsx; keeps `document` out of here
  const { game, legal, act, actAi } = useGame();
  const { opts } = useSettings();
  const clamp = (ms: number) => clampMotion(ms, opts.reduceMotion);           // min(ms, 260)  P:921

  useEffect(() => {
    if (!game || paused) return;                                              // no timers in a hidden tab or under the landscape overlay; re-runs on `paused`
    if (game.phase === "roundover") {                                         // turn stays on the winner (reducer.ts:134-137)
      const t = setTimeout(() => act({ type: "SCORE_ROUND" }),
        clamp(game.turn === 0 ? ROUND_OVER_MS.human : ROUND_OVER_MS.ai));     // P:965 / P:942
      return () => clearTimeout(t);
    }
    if (game.phase !== "playing") return;
    const seat = game.turn, p = game.players[seat];
    if (p.kind === "human") {
      if (!opts.autoPass || !game.lastPlay || legal.length) return;
      const t = setTimeout(() => act({ type: "PASS", player: 0 }), clamp(AUTO_PASS_MS));   // P:928
      return () => clearTimeout(t);
    }
    const extra = game.history.length === 0 ? FIRST_STEP_MS : 0;                            // P:1036
    const t = setTimeout(() => {
      actAi(seat, opts.difficulty);   // chooseMove runs INSIDE the timeout, inside the provider: StrictMode's mount/cleanup/mount never consumes rng twice
    }, clamp(thinkMs(opts.speed, Math.random()) + extra));                                  // P:916-920
    return () => clearTimeout(t);
  }, [game, legal, paused, opts.autoPass, opts.speed, opts.difficulty, opts.reduceMotion, act, actAi]);
}
```

`src/game/timing.ts` holds every number (all from `P`):

| Constant | Value | `P` line |
| --- | --- | --- |
| `SPEED` | `{fast:[280,520], normal:[650,1250], slow:[1100,1900]}` ms, uniform | 916 |
| `clampMotion` | `min(ms, 260)` when reduce motion | 921 |
| `AUTO_PASS_MS` | 850 | 928 |
| `ROUND_OVER_MS` | `{ai: 900, human: 800}` | 942, 965 |
| `FIRST_STEP_MS` | 700 | 1036 |
| `DOORS_MS` | `{normal: 620, reduced: 60}` | 1227 |
| `NUDGE_MS` | 170 | 941 |
| `DEAL_STAGGER_MS` | 32 per card | 774 |
| `SLAP_STAGGER_MS` | 40 per card | 882 |
| `BARK_MS` / `BARK_CHANCE` | 2000 / 0.55 | 893-898 |

Invariants (written as comments in the file): the effect depends on the `game` object, so each turn re-runs with exactly the state the AI must act on (no stale dispatch → no throw); every branch returns `clearTimeout` (the prototype's single `S.timer`, `P:921`); `aiTurn` returns PASS only when following (`choose.ts:42, :80-86`); `chooseMove` is synchronous, worst case 0.9 ms — no worker; a crash inside `actAi` leaves `game` unchanged, so no timer is re-armed and the crash screen is the only thing that happens (§3.3). `hintFor(game, Math.random)` = `chooseMove` with `PERSONALITIES.marshal` at `"medium"`, fallback `legal[0]` (`P:1236-1243`).

### 3.6 Rendering and crispness on the web

DOM/CSS sprites, no canvas. Card rule (`styles/cards.css`, from `P:135-143` with size and image source changed):

```css
.card { width: var(--cw); height: var(--ch);                    /* --cw: 96px; --ch: 128px  (tokens.css) */
        background-image: image-set(url(atlas.png) 1x, url(atlas@2x.png) 2x, url(atlas@3x.png) 3x);
        background-repeat: no-repeat; background-size: calc(var(--cw) * 13) calc(var(--ch) * 4);
        background-position: calc(var(--col) * var(--cw) * -1) calc(var(--row) * var(--ch) * -1);
        image-rendering: pixelated; border-radius: 3px; overflow: hidden; }
```

- `--col = ATLAS_COL[rank(v)]`, `--row = ATLAS_ROW[suit(v)]` (`atlas.ts:15, 18`; same tables as `P:337-339`).
- **DPR**: at dpr 2/3 the browser blits a pre-upscaled atlas 1:1 into device pixels, no resampling at all (`@2x`/`@3x` are exact nearest upscales, `SKIA-SPIKE.md:164`). `pixelated` is the fallback for fractional desktop dpr (accepted softness; iPhone Safari is the only promised target).
- **Integer scale / rest pose** (from `CardFan.tsx:61-66`, `PlainImageFan.tsx:57-59, 84-88`): only `transform: translate()` with integer CSS px at rest; `rotate(0)` at rest; animations may pass through fractional values but end on the integer pose; never `transform: scale()` on an ancestor; size elements directly. The prototype's resting `rotate(t*2.4deg)` and fractional `step`/`x0` (`P:791-798`) are the one thing NOT copied.
- **Fan**: `fanLayout(13, availW)` with the hand strip at `padding: 0 8px` → step 22 / span 360 on every phone ≥ 376 CSS px; on the 375-px SE `availW = 359` → step 21, span 348 (still above the 20-px corner index, `scale.ts:106`). `fanLayout.test.ts` pins `step === 22` at 360.
- **Other sprites at integer multiples**: wood tile 96 px (`P:30`), felt tile 32 px (`P:113`), portraits 64 CSS px (the sprites are 64x64; the prototype's 46 px at `P:92` is rejected), poster face 61x71, seat back chips as CSS rectangles (`P:97`).
- **Pile**: `S_small = max(1, dpr - 1)` → `--cw-small = calc(96px * S_small / dpr)` = 48 CSS px on dpr 2, 64 on dpr 3 — both integer device scales. `--dpr` is set on `:root` by `platform/useDevice.ts`. The pile is the first thing that shrinks; the hand never does.
- **iPhone SE vertical budget** (375x667, dpr 2), computed from the prototype's own numbers at 96-px cards: topbar \~40 (`P:79`) + seats 124 (`P:87, 92`, with 64-px portraits) + felt min 126 (`P:125`) + hand 150 (`P:149`) + status 22 (`P:156`) + controls \~58 (`P:160`) = **520 of 667**. This is a calculation; M2's gate screenshots it. Fallback order if it fails: pile `S_small` (already), portraits 32 px under `@media (max-height: 700px)`, shorter sign; never a fractional hand scale.
- **`responsive.css`, specified**: (a) `@media (max-height: 700px)` — portrait short-screen rules: portraits 32 px, sign one line, pile at `S_small`; that is the whole fallback list above, written down. (b) `@media (orientation: landscape) and (max-height: 500px)` — the browser cannot lock orientation and iPhone landscape heights are 375-430 CSS px, which the \~490 px the column needs even after (a) cannot fit (`DECISIONS.md:121`: no landscape layout, on purpose). `ui/Overlay.tsx` covers the table with "Turn your phone to play"; `platform/useLandscapeShort.ts` (`matchMedia`) feeds the same boolean into `paused` in `App.tsx`, so no AI move fires under the overlay and play resumes on rotate-back. Nothing else changes in landscape.
- **Layout**: game root is a phone column, `max-width: 440px` (largest iPhone, `SKIA-SPIKE.md:31`), centred on desktop, `min-height: 100dvh`, safe-area padding on topbar and controls (`P:79, 160`); `touch-action: manipulation; user-select: none` (`P:33`). `useDevice` measures the column, not the window. Fonts: `@fontsource/rye` self-hosted for `.western` (`P:35`) — no FOUT on a cold cache, and it is a hard requirement if the answer to §8 q6 is offline (the Google Fonts link at `P:2-4` cannot be precached); slot `ui-font-rye` has no candidate (`AD:252`).
- **Verification tooling**: `dev/Spike.tsx` shows dpr/S, a checker tile (`sprites/checker.png` at `background-size: 32px`, pixelated) plus a twin shifted `translateX(calc(0.5px / var(--dpr)))` — top crisp + twin grey = correct (`SpikeScreen.tsx:97-98`). `atlas.test.ts` asserts `spriteFor(0)` = (192,0) 3♦, `spriteFor(51)` = (96,128) 2♠, `spriteFor(45)` = (0,384) A♣.

### 3.7 Audio module

Decision: **Web Audio from the first audio milestone**, never `HTMLAudioElement` pools. iOS Safari ignores `HTMLMediaElement.volume`, so the prototype's gains and ducking (`P:343`, `P:368-373`) never worked on the target; `playbackRate` on media elements is pitch-preserving, so `P:363` is tempo jitter, not pitch.

Spec, pure, in `src/audio/sfxTable.ts` + `pool.ts` (tested):

| SfxEvent | slot | files wired (all KEPT, `H/assets/audio/sfx`) | gain (`P:343`) | ducks |
| --- | --- | --- | --- | --- |
| `shuffle` | sfx-shuffle | DeckShuffle01/04/05 | .65 | no |
| `deal` | sfx-deal | CardMoveFast01/03/05/06/07/08/09 | .42 | no |
| `select` | sfx-select | CardGrab03/04 | .30 | no |
| `playSmall` | sfx-play-small | CardSlapFast01/03/04/05/07/09 | .80 | yes (`P:366`) |
| `playFive` | sfx-play-five | CardGenericMovesLong05/06/07 — rank-1 `CardSlide*` and rank-2 `CardSlideMultiple01` are all quarantined (`AD:180-187`); the only rank-3 survivor `CardGrabSlideLong06` is a single file, which defeats round-robin. Flagged in `docs/ASSETS.md`. | .55 | no |
| `pass` | sfx-pass | CardGrabSlide01/02/03/04/05/06/07/11/13 | .45 | no |
| `trickClear` | sfx-trick-clear | CardsFalling01/05 | .60 | no |
| `roundWin` | sfx-round-win | CardsImpact01 | .85 | yes |

- **Pools / round-robin**: `pickVariant(n, last, rand)`: random index, `(i+1)%n` if it equals `last` and `n > 1` (`P:358-360`); test: 1000 draws never return `last`. `play()` never calls it with `n === 0` (see failure contract).
- **Pitch jitter**: `AudioBufferSourceNode.playbackRate.value = 1 + (Math.random()*2-1)*0.04` (true pitch, ±4%, `ASSET-MAP.md:83`).
- **Deal roll**: `shuffle` at 0 then four `deal` ticks at 260 + k\*110 ms (`P:386-390`).
- **Music cues**: table = ost\_1 at 0.30 (`P:381`; 119.081 s loop, `manifest.json:1749-1756`); tension = ost\_3 crossfaded over 2 s when `min(counts) <= 3` (same threshold as `.low`, `P:850`; `ASSET-MAP.md:77`); results and how-to = ost\_4 (ost\_5 quarantined, `AD:141`); title = silent (ost\_2 quarantined, `AD:140`, and nothing can play before a gesture); ambience = CardsMovingLoop03 at -14 dB on its own bus (`manifest.json:1617-1618`).
- **Who decides what plays — one file, `audio/useAudio.ts` (HOOKS)**, called once from `Screens` in `App.tsx` with `{ sheet, paused }`. No screen or sheet owns playback (a `ui/` component has no path to the port other than `useGame().audio`, and must not start tracks on mount). The decision is a pure selector, tested in `selectors.test.ts`:

  ```ts
  export type MusicTrack = "table" | "tension" | "results" | null;
  export const musicFor = (g: GameState | null, sheet: Sheet): MusicTrack =>
    sheet === "howto" ? "results" : g === null ? null : g.phase === "scored" ? "results" : "table";   // "tension" is layered, not a track switch:
  export const tensionFor = (g: GameState | null) => !!g && g.phase === "playing" && Math.min(...g.players.map(p => p.hand.length)) <= TENSION_THRESHOLD;
  ```

  and `useAudio` is three effects: `audio.setMusic(opts.music ? musicFor(game, sheet) : null)` on `[game?.phase, game === null, sheet, opts.music]`; `audio.setTension(tensionFor(game))` on `[game]`; `audio.setBus("music" | "sfx" | "ambience", on ? volume : 0)` on the settings; plus `paused ? audio.suspend() : audio.resume()`. Cue-level sounds (`play`, `dealRoll`, `select`) stay in `act()`/`toggleCard` (§3.3) because they are per-action, not per-state.
- **`setMusic` is desired-state, not fire-and-forget** (`port.ts` doc comment; logic in `audio/musicLatch.ts`, PURE, tested): the port stores `wanted`; when the track's decode promise resolves, it starts the loop **iff `wanted === track`** at that moment; `setMusic(null)` or a different track before the decode lands cancels the pending start; calling `setMusic("results")` twice while decoding starts it once. This matters because music (7.6 MB) decodes lazily, and the first `setMusic("results")` — How to play on a fresh cache — lands seconds before the 2.25 MB ost\_4 buffer exists. `music.test.ts` drives `createMusicLatch()` with a fake decoder: want-before-decode starts exactly once after decode; want then `null` then decode starts nothing; decode of a track nobody wants starts nothing.
- **Ducking**: `setTargetAtTime(.12, now, .02)`, restore to .30 after 300 ms unless re-ducked within 280 ms (`P:368-373`); only `playSmall` and `roundWin` duck (`P:366`).
- **Buses**: three `GainNode`s (music, sfx, ambience; `BUILD-PLAN.md:92`); the prototype's two switches (`P:270` Saloon piano, `P:271` Card sounds) set a bus to 0; the M6 sliders multiply in (`opts.volume`, §3.3).
- **Loops**: `source.loop = true` with `loopEnd` from manifest durations (sample-accurate; `BUILD-PLAN.md:97-99`).
- **Lifecycle / the iOS unlock**: any trusted click unlocks iOS Safari, and the title screen has three of them — Deal me in (`P:1220`), How to play (`P:226`, handler `P:1249`) and Settings (`P:227`, handler `P:1248`). `audio.init()` is called from **all three**, because How to play is reachable only from the title (the in-game menu at `P:275-279` has Engine tests / Quit game / Back to table, no how-to) and the Saloon piano / Card sounds switches on the title Settings sheet should be auditionable. SFX (\~0.4 MB, the 33 files above: 375,810 bytes summed with `ls -l`) decoded eagerly, music (\~7.6 MB: ost\_1 3.02 MB, ost\_3 2.33 MB, ost\_4 2.25 MB) lazily via `fetch` + `decodeAudioData`; `suspend()/resume()` on `visibilitychange` (`P:1271-1274`, which the prototype does as `musicStop`/`musicStart`).
- **Interruptions are not only tab switches.** On iOS Safari a phone call, Siri or the lock screen moves the `AudioContext` to `"interrupted"`, and a `resume()` issued from a non-gesture callback can leave it not running — a silent game with no error. So `WebAudio.play()` and `WebAudio.resume()` both call `ctx.resume()` whenever `ctx.state !== "running"` (cheap, idempotent), and `App.tsx` installs one `document.addEventListener("pointerdown", () => audio.resume())` so the next tap anywhere is the gesture Safari wants. M5 gate 9 locks the phone mid-round to prove it.
- **Failure contract** (`port.ts`, written as the interface's doc comment): `init(): Promise<void>` **never rejects and is never awaited by the UI** — the Deal handler calls it fire-and-forget, then does doors + NEW\_MATCH regardless. `WebAudio.ts` decodes with `Promise.allSettled`, drops the failed buffers, logs one `console.warn` per failed file, and `play()` is a no-op for an event whose pool is empty or before `init()` resolved (`setMusic` is the exception: it is latched, above). A device that cannot decode the format, a 404 after a cache miss or a corrupt file therefore gives a silent event, never a stalled deal.
- **Safari/OGG**: every kept file is `.ogg` (`AD:70-118`), MP3 masters dropped (`manifest.json:9`). The go/no-go is **step -1, today** (§5): a 10-line `H/assets/audio/probe.html` that `fetch`es one SFX and ost\_1 and calls `decodeAudioData` on each, printing ok/fail, served from that folder with `python3 -m http.server 8000` (this Mac has `/opt/homebrew/bin/python3`, 3.13.5) and opened on the iPhone. If it fails, the answer is fixed before any audio name is written: `ffmpeg -i in.ogg -c:a aac -b:a 160k out.m4a` for the 36 wired files (`/opt/homebrew/bin/ffmpeg` is installed, §8 q5), `loopEnd` from the manifest durations (119.081 / 107.714 / 103.109 s), and `names.ts`/`sfxTable.ts`/`manifest.ts` are written with `.m4a` from the start in M5 — nothing is renamed later, because M5 is the first milestone that names an audio file.

### 3.8 Asset pipeline

0. **Step -1a — done 2026-09-22**: `H/assets/proto/` holds the six sprites (`wood, felt, p_marshal, p_outlaw, p_gambler, wanted`). Recovery recipe, to be recorded in `docs/ASSETS.md`: the same six images are the data-URI values under the `AST.img` object at `P:326`, already cropped and normalised (`ASSET-MAP.md:57-59`), so recovery is a base64 decode of each value, never a re-crop from the tilesets. Step -1b (the Ogg probe, §3.7) is still to run.
1. **M2, first visual deliverable**: copy `H/assets/proto/{wood,felt,p_marshal,p_outlaw,p_gambler,wanted}.png` → `src/assets/sprites/`. A missing file is a **Vite build error** (explicit imports, step 3); `manifest.test.ts` additionally checks every URL is a non-empty string.
2. Copy `H/assets/cards/*` (6 PNGs, `AD:119-124`) in M0 (the `Card` component needs the atlas on day one), `H/assets/checker.png` (`AD:125`) in M2, and in M5 the 33 SFX named in §3.7 plus `H/assets/audio/music/{ost_1,ost_3,ost_4}*` (`AD:70-72`), in whichever extension step -1 decided. Do **not** copy the nine tileset sheets (source material for later crops; every `ui-*` 9-slice slot is `missing`, `AD:242-251`).
3. `src/assets/names.ts` (PURE): `export type AssetName = "cards_atlas" | "cards_atlas@2x" | … | "sfx_DeckShuffle01" | "music_ost_1"` (identifier-shaped, so each name is also a variable name) and `export type PortraitKey = "p_marshal" | "p_outlaw" | "p_gambler"`. `src/assets/manifest.ts` (WEB) is an **explicit import table**, one line per asset:

   ```ts
   import cards_atlas from "./cards/cards_atlas.png?url";
   import sfx_DeckShuffle01 from "./sfx/SFX_DeckShuffle01.ogg?url";
   …                                                                    // ~45 lines, one per AssetName
   export const MANIFEST = { cards_atlas, sfx_DeckShuffle01, … } satisfies Record<AssetName, string>;
   export const PORTRAITS: Record<PortraitKey, AssetName> = { p_marshal: "p_marshal", p_outlaw: "p_outlaw", p_gambler: "p_gambler" };
   if (import.meta.env.DEV) for (const k of Object.keys(MANIFEST)) if (!MANIFEST[k as AssetName]) throw new Error(`asset ${k} resolved to nothing`);
   ```

   This is the form that actually fails at build time: a missing or misspelled **file** is a Vite resolve error (`npm run build` and `npm run dev` both stop), and a missing or misspelled **key** is TS2741 against `Record<AssetName, string>`. The `import.meta.glob` form the plan first considered cannot do this — Vite types an eager `?url` glob as `Record<string, string>` (`vite/types/importGlob.d.ts:75-96`, overload 1A), which is assignable to `Record<AssetName, string>` whatever the directory contains, so `glob satisfies Record<AssetName, string>` passes with zero PNGs on disk (verified with the installed TS 6/7 + Vite 8: `SP/satprobe/b.ts`, `SP/satcheck/src/manifest-glob.ts`), and its keys are paths (`"./sfx/SFX_DeckShuffle01.ogg"`), not names, so it would need a remap on top. The explicit table also mirrors the RN `require()` table in §7 one-to-one and is readable for a learner. The DEV guard on the last line makes the M2 gate surface a bad URL on `npm run dev`, not only under `npm test`. `getPersonality.ts` narrows `Personality.portrait` (a `string`, `personalities.ts:16`) to `PortraitKey` with a runtime check, and `manifest.test.ts` asserts `for (const p of Object.values(PERSONALITIES)) expect(p.portrait in PORTRAITS).toBe(true)`, so a misspelled portrait key fails a test instead of drawing a blank seat. Vite emits hashed URLs; `.ogg`/`.m4a`/`.png` are static assets by default. `names.ts` is needed regardless, because `sfxTable.ts` is PURE and cannot import from `manifest.ts`.
4. CSS vars `--wood`, `--felt-tex`, `--cardback` are set once on `:root` in `App.tsx` from `MANIFEST` (the prototype's own trick, `P:328-334`); the atlas is referenced from `cards.css` directly.
5. `docs/ASSETS.md` lists all 47 slots with the file actually wired / substitute / none (§4). `H/README.md:58` and `manifest.json:1745` counts are stale; ASSETS.md is the truth for this build.

### 3.9 `package.json` scripts

| Script | Command |
| --- | --- |
| `dev` | `vite --host` |
| `build` | `tsc -b && vite build` |
| `preview` | `vite preview --host` |
| `lint` | `oxlint` (template; `react/rules-of-hooks` is the one lint a React learner wants) |
| `test` / `test:watch` | `vitest run` / `vitest` |
| `typecheck` | `tsc -b --noEmit && tsc -p tsconfig.core.json --noEmit` |
| `sim` | `node --experimental-strip-types --import ./scripts/register-resolver.mjs scripts/sim.mjs` (Node 22.17.1 needs the flag — verified; the template's `erasableSyntaxOnly` is what keeps the copied files honest under `--experimental-strip-types`) |
| `check` | `npm run typecheck && npm run lint && npm test && npm run sim -- 300 && vite build` |

`npm install -D vitest` installs Vitest 5.0.1, whose peer deps (`vite ^6.4 || ^7 || ^8`, `@types/node ^22 || >=24`, from `npm view`) are already satisfied by the template's `vite ^8.3.0` and `@types/node ^24`.

## 4. Slot wiring table (47 slots, `AD:208-255`)

Rule: rank-1 candidate unless quarantined, then the next kept candidate (`AD:6`). Column "web" = what this build wires by default; **deferred** = kept candidate exists but the web build uses the prototype's CSS/behaviour instead; **nothing** = no kept candidate.

| # | slot | `AD` line | web build wires | status |
| --- | --- | --- | --- | --- |
| 1 | sfx-shuffle | 209 | DeckShuffle 01/04/05 | wired M5 |
| 2 | sfx-deal | 210 | CardMoveFast 01/03/05/06/07/08/09 | wired M5 |
| 3 | sfx-select | 211 | CardGrab 03/04 | wired M5 |
| 4 | sfx-play-small | 212 | CardSlapFast 01/03/04/05/07/09 | wired M5 |
| 5 | sfx-play-five | 213 | CardGenericMovesLong 05/06/07 (ranks 1-2 gone) | wired M5, **flagged** |
| 6 | sfx-pass | 214 | CardGrabSlide 01-07/11/13 | wired M5 |
| 7 | sfx-trick-clear | 215 | CardsFalling 01/05 | wired M5 |
| 8 | sfx-round-win | 216 | CardsImpact01 | wired M5 |
| 9 | sfx-reserve-pool | 217 | — (CardGenericMove 01/03/06/08/10 kept, unused) | deferred |
| 10 | ambience-saloon | 218 | CardsMovingLoop03 @ -14 dB | wired M6 |
| 11 | music-table | 219 | ost\_1 | wired M5 |
| 12 | music-title | 220 | — (ost\_2 gone, ost\_5 gone; title is silent before the first gesture anyway) | **nothing** |
| 13 | music-tension | 221 | ost\_3 | wired M6 |
| 14 | music-results | 222 | ost\_4 | wired M6 |
| 15 | music-howto | 223 | ost\_4 (ost\_5 gone); playable because `init()` runs from the How to play button too and `setMusic` is latched (§3.7) | wired M6 |
| 16 | persona-marshal-idle | 224 | `sprites/p_marshal.png` (from B-4) | wired M2 |
| 17 | persona-outlaw-idle | 225 | `sprites/p_outlaw.png` (from B-6) | wired M2 |
| 18 | persona-gambler-idle | 226 | `sprites/p_gambler.png` (from B-6) | wired M2 |
| 19-21 | persona-{marshal,outlaw,gambler}-states | 227-229 | — ; substitutes: active glow (`P:90`), red count ≤3 (`P:100`), dim at 0 (`P:91`), "passed" badge (`P:863`), barks | **nothing** |
| 22 | display-wood | 230 | `sprites/wood.png` (A4-Walls 0,0,96,96) | wired M2 |
| 23 | display-felt | 231 | `sprites/felt.png` (B-4-derived, synthesised) | wired M2 |
| 24 | display-wanted-poster | 232 | `sprites/wanted.png` (B-4) | wired M4 |
| 25 | display-title-backdrop | 233 | — (B-3 gone; B-7 kept, uncropped) | deferred |
| 26 | display-splash-screen | 234 | — (B-7 kept; web = PWA splash only) | deferred |
| 27 | display-saloon-doors | 235 | — (B-12 kept); CSS doors (`P:51-61`) | deferred |
| 28 | display-lamp-lighting | 236 | — (B-8 gone; B-6 kept) | deferred |
| 29 | display-signage | 237 | — (B-8 gone; B-11 kept); CSS sign (`P:119-124`) | deferred |
| 30 | display-scoreboard | 238 | — (B-8 gone; B-4 kept); CSS poster table | deferred |
| 31 | display-tally-icons | 239 | — (B-11 kept) | deferred |
| 32 | display-elimination-marker | 240 | — (no knockout mode exists) | deferred |
| 33 | settings-howto-frames | 241 | — (B-12 kept); CSS sheet (`P:166-167`) | deferred |
| 34 | ui-9slices | 242 | CSS | deferred |
| 35 | ui-button-9slice | 243 | CSS `.btn` (`P:66-75`) | deferred |
| 36 | ui-sheet-panel | 244 | CSS `.sheet` (`P:166-167`) | deferred |
| 37 | ui-opponent-panel | 245 | CSS `.opp` (`P:88-90`) | deferred |
| 38 | ui-felt-frame | 246 | CSS inset rim (`P:115`) | deferred |
| 39 | ui-bark-bubble | 247 | CSS `.bark` (`P:102-106`) | deferred |
| 40 | ui-form-controls | 248 | CSS `.sw`/`select` (`P:174-178`) | deferred |
| 41 | ui-volume-sliders | 249 | new CSS `<input type=range>` (not in the prototype); sheet art deferred | wired M6 |
| 42 | ui-menu-icon | 250 | "☰" text (`P:235`) | deferred |
| 43 | ui-app-icon | 251 | cut from B-11 in M6; plain PNG until then | wired M6 |
| 44 | ui-font-rye | 252 | `@fontsource/rye` (npm, OFL) — not an asset from the pack | **nothing** (substitute) |
| 45 | cards-faces | 253 | `cards/cards_atlas.png` + @2x + @3x | wired M0 |
| 46 | cards-back | 254 | `cards/card_back.png` + @2x + @3x (western reskin open, `DECISIONS.md:108-109`) | wired M2 |
| 47 | cards-reskin-source | 255 | — (`.pxo` gone; only the 52 PNGs in `Jorel's Card Pack/*` remain, `AD:9-60`) | **nothing** |

Summary: **23 wired by default** (M0-M6: slots 1-8, 10, 11, 13-18, 22-24, 41, 43, 45, 46), **18 deferred** (CSS or uncropped sheets: 9, 25-40, 42), **6 with nothing to wire** (12, 19, 20, 21, 44, 47). 23 + 18 + 6 = 47; `docs/ASSETS.md` carries the same three numbers.

## 5. Milestones

Sizes: S ≈ an evening, M ≈ a weekend, L ≈ a week of evenings. The first milestones are deliberately small: real cards on day one (M0, one evening, no tests written), the handoff's own tests moved in the next evening (M0b — ports, not tests of your own design), and a playable round (M1a) before you write the first test that is yours (M1b).

### Step -1 — Rescue the six proto sprites, and settle Ogg on iPhone (size: twenty minutes, today)

1. **Done 2026-09-22.** `ls -la "H/assets/proto"` shows the six files (wood 96x96, felt 32x32, three portraits 64x64, wanted 61x71). If the folder is ever lost, decode them again from `AST.img` at `P:326` (§3.8 step 0).
2. **The Ogg go/no-go**, which needs nothing from the Vite project: write `H/assets/audio/probe.html` (10 lines: on a button click, create an `AudioContext`, `fetch` `sfx/SFX_DeckShuffle01.ogg` and `music/ost_1_-_saloon_stare_down_loop.ogg`, `decodeAudioData` each, print `ok`/`fail` + the error for each), then `cd "H/assets/audio" && python3 -m http.server 8000` and open `http://<mac-ip>:8000/probe.html` on the iPhone (same Wi-Fi; `<mac-ip>` from System Settings › Wi-Fi). Both `ok` → Ogg stays and M5 is as written. Either `fail` → resolve §8 q5 now: `mkdir -p H/assets/audio/m4a && for f in <the 36 wired files>; do ffmpeg -i "$f" -c:a aac -b:a 160k "m4a/${f%.ogg}.m4a"; done` (`/opt/homebrew/bin/ffmpeg` is installed), re-run the probe on one `.m4a`, and M5 wires `.m4a` from its first line — `names.ts`'s audio names are first written in M5, so nothing else in the plan changes. Record the verdict in `docs/ASSETS.md` (M6) and keep `probe.html` next to the files.

### M0 — Scaffold, core moved in, three real cards on screen (size S)

**Goal**: a fresh Vite + React + TS project that type-checks the untouched engine and AI with and without the DOM lib, runs the handoff's sim gate, and draws the 3♦, the 2♠ and the A♣ from the real atlas — the visual twin of `atlas.test.ts` (M0b), so the atlas-axis bug (`atlas.ts:3-6`) is caught by eye on day one.

**Scope / files**:

1. `rm -rf "/Users/jordanboudreau/Desktop/Tally Two/tally-web"` (verified hello-world, nothing of ours in it), then from `/Users/jordanboudreau/Desktop/Tally Two`: `npm create vite@latest tally-web -- --template react-ts --no-immediate`. It still asks **"Which linter to use?"** — pick Oxlint (the default). (Without `--no-immediate` it also asks "Install with npm and start now?" — answer No; there is no rolldown prompt in create-vite 9.2.1, §2.) Then `cd tally-web && npm install && npm install -D vitest && npm install @fontsource/rye`. Pin exact versions in `package.json` after install (Vite 8 / React 19 / TS 6 are fresh majors).
2. Copy verbatim: `H/src/engine/*.ts` → `src/engine/`; `H/src/ai/*.ts` → `src/ai/`; `H/src/render/atlas.ts` → `src/render/`; `H/scripts/{sim,register-resolver,ts-resolve}.mjs` → `scripts/`; `H/assets/cards/*` (6 PNGs) → `src/assets/cards/`.
3. `tsconfig.core.json` (§3.2); `vite.config.ts` (`defineConfig` from `"vitest/config"`, §3.1); `package.json` scripts (§3.9).
4. `ui/Card.tsx` (\~30 lines: `<div className="card" style={{"--col": …, "--row": …}} aria-label={name}>`) + `styles/cards.css` (the §3.6 rule, \~20 lines) + `styles/tokens.css` (`--cw`/`--ch` only).
5. `index.html` doctype/viewport/title/apple-\* tags (§3.1). Delete the template's `src/App.css`, `src/index.css`, `src/assets/{hero.png,react.svg,vite.svg}`, `public/{favicon.svg,icons.svg}` and fix the favicon `<link>` in `index.html`; `App.tsx` renders a heading and `<Card value={0}/> <Card value={51}/> <Card value={45}/>`.

**Playable/visible at the end**: nothing playable; `npm run dev` shows three correct cards.

**Verification gate**:

- `npm run typecheck && npm run lint` exit 0 (no Vitest suites yet — `npm test` joins the gate in M0b).
- `npm run sim -- 200` prints `✓ legality and termination gates pass` (`sim.mjs:107`) — the CLI needs only `scripts/` + `src/engine` + `src/ai`.
- Negative check: add `console.log(window)` to `src/engine/cards.ts` → `npm run typecheck` fails with "Cannot find name 'window'"; revert.
- By eye: the three cards read 3♦, 2♠, A♣ left to right, and each card's `aria-label` matches the face drawn.

### M0b — Tests moved in (size S)

**Goal**: the handoff's 65 engine assertions and its sim gate run under Vitest, plus the three atlas rects; the AI helper files the store will need exist.

**Scope / files**: `src/ai/index.ts`, `src/ai/getPersonality.ts`, `src/ai/aiTurn.ts`; `src/engine/engine.test.ts` (port of `test-engine.mjs`, §6), `src/ai/sim.test.ts` (port of `playGame`/`run`, `sim.mjs:23-73`, plus the golden action list for seed 1000), `src/render/atlas.test.ts`.

**Verification gate**:

- `npm run typecheck && npm run lint && npm test` exit 0: 65 engine tests, sim test (200 games, 0 errors, 0 stalls), 3 atlas rects.
- `getPersonality(undefined)` throws (a one-line test); `getPersonality("marshal").portrait` is `"p_marshal"`.

### M1a — Ugly playable (size M)

**Goal**: a complete round against three AIs on a text-and-buttons table, using the real store.

**Scope / files**: `game/appReducer.ts` (with `tryReduce`, §3.3 — it needs `gameLog`, so `selectors.ts` starts life in M1a with that one 3-line function and `GameLog` type; the rest of the selectors arrive in M1b), `GameProvider.tsx` (`act`, `actAi`, `toggleCard`; **no crash state yet** — `act()` calls `tryReduce` and, if it returns `crash`, does `console.error(crash)` and returns; the `CrashScreen` arrives in M1b), `useGame.ts` returning `{ game, dealId, selection, legal, exact, act, actAi, toggleCard, audio }` with `legal`/`exact` computed inline in the provider (\~10 lines, §3.3), `useTurnLoop.ts`, `timing.ts`, `seeds.ts`; `?seed=N` parsed in `App.tsx`; a throwaway `TableScreen`: seats as text lines, pile as a row of `Card`s, your hand as a row of `Card`s that toggle on tap, Pass/Play buttons, a temporary "Deal" button dispatching NEW\_MATCH, a `<pre>` of round deltas and totals, "Next round". `audio` prop = a stub `AudioPort` whose `play` is `console.log` (the real one arrives in M5). Nothing is dimmed yet.

**Playable at the end**: yes — full rounds, scoring, next round.

**Verification gate**:

- `npm test` still green (no new suites yet).
- Manual checklist:
  1. Load `?seed=3` (seat 0 holds the 3♦ for seeds 3, 9, 14, 17 — hands are sorted ascending at `reducer.ts:60` and the 3♦ is value 0, `cards.ts:26`, so it is the leftmost card whenever you hold it; on other seeds it goes to whichever seat was dealt it, `reducer.ts:62-65`): the leftmost card of your hand is drawn as the **3 of diamonds**.
  2. Play is disabled until the selection includes 3♦ on your lead.
  3. AI seats play after a visible pause at each speed (fast/normal/slow via a temporary select).
  4. Three passes clear the table.
  5. A round ends; the `<pre>` deltas sum to zero (`scoring.ts:15-19`).
  6. Reload with the same `?seed=N` → identical deal and identical first three AI plays.

### M1b — Selectors, cues, crash screen, boundary tests (size M)

**Goal**: the rules-of-the-game `if`s leave the components, the store gets its tests, and an engine throw becomes a screen instead of a console line.

**Scope / files**: `selectors.ts` (including `gameLog`/`replayLog`, `matchOver`/`matchWinner`, `musicFor`/`tensionFor`), `cues.ts` (sfx logged to console; barks AI-only), `copy.ts`, `useBarks.ts` (`{ list, show }`, barks logged to console), the `crash` state in `GameProvider` + `ui/CrashScreen.tsx` (§3.3), `dev/DevHook.tsx`, `platform/usePageVisibility.ts`; Sort/Hint buttons and the status line on the throwaway table. Tests: `appReducer.test.ts`, `cues.test.ts`, `selectors.test.ts`, `timing.test.ts`, `boundary.test.ts`, `GameProvider.test.ts` (the `tryReduce` crash path, §6).

**Verification gate**:

- `npm test` green (the M0b suites plus the six new files, including `replayLog(gameLog(g))` round-trips, "illegal PLAY yields a `CrashReport` and leaves `game` unchanged", `matchOver` for Endless/5/10, and the human-win row of `cues.test.ts` with `bark` undefined).
- Manual checklist:
  1. Status reads "Your lead — it must include the 3♦." on your lead (`P:838`); "Table's clear — N leads." after three passes (`P:872`).
  2. DevTools console with StrictMode on: exactly one "dispatch" log per AI turn.
  3. Tapping hand cards during an AI think delay neither lifts them nor logs a `select` cue.
  4. On your lead, in the console: `__tally.act({ type: "PLAY", player: 0, cards: [51] })` → the `CrashScreen` shows the seed, the action and the history with "Copy game log"; paste the copied log into a scratch test as `replayLog(log)` → same throw on the same action; remove the test. "Saddle up" returns to the title.
  5. Win a round yourself (play `?seed=3` through, or shrink the AI hands from the console): the round ends with the `roundWin` cue logged and **no** bark logged and no error.

### M2 — Crisp table surface (size L)

**Goal**: the table looks like the prototype at 96-px cards and is pixel-crisp on iPhone.

**Scope / files**: copy `H/src/render/scale.ts` (edit the six comments at `:1`, `:4`, `:9`, `:18`, `:25`, `:53`) + `scale.test.ts`; `render/fanLayout.ts` + test; the six proto sprites `H/assets/proto/*` → `src/assets/sprites/` and `H/assets/checker.png`; `assets/names.ts` + `manifest.ts` (explicit import table + DEV guard, §3.8) + `manifest.test.ts` (sprites and cards only for now; audio names are added in M5); `styles/*.css` split from `P:6-216` (96-px cards, `image-set`, media-query card resizes dropped, `responsive.css` per §3.6); `ui/Hand.tsx` (absolute fan from `fanLayout`, each card keyed by ``key={`${dealId}-${value}`}``), `Pile.tsx` (step 40, `S_small`), `Sign.tsx`, `Felt.tsx`, `Seat.tsx` (64-px portraits via `PORTRAITS[getPersonality(p.personality).portrait]` **for `p.kind === "ai"` only**, ≤5 back chips, `.active/.low/.out`, passed badge), `TopBar.tsx`, `StatusLine.tsx`, `Controls.tsx` (grid `1fr 1fr 1fr 1.5fr`, `P:160`), `Overlay.tsx` with the landscape message; `platform/useDevice.ts` (`--dpr`), `platform/useLandscapeShort.ts`; game root column `max-width: 440px`; `dev/Spike.tsx`; delete the M1 text widgets.

**Visible at the end**: the real table: wood, felt, seats with portraits, sign, pile, fanned hand, controls.

**Verification gate**:

- `npm test` green (`fanLayout.test.ts`: step 22 at 360, step 21 at 359, integer `xs`, span ≤ availW; `scale.test.ts`: 7 device rows; `manifest.test.ts`: six sprites present as non-empty URLs, every `PERSONALITIES[k].portrait` in `PORTRAITS`).
- Negative check: rename `src/assets/sprites/felt.png` → `npm run dev` fails to resolve the import (and `npm run build` fails); revert. Delete the `felt` key from `MANIFEST` → `npm run typecheck` reports TS2741; revert.
- Manual, in Safari Responsive Design Mode or the iOS Simulator at iPhone 15 (dpr 3) and iPhone SE (dpr 2):
  1. `?dev=spike`: device-resolution screenshot zoomed 800% shows the checker row pure black/white and the twin grey.
  2. Elements panel: every `.card` `transform` is a whole CSS px at rest.
  3. 13 cards span ≤ 360 px.
  4. **SE gate**: at 375x667 the full column (topbar/seats/felt/hand/status/controls) fits with no scroll. Record the measured heights in `docs/ARCHITECTURE.md`; apply the fallback order (§3.6) if not.
  5. Rotate an SE to landscape → "Turn your phone to play" overlay, no AI timer fires (console quiet through a full think delay); rotate back → play resumes.

### M3 — Full interaction and motion parity with the prototype (size M)

**Goal**: everything the prototype does on the table, the React app does, with the bark bug fixed.

**Scope / files**: smart-select dimming (`live`); Play/Pass/Hint enablement per `P:829-832`; auto-pass; Hint; Sort persisted in `opts.sortBy`; barks as state rendered by `ui/Bark.tsx` (55%, 2 s); deal keyframes keyed by `dealId` with 32-ms stagger; select lift `translateY(-14px)` 160 ms; pile slap with alternating `--rot` and 40-ms stagger keyed by `history.length` (`P:877-883`); felt nudge 170 ms; `motion.css` with `prefers-reduced-motion` and `body.nomotion` (`P:215-216`); reduce-motion clamp honoured by every timer.

**Visible at the end**: the table feels like the prototype.

**Verification gate** (side-by-side with `P` open in a second device-mode tab):

1. Select one card of a pair → cards that cannot complete a legal move dim.
2. A 4-card selection reads "4 cards — that's not a hand." (`P:840`).
3. No legal answer with auto-pass on → pass after \~850 ms, **and tapping cards while it counts down does not restart the 850 ms** (`legal` is memoized on `[game]`, §3.3).
4. Hint selects a legal combo; Play becomes enabled.
5. An AI bark bubble is visible for \~2 s above the speaking seat (in the prototype `P:894-896` is wiped by `P:847`; here it must show); a bark expiring mid-think does not visibly restart the AI's pause.
6. Reduce motion on → AI turns ≤ 260 ms and no animation plays.
7. Five consecutive rounds with the console open: zero errors, zero crash screens.
8. Tapping hand cards during an AI think delay, and on the poster, neither lifts them nor plays a sound (`P:818-819`).

### M4 — Screens, settings, how-to, match flow (size M-to-L)

**Goal**: title → doors → table → poster → next round / quit; match over; settings persisted; how-to; quit from the in-game menu.

**Scope / files**: `ui/screens/TitleScreen.tsx` + `ui/Doors.tsx` (`P:51-61`, swap at 620/60 ms, `P:1223-1227`); "Deal me in" handler = `audio.init()` (fire-and-forget) + doors + `act(NEW_MATCH{ seed, rules: settings.rules })` where `seed` is the `?seed=` value from `App.tsx` or `newSeed(1)`; `ResultsPoster.tsx` in its two forms (§3.4): the **round** poster (`P:994-1026`: WANTED, `wanted.png` for a human win else the portrait, the reward line, Player/Cards/Round/Tally with pos/neg, Next round / Saddle up) and the **final** poster when `matchOver(game, opts.roundsPerMatch)` (heading "FINAL TALLY", face/name = `matchWinner(game)`, the over-M-rounds line, rows sorted by tally, buttons "New match" = `act(NEW_MATCH{ seed: newSeed(1), rules: settings.rules })` with the doors left open, and "Saddle up"; no "Next round"); `SettingsSheet.tsx` with the `P:258-274` labels verbatim from `copy.ts`, keyboard-operable `Switch.tsx` (`P:1056-1063`), `roundsPerMatch` Endless/5/10, the note "Rule changes apply to the next game", the hint "Card sharp plays the same as Regular for now", and **two footers depending on `game === null`** — the prototype opens one identical sheet from both the title (`P:1248` `btnSetTitle` → `ovMenu`) and the table (`P:1246` `btnMenu`), so from the title it shows "Quit game" with nothing to quit and a seed line with no seed; here: **title** → a single "Done" button, no seed line; **in-game** → the seed line "Seed N · round R" (`P:1033`, `P:283`) and the footer buttons from `P:275-279`: **"Quit game"** (`P:277`; `act(QUIT)`, closes the sheet, doors close, title — the `useTurnLoop` cleanup clears any pending AI timer because `game` becomes `null`) and **"Back to table"** (`P:278`), plus "Copy game log" in M6; the prototype's "Engine tests" button (`P:276`, `ovDev` at `P:303`) is dropped, Vitest replaced it; `HowToSheet.tsx` (`P:286-298`, example rows `[0,3,48,51]` and `[40,41,42,43,36]` as disabled small cards, `P:1277-1282`; it does **not** start music — `useAudio` derives ost\_4 from `sheet === "howto"` in M6); `settings/*` (`Opts`, `DEFAULTS`, `parseSettings`, §3.3) over `platform/webStorage.ts` with the async `StoragePort` and `loaded` hydration flag; `App.tsx` `Screens` with the `sheet` state and the switch on `game === null` / `crash`. Test: `settings.test.ts`.

**Visible at the end**: the complete game minus sound.

**Verification gate**:

1. Title → Deal me in → doors → table.
2. Finish a round → poster numbers equal `roundScore(counts)`; totals carry to round 2 summing to zero; Next round follows `laterRoundLead` (`reducer.ts:177-179`).
3. Saddle up → title; the next deal starts at round 1, totals 0.
4. Change Speed / Difficulty / Straights may wrap, reload → DevTools Application › Local Storage shows `tallytwo.settings`; the sheet reflects it; load `?seed=17` (seat 0 holds the 3♦ **and** an A, 2, 3, 4, 5 — seeds 6, 17, 22, 32 hold the straight, 17 also holds the 3♦; found by looping `deal(seed, DEFAULT_RULES)` over seeds 1-200) → Deal me in → select A-2-3-4-5 including the 3♦ → Play is enabled and accepted as a straight (`combos.ts:39-44`). `engine.test.ts` additionally asserts `classify([A,2,3,4,5 values], withRules({ straightWrap: true }))` is a straight.
5. Tab + Space flips every switch.
6. `roundsPerMatch = 5` → after round 5 the poster reads "FINAL TALLY", names the seat with the highest tally (check against the table's Tally column; on `?seed=3` at Regular, write down who it is the first time and expect the same on a replay), rows are sorted by tally, "New match" deals round 1 with totals 0 and the doors still open, and "Next round" is absent. `roundsPerMatch = Endless` → round 6 is offered normally.
7. `npm test` green (`settings.test.ts`: garbage → DEFAULTS; the `P:685` blob → the seven fields kept and `roundsPerMatch: 0`, `volume: {1,1,1}` filled in; round-trip through a Map-backed **async** `StoragePort`; `loaded` flips after hydration).
8. During an AI think delay: Menu → Quit game → title within one frame; no AI move, sound or bark fires afterwards (console clean).
9. Settings from the title: no "Quit game", no "Back to table", no seed line — just the controls and "Done"; Settings from the table: the seed line and both footer buttons.

### M5 — Audio: pools, pitch jitter, ducking, table music (size M)

**Scope / files**: the format was decided in step -1, so step 1 is a copy: the 33 SFX named in §3.7 and `H/assets/audio/music/{ost_1,ost_3,ost_4}*` (or their `.m4a` twins from `H/assets/audio/m4a/`) → `src/assets/{sfx,music}/`, and their names into `names.ts` + the import lines into `manifest.ts`. Then `audio/sfxTable.ts`, `pool.ts`, `musicLatch.ts`, `port.ts` (with the failure contract and the latched `setMusic`, §3.7), `WebAudio.ts` (with `ctx.resume()` on every `play()`/`resume()` when not running), `useAudio.ts` (the `musicFor`/`tensionFor` effects, `setBus` from settings, suspend/resume from `paused`); `new WebAudio()` created once in `App.tsx` and passed to `<GameProvider audio>` (replacing the M1a console stub), plus the `pointerdown` → `audio.resume()` listener; `audio.init()` called from all three title buttons (Deal me in, How to play, Settings — §3.7); `act()` cues → `audio.play`; `dealRoll` on NEW\_MATCH/NEXT\_ROUND; `select` on toggle; `musicFor` → ost\_1 loop at 0.30 on the table, `null` on QUIT (`"results"`/tension are M6 but the selector is complete now); the Saloon piano / Card sounds switches drive `setBus`. Tests: `sfxTable.test.ts`, `pool.test.ts`, `music.test.ts`, `manifest.test.ts` extended to the audio names.

**Verification gate**:

- `npm test` green (every event has ≥ 2 files except `roundWin`; every file resolves in `MANIFEST`; no quarantined name from `AD:142-205`; `pickVariant` 1000 draws never repeat `last`; `play()` on an event with an empty pool returns without calling `pickVariant`; the three `musicLatch` cases).
- Manual in Chrome and on an iPhone:
  1. A deal plays one shuffle then four ticks.
  2. Log the picked index over 20 selects: no immediate repeat.
  3. Pitch (not tempo) varies between plays.
  4. Expose `window.__music.gain` and watch .30 → .12 → .30 within \~300 ms after a 1-3 card play but not after a 5-card play.
  5. The loop has no click at the seam.
  6. Tab away pauses, tab back resumes; Card sounds off silences SFX instantly.
  7. No `AudioContext` warnings after the first gesture; Settings from the title, flip Saloon piano → no "not allowed to start" warning either.
  8. Rename one wired audio file in `dist/` after `npm run build && npm run preview` → the game deals and plays with that one event silent, one `console.warn`, no uncaught errors.
  9. **Lock the iPhone mid-round** (side button), wait ten seconds, unlock → the next card tap plays a sound and the table loop is back within a second; same after a Siri invocation.

### M6 — Polish, build, install, port-readiness (size M)

**Scope / files**: `useAudio` gains the rest of the state machine — tension layer ost\_3 (2-s crossfade when `tensionFor(game)`), ost\_4 when `musicFor` says `"results"` (the poster, and How to play from the title — a fresh-cache How to play is exactly the latched-`setMusic` case, §3.7), CardsMovingLoop03 ambience at -14 dB; per-bus volume sliders writing `opts.volume`; "Copy game log" in the in-game Settings sheet (the `GameLog` shape from §3.3); `ui/ErrorBoundary.tsx`, the \~15-line render-bug net around `GameProvider` (§3.3) — verify it by throwing from `Seat.tsx` once; `public/icons`; installability per the §8 q6 answer — the default is **installable-offline**: `npm i -D vite-plugin-pwa` (1.3.0 supports Vite 8), `VitePWA({ registerType: "autoUpdate", manifest: { name: "Tally Two", short_name: "Tally Two", display: "standalone", orientation: "portrait", background_color: "#241408", theme_color: "#241408", icons: [...] }, workbox: { globPatterns: ["**/*.{js,css,html,png,ogg,m4a,woff2,webmanifest}"], maximumFileSizeToCacheInBytes: 8_000_000 } })` (the music loops are 2.25-3.0 MB each — ost\_1 is 3.0 MB — above Workbox's 2 MB default and under the 8 MB cap) — the plugin writes the webmanifest, so none is hand-written; if the answer is online-only, skip the plugin, write "online-only; no service worker" in `docs/ARCHITECTURE.md`, and the Rye self-hosting stays for the no-FOUT reason alone; `docs/ARCHITECTURE.md` (the three buckets + layer table + the prototype reading map + measured SE heights), `docs/ASSETS.md` (§4 table, the proto-sprite recovery recipe, the step -1 Ogg verdict), `docs/PORTING.md` (§7 table); build size check.

**Verification gate**:

1. `rm -rf node_modules && npm ci && npm run check` exits 0.
2. `npm run build`: main JS chunk < 300 KB; music emitted as separate, lazily fetched assets; `dist/` total < 12 MB.
3. `npm run preview -- --host`, Add to Home Screen on an iPhone (the icon and standalone chrome come from the apple-\* tags in `index.html`), play a full 5-round match with sound and Safari Web Inspector attached: no console errors; music shifts when a seat drops to 3 cards and again on the poster; sliders change bus volume live.
4. Offline (if q6 = offline): Airplane mode → launch from the home screen → complete one round with sound → How to play opens with ost\_4 audible. Fresh load (cache cleared) → How to play → ost\_4 becomes audible once decoded (a few seconds on cellular; it must start on its own, without a second tap — that is the latch).
5. Paste a copied game log into a scratch Vitest: `expect(JSON.stringify(replayLog(log))).toBe(JSON.stringify(log.final))` — one line, because `replayLog` was tested in M1b.
6. `grep -rE "window\.|document\.|localStorage|navigator\." src/game src/render src/settings/settings.ts src/audio/sfxTable.ts src/audio/pool.ts src/audio/musicLatch.ts src/audio/port.ts src/assets/names.ts` returns nothing.
7. Throw from `Seat.tsx` (a temporary `throw new Error("x")` in render) → the `ErrorBoundary` page shows "x" and "Saddle up" returns to the title; revert.

If M6 slips, M0-M5 is still the complete single-player game.

## 6. Testing strategy

All tests run under **Vitest, `environment: "node"`, no jsdom, no React Testing Library**. The UI will be rewritten for RN, so component tests are the lowest-value tests in this build; everything that can be a pure function has one test file next to it.

### How the existing checks carry over

| Existing | Becomes | Mechanics |
| --- | --- | --- |
| `H/scripts/test-engine.mjs` (65 assertions) | `src/engine/engine.test.ts` (M0b) | `check(name, got, want)` → `test(name, () => expect(got).toEqual(want))`; `ok` → `toBeTruthy()`; keep the replay assertion (`:172-173`) as a `JSON.stringify` compare; `import { describe as describeCombo } from "./combos"`; delete `:198-201`. Imports lose the `.ts` suffix (`:9-18`). Needs `src/ai/moves.ts` (`:18`). Verified: the unchanged file fails under Vitest with `process.exit unexpectedly called with "0"`. Plus one new case: A-2-3-4-5 classifies as a straight under `straightWrap: true` (M4 gate 4). |
| `H/scripts/sim.mjs` gate (`:106-108`) | `src/ai/sim.test.ts` (M0b) | `playGame`/`run` from `:23-73`; 200 games, seeds `1000 + i`, `mulberry32(seed ^ 0x9e3779b9)`, `beforeEach(clearPartitionCache)`; assert `errors === 0 && stalls === 0`; golden action list for seed 1000 (determinism verified warm and cold). Win rates are printed, not asserted (`DECISIONS.md:76-83`). The CLI is kept verbatim as `npm run sim` for the 1000-game statistical run. |
| `H/scripts/verify-scale.mjs` | `src/render/scale.test.ts` (M2) | The `DEVICES` table (`:16-24`) and invariants (`:49-51`): `landsOnWholeDevicePixels`, `fits`, `legible` per device; §3 fan rows (96 → span 360 / 48 → 180 / 24 → unreadable); plus `fixedWidthScale` odd-leftover cases the verifier never covered. |
| in-page `ruleTests`/`runSims` (`P:1080-1212`) | dropped | Subset of the above. |

### New tests for the web layer

| File | Asserts |
| --- | --- |
| `render/atlas.test.ts` | `spriteFor(0)` = (192,0), `spriteFor(51)` = (96,128), `spriteFor(45)` = (0,384) |
| `render/fanLayout.test.ts` | integer `xs`; step 22 at 360; step 21 at 359; span ≤ availW |
| `game/appReducer.test.ts` | NEW\_MATCH deals 4x13; NEXT\_ROUND before `scored` is a no-op; SCORE\_ROUND before `roundover` is a no-op; QUIT → null; PLAY of illegal cards throws from `appReduce` |
| `game/GameProvider.test.ts` | `tryReduce(state, a)` (exported from `appReducer.ts`, the function `act()` calls): an illegal PLAY yields `{ crash }` with the seed, action and history and `state` unchanged; a legal PLAY yields `{ next }`; `toggleCard` guard: off-turn and non-`playing` taps return `false` (the guard is a pure `canToggle(game)` in `selectors.ts`) |
| `game/cues.test.ts` | the §3.4 table row by row, plus: human PLAY to `roundover` → sfx `[playSmall \| playFive, roundWin]`, `bark` undefined; AI PLAY to `roundover` → `bark = { seat, "win" }` |
| `game/selectors.test.ts` | one test per `P:836-842` string; `canPass` false on own lead with moves; `liveCards`; `hintFor` returns a legal combo; `matchOver` for `roundsPerMatch` 0 / 5 / 10 at round 5 scored (false / true / false) and at round 5 `roundover` (false); `matchWinner` clear leader and tie; `musicFor` (title → null, table → "table", scored → "results", howto → "results"); `tensionFor` at 4 and 3 cards; `historyToActions`; `replayLog(gameLog(g))` equals `g` for a round-1 position and for round-2 positions under each `laterRoundLead` |
| `game/timing.test.ts` | ranges per speed; 260 clamp |
| `game/boundary.test.ts` | reads `src/game/*.ts(x)`, `src/settings/*.tsx`, `src/audio/useAudio.ts`, fails on `window.`, `document.`, `localStorage`, `navigator.`, `from "react-dom"`, `from "./WebAudio"`, `from "../platform`, `from "../assets/manifest"`; reads `src/ui/**`, fails on `from "../engine/reducer"` or `from "../ai` |
| `settings/settings.test.ts` | garbage → DEFAULTS; the `P:685` blob merges (seven fields kept, `roundsPerMatch`/`volume` from DEFAULTS); a wrong-typed field falls back; round-trip through a Map-backed async `StoragePort`; hydration sets `loaded` |
| `audio/sfxTable.test.ts` | ≥ 2 files per event except `roundWin`; every file in `MANIFEST`; no quarantined name; `play()` on an empty pool never calls `pickVariant` (guard in `play()`, tested through a fake port) |
| `audio/pool.test.ts` | 1000 draws never return `last` |
| `audio/music.test.ts` | `createMusicLatch()` with a fake decoder: `want("results")` then `decoded("results")` → one start; `want("results")`, `want(null)`, `decoded("results")` → no start; `decoded("table")` with nothing wanted → no start; `want` twice before decode → one start |
| `assets/manifest.test.ts` | every `AssetName` key of `MANIFEST` is a non-empty string (the build-time check is the explicit import table, §3.8; this is the runtime twin); the six proto sprites present; every `PERSONALITIES[k].portrait` is a key of `PORTRAITS` |

### Not automated (documented manual checks)

Crispness (Vitest has no layout, dpr 1, no canvas) → device-resolution screenshots of `?dev=spike` (M2). StrictMode single-dispatch → M1b console check + `?seed=N` determinism check. The landscape overlay, the iOS audio unlock and the lock-screen interruption are device checks (M2.5, M5.7, M5.9, M6.4). `npm run check` is the single gate.

## 7. React Native port notes (`docs/PORTING.md`)

| Files | Port action |
| --- | --- |
| `src/engine/*`, `src/ai/*` | copy unchanged (they are the handoff files) |
| `src/render/{atlas,scale,fanLayout}.ts` | copy unchanged; `scale.ts` came from the RN spike; `fanLayout.ts` is the extracted maths of `CardFan.tsx:38-41` / `PlainImageFan.tsx:56-71` (use the `fanFit` step 22, not PlainImageFan's cap of 23 at `:60`) |
| `src/game/*` (reducer, provider, turn loop, barks, cues, selectors, copy, timing, seeds, CrashScreen's data) | copy unchanged — React + `setTimeout` only, proven by `tsconfig.core.json` + `boundary.test.ts`; `usePageVisibility` → `AppState` from `react-native`; the seed comes from a deep link instead of `location.search`, which is why `seeds.ts` never parsed a query; `ui/CrashScreen.tsx` is rewritten in RN primitives like the rest of `ui/` |
| `src/settings/{settings,storage,SettingsProvider,useSettings}` | copy unchanged — the `StoragePort` is already async, so `@react-native-async-storage/async-storage` (`getItem`/`setItem`, both promise-returning) implements it in two lines; that API alone is the reason the port is async |
| `src/audio/{sfxTable,pool,musicLatch,port}.ts` | copy; write `ExpoAudio.ts` implementing `AudioPort` on expo-audio (the same never-rejects `init()` contract; `musicLatch` reused as-is). **Not one-to-one**: expo-audio's `AudioPlayer` has per-player `volume`, `loop: boolean`, `shouldCorrectPitch` and `setPlaybackRate(rate, pitchCorrectionQuality?)` (`expo-audio/build/AudioModule.types.d.ts`) — no bus graph, no automation curves, no `loopEnd`. Emulation, per port method: `duck`/`setTension` → a JS volume ramp on a \~16 ms interval (`setInterval`, the constants from `sfxTable.ts`); `setBus` → keep the bus gain in JS and set each player's `volume = bus × event gain`; sample-accurate loops → trim the three loop files to the manifest durations offline (ffmpeg `-t`) so `loop = true` is seamless; pitch jitter → `player.shouldCorrectPitch = false; player.setPlaybackRate(1 + jitter)`; `suspend`/`resume` → `pause()`/`play()` on the active players plus `setAudioModeAsync({ playsInSilentMode: true })` (`BUILD-PLAN.md:96`) |
| `src/assets/names.ts` | copy unchanged; `manifest.ts` is rewritten as a `require()` table for the same `AssetName` union — the same shape as the web's explicit import table, line for line; the same `manifest.test.ts` proves completeness; the @2x/@3x atlases are already in the tree |
| `src/ui/**`, `src/styles/*`, `src/platform/*`, `src/audio/WebAudio.ts`, `dev/*` | rewrite in RN primitives; `H/src/render/PlainImageFan.tsx` is the ready-made twin of `Hand.tsx`; `tokens.css` is 12 hex colours (`P:7-18`) plus one rgba (`--shadow`, `P:19`) → `theme.ts`; `copy.ts` and `timing.ts` reused as-is; the landscape overlay becomes `expo-screen-orientation` lock; `ErrorBoundary` is the same 15 lines (class components exist in RN) |
| tests | core suites unchanged under Vitest or Jest |

What to avoid **now** so the port stays mechanical:

- No `window`/`document`/`localStorage`/`navigator` outside `src/platform`, `src/audio/WebAudio.ts`, `src/ui`, `App.tsx`, `dev/`. The compiler and `boundary.test.ts` catch it from M1b.
- Platform objects (`audio`, `storage`) are props to the providers, never imports inside them; `ui/` reaches the audio port only through `useGame().audio`, and only `useAudio` decides what plays.
- No `react-dom` import in hooks; no DOM event types in `game/` (the UI passes card values, not events).
- No CSS-only numbers: every ms and px that affects behaviour lives in `timing.ts` / `fanLayout.ts`.
- No Zustand/Redux: `useReducer` exists in RN as-is.
- The hooks are copied, not packaged as an npm workspace — a `packages/react` layer would add tsc references, Metro `watchFolders` and a third tsconfig, more concepts than a 70-line copy is worth for a solo learner.

## 8. Open questions for the user

1. **Match length.** Default is endless (the prototype's behaviour) with a `roundsPerMatch` setting of Endless / 5 / 10, `matchOver(game, roundsPerMatch)` and a "FINAL TALLY" poster naming the highest tally (§3.4). `DECISIONS.md:113-114` leaves this open — is a round count the right shape, or should it be a target score?
2. **`sfx-play-five` substitute.** The plan wires `CardGenericMovesLong05/06/07` (`AD:81-83`) because every `CardSlide*` file is quarantined (`AD:180-187`). Acceptable, or should three `CardSlide` files be restored from `_trash/`?
3. **Rules apply next game.** The reducer stores rules in `GameState` (`state.ts:35`), so rule changes take effect at the next deal, unlike the prototype's (half-working) live mutation (`P:1258-1267`). OK to ship with the sheet note, or do you want a `SET_RULES` re-deal mid-match?
4. **Difficulty labels.** Ship Greenhorn / Regular / Card sharp (`P:267`) with the hint "Card sharp plays the same as Regular for now" (`choose.ts:46,51,81`), or drop to two levels as `DECISIONS.md:74-92` suggests?
5. **Ogg on iPhone.** Decided by the step -1 probe today, not in M5. If it fails, the fallback is an AAC `.m4a` transcode of the 36 wired files; `ffmpeg` is already installed at `/opt/homebrew/bin/ffmpeg`, so the only remaining question is whether you want the transcode done locally (ten minutes, the loop in step -1) or by the asset owner from the masters.
6. **Online-only, or installable-offline?** Add to Home Screen is in M6 either way; what is not decided anywhere (`DECISIONS.md:116-121` is silent) is whether the installed icon must work without network. An icon that opens to a blank page on the train is a shipped broken state, so the plan defaults to offline via `vite-plugin-pwa` (M6, \~15 lines of config, +1 devDep, \~10 MB precached including the three music loops). If you would rather stay online-only, M6 drops the plugin and records the decision in `docs/ARCHITECTURE.md`; nothing else changes.
