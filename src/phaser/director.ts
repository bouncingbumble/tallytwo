/**
 * Which scenes run: the crash or error sheet over everything; the title when there is no game, else
 * the table with the poster over it once the round is scored; the settings or how-to sheet on top.
 * Also the pause (a hidden tab, the shell's `pause`, a phone held upright — the page's rotate gate
 * covers the canvas then, platform/rotateGate.ts — a lost WebGL context), the canvas size, and a
 * rebuild of every running scene when the viewport changes (held back while upright: nothing is
 * seen behind the gate, and the table is never laid out for a portrait screen).
 *
 * It also owns the moves between screens, so the scenes stay unaware of them: the title's own exit
 * is its doors (the camera goes in through them and darkens, Title.ts); the table then fades up out
 * of that dark, and leaving the table for the title fades the title up the same way. A rebuild for
 * a new viewport is told it is one (SceneData.resumed) and handed what the run before carried (a
 * sheet's scroll, the cards' poses), so a rotation never replays an entrance or loses where things
 * were.
 */
import Phaser from "phaser";
import { TRANSITION } from "../game/timing";
import { env } from "../platform/env";
import { glLost } from "./contextLoss";
import { ms } from "./motion";
import type { BaseScene, SceneData } from "./scenes/base";
import { ART_KEYS } from "./scenes/Boot";
import { services } from "./services";
import { C } from "./theme";
import { applyArtFilter, sizeGame } from "./viewport";

/** How one screen gives way to the next. */
export type TransitionKind = "fadeUp";

/**
 * Bring scene `to` in after `from` (the director's one transition hook). The incoming scene's
 * camera fades up out of C.oakDeep once it has been created.
 */
export function transition(game: Phaser.Game, from: string, to: string, kind: TransitionKind): void {
  void from;
  const scene = game.scene.getScene(to);
  if (!scene) return;
  scene.events.once(Phaser.Scenes.Events.CREATE, () => {
    const d = ms(TRANSITION.fadeUpMs);
    if (!d || kind !== "fadeUp") return;
    const c = Phaser.Display.Color.IntegerToRGB(C.oakDeep);
    scene.cameras.main.fadeIn(d, c.r, c.g, c.b);
  });
}

/** Bottom to top. */
const BASE = ["Title", "Table"] as const;
const OVERLAYS = ["Poster", "Settings", "HowTo", "Crash"] as const;
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
  const start = (k: Key, data?: SceneData & { animate?: boolean }) => {
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
      const fromTable = running("Table");
      stop("Table");
      stop("Poster");
      if (!running("Title")) {
        if (fromTable) transition(game, "Table", "Title", "fadeUp");
        start("Title");
      }
      lastDeal = -1;
    } else {
      const fromTitle = running("Title");
      stop("Title");
      // a new deal (or the first frame of a match) starts the table with the deal flying in
      if (!running("Table") || v.dealId !== lastDeal) {
        if (fromTitle) transition(game, "Title", "Table", "fadeUp");
        start("Table", { animate: true });
      }
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

    app.game.setPaused(env.hidden.get() || env.shellPaused.get() || env.upright.get() || glLost.get());
    order();
  };

  // a viewport change: resize the canvas, then rebuild every running scene at the new size; while
  // upright only noted, and done once the phone is sideways again
  let stale = false;
  const resize = () => {
    if (env.upright.get()) {
      stale = true;
      return;
    }
    stale = false;
    sizeGame(game);
    applyArtFilter(game, ART_KEYS);
    for (const k of [...BASE, ...OVERLAYS]) {
      if (!running(k)) continue;
      const s = mgr.getScene(k) as BaseScene | null;
      if (!s) continue;
      const data: SceneData & { animate?: boolean } = { resumed: true, carry: s.carry() };
      if (k === "Table") data.animate = false;
      s.scene.restart(data);
    }
    sync();
  };

  applyArtFilter(game, ART_KEYS);
  for (const src of [app.game, app.sheet, app.fault, env.upright, env.hidden, env.shellPaused, glLost]) src.subscribe(sync);
  env.fit.subscribe(resize);
  env.upright.subscribe(() => {
    if (!env.upright.get() && stale) resize();
  });
  env.insets.subscribe(resize);
  env.notch.subscribe(resize);
  sync();
}
