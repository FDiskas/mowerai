import { describe, it, expect } from 'vitest';
import { CELL_TYPES } from '../constants';
import { getBoustrophedonMove } from './boustrophedon';
import { getSmartAIMove } from './smartAI';
import { buildLawn, countGrass, reachableGrass, runCoverage } from './testSupport';
import type { Grid, Direction, State } from '../types';

const move = (s: State, g: Grid, d: Direction) => getBoustrophedonMove(s, g, d, CELL_TYPES);
const fallback = (s: State, g: Grid, d: Direction) => getSmartAIMove(s, g, d, CELL_TYPES);

describe('getBoustrophedonMove', () => {
    it('covers an entire open lawn', () => {
        const dock = { x: 0, y: 0 };
        const grid = buildLawn(16, 12, dock, false);
        const r = runCoverage(grid, dock, move, fallback);
        expect(r.grassLeft).toBe(0);
    });

    it('covers all reachable grass on an obstacle lawn', () => {
        const dock = { x: 0, y: 0 };
        const grid = buildLawn(25, 20, dock, true);
        const total = countGrass(grid);
        const reachable = reachableGrass(grid, dock);
        const r = runCoverage(grid, dock, move, fallback);
        expect(r.grassLeft).toBe(total - reachable);
    });

    it('returns null when no grass is left (loop then handles docking)', () => {
        const grid: Grid = buildLawn(8, 8, { x: 0, y: 0 }, false)
            .map(row => row.map(c => c.type === CELL_TYPES.GRASS ? { ...c, type: CELL_TYPES.MOWED } : c));
        const state = {
            pos: { x: 4, y: 4 }, prevDir: { dx: 0, dy: 1 }, orientation: 'horizontal',
            visitCounts: {}, dockPos: { x: 0, y: 0 }, isCharging: false,
            isReturningForCharge: false, battery: Infinity, grid,
        } as unknown as State;
        expect(getBoustrophedonMove(state, grid, { dx: 0, dy: 1 }, CELL_TYPES)).toBeNull();
    });

    it('honours the requested sweep orientation', () => {
        const grid = buildLawn(12, 12, { x: 0, y: 0 }, false);
        const state = {
            pos: { x: 5, y: 5 }, prevDir: { dx: 0, dy: 1 }, orientation: 'vertical',
            visitCounts: {}, dockPos: { x: 0, y: 0 }, isCharging: false,
            isReturningForCharge: false, battery: Infinity, grid,
        } as unknown as State;
        getBoustrophedonMove(state, grid, { dx: 0, dy: 1 }, CELL_TYPES);
        expect(state.cellData?.orientation).toBe('vertical');
    });
});
