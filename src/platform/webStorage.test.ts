/**
 * webStorage over a stubbed localStorage: node has none, so each test installs its own, and the
 * port must stay quiet when the real one throws (private mode, blocked site data, full quota).
 */
import { afterEach, expect, test } from "vitest";
import { webStorage } from "./webStorage";

type LocalStorageStub = Pick<Storage, "getItem" | "setItem">;
const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function install(stub: LocalStorageStub | undefined): void {
  if (stub) Object.defineProperty(globalThis, "localStorage", { value: stub, configurable: true, writable: true });
  else Reflect.deleteProperty(globalThis, "localStorage");
}

afterEach(() => {
  if (original) Object.defineProperty(globalThis, "localStorage", original);
  else Reflect.deleteProperty(globalThis, "localStorage");
});

function mapStorage(): LocalStorageStub & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

const boom = (): never => {
  throw new Error("SecurityError: access denied");
};

test("set then get round-trips through localStorage", async () => {
  const stub = mapStorage();
  install(stub);
  await webStorage.set("tallytwo.settings", '{"opts":{}}');
  expect(stub.data.get("tallytwo.settings")).toBe('{"opts":{}}');
  await expect(webStorage.get("tallytwo.settings")).resolves.toBe('{"opts":{}}');
});

test("a key that was never set reads as null", async () => {
  install(mapStorage());
  await expect(webStorage.get("missing")).resolves.toBeNull();
});

test("get resolves null and set resolves when localStorage throws", async () => {
  install({ getItem: boom, setItem: boom });
  await expect(webStorage.get("k")).resolves.toBeNull();
  await expect(webStorage.set("k", "v")).resolves.toBeUndefined();
});

test("no localStorage at all behaves like a throwing one", async () => {
  install(undefined);
  await expect(webStorage.get("k")).resolves.toBeNull();
  await expect(webStorage.set("k", "v")).resolves.toBeUndefined();
});

test("neither call throws synchronously", () => {
  install({ getItem: boom, setItem: boom });
  expect(() => webStorage.get("k")).not.toThrow();
  expect(() => webStorage.set("k", "v")).not.toThrow();
});
