/**
 * What every scene shares: a camera fitted to the logical canvas (viewport.ts), its width in
 * logical px, and subscriptions that end with the scene (a restart on resize included).
 */
import Phaser from "phaser";
import type { Observable } from "../../game/observable";
import { services, type Services } from "../services";
import { fitCamera, logicalW } from "../viewport";

export const LOGICAL_HEIGHT = 440;

export abstract class BaseScene extends Phaser.Scene {
  /** The canvas width in logical px at create(). */
  W = 0;
  readonly H = LOGICAL_HEIGHT;
  #offs: (() => void)[] = [];

  get app(): Services {
    return services();
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
    return this.time.delayedCall(ms, fn);
  }

  #teardown(): void {
    for (const off of this.#offs) off();
    this.#offs = [];
  }
}
