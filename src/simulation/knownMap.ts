import { CELL_TYPES } from '../constants';
import type { Grid, Point } from '../types';

/**
 * What the mower knows about the lawn. `grid` is the map every model plans on:
 * seen tiles are copies of the real tiles, unseen tiles look like grass, so a
 * planner treats them as work and goes to look. `seen` tells the two apart.
 */
export interface KnownMap {
    grid: Grid;
    seen: Uint8Array;
    cols: number;
}

export const isSeen = (known: KnownMap, x: number, y: number): boolean => known.seen[y * known.cols + x] === 1;

const unseenTile = () => ({ type: CELL_TYPES.GRASS, damage: 0, direction: null });

/** Copies the real tile into the known map (call it after the real tile changed). */
export const syncTile = (known: KnownMap, lawn: Grid, { x, y }: Point): void => {
    const row = [...known.grid[y]];
    row[x] = lawn[y][x];
    known.grid[y] = row;
};

/**
 * Reveals the square of `range` tiles around `at`. Rows that change are replaced,
 * not edited, so a renderer that compares rows by reference sees the change.
 * Returns true when an obstacle came into view: plans made before may be wrong now.
 */
export const sense = (known: KnownMap, lawn: Grid, at: Point, range: number): boolean => {
    const rows = lawn.length;
    let foundObstacle = false;
    for (let y = Math.max(0, at.y - range); y <= Math.min(rows - 1, at.y + range); y++) {
        let row: Grid[number] | null = null;
        for (let x = Math.max(0, at.x - range); x <= Math.min(known.cols - 1, at.x + range); x++) {
            const index = y * known.cols + x;
            if (known.seen[index]) continue;
            known.seen[index] = 1;
            row ??= [...known.grid[y]];
            row[x] = lawn[y][x];
            if (lawn[y][x].type === CELL_TYPES.OBSTACLE) foundObstacle = true;
        }
        if (row) known.grid[y] = row;
    }
    return foundObstacle;
};

export const createKnownMap = (lawn: Grid, at: Point, range: number): KnownMap => {
    const cols = lawn[0].length;
    const known: KnownMap = {
        grid: lawn.map(row => row.map(unseenTile)),
        seen: new Uint8Array(lawn.length * cols),
        cols,
    };
    sense(known, lawn, at, range);
    return known;
};
