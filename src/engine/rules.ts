/**
 * Every disputed table rule is a flag. The defaults are the Hong Kong game as the
 * prototype shipped it; the settings sheet exposes exactly these two.
 *
 * Fixed, no longer flags: every round is led by whoever holds the 3♦ and that opening play must
 * include it, and a seat that passes may play again if the trick comes back round.
 */
export interface RuleConfig {
  /** Allow A-2-3-4-5 and 2-3-4-5-6 as straights, ranked below every other straight. */
  straightWrap: boolean;
  /** Flushes compare by suit first, then highest card. Off: highest card decides. */
  flushSuitFirst: boolean;
}

export const DEFAULT_RULES: RuleConfig = {
  straightWrap: false,
  flushSuitFirst: true,
};

export const withRules = (patch: Partial<RuleConfig>): RuleConfig => ({ ...DEFAULT_RULES, ...patch });
