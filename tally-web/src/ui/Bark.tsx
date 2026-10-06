/**
 * One bark bubble above a seat. Mounting with "show" runs the barkpop keyframes (motion.css);
 * useBarks removes the entry after BARK_MS, which unmounts this.
 */
export function Bark({ text }: { text: string }) {
  return <div className="bark show">{text}</div>;
}
