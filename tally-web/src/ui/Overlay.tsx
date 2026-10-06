/**
 * The full-screen covers. Overlay is the dark cover the sheets and the poster sit in (P:254-256);
 * Panel is a sheet on the bare .screen column for the crash and error screens; TurnPhone is the
 * "Turn your phone" cover, always in the tree and shown by styles/responsive.css only in short
 * landscape, where platform/useLandscapeShort.ts pauses the game underneath.
 */
import type { ReactNode } from "react";
import { COPY } from "../game/copy";

export function Overlay({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="ov" role={label ? "dialog" : undefined} aria-modal={label ? true : undefined} aria-label={label}>
      {children}
    </div>
  );
}

/** Scrolls when the content is taller than the screen, sits centred when it is not. */
export function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="screen" style={{ overflow: "auto", padding: 16 }}>
      <div className="sheet" style={{ margin: "auto" }}>
        {children}
      </div>
    </section>
  );
}

export function TurnPhone() {
  return <div className="turn-phone">{COPY.landscape}</div>;
}
