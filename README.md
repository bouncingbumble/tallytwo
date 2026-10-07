# Tally Two

Big Two — the Hong Kong climbing card game — played four-handed in a saloon: you against Marshal Cobb, Dusty Vane and Lucky Pearl. A Vite 8 + React 19 + TypeScript 6 web app for a phone held sideways (iPhone Safari first) and desktop Chrome, built around one idea: a pure `(state, action) => state` engine that React's `useReducer` runs unchanged. A second, 30-line reducer wraps it; a third runs settings. No state library.

- `docs/ARCHITECTURE.md` is the long version of this README.
- `docs/ASSETS.md` is the asset truth: what is wired, in which format, and why.
- `docs/SHELL.md` is the host contract: the postMessage protocol for a WKWebView, an Android WebView or an iframe, and the embed recipes.

## Run it

Node 24 through nvm (`.nvmrc` says `24`; `package.json` demands `>=22.18`). Nothing else is needed: no ffmpeg, no Python, no native toolchain.

```sh
nvm use 24
npm install
npm run dev          # vite --host: open the printed LAN URL on the phone
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on the LAN (`--host`) so an iPhone on the same Wi-Fi can load it |
| `npm run build` | `tsc -b && vite build` → `dist/`, a plain static site (no service worker, no webmanifest) for a webview shell or any static host |
| `npm run preview` | serves `dist/` on the LAN — what you use to check the built bundle on the phone |
| `npm run typecheck` | `tsc -b --noEmit` (the app, with the DOM lib) **and** `tsc -p tsconfig.core.json --noEmit` (the pure files, without it) |
| `npm run lint` | oxlint; `react/rules-of-hooks` is the one that matters |
| `npm test` | Vitest, `environment: node`, every `src/**/*.test.{ts,tsx}`; no jsdom, no React Testing Library |
| `npm run sim -- 300` | the legality-and-termination gate: 300 AI-only games through the real reducer, plus difficulty numbers |
| `npm run check` | typecheck + lint + test + `sim 300` + `vite build` — the single gate |

Pace: the table runs at `BASE_TIME_SCALE` (4×) times the prototype's waits — `src/game/timing.ts` — and Settings › Game speed (1x/2x/3x/4x) divides that down; Opponent pace (fast/normal/slow) sets the think-time range underneath.

Dev URL switches: `?seed=N` deals a fixed seed (seat 0 holds the 3♦ for seeds 3, 9, 14, 17; seed 17 also holds A-2-3-4-5). In a dev build `window.__tally = { act, game }` lets you dispatch from the console (`__tally.act({ type: "PLAY", player: 0, cards: [51] })` on your lead shows the crash screen).

## Device checks

The device gates are scripted in `e2e/play.mjs` (Playwright; not a dependency of the app):

```sh
npm run dev                                   # in one terminal
npm i --no-save playwright && npx playwright install webkit chromium
node e2e/play.mjs http://localhost:5173 2     # two rounds per browser
```

It plays full rounds through the real UI in WebKit at iPhone SE (667x375 @2) and iPhone 15 (852x393 @3) geometry — the phones held sideways — and in Chromium at a 1280x800 desktop window, and checks: the `.game` box is the viewport (the 440-px logical canvas scaled by k = height / 440, `docs/ARCHITECTURE.md` §10), 13 cards dealt, `?seed=3` gives you the 3♦, every card's rest transform is a whole logical px, a hand card is 96k x 128k, the 13-card fan steps ≥ 34 logical px and fits the strip, a drag reorders the hand, the hand and the buttons fit with no scroll, every poster's deltas sum to zero, settings persist, no console errors. Screenshots land in `e2e/shots/`. Playwright's Chromium has no AAC decoder, so it reports the audio files as unavailable and plays silently — by design (`docs/ASSETS.md` §4).

## Folder map: three buckets

Every file belongs to one of three buckets, and the bucket is the whole import rule. The tooling enforces it; nothing relies on memory.

| Bucket | Files | The rule | Enforced by |
| --- | --- | --- | --- |
| **PURE** | `src/engine/`, `src/ai/`, `src/render/*.ts`, `src/game/*.ts` (not `use*.ts`), `src/settings/{settings,storage}.ts`, `src/audio/{sfxTable,pool,musicLatch,port}.ts`, `src/assets/names.ts` | needs no `window`, `setTimeout`, `console`, `URLSearchParams` or `import.meta` | `tsconfig.core.json` (no DOM lib, `types: []`): those names are "Cannot find name" |
| **HOOKS** | `src/game/{GameProvider,useTurnLoop,useBarks,useGame}`, `src/settings/{SettingsProvider,useSettings}`, `src/audio/useAudio.ts` | React + `setTimeout` only; platform objects (`audio`, `storage`, `shell`) arrive as props, never as imports | `src/game/boundary.test.ts` |
| **WEB** | `src/ui/**`, `src/styles/*`, `src/platform/*`, `src/audio/WebAudio.ts`, `src/assets/manifest.ts`, `src/App.tsx`, `src/main.tsx`, `src/dev/*` | anything goes, but no game rules: an `if` about the rules of the game belongs in `src/game/selectors.ts` | `boundary.test.ts` (`ui/**` never imports `engine/reducer` or `ai/*` as values) |

PURE and HOOKS have no platform in them; WEB is the browser. A native shell is a webview around the same build.

```
index.html                 viewport, theme-color, apple-mobile-web-app-* tags, /icons/icon-192.png
vite.config.ts             defineConfig from "vitest/config"; react() only (no PWA: dist/ is a static site)
tsconfig.app.json          the react-ts template as-is (TS ~6.0, es2023, erasableSyntaxOnly, verbatimModuleSyntax)
tsconfig.core.json         the PURE check: lib ["ES2023"], types []; folder includes + a naming rule (use*, *.test, *.tsx excluded)
scripts/                   sim.mjs (gate + difficulty numbers), register-resolver.mjs + ts-resolve.mjs
                           (Node module hook so plain Node resolves extensionless .ts imports; always run them via npm run)
e2e/play.mjs               the scripted device gates (Playwright)
public/icons/              icon-192.png, icon-512.png (wood tile + card back, nearest-neighbour; see docs/ASSETS.md)
docs/                      ARCHITECTURE.md  ASSETS.md  SHELL.md
src/
  engine/                  PURE   cards rules scoring combos compare state reducer
  ai/                      PURE   moves partition evaluate personalities choose + getPersonality aiTurn index
  render/                  PURE   atlas (card -> atlas cell), scale (the 440-px logical canvas, fitScale -> k), fanLayout (integer fan)
  game/                    PURE   appReducer (AppState, tryReduce), selectors (every rules-of-the-game `if`), cues (action -> sounds/bark),
                                  copy (every string), timing (every ms), seeds
                           HOOKS  GameProvider, useGame, useTurnLoop, useBarks
  settings/                PURE   settings (Opts, DEFAULTS, parseSettings), storage (StoragePort)   HOOKS SettingsProvider, useSettings
  audio/                   PURE   sfxTable (event -> files/gain/ducks, music loops), pool (round-robin), musicLatch, port (AudioPort)
                           HOOKS  useAudio (the music/bus state machine)   WEB WebAudio.ts (AudioContext, three buses)
  assets/                  PURE   names.ts (AssetName union)   WEB manifest.ts (explicit ?url import table) + cards/ sprites/ sfx/ music/
  platform/                WEB    webStorage, usePageVisibility, useFitScale (k + ScaleContext), useElementSize, useElementWidth,
                                  bridgeProtocol (envelope, PURE in spirit), bridge (host detection + delivery), bridgeStorage, useBridge (pause/insets/ready)
  ui/                      WEB    Card Hand Saloon Pile Sign Felt Seat Bark TopBar StatusLine Controls Switch Overlay Doors CopyButton CrashScreen ErrorBoundary
                                  screens/ TitleScreen TableScreen ResultsPoster SettingsSheet HowToSheet
  styles/                  WEB    tokens base buttons table cards sprites overlays motion shell
  dev/                     WEB    DevHook (window.__tally in DEV builds)
  App.tsx  main.tsx        WEB    providers, the storage pick (host ? bridgeStorage : webStorage), ?seed= parsing, the one pointerdown -> audio.resume() listener
```

## The gates

Each is a command that exits non-zero when the thing it protects breaks; `npm run check` runs them all.

| Gate | Protects | How |
| --- | --- | --- |
| `tsc -p tsconfig.core.json` | the PURE bucket has no platform dependency | the pure folders are compiled without the DOM lib; a `window`, `setTimeout` or `import x from "./a.png?url"` in a pure file is a type error at the importer |
| `boundary.test.ts` | the HOOKS bucket stays portable; `ui/` stays rule-free | the hook set is derived from the tree (every `use*.ts` and `*.tsx` under `game/`, `settings/`, `audio/`) and checked for `window.`, `document.`, `localStorage`, `navigator.`, `react-dom`, `WebAudio`, `platform/`, `assets/manifest`; `ui/**` is checked for value imports of `engine/reducer` or `ai/*` |
| `engine.test.ts`, `ai/sim.test.ts`, `ai/ai.test.ts` | the rules and the AI | the classification table, the full comparison matrix, properties over random hands, scoring, deal, the reducer's legality rules, replay determinism; 200 seeded games with 0 throws / 0 stalls |
| `npm run sim -- N` | legality and termination at scale | every game runs through the real `reduce()`, which throws on any illegal action, so "0 illegal actions" is a proof |
| `manifest.test.ts` + the explicit import table | every asset exists and every name is wired | a missing file is a Vite resolve error; a missing key is TS2741; every portrait key is in `PORTRAITS`; every image is one 3x file with no `@2x`/`@3x` twin |
| `vite build` | it ships | `tsc -b` first, then the static bundle in `dist/` |

## Verification

```sh
nvm use 24
npm run sim -- 300
```

Expected output (Node 24.15.0; only the millisecond figure varies):

```text
✓ 300 games in 375 ms
illegal actions : 0
stalled games   : 0
all Regular                      75 games, seat wins 20/18/22/15, avg 25.1 plays
Card sharp vs three Greenhorns   75 games, seat 0 wins 48 (64%; even odds would be 25%)
Regular vs three Greenhorns      75 games, seat 0 wins 47 (63%; even odds would be 25%)
Card sharp vs three Regulars     75 games, seat 0 wins 25 (33%; even odds would be 25%)
✓ legality and termination gates pass
```

The three percentages are the "Hard is not measurably stronger than Medium" finding: Card sharp (hard) beats three Greenhorns 64 % of the time, Regular (medium) beats them 63 %, and Card sharp against three Regulars wins 33 % — barely above the 25 % of even odds. Card counting alone buys nothing without lookahead, which is why the settings sheet says "Card sharp plays the same as Regular for now". Seeds are `1000 + i`, so the numbers are exact and repeatable; they are printed, not asserted (the gate is the two zeros).

```sh
npm run check     # typecheck (app + core) → lint → vitest → sim 300 → vite build; exit 0 is the answer
```

Node 24 accepts `--experimental-strip-types` for the scripts; the template's `erasableSyntaxOnly` is what keeps the `.ts` files runnable under it — no enums, no namespaces, no parameter properties.
