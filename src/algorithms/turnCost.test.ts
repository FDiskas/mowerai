import { describe, it, expect } from "vitest";
import { DEFAULT_FITNESS_CONFIG } from "../types";
import { DEFAULT_TURN_COST, minTurnsTo, turnCostInSteps } from "./turnCost";

describe("turnCostInSteps", () => {
  it("prices a turn in revisit steps (default weights: 100 / 50 = 2)", () => {
    expect(turnCostInSteps(DEFAULT_FITNESS_CONFIG)).toBe(2);
    expect(DEFAULT_TURN_COST).toBe(2);
    expect(turnCostInSteps({ turnPenalty: 300, mowedRevisitPenalty: 50 })).toBe(6);
  });

  it("treats a negative turn penalty as free turns", () => {
    expect(turnCostInSteps({ turnPenalty: -100, mowedRevisitPenalty: 50 })).toBe(0);
  });

  it("falls back to the default when the revisit penalty gives no exchange rate", () => {
    expect(turnCostInSteps({ turnPenalty: 100, mowedRevisitPenalty: 0 })).toBe(DEFAULT_TURN_COST);
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
