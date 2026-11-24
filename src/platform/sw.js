// The offline service worker body. Plain JS with no imports: vite.config.ts (tally-offline)
// prepends `const PLAN = { version, base, index, core, music }` (src/platform/precache.ts) and
// writes the result to dist/sw.js. sw.test.ts runs this file against fake caches and a fake
// network. In short:
//
// - install: every core file must cache (or the install fails and the old worker stays); the
//   music is cached one file at a time and a miss is ignored (filled in at runtime).
// - The new worker never takes over on its own (no skipWaiting at install), so a deploy never
//   swaps files under a match in progress. It activates on the next cold launch, or when the page
//   posts { type: "skipWaiting" } (the Title's "update ready" line).
// - activate: drop every other version's tally-* caches, then claim the open pages.
// - fetch: navigations are network-first with a 3-s timeout, falling back to the cached index
//   (the fresh page is not cached: the cached index must keep matching the cached files). A
//   listed file is cache-first; a miss goes to the network and is stored. Everything else passes
//   through. Audio is read with fetch() + decodeAudioData, never <audio>, so no Range requests.

/* global PLAN */
const CORE = `tally-core-${PLAN.version}`;
const MUSIC = `tally-music-${PLAN.version}`;
const MUSIC_SET = new Set(PLAN.music);
const LISTED = new Set([...PLAN.core, ...PLAN.music]);
const NAV_TIMEOUT_MS = 3000;

const abs = (path) => new URL(path, self.location.origin).href;
const fresh = (path) => new Request(abs(path), { cache: "reload" });

async function install() {
  const core = await caches.open(CORE);
  await core.addAll(PLAN.core.map(fresh));
  const music = await caches.open(MUSIC);
  await Promise.all(
    PLAN.music.map(async (path) => {
      try {
        const res = await fetch(fresh(path));
        if (res.ok) await music.put(abs(path), res);
      } catch {
        // best-effort: fetched and stored on first use instead
      }
    }),
  );
}

async function activate() {
  const keep = new Set([CORE, MUSIC]);
  const names = await caches.keys();
  await Promise.all(names.filter((n) => n.startsWith("tally-") && !keep.has(n)).map((n) => caches.delete(n)));
  await self.clients.claim();
}

async function fromCache(path) {
  for (const name of [CORE, MUSIC]) {
    const hit = await (await caches.open(name)).match(abs(path));
    if (hit) return hit;
  }
  return undefined;
}

/** A navigation may not be answered with a redirected response; copy it into a plain one. */
async function cachedIndex() {
  const hit = await fromCache(PLAN.index);
  if (!hit || !hit.redirected) return hit;
  return new Response(await hit.blob(), { status: hit.status, statusText: hit.statusText, headers: hit.headers });
}

async function navigate(request) {
  try {
    const res = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("navigation timed out")), NAV_TIMEOUT_MS);
      fetch(request).then(
        (r) => {
          clearTimeout(timer);
          resolve(r);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
    if (res.ok) return res;
    return (await cachedIndex()) ?? res;
  } catch (e) {
    const hit = await cachedIndex();
    if (hit) return hit;
    throw e;
  }
}

async function cacheFirst(request, path) {
  const hit = await fromCache(path);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    const cache = await caches.open(MUSIC_SET.has(path) ? MUSIC : CORE);
    await cache.put(abs(path), res.clone());
  }
  return res;
}

self.addEventListener("install", (event) => event.waitUntil(install()));
self.addEventListener("activate", (event) => event.waitUntil(activate()));
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "skipWaiting") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    if (url.pathname.startsWith(PLAN.base) || url.pathname + "/" === PLAN.base) event.respondWith(navigate(request));
    return;
  }
  if (LISTED.has(url.pathname)) event.respondWith(cacheFirst(request, url.pathname));
});
