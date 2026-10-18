import { describe, it, expect } from "vitest";
import { SCORE_WEIGHTS } from "../simulation/score";
import { DEFAULT_TURN_COST, minTurnsTo } from "./turnCost";

describe("DEFAULT_TURN_COST", () => {
  it("prices a turn like the benchmark score does (2 steps)", () => {
    expect(DEFAULT_TURN_COST).toBe(SCORE_WEIGHTS.turn / SCORE_WEIGHTS.step);
    expect(DEFAULT_TURN_COST).toBe(2);
  });
});

describe("minTurnsTo", () => {
  const east = { dx: 1, dy: 0 };
  const origin = { x: 0, y: 0 };

  it.each([
    ["straight ahead", { x: 3, y: 0 }, 0],
    ["ahead and aside", { x: 3, y: 2 }, 1],
    ["directly aside", { x: 0, y: 2 }, 1],
    ["directly behind", { x: -3, y: 0 }, 1],
    ["behind and aside", { x: -3, y: 2 }, 2],
  ])("%s", (_, target, turns) => {
    expect(minTurnsTo(origin, east, target)).toBe(turns);
  });

  it("needs no turn without a heading", () => {
    expect(minTurnsTo(origin, { dx: 0, dy: 0 }, { x: -3, y: 2 })).toBe(0);
  });
});
