/**
 * settings.ts: parseSettings merges any blob over DEFAULTS without ever throwing — the
 * prototype's exact localStorage blob included — and the SettingsProvider reducer hydrates and
 * merges patches. The StoragePort round-trip uses the in-memory port.
 */
import { expect, test } from "vitest";
import { DEFAULT_RULES } from "../engine/rules";
import { DEFAULTS, KEY, type Settings, parseSettings, serializeSettings } from "./settings";
import { SETTINGS_INITIAL, settingsReduce } from "./SettingsProvider";
import { memoryStorage } from "./storage";

/** What a returning player has under KEY (P:685, saved by saveOpts). */
const PROTOTYPE_BLOB =
  '{"rules":{"passLocksOut":false,"straightWrap":false,"flushSuitFirst":true,"mustLeadWith3D":true,"laterRoundLead":"winner"},"opts":{"difficulty":"medium","speed":"normal","music":true,"sfx":true,"autoPass":true,"reduceMotion":false,"sortBy":"rank"}}';

test("garbage -> DEFAULTS, never a throw", () => {
  for (const raw of [null, undefined, "", "not json", "42", "[1,2]", "null", "true", '{"rules":5,"opts":"x"}', "{", '{"rules":[],"opts":[]}']) {
    expect(parseSettings(raw)).toEqual(DEFAULTS);
  }
  expect(parseSettings("{}")).not.toBe(DEFAULTS); // a fresh object every time
});

test("the prototype's blob: the retired rules and the old pace dropped, the rest kept", () => {
  const s = parseSettings(PROTOTYPE_BLOB);
  expect(s.rules).toEqual(DEFAULT_RULES); // passLocksOut and mustLeadWith3D are no longer flags
  expect(s.opts).toEqual({ ...DEFAULTS.opts, gameSpeed: "slow" }); // its "normal" pace at the old 1x -> slow
  expect(s.opts.volume).toEqual({ music: 1, sfx: 1 });
});

test("a prototype blob with changed values keeps every one that still exists", () => {
  const rules = { passLocksOut: true, straightWrap: true, flushSuitFirst: false, mustLeadWith3D: false, laterRoundLead: "loser" };
  const opts = { difficulty: "hard", speed: "slow", music: false, sfx: false, reduceMotion: true }; // the prototype's autoPass and sortBy are dropped: the player is never passed for, and a fresh deal is always in value order
  const s = parseSettings(JSON.stringify({ rules, opts }));
  expect(s.rules).toEqual({ straightWrap: true, flushSuitFirst: false }); // passLocksOut, mustLeadWith3D and laterRoundLead are no longer flags
  expect(s.opts).toEqual({ difficulty: "hard", gameSpeed: "slow", hints: false, sfx: false, volume: { music: 0, sfx: 1 } }); // the old piano switch off -> music volume 0; reduceMotion is no longer a setting
});

test("gameSpeed: normal by default, only slow / normal / fast accepted", () => {
  expect(DEFAULTS.opts.gameSpeed).toBe("normal");
  expect(parseSettings(JSON.stringify({ opts: { gameSpeed: "fast" } })).opts.gameSpeed).toBe("fast");
  expect(parseSettings(JSON.stringify({ opts: { gameSpeed: "warp" } })).opts.gameSpeed).toBe("normal");
});

test("gameSpeed: a blob from before the merge maps the old multiplier and pace onto one tier", () => {
  const speedOf = (opts: object) => parseSettings(JSON.stringify({ opts })).opts.gameSpeed;
  expect(speedOf({ speed: "normal", speedMultiplier: 1 })).toBe("slow");
  expect(speedOf({ speed: "slow", speedMultiplier: 1 })).toBe("slow");
  expect(speedOf({ speed: "normal", speedMultiplier: 2 })).toBe("normal");
  expect(speedOf({ speed: "normal", speedMultiplier: 3 })).toBe("fast");
  expect(speedOf({ speed: "fast", speedMultiplier: 4 })).toBe("fast");
  expect(speedOf({ speed: "fast" })).toBe("fast");
  expect(speedOf({ gameSpeed: "slow", speed: "fast", speedMultiplier: 4 })).toBe("slow"); // a saved gameSpeed wins
  expect("speed" in parseSettings(JSON.stringify({ opts: { speed: "fast" } })).opts).toBe(false);
  expect("speedMultiplier" in parseSettings(JSON.stringify({ opts: { speedMultiplier: 2 } })).opts).toBe(false);
});

test("hints: off by default, kept when saved", () => {
  expect(DEFAULTS.opts.hints).toBe(false);
  expect(parseSettings(JSON.stringify({ opts: { hints: true } })).opts.hints).toBe(true);
  expect(parseSettings(JSON.stringify({ opts: { hints: "yes" } })).opts.hints).toBe(false);
});

