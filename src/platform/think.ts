/**
 * The web ThinkPort: one dedicated module Worker (platform/aiWorker.ts) answering the store's AI
 * moves off the main thread. If a worker cannot be made or dies, every request from then on is
 * answered on the main thread with thinkNow() — slower frames, the same moves. WEB bucket.
 */
import { type ThinkPort, type ThinkRequest, type ThinkResult, thinkNow } from "../game/think";

interface Pending {
  req: ThinkRequest;
  resolve: (r: ThinkResult) => void;
  reject: (e: Error) => void;
}

export function workerThink(): ThinkPort {
  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL("./aiWorker.ts", import.meta.url), { type: "module", name: "tally-ai" });
  } catch (e) {
    console.warn(`ai: no worker, thinking on the main thread (${String(e)})`);
  }
  let seq = 0;
  const pending = new Map<number, Pending>();

  /** The worker is gone: answer what it still owed here, and everything after it too. */
  const fallBack = (why: string) => {
    if (!worker) return;
    console.warn(`ai: worker failed (${why}); thinking on the main thread`);
    worker.terminate();
    worker = null;
    for (const p of pending.values()) answerHere(p);
    pending.clear();
  };
  const answerHere = (p: Pending) => {
    try {
      p.resolve(thinkNow(p.req));
    } catch (e) {
      p.reject(e instanceof Error ? e : new Error(String(e)));
    }
  };

  if (worker) {
    worker.addEventListener("message", (e: MessageEvent<{ id: number; result?: ThinkResult; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.result) p.resolve(e.data.result);
      else p.reject(new Error(e.data.error ?? "ai worker: no result"));
    });
    worker.addEventListener("error", (e) => fallBack(e.message || "error event"));
    worker.addEventListener("messageerror", () => fallBack("messageerror"));
  }

  return {
    think(req) {
      return new Promise<ThinkResult>((resolve, reject) => {
        const p: Pending = { req, resolve, reject };
        if (!worker) {
          answerHere(p);
          return;
        }
        const id = ++seq;
        pending.set(id, p);
        worker.postMessage({ id, req });
      });
    },
  };
}
