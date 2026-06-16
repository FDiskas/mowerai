import { describe, it, expect } from 'vitest';
import { CELL_TYPES } from '../constants';
import { getPotentialFieldMove } from './potentialField';
import { getSmartAIMove } from './smartAI';
import { buildLawn, countGrass, reachableGrass, runCoverage } from './testSupport';
import type { Grid, Direction, State } from '../types';

const move = (s: State, g: Grid) => getPotentialFieldMove(s, g, CELL_TYPES);
const fallback = (s: State, g: Grid, d: Direction) => getSmartAIMove(s, g, d, CELL_TYPES);

describe('getPotentialFieldMove', () => {
    it('moves out from the dock instead of oscillating in place (regression)', () => {
        // Previously the mower bounced between the two tiles next to the dock
        // (a potential-field local minimum) and never left the base.
        const dock = { x: 0, y: 0 };
        const grid = buildLawn(25, 20, dock, true);
        const r = runCoverage(grid, dock, move, fallback);

        expect(r.movedAwayFromDock).toBe(true);
        expect(r.maxDistFromDock).toBeGreaterThan(10); // genuinely crosses the lawn
    });

    it('covers every reachable grass cell on an open lawn', () => {
        const dock = { x: 0, y: 0 };
        const grid = buildLawn(15, 12, dock, false);
        const r = runCoverage(grid, dock, move, fallback);
        expect(r.grassLeft).toBe(0);
    });

    it('covers all reachable grass with obstacles (only enclosed cells remain)', () => {
        const dock = { x: 0, y: 0 };
        const grid = buildLawn(25, 20, dock, true);
        const total = countGrass(grid);
        const reachable = reachableGrass(grid, dock);
        const r = runCoverage(grid, dock, move, fallback);
        expect(r.grassLeft).toBe(total - reachable);
    });

    it('descends toward fresh grass and never returns a mowed/obstacle tile', () => {
        const dock = { x: 0, y: 0 };
        const grid = buildLawn(10, 10, dock, false);
        const state = {
            pos: { x: 0, y: 0 }, prevDir: { dx: 0, dy: 1 }, visitCounts: {},
            orientation: 'horizontal', dockPos: dock, isCharging: false,
            isReturningForCharge: false, battery: Infinity, grid,
        } as unknown as State;
        const next = getPotentialFieldMove(state, grid, CELL_TYPES)!;
        expect(next).not.toBeNull();
        expect(grid[next.y][next.x].type).toBe(CELL_TYPES.GRASS);
    });
});
