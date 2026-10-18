import { describe, it, expect } from "vitest";
import { CELL_TYPES } from "../constants";
import { nextLaneSweepStep } from "./laneSweep";
import { getDFSCoverageMove } from "./dfsCoverage";
import { getEnergyConservativeSweepMove } from "./energyConservativeSweep";
import { getCellularDecompositionMove } from "./cellularDecomposition";
import { getSmartAIMove } from "./smartAI";
import { buildLawn, type MoveFn } from "./testSupport";
import type { Direction, Grid, PositionType as Point, State } from "../types";

const isGrassIn = (g: Grid) => (p: Point) => g[p.y]?.[p.x]?.type === CELL_TYPES.GRASS;
const mow = (g: Grid, cells: [number, number][]) => {
  for (const [x, y] of cells) g[y][x] = { ...g[y][x], type: CELL_TYPES.MOWED };
};

/** Share of moves that run along the selected orientation on an open lawn. */
const alignedShare = (move: MoveFn, orientation: "horizontal" | "vertical") => {
  const dock = { x: 0, y: 0 };
  const grid = buildLawn(20, 12, dock, false);
  const state = { pos: dock, prevDir: { dx: 0, dy: 1 }, orientation, visitCounts: {} } as unknown as State;
  let pos = dock;
  let prevDir: Direction = { dx: 0, dy: 1 };
  let aligned = 0;
  let steps = 0;
  for (; steps < 1000; steps++) {
    state.pos = pos;
    state.prevDir = prevDir;
    const next = move(state, grid, prevDir) ?? getSmartAIMove(state, grid, prevDir, CELL_TYPES);
    if (!next) break;
    mow(grid, [[pos.x, pos.y]]);
    prevDir = { dx: next.x - pos.x, dy: next.y - pos.y };
    if (orientation === "horizontal" ? prevDir.dx !== 0 : prevDir.dy !== 0) aligned++;
    pos = next;
  }
  return aligned / steps;
};

describe("nextLaneSweepStep", () => {
  it("shifts one tile at the end of a lane, then turns back along it", () => {
    const g = buildLawn(6, 4, { x: 0, y: 0 }, false);
    mow(g, [[1, 1], [2, 1], [3, 1], [4, 1]]);
    // Lane along row 1 ended at the right edge (x=5): shift down, not back.
    const shift = nextLaneSweepStep({ x: 5, y: 1 }, { dx: 1, dy: 0 }, "horizontal", g, CELL_TYPES, isGrassIn(g));
    expect(shift).toEqual({ x: 5, y: 2 });

    mow(g, [[5, 1]]);
    // Just shifted down: turn into the lane running back (left), not keep going down.
    const back = nextLaneSweepStep({ x: 5, y: 2 }, { dx: 0, dy: 1 }, "horizontal", g, CELL_TYPES, isGrassIn(g));
    expect(back).toEqual({ x: 4, y: 2 });
  });

  it("turns back along the mowed lane even when the other way is open", () => {
    const g = buildLawn(7, 4, { x: 0, y: 0 }, false);
    g[1][4] = { ...g[1][4], type: CELL_TYPES.OBSTACLE };
    mow(g, [[1, 1], [2, 1], [3, 1]]);
    const back = nextLaneSweepStep({ x: 3, y: 2 }, { dx: 0, dy: 1 }, "horizontal", g, CELL_TYPES, isGrassIn(g));
    expect(back).toEqual({ x: 2, y: 2 });
  });

  it("uses rank to break ties inside a heading group", () => {
    const g = buildLawn(5, 5, { x: 0, y: 0 }, false);
    const rankDown = (p: Point) => p.y;
    const step = nextLaneSweepStep({ x: 2, y: 2 }, { dx: 1, dy: 0 }, "vertical", g, CELL_TYPES, isGrassIn(g), rankDown);
    expect(step).toEqual({ x: 2, y: 3 });
  });
});

describe.each([
  ["dfs_coverage", (s: State, g: Grid, d: Direction) => getDFSCoverageMove(s, g, d, CELL_TYPES)],
  ["energy_conservative_sweep", (s: State, g: Grid, d: Direction) => getEnergyConservativeSweepMove(s, g, d, CELL_TYPES)],
  ["cellular_decomposition", (s: State, g: Grid, d: Direction) => getCellularDecompositionMove(s, g, d, CELL_TYPES)],
])("%s follows the selected orientation", (_, move) => {
  it.each(["horizontal", "vertical"] as const)("%s lanes", (orientation) => {
    expect(alignedShare(move, orientation)).toBeGreaterThan(0.85);
  });
});
