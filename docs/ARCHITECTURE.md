# Architecture

Tally Two is a Phaser 4 game with no UI framework. The rules are a pure reducer, a small store runs the table around it, and the Phaser scenes subscribe to the store and draw what it says. Everything that touches the browser is created in one file, `src/main.ts`, and handed to the rest as a port.

## Layers

```
engine/      the rules: cards, combos, comparison, scoring, reduce(state, action) -> state     PURE
ai/          the three regulars: move generation, heuristics, Card sharp's lookahead          PURE
game/        appReducer, selectors, cues, copy, timing, seeds, think, GameStore             PURE
settings/    the settings shape, parseSettings, SettingsStore                                 PURE
audio/       the sound table, the music latch, the AudioPort, the audio director             PURE (WebAudio.ts is WEB)
render/      the 440-px logical canvas, the card atlas, the fan, the table layout, gestures  PURE
platform/    the browser and the host: env, clock, storage, bridge, worker, service worker   WEB
phaser/      the scenes, the table's views, widgets, painting, the scene director            SCENES
main.ts      wiring                                                                           WEB
```

The buckets are enforced:

| Bucket | Rule | Enforced by |
| --- | --- | --- |
| **PURE** | No `window`, `document`, `setTimeout`, `console` or `URLSearchParams`. Time, sound, storage and the host arrive as ports (`ClockPort`, `AudioPort`, `StoragePort`, `ShellPort`, `ThinkPort`). | `tsconfig.core.json` compiles `engine/ ai/ render/ game/ settings/ audio/ assets/` without the DOM lib (`npm run typecheck`). |
| **SCENES** | No game rules. An `if` about the rules belongs in `game/selectors.ts`; a layout number in `render/tableLayout.ts`; a duration in `game/timing.ts`. `engine/reducer` and `ai/` are imported only as types. A card face is never made translucent. | `src/game/boundary.test.ts` |
| **WEB** | The browser. | — |

## Data flow

```
             ┌──────────── main.ts ─────────────┐
 WebAudio ──►│ GameStore(audio, frameClock,      │◄── SettingsStore(webStorage | bridgeStorage)
 workerThink►│           bridgeShell, think)     │       rules ─► game.setRules, opts ─► game.setOpts
             └──────┬──────────────▲────────────┘
                    │ view          │ act / toggleCard / setSelection
                    ▼               │
             Phaser scenes (Title, Table, Poster, Settings, HowTo, Crash, Rotate)
```

