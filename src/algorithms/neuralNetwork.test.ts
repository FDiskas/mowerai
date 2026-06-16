import { describe, it, expect } from "vitest";
import { CELL_TYPES } from "../constants";
import { getNeuralNetworkMove } from "./neuralNetwork";
import { NeuralNetwork } from "../NeuralNetwork";
import { buildLawn } from "./testSupport";
import type { Grid, State } from "../types";

describe("Neural Network Pathfinder Fallback", () => {
  it("uses pathfinding to target grass if no adjacent grass is present", () => {
    // 8x8 lawn where everything is mowed EXCEPT the top-right corner (7, 0)
    const grid: Grid = buildLawn(8, 8, { x: 0, y: 7 }, false).map((row) =>
      row.map((c) => ({ ...c, type: CELL_TYPES.MOWED })),
    );
    grid[0][7] = { type: CELL_TYPES.GRASS, damage: 0, direction: null };

    // The mower is in the bottom-left corner (0, 7) and surrounded by mowed cells
    const state = {
      pos: { x: 0, y: 7 },
      prevDir: { dx: 0, dy: -1 },
      visitCounts: {},
      dockPos: { x: 0, y: 7 },
      isCharging: false,
      isReturningForCharge: false,
      battery: Infinity,
      grid,
    } as unknown as State;

    // A mock network with layers (not strictly used since hasAdjacentGrass is false)
    const nn = new NeuralNetwork([47, 16, 4]);

    const move = getNeuralNetworkMove(state, grid, { dx: 0, dy: -1 }, CELL_TYPES, nn);
    expect(move).not.toBeNull();
    // The mower should make a step towards the top-right corner (e.g. moving up or right)
    expect(move!.x === 1 || move!.y === 6).toBe(true);
  });

  it("returns null when there is no grass left", () => {
    const grid: Grid = buildLawn(8, 8, { x: 0, y: 7 }, false).map((row) =>
      row.map((c) => ({ ...c, type: CELL_TYPES.MOWED })),
    );

    const state = {
      pos: { x: 0, y: 7 },
      prevDir: { dx: 0, dy: -1 },
      visitCounts: {},
      dockPos: { x: 0, y: 7 },
      isCharging: false,
      isReturningForCharge: false,
      battery: Infinity,
      grid,
    } as unknown as State;

    const nn = new NeuralNetwork([47, 16, 4]);
    const move = getNeuralNetworkMove(state, grid, { dx: 0, dy: -1 }, CELL_TYPES, nn);
    expect(move).toBeNull();
  });
});
