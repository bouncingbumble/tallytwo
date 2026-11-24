/**
 * Which scenes run (what App.tsx's Screens did): the crash or error sheet over everything; the
 * title when there is no game, else the table with the poster over it once the round is scored;
 * the settings or how-to sheet on top; the rotate gate over all of it on an upright phone. Also
 * the pause (a hidden tab, the shell's `pause`, the rotate gate), the canvas size, and a rebuild
 * of every running scene when the viewport changes.
 */
import type Phaser from "phaser";
import { env } from "../platform/env";
import { ART_KEYS } from "./scenes/Boot";
import { services } from "./services";
import { applyArtFilter, sizeGame } from "./viewport";

/** Bottom to top. */
const BASE = ["Title", "Table"] as const;
const OVERLAYS = ["Poster", "Settings", "HowTo", "Crash", "Rotate"] as const;
type Key = (typeof BASE)[number] | (typeof OVERLAYS)[number];

export function direct(game: Phaser.Game): void {
  const app = services();
  const mgr = game.scene;
  let lastDeal = -1;
  let lastGame: unknown = undefined;
  let lastPhase: string | null = null;
  let lastSheet = app.sheet.get();

  const running = (k: Key): boolean => mgr.isActive(k) || mgr.isPaused(k);
  const stop = (k: Key) => {
    if (running(k)) mgr.stop(k);
  };
  const start = (k: Key, data?: { animate: boolean }) => {
    mgr.start(k, data);
    order();
  };
  /** Keep the stacking: base, poster, sheets, crash, rotate. */
  const order = () => {
    for (const k of OVERLAYS) if (running(k)) mgr.bringToTop(k);
  };

  const sync = () => {
    const v = app.game.view;
    const g = v.game;
    const fault = app.fault.get();
    const sheet = app.sheet.get();

    // a crash or a render error: one sheet over a still table
    const broken = v.crash !== null || fault !== null;
    if (broken && !running("Crash")) start("Crash");
    if (!broken) stop("Crash");

    if (g === null) {
      stop("Table");
      stop("Poster");
      if (!running("Title")) start("Title");
      lastDeal = -1;
    } else {
      stop("Title");
      // a new deal (or the first frame of a match) starts the table with the deal flying in
      if (!running("Table") || v.dealId !== lastDeal) start("Table", { animate: true });
      lastDeal = v.dealId;
      const scored = g.phase === "scored";
      if (scored && (!running("Poster") || (g !== lastGame && lastPhase !== "scored"))) start("Poster");
      if (!scored) stop("Poster");
    }
    lastGame = g;
    lastPhase = g?.phase ?? null;

    // sheets: settings (title or table) and how to play (title)
    if (sheet !== lastSheet || (sheet !== "none" && !running(sheet === "settings" ? "Settings" : "HowTo"))) {
      stop("Settings");
      stop("HowTo");
      if (sheet === "settings") start("Settings");
      if (sheet === "howto") start("HowTo");
      lastSheet = sheet;
    }
    // Quit from the settings sheet closes it; a crash closes any sheet
    if (broken && sheet !== "none") app.sheet.set("none");

    const upright = env.upright.get();
    if (upright && !running("Rotate")) start("Rotate");
    if (!upright) stop("Rotate");
    app.game.setPaused(env.hidden.get() || env.shellPaused.get() || upright);
    order();
  };

  // a viewport change: resize the canvas, then rebuild every running scene at the new size
  const resize = () => {
    sizeGame(game);
    applyArtFilter(game, ART_KEYS);
    // a restart is queued; a scene the same change is about to stop (the rotate gate on turning
    // the phone sideways) must not be restarted after that stop
    const wanted = (k: Key): boolean => (k === "Rotate" ? env.upright.get() : true);
    for (const k of [...BASE, ...OVERLAYS]) if (running(k) && wanted(k)) mgr.getScene(k)?.scene.restart(k === "Table" ? { animate: false } : undefined);
    sync();
  };

  applyArtFilter(game, ART_KEYS);
  for (const src of [app.game, app.sheet, app.fault, env.upright, env.hidden, env.shellPaused]) src.subscribe(sync);
  env.fit.subscribe(resize);
  env.insets.subscribe(resize);
  env.notch.subscribe(resize);
  sync();
}
