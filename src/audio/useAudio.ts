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

  // The wanted track is a function of the phase, the null-ness, the sheet and the switch alone
  // (the plan's [game?.phase, game === null, sheet, opts.music]), so a move never re-requests it.
  const track = opts.music ? musicFor(game, sheet) : null;
  useEffect(() => {
    audio.setMusic(track);
  }, [audio, track]);

  const tension = tensionFor(game);
  useEffect(() => {
    audio.setTension(tension);
  }, [audio, tension]);

  // The switches zero a bus; the sliders multiply in. Track gains stay inside the port.
  const musicGain = opts.music ? opts.volume.music : 0;
  const sfxGain = opts.sfx ? opts.volume.sfx : 0;
  const ambienceGain = opts.volume.ambience;
  useEffect(() => {
    audio.setBus("music", musicGain);
  }, [audio, musicGain]);
  useEffect(() => {
    audio.setBus("sfx", sfxGain);
  }, [audio, sfxGain]);
  useEffect(() => {
    audio.setBus("ambience", ambienceGain);
  }, [audio, ambienceGain]);

  useEffect(() => {
    if (paused) audio.suspend();
    else audio.resume();
  }, [audio, paused]);
}
