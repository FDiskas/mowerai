import type { CELL_TYPES } from "../constants";
import type { Grid, PositionType as Point, Direction, State } from "../types";
import { committedGoal, getClosestGrass } from "./pathfinding";
import { getSmartAIMove } from "./smartAI";
import { turnCostOf } from "./turnCost";

const MAX_NODES = 500;
const TARGET_SAMPLE_BIAS = 0.2;

/**
 * RRT (Rapidly-exploring Random Tree) Exploration
 * Finds a path to the cheapest grass (distance plus turns) by growing a random tree.
 */
export const getRRTMove = (
  state: State,
  curGrid: Grid,
  prevDir: Direction,
  cellTypes: typeof CELL_TYPES,
): Point | null => {
  const { pos } = state;
  const target = committedGoal(state, curGrid, cellTypes, () =>
    getClosestGrass(pos, curGrid, cellTypes, prevDir, turnCostOf(state)),
  );
  if (!target) return null;

  const rows = curGrid.length;
  const cols = curGrid[0].length;
  const nodes = [{ pos, parent: -1 }];
  const inTree = new Uint8Array(rows * cols);
  inTree[pos.y * cols + pos.x] = 1;

  for (let i = 0; i < MAX_NODES; i++) {
    const sample =
      Math.random() < TARGET_SAMPLE_BIAS
        ? target
        : {
            x: Math.floor(Math.random() * cols),
            y: Math.floor(Math.random() * rows),
          };

    let nearestIdx = 0;
    let minDist = Infinity;
    for (let j = 0; j < nodes.length; j++) {
      const d =
        Math.abs(nodes[j].pos.x - sample.x) +
        Math.abs(nodes[j].pos.y - sample.y);
      if (d < minDist) {
        minDist = d;
        nearestIdx = j;
      }
    }

    // Step one tile towards the sample, one axis at a time (grid moves).
    const nearest = nodes[nearestIdx].pos;
    const dx = Math.sign(sample.x - nearest.x);
    const dy = Math.sign(sample.y - nearest.y);
    const nextX = nearest.x + dx;
    const nextY = nearest.y + (dx === 0 ? dy : 0);

    if (
      nextX >= 0 &&
      nextX < cols &&
      nextY >= 0 &&
      nextY < rows &&
      curGrid[nextY][nextX].type !== cellTypes.OBSTACLE &&
      !inTree[nextY * cols + nextX]
    ) {
      inTree[nextY * cols + nextX] = 1;
      nodes.push({ pos: { x: nextX, y: nextY }, parent: nearestIdx });
      if (nextX === target.x && nextY === target.y) {
        // Walk back to the node just after the root: that is the first move.
        let curr = nodes.length - 1;
        while (nodes[curr].parent > 0) curr = nodes[curr].parent;
        return nodes[curr].pos;
      }
    }
  }

  state.goal = undefined;
  return getSmartAIMove(state, curGrid, prevDir, cellTypes);
};
