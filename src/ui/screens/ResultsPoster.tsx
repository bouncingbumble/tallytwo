/**
 * The end-of-round WANTED poster (P:995-1028) and, when matchOver() says the match is done, the
 * FINAL TALLY poster in the same frame (the original build plan §3.4): the match winner instead of the round
 * winner, "$N over M rounds" instead of the reward, rows sorted by tally, New match in place of
 * Next round. Shown over the table while game.phase === "scored"; renders nothing otherwise.
 */
import type { Player } from "../../engine/state";
import { COPY } from "../../game/copy";
import { newSeed } from "../../game/seeds";
import { HUMAN, matchOver, matchWinner, portraitFor, roundDeltas, roundWinner } from "../../game/selectors";
import { useGame } from "../../game/useGame";
import { useSettings } from "../../settings/useSettings";
import { Overlay } from "../Overlay";

/** "+3" / "0" / "-7": the table shows the sign on gains (P:1014-1015). */
const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

/**
 * The 61x71 WANTED sketch for the human, the 64x64 portrait for an AI seat (P:1000) — as a
 * class each (styles/table.css): an image-set over the 1x/2x/3x files, drawn 1:1.
 */
function faceClass(seat: number, p: Player): string {
  if (seat === HUMAN) return "face wanted";
  const key = portraitFor(p);
  return key ? "face " + key : "face";
}

export function ResultsPoster() {
  const { game, act } = useGame();
  const { settings, opts } = useSettings();
  const deltas = roundDeltas(game);
  const roundWin = roundWinner(game);
  if (!game || game.phase !== "scored" || !deltas || roundWin === null) return null;

  const final = matchOver(game, opts.roundsPerMatch);
  const winner = final ? matchWinner(game) : roundWin;
  const title = final ? COPY.poster.finalTally : COPY.poster.wanted;
  const face = faceClass(winner, game.players[winner]);
  const rows = game.players.map((p, i) => ({ seat: i, name: p.name, cards: p.hand.length, delta: deltas[i], total: game.totals[i] }));
  if (final) rows.sort((a, b) => b.total - a.total);

  return (
    <Overlay label={title}>
      <div className="poster">
        <h2 className={final ? "western final" : "western"}>{title}</h2>
        <div className="rule" />
        <div className={face} />
        <div className="winner western">{game.players[winner].name}</div>
        <div className="reward">
          {final ? (
            COPY.poster.overRounds(game.totals[winner], game.round)
          ) : (
            <>
              <b>{COPY.poster.reward(deltas[winner])}</b>
              {COPY.poster.rewardLine}
            </>
          )}
        </div>
        <table>
          <thead>
            <tr>
              <th>{COPY.poster.player}</th>
              <th>{COPY.poster.cards}</th>
              <th>{COPY.poster.round}</th>
              <th>{COPY.poster.tally}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.seat}>
                <td>{r.name}</td>
                <td>{r.cards}</td>
                <td className={r.delta >= 0 ? "pos" : "neg"}>{signed(r.delta)}</td>
                <td>{signed(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ovbtns">
          {final ? (
            <button type="button" className="btn primary" onClick={() => act({ type: "NEW_MATCH", seed: newSeed(1), rules: settings.rules })}>
              {COPY.poster.newMatch}
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={() => act({ type: "NEXT_ROUND", seed: newSeed(game.round + 1) })}>
              {COPY.poster.nextRound}
            </button>
          )}
          <button type="button" className="btn ghost" onClick={() => act({ type: "QUIT" })}>
            {COPY.poster.saddleUp}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
