/**
 * The three saloon regulars. Each is a tuning of the same heuristics plus the lines they
 * bark. `portrait` names a sprite; the asset layer (assets/names.ts) narrows it to the
 * PortraitKey union and manifest.test.ts proves every value is wired.
 */
export type PersonalityKey = "marshal" | "outlaw" | "gambler";

export interface Barks {
  play: string[];
  pass: string[];
  win: string[];
}

export interface Personality {
  key: PersonalityKey;
  name: string;
  /** Sprite name of the 64x64 portrait: "p_marshal" | "p_outlaw" | "p_gambler". */
  portrait: string;
  /** How dearly control cards are held outside the endgame (Medium only; Hard uses WEIGHTS.hardControl). */
  control: number;
  /** Chance of a random legal move instead of the heuristic one (Medium only). */
  noise: number;
  /** Chance of letting a trick go when taking it would not shorten the hand (Medium only). */
  passBias: number;
  barks: Barks;
}

export const PERSONALITIES: Record<PersonalityKey, Personality> = {
  marshal: {
    key: "marshal",
    name: "Marshal Cobb",
    portrait: "p_marshal",
    control: 9,
    noise: 0.0,
    passBias: 1.0,
    barks: {
      play: ["Steady now.", "That'll hold.", "Mind yourself."],
      pass: ["I'll wait.", "Not worth it."],
      win: ["Justice served."],
    },
  },
  outlaw: {
    key: "outlaw",
    name: "Dusty Vane",
    portrait: "p_outlaw",
    control: 2,
    noise: 0.05,
    passBias: 0.3,
    barks: {
      play: ["Eat that.", "Too slow.", "Comin' through."],
      pass: ["Tch.", "Fine."],
      win: ["Told ya."],
    },
  },
  gambler: {
    key: "gambler",
    name: "Lucky Pearl",
    portrait: "p_gambler",
    control: 5,
    noise: 0.16,
    passBias: 0.7,
    barks: {
      play: ["Feelin' lucky.", "Let's see now.", "Care to fold?"],
      pass: ["Hmm.", "I'll sit this one."],
      win: ["House always wins."],
    },
  },
};

export const isPersonalityKey = (k: unknown): k is PersonalityKey => k === "marshal" || k === "outlaw" || k === "gambler";
