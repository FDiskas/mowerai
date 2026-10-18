import { describe, expect, it } from 'vitest';
import { NeuralNetwork } from '../NeuralNetwork';
import { DEFAULT_FITNESS_CONFIG } from '../types';
import { fromSnapshot, parameterCount, toSnapshot, type TrainingProgress } from './trainingStore';

const LAYERS = [3, 4, 2];
const POPULATION_SIZE = 3;

const progressWith = (breeding: TrainingProgress['breeding']): TrainingProgress => ({
    champion: { nn: new NeuralNetwork(LAYERS), fitness: 1234 },
    breeding,
    generation: 42,
    idealFitness: 5000,
    fitnessConfig: { ...DEFAULT_FITNESS_CONFIG, turnPenalty: 77 },
});

const fullBreeding = (): TrainingProgress['breeding'] => ({
    population: Array.from({ length: POPULATION_SIZE }, (_, id) => ({ id, nn: new NeuralNetwork(LAYERS) })),
    mutationStrength: 0.25,
    stagnantGenerations: 7,
});

describe('trainingStore', () => {
    it('counts weights and biases of every layer', () => {
        expect(parameterCount(LAYERS)).toBe(3 * 4 + 4 + 4 * 2 + 2);
        expect(parameterCount(LAYERS)).toBe(new NeuralNetwork(LAYERS).getWeights().length);
    });

    it('restores the champion, the population and the counters', () => {
        const progress = progressWith(fullBreeding());
        const restored = fromSnapshot(toSnapshot(progress), LAYERS, POPULATION_SIZE);

        expect(restored?.champion.nn.getWeights()).toEqual(progress.champion.nn.getWeights());
        expect(restored?.champion.fitness).toBe(1234);
        expect(restored?.generation).toBe(42);
        expect(restored?.idealFitness).toBe(5000);
        expect(restored?.fitnessConfig.turnPenalty).toBe(77);
        expect(restored?.breeding?.mutationStrength).toBe(0.25);
        expect(restored?.breeding?.stagnantGenerations).toBe(7);
        expect(restored?.breeding?.population.map(p => p.id)).toEqual([0, 1, 2]);
        expect(restored?.breeding?.population.map(p => p.nn.getWeights()))
            .toEqual(progress.breeding?.population.map(p => p.nn.getWeights()));
    });

    it('keeps an imported model without a population', () => {
        const restored = fromSnapshot(toSnapshot(progressWith(null)), LAYERS, POPULATION_SIZE);

        expect(restored?.champion.fitness).toBe(1234);
        expect(restored?.breeding).toBeNull();
    });

    it('drops the population when the population size changed', () => {
        const restored = fromSnapshot(toSnapshot(progressWith(fullBreeding())), LAYERS, POPULATION_SIZE + 1);

        expect(restored?.champion).toBeDefined();
        expect(restored?.breeding).toBeNull();
    });

    it('rejects a snapshot saved for another network shape', () => {
        const snapshot = toSnapshot(progressWith(fullBreeding()));

        expect(fromSnapshot(snapshot, [3, 5, 2], POPULATION_SIZE)).toBeNull();
        expect(fromSnapshot({ ...snapshot, championWeights: new Float64Array(3) }, LAYERS, POPULATION_SIZE)).toBeNull();
    });

    it('fills fitness settings that were added after the save', () => {
        const snapshot = toSnapshot(progressWith(null));
        const olderConfig: Partial<typeof snapshot.fitnessConfig> = { ...snapshot.fitnessConfig };
        delete olderConfig.turnPenalty;
        const restored = fromSnapshot({ ...snapshot, fitnessConfig: olderConfig as typeof snapshot.fitnessConfig }, LAYERS, POPULATION_SIZE);

        expect(restored?.fitnessConfig.turnPenalty).toBe(DEFAULT_FITNESS_CONFIG.turnPenalty);
    });
});
