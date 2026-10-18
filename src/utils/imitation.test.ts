import { describe, it, expect } from 'vitest';
import { NeuralNetwork } from '../NeuralNetwork';
import { buildLawn } from '../algorithms/testSupport';
import { collectDemonstrations, imitateExpert } from './imitation';

describe('imitation', () => {
    const dock = { x: 0, y: 0 };
    const demonstrations = collectDemonstrations([buildLawn(8, 6, dock, true)], dock, 2);

    it('records one-hot expert moves for both orientations', () => {
        expect(demonstrations.length).toBeGreaterThan(40);
        for (const { inputs, targets } of demonstrations) {
            expect(inputs).toHaveLength(47);
            expect(targets.reduce((a, b) => a + b, 0)).toBe(1);
        }
    });

    it('teaches the network to copy the expert', () => {
        const nn = new NeuralNetwork([47, 64, 32, 4]);
        const before = imitateExpert(nn.copy(), demonstrations, 0).accuracy;
        const after = imitateExpert(nn, demonstrations, 10).accuracy;
        expect(after).toBeGreaterThan(Math.max(before, 0.7));
    });
});
