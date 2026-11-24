# Plan: Tally Two works offline

Status: **implemented** (Phases 1–4; Phase 4 is documentation, since there is no shell in this repo). See "As built" at the end for where the code differs from this plan. Scope: `vite.config.ts`, `index.html`, `src/main.ts`, a new `src/platform/offline.ts` (+ a pure `src/platform/precache.ts`), `e2e/play.mjs`, the docs.
Goal: after one online visit, the game at https://bouncingbumble.github.io/tallytwo/ (and its Home Screen icon) launches and plays a full match — art, font, SFX **and music** — with the network off.

## Where it stands today

Offline is already close: the game itself needs no network.

| Piece | Network? | Notes |
| --- | --- | --- |
| Engine, AI, stores | no | pure; the AI runs locally |
| Font | no | `@fontsource/rye` is bundled into `dist/assets/` |
| Settings | no | `localStorage` (`webStorage`), or the host (`bridgeStorage`) |
| Images (34 PNG) | **yes, once per launch** | Phaser `Boot` loads them from hashed URLs |
| SFX (≈ 55 `.m4a`, ≈ 0.7 MB) | **yes** | `WebAudio.boot()` fetches + decodes at init; a failed fetch = that cue is silent |
| Music (5 loops, ≈ 2.1–2.3 MB each, ≈ 11 MB) | **yes, lazily** | `WebAudio.ensure()` fetches on demand |
| `index.html`, JS, CSS | **yes** | nothing caches the app shell |

What is missing is only a cache in front of those requests. The PWA layer that provided one (`vite-plugin-pwa` 2.0.0 + Workbox) was removed in `68969ab` ("drop the PWA") on the theory that a native shell owns offline. Nothing in the code depends on its absence, so it can come back. `dist/` is ≈ 14 MB total, mostly music.

## Decisions to make first

| # | Question | Recommendation |
| --- | --- | --- |
| D1 | Which targets go offline: the web/Home Screen build, the native shell, or both? | **Web first** (Phases 1–3). A shell bundles `dist/` (Phase 4), because a WKWebView cannot run a service worker except on App-Bound Domains. |
| D2 | Hand-written service worker, or re-add `vite-plugin-pwa`? | **Hand-written, ~80 lines, emitted by a small Vite plugin.** This repo pins few deps and keeps logic pure and tested. A Workbox runtime adds ~20 kB plus a dependency for one cache-first strategy. Re-adding `vite-plugin-pwa@2.0.0` with the old config (in `git show 68969ab^:vite.config.ts`) is the fallback if the custom worker proves fiddly. |
| D3 | Precache the music (≈ 11 MB) or cache it at runtime? | **Precache it in a second, best-effort cache.** The first offline launch then has music. If a music file fails, the install still succeeds and the file is retried at runtime. |
| D4 | How do updates arrive? | **Never mid-match.** The new worker installs in the background and waits. It takes over on the next cold launch. There is no `skipWaiting` and no auto-reload; an optional "New version — tap to reload" line is shown on the Title scene only. |

## Phase 1 — The service worker (≈ ½ day)

