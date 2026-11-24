# Tally Two

Big Two — the Hong Kong climbing card game — played four-handed in a saloon: you against Marshal Cobb, Dusty Vane and Lucky Pearl. A Vite 8 + **Phaser 4** + TypeScript 6 game for a phone held sideways (iPhone Safari first) and desktop Chrome, built around one idea: a pure `(state, action) => state` engine that a small framework-free store (`src/game/store.ts`) runs unchanged, with the Phaser scenes as its subscribers. A second, 30-line reducer wraps the engine; a third runs settings. No state library, no React.

> This is the Phaser port of the React app (the React original lives on in `~/Desktop/Tally Two`). `docs/PHASER_MIGRATION.md` is the plan it followed and what changed.

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
| `npm run dev` | Vite dev server on the LAN (`--host`), **port 5180**, so an iPhone on the same Wi-Fi can load it |
| `npm run build` | `tsc -b && vite build` → `dist/`: a static site for any static host, plus `sw.js` (the offline service worker) and `manifest.webmanifest` |
| `npm run preview` | serves `dist/` on the LAN — what you use to check the built bundle on the phone |
| `npm run typecheck` | `tsc -b --noEmit` (the app, with the DOM lib) **and** `tsc -p tsconfig.core.json --noEmit` (the pure files, without it) |
| `npm run lint` | oxlint |
| `npm test` | Vitest, `environment: node`, every `src/**/*.test.ts`; no jsdom — the stores and the layout are pure, so the turn loop and the table geometry are tested without a renderer |
| `npm run sim -- 300` | the legality-and-termination gate: 300 AI-only games through the real reducer, plus difficulty numbers |
| `npm run check:sw` | checks `dist/sw.js` against `dist/`: every file listed exists and carries `BASE_PATH`, every shipped file is listed (except the deliberate skips), under 16 MB |
| `npm run e2e:offline` | builds with `VITE_E2E=1`, previews, and runs `e2e/play.mjs` with `OFFLINE=1` in Chromium: install, cut the network, reload, play a round |
| `npm run e2e:update` | `e2e/update.mjs`: a deploy mid-match waits; the Title's update line hands over |
| `npm run check` | typecheck + lint + test + `sim 300` + `vite build` + `check:sw` — the single gate |

Pace: the table runs at `BASE_TIME_SCALE` (4×) times the prototype's waits — `src/game/timing.ts` — and Settings › Game speed (1x/2x/3x/4x) divides that down; Opponent pace (fast/normal/slow) sets the think-time range underneath.

Dev URL switches: `?seed=N` deals a fixed seed (seat 0 holds the 3♦ for seeds 3, 9, 14, 17; seed 17 also holds A-2-3-4-5). In a dev build `window.__tally = { act, game }` lets you dispatch from the console (`__tally.act({ type: "PLAY", player: 0, cards: [51] })` on your lead shows the crash screen).

## Deploy

Every push to `main` runs `.github/workflows/pages.yml`: the gate (typecheck, lint, tests, `sim 300`), then `vite build` with `BASE_PATH=/tallytwo/` and `check:sw`, published to GitHub Pages at **https://bouncingbumble.github.io/tallytwo/**. A failed gate leaves the live site as it was. `BASE_PATH` only changes the public path (`vite.config.ts` `base`); locally and in a webview shell it stays `/`. On an iPhone, open the URL in Safari and Share › Add to Home Screen to run it full screen.

**Offline.** The first online visit installs a service worker that caches the whole game, music included (≈ 14 MB). After that it launches and plays with no network. On iOS the Home Screen app keeps its own storage, separate from Safari's, so **open it from the Home Screen icon once while online**. The title's "Play offline · add to Home Screen" line handles the install: it opens the install dialog in Chrome and Edge, and shows the Share steps on iPhone/iPad. That copy is also exempt from Safari's 7-day eviction. A new deploy downloads in the background and never interrupts a match. It takes over on the next cold launch, or when you tap "New version ready" on the title. `docs/OFFLINE_PLAN.md` has the design; `docs/SHELL.md` §7 covers a native shell, which bundles `dist/` instead.

## Device checks

The device gates are scripted in `e2e/play.mjs` (Playwright; not a dependency of the app):

```sh
npm run dev                                   # in one terminal
npm i --no-save playwright && npx playwright install webkit chromium
node e2e/play.mjs http://localhost:5180 2     # two rounds per browser
```

