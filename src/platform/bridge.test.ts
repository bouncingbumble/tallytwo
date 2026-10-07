/**
 * The bridge over fake windows (no DOM): host detection in order, the three delivery paths
 * (JSON string to the iOS handler and to the Android interface, a structured object to the
 * parent), requests matched to replies by id and timed out, inbound validation on both entry
 * points, the parent-only rule for `message` events, and the paused/insets memory.
 */
import { expect, test, vi } from "vitest";
import { type HostWindow, createBridge, detectHost } from "./bridge";

type Fake = HostWindow & { out: unknown[]; listeners: Array<(e: { data: unknown; source: unknown }) => void> };

function fakeWindow(kind: "ios" | "android" | "iframe" | "none"): Fake {
  const out: unknown[] = [];
  const listeners: Fake["listeners"] = [];
  const self = {
    out,
    listeners,
    addEventListener: (_type: "message", fn: (e: { data: unknown; source: unknown }) => void) => void listeners.push(fn),
  } as Fake;
  self.parent = kind === "iframe" ? { postMessage: (m: unknown) => void out.push(m) } : (self as unknown as HostWindow["parent"]);
  if (kind === "ios") self.webkit = { messageHandlers: { tally: { postMessage: (m) => void out.push(m) } } };
  if (kind === "android") self.TallyBridge = { postMessage: (m) => void out.push(m) };
  return self;
}

test("detectHost: ios before android before iframe, else null; no window is null", () => {
  expect(detectHost(fakeWindow("ios"))).toBe("ios");
  expect(detectHost(fakeWindow("android"))).toBe("android");
  expect(detectHost(fakeWindow("iframe"))).toBe("iframe");
  expect(detectHost(fakeWindow("none"))).toBeNull();
  expect(detectHost(undefined)).toBeNull();
  const both = fakeWindow("ios");
  both.TallyBridge = { postMessage() {} };
  expect(detectHost(both)).toBe("ios");
});

test("native hosts get JSON strings; an iframe parent gets the object", () => {
  const ios = fakeWindow("ios");
  createBridge(ios).send("haptic", { kind: "win" });
  expect(ios.out).toEqual(['{"tally":1,"type":"haptic","payload":{"kind":"win"}}']);

  const android = fakeWindow("android");
  createBridge(android).send("score", { round: 2, totals: [5, -5, 0, 0] });
  expect(android.out).toEqual(['{"tally":1,"type":"score","payload":{"round":2,"totals":[5,-5,0,0]}}']);

  const frame = fakeWindow("iframe");
  createBridge(frame).send("ready", {});
  expect(frame.out).toEqual([{ tally: 1, type: "ready", payload: {} }]);
});

test("no host: send is a no-op, request rejects, nothing is installed on the window", async () => {
  const win = fakeWindow("none");
  const b = createBridge(win);
  expect(b.host).toBeNull();
  b.send("ready", {});
  expect(win.out).toEqual([]);
  await expect(b.request("settings:get", {}, 10)).rejects.toThrow(/no host/);
  expect(win.tallyReceive).toBeUndefined();
  expect(win.listeners).toEqual([]);
  expect(createBridge(undefined).host).toBeNull();
});

test("request: the reply with the matching id resolves it; other ids are ignored", async () => {
  const win = fakeWindow("ios");
  const b = createBridge(win);
  const p = b.request("settings:get", {}, 1000);
  const sent = JSON.parse(win.out[0] as string);
  expect(sent).toEqual({ tally: 1, type: "settings:get", payload: {}, id: 1 });
  win.tallyReceive!(JSON.stringify({ tally: 1, type: "settings", payload: { id: 99, json: "wrong" } }));
  win.tallyReceive!(JSON.stringify({ tally: 1, type: "settings", payload: { id: 1, json: "right" } }));
  await expect(p).resolves.toEqual({ id: 1, json: "right" });
  // ids keep climbing
  void b.request("settings:set", { json: "{}" }, 1000).catch(() => {});
  expect(JSON.parse(win.out[1] as string).id).toBe(2);
});

test("request: times out with an Error, and a late reply is then ignored", async () => {
  vi.useFakeTimers();
  try {
    const win = fakeWindow("android");
    const b = createBridge(win);
    const p = b.request("settings:get", {}, 1500);
    const settled = p.then(
      () => "resolved",
      (e: Error) => e.message,
    );
    vi.advanceTimersByTime(1499);
    vi.advanceTimersByTime(1);
    await expect(settled).resolves.toMatch(/timed out after 1500 ms/);
    expect(() => win.tallyReceive!({ tally: 1, type: "settings", payload: { id: 1, json: "late" } })).not.toThrow();
  } finally {
    vi.useRealTimers();
  }
});

test("on: handlers get the validated payload; unsubscribe stops them; junk never reaches them", () => {
  const win = fakeWindow("iframe");
  const b = createBridge(win);
  const seen: unknown[] = [];
  const off = b.on("insets", (p) => seen.push(p));
  const fire = (data: unknown, source: unknown = win.parent) => win.listeners.forEach((l) => l({ data, source }));
  fire({ tally: 1, type: "insets", payload: { top: 0, right: 47, bottom: 21, left: 47 } });
  fire({ tally: 1, type: "insets", payload: { top: "a" } });
  fire("not json");
  fire({ tally: 1, type: "insets", payload: { top: 1, right: 1, bottom: 1, left: 1 } }, {}); // not the parent
  expect(seen).toEqual([{ top: 0, right: 47, bottom: 21, left: 47 }]);
  expect(b.insets).toEqual({ top: 0, right: 47, bottom: 21, left: 47 });
  off();
  fire({ tally: 1, type: "insets", payload: { top: 2, right: 2, bottom: 2, left: 2 } });
  expect(seen.length).toBe(1);
  expect(b.insets).toEqual({ top: 2, right: 2, bottom: 2, left: 2 }); // the memory updates regardless of subscribers
});

test("pause/resume are remembered, and both entry points feed the same handlers", () => {
  const win = fakeWindow("iframe");
  const b = createBridge(win);
  const log: string[] = [];
  b.on("pause", () => log.push("pause"));
  b.on("resume", () => log.push("resume"));
  expect(b.paused).toBe(false);
  win.listeners.forEach((l) => l({ data: { tally: 1, type: "pause" }, source: win.parent }));
  expect(b.paused).toBe(true);
  win.tallyReceive!('{"tally":1,"type":"resume"}');
  expect(b.paused).toBe(false);
  win.tallyReceive!('{"tally":1,"type":"pause","payload":{}}');
  expect(b.paused).toBe(true);
  expect(log).toEqual(["pause", "resume", "pause"]);
});

test("a host that throws on receive does not break the game", () => {
  const win = fakeWindow("ios");
  win.webkit!.messageHandlers!.tally!.postMessage = () => {
    throw new Error("WKScriptMessageHandler gone");
  };
  expect(() => createBridge(win).send("ready", {})).not.toThrow();
});
