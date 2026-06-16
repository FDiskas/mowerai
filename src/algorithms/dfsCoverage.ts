import type { CELL_TYPES } from "../constants";
import type { Grid, PositionType as Point, Direction, State } from "../types";
import { findPathToTarget } from "./pathfinding";

/**
 * Snake Fill — depth-first / backtracking coverage.
 *
 * Unlike Boustrophedon (which imposes a contour pass and fixed parallel rows)
 * this just greedily snakes through whatever fresh grass is adjacent: keep the
 * current heading as long as there is grass ahead, otherwise turn, otherwise —
 * at a dead end — A* back to the nearest remaining grass. The straight-ahead
 * preference produces long passes with few turns, and the backtrack step keeps
 * it complete on obstacle-riddled lawns.
 */
export const getDFSCoverageMove = (
  state: State,
  curGrid: Grid,
  prevDir: Direction,
  cellTypes: typeof CELL_TYPES,
): Point | null => {
  const { pos } = state;
  const rows = curGrid.length;
  const cols = curGrid[0].length;

  const isFreshGrass = (x: number, y: number) =>
    x >= 0 &&
    x < cols &&
    y >= 0 &&
    y < rows &&
    curGrid[y][x].type === cellTypes.GRASS;

  // Prefer straight, then a perpendicular turn, then reverse — relative to the
  // current heading, so the mower keeps snaking instead of darting around.
  const candidates: Direction[] = [
    prevDir,
    { dx: -prevDir.dy, dy: prevDir.dx },
    { dx: prevDir.dy, dy: -prevDir.dx },
    { dx: -prevDir.dx, dy: -prevDir.dy },
    // Absolute fallback order for the first move (prevDir may be a no-op).
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: -1 },
  ];

  for (const d of candidates) {
    if (d.dx === 0 && d.dy === 0) continue;
    if (isFreshGrass(pos.x + d.dx, pos.y + d.dy))
      return { x: pos.x + d.dx, y: pos.y + d.dy };
  }

  // Dead end: backtrack to the nearest remaining grass via A*.
  return findPathToTarget(
    pos,
    curGrid,
    prevDir,
    (p) => curGrid[p.y][p.x].type === cellTypes.GRASS,
  );
};
