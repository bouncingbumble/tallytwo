/**
 * Every disputed table rule is a flag. The defaults are the Hong Kong game; the settings sheet
 * exposes exactly this one.
 *
 * Fixed, no longer flags: every round is led by whoever holds the 3♦ and that opening play must
 * include it, a seat that passes may play again if the trick comes back round, and flushes
 * compare by suit first, then highest card.
 */
export interface RuleConfig {
  /** Allow A-2-3-4-5 and 2-3-4-5-6 as straights, ranked below every other straight. */
  straightWrap: boolean;
}

export const DEFAULT_RULES: RuleConfig = {
  straightWrap: false,
};

export const withRules = (patch: Partial<RuleConfig>): RuleConfig => ({ ...DEFAULT_RULES, ...patch });
