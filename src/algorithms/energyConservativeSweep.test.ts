import { describe, it, expect } from "vitest";
import { CELL_TYPES } from "../constants";
import { getEnergyConservativeSweepMove } from "./energyConservativeSweep";
import { getSmartAIMove } from "./smartAI";
import { buildLawn, countGrass, reachableGrass, runCoverage } from "./testSupport";
import type { Grid, Direction, State } from "../types";

const move = (s: State, g: Grid, d: Direction) => getEnergyConservativeSweepMove(s, g, d, CELL_TYPES);
const fallback = (s: State, g: Grid, d: Direction) => getSmartAIMove(s, g, d, CELL_TYPES);

describe("getEnergyConservativeSweepMove", () => {
  it("covers an entire open lawn", () => {
    const dock = { x: 0, y: 0 };
    const grid = buildLawn(16, 12, dock, false);
    const r = runCoverage(grid, dock, move, fallback);
    expect(r.grassLeft).toBe(0);
  });

  it("covers all reachable grass on an obstacle lawn", () => {
    const dock = { x: 0, y: 0 };
    const grid = buildLawn(25, 20, dock, true);
    const total = countGrass(grid);
    const reachable = reachableGrass(grid, dock);
    const r = runCoverage(grid, dock, move, fallback);
    expect(r.grassLeft).toBe(total - reachable);
  });

  it("prefers to continue going straight to conserve energy", () => {
    const grid = buildLawn(10, 5, { x: 0, y: 0 }, false);
    const state = {
      pos: { x: 2, y: 2 },
      prevDir: { dx: 1, dy: 0 },
      visitCounts: {},
      dockPos: { x: 0, y: 0 },
      isCharging: false,
      isReturningForCharge: false,
      battery: Infinity,
      grid,
    } as unknown as State;
    expect(getEnergyConservativeSweepMove(state, grid, { dx: 1, dy: 0 }, CELL_TYPES)).toEqual({ x: 3, y: 2 });
  });

  it("returns null when no grass is left", () => {
    const grid: Grid = buildLawn(8, 8, { x: 0, y: 0 }, false).map((row) =>
      row.map((c) =>
        c.type === CELL_TYPES.GRASS ? { ...c, type: CELL_TYPES.MOWED } : c,
      ),
    );
    const state = {
      pos: { x: 4, y: 4 },
      prevDir: { dx: 0, dy: 1 },
      visitCounts: {},
      dockPos: { x: 0, y: 0 },
      isCharging: false,
      isReturningForCharge: false,
      battery: Infinity,
      grid,
    } as unknown as State;
    expect(getEnergyConservativeSweepMove(state, grid, { dx: 0, dy: 1 }, CELL_TYPES)).toBeNull();
  });
});
