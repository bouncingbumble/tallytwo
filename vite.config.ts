// `defineConfig` comes from "vitest/config", not "vite": Vite's own UserConfig has no `test`
// key, and tsconfig.node.json type-checks this file under `tsc -b`.
// No PWA plugin: the build is a plain static dist/ for a webview shell or any static host.
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
