import { register } from "node:module";
import { pathToFileURL } from "node:url";
register("./scripts/ts-resolve.mjs", pathToFileURL("./")); // resolves against cwd: always run via `npm run`
