/**
 * Play / Pass / Hint (P:245-250; enablement P:829-833, Hint P:1237-1244). Every enablement
 * rule is a selector value from useGame(); the only decision made here is which button was
 * tapped. Hint shows only with Settings › Hints on. There is no Sort button: a fresh deal is sorted and the player drags cards into any
 * order (ui/Hand.tsx).
 */
import { COPY } from "../game/copy";
import { HUMAN, hintFor, humanTurn } from "../game/selectors";
import { useGame } from "../game/useGame";
import { useSettings } from "../settings/useSettings";

export function Controls() {
  const { game, legal, exact, canPass, act, setSelection } = useGame();
  const { opts } = useSettings();
  const hint = () => {
    const m = hintFor(game, legal, Math.random);
    if (m) setSelection(m.cards);
  };
  const play = () => {
    if (exact) act({ type: "PLAY", player: HUMAN, cards: exact.cards });
  };
  // stacked in the side column: Play on top, then Pass, Hint
  return (
    <div className="controls">
      <button type="button" className="btn primary" disabled={!exact} onClick={play}>
        {COPY.controls.play}
      </button>
      <button type="button" className="btn" disabled={!canPass} onClick={() => act({ type: "PASS", player: HUMAN })}>
        {COPY.controls.pass}
      </button>
      {opts.hints && (
        <button type="button" className="btn" disabled={!humanTurn(game) || !legal.length} onClick={hint}>
          {COPY.controls.hint}
        </button>
      )}
    </div>
  );
}
