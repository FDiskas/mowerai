import { describe, expect, it } from 'vitest';
import { createEsState } from '../simulation/evolutionStrategy';
import { initialParameters } from '../simulation/policyNetwork';
import { fromSnapshot, toSnapshot, type TrainingProgress, type TrainingSnapshot } from './trainingStore';

const LAYERS = [3, 4, 2];

const progress = (): TrainingProgress => {
    const es = createEsState(LAYERS, 1);
    es.generation = 42;
    es.m[0] = 0.5;
    return { es, best: { network: { layers: LAYERS, params: initialParameters(LAYERS, 2) }, generation: 40, validationCost: 2.5 } };
};

describe('trainingStore', () => {
    it('restores the strategy state and the best network', () => {
        const saved = progress();
        const restored = fromSnapshot(toSnapshot(saved), LAYERS);
        expect(Array.from(restored!.es.params)).toEqual(Array.from(saved.es.params));
        expect(restored!.es.m[0]).toBe(0.5);
        expect(restored!.es.generation).toBe(42);
        expect(Array.from(restored!.best.network.params)).toEqual(Array.from(saved.best.network.params));
        expect(restored!.best).toMatchObject({ generation: 40, validationCost: 2.5 });
    });

    it('copies the arrays, so later training does not change a snapshot', () => {
        const saved = progress();
        const snapshot = toSnapshot(saved);
        saved.es.params[0] += 1;
        expect(snapshot.params[0]).not.toBe(saved.es.params[0]);
    });

    it('drops snapshots of another network shape or an older format', () => {
        expect(fromSnapshot(toSnapshot(progress()), [3, 5, 2])).toBeNull();
        const oldFormat = { layers: LAYERS, championWeights: new Float64Array(26) } as unknown as TrainingSnapshot;
        expect(fromSnapshot(oldFormat, LAYERS)).toBeNull();
    });
});
