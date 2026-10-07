/**
 * The web shell. The two platform objects — WebAudio and webStorage — are created here and
 * handed to the providers as props, so nothing in game/ or settings/ imports them (the original build plan
 * §3.2); query parsing (?seed=) lives here too, because URLSearchParams is a DOM type. Screens
 * is the one place that switches crash / title / table and owns the sheet state.
 */
import { useEffect, useMemo, useState } from "react";
import { useAudio } from "./audio/useAudio";
import { WebAudio } from "./audio/WebAudio";
import { DevHook } from "./dev/DevHook";
import { GameProvider } from "./game/GameProvider";
import type { Sheet } from "./game/selectors";
import { useGame } from "./game/useGame";
import { useTurnLoop } from "./game/useTurnLoop";
import { ScaleContext, fitClass, fitStyle, useFitScale } from "./platform/useFitScale";
import { usePageVisibility } from "./platform/usePageVisibility";
import { webStorage } from "./platform/webStorage";
import { SettingsProvider } from "./settings/SettingsProvider";
import { useSettings } from "./settings/useSettings";
import { CrashScreen } from "./ui/CrashScreen";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { HowToSheet } from "./ui/screens/HowToSheet";
import { ResultsPoster } from "./ui/screens/ResultsPoster";
import { SettingsSheet } from "./ui/screens/SettingsSheet";
import { TableScreen } from "./ui/screens/TableScreen";
import { TitleScreen } from "./ui/screens/TitleScreen";

/** ?seed=N fixes the deal (gates and bug reports). */
function readQuery(): { seed: number | undefined } {
  const params = new URLSearchParams(location.search);
  const raw = params.get("seed");
  // explicit, so ?seed=0 (a valid seed) is honoured and garbage is ignored
  const seed = raw !== null && raw.trim() !== "" && Number.isInteger(Number(raw)) ? Number(raw) >>> 0 : undefined;
  return { seed };
}

export function App() {
  const audio = useMemo(() => new WebAudio(), []);
  const storage = webStorage;
  const query = useMemo(() => readQuery(), []);
  // Bumped by the error boundary's Saddle up: a new key remounts the store at INITIAL.
  const [epoch, setEpoch] = useState(0);
  return (
    <SettingsProvider storage={storage}>
      <ErrorBoundary onReset={() => setEpoch((n) => n + 1)}>
        <GameProvider key={epoch} audio={audio}>
          <Screens seed={query.seed} />
          {import.meta.env.DEV && <DevHook />}
        </GameProvider>
      </ErrorBoundary>
    </SettingsProvider>
  );
}

function Screens({ seed }: { seed?: number }) {
  const { game, crash, act, audio } = useGame();
  const { opts } = useSettings();
  const [sheet, setSheet] = useState<Sheet>("none");
  // The table is laid out for a phone held sideways (styles/table.css); there is no orientation
  // gate, so only a hidden tab pauses the AI.
  const paused = usePageVisibility();
  // The logical canvas scaled to the viewport (platform/useFitScale.ts): k rides on ScaleContext
  // for the hooks that measure the DOM.
  const fit = useFitScale();
  useTurnLoop(paused);
  useAudio({ sheet, paused });

  // iOS interruptions (a call, Siri, the lock screen) leave the AudioContext not running; the
  // next tap anywhere is the gesture Safari wants (§3.7).
  useEffect(() => {
    const resume = () => audio.resume();
    document.addEventListener("pointerdown", resume);
    return () => document.removeEventListener("pointerdown", resume);
  }, [audio]);

  // The textures (--wood, --felt-tex, the portraits) are image-set() vars in styles/tokens.css,
  // resolved by Vite: setting them here as plain url()s would override the 2x/3x files with the
  // 1x one, which iOS Safari then resamples (docs/ASSETS.md §7).

  useEffect(() => {
    document.body.classList.toggle("nomotion", opts.reduceMotion);
  }, [opts.reduceMotion]);

  const closeSheet = () => setSheet("none");
  return (
    <ScaleContext value={fit.k}>
      <div className={fitClass(fit)} style={fitStyle(fit)}>
        {crash ? (
          <CrashScreen report={crash} onReset={() => act({ type: "QUIT" })} />
        ) : game === null ? (
          <TitleScreen seed={seed} onSheet={setSheet} />
        ) : (
          <>
            <TableScreen onMenu={() => setSheet("settings")} />
            {game.phase === "scored" && <ResultsPoster />}
          </>
        )}
        {!crash && sheet === "settings" && <SettingsSheet onClose={closeSheet} />}
        {!crash && sheet === "howto" && <HowToSheet onClose={closeSheet} />}
      </div>
    </ScaleContext>
  );
}
