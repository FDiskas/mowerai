import { describe, it, expect } from 'vitest';
import { SimulationHistory, compareRuns } from './SimulationHistory';
import type { HistoryRecord } from '../types';

const run = (over: Partial<HistoryRecord>): HistoryRecord => ({
    id: 1, algo: 'spiral', distance: 10, turns: 2, mowedCount: 5, coverage: 100,
    duration: 3, damagedGrass: 0, chargeCycles: 0, cost: 2.5, ...over,
});

describe('compareRuns', () => {
    it('ranks a full run above a partial run, whatever their costs', () => {
        const partial = run({ id: 1, coverage: 40, cost: 1 });
        const full = run({ id: 2, coverage: 100, cost: 9 });
        const idle = run({ id: 3, mowedCount: 0, coverage: 0, cost: 0 });

        expect([idle, partial, full].sort(compareRuns).map(r => r.id)).toEqual([2, 1, 3]);
    });

    it('breaks coverage ties by cost, then duration, then newest first', () => {
        const runs = [
            run({ id: 1, cost: 3, duration: 9 }),
            run({ id: 2, cost: 3, duration: 4 }),
            run({ id: 3, cost: 3, duration: 4 }),
            run({ id: 4, cost: 2, duration: 99 }),
        ];

        expect(runs.sort(compareRuns).map(r => r.id)).toEqual([4, 3, 2, 1]);
    });

    it('ranks runs without a cost after scored runs', () => {
        expect([run({ id: 1, cost: null }), run({ id: 2, cost: 5 })].sort(compareRuns).map(r => r.id)).toEqual([2, 1]);
    });
});

describe('SimulationHistory.getWinnerId', () => {
    it('picks the first run of the ranked list, so the list and the crown agree', () => {
        const history = new SimulationHistory([
            run({ id: 1, coverage: 0, mowedCount: 0, cost: 0 }),
            run({ id: 2, coverage: 60, cost: 2 }),
            run({ id: 3, coverage: 100, cost: 4 }),
        ]);

        expect(history.getWinnerId()).toBe(3);
    });

    it('has no winner with fewer than two runs or when no run mowed', () => {
        expect(new SimulationHistory([run({ id: 1 })]).getWinnerId()).toBeNull();
        expect(new SimulationHistory([run({ id: 1, coverage: 0 }), run({ id: 2, coverage: 0 })]).getWinnerId()).toBeNull();
    });
});

describe('SimulationHistory.fromSaved', () => {
    it('loads old records with 0% coverage and no cost, so they rank last', () => {
        const legacy = { ...run({ id: 1 }), coverage: undefined, cost: undefined, penalty: 0 };
        const history = SimulationHistory.fromSaved([legacy, run({ id: 2, coverage: 80 })]);

        expect(history.records[0]).toMatchObject({ coverage: 0, cost: null });
        expect([...history.records].sort(compareRuns).map(r => r.id)).toEqual([2, 1]);
    });
});