It plays full rounds through the real UI in WebKit at iPhone SE (667x375 @2, and 667x331 — Safari's toolbars showing, k = 0.75), and iPhone 15 (852x393 @3) geometry — the phones held sideways — and in Chromium at a 1280x800 desktop window, and checks (reading the canvas through the DEV probe `window.__tally.probe()`, `src/phaser/probe.ts`): the canvas is the viewport (the 440-px logical canvas scaled by k = height / 440), 13 cards dealt, `?seed=3` gives you the 3♦, every card's rest transform is a whole logical px, a hand card is 96k x 128k, the 13-card fan steps ≥ 34 logical px and fits the strip, a drag reorders the hand, the hand and the buttons fit with no scroll, every poster's deltas sum to zero, settings persist, no console errors, and on every screen no visible text under 11 CSS px and no control under 44x44 CSS px (the size floors in `src/phaser/theme.ts`). Screenshots land in `e2e/shots/`. Playwright's Chromium has no AAC decoder, so it reports the audio files as unavailable and plays silently — by design (`docs/ASSETS.md` §4).

**Frame rate.** Add `?perf=1` to any URL (dev or production build, phone or desktop) for a frame-time overlay — fps, frames drawn, frame interval and main-thread work per frame, draw calls, texture uploads, long tasks — and `window.__perf.report()` / `.reset()` in the console. `node e2e/perf.mjs http://localhost:5180 <label>` plays a round of `?seed=17` at Card sharp in WebKit (iPhone 15) and Chromium (desktop), writes `e2e/perf/<label>.json`, and fails if an AI move ran on the main thread or an iPhone frame took more than 60 draw calls. `e2e/perf/baseline.json` and `after.json` are the measurements behind `docs/PERF_PLAN.md`. Comparison switches: `?draw=always` (no render-on-demand), `?pixels=smooth|linear|nearest` (art filtering), `?snap=0` (no device-px snapping).

## Folder map: three buckets

| Bucket | Files | The rule | Enforced by |
| --- | --- | --- | --- |
| **PURE** | `src/engine/`, `src/ai/`, `src/render/*.ts`, `src/game/*.ts` (the store included), `src/settings/*.ts`, `src/audio/` (except `WebAudio.ts`), `src/assets/names.ts` | needs no `window`, `setTimeout`, `console`, `URLSearchParams` or `import.meta`; time, sound, storage and the host arrive as ports (`ClockPort`, `AudioPort`, `StoragePort`, `ShellPort`) | `tsconfig.core.json` (no DOM lib, `types: []`) |
| **SCENES** | `src/phaser/**` | Phaser; no game rules — an `if` about the rules belongs in `selectors.ts`, a layout number in `render/tableLayout.ts` | `boundary.test.ts` (never imports `engine/reducer` or `ai/*` as values) |
| **WEB** | `src/platform/*`, `src/audio/WebAudio.ts`, `src/assets/manifest.ts`, `src/main.ts`, `src/assetsPage.ts`, `src/styles/*` | the browser | — |

```
src/
  engine/ ai/              PURE   the rules and the regulars (unchanged from the React app)
  render/                  PURE   atlas, scale (the 440-px canvas, k), fanLayout, tableLayout (the table grid as rects)
  game/                    PURE   appReducer, selectors, cues, copy, timing, seeds, store (GameStore: act, turn loop, barks),
                                  clock (ClockPort + manualClock for tests), observable (subscribe / Value)
  settings/                PURE   settings, storage (StoragePort), store (SettingsStore: hydrate, persist)
  audio/                   PURE   sfxTable, pool, musicLatch, port, director (what plays, from the stores)   WEB WebAudio.ts
  platform/                WEB    env (fit, dpr, hidden, upright, notch, insets as observables), clock (setTimeout), bridge*, webStorage
  phaser/                  SCENES director (which scenes run, pause, resize), viewport (canvas at dpr, camera zoom k*dpr),
                                  paint (canvas-painted boxes + crisp text), widgets (Button Switch Slider Picker), cards (CardView),
                                  art (prop sizes), motion, theme, probe (e2e targets), services
    scenes/                       Boot Title Table Poster Settings HowTo Crash Rotate (+ sheet: the scrolling-panel base)
    table/                        Seat Trick Hand Side Saloon
  main.ts                  WEB    wiring: stores + WebAudio + storage pick + bridge, ?seed=, the Phaser game, window.__tally (DEV)
```

## The gates

Each is a command that exits non-zero when the thing it protects breaks; `npm run check` runs them all.

| Gate | Protects | How |
| --- | --- | --- |
| `tsc -p tsconfig.core.json` | the PURE bucket has no platform dependency | the pure folders are compiled without the DOM lib; a `window`, `setTimeout` or `import x from "./a.png?url"` in a pure file is a type error at the importer |
| `boundary.test.ts` | nothing escapes the PURE check; scenes stay rule-free; no React | no `.tsx` or `use*.ts` under `game/`, `settings/`, `audio/`; `phaser/**` is checked for value imports of `engine/reducer` or `ai/*`; nothing imports `react` |
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
✓ 300 games in 19536 ms
illegal actions : 0
stalled games   : 0
all Regular                      75 games, seat wins 17/19/24/15, avg 25.0 plays
Card sharp vs three Greenhorns   75 games, seat 0 wins 49 (65%; even odds would be 25%)
Regular vs three Greenhorns      75 games, seat 0 wins 41 (55%; even odds would be 25%)
Card sharp vs three Regulars     75 games, seat 0 wins 32 (43%; even odds would be 25%)
✓ legality and termination gates pass
```

Card sharp (hard) looks ahead (`src/ai/lookahead.ts`): its best few moves, plus passing when following, are each played out to the end of the round over 24 guessed deals of the unseen cards, and the best average round score wins. It beats three Greenhorns 65 % of the time against Regular's 55 %, and three Regulars 43 % of the time against the 25 % of even odds. The lookahead is also why the run takes seconds, not milliseconds: about 10 ms per Card sharp move (82 ms at worst). Seeds are `1000 + i`, so the numbers are exact and repeatable; they are printed, not asserted (the gate is the two zeros).

```sh
npm run check     # typecheck (app + core) → lint → vitest → sim 300 → vite build; exit 0 is the answer
```

Node 24 accepts `--experimental-strip-types` for the scripts; the template's `erasableSyntaxOnly` is what keeps the `.ts` files runnable under it — no enums, no namespaces, no parameter properties.
