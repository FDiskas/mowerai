import { describe, it, expect } from 'vitest';
import { EfficiencyMetrics } from './SimulationStats';
import { SimulationGrid } from './SimulationGrid';
import { CELL_TYPES } from '../constants';
import type { Cell } from '../types';

const cell = (type: Cell['type']): Cell => ({ type, damage: 0, direction: null });

describe('EfficiencyMetrics.fromGrid', () => {
    it('counts mowed tiles as part of the lawn, so coverage stays within 100% after a map edit', () => {
        const grid = new SimulationGrid([
            [cell(CELL_TYPES.DOCK), cell(CELL_TYPES.MOWED), cell(CELL_TYPES.MOWED)],
            [cell(CELL_TYPES.GRASS), cell(CELL_TYPES.OBSTACLE), cell(CELL_TYPES.MOWED)],
        ]);

        const metrics = EfficiencyMetrics.fromGrid(grid);

        expect(metrics.mowedCount).toBe(3);
        expect(metrics.totalGrass).toBe(4);
        expect(metrics.coveragePercentage).toBe(75);
    });
});
