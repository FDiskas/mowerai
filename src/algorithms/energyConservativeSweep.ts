import type { CELL_TYPES } from "../constants";
import type { Grid, PositionType as Point, Direction, State } from "../types";
import { nextLaneSweepStep } from "./laneSweep";
import { genericPathSearch } from "./pathfinding";
import { turnCostOf } from "./turnCost";

const NEIGHBORS_4 = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];

/**
 * The fallback route prices turns at 5x the shared turn cost, so it prefers
 * straight corridors over winding paths, even when those are slightly shorter.
 */
const FALLBACK_TURN_COST_FACTOR = 5;

/**
 * Energy-Conservative Sweep (ECTPC)
 *
 * Prioritizes straight movements to conserve battery and minimize turns and
 * damage penalty points.
 *
 * Rules:
 * 1. Sweep in lanes along the selected orientation: keep going straight while
 *    the lane has grass, then shift one tile into the next lane and turn back.
 * 2. If both shift sides are grass, choose the one with more surrounding grass
 *    cells (keeps the coverage dense and avoids isolating cells).
 * 3. If no adjacent cell is grass, route to the nearest reachable grass with a
 *    turn-penalized search, so the route uses the minimum number of turns.
 */
export const getEnergyConservativeSweepMove = (
  state: State,
  curGrid: Grid,
  prevDir: Direction,
  cellTypes: typeof CELL_TYPES,
): Point | null => {
  const { pos } = state;
  const isGrass = (p: Point) => curGrid[p.y]?.[p.x]?.type === cellTypes.GRASS;
  const countSurroundingGrass = (p: Point) =>
    NEIGHBORS_4.filter((d) => isGrass({ x: p.x + d.dx, y: p.y + d.dy })).length;

  const laneStep = nextLaneSweepStep(
    pos,
    prevDir,
    state.orientation,
    curGrid,
    cellTypes,
    isGrass,
    countSurroundingGrass,
  );
  if (laneStep) return laneStep;

  const heading = prevDir.dx !== 0 || prevDir.dy !== 0 ? prevDir : { dx: 0, dy: 1 };
  const path = genericPathSearch(
    pos,
    curGrid,
    heading,
    isGrass,
    () => 0,
    FALLBACK_TURN_COST_FACTOR * turnCostOf(state),
  );
  return path?.[0] ?? null;
};
