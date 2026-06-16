import { CELL_TYPES } from '../constants';
import type { Grid, PositionType as Point, Direction, State } from '../types';

/** Build a grass lawn with a dock and an optional deterministic obstacle scatter (mirrors App.tsx). */
export const buildLawn = (
    cols: number,
    rows: number,
    dock: Point,
    withObstacles = false,
): Grid => {
    const g: Grid = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            row.push({ type: (r === dock.y && c === dock.x) ? CELL_TYPES.DOCK : CELL_TYPES.GRASS, damage: 0, direction: null });
        }
        g.push(row);
    }
    if (withObstacles) {
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (g[r][c].type === CELL_TYPES.DOCK) continue;
            if (Math.abs(r - dock.y) <= 1 && Math.abs(c - dock.x) <= 1) continue;
            const h = Math.abs((r * 928371) ^ (c * 1299721) ^ ((r + c) * 40503));
            const nearEdge = r < 2 || c < 2 || r > rows - 3 || c > cols - 3;
            if (nearEdge ? h % 5 === 0 : h % 23 === 0) g[r][c] = { type: CELL_TYPES.OBSTACLE, damage: 0, direction: null };
        }
    }
    return g;
};

export const countGrass = (g: Grid) => g.flat().filter(c => c.type === CELL_TYPES.GRASS).length;

/** Count grass cells that are still reachable from `from` (i.e. legitimately mowable). */
export const reachableGrass = (g: Grid, from: Point): number => {
    const rows = g.length, cols = g[0].length;
    const seen = new Set<string>([`${from.x},${from.y}`]);
    const queue = [from];
    let count = 0;
    while (queue.length) {
        const { x, y } = queue.shift()!;
        if (g[y][x].type === CELL_TYPES.GRASS) count++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            if (g[ny][nx].type === CELL_TYPES.OBSTACLE) continue;
            const key = `${nx},${ny}`;
            if (seen.has(key)) continue;
            seen.add(key);
            queue.push({ x: nx, y: ny });
        }
    }
    return count;
};

export type MoveFn = (state: State, grid: Grid, prevDir: Direction) => Point | null;

export interface CoverageResult {
    steps: number;
    grassLeft: number;
    movedAwayFromDock: boolean;
    maxDistFromDock: number;
}

/**
 * Drive a move function over a lawn the way the real simulation loop does: the
 * tile the mower leaves is cut, and a `smart`-style fallback fills in whenever
 * the algorithm returns null (matching useAppSimulation). Stops when no
 * reachable grass remains or a generous step budget is hit.
 */
export const runCoverage = (grid: Grid, dock: Point, move: MoveFn, fallback?: MoveFn): CoverageResult => {
    const state: State & Record<string, unknown> = {
        pos: { ...dock },
        prevDir: { dx: 0, dy: 1 },
        battery: Infinity,
        grid,
        dockPos: { ...dock },
        isCharging: false,
        isReturningForCharge: false,
        visitCounts: {},
        orientation: 'horizontal',
    } as never;

    let pos = { ...dock };
    let prevDir: Direction = { dx: 0, dy: 1 };
    const budget = grid.length * grid[0].length * 8;
    let steps = 0;
    let movedAwayFromDock = false;
    let maxDistFromDock = 0;

    for (; steps < budget; steps++) {
        if (reachableGrass(grid, pos) === 0) break;
        state.pos = pos;
        state.prevDir = prevDir;

        let next = move(state, grid, prevDir);
        if (!next && fallback) next = fallback(state, grid, prevDir);
        if (!next) {
            // No reachable target left: the only grass is the tile underfoot.
            // The real loop heads home and cuts this tile on departure, so mow
            // it here too rather than leaving the final cell uncut.
            if (grid[pos.y][pos.x].type === CELL_TYPES.GRASS) {
                grid[pos.y][pos.x] = { ...grid[pos.y][pos.x], type: CELL_TYPES.MOWED };
            }
            break;
        }

        if (grid[pos.y][pos.x].type === CELL_TYPES.GRASS) {
            grid[pos.y][pos.x] = { ...grid[pos.y][pos.x], type: CELL_TYPES.MOWED };
        }
        state.visitCounts[`${next.x},${next.y}`] = (state.visitCounts[`${next.x},${next.y}`] || 0) + 1;
        prevDir = { dx: next.x - pos.x, dy: next.y - pos.y };
        pos = { x: next.x, y: next.y };

        const dist = Math.abs(pos.x - dock.x) + Math.abs(pos.y - dock.y);
        if (dist > 1) movedAwayFromDock = true;
        if (dist > maxDistFromDock) maxDistFromDock = dist;
    }

    return { steps, grassLeft: countGrass(grid), movedAwayFromDock, maxDistFromDock };
};
