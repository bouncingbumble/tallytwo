// `defineConfig` comes from "vitest/config", not "vite": Vite's own UserConfig has no `test`
// key, and tsconfig.node.json type-checks this file under `tsc -b`.
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Tally Two",
        short_name: "Tally Two",
        description: "Big Two, four-handed, in a saloon.",
        display: "standalone",
        orientation: "landscape",
        background_color: "#241408",
        theme_color: "#241408",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // The music loops are 2.2-3.0 MB each, above Workbox's 2 MB default.
        globPatterns: ["**/*.{js,css,html,png,ogg,m4a,woff2,webmanifest}"],
        maximumFileSizeToCacheInBytes: 8_000_000,
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
