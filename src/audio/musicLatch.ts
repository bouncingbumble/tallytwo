/**
 * The "setMusic before decode" problem, solved as a pure state machine. Music decodes
 * lazily (2-3 MB per loop), so the first request for a track lands seconds before its buffer
 * exists. The latch remembers what is WANTED; when a track's decode lands it starts iff that
 * track is still wanted; wanting something else (or nothing) before the decode lands cancels
 * the pending start; wanting the same track twice starts it once.
 *
 * It returns commands rather than doing anything, so WebAudio.ts stays a thin executor and
 * this file is testable without an AudioContext.
 */
export type LatchCommand<T extends string> = { op: "start"; track: T } | { op: "stop"; track: T };

export interface MusicLatch<T extends string> {
  readonly wanted: T | null;
  readonly playing: T | null;
  /** The game wants this track (or silence). */
  want(track: T | null): LatchCommand<T>[];
  /** This track's buffer is now available. */
  decoded(track: T): LatchCommand<T>[];
  isDecoded(track: T): boolean;
}

export function createMusicLatch<T extends string>(): MusicLatch<T> {
  let wanted: T | null = null;
  let playing: T | null = null;
  const ready = new Set<T>();

  const settle = (): LatchCommand<T>[] => {
    const cmds: LatchCommand<T>[] = [];
    if (playing !== null && playing !== wanted) {
      cmds.push({ op: "stop", track: playing });
      playing = null;
    }
    if (wanted !== null && playing === null && ready.has(wanted)) {
      cmds.push({ op: "start", track: wanted });
      playing = wanted;
    }
    return cmds;
  };

  return {
    get wanted() {
      return wanted;
    },
    get playing() {
      return playing;
    },
    want(track) {
      wanted = track;
      return settle();
    },
    decoded(track) {
      ready.add(track);
      return settle();
    },
    isDecoded: (track) => ready.has(track),
  };
}
