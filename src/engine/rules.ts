/**
 * Every disputed table rule is a flag. The defaults are the Hong Kong game as the
 * prototype shipped it; the settings sheet exposes exactly these five.
 */
export type LaterRoundLead = "winner" | "loser" | "threeD";

export interface RuleConfig {
  /** Pass and you are out until the trick clears. Off: you may play again if it comes back round. */
  passLocksOut: boolean;
  /** Allow A-2-3-4-5 and 2-3-4-5-6 as straights, ranked below every other straight. */
  straightWrap: boolean;
  /** Flushes compare by suit first, then highest card. Off: highest card decides. */
  flushSuitFirst: boolean;
  /** The opening lead of a round that starts with the 3♦ holder must include the 3♦. */
  mustLeadWith3D: boolean;
  /** Who leads round 2 onwards. "threeD" makes every round start like round 1. */
  laterRoundLead: LaterRoundLead;
}

export const DEFAULT_RULES: RuleConfig = {
  passLocksOut: false,
  straightWrap: false,
  flushSuitFirst: true,
  mustLeadWith3D: true,
  laterRoundLead: "winner",
};

export const withRules = (patch: Partial<RuleConfig>): RuleConfig => ({ ...DEFAULT_RULES, ...patch });
