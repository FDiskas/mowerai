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
  orientation: 'horizontal' | 'vertical' = 'vertical'
): number[][] => {
  const rows = curGrid.length;
  const cols = curGrid[0].length;

  interface Segment {
    index: number;
    start: number;
    end: number;
    cellId: number | null;
  }

  const isVert = orientation === 'vertical';
  const segmentsByLine: Segment[][] = [];
  const linesCount = isVert ? cols : rows;
  const lineLength = isVert ? rows : cols;

  // 1. Extract contiguous segments of traversable (non-obstacle) cells
  for (let i = 0; i < linesCount; i++) {
    const lineSegs: Segment[] = [];
    let inSegment = false;
    let start = 0;

    for (let j = 0; j < lineLength; j++) {
      const cell = isVert ? curGrid[j][i] : curGrid[i][j];
      const isTraversable = cell.type !== cellTypes.OBSTACLE;
      if (isTraversable) {
        if (!inSegment) {
          start = j;
          inSegment = true;
        }
      } else {
        if (inSegment) {
          lineSegs.push({ index: i, start, end: j - 1, cellId: null });
          inSegment = false;
        }
      }
    }
    if (inSegment) {
      lineSegs.push({ index: i, start, end: lineLength - 1, cellId: null });
    }
    segmentsByLine.push(lineSegs);
  }

  let nextCellId = 1;

  // Initialize first line segments
  if (linesCount > 0) {
    for (const seg of segmentsByLine[0]) {
      seg.cellId = nextCellId++;
    }
  }

  // 2. Propagate cell IDs line-by-line, detecting split and merge events
  for (let i = 0; i < linesCount - 1; i++) {
    const lineA = segmentsByLine[i];
    const lineB = segmentsByLine[i + 1];

    for (const segB of lineB) {
      const overlapsA = lineA.filter(segA =>
        Math.max(segA.start, segB.start) <= Math.min(segA.end, segB.end)
      );

      if (overlapsA.length === 0) {
        // Start event
        segB.cellId = nextCellId++;
      } else if (overlapsA.length === 1) {
        const segA = overlapsA[0];
        // Check if segA splits into multiple segments in lineB
        const overlapsB = lineB.filter(sB =>
          Math.max(segA.start, sB.start) <= Math.min(segA.end, sB.end)
        );

        if (overlapsB.length === 1) {
          // Simple propagation
          segB.cellId = segA.cellId;
        } else {
          // Split event
          segB.cellId = nextCellId++;
        }
      } else {
        // Merge event
        segB.cellId = nextCellId++;
      }
    }
  }

  // 3. Fill the 2D cell ID map
  const cellIdGrid = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < linesCount; i++) {
    for (const seg of segmentsByLine[i]) {
      for (let j = seg.start; j <= seg.end; j++) {
        if (isVert) {
          cellIdGrid[j][i] = seg.cellId || 0;
        } else {
          cellIdGrid[i][j] = seg.cellId || 0;
        }
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
    state.cellIdGrid = decomposeGrid(curGrid, cellTypes, state.orientation);
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
    const sideA = { dx: -currentDir.dy, dy: currentDir.dx };
    const sideB = { dx: currentDir.dy, dy: -currentDir.dx };
    const isAligned = (d: Direction) => state.orientation === 'horizontal' ? d.dx !== 0 : d.dy !== 0;
    const turnDirs = isAligned(sideA) ? [sideA, sideB] : [sideB, sideA];

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