- **`GameStore`** (`game/store.ts`) holds one `AppState` (`appReduce` over the engine's `reduce`), the selection, any crash report, the barks and the final-round banner. `view` is a snapshot object that changes identity only when something in it changed; the scenes render from it. `act(action)` dispatches; an engine throw becomes a `CrashReport` (shown by the Crash scene with a replayable game log), never an exception.
- **The turn loop** is one pending timer on the `ClockPort`, re-armed only when the game, the pause, the crash or the Game speed / difficulty settings change. The human's turn arms nothing. An AI turn waits for the previous play to land, then the paced think time (`game/timing.ts` `SPEED`), then plays. With a `ThinkPort` the move is computed in a Web Worker (`platform/think.ts`, `platform/aiWorker.ts`) while the delay runs; if no worker can be made, the same code runs on the main thread.
- **Determinism.** A deal's seed fixes the shuffle and seeds the AI's own random stream (`game/seeds.ts`); `Math.random` is used only for cosmetics (bark chance, think jitter). A round replays from its seed and its action list (`replayLog`).
- **The frame clock** (`platform/clock.ts`) fires store timers from the Phaser loop's pre-step, so a state change, the scene's re-render and the first frame of any tween it starts land in the same frame. A fallback `setTimeout` fires anything due while the loop is asleep (a background tab).
- **Settings** (`settings/`) hydrate once from a `StoragePort`: `localStorage` in a browser, the host in a native shell (`platform/bridgeStorage.ts`). Nothing stored means a first-time player: Greenhorn opponents and hints on. Blobs saved by earlier versions are merged field by field; unknown and retired fields are dropped.
- **Audio** (`audio/`). `sfxTable.ts` lists every event's files, gain and duck, and the five music loops. `director.ts` follows the stores and the open sheet and tells the `AudioPort` which loop is wanted, when the tension loop stands in for the table loop, the bus gains, and suspend/resume. `WebAudio.ts` is the port on the Web Audio API: SFX fetched early and decoded on the first tap, music decoded the first time it is wanted, every fade and duck scheduled on the audio clock.

## The scenes

`phaser/director.ts` decides what runs from the store and a few observables (`platform/env.ts`): the Crash sheet over everything when there is a crash or an uncaught scene error; the Title when there is no game, else the Table with the Poster over it once the round is scored; the Settings or How to play sheet on top; the Rotate gate over all of it on a phone held upright. It also folds a hidden tab, the host's `pause`, the Rotate gate and a lost WebGL context into the store's pause, owns the moves between screens (through the title's doors, a fade up out of the dark), and restarts every running scene when the viewport changes — a restart is told it is one and keeps its place (a sheet's scroll, the cards' poses).

| Scene | What it is |
| --- | --- |
| `Boot` | Loads every image from `assets/manifest.ts` and waits for the Rye font. |
| `Title` | The saloon front: Deal me in, How to play, Settings; the "New version ready" / "add to Home Screen" line. |
| `Table` | The round. `table/Seat` (an opponent's badge, barks, thinking dots), `table/Trick` (the plays on the felt), `table/Hand` (the fan and its gestures), `table/Hud` (round and tally top-left, the menu top-right, and above the hand Pass / Play / Hint side by side; Play only with Flick to play off), `table/Deal` (the deal animation), `table/Saloon` (the room behind the hand, baked into one texture). |
| `Poster` | The WANTED poster after a round, the FINAL TALLY poster after the eighth. |
| `Settings`, `HowTo` | Sheets (`scenes/sheet.ts`): a panel over a dim, scrolling with momentum, closed by ✕, a tap on the dim or a pull down. |
| `Crash` | An engine throw or a scene error, with the game log to copy and Saddle up. |
| `Rotate` | "Turn your phone sideways". |

`phaser/services.ts` is what the scenes reach: the two stores, the open sheet, the seed, the update and install offers. Scenes never construct them.

## Geometry

The game is laid out on a **logical canvas 440 px tall** and as wide as the viewport allows (`render/scale.ts`). Every scene's camera zooms by `Z = k × dpr`, where `k = innerHeight / 440`, over a backing canvas the size of the viewport in device pixels (`phaser/viewport.ts`), so scenes lay out in logical px and never see k. `render/tableLayout.ts` turns the canvas width and the notch insets into the table's rects; `render/fanLayout.ts` places the hand's cards at whole logical px.

Size floors (`phaser/theme.ts`) are set for the smallest k designed for, 0.75 (an iPhone SE held sideways with Safari's toolbars showing): no text under 11 CSS px, no control under 44×44 CSS px.

Art ships as one PNG per sprite at 3× the art's pixels (`docs/ASSETS.md`). While Z ≤ 3 it is drawn LINEAR (the cards from a mipmapped power-of-two sheet built at boot, `phaser/cardSheet.ts`); above that, Phaser's smoothPixelArt shader keeps art pixels square and even. Unrotated quads are snapped to device pixels.

## Input

A canvas has no DOM controls. `phaser/widgets.ts` draws Button, IconButton, Switch, Slider and Picker; a tap is a release that has not travelled. The hand (`phaser/table/Hand.ts`) resolves every press to one gesture with the pure functions in `render/handGesture.ts`: a **tap** toggles a card, a sideways **swipe** paints a range of cards selected or unselected, an upward **flick** from a selected legal play plays it, and a **hold** picks a card up to rearrange the fan.

## Performance

- **Render on demand** (`phaser/onDemand.ts`): every frame updates, but the draw is skipped unless a tween is running or something was marked dirty (a store change, input, a resize) in the last moments.
- **One texture for the cards** (`phaser/cardSheet.ts`), so a hand and a trick batch into one draw on mobile, and a **card pool** (`phaser/cardPool.ts`) so a round creates no card objects.
- **Painted textures** (`phaser/paint.ts`) are cached by key; the table prepaints what it will need, and in dev a texture first painted mid-round logs a warning.
- **Lost WebGL context** (`phaser/contextLoss.ts`): the table pauses until the context is restored, then redraws.
- `?perf=1` (dev or production) shows a frame-time overlay and exposes `window.__perf.report()`. `?draw=always`, `?pixels=nearest|linear|smooth` and `?snap=0` are comparison switches.

## Offline

A production build installs a service worker (`platform/offline.ts`) that caches the whole game. `vite.config.ts`'s `tally-offline` plugin walks the built `dist/`, asks `platform/precache.ts` which files to cache, and writes `dist/sw.js` as that plan plus `src/platform/sw.js`:

- **core** (the page, JS, CSS, woff2 font, images, SFX, icons, web manifest) must all cache or the install fails;
- **music** (the five loops, ~12 MB) caches best-effort, one file at a time, and a miss is filled in when the game first fetches it;
- navigations are network-first with a 3 s timeout, falling back to the cached page; listed files are cache-first;
- a new version installs in the background and waits, so a deploy never swaps files under a match. It takes over on the next cold launch, or when the player taps "New version ready" on the title.

The build fails if the precache is over 16 MB, and `npm run check:sw` re-checks `dist/sw.js` against `dist/`. The worker is not registered inside a native shell, which bundles `dist/` instead (`docs/SHELL.md` §7). The title's "Play offline · add to Home Screen" line (`platform/install.ts`) opens Chromium's install dialog or shows the iOS Share steps.

## Hosts

A native WKWebView, an Android WebView or an iframe parent can wrap the game. `platform/bridge.ts` detects the host and carries the postMessage protocol in `platform/bridgeProtocol.ts`: the game sends `ready`, `score`, `matchOver` and `haptic`, asks for and saves its settings through the host, and takes `pause`, `resume` and safe-area `insets` from it. `docs/SHELL.md` is the contract and the embed recipes.

## Tests

| Command | What it covers |
| --- | --- |
| `npm test` | Vitest in node, no DOM: the engine's rules and replay, the AI's legality and determinism, the store's turn loop on a fake clock, the selectors, settings parsing, the audio port against a fake `AudioContext`, the music latch, the layouts and gestures, the bridge and storage ports, the service worker against fake caches, the asset table against the disk, and the layering rules. |
| `npm run sim -- 300` | 300 AI-only games through the real `reduce()`, which throws on any illegal action: 0 illegal actions and 0 stalls, plus win rates per difficulty. |
| `npm run e2e` | `e2e/play.mjs`: one round through the real canvas in headless Chromium, as a sideways iPhone SE (about 15 s). See the README. |
