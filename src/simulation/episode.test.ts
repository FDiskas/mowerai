import { describe, it, expect } from 'vitest';
import { CELL_TYPES } from '../constants';
import { buildLawn } from '../algorithms/testSupport';
import type { Point } from '../types';
import { algorithmPolicy } from './algorithmPolicies';
import { countReachableGrass, DEFAULT_EPISODE_CONFIG, Episode, RECHARGED_SHARE, runEpisode, type MovePolicy } from './episode';
import { isSeen } from './knownMap';

const dock = { x: 0, y: 0 };
const lawnOf = (cols: number, rows: number, obstacles: Point[] = []) => {
    const grid = buildLawn(cols, rows, dock);
    for (const { x, y } of obstacles) grid[y][x] = { ...grid[y][x], type: CELL_TYPES.OBSTACLE };
    return { grid, dock };
};
const stepTo = (target: Point): MovePolicy => () => target;

describe('Episode', () => {
    it('cuts the tile it leaves and counts steps, turns and overlaps', () => {
        const episode = new Episode(lawnOf(4, 2));
        episode.step(stepTo({ x: 1, y: 0 }));
        expect(episode.lawn[0][1].type).toBe(CELL_TYPES.GRASS);
        episode.step(stepTo({ x: 1, y: 1 }));
        expect(episode.lawn[0][1].type).toBe(CELL_TYPES.MOWED);
        episode.step(stepTo({ x: 1, y: 0 }));
        episode.step(stepTo({ x: 1, y: 1 }));
        expect(episode.tally).toMatchObject({ steps: 4, turns: 4, mowed: 2, overlaps: 1 });
    });

    it('starts knowing only what the sensor sees and learns as it drives', () => {
        const episode = new Episode(lawnOf(10, 1, [{ x: 5, y: 0 }]), { ...DEFAULT_EPISODE_CONFIG, sensorRange: 2 });
        expect(isSeen(episode.known, 2, 0)).toBe(true);
        expect(isSeen(episode.known, 3, 0)).toBe(false);
        expect(episode.known.grid[0][5].type).toBe(CELL_TYPES.GRASS);

        for (let x = 1; x <= 3; x++) episode.step(stepTo({ x, y: 0 }));
        expect(episode.known.grid[0][5].type).toBe(CELL_TYPES.OBSTACLE);
        expect(episode.state.mapVersion).toBe(1);
    });

    it('refuses a move into an obstacle or a jump', () => {
        expect(() => new Episode(lawnOf(3, 2, [{ x: 1, y: 0 }])).step(stepTo({ x: 1, y: 0 }))).toThrow(/Illegal move/);
        expect(() => new Episode(lawnOf(3, 1)).step(stepTo({ x: 2, y: 0 }))).toThrow(/Illegal move/);
    });

    it('drives home to charge when the battery is low, then mows on', () => {
        const episode = new Episode(lawnOf(6, 1));
        const policy = algorithmPolicy('dfs_coverage');
        episode.step(policy);
        episode.step(policy);
        episode.state.battery = 1;

        expect(episode.step(policy).notice).toBe('battery-low');
        expect(episode.state.pos).toEqual({ x: 1, y: 0 });
        episode.step(policy);
        expect(episode.state.pos).toEqual(dock);
        expect(episode.step(policy).notice).toBe('charged');
        expect(episode.state.battery).toBeCloseTo(DEFAULT_EPISODE_CONFIG.maxBattery * RECHARGED_SHARE);

        while (!episode.isFinished) episode.step(policy);
        expect(episode.endReason).toBe('completed');
        expect(episode.tally).toMatchObject({ chargeTrips: 1, mowed: 5, reachableGrass: 5 });
    });

    it('goes home and ends at the dock when the known map holds no more work', () => {
        const episode = runEpisode(lawnOf(5, 5, [{ x: 2, y: 2 }]), algorithmPolicy('smart_ai'));
        expect(episode.endReason).toBe('completed');
        expect(episode.state.pos).toEqual(dock);
        expect(episode.tally).toMatchObject({ mowed: 23, reachableGrass: 23, endedAtDock: true });
    });

    it('ends a run that stops cutting grass', () => {
        const pingPong: MovePolicy = state => (state.pos.x === 0 ? { x: 1, y: 0 } : { x: 0, y: 0 });
        const episode = runEpisode(lawnOf(6, 6), pingPong);
        expect(episode.endReason).toBe('stalled');
        expect(episode.tally.mowed).toBeLessThan(episode.tally.reachableGrass);
    });
});

describe('countReachableGrass', () => {
    it('ignores grass that obstacles cut off and can skip the start tile', () => {
        const { grid } = lawnOf(5, 1, [{ x: 2, y: 0 }]);
        expect(countReachableGrass(grid, dock)).toBe(1);
        expect(countReachableGrass(grid, { x: 1, y: 0 }, true)).toBe(0);
    });
});
