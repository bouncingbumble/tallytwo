/**
 * The StoragePort over the shell bridge: ask the host for the settings blob (settings:get) and
 * write through it (settings:set), falling back to another port — webStorage in the app — when
 * there is no host or the host does not answer in time. Why a native host must own storage:
 * Safari partitions an iframe's localStorage per top-level site and a WKWebView's can be wiped
 * with the app's cache, so only the shell can make settings durable. The app has one key
 * (settings/settings.ts KEY), so the host stores one blob and the key only reaches the fallback.
 *
 * A host that times out once is treated as silent for the rest of the page's life: every later
 * get/set goes straight to the fallback instead of waiting another 1.5 s per write.
 */
import type { StoragePort } from "../settings/storage";
import { type Bridge, bridge } from "./bridge";
import { webStorage } from "./webStorage";

/** How long the host gets to answer; after that the fallback port decides. */
export const HOST_TIMEOUT_MS = 1500;

export function createBridgeStorage(b: Pick<Bridge, "host" | "request">, fallback: StoragePort, timeoutMs = HOST_TIMEOUT_MS): StoragePort {
  let silent = !b.host;
  return {
    async get(key) {
      if (silent) return fallback.get(key);
      try {
        return (await b.request("settings:get", {}, timeoutMs)).json; // the host's answer wins, null included
      } catch {
        silent = true;
        return fallback.get(key);
      }
    },
    async set(key, value) {
      if (silent) return fallback.set(key, value);
      try {
        await b.request("settings:set", { json: value }, timeoutMs);
      } catch {
        silent = true;
        return fallback.set(key, value);
      }
    },
  };
}

export const bridgeStorage: StoragePort = createBridgeStorage(bridge, webStorage);
