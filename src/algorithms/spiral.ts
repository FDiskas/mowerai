import type { CELL_TYPES } from "../constants";
import type { Direction, Grid, PositionType as Point, State } from "../types";
import { aStarSearch, committedGoal } from "./pathfinding";
import { minTurnsTo, turnCostOf } from "./turnCost";

const NEIGHBORS_4 = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];

const manhattan = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Square ring around `center` that holds `p`: ring k is the border of the (2k+1)-wide square. */
const ringOf = (p: Point, center: Point) =>
  Math.max(Math.abs(p.x - center.x), Math.abs(p.y - center.y));

/** Flood fill from `start` around obstacles; `result[y * cols + x]` is 1 for reachable tiles. */
const reachableTiles = (start: Point, grid: Grid, cellTypes: typeof CELL_TYPES): Uint8Array => {
  const cols = grid[0].length;
  const reached = new Uint8Array(grid.length * cols);
  reached[start.y * cols + start.x] = 1;
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const d of NEIGHBORS_4) {
      const next = { x: queue[i].x + d.dx, y: queue[i].y + d.dy };
      const cell = grid[next.y]?.[next.x];
      if (!cell || cell.type === cellTypes.OBSTACLE || reached[next.y * cols + next.x]) continue;
      reached[next.y * cols + next.x] = 1;
      queue.push(next);
    }
  }
  return reached;
};

/**
 * Reachable grass in the innermost ring around `center` that still has some,
 * cheapest first by distance plus `turnCost` per heading change from `heading`.
 */
const nextRingTile = (
  pos: Point,
  heading: Direction,
  center: Point,
  grid: Grid,
  cellTypes: typeof CELL_TYPES,
  turnCost: number,
): Point | null => {
  const cols = grid[0].length;
  const reachable = reachableTiles(pos, grid, cellTypes);
  let best: Point | null = null;
  let bestRing = Infinity;
  let bestCost = Infinity;
  grid.forEach((row, y) =>
    row.forEach((cell, x) => {
      const tile = { x, y };
      const dist = manhattan(tile, pos);
      if (cell.type !== cellTypes.GRASS || dist === 0 || !reachable[y * cols + x]) return;
      const ring = ringOf(tile, center);
      const cost = dist + turnCost * minTurnsTo(pos, heading, tile);
      if (ring < bestRing || (ring === bestRing && cost < bestCost)) {
        best = tile;
        bestRing = ring;
        bestCost = cost;
      }
    }),
  );
  return best;
};

/**
 * Spiral Coverage Algorithm
 *
 * Mows square rings outwards around the start tile, one ring at a time. Inside
 * a ring the mower takes the cheapest grass first (distance plus turns from the
 * current heading), so it walks around the ring in open space and sweeps the
 * clipped L-shaped rings back and forth at the lawn edges instead of crossing
 * the lawn to reach the other end of a ring.
 */
export const getSpiralMove = (
  state: State,
  curGrid: Grid,
  cellTypes: typeof CELL_TYPES,
): Point | null => {
  const { pos, prevDir } = state;
  const turnCost = turnCostOf(state);
  const center = state.spiralCenter ?? pos;
  state.spiralCenter = center;

  const goal = committedGoal(state, curGrid, cellTypes, () =>
    nextRingTile(pos, prevDir, center, curGrid, cellTypes, turnCost),
  );
  return goal && aStarSearch(pos, goal, curGrid, prevDir, turnCost);
};
