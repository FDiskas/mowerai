import { describe, it, expect } from 'vitest';
import { CELL_TYPES } from '../constants';
import { getSmartAIMove } from './smartAI';
import { buildLawn, runCoverage } from './testSupport';
import type { Grid, Direction, State } from '../types';

const move = (s: State, g: Grid, d: Direction) => getSmartAIMove(s, g, d, CELL_TYPES);

const stateAt = (x: number, y: number, grid: Grid): State => ({
    pos: { x, y }, prevDir: { dx: 0, dy: 1 }, orientation: 'horizontal',
    visitCounts: {}, dockPos: { x: 0, y: 0 }, isCharging: false,
    isReturningForCharge: false, battery: Infinity, grid,
} as unknown as State);

describe('getSmartAIMove', () => {
    it('steps toward the nearest grass', () => {
        const grid = buildLawn(10, 10, { x: 0, y: 0 }, false)
            .map(row => row.map(c => c.type === CELL_TYPES.GRASS ? { ...c, type: CELL_TYPES.MOWED } : c));
        grid[0][5] = { type: CELL_TYPES.GRASS, damage: 0, direction: null };
        const next = getSmartAIMove(stateAt(0, 0, grid), grid, { dx: 1, dy: 0 }, CELL_TYPES)!;
        expect(next).toEqual({ x: 1, y: 0 });
    });

    it('returns null when there is no grass left', () => {
        const grid = buildLawn(6, 6, { x: 0, y: 0 }, false)
            .map(row => row.map(c => c.type === CELL_TYPES.GRASS ? { ...c, type: CELL_TYPES.MOWED } : c));
        expect(getSmartAIMove(stateAt(3, 3, grid), grid, { dx: 0, dy: 1 }, CELL_TYPES)).toBeNull();
    });

    it('covers an entire open lawn', () => {
        const dock = { x: 0, y: 0 };
        const grid = buildLawn(14, 12, dock, false);
        expect(runCoverage(grid, dock, move).grassLeft).toBe(0);
    });
});
