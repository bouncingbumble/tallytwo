/** Every table module loads (a syntax or import error fails here) and exports a component. */
import { expect, test } from "vitest";
import * as ui from "./index";
import { useElementWidth } from "../platform/useElementWidth";

test("table components and useElementWidth are functions", () => {
  const names = ["Bark", "Controls", "Felt", "Hand", "Pile", "Seat", "Sign", "StatusLine", "TopBar", "TableScreen", "Card", "CardBack"] as const;
  for (const n of names) expect(typeof ui[n], n).toBe("function");
  expect(typeof useElementWidth).toBe("function");
});
