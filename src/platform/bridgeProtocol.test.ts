/**
 * The wire contract, row by row: an envelope encodes to the JSON docs/SHELL.md shows, decode()
 * accepts both wire forms and normalises the payloads, and everything that is not a valid
 * inbound message — junk strings, foreign objects, unknown types, malformed payloads — is null
 * rather than a throw. No DOM.
 */
import { expect, test } from "vitest";
import { PROTOCOL, decode, encode, envelope, isInboundType, isOutboundType, isRequestType, replyId } from "./bridgeProtocol";

test("envelope: tally 1, the type and payload, and an id only on a request", () => {
  expect(envelope("ready", {})).toEqual({ tally: 1, type: "ready", payload: {} });
  expect(envelope("haptic", { kind: "slap" })).toEqual({ tally: 1, type: "haptic", payload: { kind: "slap" } });
  expect(envelope("settings:get", {}, 7)).toEqual({ tally: 1, type: "settings:get", payload: {}, id: 7 });
  expect("id" in envelope("score", { round: 3, totals: [1, -1, 0, 0] })).toBe(false);
  expect(PROTOCOL).toBe(1);
});

test("encode is plain JSON of the envelope", () => {
  expect(JSON.parse(encode(envelope("settings:set", { json: '{"opts":{}}' }, 2)))).toEqual({ tally: 1, type: "settings:set", payload: { json: '{"opts":{}}' }, id: 2 });
  expect(JSON.parse(encode(envelope("matchOver", { winner: 2, totals: [3, 1, 9, -13] })))).toEqual({ tally: 1, type: "matchOver", payload: { winner: 2, totals: [3, 1, 9, -13] } });
});

test("decode accepts a JSON string (native) and a structured object (iframe)", () => {
  const asObject = { tally: 1, type: "insets", payload: { top: 0, right: 59, bottom: 21, left: 59 } };
  expect(decode(JSON.stringify(asObject))).toEqual(asObject);
  expect(decode(asObject)).toEqual(asObject);
});

test("decode: pause and resume carry no payload; a missing or odd one is normalised to {}", () => {
  expect(decode({ tally: 1, type: "pause" })).toEqual({ tally: 1, type: "pause", payload: {} });
  expect(decode({ tally: 1, type: "resume", payload: "whatever" })).toEqual({ tally: 1, type: "resume", payload: {} });
  expect(decode('{"tally":1,"type":"pause","payload":null}')).toEqual({ tally: 1, type: "pause", payload: {} });
});

test("decode: a settings reply carries the request id and a string or null json", () => {
  expect(decode({ tally: 1, type: "settings", payload: { id: 3, json: "{}" } })).toEqual({ tally: 1, type: "settings", payload: { id: 3, json: "{}" } });
  expect(decode({ tally: 1, type: "settings", payload: { id: 4, json: null } })).toEqual({ tally: 1, type: "settings", payload: { id: 4, json: null } });
  expect(decode({ tally: 1, type: "settings", payload: { id: 5 } })).toEqual({ tally: 1, type: "settings", payload: { id: 5, json: null } });
  // the id on the envelope is accepted when the payload forgot it, and kept on the envelope
  expect(decode({ tally: 1, type: "settings", id: 6, payload: { json: "x" } })).toEqual({ tally: 1, type: "settings", id: 6, payload: { id: 6, json: "x" } });
  // no id anywhere, or a non-string json, is junk
  expect(decode({ tally: 1, type: "settings", payload: { json: "x" } })).toBeNull();
  expect(decode({ tally: 1, type: "settings", payload: { id: 1, json: 42 } })).toBeNull();
  expect(decode({ tally: 1, type: "settings", payload: { id: "1", json: "x" } })).toBeNull();
});

test("decode: insets need four finite numbers; negatives clamp to 0", () => {
  expect(decode({ tally: 1, type: "insets", payload: { top: 0, right: 44, bottom: -3, left: 44 } })).toEqual({ tally: 1, type: "insets", payload: { top: 0, right: 44, bottom: 0, left: 44 } });
  expect(decode({ tally: 1, type: "insets", payload: { top: 0, right: 44, left: 44 } })).toBeNull();
  expect(decode({ tally: 1, type: "insets", payload: { top: "0", right: 44, bottom: 0, left: 44 } })).toBeNull();
  expect(decode({ tally: 1, type: "insets", payload: { top: NaN, right: 44, bottom: 0, left: 44 } })).toBeNull();
  expect(decode({ tally: 1, type: "insets" })).toBeNull();
});

test("decode rejects junk without throwing", () => {
  for (const junk of [undefined, null, 0, true, "", "not json", "[1,2]", "null", [], {}, { tally: 2, type: "pause" }, { type: "pause" }, { tally: "1", type: "pause" }, { tally: 1, type: "eval" }, { tally: 1, type: "ready" }, { tally: 1, type: 7 }, { tally: 1 }, new Date()]) {
    expect(decode(junk), JSON.stringify(junk)).toBeNull();
  }
});

test("decode never evaluates a string: an expression is not JSON and is dropped", () => {
  expect(decode("globalThis.pwned = true")).toBeNull();
  expect((globalThis as { pwned?: boolean }).pwned).toBeUndefined();
});

test("replyId: a settings reply answers its request; events answer nothing", () => {
  expect(replyId(decode({ tally: 1, type: "settings", payload: { id: 9, json: null } })!)).toBe(9);
  expect(replyId(decode({ tally: 1, type: "pause" })!)).toBeNull();
  expect(replyId(decode({ tally: 1, type: "insets", payload: { top: 1, right: 1, bottom: 1, left: 1 } })!)).toBeNull();
});

test("the type guards know exactly the documented sets", () => {
  expect(["ready", "score", "matchOver", "haptic", "settings:get", "settings:set"].every(isOutboundType)).toBe(true);
  expect(["pause", "resume", "settings", "insets"].every(isInboundType)).toBe(true);
  expect(isOutboundType("pause")).toBe(false);
  expect(isInboundType("ready")).toBe(false);
  expect(isRequestType("settings:get") && isRequestType("settings:set")).toBe(true);
  expect(isRequestType("ready")).toBe(false);
  expect(isRequestType(undefined)).toBe(false);
});
