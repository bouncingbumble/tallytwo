# Plan: highest FPS, smoothest motion, best sound, clearest pixels

Status: **executed** (branch `perf`). Scope: the Phaser 4.2.1 build (`src/phaser/**`, `src/audio/WebAudio.ts`, `src/main.ts`).
Targets: iPhone Safari held sideways (dpr 3, k ≈ 0.75–0.9, 60/120 Hz) and desktop Chrome (dpr 1–2, k > 1, 60–144 Hz).

## Results

Measured with `e2e/perf.mjs` (one round of `?seed=17` at Card sharp on Fast; `e2e/perf/baseline.json` before, `after.json` after). Headless browsers render with SwiftShader, so frame intervals are relative; draw calls, uploads, main-thread work and long tasks compare directly. Real-device numbers come from `?perf=1` on the phone.

| WebKit, iPhone 15 profile (852x393 @3, iOS UA) | before | after |
| --- | --- | --- |
| AI move on the main thread, p50 / max | 14 / 124 ms | **0** (worker) |
| draw calls per drawn frame, p50 / max | 82 / 103 | **42 / 46** |
| texture uploads in a round | 524 (52 MB) | **309 (43 MB)** |
| long tasks / frame gaps > 50 ms in a round | 10 (max 139 ms) | **2** (max 112 ms: a scene cut) |
| hitches (frame > 1.5x median) | 21 | **3** |
| first deal (NEW_MATCH: table built) | 138 ms | **52 ms** (textures prewarmed on the title) |

**New finding during execution:** Phaser's `autoMobileTextures` (default on) batches **one texture per draw on iOS and Android**. That is why a card drawn as shadow + face + ring from three textures cost up to three draw calls, and why the iPhone draw count was 8x desktop's. The fix was to put every card layer in one sheet and bake the static saloon strip, not to turn multi-texture batching on: the single-texture shader is the cheaper one on mobile GPUs.

