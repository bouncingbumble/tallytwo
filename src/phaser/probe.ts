/**
 * Named tap targets for the scripted device gates (e2e/play.mjs): a canvas has no DOM to query,
 * so the controls register here and the DEV hook `window.__tally.probe()` reports their rects in
 * logical px. Registration dies with the scene. Costs nothing in play: a Map of closures.
 */
import Phaser from "phaser";

export interface TargetRect {
  x: number;
  y: number;
  w: number;
  h: number;
  enabled: boolean;
  visible: boolean;
}

const targets = new Map<string, () => TargetRect>();

/** Register `obj` as `id` for as long as `scene` runs. */
export function target(scene: Phaser.Scene, id: string, obj: Phaser.GameObjects.Container | Phaser.GameObjects.Image, size?: { w: number; h: number }, enabled: () => boolean = () => true): void {
  const read = (): TargetRect => {
    const m = obj.getWorldTransformMatrix();
    const b = size ? { x: m.tx, y: m.ty, width: size.w * m.scaleX, height: size.h * m.scaleY } : obj.getBounds();
    let visible = obj.visible && obj.active;
    for (let p = obj.parentContainer; p && visible; p = p.parentContainer) visible = p.visible;
    return { x: b.x, y: b.y, w: b.width, h: b.height, enabled: enabled(), visible };
  };
  targets.set(id, read);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    if (targets.get(id) === read) targets.delete(id);
  });
}

export function readTargets(): Record<string, TargetRect> {
  const out: Record<string, TargetRect> = {};
  for (const [id, read] of targets) out[id] = read();
  return out;
}

/** Every visible, non-empty Text in the running scenes with its drawn size in logical px (the size floors). */
export function readTexts(game: Phaser.Game): { scene: string; text: string; px: number }[] {
  const out: { scene: string; text: string; px: number }[] = [];
  const visit = (scene: string, o: Phaser.GameObjects.GameObject): void => {
    const v = o as Phaser.GameObjects.GameObject & { visible?: boolean; alpha?: number };
    if (v.visible === false || (v.alpha !== undefined && v.alpha < 0.05)) return;
    if (o instanceof Phaser.GameObjects.Container) {
      for (const c of o.list) visit(scene, c);
      return;
    }
    if (o instanceof Phaser.GameObjects.Text && o.text.trim()) {
      const m = o.getWorldTransformMatrix();
      out.push({ scene, text: o.text.trim().slice(0, 24), px: parseFloat(String(o.style.fontSize)) * Math.abs(m.scaleY) });
    }
  };
  for (const s of game.scene.getScenes(true)) for (const o of s.children.list) visit(s.scene.key, o);
  return out;
}
