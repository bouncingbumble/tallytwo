/**
 * What every scene shares: a camera fitted to the logical canvas (viewport.ts), its width in
 * logical px, and subscriptions that end with the scene (a restart on resize included).
 */
import Phaser from "phaser";
import type { Observable } from "../../game/observable";
import { markDirty } from "../onDemand";
import { services, type Services } from "../services";
import { fitCamera, logicalW } from "../viewport";

export const LOGICAL_HEIGHT = 440;

/**
 * What a scene is started with. `resumed`: the director rebuilt it for a new viewport (a rotation,
 * Safari's toolbar), so it comes back as it was instead of making its entrance again, and `carry`
 * is what its carry() handed over from the run before (a sheet's scroll, the cards' poses).
 */
export interface SceneData {
  resumed?: boolean;
  carry?: Record<string, unknown>;
}

export abstract class BaseScene extends Phaser.Scene {
  /** The canvas width in logical px at create(). */
  W = 0;
  readonly H = LOGICAL_HEIGHT;
  #offs: (() => void)[] = [];
  /** This run is a rebuild for a new viewport (SceneData). */
  resumed = false;
  /** What the run before handed over (SceneData.carry). */
  carried: Record<string, unknown> = {};

  get app(): Services {
    return services();
  }

  init(data?: SceneData): void {
    this.resumed = !!data?.resumed;
    this.carried = data?.carry ?? {};
  }

  /** What a rebuild of this scene for a new viewport should start from (read just before the restart). */
  carry(): Record<string, unknown> {
    return {};
  }

  /** Call first in create(): fits the camera and arms the cleanup. */
  protected setup(): void {
    this.W = logicalW();
    fitCamera(this.cameras.main, this.game);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#teardown());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.#teardown());
  }

  /** Subscribe for the life of this run of the scene. */
  protected watch(source: Observable, fn: () => void): void {
    this.#offs.push(source.subscribe(fn));
  }

  /** A timer that dies with the scene (scene.time pauses with it too). */
  protected after(ms: number, fn: () => void): Phaser.Time.TimerEvent {
    return this.time.delayedCall(ms, () => {
      markDirty();
      fn();
    });
  }

  #teardown(): void {
    for (const off of this.#offs) off();
    this.#offs = [];
  }
}
