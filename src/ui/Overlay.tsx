/**
 * The full-screen covers. Overlay is the dark cover the sheets and the poster sit in (P:254-256);
 * Panel is a sheet on the bare .screen column for the crash and error screens.
 */
import type { ReactNode } from "react";

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
