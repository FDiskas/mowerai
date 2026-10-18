import { describe, it, expect } from 'vitest';
import { CELL_TYPES } from '../constants';
import { countGrass } from './simUtils';
import { countReachableGrass } from './episode';
import { generateTrainingMaps } from './trainingMaps';

describe('generateTrainingMaps', () => {
    it('keeps the dock and makes every room of the rooms layout reachable', () => {
        const dock = { x: 3, y: 4 };
        for (let run = 0; run < 20; run++) {
            const maps = generateTrainingMaps(25, 20, dock);
            expect(maps).toHaveLength(5);
            for (const map of maps) expect(map[dock.y][dock.x].type).toBe(CELL_TYPES.DOCK);
            const rooms = maps[2];
            expect(countReachableGrass(rooms, dock)).toBe(countGrass(rooms));
        }
    });

    it('gives every layout mostly reachable grass', () => {
        const dock = { x: 0, y: 0 };
        for (const map of generateTrainingMaps(25, 20, dock)) {
            expect(countReachableGrass(map, dock)).toBeGreaterThan(25 * 20 * 0.5);
        }
    });
});
