/**
 * The fanned hand: every card absolutely positioned at an integer x from fanLayout(), keyed by
 * deal so a fresh deal remounts the cards and replays the deal keyframes (table.css .deal).
 * Taps go to toggleCard(), which already ignores off-turn taps; dimming comes from `live`.
 *
 * Order: a fresh deal is sorted low to high, a rank's cards by suit (selectors.sortHand); from
 * then on the player drags cards wherever they like, any time, their turn or not. The order is
 * UI state per deal, never engine state, and only ever shrinks as cards are played. A press becomes a drag once
 * the pointer has moved DRAG_THRESHOLD px: the card follows the pointer and the others slide to
 * make room (the slot nearest the dragged card's left edge, so the fan reads the same way a
 * finger does), and the click the browser sends after the drag is swallowed so it does not
 * toggle the selection.
 *
 * Cards are rendered in value order and only their x / z-index change on a reorder: a card
 * that is moved in the DOM restarts its CSS animation, and the fly-in must play exactly once
 * per deal.
 */
import { type CSSProperties, type PointerEvent as ReactPointerEvent, useRef, useState } from "react";
import type { Card as CardValue } from "../engine/cards";
import { HUMAN, sortHand } from "../game/selectors";
import { DEAL_STAGGER_MS } from "../game/timing";
import { useGame } from "../game/useGame";
import { CARD_W, SELECT_LIFT, fanLayout } from "../render/fanLayout";
import { useElementWidth } from "../platform/useElementWidth";
import { Card } from "./Card";

const NO_CARDS: readonly CardValue[] = [];
/** A pointer that travels this far (CSS px) is dragging, not tapping. */
const DRAG_THRESHOLD = 6;
/** The dragged card rides above the rest of the fan. */
const DRAG_Z = 99;

/** Card -> index in the fan, for the hand as currently ordered. */
const positions = (hand: readonly CardValue[]): Map<CardValue, number> => new Map(hand.map((v, i) => [v, i]));

/** `hand` with `card` moved to index `to`. */
function moveTo(hand: readonly CardValue[], card: CardValue, to: number): CardValue[] {
  const rest = hand.filter((v) => v !== card);
  rest.splice(to, 0, card);
  return rest;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

interface Order {
  dealId: number;
  /** The player's order; cards that have been played are filtered out at render. */
  cards: CardValue[];
}

interface Drag {
  card: CardValue;
  /** The hand's left edge in client px, so pointer x can be read in hand coordinates. */
  origin: number;
  /** Where the pointer took hold, relative to the card's left edge. */
  grab: number;
  /** The pointer's x at the press. */
  startX: number;
  /** The card's left edge while dragging; null until the press has travelled DRAG_THRESHOLD. */
  x: number | null;
}

export function Hand() {
  const { game, dealId, selection, live, toggleCard } = useGame();
  const [ref, availW] = useElementWidth<HTMLDivElement>();
  const raw = game ? game.players[HUMAN].hand : NO_CARDS;

  // The order, reset on a new deal (reset-on-change, the documented way to key state to a prop).
  const [order, setOrder] = useState<Order>(() => ({ dealId, cards: sortHand(raw) }));
  let cards = order.cards;
  if (order.dealId !== dealId) {
    cards = sortHand(raw);
    setOrder({ dealId, cards });
  }
  const inHand = new Set(raw);
  const hand = cards.filter((v) => inHand.has(v));

  const [drag, setDrag] = useState<Drag | null>(null);
  // True from the moment a press becomes a drag until the next press: the click that follows
  // a drag must not toggle the card.
  const dragged = useRef(false);
  const { xs, x0, step } = fanLayout(hand.length, availW);
  const resting = positions(hand);
  const active = drag !== null && resting.has(drag.card) ? drag : null;
  // While dragging, the other cards make room at the slot nearest the dragged card's left edge.
  const target = active !== null && active.x !== null && step > 0 ? clamp(Math.round((active.x - x0) / step), 0, hand.length - 1) : null;
  const at = target !== null && active !== null ? positions(moveTo(hand, active.card, target)) : resting;

  // The order the cards flew in, frozen per deal: the "deal" class stays on for the life of the
  // card (a finished animation is inert), so a reorder or a play during the fly-in must not
  // change a card's stagger delay.
  const [dealt, setDealt] = useState(() => ({ dealId, at: resting }));
  if (dealt.dealId !== dealId) setDealt({ dealId, at: resting });

  const press = (card: CardValue, e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragged.current = false;
    const origin = ref.current?.getBoundingClientRect().left ?? 0;
    const px = e.clientX - origin;
    const x = xs[resting.get(card) ?? 0] ?? 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ card, origin, grab: px - x, startX: px, x: null });
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (active === null) return;
    const px = e.clientX - active.origin;
    if (active.x === null && Math.abs(px - active.startX) < DRAG_THRESHOLD) return;
    dragged.current = true;
    setDrag({ ...active, x: Math.round(clamp(px - active.grab, 0, Math.max(0, availW - CARD_W))) });
  };
  const release = () => {
    if (active !== null && target !== null) setOrder({ ...order, cards: moveTo(hand, active.card, target) });
    setDrag(null);
  };
  const tap = (card: CardValue) => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    toggleCard(card);
  };

  return (
    <div className="hand" ref={ref} onPointerMove={move} onPointerUp={release} onPointerCancel={release}>
      {raw.map((v) => {
        const i = at.get(v) ?? 0;
        const selected = selection.includes(v);
        const dragging = active !== null && active.x !== null && active.card === v;
        const x = dragging ? active.x : xs[i];
        // The lift lives here, not in a CSS rule: an !important transform would override the
        // deal keyframes, snapping a card tapped mid-fly-in straight to its lifted pose.
        const style = {
          "--x": x + "px",
          transform: `translate(${x}px, ${selected || dragging ? -SELECT_LIFT : 0}px)`,
          zIndex: dragging ? DRAG_Z : i,
          animationDelay: (dealt.at.get(v) ?? i) * DEAL_STAGGER_MS + "ms",
        } as CSSProperties;
        return (
          <Card
            key={dealId + "-" + v}
            value={v}
            selected={selected}
            dim={live !== null && !live.has(v)}
            onClick={tap}
            onPointerDown={press}
            className={dragging ? "deal drag" : "deal"}
            style={style}
          />
        );
      })}
    </div>
  );
}
