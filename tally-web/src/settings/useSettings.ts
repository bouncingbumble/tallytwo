/**
 * Settings as read by components. SettingsProvider builds this value. HOOKS bucket.
 */
import { createContext, useContext } from "react";
import type { RuleConfig } from "../engine/rules";
import type { Opts, Settings } from "./settings";

export interface SettingsApi {
  settings: Settings;
  rules: RuleConfig;
  opts: Opts;
  /** False until the StoragePort has been read; the title renders its controls only after. */
  loaded: boolean;
  setRules(patch: Partial<RuleConfig>): void;
  setOpts(patch: Partial<Opts>): void;
}

export const SettingsContext = createContext<SettingsApi | null>(null);

export function useSettings(): SettingsApi {
  const v = useContext(SettingsContext);
  if (!v) throw new Error("useSettings() must be used inside <SettingsProvider>");
  return v;
}
