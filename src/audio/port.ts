/**
 * What the game needs from a sound system. The web implementation is WebAudio.ts; the React
 * Native port writes ExpoAudio.ts against the same interface. Platform objects arrive as
 * props to the providers, never as imports, so nothing in game/ knows which one it has.
 *
 * Failure contract: init() NEVER rejects and is never awaited by the UI — the Deal handler
 * calls it fire-and-forget and deals regardless. A file that cannot be decoded gives a silent
 * event and one console warning, never a stalled deal. play() on an event whose pool is empty,
 * or before init() resolved, is a no-op.
 *
 * setMusic() is desired state, not fire-and-forget: the port remembers what is wanted and
 * starts the loop when (and only if) that track is still wanted once it has decoded.
 */
import type { MusicTrack, SfxEvent } from "./sfxTable";

export type Bus = "music" | "sfx";

export interface AudioPort {
  init(): Promise<void>;
  play(event: SfxEvent): void;
  /** One shuffle then four deal ticks (DEAL_ROLL). */
  dealRoll(): void;
  setMusic(track: MusicTrack | null): void;
  setTension(on: boolean): void;
  setBus(bus: Bus, gain: number): void;
  duck(): void;
  suspend(): void;
  resume(): void;
}

/** A port that does nothing: the M1a stub, and what tests pass in. */
export const silentAudio: AudioPort = {
  init: () => Promise.resolve(),
  play: () => {},
  dealRoll: () => {},
  setMusic: () => {},
  setTension: () => {},
  setBus: () => {},
  duck: () => {},
  suspend: () => {},
  resume: () => {},
};

/** A port that records every call, for tests. */
export function recordingAudio(): AudioPort & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    init: () => {
      calls.push("init");
      return Promise.resolve();
    },
    play: (e) => void calls.push(`play:${e}`),
    dealRoll: () => void calls.push("dealRoll"),
    setMusic: (t) => void calls.push(`setMusic:${String(t)}`),
    setTension: (on) => void calls.push(`setTension:${on}`),
    setBus: (b, g) => void calls.push(`setBus:${b}:${g}`),
    duck: () => void calls.push("duck"),
    suspend: () => void calls.push("suspend"),
    resume: () => void calls.push("resume"),
  };
}
