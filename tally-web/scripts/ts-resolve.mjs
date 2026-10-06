// Node module hook: resolve extensionless relative imports ("../engine/cards", "../ai") to
// .ts files, the way Vite does natively. Needed only by the CLI scripts run through plain Node.
import { access } from "node:fs/promises";

export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier) && context.parentURL) {
    for (const suffix of [".ts", "/index.ts"]) {
      const url = new URL(specifier + suffix, context.parentURL);
      try {
        await access(url);
        return next(url.href, context);
      } catch {
        /* try the next suffix */
      }
    }
  }
  return next(specifier, context);
}
