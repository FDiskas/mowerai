import type { CELL_TYPES } from "../constants";
import type { Grid, PositionType as Point, Direction, State } from "../types";
import { nextLaneSweepStep } from "./laneSweep";
import { genericPathSearch } from "./pathfinding";
import { turnCostOf } from "./turnCost";

/**
 * Boustrophedon Cellular Decomposition Grid Partitioning
 *
 * Partitions the grid into sweep cells along the given orientation, based on
 * connectivity splits/merges between neighbouring lines.
 */
export const decomposeGrid = (
  curGrid: Grid,
  cellTypes: typeof CELL_TYPES,
  orientation: 'horizontal' | 'vertical' = 'vertical'
): number[][] => {
  const rows = curGrid.length;
  const cols = curGrid[0].length;

  interface Segment {
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
      } else if (inSegment) {
        lineSegs.push({ start, end: j - 1, cellId: null });
        inSegment = false;
      }
    }
    if (inSegment) {
      lineSegs.push({ start, end: lineLength - 1, cellId: null });
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
          cellIdGrid[j][i] = seg.cellId ?? 0;
        } else {
          cellIdGrid[i][j] = seg.cellId ?? 0;
        }
      }
    }
  }

  return cellIdGrid;
};

/** Turn cost factor (x shared turn cost) for routes inside the active cell; modest, as these are short local manoeuvres. */
const LOCAL_TURN_COST_FACTOR = 2;
/** Turn cost factor (x shared turn cost) for routes that cross into another cell. */
const TRANSIT_TURN_COST_FACTOR = 3;

/**
 * Cell Decomposition Sweep Algorithm
 *
 * Mows one decomposition cell at a time in lanes along the selected
 * orientation, then routes to the nearest grass and adopts that tile's cell.
 */
export const getCellularDecompositionMove = (
  state: State,
  curGrid: Grid,
  prevDir: Direction,
  cellTypes: typeof CELL_TYPES,
): Point | null => {
  const { pos } = state;
  const heading = prevDir.dx !== 0 || prevDir.dy !== 0 ? prevDir : { dx: 0, dy: 1 };
  const turnCost = turnCostOf(state);

  // Newly found obstacles split cells, so the decomposition is rebuilt from the current map.
  if (!state.cellIdGrid || state.cellIdGridVersion !== state.mapVersion) {
    state.cellIdGrid = decomposeGrid(curGrid, cellTypes, state.orientation);
    state.cellIdGridVersion = state.mapVersion;
    state.activeCellId = state.cellIdGrid[pos.y][pos.x];
  }
  const cellIdGrid = state.cellIdGrid;

  const isGrass = (p: Point) => curGrid[p.y]?.[p.x]?.type === cellTypes.GRASS;
  const isActiveCellGrass = (p: Point) =>
    isGrass(p) && cellIdGrid[p.y][p.x] === state.activeCellId;
  const hasGrassInActiveCell = () =>
    curGrid.some((row, y) => row.some((_, x) => isActiveCellGrass({ x, y })));

  if (hasGrassInActiveCell()) {
    const sweepStep =
      nextLaneSweepStep(pos, prevDir, state.orientation, curGrid, cellTypes, isActiveCellGrass) ??
      genericPathSearch(pos, curGrid, heading, isActiveCellGrass, () => 0, LOCAL_TURN_COST_FACTOR * turnCost)?.[0];
    if (sweepStep) return sweepStep;
  }

  // Active cell is done: route to the nearest grass and make its cell active.
  const globalPath = genericPathSearch(pos, curGrid, heading, isGrass, () => 0, TRANSIT_TURN_COST_FACTOR * turnCost);
  if (!globalPath) return null;
  const target = globalPath[globalPath.length - 1];
  state.activeCellId = cellIdGrid[target.y][target.x];
  return globalPath[0];
};
