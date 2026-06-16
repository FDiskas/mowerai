import type { CELL_TYPES } from "../constants";
import type { Grid, PositionType as Point, State } from "../types";
import { findPathToTarget } from "./pathfinding";

/**
 * Artificial Potential Fields (APF)
 *
 * The mower descends a potential field made of an attractive pull toward fresh
 * grass and a repulsive push from obstacles. A pure field has a well-known
 * failure mode — local minima where the mower oscillates between two cells
 * forever (it used to bounce between the two tiles next to the dock and never
 * leave). Two things prevent that here:
 *   - only *fresh grass* neighbours compete in the local descent, so a mowed
 *     pocket is never a valid "downhill" step, and
 *   - when no grass is adjacent (local region exhausted) we route to the
 *     nearest remaining grass with A*, which is the attractive force resolved
 *     globally instead of greedily.
 */
export const getPotentialFieldMove = (
  state: State,
  curGrid: Grid,
  cellTypes: typeof CELL_TYPES,
): Point | null => {
  const { pos } = state;
  const prevDir = state.prevDir ?? { dx: 0, dy: 0 };
  const rows = curGrid.length;
  const cols = curGrid[0].length;
  const dirs = [
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
  ];

  const isFreshGrass = (x: number, y: number) =>
    x >= 0 &&
    x < cols &&
    y >= 0 &&
    y < rows &&
    curGrid[y][x].type === cellTypes.GRASS;

  let bestMove: Point | null = null;
  let minPotential = Infinity;

  for (const d of dirs) {
    const nx = pos.x + d.dx;
    const ny = pos.y + d.dy;

    // Only fresh grass is a valid downhill step — this is what keeps the
    // mower from settling into a mowed-cell oscillation.
    if (!isFreshGrass(nx, ny)) continue;

    let potential = 0;

    // Repulsive push from nearby obstacles.
    const repulsiveK = 10.0;
    for (let y = Math.max(0, ny - 2); y <= Math.min(rows - 1, ny + 2); y++) {
      for (let x = Math.max(0, nx - 2); x <= Math.min(cols - 1, nx + 2); x++) {
        if (curGrid[y][x].type === cellTypes.OBSTACLE) {
          const dist = Math.sqrt((nx - x) ** 2 + (ny - y) ** 2);
          if (dist < 1.5) potential += repulsiveK / (dist + 0.1);
        }
      }
    }

    // Momentum: gently prefer keeping the current heading. This breaks the
    // symmetric ties between equally-good grass tiles that otherwise made
    // the mower spin in place at the start of a run.
    if (d.dx === prevDir.dx && d.dy === prevDir.dy) potential -= 1.0;

    // Orientation bias: gently prefer moves aligned with the preferred orientation.
    const isAligned = state.orientation === 'horizontal' ? (d.dx !== 0) : (d.dy !== 0);
    if (isAligned) potential -= 0.5;

    if (potential < minPotential) {
      minPotential = potential;
      bestMove = { x: nx, y: ny };
    }
  }

  if (bestMove) return bestMove;

  // No adjacent grass left: follow the global attractive force to the nearest
  // remaining grass instead of stalling in a local minimum.
  return findPathToTarget(
    pos,
    curGrid,
    prevDir,
    (p) => curGrid[p.y][p.x].type === cellTypes.GRASS,
  );
};
