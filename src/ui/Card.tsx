import type { CSSProperties } from "react";
import { type Card as CardValue, cardName } from "../engine/cards";
import { atlasCell } from "../render/atlas";

export interface CardProps {
  value: CardValue;
  /** Pile size (one scale step smaller than the hand). */
  small?: boolean;
  selected?: boolean;
  dim?: boolean;
  /** No handler = a disabled button, so it is not a tab stop. */
  onClick?: (value: CardValue) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * One card face from the atlas. The face is a CSS background positioned by --col/--row
 * (styles/cards.css); the element itself is exactly --cw x --ch so the sprite never scales.
 */
export function Card({ value, small, selected, dim, onClick, className, style }: CardProps) {
  const { col, row } = atlasCell(value);
  const cls = ["card", small && "small", selected && "sel", dim && "dim", className].filter(Boolean).join(" ");
  const css = { "--col": col, "--row": row, ...style } as CSSProperties;
  return (
    <button
      type="button"
      className={cls}
      style={css}
      aria-label={cardName(value)}
      aria-pressed={onClick ? !!selected : undefined}
      disabled={!onClick}
      onClick={onClick ? () => onClick(value) : undefined}
    />
  );
}

/** A face-down card (opponents' hands, the title doors). */
export function CardBack({ small, className, style }: { small?: boolean; className?: string; style?: CSSProperties }) {
  const cls = ["card", "facedown", small && "small", className].filter(Boolean).join(" ");
  return <span className={cls} style={style} aria-hidden="true" />;
}
