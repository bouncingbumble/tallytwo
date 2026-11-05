/**
 * The one place that decides what plays. Called once from Screens with the open sheet and the
 * paused flag; everything else is a pure selector (musicFor, tensionFor) fed to the injected
 * port. HOOKS bucket: React only — the port arrives through useGame(), never as an import, and
 * no component starts a track on its own. Cue sounds (play, dealRoll, select) are per-action
 * and live in act()/toggleCard, not here.
 */
import { useEffect } from "react";
import { musicFor, type Sheet, tensionFor } from "../game/selectors";
import { useGame } from "../game/useGame";
import { useSettings } from "../settings/useSettings";

export function useAudio({ sheet, paused }: { sheet: Sheet; paused: boolean }): void {
  const { audio, game } = useGame();
  const { opts } = useSettings();

  // The wanted track is a function of the phase, the null-ness, the sheet and whether the music
  // slider is all the way down, so a move never re-requests it. At zero nothing is fetched or played.
  const track = opts.volume.music > 0 ? musicFor(game, sheet) : null;
  useEffect(() => {
    audio.setMusic(track);
  }, [audio, track]);

  const tension = tensionFor(game);
  useEffect(() => {
    audio.setTension(tension);
  }, [audio, tension]);

  // The music slider is the only music control; the Card sounds switch zeroes the sfx bus and its
  // slider multiplies in. Track gains stay inside the port.
  const musicGain = opts.volume.music;
  const sfxGain = opts.sfx ? opts.volume.sfx : 0;
  useEffect(() => {
    audio.setBus("music", musicGain);
  }, [audio, musicGain]);
  useEffect(() => {
    audio.setBus("sfx", sfxGain);
  }, [audio, sfxGain]);

  useEffect(() => {
    if (paused) audio.suspend();
    else audio.resume();
  }, [audio, paused]);
}