| # | Item | Status |
| --- | --- | --- |
| 0 | `?perf=1` overlay + `window.__perf`, `e2e/perf.mjs` benchmark with gates | done (`phaser/perf.ts`) |
| 1.1 | AI in a Web Worker, deterministic | done: `game/think.ts` (`ThinkPort`, `thinkNow`), `platform/aiWorker.ts`, `platform/think.ts` (falls back to the main thread if a worker cannot start or dies); RNG state crosses as a number (`engine/cards.ts` `seededRng`); the move plays when both the think delay and the answer are in, and a stale answer consumes nothing. Hints stay on the main thread: they use Regular's heuristic (well under a ms), not the lookahead. |
| 1.2 | Renderer config | done: `antialiasGL: false`. Kept `mipmapFilter` global (it only ever applies to POT textures in WebGL 1, i.e. the card sheet). **Not** `powerPreference: "high-performance"`: on a dual-GPU Mac it wakes the discrete GPU (a switch hitch at launch, battery) for a game that idles at zero draws. |
| 1.3 | Render-on-demand | done: `DIRTY_MS` 300 → 150; a mouse moving with no button down no longer redraws (nothing changes on hover). The tween scan was left: it is a handful of small arrays a frame. |
| 1.4 | Texture batching | done, differently: one runtime card sheet (`phaser/cardSheet.ts`) instead of a painted-UI atlas, plus the saloon strip baked into one texture (`table/Saloon.ts`), the seats' chip Graphics replaced by Images. Portraits were not baked into the badges: the active ring overlaps the portrait by a pixel and baking would change the look. |
| 1.5 | 120 Hz | done: nothing assumes 60 Hz; `docs/SHELL.md` documents `CADisableMinimumFrameDurationOnPhone` and Safari's 60-fps flag. |
| 2.1 | Prewarm | done, as the real thing: the title starts the Table scene hidden while idle (`TableScene.prewarm`) so every painted texture it draws is cached through the same code path; the card frames are painted into the sheet at boot. |
| 2.2 | BitmapText | **not done, by measurement**: the re-rasters were mostly redundant — `setColor` re-rasterises even to the same colour, and `.setText().setColor()` drew twice. `setTextColor()` (`paint.ts`) does both in one raster or none; per-play re-rasters fell to the texts that really changed. BitmapText would also cost Rye's look at small sizes. |
| 2.3 | Frame-aligned game clock | done: `platform/clock.ts` `frameClock`, pumped on Phaser's `PRE_STEP`, with a setTimeout fallback when no frame comes. |
| 2.4 | Audio-clock scheduling | done: the deal roll's ticks and the duck's lift are scheduled on `ctx.currentTime`; no audio timers remain. |
| 2.5 | Easing | done: the 640-ms settle is `Cubic.Out`; the 160-ms slide keeps its overshoot. The settle snap comes from 3.2. |
| 2.6 | Input latency | already true (the dragged card follows the pointer with no tween); `desynchronized` not used (tearing). |
| 3.1 | smoothPixelArt | done, with the threshold at Z > 3 (the art files are 3x: below that the art is being shrunk, where LINEAR from 3x is the clean resample). `?pixels=` switch. NEAREST is gone (it was also wrong for 2 ≤ Z < 3 on dpr-2 desktops). |
| 3.2 | Device-pixel snapping | done in the renderer instead of in every layout: unrotated quads round their corners to device px (`viewport.ts` `installCrispVertices`, Phaser 4's `willRoundVertices`); a card in flight is left unsnapped so it never wobbles. Layout stays in whole logical px (the e2e gate is unchanged). `?snap=0` switch. |
| 3.3 | Exact canvas size | not needed: the canvas is sized from `innerWidth × dpr` and shown at `1/dpr` zoom already, and the e2e gate checks it is the viewport. |
| 3.4 | Atlas gutters + mipmaps | done at runtime (no PNG change): the card sheet copies each face with a transparent art pixel round it and 8 texels between frames, 4096x2048 so WebGL 1 mipmaps it. The raw atlas and back textures are released after (~23 MB of GPU memory). |
| 3.5 | Text | done via 3.2 (snapped origins); text already rasterises at Z. |
| 3.6 | Max texture size | the sheet is 4096 wide; every target reports ≥ 8192. |
| — | Baked art | `paint.ts` `drawArt` / `artPattern`: art inside painted textures (the saloon, the wood and felt) is drawn "sharp bilinear" — nearest-neighbour up by a whole factor, then a smoothed resample — the canvas twin of smoothPixelArt. |
| 4.1 | Re-encode from masters | **not done**: the Ogg masters are not in the repo or on this machine (`mdfind` finds only the AAC copies), and re-encoding AAC would lose more. Needs the original pack. |
| 4.2 | Music memory | done: the table and tension loops stay decoded (every round needs them); a poster loop (results, round won, match won) is released once it is neither wanted nor sounding, and decoded again next time (`WebAudio.release`, `musicLatch.forget`). Peak: 3 decoded loops instead of up to 5. |
| 4.3 | Master limiter | done as a **soft clipper** (WaveShaper, exactly linear below 0.8, tanh to 1.0) instead of a DynamicsCompressor: the compressor's automatic makeup gain would have changed the mix's level; the clipper changes nothing until a peak would clip. |
| 4.4 | Seat panning | done: a seat's own cards (play, five, pass, last card, round win) pan to its badge (`SEAT_PAN` -0.35 / 0 / +0.35, the player 0). |
| 4.5 | Variation | done: ±1.5 dB level jitter per play on top of the ±4 % pitch jitter. The random start offset was dropped: the deal ticks are now sample-accurate on purpose. |
| 4.6 | Context / audio session | `navigator.audioSession.type = "ambient"` (iOS 17+): the silent switch mutes the game and the player's music keeps playing — iOS's existing default, now explicit. `latencyHint` left at its default ("interactive"). |
| 4.7 | Fade curves | **not done**: a track switch is a fade-out then a fade-in, never a crossfade, so equal-power does not apply; and swapping the linear ramps for value curves interacts badly with `cancelScheduledValues` across browsers (the Firefox caveat in `WebAudio.ts`). |
| 5 | Load | done: SFX bytes are fetched at boot (`WebAudio.preload`) so the first tap only decodes; the Rye download starts at boot. Not done: a custom Phaser build (Phaser 4 ships one prebuilt bundle; it is a one-time ~400 kB gz download). |
| 6 | Gates | done: `e2e/perf.mjs` fails on a main-thread AI move, a page error, or > 60 draws a frame on the iPhone profile; unit tests for the worker path (same moves as on the spot, both-halves timing, stale answers, rejection → crash), `seededRng`, `frameClock`, the deal roll's schedule, the duck's schedule, panning, the soft clipper, preload and loop release. `npm run check` and `e2e/play.mjs` (93 checks) pass. |

Still on the main thread, by design: building a scene (52 ms for the table, ~100 ms for the poster with its 47 texts in headless WebKit). Both happen on a scene cut, when nothing is moving.

## What is already good (keep it)

- Backing canvas = viewport × dpr and camera zoom Z = k·dpr (`viewport.ts`), so the browser never resamples the canvas.
- Cards are built only from Images, so they draw as one batch (`cards.ts`); painted UI is cached by key + resolution (`paint.ts`).
- Render-on-demand (`onDemand.ts`): idle frames skip the draw, which saves battery and avoids thermal throttling.
- Audio uses Web Audio with decoded buffers, sample-accurate `loopEnd` and scheduled fades (`WebAudio.ts`).

## Findings, ranked by impact

| # | Area | Finding | Where |
| --- | --- | --- | --- |
| F1 | FPS | **Card sharp AI runs on the main thread**: ~10 ms per move and up to 82 ms in the worst case (README). It runs while the previous play's fly tween is animating, which drops 1–5 frames at 60 Hz and more at 120 Hz. | `store.ts` `actAi` → `aiTurn` |
| F2 | Smoothness | Lazy rasterization in the middle of an animation: `painted()` creates canvas textures on first use, and every `Text.setText` re-rasterizes text and uploads a texture. Both are main-thread canvas work plus GPU uploads, done when a card first lifts, a ring first shows, or a count or tally changes. | `paint.ts`, `Seat.ts`, `Side.ts` |
| F3 | Smoothness | The game clock is `setTimeout`, so deal ticks, AI turns and bark expiry are not aligned to frames or to the audio clock. That causes jitter and a few ms of drift between sound and motion. | `platform/clock.ts`, `dealRoll` |
| F4 | FPS | `antialiasGL` defaults to **true**, which adds MSAA on a ~2556×1179 backbuffer at dpr 3. Everything here is textured quads, so MSAA buys almost nothing and costs fill rate and bandwidth. | `main.ts` config |
| F5 | Pixels | When upscaled (desktop, Z ≈ 2–4), the 3x art is drawn **NEAREST at a non-integer ratio** (e.g. 4/3), so art pixels come out 1 or 2 device px wide (uneven) and shimmer while tweening. | `viewport.ts` `applyArtFilter` |
| F6 | Pixels | Rest poses are whole *logical* px, but Z is fractional, so art and text edges land between device pixels and look slightly soft. | `Hand.ts`, `Trick.ts`, `fitCamera` |
| F7 | Pixels/FPS | `mipmapFilter: LINEAR_MIPMAP_LINEAR` is set globally. The atlas cells are packed edge to edge with no gutter, so mips and LINEAR filtering bleed neighbouring cards into the edges at the 72×96 play size and on rotated flies. | `main.ts`, `cards_atlas.png` |
| F8 | Sound | The audio is a **lossy-to-lossy transcode** (Ogg Vorbis → AAC at 128/160 kb/s). | `docs/ASSETS.md` §4 |
| F9 | Sound/stability | Music is fully decoded: about 119 s × 48 kHz × 2 ch × 4 B ≈ **45 MB per loop**. With table, tension and results loaded that is roughly 135 MB of PCM, which can trigger iOS memory-pressure reloads. | `WebAudio.ts` `ensure` |
| F10 | Sound | There is no master limiter, so stacked slaps, the deal roll and music can clip. Everything is mono-centred. | `WebAudio.ts` graph |
| F11 | FPS (minor) | `animating()` calls `getTweens()` (which allocates an array) for every scene on every frame. `DIRTY_MS` = 300 ms of full draws after every pointermove. | `onDemand.ts` |

## Phase 0 — Measure first (½–1 day)

1. Add a **`?perf=1` overlay**: fps, frame-time p50/p95/p99, frames skipped by on-demand, draw calls, texture count, and long tasks (`PerformanceObserver({ type: "longtask" })`). Draw it in a DOM `<div>`, not on the canvas, so it does not dirty the canvas.
2. Run a **scripted benchmark** with `e2e/play.mjs` on `?seed=17&perf=1`: deal → 10 plays at Card sharp. Dump the overlay stats with `window.__tally.perfReport()`.
3. Record a **baseline on real hardware**: an iPhone (Safari Web Inspector → Timelines → Frames) and desktop Chrome (Performance panel, CPU 4× throttle).
4. **Budget** (the gate for every later phase): p99 frame time < 16.7 ms on iPhone, < 8.3 ms on a 120 Hz desktop; zero long tasks > 50 ms during play; no hitch > 1 frame on the first selection, ring or bark.

## Phase 1 — Frame rate (1–2 days)

1. **Move the AI into a Web Worker** (F1). The engine and AI are PURE (no DOM), so `new Worker(new URL("./ai/worker.ts", import.meta.url), { type: "module" })` can import them unchanged.
   - `GameStore` asks through a `ThinkPort { think(game, seat, rngState, diff): Promise<Action> }`.
   - The think delay already exists (`pacedThink`), so start the worker when the turn begins and act at `max(thinkDelay, workerDone)`. The extra latency is effectively zero.
   - Keep determinism: pass and return the RNG state so `?seed=` and `sim 300` still reproduce exactly. The sim and tests keep calling `aiTurn` directly.
   - Do the same for `selectors.ts` hints (`chooseMove` for the human hint).
2. **Renderer config** (F4, F7):
   ```ts
   render: { antialias: true, antialiasGL: false, roundPixels: false, powerPreference: "high-performance",
             mipmapFilter: "" /* per texture instead */, maxTextures: -1 },
   fps: { smoothStep: true }   // no limit: rAF follows 60/120/144 Hz
   ```
   Turn on mipmaps only for the card atlas, and only once it has gutters (Phase 3.4).
3. **Tighten render-on-demand** (F11). Keep a counter of live tweens (`tweens.on("active"/"complete")` per scene) instead of scanning. Cut `DIRTY_MS` from 300 to about 100, and mark dirty on `pointermove` only while a pointer is down or over an interactive object.
4. **Texture batching.** Pack the painted textures (shadows, rings, plaques, buttons) into one runtime `DynamicTexture` atlas per resolution. A hand then draws with ≤ 2 textures (atlas + UI sheet). Verify the draw-call count in the overlay.
5. **120 Hz.** Make sure nothing assumes 60 Hz: all motion goes through tweens and delta. iOS Safari needs Settings › Safari › Advanced › Feature Flags "Prefer Page Rendering Updates near 60fps" turned off (iOS 18+ is on by default). A WKWebView shell needs `CADisableMinimumFrameDurationOnPhone = YES` in Info.plist. Document both in `docs/SHELL.md`.

## Phase 2 — Smooth animation (1–2 days)

1. **Prewarm everything in `Boot`** (F2). Paint every `painted()` key at the current resolution (card shadow and deep shadow, both rings, buttons, plaques, bark bubble), then draw one off-screen frame so the GPU uploads happen at load time. Repeat on a fit or dpr change.
2. **BitmapText for changing numbers and short labels** (F2). Seat counts, tallies, round number and score deltas change constantly. Generate a Rye + sans bitmap font at boot from `Text` (`RetroFont`/`DynamicBitmapText`, or a pre-rendered atlas at Z). After that, `setText` costs no raster and no upload. Keep `Text` only for long wrapped copy that rarely changes.
3. **Frame-aligned game clock** (F3). Add `phaserClock: ClockPort` backed by `scene.time.delayedCall` on a persistent scene. Timers then fire on a frame boundary, pause with the game (one owner for pause), and never fire mid-frame. Keep `timerClock` for tests and headless use.
4. **Schedule sound on the audio clock**, not with timers. `dealRoll()` already knows its schedule (`260 + k·110 ms`), so compute `ctx.currentTime + offset` for each tick and `source.start(when)` them all at once. Visual deal staggers use the same offsets, so sound and motion line up within 1 ms.
5. **Easing review.** Replace `Back.Out` overshoot on the 640 ms settle with a critically damped spring (or `Cubic.Out`), because a long overshoot reads as wobble. Add a 1-frame **settle snap**: on tween complete, set x/y to the device-snapped rest pose (Phase 3.2) so there is no sub-pixel jump.
6. **Input latency.** Drag follows `pointermove` directly (no tween) and marks dirty so that frame draws. Tweens toward the new slot start on the same frame. Consider `input.windowEvents` and `desynchronized: true` (Chrome only; test for tearing) to shave about one frame on desktop.

## Phase 3 — Clearest pixels (2–3 days)

1. **`smoothPixelArt` for upscaled art** (F5). Phaser 4 has a per-texture setting: `texture.setSmoothPixelArt(true)` with the LINEAR filter. Its shader keeps art pixels square and uniform at *any* ratio and anti-aliases only the edges between pixels. So:
   - k ≥ 1 (desktop): LINEAR + `smoothPixelArt` on every art texture (replaces NEAREST: no uneven pixels, no shimmer while moving).
   - k < 1 (phone): keep plain LINEAR from the 3x source (already a clean "sharp-bilinear" downscale).
   - Make it a `?pixels=nearest|smooth|linear` switch and compare screenshots per device.
2. **Snap rest poses to device pixels** (F6). Replace `Math.round(x)` (logical) with `snap(x) = Math.round(x * Z) / Z` in `Hand`, `Trick`, `Seat`, `Side` and text placement. Add it to `viewport.ts` and use it everywhere a rest pose is set. The e2e probe checks `x * Z` is an integer.
3. **Exact canvas size.** Read the true device-pixel size from `ResizeObserver` `devicePixelContentBoxSize` (Chrome) and fall back to `round(vw * dpr)`. Set the canvas CSS size to exactly `backing / dpr`, so the browser never resamples by a fraction of a pixel.
4. **Atlas gutters** (F7). Re-pack `cards_atlas.png` with 2–4 px of extruded (edge-copied) gutter per cell, update `render/atlas.ts` and `atlas.test.ts`, and then enable `LINEAR_MIPMAP_LINEAR` on the atlas only. Play cards at 72×96 and rotated flies then stay clean with no neighbour bleed. Optionally give the rounded corners a 1 px transparent border so rotated edges are anti-aliased by the texture filter (that is why MSAA can stay off).
5. **Text.** Text rasterizes at `resolution()` = Z rounded up to ¼, which is good. Also snap text origins to device px, avoid `setScale` on Text (re-rasterize instead), and use integer `fontSize × Z` where the floor allows it. Rye's thin strokes benefit from a 1 px dark `shadow` at small sizes (already in the theme; verify at k = 0.75).
6. **Max texture size guard.** If an integer pre-scale is ever used (e.g. a 4x atlas = 4992 px wide), check `gl.MAX_TEXTURE_SIZE` and split the atlas by suit rows.

## Phase 4 — Best sound (1–2 days, plus asset work)

1. **Re-encode from the best masters** (F8). Get the original WAV or FLAC masters from the pack author if they exist. Otherwise re-encode from the Ogg masters at higher quality: AAC-LC 256 kb/s VBR for music (`afconvert -f m4af -d aac -s 3 -q 127 -u vbrq 127`) and 192 kb/s for SFX. Keep 44.1 kHz and the gapless priming check from `ASSETS.md` §4. Optionally ship an Opus/WebM twin chosen by `canPlayType` for codec-less Chromium.
2. **Bound music memory** (F9). Keep at most two decoded loops (current + its partner, i.e. table ↔ tension). Release the results loop's buffer when leaving the poster. Alternatively, stream long music through `<audio>` → `MediaElementAudioSourceNode` and keep decoded buffers only for gapless loop pairs. Measure with Safari's memory timeline.
3. **Master chain** (F10): `buses → DynamicsCompressor (threshold −6 dB, ratio 4, attack 3 ms, release 120 ms) → master gain (−1 dBFS ceiling) → destination`. This prevents clipping when slaps stack on music.
4. **Seat panning**: a `StereoPannerNode` per SFX play, panned by the acting seat (left seat −0.35, top 0, right +0.35, you 0). Card sounds then come from where the cards come from. Make it subtle and honour mono or headphones the same way.
5. **Variation**: keep the ±4 % pitch jitter, add ±1.5 dB gain jitter and a short random start offset (0–5 ms) to break up machine-gun repeats during the deal.
6. **Context setup**: `new AudioContext({ latencyHint: "interactive" })`. On iOS 17+ set `navigator.audioSession.type = "playback"` (or `"ambient"` to respect the silent switch). Choose one deliberately and add a setting if needed.
7. **Fades**: use `setTargetAtTime` or equal-power curves (`setValueCurveAtTime`) for music in/out instead of linear ramps, which audibly "drop" at the end.

## Phase 5 — Load and startup smoothness (½ day)

- Fetch SFX in parallel during `Boot` (now they load only after `init()` on the first tap). Decode after the gesture, or decode immediately because `decodeAudioData` works on a suspended context. The first slap is then never silent.
- Preload the table music file bytes during `Boot`, but defer decode until it is needed.
- `<link rel="preload" as="font">` for Rye, plus `modulepreload` for the Phaser chunk.
- Consider a custom Phaser build (no physics, no Matter, no audio) to cut roughly 30–40 % of the ~400 kB gz bundle.

## Phase 6 — Gates (so it stays fast)

- `e2e/play.mjs` gains a perf pass: on `?perf=1`, assert no long task > 50 ms during play and p95 frame time under budget in Chromium (WebKit numbers are reported, not asserted).
- Probe checks: rest poses are whole device px; upscaled art textures report `smoothPixelArt`; painted keys all exist before the first `Table` frame.
- Unit tests: `ThinkPort` worker message round-trip gives the same `Action` as `aiTurn` for 200 seeds (determinism); `WebAudio` dealRoll schedules `start(when)` at the table's offsets (fake context).
- `boundary.test.ts`: `ai/worker.ts` imports only PURE.

## Order and effort

| Phase | Effort | Payoff |
| --- | --- | --- |
| 0 Measure | ½–1 d | makes every later claim checkable |
| 1 FPS (worker, MSAA off, batching) | 1–2 d | removes the biggest hitches (AI) and fill-rate cost |
| 2 Smoothness (prewarm, BitmapText, frame clock, audio-clock scheduling) | 1–2 d | removes first-time and text hitches; syncs sound and motion |
| 3 Pixels (smoothPixelArt, device snapping, gutters) | 2–3 d | uniform crisp art on desktop, sharper on phone |
| 4 Sound (masters, limiter, panning, memory) | 1–2 d + assets | cleaner, louder-without-clipping, spatial |
| 5 Load | ½ d | no silent first sound, faster start |
| 6 Gates | 1 d | keeps it that way |
| **Total** | **~1.5–2 weeks** | |

Do Phase 0, then Phase 1.1 (the worker) first: it is the only finding that measurably drops frames today. Do F4 and F5 next as one-line config changes with big visible effects.
