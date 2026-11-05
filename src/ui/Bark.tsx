/**
 * What a regular just said, as a speech bubble on their own card (styles/table.css .bark): it
 * covers the info column and points at the portrait. Mounting with "show" runs the barkin
 * keyframes (motion.css) — a fade in place, no travel; useBarks removes the entry after
 * BARK_MS, which unmounts this.
 */
export function Bark({ text }: { text: string }) {
  return (
    <div className="bark show" role="status">
      {text}
    </div>
  );
}
