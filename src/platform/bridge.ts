/**
 * The shell bridge: one object that knows whether a host is wrapping the page and carries the
 * typed postMessage protocol (bridgeProtocol.ts) to and from it. WEB bucket. Detection happens
 * once at module load: iOS exposes `window.webkit.messageHandlers.tally`, Android a
 * `window.TallyBridge` JavascriptInterface, an iframe a parent that is not us; a plain browser
 * tab has none, and then every send is a no-op and no listener is installed, so standalone the
 * app behaves exactly as before.
 *
 * Inbound messages reach us two ways — a `message` event from the parent window (iframe) or a
 * call to `window.tallyReceive(json)` (native, from evaluateJavaScript) — and both go through
 * decode(), so junk and unknown types are dropped before any handler sees them. Replies to a
 * request are matched by id; the last `pause`/`resume` and `insets` are kept so a hook that
 * mounts after the host spoke still sees them (useBridge.ts).
 *
 * `createBridge(win)` exists so bridge.test.ts can drive the whole thing with a fake window
 * under node; the app only ever uses the `bridge` singleton below.
 */
import type { ShellPort } from "../game/useGame";
import { type InboundPayloads, type InboundType, type Insets, type OutboundMessage, type OutboundPayloads, type OutboundType, type RequestType, decode, encode, envelope, isRequestType, replyId } from "./bridgeProtocol";

export type Host = "ios" | "android" | "iframe" | null;

export interface Bridge {
  readonly host: Host;
  /** The host's last pause/resume; false until it says otherwise. */
  readonly paused: boolean;
  /** The host's last insets message, or null. */
  readonly insets: Insets | null;
  /** Fire and forget; a no-op with no host. */
  send<K extends OutboundType>(type: K, payload: OutboundPayloads[K]): void;
  /** Send with an id and wait for the `settings` reply; rejects after `timeoutMs` or with no host. */
  request<K extends RequestType>(type: K, payload: OutboundPayloads[K], timeoutMs: number): Promise<InboundPayloads["settings"]>;
  /** Subscribe to one inbound type; returns the unsubscribe. */
  on<K extends InboundType>(type: K, handler: (payload: InboundPayloads[K]) => void): () => void;
}

/** The slice of `window` the bridge touches, so a test can hand in a plain object. */
export interface HostWindow {
  webkit?: { messageHandlers?: { tally?: { postMessage(message: string): void } } };
  TallyBridge?: { postMessage(message: string): void };
  tallyReceive?: (raw: unknown) => void;
  parent: { postMessage(message: unknown, targetOrigin: string): void };
  addEventListener(type: "message", listener: (e: { data: unknown; source: unknown }) => void): void;
}

export function detectHost(win: HostWindow | undefined): Host {
  if (!win) return null;
  if (typeof win.webkit?.messageHandlers?.tally?.postMessage === "function") return "ios";
  if (typeof win.TallyBridge?.postMessage === "function") return "android";
  if (win.parent && (win.parent as unknown) !== (win as unknown)) return "iframe";
  return null;
}

type Handler = (payload: unknown) => void;
interface Pending {
  resolve(payload: InboundPayloads["settings"]): void;
  timer: ReturnType<typeof setTimeout>;
}

export function createBridge(win: HostWindow | undefined): Bridge {
  const host = detectHost(win);
  const handlers = new Map<InboundType, Set<Handler>>();
  const pending = new Map<number, Pending>();
  let nextId = 1;
  let paused = false;
  let insets: Insets | null = null;

  const deliver = (msg: OutboundMessage): void => {
    if (!win || !host) return;
    try {
      if (host === "ios") win.webkit!.messageHandlers!.tally!.postMessage(encode(msg));
      else if (host === "android") win.TallyBridge!.postMessage(encode(msg));
      else win.parent.postMessage(msg, "*");
    } catch {
      // a host that throws on receive is a host bug; the game must not care
    }
  };

  const receive = (raw: unknown): void => {
    const msg = decode(raw);
    if (!msg) return;
    if (msg.type === "pause") paused = true;
    else if (msg.type === "resume") paused = false;
    else if (msg.type === "insets") insets = msg.payload;
    const id = replyId(msg);
    if (id !== null && msg.type === "settings") {
      const p = pending.get(id);
      if (p) {
        pending.delete(id);
        clearTimeout(p.timer);
        p.resolve(msg.payload);
      }
    }
    for (const h of handlers.get(msg.type) ?? []) h(msg.payload);
  };

  if (win && host) {
    win.tallyReceive = receive;
    // Only the parent may speak to an embedded page; other windows' messages are ignored outright.
    if (host === "iframe") win.addEventListener("message", (e) => void (e.source === win.parent && receive(e.data)));
  }

  return {
    host,
    get paused() {
      return paused;
    },
    get insets() {
      return insets;
    },
    send(type, payload) {
      deliver(envelope(type, payload));
    },
    request(type, payload, timeoutMs) {
      if (!host || !isRequestType(type)) return Promise.reject(new Error(`bridge: no host for ${type}`));
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`bridge: ${type} timed out after ${timeoutMs} ms`));
        }, timeoutMs);
        pending.set(id, { resolve, timer });
        deliver(envelope(type, payload, id));
      });
    },
    on(type, handler) {
      let set = handlers.get(type);
      if (!set) handlers.set(type, (set = new Set()));
      set.add(handler as Handler);
      return () => void set.delete(handler as Handler);
    },
  };
}

/** The app's bridge; `host` is null in a plain browser tab and under vitest. */
export const bridge: Bridge = createBridge(typeof window === "undefined" ? undefined : (window as unknown as HostWindow));

/**
 * The tiny WEB adapter GameProvider receives as its `shell` prop (the same pattern as `audio`
 * and `storage`): the three game events a host cares about, mapped onto outbound messages.
 */
export const bridgeShell: ShellPort = {
  haptic: (kind) => bridge.send("haptic", { kind }),
  score: (round, totals) => bridge.send("score", { round, totals }),
  matchOver: (winner, totals) => bridge.send("matchOver", { winner, totals }),
};
