import type { CELL_TYPES } from "../constants";
import type { Grid, PositionType as Point, Direction, State } from "../types";
import { genericPathSearch } from "./pathfinding";

/**
 * Energy-Conservative Sweep (ECTPC)
 * 
 * An algorithm designed to prioritize straight movements to conserve battery 
 * and minimize turns/damage penalty points.
 * 
 * Rules:
 * 1. If the adjacent cell in the current heading (straight) is grass, keep going straight.
 * 2. If straight is blocked/mowed, look at left and right turns. If only one of them is grass,
 *    turn towards it. If both are grass, choose the one that has more surrounding grass cells 
 *    (to keep the lawn coverage dense and avoid isolating cells).
 * 3. If no adjacent cell is grass, perform a turn-penalized A* pathfinding search (with a high
 *    turn penalty) to route the mower to the nearest reachable grass cell with the minimum
 *    number of turns.
 */
export const getEnergyConservativeSweepMove = (
  state: State,
  curGrid: Grid,
  prevDir: Direction,
  cellTypes: typeof CELL_TYPES,
): Point | null => {
  const { pos } = state;
  const rows = curGrid.length;
  const cols = curGrid[0].length;

  const currentDir = prevDir && (prevDir.dx !== 0 || prevDir.dy !== 0) ? prevDir : { dx: 0, dy: 1 };

  const isGrass = (x: number, y: number): boolean => {
    return x >= 0 && x < cols && y >= 0 && y < rows && curGrid[y][x].type === cellTypes.GRASS;
  };

  const countSurroundingGrass = (x: number, y: number): number => {
    let count = 0;
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 }
    ];
    for (const d of dirs) {
      if (isGrass(x + d.dx, y + d.dy)) {
        count++;
      }
    }
    return count;
  };

  // 1. Check if straight is grass
  const straightPos = { x: pos.x + currentDir.dx, y: pos.y + currentDir.dy };
  if (isGrass(straightPos.x, straightPos.y)) {
    return straightPos;
  }

  // 2. Evaluate turn options (perpendicular to current direction)
  // If currentDir is {dx, dy}, perpendiculars are {-dy, dx} and {dy, -dx}
  const sideA = { dx: -currentDir.dy, dy: currentDir.dx };
  const sideB = { dx: currentDir.dy, dy: -currentDir.dx };
  const isAligned = (d: Direction) => state.orientation === 'horizontal' ? d.dx !== 0 : d.dy !== 0;
  const turnDirs = isAligned(sideA) ? [sideA, sideB] : [sideB, sideA];

  let bestTurnPos: Point | null = null;
  let maxNeighbors = -1;

  for (const d of turnDirs) {
    const turnPos = { x: pos.x + d.dx, y: pos.y + d.dy };
    if (isGrass(turnPos.x, turnPos.y)) {
      const neighbors = countSurroundingGrass(turnPos.x, turnPos.y);
      if (neighbors > maxNeighbors) {
        maxNeighbors = neighbors;
        bestTurnPos = turnPos;
      }
    }
  }

  if (bestTurnPos) {
    return bestTurnPos;
  }

  // 3. Fallback: No adjacent grass. Use Turn-Penalized A* to find the nearest grass cell.
  // We set a high turnPenalty (e.g. 25) so that the pathfinder strongly prefers straight corridors
  // and avoids routing through winding paths even if they are slightly shorter in distance.
  const path = genericPathSearch(
    pos,
    curGrid,
    currentDir,
    (p) => curGrid[p.y][p.x].type === cellTypes.GRASS,
    () => 0, // simple dijkstra/A* fallback
    25 // turn penalty
  );

  return path && path.length > 0 ? path[0] : null;
};
