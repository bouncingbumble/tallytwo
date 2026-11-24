/**
 * "Add to Home Screen", offered on the Title so the game is one tap from playing offline
 * (docs/OFFLINE_PLAN.md). Two paths, because the browsers differ:
 *
 * - **prompt**: Chromium (Android Chrome, desktop Chrome/Edge) fires `beforeinstallprompt`; we
 *   keep the event and `prompt()` it from the tap, which opens the browser's own install dialog.
 * - **ios**: Safari on iPhone/iPad has no install API at all, so the tap shows the two steps
 *   (Share, then Add to Home Screen) instead.
 * - **none**: already running from the Home Screen (standalone), inside a native shell or an
 *   iframe, or a browser with neither path (Firefox desktop, macOS Safari).
 *
 * `installMode()` is the pure decision (install.test.ts); `watchInstall()` wires the browser.
 */
import { Value } from "../game/observable";
import type { Host } from "./bridge";

export type InstallMode = "none" | "prompt" | "ios";

export interface InstallFacts {
  host: Host;
  /** display-mode: standalone/fullscreen, or iOS's navigator.standalone. */
  standalone: boolean;
  /** iPhone, iPod or iPad (iPadOS reports itself as a Mac with touch). */
  ios: boolean;
  /** A beforeinstallprompt event is being held. */
  canPrompt: boolean;
}

export function installMode(f: InstallFacts): InstallMode {
  if (f.host !== null || f.standalone) return "none";
  if (f.canPrompt) return "prompt";
  if (f.ios) return "ios";
  return "none";
}

export function isIOS(ua: string, platform: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1);
}

/** Chromium's install prompt event (not in the DOM lib). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface Install {
  readonly mode: Value<InstallMode>;
  /** "prompt": opens the browser's dialog. "ios": nothing to do (the Title shows the steps). */
  run(): void;
}

const mode = new Value<InstallMode>("none");
let held: BeforeInstallPromptEvent | null = null;

export const install: Install = {
  mode,
  run() {
    const e = held;
    if (!e) return;
    held = null; // a prompt event can be used once
    void e
      .prompt()
      .then(() => e.userChoice)
      .catch(() => undefined)
      .finally(() => refresh());
  },
};

let facts: () => InstallFacts = () => ({ host: null, standalone: true, ios: false, canPrompt: false });
const refresh = () => mode.set(installMode(facts()));

export function watchInstall(host: Host): void {
  if (typeof window === "undefined" || !import.meta.env.PROD) return; // dev never installs (no service worker)
  const standaloneMq = window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)");
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios = isIOS(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
  facts = () => ({ host, standalone: standaloneMq.matches || nav.standalone === true, ios, canPrompt: held !== null });
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep Chrome's mini-infobar away; our line offers it instead
    held = e as BeforeInstallPromptEvent;
    refresh();
  });
  window.addEventListener("appinstalled", () => {
    held = null;
    refresh();
  });
  standaloneMq.addEventListener("change", refresh);
  refresh();
}
