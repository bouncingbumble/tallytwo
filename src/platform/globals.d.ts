/** DEV-only hooks on window (main.ts, audio/WebAudio.ts). */
import type Phaser from "phaser";
import type { AppAction } from "../game/appReducer";
import type { Value } from "../game/observable";
import type { Sheet } from "../game/selectors";
import type { GameStore } from "../game/store";
import type { GameState } from "../engine/state";
import type { SettingsStore } from "../settings/store";

declare global {
  interface Window {
    __tally?: {
      act(a: AppAction): void;
      readonly game: GameState | null;
      store?: GameStore;
      settings?: SettingsStore;
      sheet?: Value<Sheet>;
      phaser?: Phaser.Game;
      /** Geometry for e2e/play.mjs: the fit, the running scenes and the hand's card rects in logical px. */
      probe?: () => unknown;
    };
    __music?: { readonly gain: { bus: number; duck: number; track: string | null; playing: string[] } };
  }
}

export {};
