/**
 * The palette and the type scale, in one place for every scene.
 *
 * Mobile size floors, in logical px of the 440-px canvas. The canvas is scaled by
 * k = viewportHeight / 440, and the smallest k designed for is 0.75 (an iPhone SE held sideways
 * in Safari with its toolbar showing, 667x331). Every size below is the target in physical CSS
 * px divided by 0.75: no text under FS_MIN (11.25 CSS px there), no control under TAP (45 CSS px
 * there).
 */
export const C = {
  oakDeep: 0x241408,
  oak: 0x3e2715,
  oakLight: 0x5c3a20,
  felt: 0x1e4a38,
  feltDark: 0x153627,
  amber: 0xe8a33d,
  bone: 0xf2e8d5,
  ink: 0x191310,
  red: 0xb8372b,
  dust: 0xc9b08a,
  black: 0x120a04,
} as const;

/** The same colours as CSS strings, for Text and the canvas painter. */
export const CSS = {
  oakDeep: "#241408",
  oak: "#3e2715",
  oakLight: "#5c3a20",
  felt: "#1e4a38",
  amber: "#e8a33d",
  bone: "#f2e8d5",
  dust: "#c9b08a",
  black: "#120a04",
  low: "#ff8a6b",
  bad: "#e88a6b",
  good: "#8fd08a",
  paperInk: "#2a1a0f",
  paperMuted: "#6b5433",
  neg: "#8a2c22",
  pos: "#2f6b2c",
  barkInk: "#241408",
  feltText: "rgba(242, 232, 213, 0.78)",
  log: "#cfe6c9",
} as const;

export const SANS = 'ui-sans-serif, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const WESTERN = 'Rye, Georgia, "Times New Roman", serif';
export const MONO = "ui-monospace, Menlo, Consolas, monospace";

export const FS_MIN = 15;
export const FS_BODY = 16;
export const FS_EM = 18;
export const TAP = 60;
