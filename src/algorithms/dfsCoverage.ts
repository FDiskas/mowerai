import type { CELL_TYPES } from "../constants";
import type { Grid, PositionType as Point, Direction, State } from "../types";
import { nextLaneSweepStep } from "./laneSweep";
import { findPathToTarget } from "./pathfinding";
import { turnCostOf } from "./turnCost";

/**
 * Snake Fill — depth-first / backtracking coverage.
 *
 * Unlike Boustrophedon (which imposes a contour pass and fixed parallel rows)
 * this just greedily snakes through whatever fresh grass is adjacent: keep the
 * current lane while there is grass ahead, shift one tile into the next lane
 * along the selected orientation, otherwise — at a dead end — A* back to the
 * nearest remaining grass. The lane preference produces long passes with few
 * turns, and the backtrack step keeps it complete on obstacle-riddled lawns.
 */
export const getDFSCoverageMove = (
  state: State,
  curGrid: Grid,
  prevDir: Direction,
  cellTypes: typeof CELL_TYPES,
): Point | null => {
  const { pos } = state;
  const isFreshGrass = (p: Point) => curGrid[p.y]?.[p.x]?.type === cellTypes.GRASS;

  return (
    nextLaneSweepStep(pos, prevDir, state.orientation, curGrid, cellTypes, isFreshGrass) ??
    // Dead end: backtrack to the nearest remaining grass via A*.
    findPathToTarget(pos, curGrid, prevDir, isFreshGrass, turnCostOf(state))
  );
};
