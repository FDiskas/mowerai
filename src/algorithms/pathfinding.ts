import { CELL_TYPES } from "../constants";
import type { Grid, PositionType as Point, Direction } from "../types";

/**
 * Binary min-heap keyed by priority. O(log n) push/pop, unlike a sort-on-every-
 * push array which is O(n log n) per insert and made the end-of-job
 * return-to-dock search stutter on larger lawns.
 */
class MinHeap {
  private nodes: number[] = []; // node indices into the search arena
  private priorities: number[] = []; // parallel array of priorities

  push(node: number, priority: number) {
    const { nodes, priorities } = this;
    let i = nodes.length;
    nodes.push(node);
    priorities.push(priority);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (priorities[parent] <= priorities[i]) break;
      [priorities[parent], priorities[i]] = [priorities[i], priorities[parent]];
      [nodes[parent], nodes[i]] = [nodes[i], nodes[parent]];
      i = parent;
    }
  }

  pop(): number | undefined {
    const { nodes, priorities } = this;
    const n = nodes.length;
    if (n === 0) return undefined;
    const top = nodes[0];
    const lastNode = nodes.pop()!;
    const lastPrio = priorities.pop()!;
    if (n > 1) {
      nodes[0] = lastNode;
      priorities[0] = lastPrio;
      let i = 0;
      const size = nodes.length;
      for (;;) {
        const l = 2 * i + 1,
          r = 2 * i + 2;
        let smallest = i;
        if (l < size && priorities[l] < priorities[smallest]) smallest = l;
        if (r < size && priorities[r] < priorities[smallest]) smallest = r;
        if (smallest === i) break;
        [priorities[smallest], priorities[i]] = [
          priorities[i],
          priorities[smallest],
        ];
        [nodes[smallest], nodes[i]] = [nodes[i], nodes[smallest]];
        i = smallest;
      }
    }
    return top;
  }

  get length(): number {
    return this.nodes.length;
  }
}

/**
 * Unified Pathfinding Logic (Dijkstra/A* variant).
 *
 * Nodes live in flat parallel arrays and the path is rebuilt from parent
 * pointers on success — cloning the whole path into every frontier node
 * (O(path) per expansion) would dominate the cost of every return-to-dock
 * search.
 */
export const genericPathSearch = (
  start: Point,
  currentGrid: Grid,
  currentDir: Direction,
  targetPredicate: (p: Point) => boolean,
  heuristic: (p: Point) => number = () => 0,
  turnPenalty: number = 5,
): Point[] | null => {
  const rows = currentGrid.length;
  const cols = currentGrid[0].length;
  const openSet = new MinHeap();
  const visited = new Map<string, number>(); // state key -> min_cost_to_reach

  // Search arena: one entry per discovered node, referenced by index.
  const px: number[] = [start.x];
  const py: number[] = [start.y];
  const pg: number[] = [0];
  const pdx: number[] = [currentDir.dx];
  const pdy: number[] = [currentDir.dy];
  const parent: number[] = [-1];

  openSet.push(0, heuristic(start));

  const dirs = [
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
  ];

  while (openSet.length > 0) {
    const curr = openSet.pop()!;
    const x = px[curr],
      y = py[curr];

    // Target reached: walk parent pointers back to (but excluding) the start.
    if ((x !== start.x || y !== start.y) && targetPredicate({ x, y })) {
      const path: Point[] = [];
      let n = curr;
      while (parent[n] !== -1) {
        path.push({ x: px[n], y: py[n] });
        n = parent[n];
      }
      path.reverse();
      return path;
    }

    const stateKey = `${x},${y},${pdx[curr]},${pdy[curr]}`;
    if (visited.has(stateKey) && visited.get(stateKey)! <= pg[curr]) continue;
    visited.set(stateKey, pg[curr]);

    for (const d of dirs) {
      const nextX = x + d.dx;
      const nextY = y + d.dy;

      if (
        nextX >= 0 &&
        nextX < cols &&
        nextY >= 0 &&
        nextY < rows &&
        currentGrid[nextY][nextX].type !== CELL_TYPES.OBSTACLE
      ) {
        const isTurn = d.dx !== pdx[curr] || d.dy !== pdy[curr];
        const nextG = pg[curr] + 1 + (isTurn ? turnPenalty : 0);
        const nextKey = `${nextX},${nextY},${d.dx},${d.dy}`;
        if (visited.has(nextKey) && visited.get(nextKey)! <= nextG) continue;

        const idx = px.length;
        px.push(nextX);
        py.push(nextY);
        pg.push(nextG);
        pdx.push(d.dx);
        pdy.push(d.dy);
        parent.push(curr);
        openSet.push(idx, nextG + heuristic({ x: nextX, y: nextY }));
      }
    }
  }
  return null;
};

export const findFullPathToTarget = (
  start: Point,
  currentGrid: Grid,
  currentDir: Direction,
  targetPredicate: (p: Point) => boolean,
): Point[] | null => {
  return genericPathSearch(start, currentGrid, currentDir, targetPredicate);
};

export const findPathToTarget = (
  start: Point,
  currentGrid: Grid,
  currentDir: Direction,
  targetPredicate: (p: Point) => boolean,
): Point | null => {
  const path = findFullPathToTarget(
    start,
    currentGrid,
    currentDir,
    targetPredicate,
  );
  return path ? path[0] : null;
};

export const getClosestGrass = (
  pos: Point,
  grid: Grid,
  cellTypes: typeof CELL_TYPES,
): Point | null => {
  let closest: Point | null = null;
  let minDist = Infinity;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      if (grid[y][x].type === cellTypes.GRASS) {
        const dist = Math.abs(x - pos.x) + Math.abs(y - pos.y);
        if (dist < minDist) {
          minDist = dist;
          closest = { x, y };
        }
      }
    }
  }
  return closest;
};

/**
 * A* shortest path to a single target cell, returning the first step.
 *
 * This is the one representative of the classic single-target search family.
 * The old `dijkstra` / `bfs` / `greedy_bfs` / `jps` / `d_star_lite` entries all
 * resolved to this same nearest-grass search with only a turn-penalty constant
 * changed, so they were dropped as duplicates.
 */
export const aStarSearch = (
  start: Point,
  target: Point,
  currentGrid: Grid,
  currentDir: Direction,
): Point | null => {
  const heuristic = (p: Point) =>
    Math.abs(p.x - target.x) + Math.abs(p.y - target.y);
  const path = genericPathSearch(
    start,
    currentGrid,
    currentDir,
    (p) => p.x === target.x && p.y === target.y,
    heuristic,
  );
  return path ? path[0] : null;
};
