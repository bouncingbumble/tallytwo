# Plan: React → Phaser

Status: **done — Option B (full Phaser, no React)**, in this folder (`~/Desktop/Tally Two Phaser`, branch `phaser`); the React app is untouched in `~/Desktop/Tally Two`. Phaser **4.2.1**.

What was built, briefly: `GameStore` / `SettingsStore` / audio `director` (PURE, with a fake-clock test of the turn loop); `render/tableLayout.ts` (the CSS grid as tested rects); `src/phaser/` with Boot, Title, Table, Poster, Settings, HowTo, Crash and Rotate scenes, a director that picks scenes, pauses and rebuilds on resize, and a hand-built widget kit (Button, Switch, Slider, Picker, a camera-clipped scrolling sheet). Selects became ‹ › pickers. `e2e/play.mjs` was rewritten against `window.__tally.probe()` and passes 101/101 checks on the four device profiles. Not yet done: a run on real iPhone hardware (audio unlock, WebGL context loss, the Dynamic Island insets), and screen-reader access is down to an aria-live line for the sign and status.

The original plan follows.

## 0. What changes and what does not

Tally Two is already split in a way that makes this tractable. About 60 % of `src/` never touches React:

| Bucket (README): files | Fate |
| --- | --- |
| **PURE** — `engine/`, `ai/`, `render/*.ts`, `game/{appReducer,selectors,cues,copy,timing,seeds}`, `settings/{settings,storage}`, `audio/{sfxTable,pool,musicLatch,port}`, `assets/names.ts` | **unchanged.** Every test, `sim 300` and `tsconfig.core.json` keep working as-is. |
| **WEB, non-React** — `audio/WebAudio.ts`, `platform/{bridge,bridgeProtocol,bridgeStorage,webStorage}`, `assets/manifest.ts` | **unchanged.** Keep `WebAudio` behind `AudioPort`; do *not* switch to Phaser's sound manager (it would lose the latch, the duck, the fade-out-then-in rule and the Firefox `AudioParam` workaround). |
| **HOOKS** — `GameProvider`, `useTurnLoop`, `useBarks`, `useGame`, `SettingsProvider`, `useSettings`, `useAudio` | **rewritten as framework-free stores** (§2). The logic moves almost line for line; only the React plumbing goes. |
| **WEB, React** — `ui/**` (~1,300 lines TSX), `styles/*.css` (~1,900 lines), `platform/use*.ts`, `App.tsx`, `main.tsx`, `dev/DevHook.tsx` | **replaced** by Phaser scenes + a layout module. This is the real work. |

The contracts that must survive: the timing table (`timing.ts`), the 440-px logical canvas and k (§10 of ARCHITECTURE), integer rest poses, 3x assets drawn smoothed / pixelated when upscaled, the shell protocol, the crash-report path, the size floors (11 CSS px text, 44x44 targets at k = 0.75), and `?seed=`.

## 1. The one decision to make first

| Option | What Phaser draws | What stays DOM | Trade-off |
| --- | --- | --- | --- |
| **A. Hybrid (recommended first milestone)** | title, table, hand, trick, seats, barks, banner, poster | Settings sheet, How-to sheet, Crash screen, `/assets` page — as a thin DOM overlay (React kept *only* here, or vanilla TS) | Forms (sliders, switches, selects, copy-to-clipboard, scrolling text) are free and accessible in the DOM and costly in a canvas. Smallest risk. |
| **B. Full Phaser** | everything | nothing but the `<canvas>` | Removes React entirely; needs a hand-built (or `rexUI`) slider/switch/scroll-panel kit, and loses screen-reader access to cards and controls. |

The plan below is written so A is a complete, shippable stopping point and B is one more phase (§8) on top of it.

## 2. Phase 1 — Extract framework-free stores (no visual change)

Goal: the game runs headless; React becomes one subscriber among possibly several. Ship this before writing any Phaser.

