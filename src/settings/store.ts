/**
 * Settings: one reducer, hydrated once from the StoragePort and persisted on every change after
 * that. The port arrives as a constructor argument, never an import. PURE.
 */
import type { RuleConfig } from "../engine/rules";
import { Observable } from "../game/observable";
import { DEFAULTS, KEY, type Opts, type Settings, serializeSettings, settingsFor } from "./settings";
import type { StoragePort } from "./storage";

export interface SettingsState {
  settings: Settings;
  /** False until the StoragePort has been read; the title shows its buttons only after. */
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

export class SettingsStore extends Observable {
  #state: SettingsState = SETTINGS_INITIAL;
  readonly #storage: StoragePort;

  constructor(storage: StoragePort) {
    super();
    this.#storage = storage;
  }

  get state(): SettingsState {
    return this.#state;
  }
  get settings(): Settings {
    return this.#state.settings;
  }
  get rules(): RuleConfig {
    return this.#state.settings.rules;
  }
  get opts(): Opts {
    return this.#state.settings.opts;
  }
  get loaded(): boolean {
    return this.#state.loaded;
  }

  /**
   * Read the port once. Nothing stored is a first-time player (settingsFor: easy, hints on), and
   * the write that follows the hydrate saves that, so the next visit is a returning one. A port
   * that rejects still unlocks the title, with DEFAULTS: an unreadable store is not proof of a new player.
   */
  async hydrate(): Promise<void> {
    let settings: Settings;
    try {
      settings = settingsFor(await this.#storage.get(KEY));
    } catch {
      settings = DEFAULTS;
    }
    this.#dispatch({ type: "HYDRATE", settings });
  }

  setRules = (patch: Partial<RuleConfig>): void => this.#dispatch({ type: "SET_RULES", patch });
  setOpts = (patch: Partial<Opts>): void => this.#dispatch({ type: "SET_OPTS", patch });

  #dispatch(a: SettingsAction): void {
    const next = settingsReduce(this.#state, a);
    if (next === this.#state) return;
    this.#state = next;
    // Persist after hydration. The first write upgrades an old blob to the full shape; a failed
    // write is not the game's problem.
    if (next.loaded) this.#storage.set(KEY, serializeSettings(next.settings)).catch(() => {});
    this.emit();
  }
}
