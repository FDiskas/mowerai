import type { Grid, PositionType as Point, Direction, State } from '../types';
import { findPathToTarget } from './pathfinding';

const NEIGHBORS_4 = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];

/**
 * Direction Optimization: real mowers pick the sweep angle along the longest
 * edge of the area to minimise the number of turns. On a grid we approximate
 * this by the grass bounding box: a wider area is swept horizontally (fewer,
 * longer rows), a taller area is swept vertically.
 */
const computeSweepOrientation = (grid: Grid, CELL_TYPES: any): 'horizontal' | 'vertical' => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[0].length; x++) {
            if (grid[y][x].type === CELL_TYPES.GRASS) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < minX) return 'horizontal'; // no grass; arbitrary default
    return (maxX - minX) >= (maxY - minY) ? 'horizontal' : 'vertical';
};

/**
 * Boustrophedon coverage with a contour pass — mirrors how Navimow/Dreame work:
 *   MOWING_EDGE  -> follow the perimeter contour (border grass)
 *   MOWING_ZIGZAG -> fill the interior with parallel passes along the optimal axis
 *   (DOCKING is handled by the simulation loop once no grass remains)
 */
export const getBoustrophedonMove = (
    state: State,
    curGrid: Grid,
    prevDir: Direction,
    CELL_TYPES: any
): Point | null => {
    const { pos } = state;
    const rows = curGrid.length;
    const cols = curGrid[0].length;

    if (!state.cellData) {
        // Respect the user-selected sweep axis; fall back to direction
        // optimization (longest-edge) only when no orientation is set.
        state.cellData = {
            sweepDir: 1,
            cellScanDir: 1,
            orientation: state.orientation ?? computeSweepOrientation(curGrid, CELL_TYPES),
            phase: 'edge',
        };
    }
    const cellData = state.cellData;
    const isVert = cellData.orientation === 'vertical';

    const isValidGrass = (x: number, y: number) =>
        x >= 0 && x < cols && y >= 0 && y < rows && curGrid[y][x].type === CELL_TYPES.GRASS;

    // A "hard" boundary the perimeter contour hugs: grid edge, obstacle or dock.
    const isHardBlock = (x: number, y: number) =>
        x < 0 || x >= cols || y < 0 || y >= rows ||
        curGrid[y][x].type === CELL_TYPES.OBSTACLE ||
        curGrid[y][x].type === CELL_TYPES.DOCK;

    // Border grass = unmowed grass touching a hard boundary (the outer contour).
    const isBorderGrass = (x: number, y: number) =>
        isValidGrass(x, y) && NEIGHBORS_4.some(n => isHardBlock(x + n.dx, y + n.dy));

    // --- PHASE 1: MOWING_EDGE (perimeter contour) ---
    if (cellData.phase === 'edge') {
        // Prefer keeping the current heading to trace the contour smoothly.
        const straight = { x: pos.x + prevDir.dx, y: pos.y + prevDir.dy };
        if (isBorderGrass(straight.x, straight.y)) return straight;

        for (const n of NEIGHBORS_4) {
            const nx = pos.x + n.dx;
            const ny = pos.y + n.dy;
            if (isBorderGrass(nx, ny)) return { x: nx, y: ny };
        }

        // No adjacent border grass: route to the nearest remaining contour cell.
        const toBorder = findPathToTarget(pos, curGrid, prevDir, (p) => isBorderGrass(p.x, p.y));
        if (toBorder) return toBorder;

        // Whole contour is mowed -> switch to the interior sweep.
        cellData.phase = 'zigzag';
    }

    // --- PHASE 2: MOWING_ZIGZAG (parallel passes) ---
    // 1. Continue along the current pass.
    const nextSweepPos = isVert
        ? { x: pos.x, y: pos.y + cellData.sweepDir }
        : { x: pos.x + cellData.sweepDir, y: pos.y };
    if (isValidGrass(nextSweepPos.x, nextSweepPos.y)) return nextSweepPos;

    // 2. Pass ended: step to the adjacent pass and reverse direction.
    const adjLinePos = isVert
        ? { x: pos.x + cellData.cellScanDir, y: pos.y }
        : { x: pos.x, y: pos.y + cellData.cellScanDir };
    if (isValidGrass(adjLinePos.x, adjLinePos.y)) {
        cellData.sweepDir *= -1;
        return adjLinePos;
    }

    // 3. Adjacent pass on that side blocked: try the opposite scan side.
    const adjLineOpp = isVert
        ? { x: pos.x - cellData.cellScanDir, y: pos.y }
        : { x: pos.x, y: pos.y - cellData.cellScanDir };
    if (isValidGrass(adjLineOpp.x, adjLineOpp.y)) {
        cellData.cellScanDir *= -1;
        cellData.sweepDir *= -1;
        return adjLineOpp;
    }

    // 4. Local region finished: jump to the closest remaining grass via A*.
    const closest = findPathToTarget(pos, curGrid, prevDir, (p) => curGrid[p.y][p.x].type === CELL_TYPES.GRASS);
    if (closest) {
        const dx = closest.x - pos.x;
        const dy = closest.y - pos.y;
        if (isVert && dy !== 0) cellData.sweepDir = Math.sign(dy);
        if (!isVert && dx !== 0) cellData.sweepDir = Math.sign(dx);
        return closest;
    }

    return null;
};
