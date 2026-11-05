/**
 * The settings sheet (P:256-282), labels verbatim from copy.ts. One sheet serves the title and
 * the table; only the footer differs (the original build plan §5 M4): "Done" from the title; the seed line and
 * Copy game log / Quit game / Back to table in a game. Everything applies live, rules included:
 * GameProvider pushes a rules change into the game in progress (appReducer SET_RULES). No playback here: useAudio follows the switches via settings.
 */
import { type ReactNode, useId } from "react";
import type { Difficulty } from "../../ai/choose";
import { serializeLog } from "../../game/appReducer";
import { COPY } from "../../game/copy";
import { gameLog } from "../../game/selectors";
import { SPEED_MULTIPLIERS, type Speed, type SpeedMultiplier } from "../../game/timing";
import { useGame } from "../../game/useGame";
import type { Volume } from "../../settings/settings";
import { useSettings } from "../../settings/useSettings";
import { CopyButton } from "../CopyButton";
import { Overlay } from "../Overlay";
import { Switch } from "../Switch";

export interface SettingsSheetProps {
  onClose: () => void;
  /** Replaces the clipboard write behind "Copy game log" when given. */
  onCopyLog?: () => void;
}

interface Option<T> {
  value: T;
  label: string;
}

const t = COPY.settings;
const DIFFICULTY: readonly Option<Difficulty>[] = [
  { value: "easy", label: t.easy },
  { value: "medium", label: t.medium },
  { value: "hard", label: t.hard },
];
const SPEED: readonly Option<Speed>[] = [
  { value: "fast", label: t.fast },
  { value: "normal", label: t.normal },
  { value: "slow", label: t.slow },
];
const GAME_SPEED: readonly Option<SpeedMultiplier>[] = SPEED_MULTIPLIERS.map((m) => ({ value: m, label: `${m}x` }));

/** One labelled row (P:260): the label names the control through htmlFor and its own id. */
function Row({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="row">
      <label id={`${id}-label`} htmlFor={id}>
        {label}
        {hint && <span className="hintline">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function SwitchRow({ id, label, hint, on, onChange }: { id: string; label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row id={id} label={label} hint={hint}>
      <Switch id={id} labelId={`${id}-label`} on={on} onChange={onChange} />
    </Row>
  );
}

function SelectRow<T extends string | number>({
  id,
  label,
  hint,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <Row id={id} label={label} hint={hint}>
      <select
        id={id}
        value={String(value)}
        onChange={(e) => {
          const o = options.find((x) => String(x.value) === e.target.value);
          if (o) onChange(o.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </Row>
  );
}

function RangeRow({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Row id={id} label={label}>
      <input id={id} type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </Row>
  );
}

export function SettingsSheet({ onClose, onCopyLog }: SettingsSheetProps) {
  const { game, act } = useGame();
  const { rules, opts, setRules, setOpts } = useSettings();
  const uid = useId();
  const id = (key: string): string => `${uid}${key}`;
  const setVolume = (patch: Partial<Volume>) => setOpts({ volume: { ...opts.volume, ...patch } });

  return (
    <Overlay label={t.title}>
      <div className="sheet">
        <h2 className="western">{t.title}</h2>

        <h3>{t.tableRules}</h3>
        <SwitchRow id={id("straightWrap")} label={t.straightWrap} hint={t.straightWrapHint} on={rules.straightWrap} onChange={(v) => setRules({ straightWrap: v })} />
        <SwitchRow id={id("flushSuitFirst")} label={t.flushSuitFirst} hint={t.flushSuitFirstHint} on={rules.flushSuitFirst} onChange={(v) => setRules({ flushSuitFirst: v })} />

        <h3>{t.tableFeel}</h3>
        <SelectRow id={id("difficulty")} label={t.difficulty} hint={t.difficultyHint} value={opts.difficulty} options={DIFFICULTY} onChange={(v) => setOpts({ difficulty: v })} />
        <SelectRow id={id("gameSpeed")} label={t.gameSpeed} hint={t.gameSpeedHint} value={opts.speedMultiplier} options={GAME_SPEED} onChange={(v) => setOpts({ speedMultiplier: v })} />
        <SelectRow id={id("speed")} label={t.speed} hint={t.speedHint} value={opts.speed} options={SPEED} onChange={(v) => setOpts({ speed: v })} />
        <SwitchRow id={id("music")} label={t.music} hint={t.musicHint} on={opts.music} onChange={(v) => setOpts({ music: v })} />
        <SwitchRow id={id("sfx")} label={t.sfx} on={opts.sfx} onChange={(v) => setOpts({ sfx: v })} />
        <RangeRow id={id("volumeMusic")} label={`${t.volume} · ${t.volumeMusic}`} value={opts.volume.music} onChange={(v) => setVolume({ music: v })} />
        <RangeRow id={id("volumeSfx")} label={`${t.volume} · ${t.volumeSfx}`} value={opts.volume.sfx} onChange={(v) => setVolume({ sfx: v })} />
        <RangeRow id={id("volumeAmbience")} label={`${t.volume} · ${t.volumeAmbience}`} value={opts.volume.ambience} onChange={(v) => setVolume({ ambience: v })} />
        <SwitchRow id={id("reduceMotion")} label={t.reduceMotion} on={opts.reduceMotion} onChange={(v) => setOpts({ reduceMotion: v })} />

        {game === null ? (
          <div className="ovbtns">
            <button type="button" className="btn primary" onClick={onClose}>
              {t.done}
            </button>
          </div>
        ) : (
          <>
            <p className="muted">{t.seedLine(game.seed, game.round)}</p>
            <div className="ovbtns">
              <CopyButton className="btn ghost" text={() => serializeLog(gameLog(game))} label={t.copyLog} copiedLabel={t.copied} onCopy={onCopyLog} />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  act({ type: "QUIT" });
                  onClose();
                }}
              >
                {t.quit}
              </button>
              <button type="button" className="btn primary" onClick={onClose}>
                {t.back}
              </button>
            </div>
          </>
        )}
      </div>
    </Overlay>
  );
}
