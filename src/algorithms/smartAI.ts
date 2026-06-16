import type { CELL_TYPES } from "../constants";
import type { Grid, PositionType as Point, Direction, State } from "../types";
import { findPathToTarget } from "./pathfinding";

/**
 * Smart AI — always head to the closest remaining grass via A*.
 */
export const getSmartAIMove = (
  state: State,
  curGrid: Grid,
  prevDir: Direction,
  cellTypes: typeof CELL_TYPES,
): Point | null => {
  const { pos } = state;
  return findPathToTarget(
    pos,
    curGrid,
    prevDir,
    (p) => curGrid[p.y][p.x].type === cellTypes.GRASS,
  );
};
