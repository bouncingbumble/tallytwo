/** Three pinned cells (the atlas disagrees with the engine on both axes) and the whole grid. */
import { describe, expect, test } from "vitest";
import { ATLAS_COLS, ATLAS_ROWS, CELL_H, CELL_W, atlasCell, spriteFor } from "./atlas";

describe("atlas", () => {
  test("the three pinned cells", () => {
    expect(spriteFor(0)).toEqual({ x: 192, y: 0, w: 96, h: 128 }); // 3♦
    expect(spriteFor(51)).toEqual({ x: 96, y: 128, w: 96, h: 128 }); // 2♠
    expect(spriteFor(45)).toEqual({ x: 0, y: 384, w: 96, h: 128 }); // A♣
    expect(atlasCell(0)).toEqual({ col: 2, row: 0 });
    expect(atlasCell(51)).toEqual({ col: 1, row: 1 });
    expect(atlasCell(45)).toEqual({ col: 0, row: 3 });
  });
  test("all 52 cards map to distinct cells inside the 13x4 grid", () => {
    const seen = new Set<string>();
    for (let v = 0; v < 52; v++) {
      const { col, row } = atlasCell(v);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(ATLAS_COLS);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(ATLAS_ROWS);
      seen.add(`${col},${row}`);
      const r = spriteFor(v);
      expect(r.x % CELL_W).toBe(0);
      expect(r.y % CELL_H).toBe(0);
    }
    expect(seen.size).toBe(52);
  });
});
