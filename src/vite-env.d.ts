/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" keeps window.__tally in a production build, for e2e/play.mjs OFFLINE=1. */
  readonly VITE_E2E?: string;
}
