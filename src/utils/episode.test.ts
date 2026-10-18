import { describe, it, expect } from 'vitest';
import { CELL_TYPES } from '../constants';
import { buildLawn } from '../algorithms/testSupport';
import { advanceMower, countReachableGrass, startEpisode } from './episode';

const settings = { battery: 100, orientation: 'horizontal' as const, turnCost: 2 };

describe('advanceMower', () => {
    it('cuts the tile it leaves, not the tile it enters', () => {
        const dock = { x: 0, y: 0 };
        const state = startEpisode(buildLawn(4, 1, dock), dock, settings);
        advanceMower(state, { x: 1, y: 0 });
        expect(state.grid[0][1].type).toBe(CELL_TYPES.GRASS);

        const step = advanceMower(state, { x: 2, y: 0 });
        expect(step.outcome.cutFreshGrass).toBe(true);
        expect(state.grid[0][1].type).toBe(CELL_TYPES.MOWED);
        expect(state.pos).toEqual({ x: 2, y: 0 });
        expect(step.visitCount).toBe(1);
    });

    it('reports a turn when the heading changes', () => {
        const dock = { x: 0, y: 0 };
        const state = startEpisode(buildLawn(3, 3, dock), dock, settings);
        expect(advanceMower(state, { x: 0, y: 1 }).isTurn).toBe(false);
        expect(advanceMower(state, { x: 1, y: 1 }).isTurn).toBe(true);
    });
});

describe('startEpisode', () => {
    it('regrows a mowed lawn without changing the source', () => {
        const dock = { x: 0, y: 0 };
        const lawn = buildLawn(3, 1, dock);
        lawn[0][1] = { ...lawn[0][1], type: CELL_TYPES.MOWED, damage: 1 };
        const state = startEpisode(lawn, dock, settings);
        expect(state.grid[0][1]).toMatchObject({ type: CELL_TYPES.GRASS, damage: 0 });
        expect(lawn[0][1].type).toBe(CELL_TYPES.MOWED);
    });
});

describe('countReachableGrass', () => {
    it('ignores grass that obstacles cut off', () => {
        const dock = { x: 0, y: 0 };
        const lawn = buildLawn(5, 1, dock);
        lawn[0][2] = { ...lawn[0][2], type: CELL_TYPES.OBSTACLE };
        expect(countReachableGrass(lawn, dock)).toBe(1);
    });
});
