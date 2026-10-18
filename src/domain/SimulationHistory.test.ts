import { describe, it, expect } from 'vitest';
import { SimulationHistory, compareRuns } from './SimulationHistory';
import type { HistoryRecord } from '../types';

const run = (over: Partial<HistoryRecord>): HistoryRecord => ({
    id: 1, algo: 'spiral', distance: 10, turns: 2, mowedCount: 5, coverage: 100,
    duration: 3, damagedGrass: 0, chargeCycles: 0, penalty: 100, ...over,
});

describe('compareRuns', () => {
    it('ranks a full run above a partial run, whatever their penalties', () => {
        const partial = run({ id: 1, coverage: 40, penalty: 10 });
        const full = run({ id: 2, coverage: 100, penalty: 9000 });
        const idle = run({ id: 3, mowedCount: 0, coverage: 0, penalty: 0 });

        expect([idle, partial, full].sort(compareRuns).map(r => r.id)).toEqual([2, 1, 3]);
    });

    it('breaks coverage ties by penalty, then duration, then newest first', () => {
        const runs = [
            run({ id: 1, penalty: 50, duration: 9 }),
            run({ id: 2, penalty: 50, duration: 4 }),
            run({ id: 3, penalty: 50, duration: 4 }),
            run({ id: 4, penalty: 10, duration: 99 }),
        ];

        expect(runs.sort(compareRuns).map(r => r.id)).toEqual([4, 3, 2, 1]);
    });
});

describe('SimulationHistory.getWinnerId', () => {
    it('picks the first run of the ranked list, so the list and the crown agree', () => {
        const history = new SimulationHistory([
            run({ id: 1, coverage: 0, mowedCount: 0, penalty: 0 }),
            run({ id: 2, coverage: 60, penalty: 50 }),
            run({ id: 3, coverage: 100, penalty: 300 }),
        ]);

        expect(history.getWinnerId()).toBe(3);
    });

    it('has no winner with fewer than two runs or when no run mowed', () => {
        expect(new SimulationHistory([run({ id: 1 })]).getWinnerId()).toBeNull();
        expect(new SimulationHistory([run({ id: 1, coverage: 0 }), run({ id: 2, coverage: 0 })]).getWinnerId()).toBeNull();
    });
});

describe('SimulationHistory.fromSaved', () => {
    it('loads records saved without coverage as 0% so they rank last', () => {
        const legacy: Partial<HistoryRecord> = run({ id: 1, penalty: 0 });
        delete legacy.coverage;
        const history = SimulationHistory.fromSaved([legacy as HistoryRecord, run({ id: 2, coverage: 80 })]);

        expect(history.records[0].coverage).toBe(0);
        expect([...history.records].sort(compareRuns).map(r => r.id)).toEqual([2, 1]);
    });
});
