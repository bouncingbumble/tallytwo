/**
 * The one place that decides what plays. It follows the game store, the settings store and the
 * open sheet, and drives the injected port: the wanted music track (musicFor), the tension layer
 * (tensionFor), the two bus gains and suspend/resume for a pause. Each call is made only when its
 * input changed, so a move never re-requests a track. PURE. Cue sounds (play, dealRoll, select)
 * are per-action and live in the store's act()/toggleCard and the hand's gestures
 * (phaser/table/Hand.ts).
 */
import type { Observable } from "../game/observable";
import { type Sheet, musicFor, tensionFor } from "../game/selectors";
import type { GameStore } from "../game/store";
import type { SettingsStore } from "../settings/store";
import type { MusicTrack } from "./sfxTable";

export interface SheetSource extends Observable {
  get(): Sheet;
}

export function directAudio(game: GameStore, settings: SettingsStore, sheet: SheetSource): () => void {
  const audio = game.audio;
  let track: MusicTrack | null | undefined;
  let tension: boolean | undefined;
  let music: number | undefined;
  let sfx: number | undefined;
  let paused: boolean | undefined;

  const sync = (): void => {
    const g = game.game;
    const opts = settings.opts;
    // At zero music nothing is fetched or played.
    const nextTrack = opts.volume.music > 0 ? musicFor(g, sheet.get()) : null;
    if (nextTrack !== track) audio.setMusic((track = nextTrack));
    const nextTension = tensionFor(g);
    if (nextTension !== tension) audio.setTension((tension = nextTension));
    // The music slider is the only music control; the Card sounds switch zeroes the sfx bus.
    if (opts.volume.music !== music) audio.setBus("music", (music = opts.volume.music));
    const nextSfx = opts.sfx ? opts.volume.sfx : 0;
    if (nextSfx !== sfx) audio.setBus("sfx", (sfx = nextSfx));
    const nextPaused = game.view.paused;
    if (nextPaused !== paused) {
      paused = nextPaused;
      if (paused) audio.suspend();
      else audio.resume();
    }
  };

  const offs = [game.subscribe(sync), settings.subscribe(sync), sheet.subscribe(sync)];
  sync();
  return () => {
    for (const off of offs) off();
  };
}
