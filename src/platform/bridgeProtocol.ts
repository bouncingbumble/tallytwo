/**
 * The shell protocol, written down once: every message the web app and its host (a WKWebView,
 * an Android WebView or an iframe parent) exchange, as types plus the pure encode / decode /
 * validate helpers. No DOM in here, so bridgeProtocol.test.ts runs under node and docs/SHELL.md
 * can be checked against this file line for line. bridge.ts is the one that touches `window`.
 *
 * Envelope: `{ tally: 1, type, payload, id? }`. Native handlers get it as a JSON string, an
 * iframe parent as a structured object. `id` is set on a request (settings:get, settings:set)
 * and the host echoes it back inside the `settings` reply's payload.
 */

export const PROTOCOL = 1;

export type HapticKind = "slap" | "win" | "deal";

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** App -> host. */
export interface OutboundPayloads {
  /** Sent once, after the first render: the host may push `insets` and `pause` from here on. */
  ready: Record<string, never>;
  /** A round has been scored. */
  score: { round: number; totals: number[] };
  /** The last round has been scored; `winner` is a seat index. */
  matchOver: { winner: number; totals: number[] };
  haptic: { kind: HapticKind };
  /** Request: the host answers with `settings { id, json }`. */
  "settings:get": Record<string, never>;
  /** Request: persist this blob; the host acknowledges with `settings { id, json }`. */
  "settings:set": { json: string };
}

/** Host -> app. */
export interface InboundPayloads {
  pause: Record<string, never>;
  resume: Record<string, never>;
  /** The reply to a settings:get / settings:set; `json` null when nothing is stored. */
  settings: { id: number; json: string | null };
  /** Safe-area insets in CSS px, forwarded by a native host (the web view cannot see them). */
  insets: Insets;
}

export type OutboundType = keyof OutboundPayloads;
export type InboundType = keyof InboundPayloads;
/** The outbound types that carry an id and expect a reply. */
export type RequestType = "settings:get" | "settings:set";

export interface Envelope<T extends string, P> {
  tally: typeof PROTOCOL;
  type: T;
  payload: P;
  id?: number;
}

export type OutboundMessage = { [K in OutboundType]: Envelope<K, OutboundPayloads[K]> }[OutboundType];
export type InboundMessage = { [K in InboundType]: Envelope<K, InboundPayloads[K]> }[InboundType];

const OUTBOUND_TYPES: ReadonlySet<string> = new Set<OutboundType>(["ready", "score", "matchOver", "haptic", "settings:get", "settings:set"]);
const INBOUND_TYPES: ReadonlySet<string> = new Set<InboundType>(["pause", "resume", "settings", "insets"]);
export const REQUEST_TYPES: ReadonlySet<string> = new Set<RequestType>(["settings:get", "settings:set"]);

export const isOutboundType = (t: unknown): t is OutboundType => typeof t === "string" && OUTBOUND_TYPES.has(t);
export const isInboundType = (t: unknown): t is InboundType => typeof t === "string" && INBOUND_TYPES.has(t);
export const isRequestType = (t: unknown): t is RequestType => typeof t === "string" && REQUEST_TYPES.has(t);

/** Build an outbound envelope; `id` only on requests. The parameters are typed per K; the result is the union. */
export function envelope<K extends OutboundType>(type: K, payload: OutboundPayloads[K], id?: number): OutboundMessage {
  return (id === undefined ? { tally: PROTOCOL, type, payload } : { tally: PROTOCOL, type, payload, id }) as OutboundMessage;
}

/** The wire form for native handlers (they take strings only). */
export const encode = (msg: OutboundMessage): string => JSON.stringify(msg);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Validate one inbound payload. Returns the normalised payload or null. `id` is the envelope's
 * id, accepted as a fallback for a `settings` reply whose payload forgot it.
 */
function validatePayload<K extends InboundType>(type: K, payload: unknown, id: unknown): InboundPayloads[K] | null {
  const p = isRecord(payload) ? payload : {};
  switch (type) {
    case "pause":
    case "resume":
      return {} as InboundPayloads[K];
    case "settings": {
      const replyId = isFiniteNumber(p.id) ? p.id : isFiniteNumber(id) ? id : null;
      if (replyId === null) return null;
      const json = p.json === undefined || p.json === null ? null : typeof p.json === "string" ? p.json : null;
      if (json === null && p.json !== undefined && p.json !== null) return null; // a non-string json is junk, not "nothing stored"
      return { id: replyId, json } as InboundPayloads[K];
    }
    case "insets": {
      const { top, right, bottom, left } = p;
      if (!isFiniteNumber(top) || !isFiniteNumber(right) || !isFiniteNumber(bottom) || !isFiniteNumber(left)) return null;
      return { top: Math.max(0, top), right: Math.max(0, right), bottom: Math.max(0, bottom), left: Math.max(0, left) } as InboundPayloads[K];
    }
    default:
      return null;
  }
}

/**
 * Turn whatever arrived (a JSON string from a native host, a structured object from a parent
 * window, or garbage) into a validated InboundMessage, or null. Never throws, never evals.
 */
export function decode(raw: unknown): InboundMessage | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isRecord(obj) || obj.tally !== PROTOCOL || !isInboundType(obj.type)) return null;
  const payload = validatePayload(obj.type, obj.payload, obj.id);
  if (payload === null) return null;
  const msg = { tally: PROTOCOL, type: obj.type, payload } as InboundMessage;
  if (isFiniteNumber(obj.id)) msg.id = obj.id;
  return msg;
}

/** The request id a reply answers, or null for a plain event. */
export const replyId = (msg: InboundMessage): number | null => (msg.type === "settings" ? msg.payload.id : null);