1. **`src/game/store.ts`** — `class GameStore` with the body of `GameProvider`:
   - state: `AppState` (via `appReduce`), `selection`, `crash`, `barks`, `announcement`, the `aiRng`.
   - methods: `act(a)`, `actAi(seat, diff)`, `toggleCard(v)`, `setSelection(cards)`, `setRules(rules)`.
   - derived (memoised by identity of `game` / `selection`, same as today's `useMemo`s): `legal`, `exact`, `live`, `canPass`, `status`, `sign`.
   - `subscribe(fn): unsubscribe` and `getSnapshot(): GameApi` (a new object only when something changed — the same reference-stability rule as ARCHITECTURE §6).
   - constructor takes `{ audio: AudioPort, shell: ShellPort, clock: ClockPort, opts: () => Opts }`.
2. **`src/game/clock.ts`** — `ClockPort { after(ms, fn): cancel }`. Web: `setTimeout`. Later the Phaser adapter can be `scene.time.delayedCall`, which pauses with the scene for free. PURE-compatible interface, so the store can sit in `tsconfig.core.json` (it no longer needs `setTimeout` directly).
3. **`src/game/turnLoop.ts`** — `useTurnLoop`'s effect becomes `store.#rearm()`, called after every state change and on `setPaused(bool)` / opts change: cancel the one pending timer, compute the same branch (roundover → `SCORE_ROUND`, AI → `actAi`, human → nothing), arm one new one. The "every branch returns clearTimeout" invariant becomes "one `cancel` handle, always cleared first".
4. **Barks / announcement** — the `BARK_MS` and `FINAL_ROUND_MS` expiry timers move into the store on the same clock.
5. **`src/settings/store.ts`** — `SettingsStore` around the existing `settingsReduce`, hydrate from `StoragePort`, persist on change, `subscribe`.
6. **`src/audio/audioDirector.ts`** — `useAudio`'s music/bus/tension decisions become a subscriber of both stores: `musicFor(game, sheet)`, `tensionFor(game)`, `setBus`, `suspend/resume`.
7. React adapts with `useSyncExternalStore(store.subscribe, store.getSnapshot)`; `GameProvider` shrinks to "create store once, put it in context".

Tests: port `GameProvider.test.ts` to `store.test.ts` with a fake `ClockPort` (manual `tick(ms)`), which makes the turn loop directly testable for the first time (AI think delays, pause, quit-during-think, crash-leaves-no-timer). `boundary.test.ts` gains: `game/store.ts`, `turnLoop.ts`, `clock.ts` must import neither `react` nor `phaser`.

Exit: `npm run check` green, `e2e/play.mjs` green, no diff a player can see.

## 3. Phase 2 — Phaser bootstrap behind a flag

1. `npm i phaser@4` (≈ 1.2 MB min / ~340 KB gz — today's JS is tiny, so check the budget; Phaser 4 supports a custom build to trim physics etc.).
2. **`src/phaser/boot.ts`** — `new Phaser.Game({ type: AUTO, parent, transparent: false, backgroundColor: "#241408", scale: { mode: Phaser.Scale.NONE }, input: { activePointers: 2 }, render: { antialias: true, roundPixels: true } })`.
3. **Scale = the existing logical canvas.** Keep `render/scale.ts` `fitScale()` as the source of truth. On `resize` / `visualViewport.resize`:
   - canvas backing size = viewport × `devicePixelRatio` (crisp on phones), CSS size = viewport;
   - main camera `zoom = k × dpr`, scroll (0,0); every scene lays out in logical px (440 tall × `logicalWidth`), exactly like the CSS does now;
   - `upscaled` (k ≥ 1) → `texture.setFilter(NEAREST)` on the art textures, else `LINEAR` — the one rule in `sprites.css` today.
   - Assets stay one 3x PNG: load once, draw with `setDisplaySize(artW, artH)` in logical px.
4. **`PreloadScene`** — load from `assets/manifest.ts` URLs (Vite still hashes them): `cards_atlas.png` as a **spritesheet** (frameWidth 288, frameHeight 384 at 3x; frame index from `render/atlas.ts` `atlasCell` → `row * 13 + col`, so `atlas.test.ts` keeps pinning it), `card_back.png`, the 27 sprites. Wait for `document.fonts.load("16px Rye")` before the first text object (Phaser `Text` rasterises once; a late font means a wrong glyph cache).
5. **Mount** — `?renderer=phaser` (and later the default) renders `<PhaserHost/>`, a div that owns the `Phaser.Game`, instead of `<TableScreen/>`. The two renderers read the same `GameStore`, so they can be compared side by side on the same seed.

## 4. Phase 3 — The table scene (the bulk)

### 4.1 Layout: CSS grid → a pure module

`table.css` (569 lines) is mostly geometry. Move it to **`src/render/tableLayout.ts`** (PURE, unit-tested): `tableLayout(logicalW, insets, notchSide) → { felt, side, hand, badges[4], playRows, sign, status, buttons[], topBar }` as integer logical rects. Constants come over from `tokens.css` (`--edge` 16, side 136, hand row 122, card 96x128, play card 72x96, `--tap` 60, font floors 15/16/18). `scale.test.ts`'s three device targets get a `tableLayout.test.ts` twin asserting the same numbers the e2e checks today (fan step 44/58/37, strip widths 532/711/993).

### 4.2 Component → game object map

| React today | Phaser | Notes |
| --- | --- | --- |
| `Felt.tsx`, `Seat.tsx` | `TableScene` container: `TileSprite` felt (32-px tile) and wood (96-px), three `Seat` containers (portrait at 85 %, name, card-back chips, tally, `.low` tint) | |
| `Card.tsx` | `class CardSprite extends Phaser.GameObjects.Sprite` — frame from `atlasCell`, states `selected` (y −`SELECT_LIFT`), `dim` (tint/alpha) | |
| `Hand.tsx` (drag, reorder, suit-sort runs) | `HandView` — positions from `fanLayout()`; `setInteractive({ draggable: true })`, `input.dragDistanceThreshold = 6` replaces the manual threshold; `dragend` without travel = tap → `store.toggleCard`; neighbours tween to the slot nearest the dragged card's left edge (0.16 s); order state per `dealId` as today | Pointer → logical px is just `pointer.worldX` (camera zoom does the ÷k). |
| `Pile.tsx` (`TrickSlot` ×4) | `TrickView` — rows from `tableLayout.playRows`, cards at `PILE_STEP` (min 12), latest amber outline (a `Graphics` rect or a pre-tinted frame), older dimmed | |
| `Sign.tsx`, `StatusLine.tsx`, `TopBar.tsx` | `Text` objects (Rye / body font) + 9-slice plaque (`NineSlice`) | Text from `copy.ts` / `selectors` exactly as now. |
| `Controls.tsx` (Play / Pass / Hint) | `Button` container: 9-slice + text + hit area ≥ `--tap` (60 logical px), enabled from `exact` / `canPass` | |
| `Bark.tsx`, `Announcement.tsx` | `Container` + tween (`barkin`, `announce` keyframes → tween timelines) | |
| `Saloon.tsx` | static props in a 900-px container behind the hand, clipped with a geometry mask to the strip | |
| `ResultsPoster.tsx` | `PosterScene` launched over `TableScene` (`scene.launch`, input on top) | Option A could leave this DOM, but it is art-heavy — do it in Phaser. |

### 4.3 Rendering from state

One `store.subscribe` in `TableScene`. Diff by identity, not a virtual DOM: `game` changed → reconcile seats, trick, hand set; `selection`/`live` changed → restyle cards only; `barks`/`announcement` changed → spawn/expire views. Cards are pooled by `Card` value (52 sprites, created once in `create()`), never destroyed mid-round — this replaces the "render in value order so the CSS animation does not restart" trick in `Hand.tsx`.

### 4.4 Motion (`motion.css` → tweens)

| Keyframes | Tween | Timing source |
| --- | --- | --- |
| `deal` | from (−40 % w, −38 % h, −40°, 0.6) to fan slot, stagger `DEAL_STAGGER_MS` | `timing.ts` |
| `fly` | two-stage chain: portrait origin → stack at play centre (58 %, cubic-bezier → `Cubic.Out`) → spread with `Back.Out`; stagger `PLAY_FLY_STAGGER_MS`; total `PLAY_FLY_MS` | origin from the badge rect in `tableLayout` (no more `getBoundingClientRect` in a layout effect) |
| select lift | 160 ms y tween | `SELECT_MS` |
| `barkin`, `announce` | alpha/scale timelines | `BARK_MS`, `FINAL_ROUND_MS` |
| `frame-*` (doors) | frame swaps on `time.delayedCall` | `DOORS_MS` |

Every tween ends with `x = Math.round(x)`, `angle = 0` — the integer rest pose rule. `prefers-reduced-motion` → a global `motionScale` that sets durations to 0 (bark/announce still appear and expire on their timers, as now). No timing number is written outside `timing.ts`; extend `boundary.test.ts` to grep `src/phaser/**` for numeric `duration:` / `delay:` literals.

## 5. Phase 4 — Title scene

`TitleScene`: saloon front (sign, batwing doors in three frames, barrel + lamp, chips, stool, plant, painting, floorboards), corner decor only when `logicalWidth ≥ 900`. Buttons Deal me in / How to play / Settings — each calls `audio.init()` (the iOS unlock must stay on a real user gesture: Phaser input runs inside the native `pointerup`, which Safari accepts; verify on device). Deal → doors tween → `store.act(NEW_MATCH)` → `scene.start("Table")`.

Scene graph: `Boot → Preload → Title ⇄ Table (+ Poster overlay)`. A `crash` in the store stops input and shows the Crash screen (§6).

## 6. Phase 5 — Overlays and the app shell (Option A)

- Settings, How-to, Crash screen and `/assets` stay DOM, mounted in a `<div class="overlay-root">` above the canvas. Keep React for these (4 components) or rewrite them in ~300 lines of vanilla TS — decide here. Either way they talk only to `GameStore` / `SettingsStore`.
- While an overlay is open: `input.enabled = false` on the active scene so taps don't go through.
- The DOM overlay must be scaled by the same k (`transform: scale(k)` on its root, as `.game` is now) so `tokens.css` floors still hold.
- `ErrorBoundary` → `window.addEventListener("error" | "unhandledrejection")` + a Phaser scene `try/catch` around `update` subscribers, routed to the same Crash screen; `tryReduce` stays the one place engine throws are caught.

## 7. Phase 6 — Platform glue

| Today (React hook) | After |
| --- | --- |
| `usePageVisibility`, `useBridgePause`, `usePortraitBlock` | one `pauseController`: any source → `store.setPaused(true)`, `game.loop.sleep()` + `audio.suspend()`; Phaser also auto-pauses on `hidden` — keep exactly one owner |
| `useFitScale`, `useElementSize/Width` | §3.3 resize handler; element measurement disappears (layout is computed, not measured) |
| `useNotchSide`, `useBridgeInsets` | feed `{ notchSide, insets }` into `tableLayout()` instead of CSS custom properties; `env(safe-area-inset-*)` is read once via a hidden probe div when no shell sends `insets` |
| `useBridgeReady` | `bridge.send("ready")` after the first `TableScene`/`TitleScene` `create()` |
| `document` `pointerdown` → `audio.resume()` | unchanged (keep on `document`, not on Phaser input) |
| `RotatePrompt` | DOM overlay + pause, unchanged behaviour |
| `DevHook` (`window.__tally`) | `window.__tally = { act, game, store, scene }` in DEV — and the e2e hook below |
| `shell.css`, viewport meta | unchanged; add `canvas { touch-action: none }` |

## 8. Phase 7 — Tests and gates

- **Unit (vitest, node)**: everything PURE unchanged; new `store.test.ts`, `turnLoop.test.ts`, `tableLayout.test.ts`, `pauseController.test.ts`. Phaser needs a DOM, so scene classes are thin and contain no rules or geometry — the readability contract ("an `if` about the rules belongs in `selectors.ts`") now also says "a number about layout belongs in `tableLayout.ts`".
- **`boundary.test.ts`**: new bucket **SCENE** = `src/phaser/**` — may import PURE + stores + `platform/` + `assets/manifest`, never `engine/reducer` or `ai/*` as values (same rule as `ui/` today), never `react`.
- **`tsconfig.core.json`**: add `game/store.ts`, `game/turnLoop.ts`, `game/clock.ts`, `render/tableLayout.ts`.
- **`e2e/play.mjs`** (296 lines) — it queries `.game`, `.card` rects and CSS transforms, which a canvas does not have. Rewrite against a DEV/test-only `window.__tally.probe()` that returns every game object's logical rect, frame, rest transform and text size, plus `page.mouse` taps/drags at computed screen positions. Keep every current check: canvas = viewport, k, card = 96k × 128k, fan step ≥ 34, whole-px rest poses, drag reorder, zero-sum posters, settings persisted, no console errors, text ≥ 11 CSS px and targets ≥ 44x44 at 667x331. Add a screenshot diff against Phase-0 baselines per device.
- **lint**: `react/rules-of-hooks` goes away with React (Option B); keep oxlint defaults.

## 9. Phase 8 (Option B only) — Remove React

Rebuild Settings / How-to / Crash / `/assets` in Phaser (slider, switch, segmented select, scroll panel, copy-log button via `navigator.clipboard`), add an offscreen ARIA live region for status text, then delete `react`, `react-dom`, `@types/react*`, `@vitejs/plugin-react`, `ui/`, `styles/{table,cards,sprites,motion,overlays,buttons}.css`, `platform/use*.ts`, `*Provider.tsx`, `useGame.ts`. `main.tsx` → `main.ts`: create stores, `WebAudio`, storage pick, `new Phaser.Game`.

## 10. Phase 0 — Before any of it

1. Commit or stash the current WIP (`ai/heuristic.ts`, `ai/lookahead.ts`, `timing.ts`, `useTurnLoop.ts`, `Hand.tsx`, `table.css` are modified/untracked).
2. Capture baselines: `e2e/play.mjs` screenshots for SE, SE-toolbar, i15, desktop on `?seed=3`.
3. **Spike (1–2 days, throwaway)**: Phaser 4 on a real iPhone held sideways — 13-card hand + 4 plays, dpr 3 backing canvas, LINEAR vs NEAREST filtering of the 3x atlas at k 0.85, Rye text crispness at 15 px × k, drag latency, WebGL context loss on background/foreground, and `audio.init()` from a Phaser button unlocking Safari audio. Go/no-go on these before Phase 2.

## 11. Rough effort

| Phase | Size |
| --- | --- |
| 0 Spike + baselines | 1–2 d |
| 1 Stores (no visual change) | 2–3 d |
| 2 Bootstrap + scale + preload | 1–2 d |
| 3 Table scene + layout + motion | 6–9 d |
| 4 Title | 1–2 d |
| 5–6 Overlays, shell, platform | 2–3 d |
| 7 Tests, e2e rewrite, docs (`ARCHITECTURE.md` §3, §5, §6, §9, §10; README folder map) | 3–4 d |
| **A total** | **~3–4 weeks** |
| 8 Full Phaser UI | +1–2 weeks |

## 12. Risks

| Risk | Mitigation |
| --- | --- |
| Text in canvas looks soft or misses the 11-px floor | dpr-sized backing canvas + camera zoom; `Text.setResolution(dpr)`; e2e probe checks size |
| Accessibility regression (cards and buttons are `<button aria-label>` today) | Option A keeps forms in the DOM; add a hidden live region for status/sign; accept cards are not screen-reader tappable, or mirror them in a hidden DOM list |
| Bundle grows ~30× | custom Phaser build without physics; it is a one-time download in a shell |
| Turn-loop regressions ("the AI hesitates") | Phase 1 makes it a testable class with a fake clock before any renderer changes |
| Two renderers drifting during Phase 3 | `?renderer=phaser` flag, same store, same seed; delete the DOM table the day the Phaser one passes e2e |
| iOS audio unlock / WebGL context loss | spike on hardware first (§10.3); `game.renderer.on("contextrestored")` re-uploads textures |
