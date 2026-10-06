/**
 * Pass / Sort / Hint / Play (P:245-250; enablement P:829-833, Sort P:1232-1236, Hint
 * P:1237-1244). Every enablement rule is a selector value from useGame(); the only decision
 * made here is which button was tapped.
 */
import { COPY } from "../game/copy";
import { HUMAN, hintFor, humanTurn } from "../game/selectors";
import { useGame } from "../game/useGame";
import type { SortBy } from "../settings/settings";
import { useSettings } from "../settings/useSettings";

export function Controls({ onSort }: { onSort?: (by: SortBy) => void }) {
  const { game, legal, exact, canPass, act, setSelection } = useGame();
  const { opts, setOpts } = useSettings();
  const sort = () => {
    const by: SortBy = opts.sortBy === "rank" ? "suit" : "rank";
    setOpts({ sortBy: by });
    onSort?.(by);
  };
  const hint = () => {
    const m = hintFor(game, legal, Math.random);
    if (m) setSelection(m.cards);
  };
  const play = () => {
    if (exact) act({ type: "PLAY", player: HUMAN, cards: exact.cards });
  };
  // stacked in the side column: Play on top, then Pass, Hint, Sort
  return (
    <div className="controls">
      <button type="button" className="btn primary" disabled={!exact} onClick={play}>
        {COPY.controls.play}
      </button>
      <button type="button" className="btn" disabled={!canPass} onClick={() => act({ type: "PASS", player: HUMAN })}>
        {COPY.controls.pass}
      </button>
      <button type="button" className="btn" disabled={!humanTurn(game) || !legal.length} onClick={hint}>
        {COPY.controls.hint}
      </button>
      <button type="button" className="btn" onClick={sort}>
        {COPY.controls.sort}
      </button>
    </div>
  );
}
