import type { CELL_TYPES } from "../constants";
import type { Grid, PositionType as Point, Direction, State } from "../types";
import { genericPathSearch } from "./pathfinding";

/**
 * Boustrophedon Cellular Decomposition Grid Partitioning
 * 
 * Partitions the grid into vertical sweep cells based on connectivity splits/merges.
 */
export const decomposeGrid = (
  curGrid: Grid,
  cellTypes: typeof CELL_TYPES,
): number[][] => {
  const rows = curGrid.length;
  const cols = curGrid[0].length;

  interface Segment {
    x: number;
    yStart: number;
    yEnd: number;
    cellId: number | null;
  }

  const segmentsByCol: Segment[][] = [];

  // 1. Extract vertical segments of traversable (non-obstacle) cells
  for (let x = 0; x < cols; x++) {
    const colSegs: Segment[] = [];
    let inSegment = false;
    let yStart = 0;

    for (let y = 0; y < rows; y++) {
      const isTraversable = curGrid[y][x].type !== cellTypes.OBSTACLE;
      if (isTraversable) {
        if (!inSegment) {
          yStart = y;
          inSegment = true;
        }
      } else {
        if (inSegment) {
          colSegs.push({ x, yStart, yEnd: y - 1, cellId: null });
          inSegment = false;
        }
      }
    }
    if (inSegment) {
      colSegs.push({ x, yStart, yEnd: rows - 1, cellId: null });
    }
    segmentsByCol.push(colSegs);
  }

  let nextCellId = 1;

  // Initialize first column segments
  if (cols > 0) {
    for (const seg of segmentsByCol[0]) {
      seg.cellId = nextCellId++;
    }
  }

  // 2. Propagate cell IDs column-by-column, detecting split and merge events
  for (let x = 0; x < cols - 1; x++) {
    const colA = segmentsByCol[x];
    const colB = segmentsByCol[x + 1];

    for (const segB of colB) {
      const overlapsA = colA.filter(segA =>
        Math.max(segA.yStart, segB.yStart) <= Math.min(segA.yEnd, segB.yEnd)
      );

      if (overlapsA.length === 0) {
        // Start event: no overlapping segment in previous column
        segB.cellId = nextCellId++;
      } else if (overlapsA.length === 1) {
        const segA = overlapsA[0];
        // Check if segA splits into multiple segments in colB
        const overlapsB = colB.filter(sB =>
          Math.max(segA.yStart, sB.yStart) <= Math.min(segA.yEnd, sB.yEnd)
        );

        if (overlapsB.length === 1) {
          // Simple propagation: 1-to-1 match
          segB.cellId = segA.cellId;
        } else {
          // Split event: 1-to-many match
          segB.cellId = nextCellId++;
        }
      } else {
        // Merge event: many-to-1 match
        segB.cellId = nextCellId++;
      }
    }
  }

  // 3. Fill the 2D cell ID map
  const cellIdGrid = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let x = 0; x < cols; x++) {
    for (const seg of segmentsByCol[x]) {
      for (let y = seg.yStart; y <= seg.yEnd; y++) {
        cellIdGrid[y][x] = seg.cellId || 0;
      }
    }
  }

  return cellIdGrid;
};

/**
 * Cell Decomposition Sweep Algorithm
 */
export const getCellularDecompositionMove = (
  state: State,
  curGrid: Grid,
  prevDir: Direction,
  cellTypes: typeof CELL_TYPES,
): Point | null => {
  const { pos } = state;
  const rows = curGrid.length;
  const cols = curGrid[0].length;

  const currentDir = prevDir && (prevDir.dx !== 0 || prevDir.dy !== 0) ? prevDir : { dx: 0, dy: 1 };

  // 1. Initialize Cell ID Grid if not present
  if (!state.cellIdGrid) {
    state.cellIdGrid = decomposeGrid(curGrid, cellTypes);
    state.activeCellId = state.cellIdGrid[pos.y][pos.x];
  }

  // Helper to check if a cell is grass and belongs to the active cell
  const isActiveCellGrass = (x: number, y: number): boolean => {
    return (
      x >= 0 &&
      x < cols &&
      y >= 0 &&
      y < rows &&
      state.cellIdGrid![y][x] === state.activeCellId &&
      curGrid[y][x].type === cellTypes.GRASS
    );
  };

  // Helper to check if there is any grass remaining in the active cell
  const hasGrassInActiveCell = (): boolean => {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (state.cellIdGrid![y][x] === state.activeCellId && curGrid[y][x].type === cellTypes.GRASS) {
          return true;
        }
      }
    }
    return false;
  };

  // 2. Systematic Sweep inside the active cell
  if (hasGrassInActiveCell()) {
    // A. Continue straight if possible
    const straight = { x: pos.x + currentDir.dx, y: pos.y + currentDir.dy };
    if (isActiveCellGrass(straight.x, straight.y)) {
      return straight;
    }

    // B. Check perpendicular turns
    const turnDirs = [
      { dx: -currentDir.dy, dy: currentDir.dx },
      { dx: currentDir.dy, dy: -currentDir.dx }
    ];

    for (const d of turnDirs) {
      const turnPos = { x: pos.x + d.dx, y: pos.y + d.dy };
      if (isActiveCellGrass(turnPos.x, turnPos.y)) {
        return turnPos;
      }
    }

    // C. Route to the nearest grass tile *within the same cell*
    const localPath = genericPathSearch(
      pos,
      curGrid,
      currentDir,
      (p) => curGrid[p.y][p.x].type === cellTypes.GRASS && state.cellIdGrid![p.y][p.x] === state.activeCellId,
      () => 0,
      10 // modest turn penalty for local maneuvers
    );

    if (localPath && localPath.length > 0) {
      return localPath[0];
    }
  }

  // 3. Current cell is fully mowed. Transition to the next nearest cell containing grass.
  const globalPath = genericPathSearch(
    pos,
    curGrid,
    currentDir,
    (p) => curGrid[p.y][p.x].type === cellTypes.GRASS,
    () => 0,
    15 // standard turn penalty for cross-cell transit
  );

  if (globalPath && globalPath.length > 0) {
    const nextStep = globalPath[0];
    // Find the final target of this path to set the new active cell ID
    const targetCellGrass = globalPath[globalPath.length - 1];
    state.activeCellId = state.cellIdGrid[targetCellGrass.y][targetCellGrass.x];
    return nextStep;
  }

  return null;
};
