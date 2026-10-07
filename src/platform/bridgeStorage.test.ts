/**
 * The bridge-backed StoragePort against a fake bridge (no DOM, no timers beyond the port's own
 * timeout): the host's reply wins, null included; a host that never answers falls back to the
 * given port and is not asked again; a set writes through to the host; no host means the
 * fallback alone.
 */
import { expect, test } from "vitest";
import { memoryStorage } from "../settings/storage";
import type { Bridge } from "./bridge";
import type { InboundPayloads, OutboundPayloads, RequestType } from "./bridgeProtocol";
import { HOST_TIMEOUT_MS, createBridgeStorage } from "./bridgeStorage";

type Sent = { type: RequestType; payload: OutboundPayloads[RequestType] };

/**
 * A host that answers every request with `reply`, or never answers when `reply` is "silent" —
 * in which case the request times out after `timeoutMs`, exactly as the real bridge's does.
 */
function fakeBridge(host: Bridge["host"], reply: ((sent: Sent) => InboundPayloads["settings"]["json"]) | "silent"): Pick<Bridge, "host" | "request"> & { sent: Sent[] } {
  const sent: Sent[] = [];
  let id = 0;
  return {
    host,
    sent,
    request: (type, payload, timeoutMs) => {
      sent.push({ type, payload });
      if (reply === "silent") return new Promise((_, reject) => setTimeout(() => reject(new Error(`bridge: ${type} timed out after ${timeoutMs} ms`)), timeoutMs));
      return Promise.resolve({ id: ++id, json: reply({ type, payload }) });
    },
  };
}

test("the default timeout is 1500 ms", () => {
  expect(HOST_TIMEOUT_MS).toBe(1500);
});

test("get: the host's reply wins over the fallback, and a null reply stays null", async () => {
  const fallback = memoryStorage({ "tallytwo.settings": "from-localStorage" });
  const host = fakeBridge("ios", () => "from-host");
  const port = createBridgeStorage(host, fallback, 50);
  await expect(port.get("tallytwo.settings")).resolves.toBe("from-host");
  expect(host.sent).toEqual([{ type: "settings:get", payload: {} }]);

  const empty = createBridgeStorage(fakeBridge("android", () => null), fallback, 50);
  await expect(empty.get("tallytwo.settings")).resolves.toBeNull(); // nothing stored natively != read localStorage
});

test("get: a host that times out falls back to the given port, and is not asked again", async () => {
  const fallback = memoryStorage({ k: "stale" });
  const host = fakeBridge("iframe", "silent");
  const port = createBridgeStorage(host, fallback, 10);
  await expect(port.get("k")).resolves.toBe("stale");
  expect(host.sent.length).toBe(1);
  await port.set("k", "fresh");
  await expect(port.get("k")).resolves.toBe("fresh");
  expect(host.sent.length).toBe(1); // silent once, silent for good: the fallback handled both
  expect(fallback.data.get("k")).toBe("fresh");
});

test("set writes through to the host and leaves the fallback alone", async () => {
  const fallback = memoryStorage();
  const host = fakeBridge("ios", ({ payload }) => ("json" in payload ? payload.json : null));
  const port = createBridgeStorage(host, fallback, 50);
  await expect(port.set("tallytwo.settings", '{"opts":{"music":false}}')).resolves.toBeUndefined();
  expect(host.sent).toEqual([{ type: "settings:set", payload: { json: '{"opts":{"music":false}}' } }]);
  expect(fallback.data.size).toBe(0);
});

test("set: an unacknowledged write lands in the fallback instead", async () => {
  const fallback = memoryStorage();
  const host = fakeBridge("android", "silent");
  const port = createBridgeStorage(host, fallback, 10);
  await port.set("k", "v");
  expect(fallback.data.get("k")).toBe("v");
});

test("no host: the fallback alone, and the bridge is never asked", async () => {
  const fallback = memoryStorage({ k: "web" });
  const host = fakeBridge(null, () => "never");
  const port = createBridgeStorage(host, fallback, 10);
  await expect(port.get("k")).resolves.toBe("web");
  await port.set("k", "web2");
  expect(fallback.data.get("k")).toBe("web2");
  expect(host.sent).toEqual([]);
});

test("a host whose request rejects outright (no host at request time) falls back too", async () => {
  const fallback = memoryStorage({ k: "web" });
  const port = createBridgeStorage({ host: "ios", request: () => Promise.reject(new Error("nope")) }, fallback, 10);
  await expect(port.get("k")).resolves.toBe("web");
});
