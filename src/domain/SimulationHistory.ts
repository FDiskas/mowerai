import type { HistoryRecord } from '../types';

export class SimulationHistory {
    constructor(
        private readonly _records: HistoryRecord[] = []
    ) {}

    get records(): HistoryRecord[] { return this._records; }

    addRecord(record: HistoryRecord): SimulationHistory {
        return new SimulationHistory([...this._records, record]);
    }

    getWinnerId(): number | null {
        if (this._records.length < 2) return null;
        const validRecords = this._records.filter(h => h.mowedCount > 0);
        if (validRecords.length === 0) return null;
        
        return validRecords.reduce((prev, curr) => {
            if (curr.penalty !== prev.penalty) return curr.penalty < prev.penalty ? curr : prev;
            return curr.duration < prev.duration ? curr : prev;
        }).id;
    }

    clear(): SimulationHistory {
        return new SimulationHistory([]);
    }
}
