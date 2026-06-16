import { describe, it, expect } from "vitest";
import { CELL_TYPES } from "../constants";
import { getSpiralMove } from "./spiral";
import { getSmartAIMove } from "./smartAI";
import {
  buildLawn,
  countGrass,
  reachableGrass,
  runCoverage,
} from "./testSupport";
import type { Grid, Direction, State } from "../types";

const fallback = (s: State, g: Grid, d: Direction) =>
  getSmartAIMove(s, g, d, CELL_TYPES);

describe("getSpiralMove", () => {
  it("covers an entire open lawn without jumping", () => {
    const dock = { x: 5, y: 5 };
    const grid = buildLawn(12, 12, dock, false);

    // Run the spiral coverage and monitor each step to make sure they are adjacent (distance of 1)
    let lastPos = { ...dock };
    const trackingMove = (s: State, g: Grid) => {
      const next = getSpiralMove(s, g, CELL_TYPES);
      if (next) {
        const dist = Math.abs(next.x - lastPos.x) + Math.abs(next.y - lastPos.y);
        expect(dist).toBe(1); // Mower must only move to an adjacent cell, never jump!
        lastPos = { ...next };
      }
      return next;
    };

    const r = runCoverage(grid, dock, trackingMove, fallback);
    expect(r.grassLeft).toBe(0);
  });

  it("covers reachable grass on an obstacle lawn without jumping", () => {
    const dock = { x: 5, y: 5 };
    const grid = buildLawn(12, 12, dock, true);
    const total = countGrass(grid);
    const reachable = reachableGrass(grid, dock);

    let lastPos = { ...dock };
    const trackingMove = (s: State, g: Grid) => {
      const next = getSpiralMove(s, g, CELL_TYPES);
      if (next) {
        const dist = Math.abs(next.x - lastPos.x) + Math.abs(next.y - lastPos.y);
        expect(dist).toBe(1); // Mower must only move to an adjacent cell, never jump!
        lastPos = { ...next };
      }
      return next;
    };

    const r = runCoverage(grid, dock, trackingMove, fallback);
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
    expect(
      getSpiralMove(state, grid, CELL_TYPES),
    ).toBeNull();
  });
});
