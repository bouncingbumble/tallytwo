# Porting to React Native

What the Expo app copies unchanged, what it rewrites, and what to avoid now so the port stays mechanical. From WEB-PLAN §7; the handoff targets an Expo managed app (`BUILD-PLAN.md:10`: "Expo (managed), TypeScript, expo-router").

The short version: PURE and HOOKS (`docs/ARCHITECTURE.md` §2) copy as files; WEB is rewritten in RN primitives; the platform objects the hooks take as props (`audio`, `storage`) get native implementations behind the same two interfaces (`AudioPort`, `StoragePort`).

## 1. File by file

| Files | Port action |
| --- | --- |
| `src/engine/*`, `src/ai/*` | copy unchanged (they are the handoff files) |
| `src/render/{atlas,scale,fanLayout}.ts` | copy unchanged; `scale.ts` came from the RN spike; `fanLayout.ts` is the extracted maths of the spike's `CardFan.tsx` / `PlainImageFan.tsx` (use the step-22 fit, not PlainImageFan's cap of 23) |
| `src/game/*` (appReducer, GameProvider, useTurnLoop, useBarks, useGame, cues, selectors, copy, timing, seeds; CrashScreen's *data*) | copy unchanged — React + `setTimeout` only, proven by `tsconfig.core.json` + `boundary.test.ts`; `usePageVisibility` → `AppState` from `react-native`; the seed comes from a deep link instead of `location.search`, which is why `seeds.ts` never parsed a query; `ui/CrashScreen.tsx` is rewritten in RN primitives like the rest of `ui/` |
| `src/settings/{settings,storage,SettingsProvider,useSettings}` | copy unchanged — the `StoragePort` is already async, so `@react-native-async-storage/async-storage` (`getItem`/`setItem`, both promise-returning) implements it in two lines; that API alone is the reason the port is async |
| `src/audio/{sfxTable,pool,musicLatch,port}.ts` | copy; write `ExpoAudio.ts` implementing `AudioPort` on expo-audio (the same never-rejects `init()` contract; `musicLatch` reused as-is). Not one-to-one — see §3 |
| `src/assets/names.ts` | copy unchanged; `manifest.ts` is rewritten as a `require()` table for the same `AssetName` union — the same shape as the web's explicit import table, line for line; the same `manifest.test.ts` proves completeness; the @2x/@3x atlases are already in the tree, and the `.m4a` audio is what iOS wants anyway |
| `src/ui/**`, `src/styles/*`, `src/platform/*`, `src/audio/WebAudio.ts`, `dev/*` | rewrite in RN primitives; the spike's `PlainImageFan.tsx` is the ready-made twin of `Hand.tsx`; `tokens.css` is 12 hex colours plus one rgba (`--shadow`) → `theme.ts`; `copy.ts` and `timing.ts` reused as-is; the landscape overlay becomes an `expo-screen-orientation` lock; `ErrorBoundary` is the same 15 lines (class components exist in RN) |
| tests | core suites unchanged under Vitest or Jest; `boundary.test.ts` keeps its job (swap the DOM regexes for `react-native-web`/`Dimensions` ones if you like) |
| `scripts/sim.mjs`, `verify-port.mjs` | run as they are from the RN repo too (plain Node + the resolver hook); they only need `src/engine` and `src/ai` |

The hooks are copied, not packaged as an npm workspace — a `packages/react` layer would add tsc references, Metro `watchFolders` and a third tsconfig, more concepts than a 70-line copy is worth for a solo learner.

## 2. What to avoid now

- No `window`/`document`/`localStorage`/`navigator` outside `src/platform`, `src/audio/WebAudio.ts`, `src/ui`, `App.tsx`, `dev/`. The compiler (`tsconfig.core.json`) and `boundary.test.ts` catch it.
- Platform objects (`audio`, `storage`) are props to the providers, never imports inside them; `ui/` reaches the audio port only through `useGame().audio`, and only `useAudio` decides what plays.
- No `react-dom` import in hooks; no DOM event types in `game/` (the UI passes card values, not events).
- No CSS-only numbers: every ms and px that affects behaviour lives in `timing.ts` / `fanLayout.ts` / `scale.ts`.
- No Zustand/Redux: `useReducer` exists in RN as-is.
- No `import.meta` and no `?url` imports outside `assets/manifest.ts`; PURE code names assets through `assets/names.ts`.
- Query parsing (`?seed=`, `?dev=`) stays in `App.tsx`; the RN app reads the same values from a deep link.
- Rendering rules that are platform-neutral and must survive the rewrite: cards are 96x128 points at an integer device scale; only integer translations and zero rotation at rest; never a scale transform on an ancestor; the pile one scale step below the hand; portraits at 64; wood tile 96, felt tile 32.

## 3. `ExpoAudio.ts`: emulating `AudioPort` on expo-audio

expo-audio's `AudioPlayer` has per-player `volume`, `loop: boolean`, `shouldCorrectPitch` and `setPlaybackRate(rate, pitchCorrectionQuality?)` — no bus graph, no automation curves, no `loopEnd`. The port's contract is kept by emulation, method by method; the constants all come from `src/audio/sfxTable.ts` so nothing is retyped:

| `AudioPort` method | Web (`WebAudio.ts`) | Expo emulation |
| --- | --- | --- |
| `init()` | fetch + `decodeAudioData` with `Promise.allSettled`; never rejects | create one `AudioPlayer` per SFX variant up front (`require()` table) and the loop players lazily; wrap every creation in try/catch and drop failures with one warning; resolve regardless. `setAudioModeAsync({ playsInSilentMode: true })` here (`BUILD-PLAN.md:96`) |
| `play(event)` | new `AudioBufferSourceNode` → event gain → sfx bus | `pickVariant` over the event's players; `player.volume = sfxBus × SFX[event].gain × volume.sfx`; `player.seekTo(0); player.play()`. One player per variant is enough: a variant is never re-triggered within its own ~0.5 s |
| pitch jitter | `source.playbackRate.value = 1 ± JITTER` (true pitch) | `player.shouldCorrectPitch = false; player.setPlaybackRate(1 + (Math.random() * 2 − 1) * JITTER)` |
| `dealRoll()` | shuffle at 0, deal ticks at `DEAL_ROLL.first + k × every` | the same `setTimeout`s, same constants |
| `setMusic(track)` | the latch; `source.loop = true; loopEnd` from `MUSIC` | the same `createMusicLatch()`; `loop = true` on a **trimmed** file (§4), start on `"start"`, pause + reset on `"stop"` |
| `setTension(on)` | 2-s equal-power crossfade of the ost_3 layer | a JS volume ramp on a ~16 ms `setInterval` over `CROSSFADE_MS`, from the current volume to the target (0 or the music gain) |
| `setBus(bus, gain)` | `GainNode.gain` | keep the three bus gains in JS; on change, set every live player's `volume = bus × its event/loop gain` |
| `duck()` | `setTargetAtTime(DUCK.to, now, DUCK.attackS)`, restore after `DUCK.holdMs` unless re-ducked within `DUCK.rearmMs` | the same timing with the JS ramp: drop the music players' volume to `DUCK.to × bus`, timer to restore to `DUCK.from × bus`, re-armed exactly as the web does |
| `suspend()` / `resume()` | `ctx.suspend()` / `ctx.resume()` on visibility and on every tap when not running | `pause()` / `play()` on the active loop players (SFX one-shots just die); drive it from `AppState` (`react-native`) instead of `visibilitychange`; the "tap resumes" listener becomes unnecessary — the native audio session handles interruptions, but keep `resume()` idempotent |

## 4. Loops without `loopEnd`

The web plays each loop with `loopEnd` set to the measured length (ost_1 119.081 s, ost_3 107.714 s, ost_4 103.109 s, CardsMovingLoop03 10.069 s). An expo-audio player loops the whole file, so the three music loops and the ambience loop must be **trimmed to those lengths offline** before they go into the RN tree, e.g. `ffmpeg -i ost_1.m4a -t 119.081 -c copy …` (or re-encode from the Ogg masters with `-t` and the same AAC settings as `docs/ASSETS.md` §4). With gapless AAC (priming frames recorded in the file) the trimmed file loops seamlessly with `loop = true`; verify the seam by ear and with a waveform view before trusting it (`BUILD-PLAN.md:97-99`).

## 5. Checklist for the first port session

1. `npm run check` is green on the web repo; copy `src/engine`, `src/ai`, `src/render/*.ts`, `src/game`, `src/settings`, `src/audio/{sfxTable,pool,musicLatch,port}.ts`, `src/assets/names.ts` and the tests next to them.
2. Run the core suites under Jest or Vitest in the RN repo before writing a single component — they need no platform.
3. Write `storage.ts`'s native twin (two lines over AsyncStorage) and `ExpoAudio.ts` (§3); pass both as props exactly as `App.tsx` does.
4. Write the `require()` manifest for the same `AssetName` union; run `manifest.test.ts`.
5. Rebuild `ui/` from `PlainImageFan.tsx` outwards, reading `docs/ARCHITECTURE.md` §9 for the integer-scale rules and `game/copy.ts` for every string.
