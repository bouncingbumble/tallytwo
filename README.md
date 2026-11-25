# Tally Two

Big Two — the Hong Kong climbing card game — played four-handed in a saloon: you against Dusty Vane, Marshal Cobb and Lucky Pearl. A Vite + **Phaser 4** + TypeScript game for a phone held sideways (iPhone Safari first) and desktop browsers. A pure `(state, action) => state` engine, a small framework-free store (`src/game/store.ts`) that runs the table, and Phaser scenes that draw what the store says. No UI framework, no state library.

- `docs/ARCHITECTURE.md` — how the code fits together.
- `docs/ASSETS.md` — what art and audio ship, how they are wired and how they were made.
- `docs/SHELL.md` — the contract for hosting the game in a WKWebView, an Android WebView or an iframe.

## The game

Thirteen cards each; whoever holds the 3♦ leads the round and must play it. Play singles, pairs or five-card hands that beat what is on the table, or pass; a seat that passed may play again when the trick comes back round, and three passes clear the trick to whoever played last. The first to empty their hand wins the round and collects one point per card from each loser (doubled at ten or more cards, tripled at thirteen). A match is eight rounds.

Settings: opponents (Greenhorn, Regular, Card sharp), Game speed (slow, normal, fast), Hints (the Hint button and "nothing beats that"), wrap-around straights, card sounds on or off, music and card-sound volume, motion (auto, full, reduced), swipe to select and flick to play (off, a Play button appears beside Pass). A first-time player starts on Greenhorn with hints on.

## Run it

Node 24 (`.nvmrc`; `package.json` requires `>=22.18`).

```sh
npm install
npm run dev          # http://localhost:5180, also on the LAN so a phone on the same Wi-Fi can load it
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 5180, on the LAN (`--host`) |
| `npm run build` | `tsc -b && vite build` → `dist/`: a static site plus `sw.js`, the offline service worker |
| `npm run preview` | serves `dist/` on port 4180, on the LAN |
| `npm run typecheck` | the app with the DOM lib, and the pure folders without it (`tsconfig.core.json`) |
| `npm run lint` | oxlint |
| `npm test` | Vitest in node (no DOM), every `src/**/*.test.ts` |
| `npm run sim -- 300` | 300 AI-only games through the real reducer: 0 illegal actions, 0 stalls, and win rates per difficulty |
| `npm run check:sw` | checks `dist/sw.js` against `dist/`: every listed file exists under the base path, every shipped file is listed (bar deliberate skips), under 16 MB |
| `npm run e2e` | the end-to-end test (below) |
| `npm run check` | typecheck + lint + test + `sim 300` + build + `check:sw` |

URL switches: `?seed=N` deals a fixed seed (with `?seed=3` you hold the 3♦ and lead). `?perf=1` shows a frame-time overlay and exposes `window.__perf.report()`. `?draw=always`, `?pixels=nearest|linear|smooth` and `?snap=0` turn off render-on-demand, change art filtering and turn off device-pixel snapping, for comparison. `/assets` lists every asset.

In a dev build `window.__tally` exposes the store, the settings, the Phaser game and `probe()` for the console and the e2e test; `__tally.act({ type: "PLAY", player: 0, cards: [51] })` on your lead shows the crash screen.

## End-to-end test

```sh
npm i --no-save playwright     # once; the Chromium build must match the installed Playwright
npm run e2e
```

`e2e/play.mjs` starts its own dev server on port 5199 and plays through the real canvas in headless Chromium, as a sideways iPhone SE (667x375, touch) and as a 1280x800 desktop window, in about 30 seconds. A canvas has no DOM to query, so it reads the game through `window.__tally` and `probe()` (`src/phaser/probe.ts`), which reports every control's and card's rect in logical px. It checks:

- the canvas fills the viewport at k = height / 440 and nothing scrolls;
- the title, How to play, Settings, the table and the poster have no text under 11 CSS px and no control under 44x44 CSS px;
- How to play closes on a tap outside it, Settings on its ✕; Settings from the title shows Done, and a switch flips and is saved to `localStorage`;
- a tap finishes the deal; `?seed=3` deals 13 cards with your 3♦ leftmost, 96x128 logical px at whole-px rests, in a fan that fits its strip;
- a swipe selects a range and un-paints on the way back, a swipe from a selected card deselects, and a flick plays the selected 3♦;
- a lost WebGL context pauses the table and a restored one draws again;
- the rest of the round (played through the store, without think delays) scores with deltas summing to zero, and Next round deals round 2;
- no console errors or warnings. Playwright's Chromium cannot decode AAC, so the game is silent there and its "audio: … dropped" warnings are not counted.

## Deploy

Every push to `main` runs `.github/workflows/pages.yml`: typecheck, lint, tests and `sim 300`, then a build with `BASE_PATH=/tallytwo/` and `check:sw`, published to GitHub Pages at **https://bouncingbumble.github.io/tallytwo/**. A failed step leaves the live site as it was. `BASE_PATH` only changes the public path; locally and in a native shell it stays `/`.

**Offline.** The first online visit installs a service worker that caches the whole game, music included (about 14 MB); after that it plays with no network. On iOS a Home Screen app has its own storage, separate from Safari's, so open it from the Home Screen icon once while online. The title's "Play offline · add to Home Screen" line opens the install dialog in Chrome and Edge and shows the Share steps on iPhone and iPad. A new deploy downloads in the background and never interrupts a match; it takes over on the next cold launch, or when you tap "New version ready" on the title.

## Simulation

```text
$ npm run sim -- 300
✓ 300 games in 42629 ms
illegal actions : 0
stalled games   : 0
all Regular                      75 games, seat wins 17/19/24/15, avg 25.0 plays
Card sharp vs three Greenhorns   75 games, seat 0 wins 49 (65%; even odds would be 25%)
Regular vs three Greenhorns      75 games, seat 0 wins 41 (55%; even odds would be 25%)
Card sharp vs three Regulars     75 games, seat 0 wins 32 (43%; even odds would be 25%)
✓ legality and termination gates pass
```

Seeds are `1000 + i`, so everything but the time is exact and repeatable. Every game runs through the real `reduce()`, which throws on an illegal action, so the two zeros are the gate; the win rates are printed, not asserted. Card sharp looks ahead (`src/ai/lookahead.ts`): its best few moves, plus passing when following, are each played out to the end of the round over guessed deals of the unseen cards, and the best average round score wins. That is why the run takes seconds; in the game those moves are computed in a Web Worker.

The scripts run `.ts` sources directly with `node --experimental-strip-types`, which is why `tsconfig` sets `erasableSyntaxOnly`: no enums, namespaces or parameter properties.
