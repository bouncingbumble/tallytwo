/**
 * The AI worker: answers { id, req: ThinkRequest } with { id, result } or { id, error }. It runs
 * the same PURE code the main thread would (game/think.ts thinkNow), so its answers are
 * identical; only the thread differs. WEB bucket (a Worker global), started by platform/think.ts.
 */
import { type ThinkRequest, thinkNow } from "../game/think";

interface WorkerScope {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (e: MessageEvent<{ id: number; req: ThinkRequest }>) => void): void;
}
// SAFETY: this module is only ever loaded as a dedicated Worker (platform/think.ts), whose global
// scope has postMessage(message) and message events; the app's tsconfig types `self` as Window.
const scope = self as unknown as WorkerScope;

scope.addEventListener("message", (e) => {
  const { id, req } = e.data;
  try {
    scope.postMessage({ id, result: thinkNow(req) });
  } catch (err) {
    scope.postMessage({ id, error: err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err) });
  }
});
