/**
 * Offline play: registers dist/sw.js (built by vite.config.ts's tally-offline plugin from
 * src/platform/sw.js and the plan in precache.ts) and reports a waiting update. The only file
 * that touches navigator.serviceWorker (boundary.test.ts).
 *
 * Registered only in a production build, where service workers exist, and not inside a native
 * shell: a WKWebView has no service workers outside App-Bound Domains, and a shell bundles dist/
 * instead (docs/SHELL.md §7). An iframe host still gets one.
 */
import { Value } from "../game/observable";
import type { Host } from "./bridge";

export interface Updates {
  /** A new build is installed and waiting; it takes over on the next cold launch or on apply(). */
  readonly ready: Value<boolean>;
  /** Hand over to the waiting build and reload. A no-op with nothing waiting. */
  apply(): void;
}

const ready = new Value(false);
let waiting: ServiceWorker | null = null;

export const updates: Updates = {
  ready,
  apply() {
    if (!waiting) return;
    waiting.postMessage({ type: "skipWaiting" });
  },
};

export function offlineEnabled(host: Host): boolean {
  return import.meta.env.PROD && typeof navigator !== "undefined" && "serviceWorker" in navigator && host !== "ios" && host !== "android";
}

function track(reg: ServiceWorkerRegistration): void {
  const set = (w: ServiceWorker | null) => {
    // only an update counts: a first install has no controller and nothing to replace
    if (!w || !navigator.serviceWorker.controller) return;
    waiting = w;
    ready.set(true);
  };
  set(reg.waiting);
  reg.addEventListener("updatefound", () => {
    const w = reg.installing;
    w?.addEventListener("statechange", () => {
      if (w.state === "installed") set(w);
    });
  });
}

export function registerOffline(host: Host): void {
  if (!offlineEnabled(host)) return;
  const base = import.meta.env.BASE_URL;
  let hadController = !!navigator.serviceWorker.controller;
  // after apply(): the new worker has taken over, so load the page it caches
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController && waiting) location.reload();
    hadController = true;
  });
  const go = () => {
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .then(track)
      .catch((e: unknown) => console.warn(`offline: service worker not registered (${String(e)})`));
    // ask not to be evicted under storage pressure; a refusal is fine
    void navigator.storage?.persist?.().catch(() => false);
  };
  // after load, so the worker's precache does not compete with Boot's asset load
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
}
