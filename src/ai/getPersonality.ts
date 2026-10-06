import type { PortraitKey } from "../assets/names";
import { PERSONALITIES, type Personality, isPersonalityKey } from "./personalities";

const isPortraitKey = (s: string): s is PortraitKey => s === "p_marshal" || s === "p_outlaw" || s === "p_gambler";

/**
 * Narrow a Player.personality (string | undefined) to a real Personality with a typed
 * portrait. THROWS on undefined or an unknown key — callers check `player.kind === "ai"`
 * first and never call this for seat 0.
 */
export function getPersonality(key: string | undefined): Personality & { portrait: PortraitKey } {
  if (!isPersonalityKey(key)) throw new Error(`unknown personality: ${String(key)}`);
  const p = PERSONALITIES[key];
  if (!isPortraitKey(p.portrait)) throw new Error(`personality ${key} has an unknown portrait: ${p.portrait}`);
  return { ...p, portrait: p.portrait };
}
