import { describe, it, expect } from 'vitest';
import { compareToBestOther, meanCosts, signTest, type MapResult } from './benchmark';
import { costPerTile, runCost, SCORE_WEIGHTS, type RunTally } from './score';

const tally = (overrides: Partial<RunTally> = {}): RunTally => ({
    steps: 100, turns: 10, overlaps: 5, chargeTrips: 1, mowed: 90, reachableGrass: 90, endedAtDock: true, ...overrides,
});

const mapWith = (costs: Record<string, number>): MapResult => ({
    seed: 1,
    width: 1,
    height: 1,
    runs: Object.fromEntries(Object.entries(costs).map(([id, cost]) => [id, { cost, tally: tally(), endReason: 'completed' }])),
});

describe('runCost', () => {
    it('adds the fixed weights', () => {
        expect(runCost(tally())).toBe(100 + 10 * SCORE_WEIGHTS.turn + 5 + SCORE_WEIGHTS.chargeTrip);
        expect(costPerTile(tally({ mowed: 80, endedAtDock: false })))
            .toBeCloseTo((150 + 10 * SCORE_WEIGHTS.missedTile + SCORE_WEIGHTS.notDocked) / 90);
    });

    it('makes skipping a tile cost more than cutting it', () => {
        expect(SCORE_WEIGHTS.missedTile).toBeGreaterThan(SCORE_WEIGHTS.step + SCORE_WEIGHTS.turn * 2 + SCORE_WEIGHTS.overlap);
    });
});

describe('signTest', () => {
    it('matches the binomial distribution', () => {
        expect(signTest(0, 0)).toBe(1);
        expect(signTest(5, 5)).toBe(1);
        expect(signTest(10, 0)).toBeCloseTo(2 / 1024, 6);
    });
});

describe('compareToBestOther', () => {
    it('compares against the cheapest other model on each map', () => {
        const results = [
            mapWith({ nn: 1, a: 2, b: 3 }),
            mapWith({ nn: 3, a: 2, b: 2.5 }),
            mapWith({ nn: 2, a: 2, b: 4 }),
        ];
        const comparison = compareToBestOther(results, 'nn', ['a', 'b']);
        expect(comparison).toMatchObject({ wins: 1, losses: 1, ties: 1, maps: 3, bestOtherCounts: { a: 3 } });
        expect(comparison.meanDifference).toBeCloseTo(0);
        expect(meanCosts(results).b).toBeCloseTo(9.5 / 3);
    });
});
