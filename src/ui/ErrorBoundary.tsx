/**
 * The last-resort net for RENDER bugs — a missing PORTRAITS key, an undefined sprite URL, a typo
 * in a selector — which carry no CrashReport. The only class component in the codebase
 * (getDerivedStateFromError has no hook equivalent). It shows error.message + "Saddle up", which
 * clears its own state and calls onReset; App bumps the GameProvider key there so the store
 * remounts at INITIAL. Engine throws never reach it: tryReduce() made those a CrashScreen.
 */
import { Component, type ReactNode } from "react";
import { COPY } from "../game/copy";
import { Panel } from "./Overlay";

interface Props {
  children: ReactNode;
  onReset?: () => void;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(thrown: unknown): State {
    return { error: thrown instanceof Error ? thrown : new Error(String(thrown)) };
  }

  reset = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <Panel>
        <h2 className="western">{COPY.error.title}</h2>
        <pre className="out">{error.message}</pre>
        <div className="ovbtns">
          <button type="button" className="btn primary" onClick={this.reset}>
            {COPY.error.saddleUp}
          </button>
        </div>
      </Panel>
    );
  }
}
