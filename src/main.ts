/**
 * The web shell. The platform objects — WebAudio, webStorage or bridgeStorage, bridgeShell, the
 * timer clock — are created here and handed to the stores, so nothing in game/ or settings/
 * imports them; ?seed= parsing lives here too (URLSearchParams is a DOM type). Then the Phaser
 * game boots and the director decides which scenes run.
 */
import "@fontsource/rye";
import "./styles/shell.css";
import Phaser from "phaser";
import { directAudio } from "./audio/director";
import { WebAudio } from "./audio/WebAudio";
import { Value } from "./game/observable";
import type { Sheet } from "./game/selectors";
import { GameStore } from "./game/store";
import { bridge, bridgeShell } from "./platform/bridge";
import { bridgeStorage } from "./platform/bridgeStorage";
import { timerClock } from "./platform/clock";
import { env, installEnv } from "./platform/env";
import { install, watchInstall } from "./platform/install";
import { registerOffline, updates } from "./platform/offline";
import { webStorage } from "./platform/webStorage";
import { direct } from "./phaser/director";
import { markDirty, renderOnDemand } from "./phaser/onDemand";
import { BootScene } from "./phaser/scenes/Boot";
import { CrashScene } from "./phaser/scenes/Crash";
import { HowToScene } from "./phaser/scenes/HowTo";
import { PosterScene } from "./phaser/scenes/Poster";
import { RotateScene } from "./phaser/scenes/Rotate";
import { SettingsScene } from "./phaser/scenes/Settings";
import { TableScene } from "./phaser/scenes/Table";
import { TitleScene } from "./phaser/scenes/Title";
import { readTargets, readTexts } from "./phaser/probe";
import { provide } from "./phaser/services";
import { C } from "./phaser/theme";
import { sizeGame } from "./phaser/viewport";
import { SettingsStore } from "./settings/store";

// The one non-game path: /assets lists every asset (a plain DOM page, dev tooling).
const isAssetsPage = location.pathname.replace(/\/+$/, "") === import.meta.env.BASE_URL + "assets";

/** ?seed=N fixes the deal (gates and bug reports); ?seed=0 is a valid seed, garbage is ignored. */
function readSeed(): number | undefined {
  const raw = new URLSearchParams(location.search).get("seed");
  return raw !== null && raw.trim() !== "" && Number.isInteger(Number(raw)) ? Number(raw) >>> 0 : undefined;
}

function boot(): void {
  installEnv();
  const audio = new WebAudio();
  const settings = new SettingsStore(bridge.host ? bridgeStorage : webStorage); // a shell owns durable storage (docs/SHELL.md)
  const pick = () => ({ gameSpeed: settings.opts.gameSpeed, difficulty: settings.opts.difficulty, hints: settings.opts.hints });
  const game = new GameStore({ audio, clock: timerClock, shell: bridgeShell, opts: pick() });
  // settings flow into the game: rules apply to the game in progress, opts to the turn loop
  settings.subscribe(() => {
    game.setRules(settings.rules);
    game.setOpts(pick());
  });
  void settings.hydrate();
  const sheet = new Value<Sheet>("none");
  const fault = new Value<Error | null>(null);
  provide({ game, settings, sheet, seed: readSeed(), fault, update: updates, install });
  registerOffline(bridge.host); // docs/OFFLINE_PLAN.md: a production build caches itself for offline play
  watchInstall(bridge.host); // the Title's "add to Home Screen" line
  directAudio(game, settings, sheet);

  // iOS interruptions (a call, Siri, the lock screen) leave the AudioContext not running; the
  // next tap anywhere is the gesture Safari wants.
  document.addEventListener("pointerdown", () => audio.resume());

  // A screen-reader line for what the canvas shows: the status and the sign.
  const live = document.createElement("div");
  live.setAttribute("aria-live", "polite");
  live.className = "sr-only";
  document.body.appendChild(live);
  game.subscribe(() => {
    const v = game.view;
    const say = v.game ? `${v.sign.who}: ${v.sign.text}. ${v.status.text}` : "";
    if (live.textContent !== say) live.textContent = say;
  });

  const f = env.fit.get();
  const phaser = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: "root",
    backgroundColor: C.oakDeep,
    width: Math.round(f.vw * f.dpr),
    height: Math.round(f.vh * f.dpr),
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / f.dpr },
    render: { antialias: true, roundPixels: false, mipmapFilter: "LINEAR_MIPMAP_LINEAR" },
    input: { activePointers: 2 },
    banner: false,
    disableContextMenu: true,
    scene: [BootScene, TitleScene, TableScene, PosterScene, SettingsScene, HowToScene, CrashScene, RotateScene],
  });
  // A throw inside a scene carries no CrashReport: show it on the error sheet instead of a frozen canvas.
  window.addEventListener("error", (e) => fault.set(e.error instanceof Error ? e.error : new Error(String(e.message))));
  phaser.events.once("booted", () => {
    sizeGame(phaser);
    phaser.scene.stop("Boot");
    direct(phaser);
    // ?draw=always turns render-on-demand off (a comparison switch for profiling)
    if (new URLSearchParams(location.search).get("draw") !== "always") renderOnDemand(phaser);
    for (const src of [game, settings, sheet, fault, env.fit, env.insets, env.upright]) src.subscribe(markDirty);
    bridge.send("ready", {});
  });

  // the e2e hook: always in dev; in a build only with VITE_E2E=1 (e2e/play.mjs OFFLINE=1 tests a real build)
  if (import.meta.env.DEV || import.meta.env.VITE_E2E === "1") {
    window.__tally = {
      act: (a) => game.act(a),
      get game() {
        return game.game;
      },
      store: game,
      settings,
      sheet,
      phaser,
      probe: () => {
        const t = phaser.scene.getScene("Table") as TableScene | null;
        const fitNow = env.fit.get();
        return { k: fitNow.k, logicalWidth: fitNow.logicalWidth, dpr: fitNow.dpr, table: t && phaser.scene.isActive("Table") ? t.probe() : null, targets: readTargets(), texts: readTexts(phaser), scenes: phaser.scene.getScenes(true).map((s) => s.scene.key) };
      },
    };
  }
}

if (isAssetsPage) void import("./assetsPage").then((m) => m.renderAssetsPage(document.getElementById("root")!));
else boot();