test("a wrong-typed field falls back to its default; the fields around it survive", () => {
  const s = parseSettings(
    JSON.stringify({
      rules: { passLocksOut: "yes", straightWrap: true, laterRoundLead: "nobody" },
      opts: { music: 0, sfx: false, gameSpeed: "warp", difficulty: "hard", roundsPerMatch: 7, sortBy: 1, volume: { music: "loud", sfx: 0.5, ambience: 2 } },
    }),
  );
  expect(s.rules).toEqual({ ...DEFAULT_RULES, straightWrap: true });
  expect(s.opts.volume.music).toBe(1); // a non-boolean "music" is not the old switch turned off
  expect(s.opts.sfx).toBe(false);
  expect(s.opts.gameSpeed).toBe("normal");
  expect(s.opts.difficulty).toBe("hard");
  expect("sortBy" in s.opts).toBe(false); // a saved sortBy from the old Sort button is ignored
  expect("roundsPerMatch" in s.opts).toBe(false); // a saved roundsPerMatch is ignored too: a match is always 8 rounds
  expect(s.opts.volume).toEqual({ music: 1, sfx: 0.5 }); // the retired ambience slider is dropped
  expect(parseSettings(JSON.stringify({ opts: { volume: { sfx: -3 } } })).opts).toEqual({ ...DEFAULTS.opts, volume: { music: 1, sfx: 0 } }); // clamped to [0, 1]
  expect(parseSettings(JSON.stringify({ opts: { volume: "max" } })).opts.volume).toEqual(DEFAULTS.opts.volume);
});

test("unknown keys are dropped", () => {
  const s = parseSettings(JSON.stringify({ rules: { ...DEFAULT_RULES, houseRule: true }, opts: { ...DEFAULTS.opts, theme: "dark" }, extra: 1 }));
  expect(s).toEqual(DEFAULTS);
  expect(Object.keys(s).sort()).toEqual(["opts", "rules"]);
  expect(Object.keys(s.rules).sort()).toEqual(Object.keys(DEFAULT_RULES).sort());
  expect(Object.keys(s.opts).sort()).toEqual(Object.keys(DEFAULTS.opts).sort());
  expect(Object.keys(s.opts.volume).sort()).toEqual(["music", "sfx"]);
});

test("round-trip through memoryStorage: parseSettings(await get(KEY)) after set", async () => {
  const storage = memoryStorage();
  const s: Settings = {
    rules: { ...DEFAULT_RULES, flushSuitFirst: false, straightWrap: true },
    opts: { ...DEFAULTS.opts, gameSpeed: "fast", hints: true, volume: { music: 0.5, sfx: 0.25 } },
  };
  expect(await storage.get(KEY)).toBeNull();
  expect(parseSettings(await storage.get(KEY))).toEqual(DEFAULTS);
  await storage.set(KEY, serializeSettings(s));
  expect(parseSettings(await storage.get(KEY))).toEqual(s);
  expect(storage.data.get(KEY)).toBe(JSON.stringify(s));
  expect(KEY).toBe("tallytwo.settings");
});

test("settingsReduce: HYDRATE replaces the settings and sets loaded", () => {
  expect(SETTINGS_INITIAL).toEqual({ settings: DEFAULTS, loaded: false });
  const hydrated: Settings = { ...DEFAULTS, opts: { ...DEFAULTS.opts, sfx: false } };
  const s = settingsReduce(SETTINGS_INITIAL, { type: "HYDRATE", settings: hydrated });
  expect(s.loaded).toBe(true);
  expect(s.settings).toBe(hydrated);
  expect(SETTINGS_INITIAL.loaded).toBe(false); // never mutated
});

test("settingsReduce: SET_OPTS merges a patch over the opts, SET_RULES over the rules", () => {
  const s0 = settingsReduce(SETTINGS_INITIAL, { type: "HYDRATE", settings: DEFAULTS });
  const s1 = settingsReduce(s0, { type: "SET_OPTS", patch: { gameSpeed: "slow", sfx: false } });
  expect(s1.loaded).toBe(true);
  expect(s1.settings.opts).toEqual({ ...DEFAULTS.opts, gameSpeed: "slow", sfx: false });
  expect(s1.settings.rules).toBe(DEFAULTS.rules);
  const s2 = settingsReduce(s1, { type: "SET_OPTS", patch: { volume: { ...s1.settings.opts.volume, music: 0.2 } } });
  expect(s2.settings.opts).toEqual({ ...DEFAULTS.opts, gameSpeed: "slow", sfx: false, volume: { music: 0.2, sfx: 1 } });
  const s3 = settingsReduce(s2, { type: "SET_RULES", patch: { straightWrap: true } });
  expect(s3.settings.rules).toEqual({ ...DEFAULT_RULES, straightWrap: true });
  expect(s3.settings.opts).toBe(s2.settings.opts);
  expect(DEFAULTS.opts.gameSpeed).toBe("normal"); // never mutated
});
