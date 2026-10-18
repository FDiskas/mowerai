import type { HistoryRecord } from '../types';

/**
 * Best run first: the highest coverage, then the lowest penalty, then the
 * shortest duration, then the newest.
 */
export const compareRuns = (a: HistoryRecord, b: HistoryRecord): number =>
    b.coverage - a.coverage
    || a.penalty - b.penalty
    || a.duration - b.duration
    || b.id - a.id;

/** A record saved before runs stored `coverage`. */
type SavedRecord = Omit<HistoryRecord, 'coverage'> & { coverage?: number };

export class SimulationHistory {
    constructor(
        private readonly _records: HistoryRecord[] = []
    ) {}

    /** Old records have no coverage; they load as 0% so they rank below every newer run. */
    static fromSaved(saved: SavedRecord[]): SimulationHistory {
        return new SimulationHistory(saved.map(record => ({ ...record, coverage: record.coverage ?? 0 })));
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
