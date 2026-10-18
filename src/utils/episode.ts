import { CELL_TYPES } from '../constants';
import { headingBetween, mowTile, type MowOutcome } from '../domain/MowingStep';
import type { Direction, Grid, Point, State } from '../types';
import { resetLawn } from './simUtils';

export interface EpisodeSettings {
    battery: number;
    orientation: 'horizontal' | 'vertical';
    turnCost: number;
}

export interface MowerStep {
    heading: Direction;
    isTurn: boolean;
    outcome: MowOutcome;
    /** Visits of the entered tile, this one included. */
    visitCount: number;
}

const NEIGHBOURS: Direction[] = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
];

/** Algorithm state for a run that starts at the dock on a regrown copy of `lawn`. */
export const startEpisode = (lawn: Grid, dockPos: Point, settings: EpisodeSettings): State => ({
    pos: { ...dockPos },
    prevDir: { dx: 0, dy: 1 },
    battery: settings.battery,
    grid: resetLawn(lawn),
    dockPos: { ...dockPos },
    isCharging: false,
    isReturningForCharge: false,
    visitCounts: {},
    orientation: settings.orientation,
    maxBattery: settings.battery,
    turnCost: settings.turnCost,
});

/**
 * Drive one tile. Like the live simulation, the tile being left is cut with `mowTile`.
 * Updates position, heading and visit counts in place; battery is up to the caller.
 */
export const advanceMower = (state: State, move: Point): MowerStep => {
    const heading = headingBetween(state.pos, move);
    const isTurn = heading.dx !== state.prevDir.dx || heading.dy !== state.prevDir.dy;
    const outcome = mowTile(state.grid[state.pos.y][state.pos.x], heading, isTurn);
    state.grid[state.pos.y][state.pos.x] = outcome.cell;

    const visitKey = `${move.x},${move.y}`;
    const visitCount = (state.visitCounts[visitKey] ?? 0) + 1;
    state.visitCounts[visitKey] = visitCount;

    state.pos = move;
    state.prevDir = heading;
    return { heading, isTurn, outcome, visitCount };
};

/** Grass tiles the mower can drive to from `from` without crossing obstacles. */
export const countReachableGrass = (grid: Grid, from: Point): number => {
    const rows = grid.length;
    const cols = grid[0].length;
    const seen = new Uint8Array(rows * cols);
    const queue: Point[] = [from];
    seen[from.y * cols + from.x] = 1;
    let grass = 0;

    for (let i = 0; i < queue.length; i++) {
        const { x, y } = queue[i];
        if (grid[y][x].type === CELL_TYPES.GRASS) grass++;
        for (const { dx, dy } of NEIGHBOURS) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
            if (seen[ny * cols + nx] || grid[ny][nx].type === CELL_TYPES.OBSTACLE) continue;
            seen[ny * cols + nx] = 1;
            queue.push({ x: nx, y: ny });
        }
    }
    return grass;
};
