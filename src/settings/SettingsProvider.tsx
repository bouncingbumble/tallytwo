/**
 * Settings: one useReducer, hydrated once from the StoragePort and persisted on every change
 * after that. The port arrives as a prop, never an import, so this file copies to React Native
 * unchanged. HOOKS bucket. The reducer is exported so settings.test.ts can drive it directly.
 */
import { type ReactNode, useCallback, useEffect, useMemo, useReducer } from "react";
import type { RuleConfig } from "../engine/rules";
import { DEFAULTS, KEY, type Opts, type Settings, parseSettings, serializeSettings } from "./settings";
import type { StoragePort } from "./storage";
import { type SettingsApi, SettingsContext } from "./useSettings";

export interface SettingsState {
  settings: Settings;
  /** False until the StoragePort has been read; the title renders its controls only after. */
  loaded: boolean;
}

export type SettingsAction = { type: "HYDRATE"; settings: Settings } | { type: "SET_RULES"; patch: Partial<RuleConfig> } | { type: "SET_OPTS"; patch: Partial<Opts> };

export const SETTINGS_INITIAL: SettingsState = { settings: DEFAULTS, loaded: false };

export function settingsReduce(s: SettingsState, a: SettingsAction): SettingsState {
  switch (a.type) {
    case "HYDRATE":
      return { settings: a.settings, loaded: true };
    case "SET_RULES":
      return { ...s, settings: { ...s.settings, rules: { ...s.settings.rules, ...a.patch } } };
    case "SET_OPTS":
      return { ...s, settings: { ...s.settings, opts: { ...s.settings.opts, ...a.patch } } };
  }
}

export function SettingsProvider({ storage, children }: { storage: StoragePort; children: ReactNode }) {
  const [state, dispatch] = useReducer(settingsReduce, SETTINGS_INITIAL);
  const { settings, loaded } = state;

  // Hydrate once per port. `live` drops a read that resolves after unmount (or after StrictMode's
  // first, discarded mount). A port that rejects still unlocks the title, with DEFAULTS.
  useEffect(() => {
    let live = true;
    storage.get(KEY).then(
      (raw) => {
        if (live) dispatch({ type: "HYDRATE", settings: parseSettings(raw) });
      },
      () => {
        if (live) dispatch({ type: "HYDRATE", settings: DEFAULTS });
      },
    );
    return () => {
      live = false;
    };
  }, [storage]);

  // Persist after hydration, whenever the settings object changes. The first run writes the
  // hydrated value back, which upgrades an old blob to the full shape; a failed write is not
  // the game's problem.
  useEffect(() => {
    if (!loaded) return;
    storage.set(KEY, serializeSettings(settings)).catch(() => {});
  }, [storage, settings, loaded]);

  const setRules = useCallback((patch: Partial<RuleConfig>) => dispatch({ type: "SET_RULES", patch }), []);
  const setOpts = useCallback((patch: Partial<Opts>) => dispatch({ type: "SET_OPTS", patch }), []);

  const api = useMemo<SettingsApi>(
    () => ({ settings, rules: settings.rules, opts: settings.opts, loaded, setRules, setOpts }),
    [settings, loaded, setRules, setOpts],
  );

  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>;
}
