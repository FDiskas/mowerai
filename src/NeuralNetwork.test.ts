import { describe, it, expect } from 'vitest';
import { NeuralNetwork } from './NeuralNetwork';

const LAYERS = [3, 8, 4];

describe('NeuralNetwork', () => {
    it('outputs a probability distribution', () => {
        const out = new NeuralNetwork(LAYERS).predict([0.2, -0.5, 1]);
        expect(out).toHaveLength(4);
        expect(out.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    });

    it('copies weights without sharing them', () => {
        const original = new NeuralNetwork(LAYERS);
        const copy = original.copy();
        copy.mutate(1, 1);
        expect(copy.getWeights()).not.toEqual(original.getWeights());
        expect(original.copy().getWeights()).toEqual(original.getWeights());
    });

    it('lowers the loss when it trains on one sample', () => {
        const nn = new NeuralNetwork(LAYERS, 0.01);
        const inputs = [1, 0, -1];
        const targets = [0, 0, 1, 0];
        const first = nn.train(inputs, targets);
        for (let i = 0; i < 50; i++) nn.train(inputs, targets);
        expect(nn.train(inputs, targets)).toBeLessThan(first);
        expect(nn.predict(inputs).indexOf(Math.max(...nn.predict(inputs)))).toBe(2);
    });

    it('restores weights and optimizer state from save()', () => {
        const nn = new NeuralNetwork(LAYERS);
        nn.train([1, 2, 3], [1, 0, 0, 0]);
        const loaded = NeuralNetwork.load(nn.save());
        expect(loaded.getWeights()).toEqual(nn.getWeights());
        expect(loaded.save()).toBe(nn.save());
    });

    it('loads a model saved without optimizer state', () => {
        const nn = new NeuralNetwork(LAYERS);
        const loaded = NeuralNetwork.load(nn.save());
        expect(loaded.predict([1, 1, 1])).toEqual(nn.predict([1, 1, 1]));
        expect(JSON.parse(loaded.save()).mWeights).toBeUndefined();
    });
});
