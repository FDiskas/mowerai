import type { HistoryRecord } from '../types';

/** Runs saved before the fixed score have no cost; they rank after every scored run. */
const costOrLast = (record: HistoryRecord) => record.cost ?? Infinity;

/**
 * Best run first: the highest coverage, then the lowest benchmark cost, then
 * the shortest duration, then the newest.
 */
export const compareRuns = (a: HistoryRecord, b: HistoryRecord): number =>
    b.coverage - a.coverage
    || costOrLast(a) - costOrLast(b)
    || a.duration - b.duration
    || b.id - a.id;

/** A record saved by an older version: without `coverage`, or with the old `penalty` points instead of `cost`. */
type SavedRecord = Omit<HistoryRecord, 'coverage' | 'cost'> & { coverage?: number; cost?: number | null };

export class SimulationHistory {
    constructor(
        private readonly _records: HistoryRecord[] = []
    ) {}

    /** Old records load with 0% coverage and no cost, so they rank below every newer run. */
    static fromSaved(saved: SavedRecord[]): SimulationHistory {
        return new SimulationHistory(saved.map(record => ({ ...record, coverage: record.coverage ?? 0, cost: record.cost ?? null })));
    }

    get records(): HistoryRecord[] { return this._records; }

    addRecord(record: HistoryRecord): SimulationHistory {
        return new SimulationHistory([...this._records, record]);
    }

    getWinnerId(): number | null {
        if (this._records.length < 2) return null;
        const [best] = [...this._records].sort(compareRuns);
        return best.coverage > 0 ? best.id : null;
    }
}
