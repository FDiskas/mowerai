import { describe, it, expect } from 'vitest';
import { CELL_TYPES } from '../constants';
import { getDFSCoverageMove } from './dfsCoverage';
import { getSmartAIMove } from './smartAI';
import { buildLawn, countGrass, reachableGrass, runCoverage } from './testSupport';
import type { Grid, Direction, State } from '../types';

const move = (s: State, g: Grid, d: Direction) => getDFSCoverageMove(s, g, d, CELL_TYPES);
const fallback = (s: State, g: Grid, d: Direction) => getSmartAIMove(s, g, d, CELL_TYPES);

describe('getDFSCoverageMove', () => {
    it('covers an entire open lawn', () => {
        const dock = { x: 0, y: 0 };
        const grid = buildLawn(16, 12, dock, false);
        expect(runCoverage(grid, dock, move, fallback).grassLeft).toBe(0);
    });

    it('covers all reachable grass on an obstacle lawn', () => {
        const dock = { x: 0, y: 0 };
        const grid = buildLawn(25, 20, dock, true);
        const total = countGrass(grid);
        const reachable = reachableGrass(grid, dock);
        expect(runCoverage(grid, dock, move, fallback).grassLeft).toBe(total - reachable);
    });

    it('keeps its heading while grass lies straight ahead (long passes)', () => {
        const grid = buildLawn(10, 5, { x: 0, y: 0 }, false);
        const state = {
            pos: { x: 2, y: 2 }, prevDir: { dx: 1, dy: 0 }, orientation: 'horizontal',
            visitCounts: {}, dockPos: { x: 0, y: 0 }, isCharging: false,
            isReturningForCharge: false, battery: Infinity, grid,
        } as unknown as State;
        expect(getDFSCoverageMove(state, grid, { dx: 1, dy: 0 }, CELL_TYPES)).toEqual({ x: 3, y: 2 });
    });

    it('backtracks via A* when no fresh grass is adjacent', () => {
        // Everything mowed except one far cell; the mower must route to it.
        const grid: Grid = buildLawn(8, 8, { x: 0, y: 0 }, false)
            .map(row => row.map(c => c.type === CELL_TYPES.GRASS ? { ...c, type: CELL_TYPES.MOWED } : c));
        grid[7][7] = { type: CELL_TYPES.GRASS, damage: 0, direction: null };
        const state = {
            pos: { x: 0, y: 0 }, prevDir: { dx: 0, dy: 1 }, orientation: 'horizontal',
            visitCounts: {}, dockPos: { x: 0, y: 0 }, isCharging: false,
            isReturningForCharge: false, battery: Infinity, grid,
        } as unknown as State;
        const next = getDFSCoverageMove(state, grid, { dx: 0, dy: 1 }, CELL_TYPES)!;
        expect(next).not.toBeNull();
        // First step heads toward (7,7), i.e. away from the origin.
        expect(next.x + next.y).toBe(1);
    });
});
