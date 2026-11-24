/**
 * Runs src/platform/sw.js (the worker body) against fake caches, a fake network and a fake
 * worker scope: install, activate, offline navigation, cache-first files, the best-effort music.
 */
/// <reference types="node" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const BODY = readFileSync(fileURLToPath(new URL("./sw.js", import.meta.url)), "utf8");
const ORIGIN = "https://example.test";

const PLAN = {
  version: "v1",
  base: "/tallytwo/",
  index: "/tallytwo/index.html",
  core: ["/tallytwo/index.html", "/tallytwo/assets/index-a.js", "/tallytwo/assets/sfx-a.m4a"],
  music: ["/tallytwo/assets/ost_1-a.m4a", "/tallytwo/assets/ost_2-a.m4a"],
};

class FakeCache {
  readonly store = new Map<string, Response>();
  private readonly net: (r: Request) => Promise<Response>;
  constructor(net: (r: Request) => Promise<Response>) {
    this.net = net;
  }
  async addAll(reqs: Request[]): Promise<void> {
    const got = await Promise.all(reqs.map(async (r) => [r.url, await this.net(r)] as const));
    for (const [url, res] of got) if (!res.ok) throw new TypeError(`bad response for ${url}`);
    for (const [url, res] of got) this.store.set(url, res);
  }
  async put(url: string, res: Response): Promise<void> {
    this.store.set(url, res);
  }
  async match(url: string): Promise<Response | undefined> {
    return this.store.get(url)?.clone();
  }
}

type Listener = (e: unknown) => void;

function worker(opts: { online?: boolean; missing?: string[]; seed?: string[] } = {}) {
  let online = opts.online ?? true;
  const fetched: string[] = [];
  const net = async (r: Request | string): Promise<Response> => {
    const url = typeof r === "string" ? r : r.url;
    fetched.push(new URL(url).pathname);
    if (!online) throw new TypeError("Failed to fetch");
    if (opts.missing?.some((m) => url.endsWith(m))) return new Response("nope", { status: 404 });
    return new Response(`net:${new URL(url).pathname}`, { status: 200 });
  };
  const caches = new Map<string, FakeCache>();
  for (const name of opts.seed ?? []) caches.set(name, new FakeCache(net));
  const cacheStorage = {
    open: async (n: string) => {
      if (!caches.has(n)) caches.set(n, new FakeCache(net));
      return caches.get(n)!;
    },
    keys: async () => [...caches.keys()],
    delete: async (n: string) => caches.delete(n),
  };
  const listeners = new Map<string, Listener>();
  let claimed = false;
  let skipped = false;
  const self = {
    location: new URL(ORIGIN + "/tallytwo/sw.js"),
    addEventListener: (t: string, fn: Listener) => listeners.set(t, fn),
    clients: { claim: async () => void (claimed = true) },
    skipWaiting: () => void (skipped = true),
  };
  new Function("self", "caches", "fetch", "PLAN", BODY)(self, cacheStorage, net, PLAN);

  const lifecycle = async (type: "install" | "activate") => {
    let p: Promise<unknown> = Promise.resolve();
    listeners.get(type)!({ waitUntil: (x: Promise<unknown>) => (p = x) });
    await p;
  };
  /** undefined = the worker did not answer (the browser goes to the network itself). */
  const request = async (path: string, mode: RequestMode = "cors", method = "GET"): Promise<string | undefined> => {
    let answer: Promise<Response> | undefined;
    const request = { url: ORIGIN + path, mode, method };
    listeners.get("fetch")!({ request, respondWith: (p: Promise<Response>) => (answer = p) });
    return answer ? (await answer).text() : undefined;
  };
  return {
    caches,
    fetched,
    lifecycle,
    request,
    setOnline: (v: boolean) => void (online = v),
    message: (data: unknown) => listeners.get("message")!({ data }),
    get claimed() {
      return claimed;
    },
    get skipped() {
      return skipped;
    },
  };
}

test("install caches every core file and the music; activate drops other versions and claims", async () => {
  const w = worker({ seed: ["tally-core-v0", "tally-music-v0", "someone-else"] });
  await w.lifecycle("install");
  expect([...w.caches.get("tally-core-v1")!.store.keys()].map((u) => new URL(u).pathname)).toEqual(PLAN.core);
  expect(w.caches.get("tally-music-v1")!.store.size).toBe(2);
  expect(w.skipped).toBe(false); // never takes over on its own
  await w.lifecycle("activate");
  expect([...w.caches.keys()].sort()).toEqual(["someone-else", "tally-core-v1", "tally-music-v1"]);
  expect(w.claimed).toBe(true);
});

test("a missing core file fails the install; a missing music file does not", async () => {
  await expect(worker({ missing: ["index-a.js"] }).lifecycle("install")).rejects.toThrow();
  const w = worker({ missing: ["ost_2-a.m4a"] });
  await w.lifecycle("install");
  expect(w.caches.get("tally-music-v1")!.store.size).toBe(1);
  // the miss is fetched and stored on first use
  expect(await w.request("/tallytwo/assets/ost_2-a.m4a")).toBe("nope"); // still 404 online: passed through, not stored
  expect(w.caches.get("tally-music-v1")!.store.size).toBe(1);
});

test("offline: navigations get the cached index; listed files come from the cache", async () => {
  const w = worker();
  await w.lifecycle("install");
  w.setOnline(false);
  expect(await w.request("/tallytwo/", "navigate")).toBe("net:/tallytwo/index.html");
  expect(await w.request("/tallytwo/?seed=3", "navigate")).toBe("net:/tallytwo/index.html");
  expect(await w.request("/tallytwo", "navigate")).toBe("net:/tallytwo/index.html");
  expect(await w.request("/tallytwo/assets/index-a.js")).toBe("net:/tallytwo/assets/index-a.js");
  expect(await w.request("/tallytwo/assets/ost_1-a.m4a")).toBe("net:/tallytwo/assets/ost_1-a.m4a");
});

test("online: navigations go to the network first; listed files never do", async () => {
  const w = worker();
  await w.lifecycle("install");
  w.fetched.length = 0;
  expect(await w.request("/tallytwo/?seed=3", "navigate")).toBe("net:/tallytwo/");
  expect(await w.request("/tallytwo/assets/index-a.js")).toBe("net:/tallytwo/assets/index-a.js");
  expect(w.fetched).toEqual(["/tallytwo/"]);
});

test("a music file that missed the install is cached on first use", async () => {
  const w = worker({ online: false });
  await w.lifecycle("install").catch(() => undefined); // core fails offline; open the music cache by hand
  w.setOnline(true);
  expect(await w.request("/tallytwo/assets/ost_2-a.m4a")).toBe("net:/tallytwo/assets/ost_2-a.m4a");
  w.setOnline(false);
  expect(await w.request("/tallytwo/assets/ost_2-a.m4a")).toBe("net:/tallytwo/assets/ost_2-a.m4a");
  expect(w.caches.get("tally-music-v1")!.store.size).toBe(1);
});

test("unlisted, cross-path and non-GET requests pass through", async () => {
  const w = worker();
  await w.lifecycle("install");
  expect(await w.request("/tallytwo/__asset-notes", "cors", "POST")).toBeUndefined();
  expect(await w.request("/tallytwo/unknown.png")).toBeUndefined();
  expect(await w.request("/other-site/", "navigate")).toBeUndefined();
});

test("the page's skipWaiting message hands over", () => {
  const w = worker();
  w.message({ type: "nope" });
  expect(w.skipped).toBe(false);
  w.message({ type: "skipWaiting" });
  expect(w.skipped).toBe(true);
});
