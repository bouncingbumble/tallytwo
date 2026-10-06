/**
 * An engine throw as a screen, not a console line (WEB-PLAN §3.3). tryReduce() caught it and
 * the store kept the CrashReport; this shows the message, the action that threw and the
 * replayable GameLog (replayLog() in selectors.ts rebuilds the position from a paste of it),
 * with Copy game log and Saddle up — which QUITs to the title; settings live in the outer
 * provider and survive.
 */
import { type CrashReport, serializeLog } from "../game/appReducer";
import { COPY } from "../game/copy";
import { CopyButton } from "./CopyButton";
import { Panel } from "./Overlay";

export function CrashScreen({ report, onReset }: { report: CrashReport; onReset: () => void }) {
  const log = serializeLog(report);
  return (
    <Panel>
      <h2 className="western">{COPY.crash.title}</h2>
      <p>{COPY.crash.body}</p>
      <p className="muted">
        {report.error.message} · <code>{JSON.stringify(report.action)}</code>
      </p>
      <pre className="out">{log}</pre>
      <div className="ovbtns">
        <CopyButton className="btn" text={() => log} label={COPY.crash.copyLog} copiedLabel={COPY.crash.copied} />
        <button type="button" className="btn primary" onClick={onReset}>
          {COPY.crash.saddleUp}
        </button>
      </div>
    </Panel>
  );
}
