import { expect, test } from "vitest";
import { installMode, isIOS } from "./install";

const base = { host: null, standalone: false, ios: false, canPrompt: false } as const;

test("installMode: the browser's prompt first, then the iOS steps, else nothing", () => {
  expect(installMode({ ...base, canPrompt: true })).toBe("prompt");
  expect(installMode({ ...base, ios: true })).toBe("ios");
  expect(installMode({ ...base, ios: true, canPrompt: true })).toBe("prompt");
  expect(installMode(base)).toBe("none"); // Firefox for Android
});

test("installMode: never once installed, nor inside a shell or an iframe", () => {
  expect(installMode({ ...base, ios: true, standalone: true })).toBe("none");
  expect(installMode({ ...base, canPrompt: true, standalone: true })).toBe("none");
  for (const host of ["ios", "android", "iframe"] as const) expect(installMode({ ...base, host, ios: true, canPrompt: true })).toBe("none");
});

test("isIOS: iPhone and iPad (including iPadOS posing as a Mac), not a Mac", () => {
  expect(isIOS("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", "iPhone", 5)).toBe(true);
  expect(isIOS("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)", "iPad", 5)).toBe(true);
  expect(isIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5)).toBe(true);
  expect(isIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0)).toBe(false);
  expect(isIOS("Mozilla/5.0 (Linux; Android 14)", "Linux armv8l", 5)).toBe(false);
});
