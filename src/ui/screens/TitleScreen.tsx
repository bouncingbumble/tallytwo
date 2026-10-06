/**
 * The title (P:222-229, P:1220-1229). Its buttons are the first user gesture, so all three call
 * audio.init() fire-and-forget (§3.7); Deal me in swings the doors and deals after DOORS_MS.
 * The controls render only once the settings have hydrated, so a switch never flips under the
 * player's thumb; the heading is there from the first frame.
 */
import { useEffect, useRef, useState } from "react";
import { COPY } from "../../game/copy";
import { newSeed } from "../../game/seeds";
import type { Sheet } from "../../game/selectors";
import { DOORS_MS } from "../../game/timing";
import { useGame } from "../../game/useGame";
import { useSettings } from "../../settings/useSettings";
import { Doors } from "../Doors";

export interface TitleScreenProps {
  /** A fixed ?seed= replays the same deal every time; without one, each deal draws a fresh seed. */
  seed?: number;
  onSheet: (sheet: Sheet) => void;
}

const doorsMs = (reduceMotion: boolean): number => (reduceMotion ? DOORS_MS.reduced : DOORS_MS.normal);

export function TitleScreen({ seed, onSheet }: TitleScreenProps) {
  const { act, audio } = useGame();
  const { settings, opts, loaded } = useSettings();
  const [doorsOpen, setDoorsOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const deal = () => {
    if (timer.current !== null) return; // the doors are already swinging: a double tap deals once
    void audio.init();
    setDoorsOpen(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      act({ type: "NEW_MATCH", seed: seed ?? newSeed(1), rules: settings.rules });
    }, doorsMs(opts.reduceMotion));
  };
  const openSheet = (sheet: Sheet) => {
    void audio.init();
    onSheet(sheet);
  };

  // Sideways: the name over a saloon front on the left (the sign, the batwing doors, a barrel
  // with a lamp, chips, a stool, a plant), the painting and the three buttons on the right, all
  // standing on a floorboard strip; wall sconces and a chip pile in the corners of a wide frame
  // (base.css .title).
  return (
    <section className="screen title">
      <i className="sp sp-sconce decor decor-tl" aria-hidden="true" />
      <i className="sp sp-sconce_silver decor decor-tr" aria-hidden="true" />
      <i className="sp sp-chips_pile decor decor-br" aria-hidden="true" />
      <div className="marquee">
        <h1 className="western">{COPY.title.name}</h1>
        <p className="sub">{COPY.title.sub}</p>
        <div className="scene" aria-hidden="true">
          <i className="sp sp-sign_saloon at-sign" />
          <Doors open={doorsOpen} />
          <i className="sp sp-barrel at-barrel" />
          <i className="sp sp-lamp at-lamp" />
          <i className="sp sp-chips at-chips" />
          <i className="sp sp-stool at-stool" />
          <i className="sp sp-plant at-plant" />
        </div>
      </div>
      <div className="menu">
        <i className="sp sp-painting menu-art" aria-hidden="true" />
        {loaded && (
          <>
            <button type="button" className="btn primary tbtn" onClick={deal}>
              {COPY.title.deal}
            </button>
            <button type="button" className="btn ghost tbtn" onClick={() => openSheet("howto")}>
              {COPY.title.howto}
            </button>
            <button type="button" className="btn ghost tbtn" onClick={() => openSheet("settings")}>
              {COPY.title.settings}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
