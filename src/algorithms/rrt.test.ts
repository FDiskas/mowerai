import { describe, it, expect } from "vitest";
import { CELL_TYPES } from "../constants";
import { getRRTMove } from "./rrt";
import { getSmartAIMove } from "./smartAI";
import { buildLawn, countGrass, reachableGrass, runCoverage } from "./testSupport";
import type { Grid, Direction, State } from "../types";

const move = (s: State, g: Grid, d: Direction) => getRRTMove(s, g, d, CELL_TYPES);
const fallback = (s: State, g: Grid, d: Direction) => getSmartAIMove(s, g, d, CELL_TYPES);

describe("getRRTMove", () => {
  it("steps toward the closest grass when the mower stands on grass", () => {
    const grid = buildLawn(6, 1, { x: 0, y: 0 }, false);
    const state = { pos: { x: 2, y: 0 }, prevDir: { dx: 1, dy: 0 } } as unknown as State;
    const next = getRRTMove(state, grid, { dx: 1, dy: 0 }, CELL_TYPES);
    expect([{ x: 1, y: 0 }, { x: 3, y: 0 }]).toContainEqual(next);
  });

  it("covers all reachable grass on an obstacle lawn", () => {
    const dock = { x: 0, y: 0 };
    const grid = buildLawn(16, 12, dock, true);
    const unreachable = countGrass(grid) - reachableGrass(grid, dock);
    expect(runCoverage(grid, dock, move, fallback).grassLeft).toBe(unreachable);
  });
});