1. **The precache list, pure** (`src/platform/precache.ts`, which joins the PURE bucket's `tsconfig.core.json` check).
   `precacheList(files: string[], base: string): { core: string[]; music: string[]; version: string }` does three things:
   - It sorts the emitted bundle files into **core** (`index.html`, `*.js`, `*.css`, `*.woff2`, `*.png`, the SFX `.m4a`, `icons/*`, `manifest.webmanifest`) and **music** (`ost_*.m4a`).
   - It drops what offline never needs: `.woff` (woff2 covers every target), `assetsPage-*` (the dev `/assets` page), and `sw.js` itself.
   - It derives `version` as a hash of the sorted list. Hashed filenames mean a new build gives a new version.
   `precache.test.ts` pins the classification and checks that the version changes when one file changes.

2. **Emit `sw.js` at build time** (a `tally-offline` plugin in `vite.config.ts`, `apply: "build"`).
   In `generateBundle` it reads `Object.keys(bundle)` plus the `public/` files, calls `precacheList`, and emits `sw.js` from a template with the lists and `version` inlined. Every path is prefixed with `base`, so `/tallytwo/` on Pages and `/` locally and in a shell both work. The plugin does nothing in dev (`vite --host` stays network-only, so HMR is not fought).

3. **The worker** (template `src/platform/sw.template.js`, plain JS, no imports):
   - `install`: `caches.open("tally-core-<v>").addAll(core)` must succeed. Then `tally-music-<v>` adds each music file separately and ignores failures (D3). Pages over flaky Wi-Fi then still installs.
   - `activate`: delete every `tally-*` cache that is not `<v>`, then `clients.claim()`.
   - `fetch`, for GET on the same origin only:
     - **navigation** returns the cached `index.html` (network first with a 3-s timeout, so an online launch still sees a fresh deploy's HTML).
     - **anything else** is served cache first, falling back to the network and then storing the result in the matching cache (this covers a music file that missed the install).
     - The dev-only `/__asset-notes` POST and cross-origin requests pass through untouched.
   - Audio is fetched with `fetch()` and decoded with `decodeAudioData`, never through an `<audio>` element, so there are **no Range requests** to special-case. This is the usual pitfall when caching media in a service worker.

4. **Register it** (`src/platform/offline.ts`, WEB bucket, called from `main.ts` after the Phaser game boots):
   - It registers only when `import.meta.env.PROD`, `"serviceWorker" in navigator`, and `bridge.host` is not `ios`/`android` (a shell bundles; Phase 4). It does register inside an `iframe` host.
   - `navigator.serviceWorker.register(BASE_URL + "sw.js", { scope: BASE_URL })` runs after `load`, so it does not compete with Boot's asset load.
   - `navigator.storage.persist?.()` asks the browser not to evict the 14 MB.
   - It exposes `updateReady: Value<boolean>`, set when a waiting worker appears, for D4's optional Title line.

## Phase 2 — Installable again (≈ 2 h)

- Restore `public/manifest.webmanifest` from the old config (name, `display: "standalone"`, `orientation: "landscape"`, `#241408`, the 192/512 icons and the 512 as `maskable`). Make it base-relative (`start_url: "."`, `scope: "."`) so one file serves both `/` and `/tallytwo/`.
- In `index.html`, add `<link rel="manifest" href="%BASE_URL%manifest.webmanifest">`. The `apple-mobile-web-app-*` tags are already there.
- iOS note: a Home Screen web app gets its own storage that is **exempt from Safari's 7-day eviction**, but it does not share caches with the Safari tab. The player must open the Home Screen icon online once. Say so in the README.

## Phase 3 — Prove it (≈ ½ day)

- **Unit**: `precache.test.ts` (Phase 1.1). `boundary.test.ts` gets one more rule: nothing outside `platform/offline.ts` touches `navigator.serviceWorker`.
- **Build gate**: a small `scripts/check-sw.mjs`, added to `npm run check` and the Pages workflow, parses `dist/sw.js` and asserts four things:
  - every listed URL exists in `dist/`;
  - every `dist/` file except the excluded ones is listed;
  - the total is under a budget (16 MB);
  - the paths carry `BASE_PATH`.
- **e2e** (`e2e/play.mjs --offline`, against `npm run preview`, Chromium):
  1. load online and wait for `navigator.serviceWorker.ready` and for both caches to fill;
  2. `context.setOffline(true)` and reload;
  3. play a full round with the existing checks;
  4. assert no failed requests and no `audio:` warnings for SFX.
  Music cannot be asserted in Playwright's Chromium (no AAC, `docs/ASSETS.md` §4), so check that `caches.match(ost_1)` hits instead.
  Playwright's WebKit service-worker support is limited. **iPhone stays a manual check**: Add to Home Screen, launch, airplane mode, kill, relaunch, play a round with music.
- **Update check**: build twice with a changed file, load v1, deploy v2, reload mid-match. The match continues on v1 with no reload. A cold launch then runs v2 and the old caches are gone.

## Phase 4 — Native shell (optional, after D1)

A WKWebView ignores service workers (outside App-Bound Domains), and the shell recipes in `docs/SHELL.md` load `dist/` over https. Offline there means **bundling `dist/` in the app**:

- **iOS**: do not use `loadFileURL` for this. `fetch()` of `file://` URLs (every SFX and music file) fails in WKWebView, and the game would be silent. Instead, serve the bundled `dist/` through a `WKURLSchemeHandler` on a custom scheme (`tally://app/`) with the right `Content-Type`s, and build with `BASE_PATH=/`.
- **Android**: use `WebViewAssetLoader` on `https://appassets.androidplatform.net/` (fetch works; same origin).
- `offline.ts` already skips registration in both hosts. Settings already persist through the bridge.
- Update `docs/SHELL.md` §6: replace "the shell owns offline" with these two recipes.

## Docs to update (same commit as the code)

- `README.md`: the build table ("no service worker" becomes what `sw.js` does), the gate table, and a Deploy note on the first online launch from the Home Screen icon.
- `docs/ARCHITECTURE.md` "Shipping".
- `docs/ASSETS.md`:
  - §3.7 ("no service worker, no precache, no webmanifest");
  - §4's budget line ("fetched on demand (there is no service worker)");
  - §6 (the 512 icon is used by the manifest again);
  - row 26 (splash).
- `docs/SHELL.md` §6 (Phase 4).

## Risks

| Risk | Mitigation |
| --- | --- |
| A stale worker pins an old build forever | Hashed filenames + versioned caches; network-first navigation with a timeout; `activate` deletes old caches. `sw.js` itself is never precached, and browsers bypass the HTTP cache for worker update checks. |
| A deploy mid-match breaks lazy music fetches (old hashes gone from Pages) | The old worker keeps serving its own `tally-*-<v>` caches until a cold launch (D4). |
| 14 MB is evicted under storage pressure | `storage.persist()`; on iOS the Home Screen app is exempt from the 7-day rule. Worst case, the game falls back to the network and to silent cues (the existing audio failure contract). |
| The first install over a slow connection never finishes the music | Core and music caches are separate; music is best-effort plus runtime fill. |
| `/assets` dev page breaks offline | It is excluded from precache on purpose: dev tooling, documented. |

## Effort

Phases 1–3: about 1½ days, including the iPhone manual pass. Phase 4: about 1 day per platform, once a shell exists.

## As built

| Plan | What shipped |
| --- | --- |
| `precacheList(files, base)` hashing the file list | `precachePlan(files, base)` in `src/platform/precache.ts` takes `{ path, hash, size }` per file. The plugin hashes every file's **contents** (FNV-1a), because `index.html`, the icons and the manifest are not hash-named, and a change to them must still produce a new version. The function also returns the byte total, and `renderWorker()` prepends the plan to the worker body. |
| `generateBundle` + `Object.keys(bundle)` | `closeBundle`: walks the written `dist/` (which includes `public/`) and writes `dist/sw.js`. The build fails if the precache is over 16 MB. `tsconfig.node.json` gained `allowImportingTsExtensions` so `vite.config.ts` can import `precache.ts`. |
| `sw.template.js` | `src/platform/sw.js` (plain JS; it reads the prepended `PLAN`). Navigations fall back to the cached index (unwrapped if it was a redirect). A runtime fill only stores URLs that are in the plan, so a new deploy's files never leak into the old version's caches. The worker skips waiting only when the page posts `{ type: "skipWaiting" }`. |
| `updateReady: Value<boolean>` | `updates = { ready, apply() }` in `offline.ts`, handed to the scenes as `services().update`. The Title shows "New version ready · tap to update" (a 60-px tap row, probe id `title.update`); `apply()` posts `skipWaiting`, and `controllerchange` reloads. |
| `e2e/play.mjs --offline` | `OFFLINE=1` (`npm run e2e:offline`): a production build made with `VITE_E2E=1`, which keeps `window.__tally`. It checks that the worker controls the page with 90/90 core + 5/5 music cached, then after the offline reload: 0 failed requests, every response from the worker, a full round played. |
| Update check (by hand) | `e2e/update.mjs` (`npm run e2e:update`), automated: v2 waits mid-match with v1's caches intact and no reload; the Title line appears; a tap reloads into v2 and v1's caches are gone. |
| — | `src/platform/sw.test.ts` runs the real `sw.js` against fake caches and a fake network: install all-or-nothing for core and best-effort for music, activate cleanup, offline navigation, cache-first, runtime fill, pass-through, `skipWaiting`. |
| Phase 4 | `docs/SHELL.md` §7: `WKURLSchemeHandler` on `tally://app/` (iOS) and `WebViewAssetLoader` on `https://appassets.androidplatform.net/game/` with `BASE_PATH=/game/` (Android). Not run: there is no shell yet. |

**Add to Home Screen, from the Title** (`src/platform/install.ts`, `install.test.ts`): the Title's top line offers "Play offline · add to Home Screen" when the game is not already installed. The line has three behaviours:

- **Chromium:** it holds `beforeinstallprompt` and opens the browser's own install dialog.
- **iPhone/iPad Safari:** there is no install API, so a tap swaps in the steps ("Tap Share (or ··· › Share), then “Add to Home Screen”"), and a second tap puts the offer back.
- **Hidden:** in standalone, in a shell or an iframe, in dev, and in browsers with neither path.

A waiting update takes the same line first. Probe id: `title.install`.

Still manual: the iPhone pass (Add to Home Screen → launch online → airplane mode → kill → relaunch → play a round with music).
