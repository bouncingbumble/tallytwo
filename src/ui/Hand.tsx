/**
 * The fanned hand: every card absolutely positioned at an integer x from fanLayout(), keyed by
 * deal so a fresh deal remounts the cards and replays the deal keyframes (table.css .deal).
 * Taps go to toggleCard(), which already ignores off-turn taps; dimming comes from `live`.
 *
 * Cards are rendered in value order and only their x / z-index change on Sort: a card that is
 * moved in the DOM restarts its CSS animation, and the fly-in must play exactly once per deal.
 */
import { type CSSProperties, useState } from "react";
import type { Card as CardValue } from "../engine/cards";
import { HUMAN, sortHand } from "../game/selectors";
import { DEAL_STAGGER_MS } from "../game/timing";
import { useGame } from "../game/useGame";
import { SELECT_LIFT, fanLayout } from "../render/fanLayout";
import { useElementWidth } from "../platform/useElementWidth";
import { useSettings } from "../settings/useSettings";
import { Card } from "./Card";

const NO_CARDS: readonly CardValue[] = [];

/** Card -> index in the fan, for the hand as currently sorted. */
const positions = (hand: readonly CardValue[]): Map<CardValue, number> => new Map(hand.map((v, i) => [v, i]));

export function Hand() {
  const { game, dealId, selection, live, toggleCard } = useGame();
  const { opts } = useSettings();
  const [ref, availW] = useElementWidth<HTMLDivElement>();
  const raw = game ? game.players[HUMAN].hand : NO_CARDS;
  const hand = sortHand(raw, opts.sortBy);
  const { xs } = fanLayout(hand.length, availW);
  const at = positions(hand);
  // The order the cards flew in, frozen per deal: the "deal" class stays on for the life of the
  // card (a finished animation is inert), so a Sort or a play during the fly-in must not change
  // a card's stagger delay. Reset-on-change is the documented way to key state to a prop.
  const [dealt, setDealt] = useState(() => ({ dealId, at }));
  if (dealt.dealId !== dealId) setDealt({ dealId, at });
  return (
    <div className="hand" ref={ref}>
      {raw.map((v) => {
        const i = at.get(v) ?? 0;
        const selected = selection.includes(v);
        // The lift lives here, not in a CSS rule: an !important transform would override the
        // deal keyframes, snapping a card tapped mid-fly-in straight to its lifted pose.
        const style = {
          "--x": xs[i] + "px",
          transform: `translate(${xs[i]}px, ${selected ? -SELECT_LIFT : 0}px)`,
          zIndex: i,
          animationDelay: (dealt.at.get(v) ?? i) * DEAL_STAGGER_MS + "ms",
        } as CSSProperties;
        return (
          <Card
            key={dealId + "-" + v}
            value={v}
            selected={selected}
            dim={live !== null && !live.has(v)}
            onClick={toggleCard}
            className="deal"
            style={style}
          />
        );
      })}
    </div>
  );
}
