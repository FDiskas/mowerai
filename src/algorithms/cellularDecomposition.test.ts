import { describe, it, expect } from "vitest";
import { CELL_TYPES } from "../constants";
import { decomposeGrid, getCellularDecompositionMove } from "./cellularDecomposition";
import { getSmartAIMove } from "./smartAI";
import { buildLawn, countGrass, reachableGrass, runCoverage } from "./testSupport";
import type { Grid, Direction, State } from "../types";

const move = (s: State, g: Grid, d: Direction) => getCellularDecompositionMove(s, g, d, CELL_TYPES);
const fallback = (s: State, g: Grid, d: Direction) => getSmartAIMove(s, g, d, CELL_TYPES);

describe("Cellular Decomposition Algorithm", () => {
  describe("decomposeGrid", () => {
    it("decomposes a simple U-shape lawn into distinct cell IDs", () => {
      // 4 rows, 3 columns:
      // Row 0: Grass, Grass, Grass
      // Row 1: Grass, Obstacle, Grass
      // Row 2: Grass, Obstacle, Grass
      // Row 3: Grass, Grass, Grass
      const grid: Grid = [
        [
          { type: CELL_TYPES.GRASS, damage: 0, direction: null },
          { type: CELL_TYPES.GRASS, damage: 0, direction: null },
          { type: CELL_TYPES.GRASS, damage: 0, direction: null },
        ],
        [
          { type: CELL_TYPES.GRASS, damage: 0, direction: null },
          { type: CELL_TYPES.OBSTACLE, damage: 0, direction: null },
          { type: CELL_TYPES.GRASS, damage: 0, direction: null },
        ],
        [
          { type: CELL_TYPES.GRASS, damage: 0, direction: null },
          { type: CELL_TYPES.OBSTACLE, damage: 0, direction: null },
          { type: CELL_TYPES.GRASS, damage: 0, direction: null },
        ],
        [
          { type: CELL_TYPES.GRASS, damage: 0, direction: null },
          { type: CELL_TYPES.GRASS, damage: 0, direction: null },
          { type: CELL_TYPES.GRASS, damage: 0, direction: null },
        ],
      ];

      const cellGrid = decomposeGrid(grid, CELL_TYPES);

      // Obstacles must have cell ID 0
      expect(cellGrid[1][1]).toBe(0);
      expect(cellGrid[2][1]).toBe(0);

      // Verify that splitting has occurred:
      // Column 0 rows 0,1,2,3 should be a single contiguous cell
      const leftCellId = cellGrid[0][0];
      expect(leftCellId).toBeGreaterThan(0);
      expect(cellGrid[1][0]).toBe(leftCellId);
      expect(cellGrid[2][0]).toBe(leftCellId);
      expect(cellGrid[3][0]).toBe(leftCellId);

      // Column 1 Row 0 and Row 3 must be different cells due to split event from Column 0
      const topCellId = cellGrid[0][1];
      const bottomCellId = cellGrid[3][1];
      expect(topCellId).toBeGreaterThan(0);
      expect(bottomCellId).toBeGreaterThan(0);
      expect(topCellId).not.toBe(leftCellId);
      expect(bottomCellId).not.toBe(leftCellId);
      expect(topCellId).not.toBe(bottomCellId);
    });
  });

  describe("getCellularDecompositionMove", () => {
    it("covers an entire open lawn", () => {
      const dock = { x: 0, y: 0 };
      const grid = buildLawn(12, 10, dock, false);
      const r = runCoverage(grid, dock, move, fallback);
      expect(r.grassLeft).toBe(0);
    });

    it("covers all reachable grass on an obstacle lawn", () => {
      const dock = { x: 0, y: 0 };
      const grid = buildLawn(16, 12, dock, true);
      const total = countGrass(grid);
      const reachable = reachableGrass(grid, dock);
      const r = runCoverage(grid, dock, move, fallback);
      expect(r.grassLeft).toBe(total - reachable);
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
      expect(getCellularDecompositionMove(state, grid, { dx: 0, dy: 1 }, CELL_TYPES)).toBeNull();
    });
  });
});
